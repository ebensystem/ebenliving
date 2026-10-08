import './core.js';
import { app } from './firebase.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, collection, doc, documentId, getDocs, query, where, writeBatch, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const auth = getAuth(app);
const db = getFirestore(app);
let user = null;
let admin = false;
let ready = false;
let loadError = null;
let loading = Promise.resolve();
let cloud = { properties: [], reservations: [], favorites: [] };
let latestState = null;
let unsubscribe = [];
const clone = value => JSON.parse(JSON.stringify(value));
const mapById = list => new Map(list.map(item => [item.id, item]));
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

async function fetchState(currentUser) {
  loadError = null;
  ready = false;
  unsubscribe.forEach(stop => stop());
  unsubscribe = [];
  user = currentUser;
  admin = false;
  if (user) {
    try {
      const token = await user.getIdTokenResult();
      admin = token.claims.admin === true || (user.email?.toLowerCase() === 'suporte@ebensystem.com.br' && user.emailVerified);
    } catch (error) {
      console.error('Could not read Firebase session claims:', error);
      window.dispatchEvent(new CustomEvent('ebenliving:firestore-error', { detail: error, resource: 'session' }));
    }
  }

  const propsSnap = await getDocs(collection(db, 'properties'));
  const properties = propsSnap.docs.map(item => ({ ...item.data(), id: item.id, bookedDates: [], bookedReservationDates: {} }));
  let reservations = [], favorites = [];
  cloud = { properties, reservations, favorites };
  latestState = { version: 1, revision: Date.now(), properties, reservations, favorites };
  if (!window.Living.validState(latestState)) throw new Error('Os dados recebidos estão incompletos.');
  watchChanges(currentUser);
  ready = true;
  window.EbenLivingSetCloudState?.(latestState);

  if (!user) return;
  const reservationQueries = admin ? [collection(db, 'reservations')] : [
    query(collection(db, 'reservations'), where('userId', '==', user.uid)),
    query(collection(db, 'reservations'), where('propertyOwnerId', '==', user.uid))
  ];
  const results = await Promise.allSettled([
    Promise.all(reservationQueries.map(item => getDocs(item))),
    getDocs(collection(db, 'users', user.uid, 'favorites'))
  ]);
  if (results[0].status === 'fulfilled') {
    reservations = [...new Map(results[0].value.flatMap(snap => snap.docs.map(item => [item.id, { ...item.data(), id: item.id }]))).values()];
    publishPart('reservations', reservations);
  } else {
    console.error('Could not load Firebase reservations:', results[0].reason);
    window.dispatchEvent(new CustomEvent('ebenliving:firestore-error', { detail: results[0].reason, resource: 'reservations' }));
  }
  if (results[1].status === 'fulfilled') {
    favorites = results[1].value.docs.map(item => item.id);
    publishPart('favorites', favorites);
  } else {
    console.error('Could not load Firebase favorites:', results[1].reason);
    window.dispatchEvent(new CustomEvent('ebenliving:firestore-error', { detail: results[1].reason, resource: 'favorites' }));
  }
}
function publishPart(key, value) {
  if (!latestState) return;
  const next = { ...latestState, [key]: value, revision: Date.now() };
  if (!window.Living.validState(next)) return;
  latestState = clone(next);
  cloud[key] = clone(value);
  window.EbenLivingSetCloudState?.(next);
}

function watchChanges(currentUser) {
  const watch = (reference, callback) => onSnapshot(reference, snapshot => callback(snapshot), error => {
    console.error('Firestore listener failed:', error);
    window.dispatchEvent(new CustomEvent('ebenliving:firestore-error', { detail: error }));
  });
  const propertiesWatch = watch(collection(db, 'properties'), snapshot => {
    const bookedByProperty = new Map(latestState.properties.map(item => [item.id, {
      bookedDates: item.bookedDates || [], bookedReservationDates: item.bookedReservationDates || {}
    }]));
    const list = snapshot.docs.map(item => ({ ...item.data(), id: item.id, ...(bookedByProperty.get(item.id) || { bookedDates: [], bookedReservationDates: {} }) }));
    publishPart('properties', list);
  });
  unsubscribe.push(propertiesWatch);
  if (currentUser) {
    if (admin) {
      unsubscribe.push(watch(collection(db, 'reservations'), snapshot => {
        publishPart('reservations', snapshot.docs.map(item => ({ ...item.data(), id: item.id })));
      }));
    } else {
      const customerRows = new Map();
      const hostRows = new Map();
      const publishReservations = () => publishPart('reservations', [...new Map([...customerRows, ...hostRows]).values()]);
      unsubscribe.push(watch(query(collection(db, 'reservations'), where('userId', '==', currentUser.uid)), snapshot => {
        customerRows.clear(); snapshot.docs.forEach(item => customerRows.set(item.id, { ...item.data(), id: item.id })); publishReservations();
      }));
      unsubscribe.push(watch(query(collection(db, 'reservations'), where('propertyOwnerId', '==', currentUser.uid)), snapshot => {
        hostRows.clear(); snapshot.docs.forEach(item => hostRows.set(item.id, { ...item.data(), id: item.id })); publishReservations();
      }));
    }
    unsubscribe.push(watch(collection(db, 'users', currentUser.uid, 'favorites'), snapshot => {
      publishPart('favorites', snapshot.docs.map(item => item.id));
    }));
  }
}

