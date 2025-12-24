/**
 * Encryption Utility
 * 
 * Provides AES-256-GCM encryption/decryption for sensitive credentials
 * like OAuth client secrets and API keys.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get the encryption key from environment variable
 * Key should be a 32-byte hex string (64 characters)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set. Generate one with: openssl rand -hex 32');
  }
  
  // If key is a hex string (64 chars = 32 bytes), convert to buffer
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  
  // If key is a passphrase, derive a key using scrypt
  const salt = Buffer.from('fincat-salt-v1'); // Fixed salt for consistent key derivation
  return scryptSync(key, salt, 32);
}

/**
 * Encrypt a string value
 * 
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (all hex encoded)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return '';
  }
  
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * 
 * @param encryptedText - Encrypted string in format: iv:authTag:ciphertext
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    return '';
  }
  
  const parts = encryptedText.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  
  const [ivHex, authTagHex, ciphertext] = parts;
  
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Check if a value appears to be encrypted
 * 
 * @param value - The value to check
 * @returns True if the value looks like it's encrypted
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  
  const [iv, authTag, ciphertext] = parts;
  
  // Check if parts are valid hex strings of expected lengths
  return (
    iv.length === IV_LENGTH * 2 &&
    authTag.length === AUTH_TAG_LENGTH * 2 &&
    ciphertext.length > 0 &&
    /^[0-9a-fA-F]+$/.test(iv) &&
    /^[0-9a-fA-F]+$/.test(authTag) &&
    /^[0-9a-fA-F]+$/.test(ciphertext)
  );
}

/**
 * Safely decrypt a value - returns empty string if decryption fails
 * 
 * @param encryptedText - Encrypted string
 * @returns Decrypted string or empty string on failure
 */
export function safeDecrypt(encryptedText: string): string {
  try {
    return decrypt(encryptedText);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}

/**
 * Mask a sensitive value for display (e.g., "abc***xyz")
 * 
 * @param value - The value to mask
 * @param showChars - Number of characters to show at start and end
 * @returns Masked string
 */
export function maskSensitiveValue(value: string, showChars: number = 4): string {
  if (!value || value.length <= showChars * 2) {
    return '••••••••';
  }
  
  const start = value.substring(0, showChars);
  const end = value.substring(value.length - showChars);
  
  return `${start}${'•'.repeat(8)}${end}`;
}

