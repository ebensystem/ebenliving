import { app } from './firebase.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, updateProfile, sendEmailVerification, signOut
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const auth = getAuth(app);
const db = getFirestore(app);
const ADMIN_EMAIL = 'suporte@ebensystem.com.br';
const params = new URLSearchParams(location.search);
const form = document.querySelector('#authForm');
const message = document.querySelector('#authMessage');
const destinationFor = value => value && /^(?:\/)?(?:reservas|admin|admin-login|checkout|imovel|login|cadastro|anuncie)(?:\/)?(?:\?.*)?$/.test(value)
  ? (value.startsWith('/') ? value : `/${value}`) : '/reservas';
const destination = destinationFor(form?.dataset.redirect || params.get('redirect'));
const friendlyError = error => ({
  'auth/email-already-in-use': 'Este e-mail já possui uma conta. Entre com sua senha.',
  'auth/invalid-email': 'Informe um e-mail válido.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/weak-password': 'Escolha uma senha com pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  'auth/network-request-failed': 'Não foi possível conectar. Verifique sua internet e tente novamente.'
}[error.code] || 'Não foi possível concluir. Confira os dados e tente novamente.');

function setMessage(text) {
  if (!message) return;
  message.textContent = text;
  message.hidden = !text;
}

function bindSignOut(button) {
  button.addEventListener('click', async () => {
    await signOut(auth);
    location.assign('/');
  });
}

function updateNavigation(user) {
  const nav = document.querySelector('.nav');
  const target = nav || document.querySelector('.header-inner');
  if (!target) return;
  const loginLink = nav?.querySelector('a[href="/login"]');
  if (loginLink) loginLink.hidden = Boolean(user);
  let signOutButton = target.querySelector('[data-auth-signout]');
  if (!signOutButton && user) {
    signOutButton = document.createElement('button');
    signOutButton.type = 'button';
    signOutButton.className = 'btn btn-outline';
    signOutButton.dataset.authSignout = '';
    signOutButton.textContent = 'Sair';
    target.append(signOutButton);
    bindSignOut(signOutButton);
  }
  if (signOutButton) signOutButton.hidden = !user;
}

if (form) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    setMessage('');
    try {
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      const registering = form.dataset.authMode === 'register';
      if (registering) {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: form.elements.name?.value.trim() || '' });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      if (email.toLowerCase() === ADMIN_EMAIL && !auth.currentUser.emailVerified) {
        await sendEmailVerification(auth.currentUser);
        await signOut(auth);
        setMessage('Enviamos um link de verificação para suporte@ebensystem.com.br. Confirme o e-mail e entre novamente para acessar a administração.');
        button.disabled = false;
        return;
      }

      const profile = {
        displayName: auth.currentUser.displayName || form.elements.name?.value.trim() || '',
        email: auth.currentUser.email || email,
        updatedAt: serverTimestamp(),
        ...(registering ? {
          accountType: form.dataset.accountType || 'customer',
          createdAt: serverTimestamp()
        } : {})
      };
      await setDoc(doc(db, 'users', auth.currentUser.uid), profile, { merge: true });
      try { sessionStorage.setItem('ebenliving:guest', auth.currentUser.displayName || auth.currentUser.email || ''); } catch {}
      location.replace(destination);
    } catch (error) {
      setMessage(friendlyError(error));
      button.disabled = false;
    }
  });
}

let authReady = false;
let currentUser = null;
onAuthStateChanged(auth, async user => {
  currentUser = user;
  authReady = true;
  updateNavigation(user);
  let profile = {};
  if (user) {
    try { profile = (await getDoc(doc(db, 'users', user.uid))).data() || {}; } catch {}
  }
  const token = user ? await user.getIdTokenResult() : null;
  const isAdmin = Boolean(user && (
    token.claims.admin === true ||
    (user.email?.toLowerCase() === ADMIN_EMAIL && user.emailVerified)
  ));
  const isHost = profile.accountType === 'host';

  if (form?.dataset.accountType === 'host' && user) {
    if (isAdmin || isHost) {
      location.replace('/admin/');
      return;
    }
    form.hidden = true;
    const upgrade = document.querySelector('[data-host-upgrade]');
    if (upgrade) upgrade.hidden = false;
  } else if (form?.dataset.accountType === 'host') {
    form.hidden = false;
    const upgrade = document.querySelector('[data-host-upgrade]');
    if (upgrade) upgrade.hidden = true;
  }

  const adminPage = document.querySelector('#adminProtected');
  if (adminPage) {
    if (!user) {
      location.replace(`/admin-login/?redirect=${encodeURIComponent('admin')}`);
      return;
    }
    if (isAdmin || isHost) {
      try {
        await window.EbenFirestore.waitReady();
        adminPage.hidden = false;
        document.querySelector('#adminAccessMessage').hidden = true;
      } catch (error) {
        const gate = document.querySelector('#adminAccessMessage');
        gate.textContent = error.message;
        gate.hidden = false;
      }
    } else {
      const gate = document.querySelector('#adminAccessMessage');
      gate.innerHTML = 'Para anunciar uma acomodação, ative seu espaço de anunciante. <a class="btn btn-primary mt" href="/anuncie/">Anuncie seu imóvel</a>';
      gate.hidden = false;
    }
  }

  const reservationsPage = document.querySelector('#myReservations');
  if (reservationsPage) {
    if (!user) {
      location.replace(`/login/?redirect=${encodeURIComponent('reservas')}`);
      return;
    }
    try {
      await window.EbenFirestore.waitReady();
      document.querySelector('#reservationsProtected').hidden = false;
      document.querySelector('#reservationsAccessMessage').hidden = true;
    } catch (error) {
      document.querySelector('#reservationsAccessMessage').textContent = error.message;
    }
  }

  if (user && location.pathname.replace(/\/+$/, '').endsWith('/admin-login') && message) {
    if (isAdmin || isHost) location.replace('/admin/');
    else {
      message.textContent = 'Esta conta é de cliente. Para anunciar, crie ou ative seu espaço de anunciante.';
      message.hidden = false;
    }
  }
});

document.querySelectorAll('[data-host-upgrade]').forEach(button => button.addEventListener('click', async () => {
  if (!currentUser) return;
  button.disabled = true;
  try {
    await setDoc(doc(db, 'users', currentUser.uid), {
      displayName: currentUser.displayName || '',
      email: currentUser.email || '',
      accountType: 'host',
      updatedAt: serverTimestamp()
    }, { merge: true });
    location.assign('/admin/');
  } catch (error) {
    setMessage(friendlyError(error));
    button.disabled = false;
  }
}));

document.addEventListener('submit', event => {
  if (!event.target.matches('#checkoutForm, #homeBookingForm')) return;
  if (!authReady || !currentUser) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const current = location.pathname.replace(/\/+$/, '').split('/').pop() + location.search;
    location.assign(`/login/?redirect=${encodeURIComponent(current)}`);
  } else {
    try { sessionStorage.setItem('ebenliving:guest', currentUser.displayName || currentUser.email || ''); } catch {}
  }
}, true);

document.querySelectorAll('[data-auth-signout]').forEach(bindSignOut);
