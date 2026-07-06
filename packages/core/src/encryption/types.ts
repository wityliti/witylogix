/**
 * Encryption Types and Interfaces
 * Defines structures for encrypted payloads, key management, and algorithms
 */

/**
 * Supported encryption algorithms
 * AES-256-GCM: Authenticated encryption (recommended, default)
 * AES-256-CBC: Traditional cipher block chaining mode
 */
export enum EncryptionAlgorithm {
  AES_256_GCM = "aes-256-gcm",
  AES_256_CBC = "aes-256-cbc",
}

/**
 * Encrypted payload containing all necessary data for decryption
 * Stored as base64-encoded string for easy transmission/storage
 */
export interface EncryptedPayload {
  /** Encryption algorithm used */
  algorithm: EncryptionAlgorithm | string;

  /** Base64-encoded initialization vector (random for each encryption) */
  iv: string;

  /** Base64-encoded authentication tag (GCM mode only, used for integrity verification) */
  authTag?: string;

  /** Base64-encoded ciphertext */
  data: string;

  /** Optional key ID used for encryption (for key rotation support) */
  keyId?: string;
}

/**
 * Key metadata for key management and rotation
 */
export interface KeyInfo {
  /** Unique key identifier */
  id: string;

  /** Algorithm this key is used for */
  algorithm: EncryptionAlgorithm | string;

  /** ISO 8601 timestamp when key was created */
  createdAt: Date;

  /** Optional ISO 8601 timestamp when key expires */
  expiresAt?: Date;

  /** Whether this key is currently active for encryption */
  isActive: boolean;
}

/**
 * Cryptographic service configuration
 */
export interface CryptoServiceConfig {
  /** Master key for derivation (from environment) */
  masterKey: string;

  /** Default algorithm for encryption (aes-256-gcm recommended) */
  defaultAlgorithm?: EncryptionAlgorithm;

  /** Enable key rotation (decrypt with any valid key) */
  enableKeyRotation?: boolean;

  /** Available key versions for rotation */
  keyVersions?: Map<string, string>;
}

/**
 * Result of decryption operation
 */
export interface DecryptionResult {
  /** Decrypted plaintext */
  plaintext: string;

  /** Key ID used for decryption */
  keyId?: string;
}

/**
 * Error thrown when decryption fails
 */
export class DecryptionError extends Error {
  constructor(
    message: string,
    public readonly code: string = "DECRYPTION_FAILED",
  ) {
    super(message);
    this.name = "DecryptionError";
    Object.setPrototypeOf(this, DecryptionError.prototype);
  }
}

/**
 * Error thrown when encryption fails
 */
export class EncryptionError extends Error {
  constructor(
    message: string,
    public readonly code: string = "ENCRYPTION_FAILED",
  ) {
    super(message);
    this.name = "EncryptionError";
    Object.setPrototypeOf(this, EncryptionError.prototype);
  }
}
