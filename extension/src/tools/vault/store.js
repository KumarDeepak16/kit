import { b64, deriveKey, exportKey, importKey, seal, unseal } from './crypto.js';

// chrome.storage.local  'vault'      -> { v, kdf: { salt, iterations }, iv, data }  (ciphertext only)
// chrome.storage.session 'vault.key' -> raw AES key while unlocked (memory only, gone on browser exit)
const VAULT = 'vault';
export const SESSION_KEY = 'vault.key';
export const LOCK_ALARM = 'vault.autolock';
const AUTO_LOCK_MINUTES = 15;
const ITERATIONS = 600_000; // OWASP recommendation for PBKDF2-HMAC-SHA256

const readVault = async () => (await chrome.storage.local.get(VAULT))[VAULT];

async function sessionKey() {
  const { [SESSION_KEY]: raw } = await chrome.storage.session.get(SESSION_KEY);
  if (!raw) throw new Error('Vault is locked');
  return importKey(raw);
}

// Pushes the auto-lock deadline back; the service worker clears the key when it fires.
export const touch = () => chrome.alarms.create(LOCK_ALARM, { delayInMinutes: AUTO_LOCK_MINUTES });

async function remember(key) {
  await chrome.storage.session.set({ [SESSION_KEY]: await exportKey(key) });
  await touch();
}

export async function status() {
  if (!(await readVault())) return 'new';
  const { [SESSION_KEY]: raw } = await chrome.storage.session.get(SESSION_KEY);
  return raw ? 'unlocked' : 'locked';
}

export async function create(master) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(master, salt, ITERATIONS);
  const record = { v: 1, kdf: { salt: b64.encode(salt), iterations: ITERATIONS }, ...(await seal(key, [])) };
  await chrome.storage.local.set({ [VAULT]: record });
  await remember(key);
}

export async function unlock(master) {
  const record = await readVault();
  const key = await deriveKey(master, b64.decode(record.kdf.salt), record.kdf.iterations);
  let entries;
  try {
    entries = await unseal(key, record);
  } catch {
    throw new Error('Wrong master password');
  }
  await remember(key);
  return entries;
}

export async function entries() {
  const list = await unseal(await sessionKey(), await readVault());
  await touch();
  return list;
}

export async function save(list) {
  const key = await sessionKey();
  const record = await readVault();
  await chrome.storage.local.set({ [VAULT]: { ...record, ...(await seal(key, list)) } });
  await touch();
}

export async function lock() {
  await chrome.alarms.clear(LOCK_ALARM);
  await chrome.storage.session.remove(SESSION_KEY);
}
