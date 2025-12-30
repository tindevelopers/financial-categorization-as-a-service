/**
 * Encryption Utility (Admin App)
 *
 * Provides AES-256-GCM encryption/decryption for sensitive values.
 *
 * NOTE: This file intentionally mirrors the implementation in `src/lib/encryption.ts`
 * so `apps/admin` can import `@/lib/encryption` without depending on other workspaces.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. Generate one with: openssl rand -hex 32"
    );
  }

  // If key is a hex string (64 chars = 32 bytes), convert to buffer
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, "hex");
  }

  // If key is a passphrase, derive a key using scrypt
  const salt = Buffer.from("fincat-salt-v1"); // Fixed salt for consistent key derivation
  return scryptSync(key, salt, 32);
}

/**
 * Encrypt a string value
 *
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (all hex encoded)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return "";

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 *
 * @param encryptedText - Encrypted string in format: iv:authTag:ciphertext
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";

  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format");
  }

  const [ivHex, authTagHex, ciphertext] = parts;

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Safely decrypt a value - returns empty string if decryption fails
 */
export function safeDecrypt(encryptedText: string): string {
  try {
    return decrypt(encryptedText);
  } catch {
    return "";
  }
}

/**
 * Mask a sensitive value for display (e.g., "abc***xyz")
 */
export function maskSensitiveValue(value: string, showChars: number = 4): string {
  if (!value || value.length <= showChars * 2) {
    return "••••••••";
  }

  const start = value.substring(0, showChars);
  const end = value.substring(value.length - showChars);

  return `${start}${"•".repeat(8)}${end}`;
}


