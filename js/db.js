// IndexedDB persistence layer. No external deps.
// State is stored one document per user, keyed by userId (legacy single-profile
// installs used the fixed key 'main' — that record is the migration source).
const DB_NAME = 'monstro-db';
const DB_VERSION = 2;
const STORE_STATE = 'state';
const STORE_PHOTOS = 'photos';
const STORE_ACCOUNTS = 'accounts';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE, { keyPath: 'key' });
      }
      let photoStore;
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        photoStore = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
        photoStore.createIndex('day', 'day', { unique: false });
      } else {
        photoStore = req.transaction.objectStore(STORE_PHOTOS);
      }
      if (!photoStore.indexNames.contains('userId')) {
        photoStore.createIndex('userId', 'userId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) {
        const accounts = db.createObjectStore(STORE_ACCOUNTS, { keyPath: 'id' });
        accounts.createIndex('email', 'email', { unique: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode) {
  return openDB().then(db => db.transaction(store, mode).objectStore(store));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---- Per-user app state ----
export async function loadState(userId) {
  const store = await tx(STORE_STATE, 'readonly');
  const rec = await reqToPromise(store.get(userId));
  return rec ? rec.value : null;
}

export async function saveState(userId, value) {
  const store = await tx(STORE_STATE, 'readwrite');
  await reqToPromise(store.put({ key: userId, value }));
}

export async function deleteState(userId) {
  const store = await tx(STORE_STATE, 'readwrite');
  await reqToPromise(store.delete(userId));
}

// ---- Photos (scoped by userId field, filtered client-side) ----
export async function addPhoto(photo) {
  const store = await tx(STORE_PHOTOS, 'readwrite');
  await reqToPromise(store.put(photo));
  return photo.id;
}

export async function getPhotosForUser(userId) {
  const store = await tx(STORE_PHOTOS, 'readonly');
  const all = await reqToPromise(store.getAll());
  return (all || []).filter(p => p.userId === userId);
}

export async function deletePhoto(id) {
  const store = await tx(STORE_PHOTOS, 'readwrite');
  await reqToPromise(store.delete(id));
}

export async function deletePhotosForUser(userId) {
  const photos = await getPhotosForUser(userId);
  const store = await tx(STORE_PHOTOS, 'readwrite');
  await Promise.all(photos.map(p => reqToPromise(store.delete(p.id))));
}

export async function clearStateForUser(userId) {
  await deleteState(userId);
  await deletePhotosForUser(userId);
}

// ---- Accounts (local-only auth records) ----
export async function putAccount(account) {
  const store = await tx(STORE_ACCOUNTS, 'readwrite');
  await reqToPromise(store.put(account));
  return account.id;
}

export async function getAccount(id) {
  const store = await tx(STORE_ACCOUNTS, 'readonly');
  return reqToPromise(store.get(id));
}

export async function getAccountByEmail(email) {
  const store = await tx(STORE_ACCOUNTS, 'readonly');
  const idx = store.index('email');
  return reqToPromise(idx.get(email.trim().toLowerCase()));
}

export async function getAllAccounts() {
  const store = await tx(STORE_ACCOUNTS, 'readonly');
  return reqToPromise(store.getAll());
}

export async function deleteAccount(id) {
  const store = await tx(STORE_ACCOUNTS, 'readwrite');
  await reqToPromise(store.delete(id));
}
