# Complete E2EE Implementation Guide - Frontend & Backend

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Backend Setup (Already Done)](#backend-setup)
3. [Frontend Implementation](#frontend-implementation)
4. [Step-by-Step Flow](#step-by-step-flow)
5. [Testing Guide](#testing-guide)
6. [Security Best Practices](#security-best-practices)

---

## Architecture Overview

### How E2EE Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        E2EE Message Flow                        │
└─────────────────────────────────────────────────────────────────┘

Sender (Influencer A)                    Recipient (Brand B)
─────────────────────                    ───────────────────

1. Generate RSA Keys                     1. Generate RSA Keys
   - Public Key (share)                     - Public Key (share)
   - Private Key (keep secret)              - Private Key (keep secret)
          ↓                                          ↓
2. Upload Public Key to Server  ←──────→  2. Upload Public Key to Server
          ↓                                          ↓
3. Fetch Recipient's Public Key                     │
          ↓                                          │
4. Encrypt Message:                                 │
   a) Generate random AES key                       │
   b) Encrypt message with AES                      │
   c) Encrypt AES key with B's Public Key          │
          ↓                                          │
5. Send Encrypted Package to Server                 │
          ↓                                          ↓
   Server Stores (Cannot Decrypt!) ──────→  6. Fetch Encrypted Message
                                                     ↓
                                            7. Decrypt with Private Key:
                                               a) Decrypt AES key with Private Key
                                               b) Decrypt message with AES key
                                                     ↓
                                            8. Read Plain Text Message ✅
```

### Key Concepts

1. **Hybrid Encryption**: Combines RSA (asymmetric) and AES (symmetric)
   - RSA: Slow but secure for key exchange
   - AES: Fast but needs shared key (encrypted with RSA)

2. **Keys Never Leave Client**: Private keys are NEVER sent to server

3. **Server Cannot Read Messages**: Server only stores encrypted data

---

## Backend Setup (Already Done ✅)

Your backend is already set up! Here's what you have:

### 1. Database Schema

```sql
-- Influencers table
ALTER TABLE influencers ADD COLUMN "publicKey" TEXT;
ALTER TABLE influencers ADD COLUMN "publicKeyCreatedAt" TIMESTAMP;
ALTER TABLE influencers ADD COLUMN "publicKeyUpdatedAt" TIMESTAMP;

-- Brands table
ALTER TABLE brands ADD COLUMN "publicKey" TEXT;
ALTER TABLE brands ADD COLUMN "publicKeyCreatedAt" TIMESTAMP;
ALTER TABLE brands ADD COLUMN "publicKeyUpdatedAt" TIMESTAMP;

-- Messages table
ALTER TABLE messages ADD COLUMN "isEncrypted" BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN "encryptionVersion" VARCHAR(10) DEFAULT 'v1';
```

### 2. API Endpoints

```typescript
// Upload public key
PUT /api/e2ee/public-key
Body: { "publicKey": "-----BEGIN PUBLIC KEY-----..." }

// Get another user's public key
GET /api/e2ee/public-key/{userType}/{userId}

// Get own public key
GET /api/e2ee/my-public-key

// Send encrypted message
POST /api/chat/messages
Body: {
  "otherPartyId": 32,
  "otherPartyType": "brand",
  "content": "{\"encryptedKey\":\"...\",\"iv\":\"...\",\"ciphertext\":\"...\"}",
  "messageType": "text"
}
```

### 3. Auto-Detection

The backend automatically detects encrypted messages:

```typescript
// In chat.service.ts
if (content) {
  try {
    const parsed = JSON.parse(content);
    if (parsed.encryptedKey && parsed.iv && parsed.ciphertext) {
      isEncrypted = true; // ✅ Auto-detected
    }
  } catch {
    isEncrypted = false; // Plain text
  }
}
```

---

## Frontend Implementation

### Technology Options

Choose based on your platform:

| Platform | Library | Installation |
|----------|---------|-------------|
| **Web (Browser)** | Web Crypto API | Built-in ✅ |
| **React Native** | `react-native-rsa-native` + `crypto-js` | `npm install` |
| **Flutter** | `pointycastle` | `flutter pub add` |
| **Native iOS** | CommonCrypto | Built-in ✅ |
| **Native Android** | javax.crypto | Built-in ✅ |

### Implementation for Web/React (JavaScript)

#### Step 1: Create Crypto Helper Service

```javascript
// services/cryptoService.js

