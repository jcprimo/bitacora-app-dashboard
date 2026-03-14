// ─── server/middleware/encrypt.js — AES-256-GCM Helpers ──────────
// Encrypts/decrypts API tokens at rest in SQLite.
// Requires ENCRYPTION_KEY env var (32-byte hex string = 64 hex chars).

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string.
 * @returns {{ encrypted: string, iv: string, tag: string }} hex-encoded values
 */
export function encrypt(plaintext) {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return {
    encrypted,
    iv: iv.toString("hex"),
    tag,
  };
}

/**
 * Decrypt an encrypted string.
 * @param {{ encrypted: string, iv: string, tag: string }} data hex-encoded values
 * @returns {string} plaintext
 */
export function decrypt({ encrypted, iv, tag }) {
  const key = getKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));

  let plaintext = decipher.update(encrypted, "hex", "utf8");
  plaintext += decipher.final("utf8");

  return plaintext;
}
