/**
 * Credential Vault — AES-256-GCM encryption for provider credentials at rest
 *
 * Features:
 * - Per-tenant credential isolation using composite key (tenantId + providerId)
 * - AES-256-GCM encryption for all credentials
 * - Key rotation support with automatic re-encryption
 * - CRUD operations: store, retrieve, update, delete
 * - Credential masking for safe display (show last 4 chars)
 * - TTL-based in-memory cache with invalidation
 * - Comprehensive audit logging for all credential access
 *
 * Credentials are stored with structure:
 *   EncryptedCredential {
 *     tenantId, providerId, credentialType
 *     encryptedData, iv, authTag
 *     encryptedAt, expiresAt
 *     keyVersion
 *   }
 */

import { EventEmitter } from "events";
import type { CryptoService } from "../../encryption/crypto.js";
import type { AuditLogger } from "../../audit/logger.js";
import type { EncryptedPayload } from "../../encryption/types.js";

// ─── Types ──────────────────────────────────────────────────────────

/**
 * Credential entry stored in vault (plaintext before encryption)
 */
export interface CredentialEntry {
  /** Tenant identifier for isolation */
  tenantId: string;
  /** Provider slug (e.g., 'stripe', 'shopify') */
  providerId: string;
  /** Type of credential (e.g., 'api_key', 'oauth_token') */
  credentialType: "api_key" | "oauth_token" | "webhook_secret" | "custom";
  /** The actual credential data */
  credential: Record<string, string>;
  /** Optional metadata (e.g., environment, region) */
  metadata?: Record<string, unknown>;
}

/**
 * Encrypted credential stored in persistence layer
 */
export interface EncryptedCredential {
  /** Unique identifier (composite key: tenantId-providerId) */
  id: string;
  /** Tenant identifier */
  tenantId: string;
  /** Provider slug */
  providerId: string;
  /** Type of credential */
  credentialType: "api_key" | "oauth_token" | "webhook_secret" | "custom";
  /** Encrypted credential data (base64) */
  encryptedData: string;
  /** Initialization vector (base64) */
  iv: string;
  /** GCM authentication tag (base64) */
  authTag: string;
  /** Which key version was used for encryption */
  keyVersion: string;
  /** When the credential was encrypted */
  encryptedAt: Date;
  /** TTL expiration (null = never expires) */
  expiresAt: Date | null;
  /** Optional metadata (NOT encrypted) */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for the credential vault
 */
export interface VaultConfig {
  /** Crypto service for encryption/decryption */
  cryptoService: CryptoService;
  /** Optional audit logger for compliance tracking */
  auditLogger?: AuditLogger;
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;
  /** Maximum number of credentials to cache (default: 1000) */
  maxCacheSize?: number;
  /** Persistence layer (DB, Redis, etc.) */
  persistenceLayer: ICredentialPersistence;
}

/**
 * Persistence layer interface (abstracted for DB/Redis/etc.)
 */
export interface ICredentialPersistence {
  save(credential: EncryptedCredential): Promise<void>;
  retrieve(
    tenantId: string,
    providerId: string,
  ): Promise<EncryptedCredential | null>;
  delete(tenantId: string, providerId: string): Promise<void>;
  listByTenant(tenantId: string): Promise<EncryptedCredential[]>;
  rotateKey(oldKeyVersion: string, newKeyVersion: string): Promise<void>;
}

/**
 * Masked credential for safe display (audit logs, UI)
 */
export interface MaskedCredential {
  tenantId: string;
  providerId: string;
  credentialType: "api_key" | "oauth_token" | "webhook_secret" | "custom";
  /** Only the last 4 characters visible, rest masked */
  masked: Record<string, string>;
  encryptedAt: Date;
  expiresAt: Date | null;
}

// ─── Constants ───────────────────────────────────────────────────────

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_CACHE_SIZE = 1000;

// ─── Credential Vault ────────────────────────────────────────────────

export class CredentialVault extends EventEmitter {
  private cryptoService: CryptoService;
  private auditLogger?: AuditLogger;
  private persistenceLayer: ICredentialPersistence;
  private cache: Map<
    string,
    { credential: EncryptedCredential; expiry: number }
  >;
  private cacheTtlMs: number;
  private maxCacheSize: number;

