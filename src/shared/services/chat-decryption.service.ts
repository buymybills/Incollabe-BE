import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as crypto from 'crypto';
import { KeyBackup } from '../models/key-backup.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { MessageType } from '../models/message.model';

@Injectable()
export class ChatDecryptionService {
  constructor(
    @InjectModel(KeyBackup) private keyBackupModel: typeof KeyBackup,
    @InjectModel(Influencer) private influencerModel: typeof Influencer,
    @InjectModel(Brand) private brandModel: typeof Brand,
  ) {}

  /**
   * Decrypt a CryptoJS AES-encrypted string.
   *
   * CryptoJS.AES.encrypt(plaintext, passphraseString) uses:
   *   - A random 8-byte salt embedded in the ciphertext (OpenSSL "Salted__" format)
   *   - EVP_BytesToKey (MD5-based) to derive a 256-bit key + 128-bit IV from the passphrase + salt
   *   - AES-256-CBC to encrypt
   *
   * The output format (base64) decodes to: "Salted__" (8 bytes) + salt (8 bytes) + ciphertext
   */
  private decryptCryptoJsAes(encryptedBase64: string, passphrase: string): string {
    const encrypted = Buffer.from(encryptedBase64, 'base64');

    const MAGIC = Buffer.from('Salted__', 'utf8');
    if (!encrypted.subarray(0, 8).equals(MAGIC)) {
      throw new Error('Not a valid CryptoJS AES encrypted string (missing Salted__ magic)');
    }

    const salt = encrypted.subarray(8, 16);
    const ciphertext = encrypted.subarray(16);

    // EVP_BytesToKey: MD5-based key derivation used by CryptoJS with string keys
    const passBuffer = Buffer.from(passphrase, 'utf8');
    let d = Buffer.alloc(0);
    let prev = Buffer.alloc(0);
    while (d.length < 48) { // 32 bytes key + 16 bytes IV
      prev = Buffer.from(crypto.createHash('md5').update(Buffer.concat([prev, passBuffer, salt])).digest());
      d = Buffer.concat([d, prev]);
    }

    const key = d.subarray(0, 32);
    const iv = d.subarray(32, 48);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Recover the RSA private key (PEM) for a user by replicating the frontend key derivation:
   *   1. PBKDF2(password, salt, 100000 iterations, 32 bytes, SHA-256) → hex key
   *      (CryptoJS.PBKDF2 with this project's CryptoJS version defaults to HMAC-SHA256)
   *   2. CryptoJS.AES.decrypt(encryptedPrivateKey, hexKey) → PEM private key
   *
   * Password used:
   *   - Influencer: phone number (e.g. "+919876543210")
   *   - Brand: email address (lowercased)
   */
  async getPrivateKey(
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<string | null> {
    try {
      const backup = await this.keyBackupModel.findOne({
        where: { userId, userType },
      });

      if (!backup?.encryptedPrivateKey || !backup?.salt) {
        return null;
      }

      let password: string;
      if (userType === 'influencer') {
        const influencer = await this.influencerModel.findByPk(userId, {
          attributes: ['phone'],
        });
        if (!influencer?.phone) return null;
        password = influencer.phone;
      } else {
        const brand = await this.brandModel.findByPk(userId, {
          attributes: ['email'],
        });
        if (!brand?.email) return null;
        password = brand.email.toLowerCase();
      }

      // Replicate CryptoJS.PBKDF2(password, salt, { keySize: 8, iterations: 100000 })
      // CryptoJS treats both password and salt as UTF-8 strings.
      // The CryptoJS version used here defaults to SHA-256 (not SHA-1).
      const pbkdf2Key = crypto.pbkdf2Sync(password, backup.salt, 100000, 32, 'sha256');
      const encryptionKeyHex = pbkdf2Key.toString('hex');

      // Replicate CryptoJS.AES.decrypt(encryptedPrivateKey, encryptionKeyHex)
      const privateKeyPem = this.decryptCryptoJsAes(backup.encryptedPrivateKey, encryptionKeyHex);

      if (!privateKeyPem || !privateKeyPem.includes('PRIVATE KEY')) {
        return null;
      }

      return privateKeyPem;
    } catch {
      return null;
    }
  }

  /**
   * Returns true if content is an E2EE JSON payload (new or legacy format).
   */
  private isE2eeContent(content: string): boolean {
    try {
      const p = JSON.parse(content);
      return !!(
        (p.encryptedKeyForRecipient || p.encryptedKey) &&
        p.iv &&
        p.ciphertext
      );
    } catch {
      return false;
    }
  }

  /**
   * Decrypt an E2EE message using the recipient's private key recovered from backup.
   *
   * Client encryption uses:
   *   - AES-256-GCM (Web Crypto) with a 12-byte IV; auth tag (16 bytes) is appended to ciphertext
   *   - RSA-OAEP SHA-256 to wrap the AES key (once for recipient, once for sender)
   *
   * Supports:
   *   - New format: { encryptedKeyForRecipient, encryptedKeyForSender, iv, ciphertext, version }
   *   - Legacy format: { encryptedKey, iv, ciphertext, version }
   *
   * Returns null (rather than throwing) on any failure so notification sending is never blocked.
   */
  async decryptMessageContent(
    encryptedContent: string,
    recipientUserId: number,
    recipientUserType: 'influencer' | 'brand',
  ): Promise<string | null> {
    try {
      const parsed = JSON.parse(encryptedContent);

      // Pick the key encrypted for the recipient
      let encryptedKeyBase64: string | undefined =
        parsed.encryptedKeyForRecipient ?? parsed.encryptedKey;

      if (!encryptedKeyBase64 || !parsed.iv || !parsed.ciphertext) {
        return null;
      }

      const privateKeyPem = await this.getPrivateKey(recipientUserId, recipientUserType);
      if (!privateKeyPem) return null;

      // Decrypt AES key with RSA-OAEP (SHA-256)
      const privateKey = crypto.createPrivateKey(privateKeyPem);
      const aesKeyBuffer = crypto.privateDecrypt(
        {
          key: privateKey,
          oaepHash: 'sha256',
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        Buffer.from(encryptedKeyBase64, 'base64'),
      );

      // Decrypt message with AES-256-GCM
      // Web Crypto API appends the 16-byte GCM auth tag at the end of the ciphertext
      const ivBuffer = Buffer.from(parsed.iv, 'base64');
      const fullCiphertext = Buffer.from(parsed.ciphertext, 'base64');
      const authTag = fullCiphertext.subarray(fullCiphertext.length - 16);
      const actualCiphertext = fullCiphertext.subarray(0, fullCiphertext.length - 16);

      const decipher = crypto.createDecipheriv('aes-256-gcm', aesKeyBuffer, ivBuffer);
      decipher.setAuthTag(authTag);
      const decrypted =
        decipher.update(actualCiphertext, undefined, 'utf8') + decipher.final('utf8');

      return decrypted || null;
    } catch {
      return null;
    }
  }

  /**
   * Build a notification body string from a message.
   * For encrypted messages, attempts server-side decryption from the key backup.
   * Falls back gracefully to a generic string on any failure.
   */
  async buildNotificationBody(
    message: {
      content: string | null;
      messageType: MessageType;
      isEncrypted: boolean;
    },
    recipientUserId: number,
    recipientUserType: 'influencer' | 'brand',
  ): Promise<string> {
    // Non-text media types
    if (message.messageType !== MessageType.TEXT) {
      const typeLabel: Record<string, string> = {
        [MessageType.IMAGE]: '📷 Sent an image',
        [MessageType.VIDEO]: '🎥 Sent a video',
        [MessageType.AUDIO]: '🎵 Sent an audio message',
        [MessageType.FILE]: '📎 Sent a file',
        [MessageType.MEDIA]: '📎 Sent media',
      };
      return typeLabel[message.messageType] ?? 'Sent a message';
    }

    if (!message.content) {
      return 'Sent a message';
    }

    // Always check whether the content is E2EE JSON first.
    // Existing messages were stored with isEncrypted = false even though they
    // contain the new dual-key format, so we cannot rely on the flag alone.
    const isE2ee = this.isE2eeContent(message.content);

    if (!isE2ee) {
      // Genuine plain text — return directly
      return message.content.length > 100
        ? message.content.substring(0, 100) + '…'
        : message.content;
    }

    // E2EE content — attempt decryption using recipient's key backup
    const decrypted = await this.decryptMessageContent(
      message.content,
      recipientUserId,
      recipientUserType,
    );

    if (decrypted) {
      return decrypted.length > 100 ? decrypted.substring(0, 100) + '…' : decrypted;
    }

    return '💬 Sent you a message';
  }
}
