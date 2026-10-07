'use strict';
const CLOUD_NAME = 'ztdylmq7';
const API_KEY = process.env.CLOUDINARY_API_KEY || '';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
const API = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}`;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

function formBody(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => params.set(key, String(value)));
  return params;
}
function signature(values, secret = API_SECRET) {
  if (!secret) throw new Error('Secret do Cloudinary não configurado.');
  const crypto = require('node:crypto');
  const payload = Object.keys(values).sort().map(key => `${key}=${values[key]}`).join('&');
  return crypto.createHash('sha1').update(payload + secret).digest('hex');
}
function authorized(reservation, uid, admin) {
  return !!reservation && (admin || reservation.userId === uid || reservation.propertyOwnerId === uid);
}
function assetPublicId(reservationId, uid, kind) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(reservationId) || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)
      || !['identity', 'tenant-contract', 'host-contract'].includes(kind)) throw new Error('Documento inválido.');
  return `ebenliving/documentos/${reservationId}/${uid}/${kind}-${require('node:crypto').randomUUID()}`;
}
async function uploadDocument({ buffer, contentType, reservationId, uid, kind, fetchImpl = fetch }) {
  if (!buffer?.length || buffer.length > MAX_BYTES || !TYPES.has(contentType)) throw new Error('Arquivo inválido. Use PDF, JPG ou PNG de até 5 MB.');
  const publicId = assetPublicId(reservationId, uid, kind);
  const timestamp = Math.floor(Date.now() / 1000);
  const resourceType = contentType === 'application/pdf' ? 'raw' : 'image';
  const fields = { public_id: publicId, timestamp, type: 'authenticated', overwrite: false };
  const body = new FormData();
  body.append('file', new Blob([buffer], { type: contentType }), contentType === 'application/pdf' ? 'document.pdf' : 'identity');
  Object.entries(fields).forEach(([key, value]) => body.append(key, String(value)));
  body.append('api_key', API_KEY);
  body.append('signature', signature(fields));
  const response = await fetchImpl(`${API}/${resourceType}/upload`, { method: 'POST', body });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.public_id !== publicId || result.type !== 'authenticated') throw new Error('O Cloudinary não aceitou o envio privado.');
  return { publicId, resourceType, format: result.format || '', bytes: result.bytes || buffer.length, contentType };
}
async function signedDownload({ publicId, resourceType, format, attachment = false, fetchImpl = fetch }) {
  if (typeof publicId !== 'string' || !publicId.startsWith('ebenliving/documentos/')) throw new Error('Documento inválido.');
  if (!['raw', 'image'].includes(resourceType)) throw new Error('Tipo de documento inválido.');
  const extension = String(format || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (!extension) throw new Error('Formato de documento inválido.');
  const timestamp = Math.floor(Date.now() / 1000);
  const values = { public_id: publicId, format: extension, timestamp, type: 'authenticated', ...(attachment ? { attachment: 'true' } : {}) };
  const signed = signature(values);
  const body = formBody({ ...values, api_key: API_KEY, signature: signed });
  const endpoint = `${API}/${resourceType}/download`;
  const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.secure_url || !result.secure_url.startsWith(`https://res.cloudinary.com/${CLOUD_NAME}/`)) throw new Error('Não foi possível criar link protegido para este documento.');
  return result.secure_url;
}

module.exports = { MAX_BYTES, TYPES, authorized, assetPublicId, signature, uploadDocument, signedDownload };
