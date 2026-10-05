const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PENDING_MS, deadlineFor, expireReservation } = require('../functions/expiry');

function fixture(status = 'pendente', created = 0, locks = ['a', 'b']) {
  const changes = [], deletions = [], queries = [];
  const ref = { id: 'reservation' };
  const snapshot = { id: ref.id, exists: true, createTime: { toMillis: () => created }, data: () => ({ status, createdAt: '2099-01-01', expiresAtMs: 99999999999999 }) };
  const tx = {
    get: async target => target === ref ? snapshot : { size: locks.length, docs: locks.map(id => ({ ref: { id } })) },
    update: (_ref, patch) => changes.push(patch), delete: lock => deletions.push(lock.id)
  };
  const db = { runTransaction: fn => fn(tx), collection: name => ({ where: (...args) => { queries.push([name, ...args]); return {}; } }) };
  return { db, ref, changes, deletions, queries, snapshot };
}
test('deadline uses server creation time and exactly 48 hours', () => {
  const f = fixture('pendente', 1000);
  assert.equal(deadlineFor(f.snapshot), 1000 + 48 * 60 * 60 * 1000);
});
test('before deadline only records the authoritative expiry', async () => {
  const f = fixture(); assert.equal(await expireReservation(f.db, f.ref, PENDING_MS - 1), 'pending');
  assert.deepEqual(f.deletions, []); assert.deepEqual(f.changes, [{ expiresAtMs: PENDING_MS }]);
});
test('at deadline cancels request and releases only its queried locks', async () => {
  const f = fixture(); assert.equal(await expireReservation(f.db, f.ref, PENDING_MS), 'expired');
  assert.deepEqual(f.queries, [['availability', 'reservationId', '==', 'reservation']]);
  assert.deepEqual(f.deletions, ['a', 'b']); assert.equal(f.changes[0].cancelReason, 'expired');
});
for (const status of ['confirmada', 'cancelada']) test(`${status} is never expired`, async () => {
  const f = fixture(status); assert.equal(await expireReservation(f.db, f.ref, PENDING_MS * 2), 'unchanged');
  assert.deepEqual(f.changes, []); assert.deepEqual(f.deletions, []);
});
