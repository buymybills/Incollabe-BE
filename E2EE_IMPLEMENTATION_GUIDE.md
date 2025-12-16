# End-to-End Encryption (E2EE) Implementation Guide

## Overview

The chat system now supports true end-to-end encryption, ensuring that only the intended recipients can read messages. The server cannot decrypt messages as private keys never leave the client.

## Architecture

### Encryption Approach: RSA + AES Hybrid

We use a hybrid encryption approach combining asymmetric (RSA) and symmetric (AES) encryption:

1. **RSA (2048-bit or higher)**: For key exchange and encrypting message keys
2. **AES-256-GCM**: For encrypting actual message content (faster for large data)

### Key Management

- **Public Keys**: Stored on server (in `influencers` and `brands` tables)
- **Private Keys**: NEVER sent to server, stored only on client device
- **Session Keys**: Generated per message, encrypted with recipient's public key

## Database Schema

### New Fields Added

**influencers table:**
```sql
publicKey               TEXT         -- RSA public key (PEM format)
publicKeyCreatedAt      TIMESTAMP    -- When key was first created
publicKeyUpdatedAt      TIMESTAMP    -- When key was last updated
```

**brands table:**
```sql
publicKey               TEXT         -- RSA public key (PEM format)
publicKeyCreatedAt      TIMESTAMP    -- When key was first created
publicKeyUpdatedAt      TIMESTAMP    -- When key was last updated
```

**messages table:**
```sql
isEncrypted             BOOLEAN      -- Whether message is E2EE encrypted
encryptionVersion       VARCHAR(10)  -- Encryption scheme version (v1, v2, etc.)
```

## API Endpoints

### 1. Set/Update Public Key

**Endpoint:** `PUT /api/e2ee/public-key`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
    "publicKeyCreatedAt": "2025-01-15T10:30:00.000Z",
    "publicKeyUpdatedAt": "2025-01-15T10:30:00.000Z"
  },
  "message": "Public key updated successfully",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### 2. Get Another User's Public Key

**Endpoint:** `GET /api/e2ee/public-key/:userType/:userId`

**Parameters:**
- `userType`: "influencer" or "brand"
- `userId`: User ID number

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": 123,
    "userType": "influencer",
    "name": "John Doe",
    "username": "johndoe",
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
    "publicKeyCreatedAt": "2025-01-15T10:30:00.000Z",
    "publicKeyUpdatedAt": "2025-01-15T10:30:00.000Z"
  },
  "message": "Public key retrieved",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### 3. Get My Own Public Key

**Endpoint:** `GET /api/e2ee/my-public-key`

**Response:** Same structure as endpoint #2

## Client Implementation Guide

### Step 1: Generate Key Pair (First Time Setup)

```javascript
// Using Web Crypto API (browser)
async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  // Export keys
  const publicKey = await window.crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey
  );
  const privateKey = await window.crypto.subtle.exportKey(
    "pkcs8",
    keyPair.privateKey
  );

  // Convert to PEM format
  const publicKeyPem = arrayBufferToPem(publicKey, 'PUBLIC KEY');
  const privateKeyPem = arrayBufferToPem(privateKey, 'PRIVATE KEY');

  // Store private key securely in local storage (consider encryption)
  localStorage.setItem('e2ee_private_key', privateKeyPem);

  // Send public key to server
  await fetch('/api/e2ee/public-key', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ publicKey: publicKeyPem })
  });

  return { publicKeyPem, privateKeyPem };
}

function arrayBufferToPem(buffer, type) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const pem = `-----BEGIN ${type}-----\n${base64.match(/.{1,64}/g).join('\n')}\n-----END ${type}-----`;
  return pem;
}
```

### Step 2: Encrypt Message Before Sending

```javascript
async function encryptMessage(plaintext, recipientPublicKeyPem) {
  // 1. Generate random AES key for this message
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // 2. Encrypt message content with AES
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedMessage = new TextEncoder().encode(plaintext);

  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    encodedMessage
  );

  // 3. Export AES key
  const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

  // 4. Import recipient's RSA public key
  const recipientPublicKey = await importPublicKey(recipientPublicKeyPem);

  // 5. Encrypt AES key with recipient's RSA public key
  const encryptedAesKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    exportedAesKey
  );

  // 6. Combine encrypted key + IV + encrypted content
  const encryptedMessage = {
    encryptedKey: arrayBufferToBase64(encryptedAesKey),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(encryptedContent),
    version: 'v1'
  };

  return JSON.stringify(encryptedMessage);
}

async function importPublicKey(pem) {
  const pemContents = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');

  const binaryDer = base64ToArrayBuffer(pemContents);

  return await window.crypto.subtle.importKey(
    "spki",
    binaryDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

function arrayBufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
```

### Step 3: Send Encrypted Message

