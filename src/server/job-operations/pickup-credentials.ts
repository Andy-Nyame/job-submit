import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 24;
const CREDENTIAL_VERSION = 1;

function secretKey() {
  const secret = process.env.PICKUP_CREDENTIAL_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Pickup credential encryption is not configured.");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function normalizePickupCode(value: string) {
  return value.normalize("NFKC").toUpperCase().replace(/[\s-]/gu, "");
}

export function isPickupCodeShape(value: string) {
  const normalized = normalizePickupCode(value);
  return (
    normalized.length === CODE_LENGTH &&
    Array.from(normalized).every((character) => CODE_ALPHABET.includes(character))
  );
}

export function generatePickupCode() {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes, (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join("");
}

export function displayPickupCode(value: string) {
  return normalizePickupCode(value).match(/.{1,4}/gu)?.join("-") ?? value;
}

export function hashPickupCode(value: string) {
  return createHash("sha256").update(normalizePickupCode(value), "utf8").digest("hex");
}

export function encryptPickupCode(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(normalizePickupCode(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [CREDENTIAL_VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptPickupCode(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (version !== String(CREDENTIAL_VERSION) || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Unsupported pickup credential.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    secretKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