async function loadAvailability(propertyId, from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new Error('Informe um período válido.');
  const endExclusive = window.Living.addDays(to, 1);
  const snapshot = await getDocs(query(collection(db, 'availability'), where(documentId(), '>=', `${propertyId}_${from}`), where(documentId(), '<', `${propertyId}_${endExclusive}`)));
  const locks = snapshot.docs.map(item => ({ ...item.data(), id: item.id })).filter(item => item.propertyId === propertyId && item.date >= from && item.date <= to);
  const property = latestState?.properties.find(item => item.id === propertyId);
  if (property) {
    property.bookedDates = [...new Set([...(property.bookedDates || []).filter(day => day < from || day > to), ...locks.map(lock => lock.date)])].sort();
    const byReservation = { ...(property.bookedReservationDates || {}) };
    Object.keys(byReservation).forEach(id => { byReservation[id] = byReservation[id].filter(day => day < from || day > to); if (!byReservation[id].length) delete byReservation[id]; });
    locks.forEach(lock => { if (lock.reservationId) { byReservation[lock.reservationId] ||= []; byReservation[lock.reservationId].push(lock.date); } });
    property.bookedReservationDates = byReservation;
  }
  return locks;
}
async function persist(next) {
  await loading;
  if (!ready) throw new Error('O banco ainda não terminou de carregar. Recarregue e tente novamente.');
  const before = clone(cloud);
  const oldProperties = mapById(before.properties);
  const newProperties = mapById(next.properties);
  const oldReservations = mapById(before.reservations);
  const newReservations = mapById(next.reservations);
  const oldFavorites = new Set(before.favorites);
  const newFavorites = new Set(next.favorites);
  const batch = writeBatch(db);

  for (const [id, item] of newProperties) if (!same(oldProperties.get(id), item)) {
    const previous = oldProperties.get(id);
    const isOwnedListing = user && item.ownerId === user.uid && (!previous || previous.ownerId === user.uid);
    if (!admin && !isOwnedListing) throw new Error('Você só pode gerenciar acomodações da sua conta.');
    const { bookedDates, bookedReservationDates, ...storedProperty } = item;
    batch.set(doc(db, 'properties', id), storedProperty);
  }
  for (const id of oldProperties.keys()) if (!newProperties.has(id)) {
    const previous = oldProperties.get(id);
    if (!admin && previous.ownerId !== user?.uid) throw new Error('Você só pode remover acomodações da sua conta.');
    batch.delete(doc(db, 'properties', id));
  }

  for (const [id, item] of newReservations) {
    const old = oldReservations.get(id);
    if (same(old, item)) continue;
    if (!old) {
      if (!user) throw new Error('Entre na sua conta para registrar uma estadia.');
      item.userId = user.uid;
      item.propertyOwnerId = newProperties.get(item.propertyId)?.ownerId || '';if(item.source==='host'&&!(admin||item.propertyOwnerId===user.uid))throw new Error('Você só pode registrar locações dos seus imóveis.');
      batch.set(doc(db, 'reservations', id), item);
      window.Living.range(item.checkIn, item.checkOut).forEach(day => {
        batch.set(doc(db, 'availability', `${item.propertyId}_${day}`), { propertyId: item.propertyId, date: day, reservationId: id });
      });
    } else if (admin || (item.propertyOwnerId === user?.uid) || (item.userId === user?.uid && item.status === 'cancelada')) {
      const hostCreatedRental = item.source === 'host' && item.propertyOwnerId === user?.uid && old.source === 'host';
      if (!admin && item.propertyOwnerId === user?.uid && !hostCreatedRental) {
        const changed = Object.keys(item).filter(key => !same(old[key], item[key]));
        const identityApproval = old.stage === 1 && item.stage === 2 && item.status === 'confirmada' && same(old.status, item.status) && changed.every(key => ['stage', 'status', 'identityApprovedAt'].includes(key));
        const contractUpload = old.stage === 4 && item.stage === 5 && item.status === old.status && changed.every(key => ['stage', 'hostSignedDocument', 'hostSignedAt'].includes(key));
        const keysStep = old.stage === 5 && item.stage === 6 && item.status === old.status && changed.every(key => ['stage', 'keysScheduledAt'].includes(key));
        const cpfEdit = old.stage === 2 && item.stage === 2 && item.status === old.status && changed.every(key => key === 'cpf');
        if (!(identityApproval || contractUpload || keysStep || cpfEdit)) throw new Error('Esta etapa não pode ser alterada por este usuário.');
      }
      batch.set(doc(db, 'reservations', id), item);
      if (item.status === 'cancelada' && old.status !== 'cancelada') {
        window.Living.range(old.checkIn, old.checkOut).forEach(day => batch.delete(doc(db, 'availability', `${old.propertyId}_${day}`)));
      }
    } else {
      throw new Error('Você não tem permissão para alterar esta estadia.');
    }
  }
  for (const id of oldReservations.keys()) if (!newReservations.has(id)) {
    if (!admin) throw new Error('Os registros de estadia não podem ser removidos.');
    const old = oldReservations.get(id);
    window.Living.range(old.checkIn, old.checkOut).forEach(day => batch.delete(doc(db, 'availability', `${old.propertyId}_${day}`)));
    batch.delete(doc(db, 'reservations', id));
  }

  for (const id of newFavorites) if (!oldFavorites.has(id) && user) batch.set(doc(db, 'users', user.uid, 'favorites', id), { propertyId: id });
  for (const id of oldFavorites) if (!newFavorites.has(id) && user) batch.delete(doc(db, 'users', user.uid, 'favorites', id));

  if ([...oldProperties.keys(), ...newProperties.keys()].some(id => !same(oldProperties.get(id), newProperties.get(id))) ||
      [...oldReservations.keys(), ...newReservations.keys()].some(id => !same(oldReservations.get(id), newReservations.get(id))) ||
      (user && (oldFavorites.size !== newFavorites.size || [...oldFavorites].some(id => !newFavorites.has(id))))) await batch.commit();
  cloud = clone({ properties: next.properties, reservations: next.reservations, favorites: next.favorites });
  // A successful write must not become a failed reservation just because a
  // subsequent refresh lost its connection. Listeners will reconcile the data.
  // Active listeners receive reservation/lock changes; refetching here would reload every collection.
}