```javascript
async function sendEncryptedMessage(conversationId, plaintext, recipientUserId, recipientUserType) {
  // 1. Get recipient's public key
  const response = await fetch(
    `/api/e2ee/public-key/${recipientUserType}/${recipientUserId}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  const { data } = await response.json();
  const recipientPublicKey = data.publicKey;

  // 2. Encrypt the message
  const encryptedContent = await encryptMessage(plaintext, recipientPublicKey);

  // 3. Send to server
  await fetch('/api/chat/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      conversationId: conversationId,
      content: encryptedContent,
      messageType: 'text',
      // Custom field to indicate this is encrypted
      // (Backend will set isEncrypted flag automatically if content looks encrypted)
    })
  });
}
```

### Step 4: Decrypt Received Message

```javascript
async function decryptMessage(encryptedMessage, privateKeyPem) {
  const parsed = JSON.parse(encryptedMessage);
  const { encryptedKey, iv, ciphertext } = parsed;

  // 1. Import private key
  const privateKey = await importPrivateKey(privateKeyPem);

  // 2. Decrypt AES key using RSA private key
  const encryptedAesKeyBuffer = base64ToArrayBuffer(encryptedKey);
  const aesKeyBuffer = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encryptedAesKeyBuffer
  );

  // 3. Import decrypted AES key
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    aesKeyBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // 4. Decrypt message content
  const ivBuffer = base64ToArrayBuffer(iv);
  const ciphertextBuffer = base64ToArrayBuffer(ciphertext);

  const decryptedContent = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuffer },
    aesKey,
    ciphertextBuffer
  );

  // 5. Convert to string
  const plaintext = new TextDecoder().decode(decryptedContent);
  return plaintext;
}

async function importPrivateKey(pem) {
  const pemContents = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryDer = base64ToArrayBuffer(pemContents);

  return await window.crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );
}
```

## Security Best Practices

### 1. Private Key Storage

**Browser:**
- Store in IndexedDB with Web Crypto API
- Consider encrypting with user's password/passphrase
- Never send to server

**Mobile:**
- Use Keychain (iOS) or Keystore (Android)
- Enable biometric protection
- Never store in plain text

### 2. Key Rotation

```javascript
// Regenerate keys periodically (e.g., every 90 days)
async function rotateKeys() {
  const { publicKeyPem, privateKeyPem } = await generateKeyPair();

  // Update server with new public key
  await fetch('/api/e2ee/public-key', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ publicKey: publicKeyPem })
  });

  // Store new private key
  localStorage.setItem('e2ee_private_key', privateKeyPem);

  return true;
}
```

### 3. Message Validation

- Always verify message integrity
- Check encryption version
- Handle decryption failures gracefully

### 4. Backup and Recovery

- Provide secure backup mechanism for private keys
- Implement key recovery flow
- Warn users about data loss if keys are lost

## File/Media Encryption

For images, videos, and audio:

```javascript
async function encryptFile(file, recipientPublicKeyPem) {
  // 1. Read file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer();

  // 2. Generate AES key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // 3. Encrypt file
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedFile = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    fileBuffer
  );

  // 4. Encrypt AES key with RSA
  const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const recipientPublicKey = await importPublicKey(recipientPublicKeyPem);
  const encryptedAesKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    exportedAesKey
  );

  // 5. Create encrypted file blob
  const metadata = {
    encryptedKey: arrayBufferToBase64(encryptedAesKey),
    iv: arrayBufferToBase64(iv),
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size
  };

  // Upload encrypted file to S3
  const encryptedBlob = new Blob([encryptedFile], { type: 'application/octet-stream' });
  const formData = new FormData();
  formData.append('file', encryptedBlob, `encrypted_${file.name}`);

  const uploadResponse = await fetch('/api/chat/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  const { data } = await uploadResponse.json();

  return {
    url: data.url,
    metadata: JSON.stringify(metadata)
  };
}
```

## Troubleshooting

### Issue: "User has not set up E2EE"

**Solution:** The recipient hasn't generated their key pair yet. They need to:
1. Generate RSA key pair on their device
2. Send public key to server via `PUT /api/e2ee/public-key`

### Issue: Decryption fails

**Possible causes:**
1. Wrong private key
2. Message encrypted for different recipient
3. Corrupted ciphertext
4. Version mismatch

### Issue: Performance concerns

**Solutions:**
1. Use Web Workers for encryption/decryption
2. Implement message caching
3. Lazy load/decrypt messages as user scrolls

## Migration Notes

### Existing Messages

- Old unencrypted messages remain readable
- New messages can be encrypted
- Check `isEncrypted` flag before attempting decryption

### Gradual Rollout

```javascript
async function sendMessage(conversationId, plaintext) {
  // Check if recipient has E2EE enabled
  try {
    const recipientKey = await getRecipientPublicKey();
    if (recipientKey) {
      // Send encrypted
      return await sendEncryptedMessage(conversationId, plaintext);
    }
  } catch (error) {
    // E2EE not available, fallback to plaintext
  }

  // Send plaintext
  return await sendPlaintextMessage(conversationId, plaintext);
}
```

## Support and Questions

For implementation support or questions about E2EE, contact the development team.

## Version History

- **v1** (2025-01): Initial E2EE implementation with RSA-2048 + AES-256-GCM
