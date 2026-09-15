// IndexedDB persistence layer. No external deps.
const DB_NAME = 'monstro-db';
const DB_VERSION = 1;
const STORE_STATE = 'state';
const STORE_PHOTOS = 'photos';

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
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        const store = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
        store.createIndex('day', 'day', { unique: false });
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

export async function loadState() {
  const store = await tx(STORE_STATE, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get('main');
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveState(value) {
  const store = await tx(STORE_STATE, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put({ key: 'main', value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function addPhoto(photo) {
  const store = await tx(STORE_PHOTOS, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(photo);
    req.onsuccess = () => resolve(photo.id);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllPhotos() {
  const store = await tx(STORE_PHOTOS, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePhoto(id) {
  const store = await tx(STORE_PHOTOS, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllData() {
  const stateStore = await tx(STORE_STATE, 'readwrite');
  await new Promise((resolve, reject) => {
    const req = stateStore.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  const photoStore = await tx(STORE_PHOTOS, 'readwrite');
  await new Promise((resolve, reject) => {
    const req = photoStore.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
