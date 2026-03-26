/**
 * Field-level Encryption Utility
 * Encrypts/decrypts specific fields in objects
 * Supports Prisma middleware for automatic field handling
 * Configurable sensitive fields list
 */

import { CryptoService } from './crypto.js';
import { EncryptedPayload, EncryptionError, DecryptionError } from './types.js';

/**
 * Default sensitive fields to encrypt automatically
 * Can be customized per instance
 */
export const DEFAULT_SENSITIVE_FIELDS = [
  'accessToken',
  'access_token',
  'apiSecret',
  'api_secret',
  'webhookSecret',
  'webhook_secret',
  'password',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'sessionToken',
  'session_token',
  'creditCard',
  'credit_card',
];

/**
 * FieldEncryptor: Encrypts and decrypts specific fields in objects
 * Useful for selective encryption at the application level
 * Integrates with Prisma for transparent encryption/decryption
 */
export class FieldEncryptor {
  private crypto: CryptoService;
  private sensitiveFields: Set<string>;

  constructor(crypto: CryptoService, sensitiveFields?: string[]) {
    this.crypto = crypto;
    this.sensitiveFields = new Set(sensitiveFields || DEFAULT_SENSITIVE_FIELDS);
  }

  /**
   * Add a field to the sensitive fields set
   * Fields in this set will be encrypted automatically
   */
  addSensitiveField(fieldName: string): void {
    this.sensitiveFields.add(fieldName);
  }

  /**
   * Remove a field from the sensitive fields set
   */
  removeSensitiveField(fieldName: string): void {
    this.sensitiveFields.delete(fieldName);
  }

  /**
   * Encrypt specified fields in an object (in place)
   * Mutates the input object
   *
   * @param obj Object containing fields to encrypt
   * @param fieldPaths Array of field names to encrypt (e.g., ['password', 'apiKey'])
   * @returns The same object with encrypted fields
   */
  encryptFields<T extends Record<string, unknown>>(
    obj: T,
    fieldPaths: string[]
  ): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    try {
      for (const fieldPath of fieldPaths) {
        const value = this.getNestedValue(obj, fieldPath);

        if (value !== null && value !== undefined && typeof value === 'string') {
          // Encrypt the field
          const encrypted = this.crypto.encrypt(value);

          // Store as encrypted payload JSON string
          this.setNestedValue(obj, fieldPath, JSON.stringify(encrypted));
        }
      }

      return obj;
    } catch (error) {
      throw new EncryptionError(
        `Failed to encrypt fields: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Decrypt specified fields in an object (in place)
   * Assumes encrypted fields are stored as JSON-serialized EncryptedPayload
   * Mutates the input object
   *
   * @param obj Object containing encrypted fields
   * @param fieldPaths Array of field names to decrypt
   * @returns The same object with decrypted fields
   */
  decryptFields<T extends Record<string, unknown>>(
    obj: T,
    fieldPaths: string[]
  ): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    try {
      for (const fieldPath of fieldPaths) {
        const value = this.getNestedValue(obj, fieldPath);

        if (value !== null && value !== undefined) {
          try {
            // Try to parse as JSON (encrypted payload format)
            if (typeof value === 'string') {
              const decrypted = this.crypto.decrypt(value);
              this.setNestedValue(obj, fieldPath, decrypted);
            }
          } catch (error) {
            // If decryption fails, leave the value as-is
            // This handles cases where field isn't actually encrypted
            if (!(error instanceof DecryptionError)) {
              throw error;
            }
          }
        }
      }

      return obj;
    } catch (error) {
      throw new DecryptionError(
        `Failed to decrypt fields: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Encrypt fields marked as sensitive in the object
   * Uses the configured sensitiveFields set
   */
  encryptSensitiveFields<T extends Record<string, unknown>>(obj: T): T {
    const fieldsToEncrypt = Object.keys(obj).filter((key) =>
      this.isSensitiveField(key)
    );

    return this.encryptFields(obj, fieldsToEncrypt);
  }

  /**
   * Decrypt fields marked as sensitive in the object
   * Uses the configured sensitiveFields set
   */
  decryptSensitiveFields<T extends Record<string, unknown>>(obj: T): T {
    const fieldsToDecrypt = Object.keys(obj).filter((key) =>
      this.isSensitiveField(key)
    );

    return this.decryptFields(obj, fieldsToDecrypt);
  }

  /**
   * Check if a field name matches the sensitive fields list
   */
  isSensitiveField(fieldName: string): boolean {
    return this.sensitiveFields.has(fieldName);
  }

  /**
   * Create a Prisma middleware factory for automatic encryption/decryption
   * Usage:
   *   const middleware = fieldEncryptor.prismaMiddleware();
   *   prisma.$use(middleware);
   */
  prismaMiddleware() {
    return (params: any, next: any) => {
      // Encrypt sensitive fields on write operations
      if (['create', 'update', 'upsert'].includes(params.action)) {
        if (params.args.data) {
          this.encryptSensitiveFields(params.args.data);
        }
      }

      // Call the next middleware or actual database operation
      const result = next(params);

      // Decrypt sensitive fields on read operations
      if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
        if (Array.isArray(result)) {
          result.forEach((item) => this.decryptSensitiveFields(item));
        } else if (result) {
          this.decryptSensitiveFields(result);
        }
      }

      return result;
    };
  }

  /**
   * Get a nested value from an object using dot notation
   * @param obj Object to search
   * @param path Dot-separated path (e.g., 'user.profile.email')
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let current: any = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Set a nested value in an object using dot notation
   * Creates intermediate objects as needed
   * @param obj Object to modify
   * @param path Dot-separated path (e.g., 'user.profile.email')
   * @param value Value to set
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
  ): void {
    const keys = path.split('.');
    const lastKey = keys.pop();

    if (!lastKey) {
      return;
    }

    let current: any = obj;

    for (const key of keys) {
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    current[lastKey] = value;
  }
}

/**
 * Factory function to create a FieldEncryptor
 */
export function createFieldEncryptor(
  crypto: CryptoService,
  sensitiveFields?: string[]
): FieldEncryptor {
  return new FieldEncryptor(crypto, sensitiveFields);
}