class CryptoService {
  /**
   * Generate RSA key pair
   * @returns {Promise<{publicKey: string, privateKey: string}>}
   */
  async generateKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true, // extractable
      ["encrypt", "decrypt"]
    );

    const publicKey = await this.exportPublicKey(keyPair.publicKey);
    const privateKey = await this.exportPrivateKey(keyPair.privateKey);

    return { publicKey, privateKey };
  }

  /**
   * Export public key to PEM format
   */
  async exportPublicKey(key) {
    const exported = await window.crypto.subtle.exportKey("spki", key);
    return this.arrayBufferToPem(exported, "PUBLIC KEY");
  }

  /**
   * Export private key to PEM format
   */
  async exportPrivateKey(key) {
    const exported = await window.crypto.subtle.exportKey("pkcs8", key);
    return this.arrayBufferToPem(exported, "PRIVATE KEY");
  }

  /**
   * Import public key from PEM format
   */
  async importPublicKey(pemKey) {
    const binaryDer = this.pemToArrayBuffer(pemKey);
    return await window.crypto.subtle.importKey(
      "spki",
      binaryDer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );
  }

  /**
   * Import private key from PEM format
   */
  async importPrivateKey(pemKey) {
    const binaryDer = this.pemToArrayBuffer(pemKey);
    return await window.crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"]
    );
  }

  /**
   * Encrypt a message for a recipient
   * @param {string} plaintext - Message to encrypt
   * @param {string} recipientPublicKeyPem - Recipient's public key in PEM format
   * @returns {Promise<string>} - JSON string with encrypted data
   */
  async encryptMessage(plaintext, recipientPublicKeyPem) {
    // 1. Generate random AES key
    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    // 2. Encrypt message with AES
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
    const recipientPublicKey = await this.importPublicKey(recipientPublicKeyPem);

    // 5. Encrypt AES key with RSA
    const encryptedAesKey = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      recipientPublicKey,
      exportedAesKey
    );

    // 6. Return encrypted package
    return JSON.stringify({
      encryptedKey: this.arrayBufferToBase64(encryptedAesKey),
      iv: this.arrayBufferToBase64(iv),
      ciphertext: this.arrayBufferToBase64(encryptedContent),
      version: 'v1'
    });
  }

  /**
   * Decrypt a received message
   * @param {string} encryptedMessageJson - JSON string from server
   * @param {string} privateKeyPem - Your private key in PEM format
   * @returns {Promise<string>} - Decrypted plain text
   */
  async decryptMessage(encryptedMessageJson, privateKeyPem) {
    const { encryptedKey, iv, ciphertext } = JSON.parse(encryptedMessageJson);

    // 1. Import private key
    const privateKey = await this.importPrivateKey(privateKeyPem);

    // 2. Decrypt AES key
    const encryptedAesKeyBuffer = this.base64ToArrayBuffer(encryptedKey);
    const aesKeyBuffer = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedAesKeyBuffer
    );

    // 3. Import AES key
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      aesKeyBuffer,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // 4. Decrypt message
    const ivBuffer = this.base64ToArrayBuffer(iv);
    const ciphertextBuffer = this.base64ToArrayBuffer(ciphertext);

    const decryptedContent = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuffer },
      aesKey,
      ciphertextBuffer
    );

    // 5. Convert to string
    return new TextDecoder().decode(decryptedContent);
  }

  // === Helper Functions ===

  arrayBufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  arrayBufferToPem(buffer, type) {
    const base64 = this.arrayBufferToBase64(buffer);
    const pem = `-----BEGIN ${type}-----\n${base64.match(/.{1,64}/g).join('\n')}\n-----END ${type}-----`;
    return pem;
  }

  pemToArrayBuffer(pem) {
    const pemContents = pem
      .replace(/-----BEGIN .*-----/, '')
      .replace(/-----END .*-----/, '')
      .replace(/\s/g, '');
    return this.base64ToArrayBuffer(pemContents);
  }
}