  constructor(config: VaultConfig) {
    super();
    this.cryptoService = config.cryptoService;
    this.auditLogger = config.auditLogger;
    this.persistenceLayer = config.persistenceLayer;
    this.cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxCacheSize = config.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
    this.cache = new Map();
  }

  /**
   * Store a new credential (encrypted at rest)
   */
  async store(
    entry: CredentialEntry,
    expiresAt?: Date,
  ): Promise<EncryptedCredential> {
    const id = this.computeCredentialId(entry.tenantId, entry.providerId);

    // Serialize credential data
    const plaintext = JSON.stringify(entry.credential);

    // Encrypt the credential using the crypto service
    const payload = this.cryptoService.encrypt(plaintext);

    const encryptedCredential: EncryptedCredential = {
      id,
      tenantId: entry.tenantId,
      providerId: entry.providerId,
      credentialType: entry.credentialType,
      encryptedData: payload.data,
      iv: payload.iv,
      authTag: payload.authTag ?? "",
      keyVersion: payload.keyId ?? this.cryptoService.getActiveKeyId(),
      encryptedAt: new Date(),
      expiresAt: expiresAt ?? null,
      metadata: entry.metadata,
    };

    // Persist encrypted credential
    await this.persistenceLayer.save(encryptedCredential);

    // Invalidate cache
    this.cache.delete(id);

    // Audit log
    await this.auditLog("credential_stored", entry.tenantId, entry.providerId, {
      credentialType: entry.credentialType,
      expiresAt: expiresAt?.toISOString(),
    });

    this.emit("credential_stored", {
      tenantId: entry.tenantId,
      providerId: entry.providerId,
    });

    return encryptedCredential;
  }

  /**
   * Retrieve a stored credential (decrypted in-memory)
   */
  async retrieve(
    tenantId: string,
    providerId: string,
  ): Promise<CredentialEntry | null> {
    const id = this.computeCredentialId(tenantId, providerId);

    // Check cache first
    const cached = this.getCachedCredential(id);
    if (cached) {
      await this.auditLog("credential_retrieved_cached", tenantId, providerId);
      return this.decryptCredentialEntry(cached);
    }

    // Fetch from persistence
    const encryptedCredential = await this.persistenceLayer.retrieve(
      tenantId,
      providerId,
    );
    if (!encryptedCredential) {
      return null;
    }

    // Check expiration
    if (
      encryptedCredential.expiresAt &&
      encryptedCredential.expiresAt < new Date()
    ) {
      await this.auditLog("credential_expired", tenantId, providerId);
      return null;
    }

    // Cache it
    this.setCachedCredential(id, encryptedCredential);

    // Audit log
    await this.auditLog("credential_retrieved", tenantId, providerId);

    // Decrypt and return
    return this.decryptCredentialEntry(encryptedCredential);
  }

  /**
   * Update a credential (re-encrypt with current key)
   */
  async update(
    entry: CredentialEntry,
    expiresAt?: Date,
  ): Promise<EncryptedCredential> {
    // Delete old credential
    await this.delete(entry.tenantId, entry.providerId);

    // Store new credential
    return this.store(entry, expiresAt);
  }

  /**
   * Delete a credential from vault
   */
  async delete(tenantId: string, providerId: string): Promise<void> {
    const id = this.computeCredentialId(tenantId, providerId);

    await this.persistenceLayer.delete(tenantId, providerId);
    this.cache.delete(id);

    await this.auditLog("credential_deleted", tenantId, providerId);
    this.emit("credential_deleted", { tenantId, providerId });
  }

  /**
   * Get a masked version of credential for display (audit logs, UI)
   */
  async getMasked(
    tenantId: string,
    providerId: string,
  ): Promise<MaskedCredential | null> {
    const entry = await this.retrieve(tenantId, providerId);
    if (!entry) return null;

    const encryptedCredential = await this.persistenceLayer.retrieve(
      tenantId,
      providerId,
    );
    if (!encryptedCredential) return null;

    // Mask each credential field
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(entry.credential)) {
      masked[key] = this.maskValue(value);
    }

    return {
      tenantId: entry.tenantId,
      providerId: entry.providerId,
      credentialType: entry.credentialType,
      masked,
      encryptedAt: encryptedCredential.encryptedAt,
      expiresAt: encryptedCredential.expiresAt,
    };
  }

