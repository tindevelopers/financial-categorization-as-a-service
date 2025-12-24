#!/usr/bin/env tsx
/**
 * Test Encryption Key
 * 
 * Verifies that the ENCRYPTION_KEY environment variable works correctly
 * for encrypting and decrypting secrets.
 */

import { encrypt, decrypt, isEncrypted } from '../apps/portal/lib/encryption';

const testSecret = 'GOCSPX-test_secret_for_verification_12345';

console.log('🔐 Testing Encryption Key\n');
console.log('='.repeat(60));

// Check if ENCRYPTION_KEY is set
const encryptionKey = process.env.ENCRYPTION_KEY;
if (!encryptionKey) {
  console.error('❌ ERROR: ENCRYPTION_KEY environment variable is not set');
  console.error('\nTo set it:');
  console.error('  export ENCRYPTION_KEY=$(openssl rand -hex 32)');
  console.error('  # Or add to .env.local file');
  process.exit(1);
}

console.log('✅ ENCRYPTION_KEY is set');
console.log(`   Key length: ${encryptionKey.length} characters`);
console.log(`   Key format: ${/^[0-9a-fA-F]{64}$/.test(encryptionKey) ? 'Valid hex (64 chars)' : 'Invalid format'}`);

if (encryptionKey.length !== 64) {
  console.warn('⚠️  WARNING: Key should be 64 hex characters (32 bytes)');
}

console.log('\n' + '='.repeat(60));
console.log('Testing Encryption/Decryption\n');

try {
  // Test encryption
  console.log('1. Encrypting test secret...');
  const encrypted = encrypt(testSecret);
  console.log(`   ✅ Encryption successful`);
  console.log(`   Encrypted length: ${encrypted.length} characters`);
  console.log(`   Format: ${encrypted.split(':').length === 3 ? 'Valid (iv:authTag:ciphertext)' : 'Invalid'}`);
  
  // Verify it looks encrypted
  if (!isEncrypted(encrypted)) {
    console.error('   ❌ ERROR: Encrypted value does not match expected format');
    process.exit(1);
  }
  console.log('   ✅ Encrypted format is valid');
  
  // Test decryption
  console.log('\n2. Decrypting encrypted secret...');
  const decrypted = decrypt(encrypted);
  console.log(`   ✅ Decryption successful`);
  
  // Verify round-trip
  if (decrypted !== testSecret) {
    console.error(`   ❌ ERROR: Decrypted value does not match original`);
    console.error(`   Original: ${testSecret}`);
    console.error(`   Decrypted: ${decrypted}`);
    process.exit(1);
  }
  console.log(`   ✅ Round-trip successful (original === decrypted)`);
  
  // Test multiple encryptions produce different ciphertexts (due to random IV)
  console.log('\n3. Testing multiple encryptions...');
  const encrypted1 = encrypt(testSecret);
  const encrypted2 = encrypt(testSecret);
  
  if (encrypted1 === encrypted2) {
    console.warn('   ⚠️  WARNING: Multiple encryptions produced same result (IV should be random)');
  } else {
    console.log('   ✅ Multiple encryptions produce different ciphertexts (good - IV is random)');
  }
  
  // Verify both decrypt correctly
  if (decrypt(encrypted1) !== testSecret || decrypt(encrypted2) !== testSecret) {
    console.error('   ❌ ERROR: Different encryptions do not decrypt correctly');
    process.exit(1);
  }
  console.log('   ✅ All encryptions decrypt correctly');
  
  // Test edge cases
  console.log('\n4. Testing edge cases...');
  
  // Empty string
  const emptyEncrypted = encrypt('');
  const emptyDecrypted = decrypt(emptyEncrypted);
  if (emptyDecrypted !== '') {
    console.error('   ❌ ERROR: Empty string encryption failed');
    process.exit(1);
  }
  console.log('   ✅ Empty string handled correctly');
  
  // Long string
  const longSecret = 'A'.repeat(1000);
  const longEncrypted = encrypt(longSecret);
  const longDecrypted = decrypt(longEncrypted);
  if (longDecrypted !== longSecret) {
    console.error('   ❌ ERROR: Long string encryption failed');
    process.exit(1);
  }
  console.log('   ✅ Long string handled correctly');
  
  // Special characters
  const specialSecret = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
  const specialEncrypted = encrypt(specialSecret);
  const specialDecrypted = decrypt(specialEncrypted);
  if (specialDecrypted !== specialSecret) {
    console.error('   ❌ ERROR: Special characters encryption failed');
    process.exit(1);
  }
  console.log('   ✅ Special characters handled correctly');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All encryption tests passed!');
  console.log('='.repeat(60));
  console.log('\nThe ENCRYPTION_KEY is working correctly.');
  console.log('You can now use it to encrypt OAuth secrets and API keys.\n');
  
} catch (error: any) {
  console.error('\n❌ ERROR: Encryption test failed');
  console.error(`   ${error.message}`);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
}

