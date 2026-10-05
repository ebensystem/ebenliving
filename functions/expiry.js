'use strict';
const PENDING_HOURS = 48;
const PENDING_MS = PENDING_HOURS * 60 * 60 * 1000;

// Firestore createTime is authoritative; client-createdAt/expiresAt are ignored.
function deadlineFor(snapshot) {
  const created = snapshot.createTime?.toMillis();
  if (!Number.isFinite(created)) throw new Error('Missing server creation time');
  return created + PENDING_MS;
}

async function expireReservation(db, reference, now = Date.now()) {
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return 'missing';
    const reservation = snapshot.data();
    if (reservation.status !== 'pendente') return 'unchanged';
    const expiresAtMs = deadlineFor(snapshot);
    if (expiresAtMs > now) {
      if (reservation.expiresAtMs !== expiresAtMs) transaction.update(reference, { expiresAtMs });
      return 'pending';
    }
    // Re-read status and locks in the same transaction. Retries cannot undo a
    // concurrent confirmation or delete a lock now owned by another request.
    const locks = await transaction.get(db.collection('availability').where('reservationId', '==', snapshot.id));
    if (locks.size > 400) throw new Error('Reservation exceeds the supported lock count');
    for (const lock of locks.docs) transaction.delete(lock.ref);
    transaction.update(reference, {
      status: 'cancelada', cancelReason: 'expired',
      expiresAtMs, expiredAt: new Date(now).toISOString()
    });
    return 'expired';
  });
}

module.exports = { PENDING_HOURS, PENDING_MS, deadlineFor, expireReservation };