  /**
   * Rotate encryption keys and re-encrypt all credentials
   * Used when master key changes
   */
  async rotateKeys(
    oldKeyVersion: string,
    newKeyVersion: string,
  ): Promise<void> {
    // Fetch all credentials encrypted with old key
    const allCredentials = await this.persistenceLayer.listByTenant("*"); // Implementation-specific

    for (const encryptedCredential of allCredentials) {
      if (encryptedCredential.keyVersion !== oldKeyVersion) {
        continue;
      }

      // Decrypt with old key
      const decrypted = await this.decryptData(
        encryptedCredential.encryptedData,
        encryptedCredential.iv,
        encryptedCredential.authTag,
        oldKeyVersion,
      );

      // Re-encrypt with new key via the crypto service
      const reEncrypted = this.cryptoService.encrypt(decrypted, newKeyVersion);

      // Update credential with new encryption
      encryptedCredential.encryptedData = reEncrypted.data;
      encryptedCredential.iv = reEncrypted.iv;
      encryptedCredential.authTag = reEncrypted.authTag ?? "";
      encryptedCredential.keyVersion = newKeyVersion;

      await this.persistenceLayer.save(encryptedCredential);
    }

    // Notify persistence layer of key rotation
    await this.persistenceLayer.rotateKey(oldKeyVersion, newKeyVersion);

    // Clear cache
    this.cache.clear();

    await this.auditLog("keys_rotated", "system", "system", {
      oldKeyVersion,
      newKeyVersion,
    });

    this.emit("keys_rotated", { oldKeyVersion, newKeyVersion });
  }

  /**
   * Invalidate cache entry
   */
  invalidateCache(tenantId: string, providerId: string): void {
    const id = this.computeCredentialId(tenantId, providerId);
    this.cache.delete(id);
  }

  /**
   * Clear all cached credentials
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ─── Private Methods ────────────────────────────────────────────

  private computeCredentialId(tenantId: string, providerId: string): string {
    return `${tenantId}:${providerId}`;
  }

  private getCachedCredential(id: string): EncryptedCredential | null {
    const cached = this.cache.get(id);
    if (!cached) return null;

    // Check if expired
    if (cached.expiry < Date.now()) {
      this.cache.delete(id);
      return null;
    }

    return cached.credential;
  }

  private setCachedCredential(
    id: string,
    credential: EncryptedCredential,
  ): void {
    // Evict oldest if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(id, {
      credential,
      expiry: Date.now() + this.cacheTtlMs,
    });
  }

  private async decryptCredentialEntry(
    encryptedCredential: EncryptedCredential,
  ): Promise<CredentialEntry> {
    const decryptedData = await this.decryptData(
      encryptedCredential.encryptedData,
      encryptedCredential.iv,
      encryptedCredential.authTag,
      encryptedCredential.keyVersion,
    );

    const credential = JSON.parse(decryptedData) as Record<string, string>;

    return {
      tenantId: encryptedCredential.tenantId,
      providerId: encryptedCredential.providerId,
      credentialType: encryptedCredential.credentialType,
      credential,
      metadata: encryptedCredential.metadata,
    };
  }

  private async decryptData(
    encryptedData: string,
    iv: string,
    authTag: string,
    keyVersion: string,
  ): Promise<string> {
    const payload: EncryptedPayload = {
      algorithm: "aes-256-gcm",
      iv,
      authTag,
      data: encryptedData,
      keyId: keyVersion,
    };
    return this.cryptoService.decrypt(payload);
  }

  private maskValue(value: string): string {
    if (value.length <= 4) {
      return "*".repeat(value.length);
    }
    return "*".repeat(value.length - 4) + value.slice(-4);
  }

  private async auditLog(
    action: string,
    tenantId: string,
    providerId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.auditLogger) return;

    await this.auditLogger.log({
      tenantId,
      action,
      resource: "credential_vault",
      resourceId: providerId,
      metadata: {
        providerId,
        ...metadata,
      },
      timestamp: new Date(),
    });
  }
}

/**
 * Vault event types for monitoring
 */
export type VaultEvent =
  | "credential_stored"
  | "credential_deleted"
  | "credential_retrieved_cached"
  | "keys_rotated";
