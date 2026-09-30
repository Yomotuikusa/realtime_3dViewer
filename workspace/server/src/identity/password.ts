import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export interface ScryptParams { logN: number; r: number; p: number }
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { logN: 15, r: 8, p: 3 };

const SALT_BYTES = 16;
const KEY_BYTES = 64;

function maxMemory(params: ScryptParams): number {
  return 256 * 2 ** params.logN * params.r;
}

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_BYTES, {
      N: 2 ** params.logN,
      r: params.r,
      p: params.p,
      maxmem: maxMemory(params),
    }, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string, params = DEFAULT_SCRYPT_PARAMS): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(password, salt, params);
  return ["scrypt", params.logN, params.r, params.p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

function parseStored(stored: string): { params: ScryptParams; salt: Buffer; hash: Buffer } | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const numbers = parts.slice(1, 4).map((part) => {
    if (!/^\d+$/.test(part)) return null;
    const value = Number(part);
    return Number.isSafeInteger(value) ? value : null;
  });
  if (numbers.some((value) => value === null)) return null;
  const [logN, r, p] = numbers as [number, number, number];
  if (logN < 10 || logN > 20 || r < 1 || p < 1) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(parts[4]!) || !/^[A-Za-z0-9_-]+$/.test(parts[5]!)) return null;
  try {
    const salt = Buffer.from(parts[4]!, "base64url");
    const hash = Buffer.from(parts[5]!, "base64url");
    if (
      salt.length !== SALT_BYTES ||
      hash.length !== KEY_BYTES ||
      salt.toString("base64url") !== parts[4] ||
      hash.toString("base64url") !== parts[5]
    ) return null;
    return { params: { logN, r, p }, salt, hash };
  } catch {
    return null;
  }
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStored(stored);
  if (!parsed) return false;
  try {
    const actual = await derive(password, parsed.salt, parsed.params);
    return actual.length === parsed.hash.length && timingSafeEqual(actual, parsed.hash);
  } catch {
    return false;
  }
}
