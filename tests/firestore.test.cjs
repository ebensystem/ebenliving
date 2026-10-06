const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, updateDoc, writeBatch } = require('firebase/firestore');
const functionsRequire = createRequire(path.join(__dirname, '../functions/index.js'));
const { initializeApp, deleteApp } = functionsRequire('firebase-admin/app');
const { getFirestore } = functionsRequire('firebase-admin/firestore');
const { expireReservation, PENDING_MS } = require('../functions/expiry');
const projectId = 'demo-ebenliving-tests';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
let env, adminApp, adminDb;
const listing = { id: 'casa', ownerId: 'host', active: true, title: 'Casa', city: 'Teste', state: 'SP', price: 100, guests: 2, images: ['https://example.com/a.jpg'], unavailable: ['2030-02-01'], plan: 'flex' };
const reservation = (extra = {}) => ({ id: 'r', userId: 'customer', propertyOwnerId: 'host', propertyId: 'casa', guest: 'Cliente', contact: 'cliente@example.com', guests: 1, checkIn: '2030-01-01', checkOut: '2030-01-03', total: 200, status: 'pendente', ...extra });
const dbFor = uid => env.authenticatedContext(uid, { email: uid + '@example.com', email_verified: true }).firestore();
before(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8085, rules: fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8') } });
  adminApp = initializeApp({ projectId }, 'expiry-tests'); adminDb = getFirestore(adminApp);
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'properties/casa'), listing);
    await setDoc(doc(context.firestore(), 'users/host'), { displayName: 'Anunciante', email: 'host@example.com', accountType: 'host' });
  });
});
after(async () => { await env?.cleanup(); if (adminApp) await deleteApp(adminApp); });
test('public listing read; anonymous reservation denied', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, 'properties/casa')));
  await assertFails(setDoc(doc(db, 'reservations/r'), reservation()));
});
test('customer creates reservation and canonical availability lock atomically', async () => {
  const db = dbFor('customer'), batch = writeBatch(db);
  batch.set(doc(db, 'reservations/r'), reservation());
  batch.set(doc(db, 'availability/casa_2030-01-01'), { propertyId: 'casa', date: '2030-01-01', reservationId: 'r' });
  await assertSucceeds(batch.commit());
});
for (const [name, changes] of Object.entries({
  'wrong user': { userId: 'stranger' }, 'wrong owner': { propertyOwnerId: 'stranger' },
  'excess guests': { guests: 3 }, 'reverse dates': { checkOut: '2029-01-01' },
  'missing contact': { contact: '' }, 'forged expiry': { expiresAtMs: 9999999999999 },
  'forged host source': { source: 'host' }
})) test('rejects ' + name, async () => {
  await assertFails(setDoc(doc(dbFor('customer'), 'reservations/r'), reservation(changes)));
});
test('customer cannot read someone else reservation or modify price', async () => {
  await adminDb.doc('reservations/r').set(reservation());
  await assertFails(getDoc(doc(dbFor('stranger'), 'reservations/r')));
  await assertFails(updateDoc(doc(dbFor('customer'), 'reservations/r'), { total: 1 }));
});
test('host can confirm valid request but cannot revive cancellation', async () => {
  await adminDb.doc('reservations/r').set(reservation());
  await assertSucceeds(updateDoc(doc(dbFor('host'), 'reservations/r'), { status: 'confirmada' }));
  await adminDb.doc('reservations/r').update({ status: 'cancelada' });
  await assertFails(updateDoc(doc(dbFor('host'), 'reservations/r'), { status: 'confirmada' }));
});
test('expired deadline prevents host confirmation and cannot be extended by client', async () => {
  await adminDb.doc('reservations/r').set(reservation({ expiresAtMs: 1 }));
  await assertFails(updateDoc(doc(dbFor('host'), 'reservations/r'), { status: 'confirmada' }));
  await assertFails(updateDoc(doc(dbFor('host'), 'reservations/r'), { expiresAtMs: 9999999999999 }));
});
test('noncanonical or already-owned locks cannot be written', async () => {
  await adminDb.doc('reservations/r').set(reservation());
  const db = dbFor('customer'), lock = { propertyId: 'casa', date: '2030-01-01', reservationId: 'r' };
  await assertFails(setDoc(doc(db, 'availability/wrong-id'), lock));
  await adminDb.doc('availability/casa_2030-01-01').set({ ...lock, reservationId: 'other' });
  await assertFails(setDoc(doc(db, 'availability/casa_2030-01-01'), lock));
});
test('real transaction expires once, releases own locks and preserves other locks and manual dates', async () => {
  const ref = adminDb.doc('reservations/r'); await ref.set(reservation());
  await adminDb.doc('availability/casa_2030-01-01').set({ propertyId: 'casa', date: '2030-01-01', reservationId: 'r' });
  await adminDb.doc('availability/casa_2030-01-02').set({ propertyId: 'casa', date: '2030-01-02', reservationId: 'other' });
  const snapshot = await ref.get(), now = snapshot.createTime.toMillis() + PENDING_MS;
  const results = await Promise.all([expireReservation(adminDb, ref, now), expireReservation(adminDb, ref, now)]);
  assert.equal(results.filter(value => value === 'expired').length, 1);
  assert.equal((await ref.get()).data().cancelReason, 'expired');
  assert.equal((await adminDb.doc('availability/casa_2030-01-01').get()).exists, false);
  assert.equal((await adminDb.doc('availability/casa_2030-01-02').get()).exists, true);
  assert.deepEqual((await adminDb.doc('properties/casa').get()).data().unavailable, ['2030-02-01']);
});
test('confirmed reservation survives expiration job', async () => {
  const ref = adminDb.doc('reservations/r'); await ref.set(reservation({ status: 'confirmada' }));
  const snapshot = await ref.get();
  assert.equal(await expireReservation(adminDb, ref, snapshot.createTime.toMillis() + PENDING_MS * 2), 'unchanged');
  assert.equal((await ref.get()).data().status, 'confirmada');
});

test('Mobile accepts a vehicle and a permitted purpose, rejects incompatible purpose', async () => {
  const vehicle={...listing,id:'vehicle',plan:'mobile',vehicleType:'car',rentalUse:'apps',bedrooms:0,bathrooms:0};
  await assertSucceeds(setDoc(doc(dbFor('host'),'properties/vehicle'),vehicle));
  await assertFails(setDoc(doc(dbFor('host'),'properties/bad'),{...vehicle,id:'bad',vehicleType:'boat'}));
  const data=reservation({propertyId:'vehicle',plan:'mobile',rentalUse:'apps'});
  await assertFails(setDoc(doc(dbFor('customer'),'reservations/r'),{...data,rentalUse:'season'}));
  await assertSucceeds(setDoc(doc(dbFor('customer'),'reservations/r'),data));
});
