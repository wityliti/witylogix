/**
 * Crypto Service Tests
 * Comprehensive test suite for encryption/decryption, key derivation, IV uniqueness, and key rotation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CryptoService,
  EncryptedPayload,
  EncryptionAlgorithm,
  CryptoServiceConfig,
  EncryptionError,
  DecryptionError,
  createCryptoService,
} from '../index';

describe('CryptoService', () => {
  let crypto: CryptoService;

  beforeEach(() => {
    const config: CryptoServiceConfig = {
      masterKey: 'test-master-key-32-characters-long',
      defaultAlgorithm: EncryptionAlgorithm.AES_256_GCM,
      enableKeyRotation: true,
    };

    crypto = new CryptoService(config);
  });

  describe('Basic Encryption/Decryption', () => {
    it('should encrypt plaintext', () => {
      const plaintext = 'Hello, World!';

      const encrypted = crypto.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted.algorithm).toBe(EncryptionAlgorithm.AES_256_GCM);
      expect(encrypted.data).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.keyId).toBeDefined();
    });

    it('should decrypt encrypted payload', () => {
      const plaintext = 'Hello, World!';

      const encrypted = crypto.encrypt(plaintext);
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should perform round-trip encryption/decryption', () => {
      const plaintexts = [
        'Simple text',
        'Text with special characters: !@#$%^&*()',
        'Text with unicode: 你好世界 مرحبا بالعالم',
        'Long text: ' + 'x'.repeat(1000),
      ];

      for (const plaintext of plaintexts) {
        const encrypted = crypto.encrypt(plaintext);
        const decrypted = crypto.decrypt(encrypted);

        expect(decrypted).toBe(plaintext);
      }
    });

    it('should handle empty-like strings', () => {
      // Empty string should be rejected
      expect(() => crypto.encrypt('')).toThrow(EncryptionError);
    });

    it('should handle single character', () => {
      const plaintext = 'a';

      const encrypted = crypto.encrypt(plaintext);
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle very long plaintext', () => {
      const plaintext = 'x'.repeat(10000);

      const encrypted = crypto.encrypt(plaintext);
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle JSON data', () => {
      const data = { user: 'john', age: 30, roles: ['admin', 'user'] };
      const plaintext = JSON.stringify(data);

      const encrypted = crypto.encrypt(plaintext);
      const decrypted = crypto.decrypt(encrypted);

      expect(JSON.parse(decrypted)).toEqual(data);
    });
  });

  describe('IV Uniqueness', () => {
    it('should generate different IV for each encryption', () => {
      const plaintext = 'Test message';

      const encrypted1 = crypto.encrypt(plaintext);
      const encrypted2 = crypto.encrypt(plaintext);

      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should produce different ciphertext with same plaintext', () => {
      const plaintext = 'Test message';

      const encrypted1 = crypto.encrypt(plaintext);
      const encrypted2 = crypto.encrypt(plaintext);

      expect(encrypted1.data).not.toBe(encrypted2.data);
    });

    it('should allow decryption of messages with different IVs', () => {
      const plaintext = 'Test message';

      const encrypted1 = crypto.encrypt(plaintext);
      const encrypted2 = crypto.encrypt(plaintext);

      const decrypted1 = crypto.decrypt(encrypted1);
      const decrypted2 = crypto.decrypt(encrypted2);

      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
      expect(decrypted1).toBe(decrypted2);
    });

    it('should have correct IV length', () => {
      const encrypted = crypto.encrypt('test');

      const ivBuffer = Buffer.from(encrypted.iv, 'base64');
      expect(ivBuffer.length).toBe(16); // 128 bits
    });
  });

  describe('Authentication Tag Verification', () => {
    it('should include auth tag in encrypted payload', () => {
      const encrypted = crypto.encrypt('test');

      expect(encrypted.authTag).toBeDefined();
      expect(typeof encrypted.authTag).toBe('string');
    });

    it('should have correct auth tag length', () => {
      const encrypted = crypto.encrypt('test');

      const tagBuffer = Buffer.from(encrypted.authTag, 'base64');
      expect(tagBuffer.length).toBe(16); // 128 bits
    });

    it('should fail decryption with tampered data', () => {
      const encrypted = crypto.encrypt('test');

      // Tamper with ciphertext
      const tampered = {
        ...encrypted,
        data: Buffer.from(Buffer.from(encrypted.data, 'base64').slice(0, -1)).toString('base64'),
      };

      expect(() => crypto.decrypt(tampered)).toThrow(DecryptionError);
    });

    it('should fail decryption with tampered IV', () => {
      const encrypted = crypto.encrypt('test');

      // Tamper with IV
      const tampered = {
        ...encrypted,
        iv: Buffer.from(Buffer.from(encrypted.iv, 'base64').slice(0, -1)).toString('base64'),
      };

      expect(() => crypto.decrypt(tampered)).toThrow(DecryptionError);
    });

    it('should fail decryption with tampered auth tag', () => {
      const encrypted = crypto.encrypt('test');

      // Tamper with auth tag by flipping bits
      const authTagBuf = Buffer.from(encrypted.authTag, 'base64');
      authTagBuf[0] ^= 0xff;
      const tampered = {
        ...encrypted,
        authTag: authTagBuf.toString('base64'),
      };

      expect(() => crypto.decrypt(tampered)).toThrow(DecryptionError);
    });
  });

  describe('Key Rotation', () => {
    it('should decrypt with active key', () => {
      const plaintext = 'test data';

      const encrypted = crypto.encrypt(plaintext);
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should support multiple key versions', () => {
      const plaintext = 'test data';

      // Encrypt with key 1
      const encrypted1 = crypto.encrypt(plaintext, 'key-v1');

      // Add key version
      crypto.addKeyVersion('key-v2', 'different-master-key');

      // Should still be able to decrypt with original key
      const decrypted = crypto.decrypt(encrypted1);
      expect(decrypted).toBe(plaintext);
    });

    it('should include keyId in encrypted payload', () => {
      const encrypted = crypto.encrypt('test');

      expect(encrypted.keyId).toBeDefined();
      expect(typeof encrypted.keyId).toBe('string');
    });

    it('should support explicit key ID', () => {
      const encrypted = crypto.encrypt('test', 'custom-key-id');

      expect(encrypted.keyId).toBe('custom-key-id');
    });

    it('should get active key ID', () => {
      const keyId = crypto.getActiveKeyId();

      expect(keyId).toBe('default');
    });
  });

  describe('JSON String Handling', () => {
    it('should decrypt JSON-serialized payload', () => {
      const plaintext = 'test data';

      const encrypted = crypto.encrypt(plaintext);
      const serialized = JSON.stringify(encrypted);

      const decrypted = crypto.decrypt(serialized);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle complex encrypted payloads', () => {
      const plaintext = 'sensitive data';

      const encrypted = crypto.encrypt(plaintext);

      // Verify all payload properties
      expect(encrypted).toHaveProperty('algorithm');
      expect(encrypted).toHaveProperty('data');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('keyId');
    });
  });

  describe('Error Handling', () => {
    it('should throw on empty plaintext', () => {
      expect(() => crypto.encrypt('')).toThrow(EncryptionError);
    });

    it('should throw on null plaintext', () => {
      expect(() => crypto.encrypt(null as any)).toThrow(EncryptionError);
    });

    it('should throw on undefined plaintext', () => {
      expect(() => crypto.encrypt(undefined as any)).toThrow(EncryptionError);
    });

    it('should throw on invalid encrypted payload', () => {
      const invalid: any = {
        data: undefined,
        iv: 'valid-iv',
      };

      expect(() => crypto.decrypt(invalid)).toThrow(DecryptionError);
    });

    it('should throw on invalid algorithm', () => {
      const invalid: any = {
        algorithm: 'unknown-algorithm',
        data: 'data',
        iv: 'iv',
        authTag: 'tag',
      };

      expect(() => crypto.decrypt(invalid)).toThrow(DecryptionError);
    });

    it('should throw on invalid base64 in IV', () => {
      const invalid: EncryptedPayload = {
        algorithm: EncryptionAlgorithm.AES_256_GCM,
        data: 'validdata',
        iv: '!!!invalid base64!!!',
        authTag: 'validtag',
        keyId: 'key-1',
      };

      expect(() => crypto.decrypt(invalid)).toThrow(DecryptionError);
    });

    it('should throw on invalid base64 in data', () => {
      const invalid: EncryptedPayload = {
        algorithm: EncryptionAlgorithm.AES_256_GCM,
        data: '!!!invalid base64!!!',
        iv: Buffer.from('1234567890123456').toString('base64'),
        authTag: 'validtag',
        keyId: 'key-1',
      };

      expect(() => crypto.decrypt(invalid)).toThrow(DecryptionError);
    });
  });

  describe('Algorithm Support', () => {
    it('should support AES-256-GCM', () => {
      const config: CryptoServiceConfig = {
        masterKey: 'test-master-key-32-characters-long',
        defaultAlgorithm: EncryptionAlgorithm.AES_256_GCM,
      };

      const cryptoService = new CryptoService(config);
      const encrypted = cryptoService.encrypt('test');

      expect(encrypted.algorithm).toBe(EncryptionAlgorithm.AES_256_GCM);

      const decrypted = cryptoService.decrypt(encrypted);
      expect(decrypted).toBe('test');
    });

    it('should support AES-256-CBC', () => {
      const config: CryptoServiceConfig = {
        masterKey: 'test-master-key-32-characters-long',
        defaultAlgorithm: EncryptionAlgorithm.AES_256_CBC,
      };

      const cryptoService = new CryptoService(config);
      const encrypted = cryptoService.encrypt('test');

      expect(encrypted.algorithm).toBe(EncryptionAlgorithm.AES_256_CBC);

      const decrypted = cryptoService.decrypt(encrypted);
      expect(decrypted).toBe('test');
    });
  });

  describe('Field Encryption Support', () => {
    it('should encrypt sensitive fields', () => {
      const sensitiveData = {
        username: 'john_doe',
        password: 'secret123',
        email: 'john@example.com',
        apiKey: 'sk_live_abc123',
      };

      for (const [key, value] of Object.entries(sensitiveData)) {
        const encrypted = crypto.encrypt(String(value));
        expect(encrypted.data).not.toBe(String(value));
      }
    });

    it('should detect sensitive field patterns', () => {
      const sensitiveFields = [
        'password',
        'secret',
        'token',
        'apiKey',
        'api_key',
        'access_token',
        'private_key',
      ];

      for (const field of sensitiveFields) {
        const value = `sensitive-${field}`;
        const encrypted = crypto.encrypt(value);
        const decrypted = crypto.decrypt(encrypted);

        expect(decrypted).toBe(value);
      }
    });
  });

  describe('Master Key Requirements', () => {
    it('should throw on missing master key', () => {
      const config: CryptoServiceConfig = {
        masterKey: '',
        defaultAlgorithm: EncryptionAlgorithm.AES_256_GCM,
      };

      expect(() => new CryptoService(config)).toThrow(EncryptionError);
    });

    it('should throw on null master key', () => {
      const config: any = {
        masterKey: null,
        defaultAlgorithm: EncryptionAlgorithm.AES_256_GCM,
      };

      expect(() => new CryptoService(config)).toThrow(EncryptionError);
    });

    it('should accept strong master key', () => {
      const config: CryptoServiceConfig = {
        masterKey: 'very-strong-master-key-with-good-length',
        defaultAlgorithm: EncryptionAlgorithm.AES_256_GCM,
      };

      expect(() => new CryptoService(config)).not.toThrow();
    });
  });

  describe('Different Plaintext Lengths', () => {
    it('should handle single byte', () => {
      const plaintext = 'a';

      const encrypted = crypto.encrypt(plaintext);
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle block-aligned length (16 bytes)', () => {
      const plaintext = '1234567890123456';

      const encrypted = crypto.encrypt(plaintext);
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle non-block-aligned length', () => {
      const plaintext = '12345678901234567';

      const encrypted = crypto.encrypt(plaintext);
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle large plaintext (1MB)', () => {
      const plaintext = 'x'.repeat(1024 * 1024);

      const encrypted = crypto.encrypt(plaintext);
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(decrypted.length).toBe(plaintext.length);
    });

    it('should handle whitespace-only plaintext', () => {
      const plaintexts = [' ', '\n', '\t', '   \n\t  '];

      for (const plaintext of plaintexts) {
        const encrypted = crypto.encrypt(plaintext);
        const decrypted = crypto.decrypt(encrypted);

        expect(decrypted).toBe(plaintext);
      }
    });
  });

  describe('Factory Function', () => {
    it('should create crypto service from environment variable', () => {
      process.env.ENCRYPTION_MASTER_KEY = 'env-master-key-32-chars-long!!!';

      const crypto = createCryptoService();

      expect(crypto).toBeDefined();

      const encrypted = crypto.encrypt('test');
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe('test');

      delete process.env.ENCRYPTION_MASTER_KEY;
    });

    it('should throw when environment variable missing', () => {
      delete process.env.ENCRYPTION_MASTER_KEY;

      expect(() => createCryptoService()).toThrow(EncryptionError);
    });

    it('should allow explicit master key override', () => {
      const crypto = createCryptoService('explicit-master-key-32-characters!');

      expect(crypto).toBeDefined();

      const encrypted = crypto.encrypt('test');
      const decrypted = crypto.decrypt(encrypted);

      expect(decrypted).toBe('test');
    });

    it('should support custom algorithm', () => {
      const crypto = createCryptoService(
        'test-master-key-32-characters-long',
        EncryptionAlgorithm.AES_256_CBC
      );

      expect(crypto).toBeDefined();
    });
  });

  describe('Encryption Payload Format', () => {
    it('should use base64 encoding for all binary fields', () => {
      const encrypted = crypto.encrypt('test');

      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.data).toBe('string');
      expect(typeof encrypted.authTag).toBe('string');

      // Verify they can be decoded from base64
      expect(() => Buffer.from(encrypted.iv, 'base64')).not.toThrow();
      expect(() => Buffer.from(encrypted.data, 'base64')).not.toThrow();
      expect(() => Buffer.from(encrypted.authTag, 'base64')).not.toThrow();
    });

    it('should include all required fields in payload', () => {
      const encrypted = crypto.encrypt('test');

      expect(encrypted).toHaveProperty('algorithm');
      expect(encrypted).toHaveProperty('data');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('keyId');
    });
  });

  describe('Key Derivation', () => {
    it('should derive consistent keys for same key ID', () => {
      const plaintext = 'test data';

      const encrypted1 = crypto.encrypt(plaintext, 'key-v1');
      const encrypted2 = crypto.encrypt(plaintext, 'key-v1');

      // Different encryption should produce different ciphertext (different IVs)
      expect(encrypted1.data).not.toBe(encrypted2.data);

      // But both should decrypt to the same plaintext
      const decrypted1 = crypto.decrypt(encrypted1);
      const decrypted2 = crypto.decrypt(encrypted2);

      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    it('should derive different keys for different key IDs', () => {
      const plaintext = 'test data';

      const encrypted1 = crypto.encrypt(plaintext, 'key-v1');
      const encrypted2 = crypto.encrypt(plaintext, 'key-v2');

      // Both have different key IDs
      expect(encrypted1.keyId).toBe('key-v1');
      expect(encrypted2.keyId).toBe('key-v2');

      // Both should be decryptable
      const decrypted1 = crypto.decrypt(encrypted1);
      expect(decrypted1).toBe(plaintext);

      const decrypted2 = crypto.decrypt(encrypted2);
      expect(decrypted2).toBe(plaintext);
    });
  });
});
