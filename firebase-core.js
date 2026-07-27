import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const config = window.KSR_FIREBASE_CONFIG;
const required = ['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId'];
const missing = required.filter(key => !String(config?.[key] || '').trim());
if (missing.length) {
  throw new Error(`Firebase configuration incomplete: ${missing.join(', ')}`);
}
if (!/^[a-z0-9-]+$/i.test(config.projectId)) {
  throw new Error('Firebase projectId format is invalid.');
}

export const app = getApps().length ? getApp() : initializeApp(config);
export const db = getFirestore(app);
export { serverTimestamp };
