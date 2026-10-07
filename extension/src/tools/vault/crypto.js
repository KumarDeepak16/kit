const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64 = {
  encode(bytes) {
    const u = new Uint8Array(bytes);
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  },
  decode: (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0)),
};

// Master password -> AES-256-GCM key via PBKDF2-HMAC-SHA256. Extractable only so the
// unlocked key can be held in memory-only chrome.storage.session between popup opens.
export async function deriveKey(password, salt, iterations) {
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export const exportKey = async (key) => b64.encode(await crypto.subtle.exportKey('raw', key));
export const importKey = (raw) => crypto.subtle.importKey('raw', b64.decode(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);

export async function seal(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  return { iv: b64.encode(iv), data: b64.encode(data) };
}

// Throws (GCM auth failure) on a wrong key or tampered data.
export async function unseal(key, { iv, data }) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.decode(iv) }, key, b64.decode(data));
  return JSON.parse(dec.decode(plain));
}

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+?';

// Uniform random characters (rejection sampling avoids modulo bias).
export function randomChars(length) {
  const limit = 256 - (256 % CHARSET.length);
  let out = '';
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < limit && out.length < length) out += CHARSET[b % CHARSET.length];
    }
  }
  return out;
}

export function generatePassword(length = 20) {
  let pw;
  do pw = randomChars(length);
  while (!(/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw) && /[^a-zA-Z\d]/.test(pw)));
  return pw;
}

// Rough 0-4 score from character-pool entropy; good enough for a meter.
export function strength(pw) {
  if (!pw) return 0;
  const pool = (/[a-z]/.test(pw) && 26) + (/[A-Z]/.test(pw) && 26) + (/\d/.test(pw) && 10) + (/[^a-zA-Z\d]/.test(pw) && 33);
  const bits = Math.min(pw.length, new Set(pw).size * 2) * Math.log2(pool);
  return bits < 36 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
}
