// Script to decrypt phone number for influencer
require('dotenv').config();
const crypto = require('crypto');

// Simple decryption function matching EncryptionService
function decrypt(encryptedData) {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY not found in environment');
  }

  const [iv, encrypted] = encryptedData.split(':');

  if (!iv || !encrypted) {
    console.log('Data is not encrypted (no : separator), returning as-is');
    return encryptedData;
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(encryptionKey, 'hex'),
    Buffer.from(iv, 'hex')
  );

  let decrypted = decipher.update(Buffer.from(encrypted, 'hex'));
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

// Get encrypted phone from command line argument or use query
const encryptedPhone = process.argv[2];

if (!encryptedPhone) {
  console.log('Usage: node decrypt-phone.js <encrypted_phone>');
  console.log('\nOr run this SQL query first:');
  console.log('psql -U postgres -d incollab_db -c "SELECT id, name, phone FROM influencers WHERE id = 7;"');
  process.exit(1);
}

try {
  const decryptedPhone = decrypt(encryptedPhone);
  console.log('Decrypted phone:', decryptedPhone);
} catch (error) {
  console.error('Error decrypting:', error.message);
  process.exit(1);
}
