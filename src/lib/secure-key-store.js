const DB_NAME = "serenity-secure-settings";
const STORE_NAME = "secrets";
const KEY_ID = "device-encryption-key";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
  });
}

async function databaseOperation(mode, callback) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = callback(store);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } finally {
    database.close();
  }
}

async function encryptionKey() {
  let key = await databaseOperation("readonly", (store) => store.get(KEY_ID));
  if (!key) {
    key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await databaseOperation("readwrite", (store) => store.put(key, KEY_ID));
  }
  return key;
}

export async function saveProviderKey(provider, apiKey) {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(apiKey);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  await databaseOperation("readwrite", (store) => store.put({ iv, cipher }, `provider:${provider}`));
}

export async function loadProviderKey(provider) {
  const stored = await databaseOperation("readonly", (store) => store.get(`provider:${provider}`));
  if (!stored) return "";
  try {
    const key = await encryptionKey();
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: stored.iv }, key, stored.cipher);
    return new TextDecoder().decode(plain);
  } catch {
    await deleteProviderKey(provider);
    return "";
  }
}

export async function deleteProviderKey(provider) {
  await databaseOperation("readwrite", (store) => store.delete(`provider:${provider}`));
}
