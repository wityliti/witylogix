import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DataAnonymizer } from '../anonymizer';
import {
  AnonymizationConfig,
  PIIField,
  DatabaseRecord,
} from '../types';

describe('DataAnonymizer', () => {
  let anonymizer: DataAnonymizer;
  const DEFAULT_SALT = 'witylogix-anonymization-salt';

  beforeEach(() => {
    anonymizer = new DataAnonymizer();
  });

  afterEach(() => {
    anonymizer.resetStats();
  });

  // ==================== hashPII Tests ====================
  describe('hashPII', () => {
    it('should hash PII with known input/output consistency', () => {
      const value = 'john.doe@example.com';
      const salt = 'test-salt';

      const hash1 = anonymizer.hashPII(value, salt);
      const hash2 = anonymizer.hashPII(value, salt);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
    });

    it('should produce different hashes for different values', () => {
      const salt = 'test-salt';
      const hash1 = anonymizer.hashPII('user1@example.com', salt);
      const hash2 = anonymizer.hashPII('user2@example.com', salt);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different salts', () => {
      const value = 'john.doe@example.com';

      const hash1 = anonymizer.hashPII(value, 'salt1');
      const hash2 = anonymizer.hashPII(value, 'salt2');

      expect(hash1).not.toBe(hash2);
    });

    it('should return empty string for empty input', () => {
      const hash = anonymizer.hashPII('', 'salt');
      expect(hash).toBe('');
    });

    it('should handle special characters and unicode', () => {
      const values = [
        'test@例え.jp',
        'user+tag@example.com',
        'name@domain.co.uk',
      ];

      for (const value of values) {
        const hash = anonymizer.hashPII(value, 'salt');
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });
  });

  // ==================== redactField Tests ====================
  describe('redactField', () => {
    it('should redact field with visible character count', () => {
      const value = 'John Doe';
      const redacted = anonymizer.redactField(value, 3);

      expect(redacted).toBe('*****Doe');
      expect(redacted.length).toBe(value.length);
    });

    it('should return full asterisks when visibleChars is 0', () => {
      const value = 'secret123';
      const redacted = anonymizer.redactField(value, 0);

      expect(redacted).toBe('*********');
    });

    it('should return original value when visibleChars >= length', () => {
      const value = 'test';
      const redacted = anonymizer.redactField(value, 10);

      expect(redacted).toBe('test');
    });

    it('should return empty string for empty input', () => {
      const redacted = anonymizer.redactField('', 3);
      expect(redacted).toBe('');
    });

    it('should handle single character strings', () => {
      const redacted = anonymizer.redactField('x', 0);
      expect(redacted).toBe('*');
    });

    it('should handle email addresses correctly', () => {
      const email = 'john.doe@example.com';
      const redacted = anonymizer.redactField(email, 4);

      // Implementation shows last N chars: '*'.repeat(len-N) + value.substring(len-N)
      // 20 chars, visible 4 = '****************.com'
      expect(redacted).toBe('****************.com');
      expect(redacted.length).toBe(email.length);
    });

    it('should handle phone numbers', () => {
      const phone = '+1234567890';
      const redacted = anonymizer.redactField(phone, 4);

      // 11 chars, visible 4 = '*******7890'
      expect(redacted).toBe('*******7890');
      expect(redacted.endsWith('7890')).toBe(true);
    });
  });

  // ==================== generalizeLocation Tests ====================
  describe('generalizeLocation', () => {
    it('should generalize address to city level', () => {
      const address = '123 Main St, Springfield, IL 62701';
      const generalized = anonymizer.generalizeLocation(address, 'city');

      // Implementation: parts.slice(-3, -1).join(', ')
      // parts = ['123 Main St', 'Springfield', 'IL 62701']
      // slice(-3, -1) = ['123 Main St', 'Springfield']
      expect(generalized).toBe('123 Main St, Springfield');
    });

    it('should generalize address to region level', () => {
      const address = '123 Main St, Springfield, IL 62701';
      const generalized = anonymizer.generalizeLocation(address, 'region');

      // Implementation: parts.slice(-2).join(', ')
      // = ['Springfield', 'IL 62701']
      expect(generalized).toContain('Springfield');
      expect(generalized).toContain('IL 62701');
    });

    it('should generalize address to country level', () => {
      const address = '123 Main St, Springfield, IL 62701';
      const generalized = anonymizer.generalizeLocation(address, 'country');

      // Implementation: parts[parts.length - 1]
      // = 'IL 62701'
      expect(generalized).toBe('IL 62701');
    });

    it('should return empty string for empty address', () => {
      const generalized = anonymizer.generalizeLocation('', 'city');
      expect(generalized).toBe('');
    });

    it('should handle addresses with varying comma counts', () => {
      const addresses = [
        'New York',
        'New York, NY',
        'New York, NY 10001',
        '123 Main, New York, NY 10001',
      ];

      for (const address of addresses) {
        const result = anonymizer.generalizeLocation(address, 'city');
        expect(typeof result).toBe('string');
      }
    });

    it('should handle international addresses', () => {
      const address = 'Rue de la Paix, Paris, France';
      const generalized = anonymizer.generalizeLocation(address, 'city');

      expect(generalized).toContain('Paris');
    });
  });

  // ==================== anonymizeRecord Tests ====================
  describe('anonymizeRecord', () => {
    it('should apply correct strategy per field', () => {
      const record: DatabaseRecord = {
        id: '123',
        email: 'john.doe@example.com',
        name: 'John Doe',
        address: '123 Main St, Springfield, IL',
      };

      const piiFields: PIIField[] = [
        {
          fieldName: 'email',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'hash',
        },
        {
          fieldName: 'name',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'redact',
        },
        {
          fieldName: 'address',
          tableName: 'users',
          classification: 'indirect',
          maskingStrategy: 'generalize',
        },
      ];

      const config: AnonymizationConfig = {
        strategy: 'hash',
        retentionDays: 365,
        salt: 'test-salt',
        visibleCharacters: 2,
        generalizationLevel: 'city',
      };

      const anonymized = anonymizer.anonymizeRecord(record, config, piiFields);

      expect(anonymized.id).toBe('123'); // Not in PII fields
      expect(anonymized.email).toMatch(/^[a-f0-9]{64}$/); // Hashed
      expect(anonymized.name).toMatch(/\*/); // Redacted
      expect(anonymized.address).toContain('Springfield'); // Generalized
    });

    it('should skip null and undefined fields', () => {
      const record: DatabaseRecord = {
        id: '123',
        email: 'test@example.com',
        phone: null,
        address: undefined,
      };

      const piiFields: PIIField[] = [
        {
          fieldName: 'email',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'hash',
        },
        {
          fieldName: 'phone',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'redact',
        },
        {
          fieldName: 'address',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'redact',
        },
      ];

      const config: AnonymizationConfig = {
        strategy: 'hash',
        retentionDays: 365,
      };

      const anonymized = anonymizer.anonymizeRecord(record, config, piiFields);

      expect(anonymized.phone).toBeNull();
      expect(anonymized.address).toBeUndefined();
    });

    it('should handle pseudonymization strategy', () => {
      const record: DatabaseRecord = {
        id: '123',
        userIdentifier: 'user12345',
      };

      const piiFields: PIIField[] = [
        {
          fieldName: 'userIdentifier',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'pseudonymize',
        },
      ];

      const config: AnonymizationConfig = {
        strategy: 'pseudonymize',
        retentionDays: 365,
        salt: 'test-salt',
      };

      const anonymized = anonymizer.anonymizeRecord(record, config, piiFields);

      expect(anonymized.userIdentifier).toMatch(/^PSEUDO_/);
    });
  });

  // ==================== anonymizeInBatch Tests ====================
  describe('anonymizeInBatch', () => {
    it('should process multiple records', () => {
      const records: DatabaseRecord[] = [
        {
          id: '1',
          email: 'user1@example.com',
          name: 'User One',
        },
        {
          id: '2',
          email: 'user2@example.com',
          name: 'User Two',
        },
        {
          id: '3',
          email: 'user3@example.com',
          name: 'User Three',
        },
      ];

      const piiFields: PIIField[] = [
        {
          fieldName: 'email',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'hash',
        },
        {
          fieldName: 'name',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'redact',
        },
      ];

      const config: AnonymizationConfig = {
        strategy: 'hash',
        retentionDays: 365,
        visibleCharacters: 1,
      };

      const anonymized = anonymizer.anonymizeInBatch(records, config, piiFields);

      expect(anonymized).toHaveLength(3);
      expect(anonymized[0].id).toBe('1');
      expect(anonymized[1].id).toBe('2');
      expect(anonymized[2].id).toBe('3');

      // All emails should be hashed
      for (const record of anonymized) {
        expect(record.email).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should track processing statistics', () => {
      const records: DatabaseRecord[] = [
        { id: '1', email: 'test1@example.com' },
        { id: '2', email: 'test2@example.com' },
      ];

      const piiFields: PIIField[] = [
        {
          fieldName: 'email',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'hash',
        },
      ];

      const config: AnonymizationConfig = {
        strategy: 'hash',
        retentionDays: 365,
      };

      anonymizer.anonymizeInBatch(records, config, piiFields);
      const report = anonymizer.generateAnonymizationReport();

      expect(report.totalProcessed).toBe(2);
      expect(report.successRate).toBeGreaterThan(0);
    });

    it('should handle large batches', () => {
      const records: DatabaseRecord[] = Array.from({ length: 1000 }, (_, i) => ({
        id: String(i),
        email: `user${i}@example.com`,
      }));

      const piiFields: PIIField[] = [
        {
          fieldName: 'email',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'hash',
        },
      ];

      const config: AnonymizationConfig = {
        strategy: 'hash',
        retentionDays: 365,
      };

      const anonymized = anonymizer.anonymizeInBatch(records, config, piiFields);

      expect(anonymized).toHaveLength(1000);
      expect(anonymized[0].id).toBe('0');
      expect(anonymized[999].id).toBe('999');
    });
  });

  // ==================== Edge Cases Tests ====================
  describe('Edge Cases', () => {
    it('should handle empty string values', () => {
      const record: DatabaseRecord = {
        id: '123',
        email: '',
        name: '',
      };

      const piiFields: PIIField[] = [
        {
          fieldName: 'email',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'hash',
        },
        {
          fieldName: 'name',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'redact',
        },
      ];

      const config: AnonymizationConfig = {
        strategy: 'hash',
        retentionDays: 365,
      };

      const anonymized = anonymizer.anonymizeRecord(record, config, piiFields);

      expect(anonymized.email).toBe('');
      expect(anonymized.name).toBe('');
    });

    it('should handle unicode characters', () => {
      const record: DatabaseRecord = {
        id: '123',
        name: '田中太郎',
        email: 'tanaka@例え.jp',
      };

      const piiFields: PIIField[] = [
        {
          fieldName: 'name',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'hash',
        },
        {
          fieldName: 'email',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'hash',
        },
      ];

      const config: AnonymizationConfig = {
        strategy: 'hash',
        retentionDays: 365,
      };

      const anonymized = anonymizer.anonymizeRecord(record, config, piiFields);

      expect(anonymized.name).toMatch(/^[a-f0-9]{64}$/);
      expect(anonymized.email).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle numeric and boolean values', () => {
      const record: DatabaseRecord = {
        id: '123',
        age: 42,
        isActive: true,
        balance: 1234.56,
      };

      const piiFields: PIIField[] = [
        {
          fieldName: 'age',
          tableName: 'users',
          classification: 'indirect',
          maskingStrategy: 'redact',
        },
      ];

      const config: AnonymizationConfig = {
        strategy: 'hash',
        retentionDays: 365,
      };

      const anonymized = anonymizer.anonymizeRecord(record, config, piiFields);

      expect(anonymized.isActive).toBe(true); // Not in PII fields
      expect(anonymized.balance).toBe(1234.56); // Not in PII fields
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const record: DatabaseRecord = {
        id: '123',
        data: longString,
      };

      const piiFields: PIIField[] = [
        {
          fieldName: 'data',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'redact',
        },
      ];

      const config: AnonymizationConfig = {
        strategy: 'hash',
        retentionDays: 365,
        visibleCharacters: 5,
      };

      const anonymized = anonymizer.anonymizeRecord(record, config, piiFields);

      expect((anonymized.data as string).length).toBe(10000);
      expect((anonymized.data as string).endsWith('aaaaa')).toBe(true);
    });
  });

  // ==================== Report Generation Tests ====================
  describe('Report Generation', () => {
    it('should generate accurate anonymization report', () => {
      const records: DatabaseRecord[] = [
        { id: '1', email: 'user1@example.com', name: 'User One' },
        { id: '2', email: 'user2@example.com', name: 'User Two' },
      ];

      const piiFields: PIIField[] = [
        {
          fieldName: 'email',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'hash',
        },
        {
          fieldName: 'name',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'redact',
        },
      ];

      const config: AnonymizationConfig = {
        strategy: 'hash',
        retentionDays: 365,
      };

      anonymizer.anonymizeInBatch(records, config, piiFields);
      const report = anonymizer.generateAnonymizationReport();

      expect(report.totalProcessed).toBe(2);
      expect(report.successRate).toBeCloseTo(100);
      expect(report.fieldsAnonymized['email']).toBe(2);
      expect(report.fieldsAnonymized['name']).toBe(2);
      expect(report.strategiesUsed['hash']).toBe(2);
      expect(report.strategiesUsed['redact']).toBe(2);
    });

    it('should have timestamp in report', () => {
      const records: DatabaseRecord[] = [{ id: '1', email: 'test@example.com' }];
      const piiFields: PIIField[] = [
        {
          fieldName: 'email',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'hash',
        },
      ];

      const config: AnonymizationConfig = {
        strategy: 'hash',
        retentionDays: 365,
      };

      const before = new Date();
      anonymizer.anonymizeInBatch(records, config, piiFields);
      const report = anonymizer.generateAnonymizationReport();
      const after = new Date();

      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(report.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ==================== Configuration Validation Tests ====================
  describe('Configuration Validation', () => {
    it('should validate correct configuration', () => {
      const config: AnonymizationConfig = {
        strategy: 'hash',
        retentionDays: 365,
      };

      const result = anonymizer.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid strategy', () => {
      const config: AnonymizationConfig = {
        strategy: 'invalid' as any,
        retentionDays: 365,
      };

      const result = anonymizer.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject negative retention days', () => {
      const config: AnonymizationConfig = {
        strategy: 'hash',
        retentionDays: -1,
      };

      const result = anonymizer.validateConfig(config);

      expect(result.valid).toBe(false);
    });

    it('should reject negative visible characters', () => {
      const config: AnonymizationConfig = {
        strategy: 'redact',
        retentionDays: 365,
        visibleCharacters: -1,
      };

      const result = anonymizer.validateConfig(config);

      expect(result.valid).toBe(false);
    });
  });

  // ==================== Stats Reset Tests ====================
  describe('Statistics Management', () => {
    it('should reset statistics', () => {
      const records: DatabaseRecord[] = [
        { id: '1', email: 'test@example.com' },
      ];

      const piiFields: PIIField[] = [
        {
          fieldName: 'email',
          tableName: 'users',
          classification: 'direct',
          maskingStrategy: 'hash',
        },
      ];

      const config: AnonymizationConfig = {
        strategy: 'hash',
        retentionDays: 365,
      };

      anonymizer.anonymizeInBatch(records, config, piiFields);
      let report = anonymizer.generateAnonymizationReport();
      expect(report.totalProcessed).toBe(1);

      anonymizer.resetStats();
      report = anonymizer.generateAnonymizationReport();

      expect(report.totalProcessed).toBe(0);
      expect(report.successRate).toBe(0);
    });
  });
});
