import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';

// Configuração pública do app Plataforma-EbenLiveng no projeto EbenLiving.
// A proteção dos dados depende de autenticação e regras dos serviços Firebase.
export const firebaseConfig = Object.freeze({
  apiKey: 'AIzaSyBgO-vK5TYx8qqKQT_4FXEDkLf-3dXFPTY',
  authDomain: 'ebenliving-52a3e.firebaseapp.com',
  projectId: 'ebenliving-52a3e',
  storageBucket: 'ebenliving-52a3e.firebasestorage.app',
  messagingSenderId: '498935725170',
  appId: '1:498935725170:web:a8620cee7605a933ba56eb',
  measurementId: 'G-S7VKYDK21X'
});

export const app = getApps().some(app => app.name === '[DEFAULT]')
  ? getApp()
  : initializeApp(firebaseConfig);