export async function waitReady() {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (loadError) throw new Error('Falha ao carregar dados do Firebase: ' + (loadError.code || loadError.message || 'erro desconhecido'));
    if (ready) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Não foi possível carregar seus dados. Verifique sua conexão e tente novamente.');
}

window.EbenFirestore = {
  get uid() { return user?.uid || null; },
  async getIdToken() { if (!user) throw new Error('Faça login para continuar.'); return user.getIdToken(); },
  get isAdmin() { return admin; },
  get isReady() { return ready; },
  waitReady,
  async loadAvailability(propertyId, from, to) { return loadAvailability(propertyId, from, to); },
  async loadAvailabilityRange(from, to) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new Error('Informe um período válido.');
    const snapshot = await getDocs(query(collection(db, 'availability'), where('date', '>=', from), where('date', '<=', to)));
    const grouped = new Map();
    snapshot.docs.forEach(item => { const lock = item.data(); if (!grouped.has(lock.propertyId)) grouped.set(lock.propertyId, []); grouped.get(lock.propertyId).push(lock); });
    for (const [id, locks] of grouped) {
      const property = latestState?.properties.find(item => item.id === id); if (!property) continue;
      property.bookedDates = [...new Set([...(property.bookedDates || []).filter(day => day < from || day > to), ...locks.map(lock => lock.date)])].sort();
      const byReservation = { ...(property.bookedReservationDates || {}) };
      Object.keys(byReservation).forEach(reservationId => { byReservation[reservationId] = byReservation[reservationId].filter(day => day < from || day > to); if (!byReservation[reservationId].length) delete byReservation[reservationId]; });
      locks.forEach(lock => { if (lock.reservationId) { byReservation[lock.reservationId] ||= []; byReservation[lock.reservationId].push(lock.date); } });
      property.bookedReservationDates = byReservation;
    }
    return snapshot.size;
  },
  persist
};

onAuthStateChanged(auth, currentUser => {
  ready = false;
  loading = fetchState(currentUser).catch(error => {
    loadError = error;
    console.error('Falha ao carregar o Firestore:', error);
    window.dispatchEvent(new CustomEvent('ebenliving:firestore-error', { detail: error }));
  });
});