export default new CryptoService();
```

#### Step 2: Create E2EE Manager

```javascript
// services/e2eeManager.js
import cryptoService from './cryptoService';
import apiService from './apiService';
import storageService from './storageService'; // Secure storage for private key

class E2EEManager {
  constructor() {
    this.publicKey = null;
    this.privateKey = null;
    this.recipientPublicKeys = new Map(); // Cache recipient public keys
  }

  /**
   * Initialize E2EE for current user
   * Generates keys if not exists, otherwise loads from storage
   */
  async initialize() {
    // Check if keys already exist in secure storage
    const existingKeys = await storageService.getKeys();

    if (existingKeys.publicKey && existingKeys.privateKey) {
      // Load existing keys
      this.publicKey = existingKeys.publicKey;
      this.privateKey = existingKeys.privateKey;
      console.log('E2EE: Loaded existing keys');
      return;
    }

    // Generate new keys
    const { publicKey, privateKey } = await cryptoService.generateKeyPair();
    this.publicKey = publicKey;
    this.privateKey = privateKey;

    // Save to secure storage
    await storageService.saveKeys({ publicKey, privateKey });

    // Upload public key to server
    await this.uploadPublicKey();

    console.log('E2EE: Generated and uploaded new keys');
  }

  /**
   * Upload public key to server
   */
  async uploadPublicKey() {
    try {
      const response = await apiService.put('/e2ee/public-key', {
        publicKey: this.publicKey
      });
      console.log('Public key uploaded successfully');
      return response;
    } catch (error) {
      console.error('Failed to upload public key:', error);
      throw error;
    }
  }

  /**
   * Get recipient's public key (with caching)
   */
  async getRecipientPublicKey(userId, userType) {
    const cacheKey = `${userType}:${userId}`;

    // Check cache first
    if (this.recipientPublicKeys.has(cacheKey)) {
      return this.recipientPublicKeys.get(cacheKey);
    }

    // Fetch from server
    try {
      const response = await apiService.get(`/e2ee/public-key/${userType}/${userId}`);
      const publicKey = response.data.publicKey;

      // Cache it
      this.recipientPublicKeys.set(cacheKey, publicKey);

      return publicKey;
    } catch (error) {
      console.error('Failed to fetch recipient public key:', error);
      throw new Error('Recipient has not set up encryption yet');
    }
  }

  /**
   * Encrypt and send message
   */
  async sendEncryptedMessage(recipientId, recipientType, messageText) {
    if (!this.publicKey || !this.privateKey) {
      throw new Error('E2EE not initialized. Call initialize() first');
    }

    // Get recipient's public key
    const recipientPublicKey = await this.getRecipientPublicKey(recipientId, recipientType);

    // Encrypt the message
    const encryptedContent = await cryptoService.encryptMessage(
      messageText,
      recipientPublicKey
    );

    // Send to server
    const response = await apiService.post('/chat/messages', {
      otherPartyId: recipientId,
      otherPartyType: recipientType,
      content: encryptedContent,
      messageType: 'text'
    });

    return response.data;
  }

  /**
   * Decrypt received message
   */
  async decryptReceivedMessage(encryptedContent) {
    if (!this.privateKey) {
      throw new Error('E2EE not initialized. Cannot decrypt message');
    }

    try {
      const plaintext = await cryptoService.decryptMessage(
        encryptedContent,
        this.privateKey
      );
      return plaintext;
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      return '[Failed to decrypt message]';
    }
  }

