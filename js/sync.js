/*
  sync.js
  -------
  Encrypted sync between your devices, with no server-side login screen.

  How it works:
  - You pick a passphrase once per device. It never leaves this device.
  - Everything (all your accounts/transactions/etc.) is encrypted with a key
    derived from that passphrase using the browser's built-in Web Crypto API
    (AES-GCM), before it's uploaded anywhere.
  - The passphrase also derives the "address" (syncId) where the encrypted
    blob is stored in the cloud database, so there's no separate account
    system to build — two devices with the same passphrase find the same
    encrypted blob.
  - The cloud (Firebase Firestore) only ever sees ciphertext. It cannot read
    your data, and neither can anyone without the passphrase.
  - This is a whole-database snapshot sync (not per-record), using "newest
    wins": whichever device synced most recently overwrites the other. Fine
    for one person using one device at a time, which is how this app is used.

  This is loaded as an ES module (type="module" in index.html) so it can use
  modern `import` statements straight from Google's CDN — no npm/build step,
  consistent with the rest of this no-build-tools project.
*/

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDvSEtxIKW1RSpgJf_G_7DkIxk7tkusCCw',
  authDomain: 'budgeter-sync.firebaseapp.com',
  projectId: 'budgeter-sync',
  storageBucket: 'budgeter-sync.firebasestorage.app',
  messagingSenderId: '496761338182',
  appId: '1:496761338182:web:339e540aadfb95558ccd47'
};

const firebaseApp = initializeApp(firebaseConfig);
const cloudDb = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// Resolves once we're signed in anonymously (needed by the Firestore rules
// to block unauthenticated scripts; it does not identify you personally).
const authReady = new Promise((resolve, reject) => {
  onAuthStateChanged(auth, (user) => { if (user) resolve(user); });
  signInAnonymously(auth).catch(reject);
});

const PBKDF2_ITERATIONS = 250000;

function bufToBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
function base64ToBuf(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Derives two independent-looking values from the same passphrase: an
// encryption key, and a "syncId" used as the document address in the cloud.
// Using different salts for each keeps one from being reverse-derivable
// from the other.
async function deriveSyncMaterial(passphrase) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits', 'deriveKey']);

  const encKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('budgeter-enc-v1'), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const idBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode('budgeter-syncid-v1'), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    256
  );
  const syncId = Array.from(new Uint8Array(idBits)).map((b) => b.toString(16).padStart(2, '0')).join('');

  return { encKey, syncId };
}

async function encryptJSON(encKey, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encKey, data);
  return { iv: bufToBase64(iv), ciphertext: bufToBase64(new Uint8Array(cipherBuf)) };
}

async function decryptJSON(encKey, { iv, ciphertext }) {
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBuf(iv) },
    encKey,
    base64ToBuf(ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(plainBuf));
}

async function pushToCloud(encKey, syncId, data) {
  await authReady;
  const payload = await encryptJSON(encKey, data);
  const updatedAt = Date.now();
  await setDoc(doc(cloudDb, 'syncData', syncId), { ...payload, updatedAt });
  return updatedAt;
}

async function pullFromCloud(encKey, syncId) {
  await authReady;
  const snap = await getDoc(doc(cloudDb, 'syncData', syncId));
  if (!snap.exists()) return null;
  const raw = snap.data();
  const data = await decryptJSON(encKey, raw);
  return { data, updatedAt: raw.updatedAt };
}

const STORAGE_PASSPHRASE = 'budgeter_sync_passphrase';
const STORAGE_LAST_SYNCED = 'budgeter_sync_last_synced';

// First time sync is set up on a device: if the cloud already has data under
// this passphrase (set up from another device), pull it down. Otherwise,
// this device's local data becomes the initial snapshot.
window.setupSync = async function setupSync(passphrase) {
  const { encKey, syncId } = await deriveSyncMaterial(passphrase);
  const remote = await pullFromCloud(encKey, syncId);

  if (remote) {
    await importAllData(remote.data);
    localStorage.setItem(STORAGE_LAST_SYNCED, String(remote.updatedAt));
    localStorage.setItem(STORAGE_PASSPHRASE, passphrase);
    return 'pulled';
  }

  const local = await exportAllData();
  const updatedAt = await pushToCloud(encKey, syncId, local);
  localStorage.setItem(STORAGE_LAST_SYNCED, String(updatedAt));
  localStorage.setItem(STORAGE_PASSPHRASE, passphrase);
  return 'pushed';
};

// Manual "Sync now": pulls if the cloud has something newer than our last
// sync, otherwise pushes our local data up.
window.syncNow = async function syncNow() {
  const passphrase = localStorage.getItem(STORAGE_PASSPHRASE);
  if (!passphrase) throw new Error('Sync is not set up on this device yet.');

  const { encKey, syncId } = await deriveSyncMaterial(passphrase);
  const lastSynced = Number(localStorage.getItem(STORAGE_LAST_SYNCED) || 0);
  const remote = await pullFromCloud(encKey, syncId);

  if (remote && remote.updatedAt > lastSynced) {
    await importAllData(remote.data);
    localStorage.setItem(STORAGE_LAST_SYNCED, String(remote.updatedAt));
    return 'pulled';
  }

  const local = await exportAllData();
  const updatedAt = await pushToCloud(encKey, syncId, local);
  localStorage.setItem(STORAGE_LAST_SYNCED, String(updatedAt));
  return 'pushed';
};

window.forgetSyncOnThisDevice = function forgetSyncOnThisDevice() {
  localStorage.removeItem(STORAGE_PASSPHRASE);
  localStorage.removeItem(STORAGE_LAST_SYNCED);
};
