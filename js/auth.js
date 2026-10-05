import { app } from './firebase.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, updateProfile, sendEmailVerification, sendPasswordResetEmail, signOut
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
const destinationFor = value => value && !value.startsWith('//') && /^(?:\/)?(?:reservas|admin|admin-login|checkout|imovel|login|cadastro|anuncie)?(?:\/)?(?:\?.*)?$/.test(value)
  ? (value.startsWith('/') ? value : `/${value}`) : '/reservas';
const destination = destinationFor(params.get('redirect') || form?.dataset.redirect);
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
  document.querySelectorAll('[data-login-link], .nav a[href="/login"], .nav a[href="/login/"]').forEach(link => { link.hidden = Boolean(user); });
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

let authSubmitting = false;
let registrationUser = null;
if (form) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    authSubmitting = true;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = form.dataset.authMode === 'register' ? 'Criando conta…' : 'Entrando…';
    setMessage('');
    try {
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      const registering = form.dataset.authMode === 'register';
      if (registering) {
        const user = registrationUser?.email?.toLowerCase() === email.toLowerCase() ? registrationUser : (await createUserWithEmailAndPassword(auth, email, password)).user;
        registrationUser = user;
        await updateProfile(user, { displayName: form.elements.name?.value.trim() || '' });
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
    } finally {
      authSubmitting = false;
      button.textContent = originalLabel;
    }
  });
}

let authReady = false;
let currentUser = null;
onAuthStateChanged(auth, async user => {
  currentUser = user;
  authReady = true;
  window.EbenUser = user;
  for (const id of ['guestContact', 'homeContact']) { const input = document.getElementById(id); if(input && !input.value) input.value = user?.email || ''; }

  updateNavigation(user);
  if (authSubmitting) return;
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
    const upgrade = document.querySelector('#hostUpgrade');
    if (upgrade) upgrade.hidden = false;
  } else if (form?.dataset.accountType === 'host') {
    form.hidden = false;
    const upgrade = document.querySelector('#hostUpgrade');
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
    const returnURL = new URL(location.href);
    if (event.target.id === 'homeBookingForm') {
      returnURL.searchParams.set('moveIn', document.getElementById('homeMoveIn').value);
      returnURL.searchParams.set('term', document.getElementById('homeTerm').value);
    }
    const current = returnURL.pathname.replace(/\/+$/, '').split('/').pop() + returnURL.search;
    location.assign(`/login/?redirect=${encodeURIComponent(current)}`);
  } else {
    try { sessionStorage.setItem('ebenliving:guest', currentUser.displayName || currentUser.email || ''); } catch {}
  }
}, true);

document.querySelectorAll('[data-auth-signout]').forEach(bindSignOut);

// Preserve the booking context when switching between account screens.
if (form) {
  document.querySelectorAll('a[href="/login/"], a[href="/cadastro/"]').forEach(link => {
    if (params.has('redirect')) link.href += '?redirect=' + encodeURIComponent(destination);
  });
  const password = form.elements.password;
  const reveal = document.createElement('button');
  reveal.type = 'button'; reveal.className = 'text-button password-toggle';
  reveal.textContent = 'Mostrar senha'; reveal.setAttribute('aria-pressed', 'false');
  reveal.addEventListener('click', () => {
    const visible = password.type === 'password'; password.type = visible ? 'text' : 'password';
    reveal.textContent = visible ? 'Ocultar senha' : 'Mostrar senha'; reveal.setAttribute('aria-pressed', String(visible));
  });
  password.after(reveal);
  if (form.dataset.authMode === 'login') {
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'text-button'; reset.textContent = 'Esqueci minha senha';
    reveal.after(reset);
    reset.addEventListener('click', async () => {
      const email = form.elements.email;
      if (!email.value.trim() || !email.reportValidity()) { email.focus(); setMessage('Informe seu e-mail para recuperar a senha.'); return; }
      reset.disabled = true;
      try { await sendPasswordResetEmail(auth, email.value.trim()); setMessage('Se houver uma conta para esse e-mail, você receberá as instruções de recuperação. Confira também o spam.'); }
      catch (error) { setMessage(friendlyError(error)); }
      finally { reset.disabled = false; }
    });
  }
}
