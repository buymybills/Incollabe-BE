import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits for GCM
  private readonly tagLength = 16; // 128 bits auth tag
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');

    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }

    // Derive a proper 256-bit key from the environment variable
    this.key = crypto.scryptSync(encryptionKey, 'salt', this.keyLength);
  }

  /**
   * Encrypts a string using AES-256-GCM
   * @param text - Plain text to encrypt
   * @returns Encrypted string in format: iv:authTag:encryptedData (all base64)
   */
  encrypt(text: string): string {
    if (!text) return text;

    try {
      // Generate random IV (Initialization Vector)
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // Encrypt the text
      let encrypted = cipher.update(text, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Get the authentication tag
      const authTag = cipher.getAuthTag();

      // Return format: iv:authTag:encryptedData
      return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypts a string encrypted with AES-256-GCM
   * @param encryptedText - Encrypted string in format: iv:authTag:encryptedData
   * @returns Decrypted plain text
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;

    try {
      // Split the encrypted text into components
      const parts = encryptedText.split(':');

      if (parts.length !== 3) {
        // If format is incorrect, assume it's not encrypted (for backward compatibility)
        return encryptedText;
      }

      const [ivBase64, authTagBase64, encrypted] = parts;

      // Convert from base64
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt the text
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      // Return original text if decryption fails (for backward compatibility)
      return encryptedText;
    }
  }

  /**
   * Encrypts an object's specified fields
   * @param obj - Object to encrypt
   * @param fields - Array of field names to encrypt
   * @returns Object with encrypted fields
   */
  encryptFields<T extends Record<string, any>>(obj: T, fields: (keyof T)[]): T {
    const result = { ...obj };

    for (const field of fields) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = this.encrypt(result[field] as string) as any;
      }
    }

    return result;
  }

  /**
   * Decrypts an object's specified fields
   * @param obj - Object to decrypt
   * @param fields - Array of field names to decrypt
   * @returns Object with decrypted fields
   */
  decryptFields<T extends Record<string, any>>(obj: T, fields: (keyof T)[]): T {
    const result = { ...obj };

    for (const field of fields) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = this.decrypt(result[field] as string) as any;
      }
    }

    return result;
  }
}
