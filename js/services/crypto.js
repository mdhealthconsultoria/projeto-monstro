// Local password protection via PBKDF2-SHA256. This protects the account on
// THIS device only — there is no server yet, so it is not real server auth.
const ITERATIONS = 100000;

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes.buffer;
}

async function deriveHash(password, saltBuf, iterations) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bufToHex(bits);
}

export async function hashPassword(password) {
  const saltBuf = crypto.getRandomValues(new Uint8Array(16)).buffer;
  const hashHex = await deriveHash(password, saltBuf, ITERATIONS);
  return { saltHex: bufToHex(saltBuf), hashHex, iterations: ITERATIONS };
}

export async function verifyPassword(password, { saltHex, hashHex, iterations }) {
  const computed = await deriveHash(password, hexToBuf(saltHex), iterations || ITERATIONS);
  return computed === hashHex;
}
