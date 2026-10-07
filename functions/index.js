'use strict';
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldPath } = require('firebase-admin/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const { expireReservation } = require('./expiry');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getAuth } = require('firebase-admin/auth');
const cloudinaryDocuments = require('./cloudinary-documents');
initializeApp();

const CLOUDINARY_API_KEY = defineSecret('CLOUDINARY_API_KEY');
const CLOUDINARY_API_SECRET = defineSecret('CLOUDINARY_API_SECRET');

exports.expirePendingReservations = onSchedule({
  schedule: 'every 15 minutes', timeZone: 'America/Sao_Paulo',
  region: 'southamerica-east1', timeoutSeconds: 540,
  memory: '256MiB', maxInstances: 1, retryCount: 3
}, async () => {
  const db = getFirestore();
  const now = Date.now();
  let cursor, expired = 0, scanned = 0, failures = 0;
  do {
    let query = db.collection('reservations').where('status', '==', 'pendente')
      .orderBy(FieldPath.documentId()).limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (const item of page.docs) {
      scanned++;
      try { if (await expireReservation(db, item.ref, now) === 'expired') expired++; }
      catch (error) { failures++; logger.error('Expiration failed', { reservationId: item.id, message: error.message }); }
    }
    cursor = page.docs.at(-1);
    if (page.size < 100) break;
  } while (cursor);
  logger.info('Pending expiration completed', { scanned, expired, failures });
  if (failures) throw new Error(`${failures} expiration operations failed`);
});

function cors(req, res) {
  const origin = req.get('origin') || '';
  if (['https://ebenliving.com.br', 'https://www.ebenliving.com.br', 'http://localhost:5000', 'http://127.0.0.1:5000'].includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return true; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return true; }
  return false;
}
async function authContext(req) {
  const header = req.get('authorization') || '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) throw Object.assign(new Error('Faça login novamente.'), { status: 401 });
  const token = await getAuth().verifyIdToken(match[1]);
  const admin = token.admin === true || (token.email === 'suporte@ebensystem.com.br' && token.email_verified === true);
  return { uid: token.uid, admin };
}
async function readMultipart(req) {
  const { default: Busboy } = await import('@fastify/busboy');
  return new Promise((resolve, reject) => {
    const parser = Busboy({ headers: req.headers, limits: { files: 1, fileSize: cloudinaryDocuments.MAX_BYTES, fields: 2 } });
    const chunks = [];
    let fileInfo, limitHit = false;
    parser.on('file', (name, stream, info) => {
      fileInfo = info;
      stream.on('limit', () => { limitHit = true; });
      stream.on('data', chunk => chunks.push(chunk));
    });
    parser.on('error', reject);
    parser.on('finish', () => limitHit ? reject(Object.assign(new Error('Arquivo excede 5 MB.'), { status: 413 }))
      : !fileInfo ? reject(Object.assign(new Error('Arquivo ausente.'), { status: 400 }))
        : resolve({ buffer: Buffer.concat(chunks), contentType: fileInfo.mimeType }));
    parser.end(req.rawBody);
  });
}
const documentCors = { cors: ['https://ebenliving.com.br', 'https://www.ebenliving.com.br', 'http://localhost:5000', 'http://127.0.0.1:5000'], maxInstances: 10, timeoutSeconds: 120, memory: '512MiB', secrets: [CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET] };
const stageCors = { cors: ['https://ebenliving.com.br', 'https://www.ebenliving.com.br', 'http://localhost:5000', 'http://127.0.0.1:5000'], maxInstances: 10, timeoutSeconds: 60, memory: '256MiB' };
exports.uploadRentalDocument = onRequest(documentCors, async (req, res) => {
  if (cors(req, res)) return;
  try {
    const { uid, admin } = await authContext(req);
    const reservationId = String(req.query.reservationId || req.body?.reservationId || '');
    const kind = String(req.query.kind || req.body?.kind || '');
    const db = getFirestore();
    const ref = db.collection('reservations').doc(reservationId);
    const snapshot = await ref.get();
    const reservation = snapshot.data();
    if (!snapshot.exists || reservation?.plan !== 'home' || !cloudinaryDocuments.authorized(reservation, uid, admin)) throw Object.assign(new Error('Solicitação não encontrada.'), { status: 404 });
    if (kind === 'identity' && (reservation.userId !== uid || reservation.stage !== 1)) throw Object.assign(new Error('Etapa inválida para documento de identidade.'), { status: 403 });
    if (kind === 'tenant-contract' && (reservation.userId !== uid || reservation.stage !== 3)) throw Object.assign(new Error('Etapa inválida para o contrato do inquilino.'), { status: 403 });
    if (kind === 'host-contract' && (!(reservation.propertyOwnerId === uid || admin) || reservation.stage !== 4 || !reservation.documents?.tenantContract)) throw Object.assign(new Error('Etapa inválida para o contrato do proprietário.'), { status: 403 });
    const { buffer, contentType } = await readMultipart(req);
    if (kind === 'identity' && !['image/jpeg', 'image/png', 'application/pdf'].includes(contentType)) throw Object.assign(new Error('Identidade deve ser JPG, PNG ou PDF.'), { status: 400 });
    if (kind !== 'identity' && contentType !== 'application/pdf') throw Object.assign(new Error('Envie o contrato em PDF.'), { status: 400 });
    const document = await cloudinaryDocuments.uploadDocument({ buffer, contentType, reservationId, uid, kind });
    const field = ({ identity: 'identity', 'tenant-contract': 'tenantContract', 'host-contract': 'hostContract' })[kind];
    await ref.update({ [`documents.${field}`]: { ...document, uploadedBy: uid, uploadedAt: new Date().toISOString() } });
    res.status(200).json({ document: { kind, uploadedAt: new Date().toISOString() } });
  } catch (error) {
    logger.error('Rental document upload failed', { message: error.message });
    res.status(error.status || 500).json({ error: error.message || 'upload-failed' });
  }
});
exports.getRentalDocumentUrl = onRequest(documentCors, async (req, res) => {
  if (cors(req, res)) return;
  try {
    const { uid, admin } = await authContext(req);
    const reservationId = String(req.query.reservationId || req.body?.reservationId || '');
    const kind = String(req.query.kind || req.body?.kind || '');
    const db = getFirestore();
    const snapshot = await db.collection('reservations').doc(reservationId).get();
    const reservation = snapshot.data();
    if (!snapshot.exists || !cloudinaryDocuments.authorized(reservation, uid, admin)) throw Object.assign(new Error('Solicitação não encontrada.'), { status: 404 });
    const field = ({ identity: 'identity', 'tenant-contract': 'tenantContract', 'host-contract': 'hostContract' })[kind];
    const document = field && reservation.documents?.[field];
    if (!document) throw Object.assign(new Error('Documento não disponível.'), { status: 404 });
    const url = await cloudinaryDocuments.signedDownload({ ...document, attachment: req.query.download === '1' || req.body?.download === true });
    res.status(200).json({ url });
  } catch (error) {
    logger.error('Rental document URL failed', { message: error.message });
    res.status(error.status || 500).json({ error: error.message || 'document-url-failed' });
  }
});
exports.advanceRentalStage = onRequest(stageCors, async (req, res) => {
  if (cors(req, res)) return;
  try {
    const { uid, admin } = await authContext(req);
    const { reservationId, action, cpf, lessorName, lessorCpf, draftContractText } = req.body || {};
    const ref = getFirestore().collection('reservations').doc(String(reservationId || ''));
    const snapshot = await ref.get();
    const reservation = snapshot.data();
    if (!snapshot.exists || reservation?.plan !== 'home' || !cloudinaryDocuments.authorized(reservation, uid, admin)) throw Object.assign(new Error('Solicitação não encontrada.'), { status: 404 });
    const host = reservation.propertyOwnerId === uid || admin;
    const tenant = reservation.userId === uid;
    if (action === 'approve-first' && host && reservation.stage === 0 && reservation.status === 'pendente') {
      await ref.update({ stage: 1 });
    } else if (action === 'approve-identity' && host && reservation.stage === 1 && reservation.documents?.identity) {
      await ref.update({ stage: 2, status: 'confirmada', identityApprovedAt: new Date().toISOString() });
    } else if (action === 'prepare-contract' && tenant && reservation.stage === 2) {
      const digits = String(cpf || '').replace(/\D/g, ''), ownerDigits = String(lessorCpf || '').replace(/\D/g, ''), name = String(lessorName || '').trim();
      const contract = String(draftContractText || '').trim();
      if (digits.length !== 11 || ownerDigits.length !== 11 || name.length < 3 || contract.length < 100 || contract.length > 6000) throw Object.assign(new Error('Confira os dados e o texto do contrato.'), { status: 400 });
      await ref.update({ stage: 3, cpf: digits, lessorName: name, lessorCpf: ownerDigits, draftContractText: contract, contractGeneratedAt: new Date().toISOString() });
    } else if (action === 'tenant-signed' && tenant && reservation.stage === 3 && reservation.documents?.tenantContract) {
      await ref.update({ stage: 4, tenantSignedAt: new Date().toISOString() });
    } else if (action === 'host-signed' && host && reservation.stage === 4 && reservation.documents?.hostContract) {
      await ref.update({ stage: 5, hostSignedAt: new Date().toISOString() });
    } else if (action === 'keys' && host && reservation.stage === 5) {
      await ref.update({ stage: 6, keysScheduledAt: new Date().toISOString() });
    } else {
      throw Object.assign(new Error('A ação não corresponde à etapa atual.'), { status: 409 });
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('Rental stage transition failed', { message: error.message });
    res.status(error.status || 500).json({ error: error.message || 'stage-transition-failed' });
  }
});
