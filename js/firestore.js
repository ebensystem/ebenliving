import { app } from './firebase.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, query, where, writeBatch, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const auth = getAuth(app);
const db = getFirestore(app);
let user = null;
let admin = false;
let ready = false;
let loading = Promise.resolve();
let legacyProperties = [];
let cloud = { properties: [], reservations: [], favorites: [] };
let latestState = null;
let unsubscribe = [];
try {
  const legacy = JSON.parse(localStorage.getItem('ebenliving:v1') || 'null');
  if (legacy && window.Living.validState(legacy)) legacyProperties = legacy.properties;
} catch {}
const clone = value => JSON.parse(JSON.stringify(value));
const mapById = list => new Map(list.map(item => [item.id, item]));
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

async function fetchState(currentUser) {
  unsubscribe.forEach(stop => stop());
  unsubscribe = [];
  user = currentUser;
  admin = false;
  if (user) {
    const token = await user.getIdTokenResult();
    admin = token.claims.admin === true || (user.email?.toLowerCase() === 'suporte@ebensystem.com.br' && user.emailVerified);
  }

  const [propsSnap, locksSnap] = await Promise.all([
    getDocs(collection(db, 'properties')), getDocs(collection(db, 'availability'))
  ]);
  let properties = propsSnap.docs.map(item => ({ ...item.data(), id: item.id }));
  const booked = new Map();
  locksSnap.docs.forEach(item => {
    const lock = item.data();
    if (!booked.has(lock.propertyId)) booked.set(lock.propertyId, { dates: [], byReservation: {} });
    const propertyLocks = booked.get(lock.propertyId);
    propertyLocks.dates.push(lock.date);
    if (lock.reservationId) {
      propertyLocks.byReservation[lock.reservationId] ||= [];
      propertyLocks.byReservation[lock.reservationId].push(lock.date);
    }
  });
  properties = properties.map(item => {
    const locks = booked.get(item.id) || { dates: [], byReservation: {} };
    return { ...item, bookedDates: locks.dates, bookedReservationDates: locks.byReservation };
  });

  // Migra apenas anúncios já existentes neste navegador, uma vez, e somente
  // quando o banco está vazio e a conta já foi autorizada como administradora.
  if (properties.length === 0 && admin) {
    let seed = legacyProperties.length ? legacyProperties : (window.EbenDefaultProperties || []);
    try {
      const local = JSON.parse(localStorage.getItem('ebenliving:v1') || 'null');
      if (local && window.Living.validState(local) && local.properties.length) seed = local.properties;
    } catch {}
    seed = seed.map(item => ({ ...item, active: item.active !== false, cleaningFee: Number(item.cleaningFee || 0) }));
    const batch = writeBatch(db);
    seed.forEach(item => batch.set(doc(db, 'properties', item.id), item));
    if (seed.length) await batch.commit();
    properties = seed;
  }

  let reservations = [];
  let favorites = [];
  if (user) {
    const reservationQueries = admin ? [collection(db, 'reservations')] : [
      query(collection(db, 'reservations'), where('userId', '==', user.uid)),
      query(collection(db, 'reservations'), where('propertyOwnerId', '==', user.uid))
    ];
    const [reservationSnaps, favoriteSnap] = await Promise.all([
      Promise.all(reservationQueries.map(item => getDocs(item))), getDocs(collection(db, 'users', user.uid, 'favorites'))
    ]);
    reservations = [...new Map(reservationSnaps.flatMap(snap => snap.docs.map(item => [item.id, { ...item.data(), id: item.id }]))).values()];
    favorites = favoriteSnap.docs.map(item => item.id);
  }

  cloud = { properties, reservations, favorites };
  ready = true;
  const next = { version: 1, revision: Date.now(), properties, reservations, favorites };
  if (window.Living.validState(next)) {
    latestState = clone(next);
    window.EbenLivingSetCloudState?.(next);
    watchChanges(currentUser);
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
  const propertiesWatch = onSnapshot(collection(db, 'properties'), snapshot => {
    const bookedByProperty = new Map(latestState.properties.map(item => [item.id, {
      bookedDates: item.bookedDates || [], bookedReservationDates: item.bookedReservationDates || {}
    }]));
    const list = snapshot.docs.map(item => ({ ...item.data(), id: item.id, ...(bookedByProperty.get(item.id) || { bookedDates: [], bookedReservationDates: {} }) }));
    publishPart('properties', list);
  });
  const availabilityWatch = onSnapshot(collection(db, 'availability'), snapshot => {
    const grouped = new Map();
    snapshot.docs.forEach(item => {
      const lock = item.data();
      if (!grouped.has(lock.propertyId)) grouped.set(lock.propertyId, { dates: [], byReservation: {} });
      const propertyLocks = grouped.get(lock.propertyId);
      propertyLocks.dates.push(lock.date);
      if (lock.reservationId) {
        propertyLocks.byReservation[lock.reservationId] ||= [];
        propertyLocks.byReservation[lock.reservationId].push(lock.date);
      }
    });
    publishPart('properties', latestState.properties.map(item => {
      const locks = grouped.get(item.id) || { dates: [], byReservation: {} };
      return { ...item, bookedDates: locks.dates, bookedReservationDates: locks.byReservation };
    }));
  });
  unsubscribe.push(propertiesWatch, availabilityWatch);
  if (currentUser) {
    if (admin) {
      unsubscribe.push(onSnapshot(collection(db, 'reservations'), snapshot => {
        publishPart('reservations', snapshot.docs.map(item => ({ ...item.data(), id: item.id })));
      }));
    } else {
      const customerRows = new Map();
      const hostRows = new Map();
      const publishReservations = () => publishPart('reservations', [...new Map([...customerRows, ...hostRows]).values()]);
      unsubscribe.push(onSnapshot(query(collection(db, 'reservations'), where('userId', '==', currentUser.uid)), snapshot => {
        customerRows.clear(); snapshot.docs.forEach(item => customerRows.set(item.id, { ...item.data(), id: item.id })); publishReservations();
      }));
      unsubscribe.push(onSnapshot(query(collection(db, 'reservations'), where('propertyOwnerId', '==', currentUser.uid)), snapshot => {
        hostRows.clear(); snapshot.docs.forEach(item => hostRows.set(item.id, { ...item.data(), id: item.id })); publishReservations();
      }));
    }
    unsubscribe.push(onSnapshot(collection(db, 'users', currentUser.uid, 'favorites'), snapshot => {
      publishPart('favorites', snapshot.docs.map(item => item.id));
    }));
  }
}

async function persist(next) {
  await loading;
  if (!ready) throw new Error('O banco ainda não terminou de carregar. Recarregue e tente novamente.');
  const before = cloud;
  const oldProperties = mapById(before.properties);
  const newProperties = mapById(next.properties);
  const oldReservations = mapById(before.reservations);
  const newReservations = mapById(next.reservations);
  const oldFavorites = new Set(before.favorites);
  const newFavorites = new Set(next.favorites);
  const batch = writeBatch(db);
  let availabilityChanged = false;

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
      item.propertyOwnerId = newProperties.get(item.propertyId)?.ownerId || '';
      batch.set(doc(db, 'reservations', id), item);
      window.Living.range(item.checkIn, item.checkOut).forEach(day => {
        batch.set(doc(db, 'availability', `${item.propertyId}_${day}`), { propertyId: item.propertyId, date: day, reservationId: id });
      });
      availabilityChanged = true;
    } else if (admin || (item.propertyOwnerId === user?.uid && ['confirmada', 'cancelada'].includes(item.status)) || (item.userId === user?.uid && item.status === 'cancelada')) {
      batch.set(doc(db, 'reservations', id), item);
      if (item.status === 'cancelada' && old.status !== 'cancelada') {
        window.Living.range(old.checkIn, old.checkOut).forEach(day => batch.delete(doc(db, 'availability', `${old.propertyId}_${day}`)));
        availabilityChanged = true;
      }
    } else {
      throw new Error('Você não tem permissão para alterar esta estadia.');
    }
  }
  for (const id of oldReservations.keys()) if (!newReservations.has(id)) {
    if (!admin) throw new Error('Os registros de estadia não podem ser removidos.');
    const old = oldReservations.get(id);
    window.Living.range(old.checkIn, old.checkOut).forEach(day => batch.delete(doc(db, 'availability', `${old.propertyId}_${day}`)));
    availabilityChanged = true;
    batch.delete(doc(db, 'reservations', id));
  }

  for (const id of newFavorites) if (!oldFavorites.has(id) && user) batch.set(doc(db, 'users', user.uid, 'favorites', id), { propertyId: id });
  for (const id of oldFavorites) if (!newFavorites.has(id) && user) batch.delete(doc(db, 'users', user.uid, 'favorites', id));

  if ([...oldProperties.keys(), ...newProperties.keys()].some(id => !same(oldProperties.get(id), newProperties.get(id))) ||
      [...oldReservations.keys(), ...newReservations.keys()].some(id => !same(oldReservations.get(id), newReservations.get(id))) ||
      (user && (oldFavorites.size !== newFavorites.size || [...oldFavorites].some(id => !newFavorites.has(id))))) await batch.commit();
  cloud = clone({ properties: next.properties, reservations: next.reservations, favorites: next.favorites });
  if (availabilityChanged) await fetchState(user);
}

window.EbenFirestore = {
  get uid() { return user?.uid || null; },
  get isAdmin() { return admin; },
  get isReady() { return ready; },
  async waitReady() {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (ready) return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('O Firestore não respondeu. Confira se o banco foi criado e se as regras foram publicadas.');
  },
  persist
};

onAuthStateChanged(auth, currentUser => {
  ready = false;
  loading = fetchState(currentUser).catch(error => {
    console.error('Falha ao carregar o Firestore:', error);
    window.dispatchEvent(new CustomEvent('ebenliving:firestore-error', { detail: error }));
  });
});
