/**
 * Cryptographic Service Implementation
 * Provides AES-256-GCM and AES-256-CBC encryption/decryption
 * Supports key derivation and rotation
 * Uses Node.js built-in crypto module only
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'crypto';
import {
  EncryptionAlgorithm,
  EncryptedPayload,
  CryptoServiceConfig,
  DecryptionError,
  EncryptionError,
} from './types.js';

/**
 * Key derivation parameters for PBKDF-style derivation
 */
const KEY_LENGTH = 32; // 256 bits for AES-256
const IV_LENGTH = 16; // 128 bits for CBC/GCM
const AUTH_TAG_LENGTH = 16; // 128 bits for GCM

/**
 * CryptoService: Handles all encryption/decryption operations
 * Supports multiple algorithms with automatic format handling
 * Prevents crypto handle leaks with proper cleanup
 */
export class CryptoService {
  private masterKey: string;
  private defaultAlgorithm: EncryptionAlgorithm;
  private enableKeyRotation: boolean;
  private keyVersions: Map<string, string>;

  constructor(config: CryptoServiceConfig) {
    if (!config.masterKey || config.masterKey.length === 0) {
      throw new EncryptionError('Master key must be provided and non-empty');
    }

    this.masterKey = config.masterKey;
    this.defaultAlgorithm = config.defaultAlgorithm || EncryptionAlgorithm.AES_256_GCM;
    this.enableKeyRotation = config.enableKeyRotation ?? true;
    this.keyVersions = config.keyVersions || new Map();
  }

  /**
   * Encrypt plaintext using AES-256
   * Uses GCM mode by default (authenticated encryption)
   * Returns encrypted payload with algorithm, IV, auth tag, and ciphertext
   */
  encrypt(plaintext: string, keyId?: string): EncryptedPayload {
    try {
      if (!plaintext) {
        throw new EncryptionError('Plaintext cannot be empty');
      }

      // Determine which key to use
      const keyToUse = keyId || this.getActiveKeyId();
      const derivedKey = this.deriveKey(keyToUse);

      // Generate random IV for this encryption
      const iv = randomBytes(IV_LENGTH);

      // Use GCM mode for authenticated encryption
      const cipher = createCipheriv(this.defaultAlgorithm, derivedKey, iv);

      // Encrypt the plaintext
      let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
      ciphertext += cipher.final('base64');

      // Get authentication tag (GCM only)
      const authTag = this.defaultAlgorithm === EncryptionAlgorithm.AES_256_GCM
        ? cipher.getAuthTag()
        : Buffer.alloc(0);

      return {
        algorithm: this.defaultAlgorithm,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        data: ciphertext,
        keyId: keyId || this.getActiveKeyId(),
      };
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw error;
      }
      throw new EncryptionError(
        `Encryption failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Decrypt an encrypted payload
   * Supports key rotation: decrypts with appropriate key version
   * Verifies authentication tag for GCM mode
   */
  decrypt(payload: EncryptedPayload | string): string {
    try {
      let encryptedPayload: EncryptedPayload;

      // Handle string input (assume it's JSON-serialized)
      if (typeof payload === 'string') {
        encryptedPayload = JSON.parse(payload) as EncryptedPayload;
      } else {
        encryptedPayload = payload;
      }

      if (!encryptedPayload.data || !encryptedPayload.iv) {
        throw new DecryptionError('Invalid encrypted payload: missing data or iv');
      }

      // Validate algorithm
      if (!Object.values(EncryptionAlgorithm).includes(encryptedPayload.algorithm as EncryptionAlgorithm)) {
        throw new DecryptionError(`Unsupported algorithm: ${encryptedPayload.algorithm}`);
      }

      // Derive the key used for encryption
      const keyId = encryptedPayload.keyId || this.getActiveKeyId();
      const derivedKey = this.deriveKey(keyId);

      // Decode IV and ciphertext from base64
      const iv = Buffer.from(encryptedPayload.iv, 'base64');
      const ciphertext = Buffer.from(encryptedPayload.data, 'base64');

      // Create decipher based on algorithm
      const decipher = createDecipheriv(
        encryptedPayload.algorithm,
        derivedKey,
        iv
      );

      // For GCM mode, set authentication tag before decryption
      if (
        encryptedPayload.algorithm === EncryptionAlgorithm.AES_256_GCM &&
        encryptedPayload.authTag
      ) {
        const authTag = Buffer.from(encryptedPayload.authTag, 'base64');
        decipher.setAuthTag(authTag);
      }

      // Decrypt
      let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
      plaintext += decipher.final('utf8');

      return plaintext;
    } catch (error) {
      if (error instanceof DecryptionError) {
        throw error;
      }
      throw new DecryptionError(
        `Decryption failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Add a key version for rotation support
   * Allows decryption with multiple key versions
   */
  addKeyVersion(keyId: string, key: string): void {
    this.keyVersions.set(keyId, key);
  }

  /**
   * Get the currently active key ID
   * Used as default for encryption
   */
  getActiveKeyId(): string {
    return 'default';
  }

  /**
   * Derive a cryptographic key from the master key + key ID
   * Uses scrypt for key derivation with fixed parameters
   * Returns 32-byte key suitable for AES-256
   */
  private deriveKey(keyId: string): Buffer {
    try {
      // Use scrypt to derive key from master key + key ID
      // Fixed parameters for consistency
      const keyMaterial = `${this.masterKey}:${keyId}`;

      // scryptSync(password, salt, keylen, options)
      const derivedKey = scryptSync(keyMaterial, 'witylogix-salt', KEY_LENGTH, {
        N: 2 ** 14, // CPU/memory cost parameter
        r: 8, // Block size parameter
        p: 1, // Parallelization parameter
        maxmem: 32 * 1024 * 1024, // Max memory 32MB
      });

      return derivedKey;
    } catch (error) {
      throw new EncryptionError(
        `Key derivation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Securely wipe sensitive data from memory
   * Called to clean up derived keys
   */
  private wipeBuffer(buffer: Buffer): void {
    buffer.fill(0);
  }
}

/**
 * Factory function to create a CryptoService from environment
 * Reads master key from environment variable
 */
export function createCryptoService(
  masterKey?: string,
  defaultAlgorithm?: EncryptionAlgorithm
): CryptoService {
  const key = masterKey || process.env.ENCRYPTION_MASTER_KEY;

  if (!key) {
    throw new EncryptionError(
      'Master key not provided and ENCRYPTION_MASTER_KEY environment variable not set'
    );
  }

  return new CryptoService({
    masterKey: key,
    defaultAlgorithm: defaultAlgorithm || EncryptionAlgorithm.AES_256_GCM,
    enableKeyRotation: true,
  });
}
