import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export function normalizeLogin(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function validatePassword(value: string) {
  if (value.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres.");
  if (value.length > 128) throw new Error("A senha é muito longa.");
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    throw new Error("A senha deve ter pelo menos uma letra e um número.");
  }
}

export async function hashPassword(password: string) {
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const [algorithm, salt, expected] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && timingSafeEqual(expectedBuffer, actual);
}
