/**
 * Encryption Module
 * Exports public API for cryptography and field-level encryption
 */

export {
  // Types
  EncryptionAlgorithm,
  type EncryptedPayload,
  type KeyInfo,
  type CryptoServiceConfig,
  type DecryptionResult,
  EncryptionError,
  DecryptionError,
} from './types.js';

export {
  // Crypto service
  CryptoService,
  createCryptoService,
} from './crypto.js';

export {
  // Field encryptor
  FieldEncryptor,
  createFieldEncryptor,
  DEFAULT_SENSITIVE_FIELDS,
} from './field-encryptor.js';