  /**
   * Check if message is encrypted
   */
  isEncrypted(content) {
    try {
      const parsed = JSON.parse(content);
      return !!(parsed.encryptedKey && parsed.iv && parsed.ciphertext);
    } catch {
      return false;
    }
  }
}

export default new E2EEManager();
```

#### Step 3: Secure Storage Service

```javascript
// services/storageService.js

class StorageService {
  constructor() {
    this.KEYS_STORAGE_KEY = 'e2ee_keys';
  }

  /**
   * Save keys to secure storage
   * For Web: Use IndexedDB or encrypted localStorage
   * For Mobile: Use Keychain (iOS) or Keystore (Android)
   */
  async saveKeys(keys) {
    // WARNING: This is a simple example. In production:
    // - On mobile: Use react-native-keychain or flutter_secure_storage
    // - On web: Use IndexedDB with encryption

    // Simple localStorage for demo (NOT SECURE - encrypt in production!)
    localStorage.setItem(this.KEYS_STORAGE_KEY, JSON.stringify(keys));
  }

  /**
   * Get keys from secure storage
   */
  async getKeys() {
    const keysJson = localStorage.getItem(this.KEYS_STORAGE_KEY);
    return keysJson ? JSON.parse(keysJson) : null;
  }

  /**
   * Delete keys (logout)
   */
  async deleteKeys() {
    localStorage.removeItem(this.KEYS_STORAGE_KEY);
  }
}

export default new StorageService();
```

#### Step 4: API Service

```javascript
// services/apiService.js

class ApiService {
  constructor() {
    this.baseURL = 'http://localhost:3002/api';
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  async request(method, endpoint, data = null) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      method,
      headers,
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'API request failed');
    }

    return result;
  }

  get(endpoint) {
    return this.request('GET', endpoint);
  }

  post(endpoint, data) {
    return this.request('POST', endpoint, data);
  }

  put(endpoint, data) {
    return this.request('PUT', endpoint, data);
  }

  delete(endpoint) {
    return this.request('DELETE', endpoint);
  }
}

export default new ApiService();
```

---

## Step-by-Step Flow

### Phase 1: Initial Setup (One-time per user)

#### User A (Influencer) - First Time Setup

```javascript
import e2eeManager from './services/e2eeManager';
import apiService from './services/apiService';

// 1. User logs in
const loginResponse = await login('influencer@example.com', 'password');
apiService.setToken(loginResponse.token);

// 2. Initialize E2EE
await e2eeManager.initialize();
// This will:
// - Generate RSA keys if not exists
// - Upload public key to server
// - Save private key to secure storage
```

#### User B (Brand) - First Time Setup

```javascript
// Same process for Brand
const loginResponse = await login('brand@example.com', 'password');
apiService.setToken(loginResponse.token);

await e2eeManager.initialize();
```

### Phase 2: Sending Encrypted Message

#### Influencer sends message to Brand

```javascript
import e2eeManager from './services/e2eeManager';

