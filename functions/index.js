'use strict';
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldPath } = require('firebase-admin/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const { expireReservation } = require('./expiry');
initializeApp();

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
