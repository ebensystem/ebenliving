import { app } from './firebase.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const auth = getAuth(app);
const db = getFirestore(app);
const ADMIN_EMAIL = 'suporte@ebensystem.com.br';
const params = new URLSearchParams(location.search);
const safeDestination = value => value && /^(?:\/)?(?:reservas|admin|admin-login|checkout|imovel|login|cadastro)(?:\?.*)?$/.test(value) ? (value.startsWith('/') ? value : `/${value}`) : '/reservas';
const destination = safeDestination(params.get('redirect'));
const form = document.querySelector('#authForm');
const message = document.querySelector('#authMessage');
const friendlyError = error => ({
  'auth/email-already-in-use': 'Este e-mail já possui uma conta. Entre com sua senha.',
  'auth/invalid-email': 'Informe um e-mail válido.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/weak-password': 'Escolha uma senha com pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  'auth/network-request-failed': 'Não foi possível conectar. Verifique sua internet e tente novamente.'
}[error.code] || 'Não foi possível concluir. Confira os dados e tente novamente.');

if (form) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    message.hidden = true;
    try {
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      if (form.dataset.authMode === 'register') {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: form.elements.name.value.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      if (email.toLowerCase() === ADMIN_EMAIL && !auth.currentUser.emailVerified) {
        await sendEmailVerification(auth.currentUser);
        await signOut(auth);
        message.textContent = 'Enviamos um link de verificação para suporte@ebensystem.com.br. Confirme o e-mail e depois entre novamente para liberar o painel.';
        message.hidden = false;
        button.disabled = false;
        return;
      }
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), {
          displayName: auth.currentUser.displayName || form.elements.name?.value.trim() || '',
          email: auth.currentUser.email || email,
          updatedAt: serverTimestamp(),
          ...(form.dataset.authMode === 'register' ? { createdAt: serverTimestamp() } : {})
        }, { merge: true });
      } catch (profileError) {
        console.warn('Perfil Firestore não gravado (o banco pode ainda não estar criado):', profileError);
      }
      try { sessionStorage.setItem('ebenliving:guest', auth.currentUser?.displayName || auth.currentUser?.email || ''); } catch {}
      location.replace(destination);
    } catch (error) {
      message.textContent = friendlyError(error);
      message.hidden = false;
      button.disabled = false;
    }
  });
}

let authReady = false;
let currentUser = null;
onAuthStateChanged(auth, user => {
  currentUser = user;
  authReady = true;
  if (document.querySelector('#adminProtected')) {
    if (!user) {
      location.replace(`/admin-login/?redirect=${encodeURIComponent('admin')}`);
      return;
    }
    user.getIdTokenResult().then(token => {
      if (token.claims.admin === true || (user.email?.toLowerCase() === ADMIN_EMAIL && user.emailVerified)) {
        window.EbenFirestore.waitReady().then(() => {
          document.querySelector('#adminProtected').hidden = false;
          document.querySelector('#adminAccessMessage').hidden = true;
        }).catch(error => {
          document.querySelector('#adminAccessMessage').textContent = error.message;
          document.querySelector('#adminAccessMessage').hidden = false;
        });
      } else {
        const gate = document.querySelector('#adminAccessMessage');
        gate.textContent = `A conta ${user.email || ''} não tem permissão de administrador. Saia e entre com a conta autorizada.`;
        const switchAccount = document.createElement('button');
        switchAccount.className = 'btn btn-outline mt';
        switchAccount.type = 'button';
        switchAccount.textContent = 'Sair e trocar de conta';
        switchAccount.addEventListener('click', async () => { await signOut(auth); location.assign('/admin-login/'); });
        gate.append(' ', switchAccount);
        gate.hidden = false;
      }
    }).catch(() => {
      document.querySelector('#adminAccessMessage').textContent = 'Não foi possível verificar a permissão desta conta. Entre novamente.';
      document.querySelector('#adminAccessMessage').hidden = false;
    });
  }
  if (document.querySelector('#myReservations')) {
    if (!user) {
      location.replace(`/login?redirect=${encodeURIComponent('reservas')}`);
      return;
    }
    window.EbenFirestore.waitReady().then(() => {
      document.querySelector('#reservationsProtected').hidden = false;
      document.querySelector('#reservationsAccessMessage').hidden = true;
    }).catch(error => {
      document.querySelector('#reservationsAccessMessage').textContent = error.message;
    });
  }
  if (user && location.pathname.replace(/\/+$/, '').endsWith('/admin-login')) {
    user.getIdTokenResult().then(token => {
      if (token.claims.admin === true || (user.email?.toLowerCase() === ADMIN_EMAIL && user.emailVerified)) location.replace('/admin');
      else if (message) {
        message.textContent = 'Esta conta ainda não tem permissão administrativa. Peça ao responsável pelo projeto para autorizá-la.';
        message.hidden = false;
      }
    });
  }
});

// O fluxo local do checkout também exige sessão Firebase antes de salvar a solicitação.
document.addEventListener('submit', event => {
  if (!event.target.matches('#checkoutForm')) return;
  if (!authReady || !currentUser) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const current = location.pathname.split('/').pop() + location.search;
    location.assign(`/login?redirect=${encodeURIComponent(current)}`);
  } else {
    try { sessionStorage.setItem('ebenliving:guest', currentUser.displayName || currentUser.email || ''); } catch {}
  }
}, true);

document.querySelectorAll('[data-auth-signout]').forEach(button => button.addEventListener('click', async () => {
  await signOut(auth);
  location.assign('/');
}));
