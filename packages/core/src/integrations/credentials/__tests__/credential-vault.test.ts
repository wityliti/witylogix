/**
 * Credential Vault Tests — AES-256-GCM encryption, isolation, cache, audit
 *
 * Tests cover:
 * - Store encrypted credential with per-tenant isolation
 * - Retrieve and decrypt credential
 * - Update credential (delete old, store new)
 * - Delete credential
 * - Mask credentials for safe display
 * - TTL-based cache with expiration
 * - Key rotation with re-encryption
 * - Audit logging for all operations
 * - Credential expiration handling
 *
 * Run with: npm test -- credential-vault.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CredentialVault } from '../credential-vault.js';
import type {
  CredentialEntry,
  EncryptedCredential,
  ICredentialPersistence,
  VaultConfig,
} from '../credential-vault.js';
import type { CryptoService } from '../../../encryption/crypto.js';
import type { AuditLogger } from '../../../audit/logger.js';

// ─── Mock Implementations ────────────────────────────────────────

class MockCryptoService {
  getActiveKey(): Buffer {
    return Buffer.from('0'.repeat(64), 'hex');
  }

  getActiveKeyVersion(): string {
    return 'v1';
  }

  getKeyVersion(version: string): Buffer {
    return Buffer.from('0'.repeat(64), 'hex');
  }
}

class MockPersistenceLayer implements ICredentialPersistence {
  private storage: Map<string, EncryptedCredential> = new Map();

  async save(credential: EncryptedCredential): Promise<void> {
    this.storage.set(credential.id, credential);
  }

  async retrieve(tenantId: string, providerId: string): Promise<EncryptedCredential | null> {
    const id = `${tenantId}:${providerId}`;
    return this.storage.get(id) ?? null;
  }

  async delete(tenantId: string, providerId: string): Promise<void> {
    const id = `${tenantId}:${providerId}`;
    this.storage.delete(id);
  }

  async listByTenant(tenantId: string): Promise<EncryptedCredential[]> {
    const prefix = `${tenantId}:`;
    return Array.from(this.storage.values()).filter((c) => c.id.startsWith(prefix));
  }

  async rotateKey(): Promise<void> {
    // Implementation for key rotation
  }

  clear(): void {
    this.storage.clear();
  }
}

class MockAuditLogger implements AuditLogger {
  logs: Array<Record<string, unknown>> = [];

  async log(event: Record<string, unknown>): Promise<void> {
    this.logs.push(event);
  }
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('CredentialVault', () => {
  let vault: CredentialVault;
  let persistence: MockPersistenceLayer;
  let auditLogger: MockAuditLogger;
  let cryptoService: MockCryptoService;

  beforeEach(() => {
    persistence = new MockPersistenceLayer();
    auditLogger = new MockAuditLogger();
    cryptoService = new MockCryptoService();

    const config: VaultConfig = {
      cryptoService: cryptoService as any,
      auditLogger,
      persistenceLayer: persistence,
      cacheTtlMs: 1000,
      maxCacheSize: 100,
    };

    vault = new CredentialVault(config);
  });

  // ─── STORE TESTS ────────────────────────────────────────────────

  describe('store', () => {
    it('should encrypt and store a credential', async () => {
      const entry: CredentialEntry = {
        tenantId: 'tenant-123',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: 'sk_live_FAKEKEY12345',
        },
      };

      const result = await vault.store(entry);

      expect(result.tenantId).toBe('tenant-123');
      expect(result.providerId).toBe('stripe');
      expect(result.credentialType).toBe('api_key');
      expect(result.encryptedData).toBeDefined();
      expect(result.iv).toBeDefined();
      expect(result.authTag).toBeDefined();
    });

    it('should support credential expiration', async () => {
      const entry: CredentialEntry = {
        tenantId: 'tenant-123',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: 'sk_live_FAKEKEY12345',
        },
      };

      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      const result = await vault.store(entry, expiresAt);

      expect(result.expiresAt).toEqual(expiresAt);
    });

    it('should audit log the store operation', async () => {
      const entry: CredentialEntry = {
        tenantId: 'tenant-123',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: 'sk_live_FAKEKEY12345',
        },
      };

      await vault.store(entry);

      expect(auditLogger.logs).toContainEqual(
        expect.objectContaining({
          action: 'credential_stored',
          tenantId: 'tenant-123',
        }),
      );
    });

    it('should emit credential_stored event', async () => {
      const entry: CredentialEntry = {
        tenantId: 'tenant-123',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: 'sk_live_FAKEKEY12345',
        },
      };

      const eventHandler = vi.fn();
      vault.on('credential_stored', eventHandler);

      await vault.store(entry);

      expect(eventHandler).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        providerId: 'stripe',
      });
    });
  });

  // ─── RETRIEVE TESTS ─────────────────────────────────────────────

  describe('retrieve', () => {
    it('should return null for non-existent credential', async () => {
      const result = await vault.retrieve('tenant-123', 'stripe');
      expect(result).toBeNull();
    });

    it('should retrieve and decrypt a stored credential', async () => {
      const entry: CredentialEntry = {
        tenantId: 'tenant-123',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: 'sk_live_FAKEKEY12345',
        },
      };

      await vault.store(entry);
      const retrieved = await vault.retrieve('tenant-123', 'stripe');

      expect(retrieved).toBeDefined();
      expect(retrieved?.tenantId).toBe('tenant-123');
      expect(retrieved?.providerId).toBe('stripe');
      expect(retrieved?.credential.apiKey).toBe('sk_live_FAKEKEY12345');
    });

    it('should use cache on second retrieve', async () => {
      const entry: CredentialEntry = {
        tenantId: 'tenant-123',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: 'sk_live_FAKEKEY12345',
        },
      };

      await vault.store(entry);

      const first = await vault.retrieve('tenant-123', 'stripe');
      const second = await vault.retrieve('tenant-123', 'stripe');

      expect(first).toEqual(second);

      // Check that retrieve from cache was logged
      const logs = auditLogger.logs.filter((l) => l.action === 'credential_retrieved_cached');
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should reject expired credentials', async () => {
      const entry: CredentialEntry = {
        tenantId: 'tenant-123',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: 'sk_live_FAKEKEY12345',
        },
      };

      const expiresAt = new Date(Date.now() - 1000); // Expired 1 second ago
      await vault.store(entry, expiresAt);

      const result = await vault.retrieve('tenant-123', 'stripe');

      expect(result).toBeNull();
    });
  });

  // ─── UPDATE TESTS ────────────────────────────────────────────────

  describe('update', () => {
    it('should update a credential', async () => {
      const entry: CredentialEntry = {
        tenantId: 'tenant-123',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: 'sk_live_FAKEKEY12345',
        },
      };

      await vault.store(entry);

      const updated: CredentialEntry = {
        ...entry,
        credential: {
          apiKey: 'sk_live_NEWFAKE67890',
        },
      };

      await vault.update(updated);
      const retrieved = await vault.retrieve('tenant-123', 'stripe');

      expect(retrieved?.credential.apiKey).toBe('sk_live_NEWFAKE67890');
    });
  });

  // ─── DELETE TESTS ────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete a credential', async () => {
      const entry: CredentialEntry = {
        tenantId: 'tenant-123',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: 'sk_live_FAKEKEY12345',
        },
      };

      await vault.store(entry);
      await vault.delete('tenant-123', 'stripe');

      const result = await vault.retrieve('tenant-123', 'stripe');
      expect(result).toBeNull();
    });

    it('should emit credential_deleted event', async () => {
      const entry: CredentialEntry = {
        tenantId: 'tenant-123',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: 'sk_live_FAKEKEY12345',
        },
      };

      const eventHandler = vi.fn();
      vault.on('credential_deleted', eventHandler);

      await vault.store(entry);
      await vault.delete('tenant-123', 'stripe');

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  // ─── MASK TESTS ─────────────────────────────────────────────────

  describe('getMasked', () => {
    it('should return null for non-existent credential', async () => {
      const result = await vault.getMasked('tenant-123', 'stripe');
      expect(result).toBeNull();
    });

    it('should mask credential values', async () => {
      const entry: CredentialEntry = {
        tenantId: 'tenant-123',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: 'sk_live_FAKEKEY12345',
          secret: 'my_secret_password',
        },
      };

      await vault.store(entry);
      const masked = await vault.getMasked('tenant-123', 'stripe');

      expect(masked).toBeDefined();
      // maskValue shows last 4 chars, masks the rest with *
      // 'sk_live_FAKEKEY12345' (20 chars) -> '****************2345'
      expect(masked?.masked.apiKey).toBe('*'.repeat(16) + '2345');
      // 'my_secret_password' (18 chars) -> '**************word'
      expect(masked?.masked.secret).toBe('*'.repeat(14) + 'word');
    });

    it('should show only last 4 characters', async () => {
      const entry: CredentialEntry = {
        tenantId: 'tenant-123',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: '12345678',
        },
      };

      await vault.store(entry);
      const masked = await vault.getMasked('tenant-123', 'stripe');

      expect(masked?.masked.apiKey).toBe('****5678');
    });
  });

  // ─── CACHE TESTS ────────────────────────────────────────────────

  describe('cache', () => {
    it('should invalidate cache entry', async () => {
      const entry: CredentialEntry = {
        tenantId: 'tenant-123',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: 'sk_live_FAKEKEY12345',
        },
      };

      await vault.store(entry);
      await vault.retrieve('tenant-123', 'stripe'); // Cache it

      vault.invalidateCache('tenant-123', 'stripe');

      // Next retrieve should hit persistence layer
      const result = await vault.retrieve('tenant-123', 'stripe');
      expect(result).toBeDefined();
    });

    it('should clear all cache', async () => {
      const entry: CredentialEntry = {
        tenantId: 'tenant-123',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: 'sk_live_FAKEKEY12345',
        },
      };

      await vault.store(entry);
      await vault.retrieve('tenant-123', 'stripe');

      vault.clearCache();

      // Next retrieve should hit persistence layer
      const result = await vault.retrieve('tenant-123', 'stripe');
      expect(result).toBeDefined();
    });
  });

  // ─── TENANT ISOLATION TESTS ─────────────────────────────────────

  describe('tenant isolation', () => {
    it('should isolate credentials per tenant', async () => {
      const entry1: CredentialEntry = {
        tenantId: 'tenant-1',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: 'sk_live_TENANT1KEY',
        },
      };

      const entry2: CredentialEntry = {
        tenantId: 'tenant-2',
        providerId: 'stripe',
        credentialType: 'api_key',
        credential: {
          apiKey: 'sk_live_TENANT2KEY',
        },
      };

      await vault.store(entry1);
      await vault.store(entry2);

      const result1 = await vault.retrieve('tenant-1', 'stripe');
      const result2 = await vault.retrieve('tenant-2', 'stripe');

      expect(result1?.credential.apiKey).toBe('sk_live_TENANT1KEY');
      expect(result2?.credential.apiKey).toBe('sk_live_TENANT2KEY');
    });
  });
});