// Component/Screen code
async function sendEncryptedMessage() {
  const messageText = "Hey! This is a secret message.";
  const recipientId = 32; // Brand ID
  const recipientType = 'brand';

  try {
    // This will:
    // 1. Fetch Brand's public key
    // 2. Encrypt message
    // 3. Send to server
    const result = await e2eeManager.sendEncryptedMessage(
      recipientId,
      recipientType,
      messageText
    );

    console.log('Encrypted message sent:', result);

    // Update UI
    displayMessage({
      text: messageText,
      encrypted: true,
      sent: true,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to send encrypted message:', error);
    alert('Failed to send message. Recipient may not have encryption enabled.');
  }
}
```

### Phase 3: Receiving and Decrypting Messages

#### Brand receives and decrypts message

```javascript
import e2eeManager from './services/e2eeManager';
import apiService from './services/apiService';

async function fetchAndDisplayMessages(conversationId) {
  // 1. Fetch messages from server
  const response = await apiService.get(`/chat/conversations/${conversationId}/messages`);
  const messages = response.data.messages;

  // 2. Decrypt encrypted messages
  const decryptedMessages = await Promise.all(
    messages.map(async (msg) => {
      if (msg.isEncrypted || e2eeManager.isEncrypted(msg.content)) {
        // Decrypt the message
        const plaintext = await e2eeManager.decryptReceivedMessage(msg.content);
        return {
          ...msg,
          content: plaintext,
          isEncrypted: true
        };
      }
      return msg; // Not encrypted, return as-is
    })
  );

  // 3. Display in UI
  decryptedMessages.forEach(msg => {
    displayMessage({
      text: msg.content,
      encrypted: msg.isEncrypted,
      sent: msg.senderType === 'brand', // Adjust based on current user
      timestamp: msg.createdAt
    });
  });
}
```

### Phase 4: Real-time Updates with WebSocket

```javascript
import io from 'socket.io-client';
import e2eeManager from './services/e2eeManager';

const socket = io('http://localhost:3002/chat', {
  auth: {
    token: apiService.token
  }
});

// Join conversation
socket.emit('conversation:join', { conversationId: 1 });

// Listen for new messages
socket.on('message:new', async (message) => {
  let displayText = message.content;

  // Decrypt if encrypted
  if (message.isEncrypted || e2eeManager.isEncrypted(message.content)) {
    displayText = await e2eeManager.decryptReceivedMessage(message.content);
  }

  // Display in chat
  displayMessage({
    text: displayText,
    encrypted: message.isEncrypted,
    sent: false,
    timestamp: message.createdAt
  });

  // Play notification sound
  playNotificationSound();
});
```

---

## Complete Example: React Component

```jsx
// ChatScreen.jsx
import React, { useState, useEffect } from 'react';
import e2eeManager from '../services/e2eeManager';
import apiService from '../services/apiService';

function ChatScreen({ conversationId, recipientId, recipientType }) {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [e2eeEnabled, setE2eeEnabled] = useState(false);

  useEffect(() => {
    initializeChat();
  }, []);

  async function initializeChat() {
    try {
      // Initialize E2EE
      await e2eeManager.initialize();
      setE2eeEnabled(true);

      // Load messages
      await loadMessages();
    } catch (error) {
      console.error('Failed to initialize chat:', error);
    }
  }

  async function loadMessages() {
    setLoading(true);
    try {
      const response = await apiService.get(
        `/chat/conversations/${conversationId}/messages`
      );

      const decryptedMessages = await Promise.all(
        response.data.messages.map(async (msg) => {
          if (msg.isEncrypted || e2eeManager.isEncrypted(msg.content)) {
            const plaintext = await e2eeManager.decryptReceivedMessage(msg.content);
            return { ...msg, content: plaintext, decrypted: true };
          }
          return msg;
        })
      );

      setMessages(decryptedMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!messageText.trim()) return;

    try {
      if (e2eeEnabled) {
        // Send encrypted
        await e2eeManager.sendEncryptedMessage(
          recipientId,
          recipientType,
          messageText
        );
      } else {
        // Send plain text
        await apiService.post('/chat/messages', {
          otherPartyId: recipientId,
          otherPartyType: recipientType,
          content: messageText,
          messageType: 'text'
        });
      }

      // Add to UI optimistically
      setMessages([...messages, {
        content: messageText,
        sent: true,
        encrypted: e2eeEnabled,
        timestamp: new Date()
      }]);

      setMessageText('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }
  }

  return (
    <div className="chat-screen">
      <div className="header">
        <h2>Chat</h2>
        {e2eeEnabled && <span className="badge">🔒 Encrypted</span>}
      </div>

      <div className="messages">
        {loading ? (
          <div>Loading messages...</div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`message ${msg.sent ? 'sent' : 'received'}`}>
              <div className="content">{msg.content}</div>
              {msg.encrypted && <div className="encrypted-badge">🔒</div>}
              <div className="timestamp">{msg.timestamp}</div>
            </div>
          ))
        )}
      </div>

      <div className="input-area">
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Type a message..."
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>
          {e2eeEnabled ? '🔒 Send Encrypted' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default ChatScreen;
```

---

## Testing Guide

### Test 1: Generate and Upload Keys

```javascript
// In browser console or test file
import e2eeManager from './services/e2eeManager';

await e2eeManager.initialize();
console.log('Public Key:', e2eeManager.publicKey);
console.log('Keys uploaded!');
```

### Test 2: Encrypt a Message

```javascript
import cryptoService from './services/cryptoService';

const message = "Hello, this is secret!";
const recipientPublicKey = "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----";

const encrypted = await cryptoService.encryptMessage(message, recipientPublicKey);
console.log('Encrypted:', encrypted);
```

### Test 3: Decrypt a Message

```javascript
const encrypted = '{"encryptedKey":"...","iv":"...","ciphertext":"..."}';
const myPrivateKey = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----";

const decrypted = await cryptoService.decryptMessage(encrypted, myPrivateKey);
console.log('Decrypted:', decrypted);
```

### Test 4: Complete Flow

```bash
# 1. Open e2ee-test.html in browser
# 2. Follow the UI steps:
#    - Generate keys for both users
#    - Upload public keys
#    - Fetch each other's public keys
#    - Send encrypted messages
#    - Decrypt received messages
```

---

## Security Best Practices

### ✅ DO

1. **Store private keys securely**
   - Mobile: Use Keychain (iOS) or Keystore (Android)
   - Web: Use IndexedDB with additional encryption

2. **Never send private keys to server**
   - Private keys should NEVER leave the device

3. **Validate public keys**
   - Verify public key format before using
   - Handle errors gracefully

4. **Use secure random number generation**
   - Use `crypto.getRandomValues()` (Web)
   - Use platform-specific secure RNG (Mobile)

5. **Implement key rotation**
   - Allow users to regenerate keys periodically
   - Keep old keys for decrypting old messages

### ❌ DON'T

1. **Don't store private keys in localStorage (without encryption)**
2. **Don't log private keys**
3. **Don't send private keys over network**
4. **Don't skip error handling**
5. **Don't trust client-side encryption alone** - Always validate on server too

---

## Platform-Specific Notes

### React Native

```bash
npm install react-native-rsa-native
npm install crypto-js
npm install @react-native-async-storage/async-storage
npm install react-native-keychain
```

```javascript
import { RSA } from 'react-native-rsa-native';
import * as Keychain from 'react-native-keychain';

// Generate keys
const keys = await RSA.generateKeys(2048);

// Store securely
await Keychain.setGenericPassword('privateKey', keys.private);
```

### Flutter

```yaml
dependencies:
  pointycastle: ^3.7.3
  flutter_secure_storage: ^9.0.0
```

```dart
import 'package:pointycastle/export.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// Generate keys
final keyGen = RSAKeyGenerator();
final pair = keyGen.generateKeyPair();

// Store securely
final storage = FlutterSecureStorage();
await storage.write(key: 'privateKey', value: privateKeyPem);
```

---

## Summary Checklist

### Backend (✅ Already Done)
- [x] Public key storage in database
- [x] API endpoints for key management
- [x] Auto-detection of encrypted messages
- [x] Encrypted message storage

### Frontend (To Implement)
- [ ] Install crypto library
- [ ] Implement key generation
- [ ] Implement encryption/decryption functions
- [ ] Secure key storage
- [ ] Integrate with chat UI
- [ ] Handle encrypted messages
- [ ] Test complete flow

### Testing
- [ ] Generate keys for 2 users
- [ ] Upload public keys
- [ ] Send encrypted message
- [ ] Receive and decrypt message
- [ ] Verify server cannot decrypt

---

**Your backend is ready! Just implement the frontend following this guide. 🔒**
