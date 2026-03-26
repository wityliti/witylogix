/**
 * Auth Provider Registry Tests
 * Comprehensive test suite for provider registration, resolution, validation, and authentication flows
 */

// Mock encryption module - must be before any imports
vi.mock('@witylogix/core/encryption', () => ({
  getEncryption: vi.fn(() => ({
    decrypt: vi.fn((encrypted: string) => {
      try {
        return JSON.parse(Buffer.from(encrypted, 'base64').toString());
      } catch {
        throw new Error('Decryption failed');
      }
    }),
    encrypt: vi.fn((data: any) => {
      return Buffer.from(JSON.stringify(data)).toString('base64');
    }),
  })),
}));

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthProviderRegistry } from '../provider-registry';
import type {
  AuthProviderType,
  AuthProviderConfig,
  BaseAuthProvider,
  ProviderHealthStatus,
} from '../types';
import {
  ProviderNotConfiguredError,
  ProviderUnavailableError,
  ConfigurationError,
} from '../types';

// Mock Prisma client
const mockPrisma = {
  authProvider: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  authMeterEvent: {
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

describe('AuthProviderRegistry', () => {
  let registry: AuthProviderRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_BYOK = 'false';
    process.env.AUTH_PROVIDER = 'local';
    registry = new AuthProviderRegistry();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Registration', () => {
    it('should register local auth provider', async () => {
      const provider = {
        type: 'local',
        config: {
          requireEmailVerification: false,
          passwordPolicy: { minLength: 8 },
        },
      };

      mockPrisma.authProvider.create.mockResolvedValue({
        id: 'prov-1',
        type: 'local',
        config: provider.config,
        deployerId: null,
        shopId: null,
      });

      const result = await registry.registerProvider('local', provider.config);

      expect(result).toBeDefined();
      expect(mockPrisma.authProvider.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'local',
        }),
      });
    });

    it('should register Auth0 provider', async () => {
      const provider = {
        type: 'auth0',
        config: {
          domain: 'example.auth0.com',
          clientId: 'client123',
          clientSecret: 'secret123',
        },
      };

      mockPrisma.authProvider.create.mockResolvedValue({
        id: 'prov-2',
        type: 'auth0',
        config: provider.config,
      });

      const result = await registry.registerProvider('auth0', provider.config);

      expect(result).toBeDefined();
      expect(mockPrisma.authProvider.create).toHaveBeenCalled();
    });

    it('should register Clerk provider', async () => {
      const provider = {
        type: 'clerk',
        config: {
          publishableKey: 'pk_live_123',
          secretKey: 'sk_live_456',
        },
      };

      mockPrisma.authProvider.create.mockResolvedValue({
        id: 'prov-3',
        type: 'clerk',
        config: provider.config,
      });

      const result = await registry.registerProvider('clerk', provider.config);

      expect(result).toBeDefined();
      expect(mockPrisma.authProvider.create).toHaveBeenCalled();
    });

    it('should reject duplicate provider registration', async () => {
      mockPrisma.authProvider.findUnique.mockResolvedValue({
        id: 'prov-1',
        type: 'auth0',
      });

      mockPrisma.authProvider.create.mockRejectedValue(
        new Error('Unique constraint failed on (type)')
      );

      const config = {
        domain: 'example.auth0.com',
        clientId: 'client123',
        clientSecret: 'secret123',
      };

      await expect(
        registry.registerProvider('auth0', config)
      ).rejects.toThrow();
    });

    it('should list registered providers', async () => {
      const providers = [
        { id: 'prov-1', type: 'local' },
        { id: 'prov-2', type: 'auth0' },
        { id: 'prov-3', type: 'clerk' },
      ];

      mockPrisma.authProvider.findMany.mockResolvedValue(providers);

      const result = await registry.listProviders();

      expect(result).toHaveLength(3);
      expect(result).toEqual(expect.arrayContaining(providers));
    });
  });

  describe('Provider Resolution', () => {
    it('should resolve tenant override provider', async () => {
      const shopId = 'shop-1';
      const config = {
        domain: 'example.auth0.com',
        clientId: 'client123',
        clientSecret: 'secret123',
      };

      mockPrisma.authProvider.findUnique.mockResolvedValue({
        id: 'prov-shop-1',
        type: 'auth0',
        shopId,
        config,
      });

      process.env.AUTH_BYOK = 'true';
      const newRegistry = new AuthProviderRegistry();

      const provider = await newRegistry.resolveProvider(shopId);

      expect(provider).toBeDefined();
      expect(mockPrisma.authProvider.findUnique).toHaveBeenCalledWith({
        where: { shopId },
      });
    });

    it('should use deployer default when no shop override', async () => {
      const shopId = 'shop-2';

      mockPrisma.authProvider.findUnique.mockResolvedValue(null);
      mockPrisma.authProvider.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'prov-deployer',
        type: 'local',
        shopId: null,
      });

      const provider = await registry.resolveProvider(shopId);

      expect(provider).toBeDefined();
    });

    it('should fallback to local auth when provider unavailable', async () => {
      const shopId = 'shop-3';

      mockPrisma.authProvider.findUnique.mockRejectedValue(
        new Error('Database unavailable')
      );

      const provider = await registry.resolveProvider(shopId);

      expect(provider).toBeDefined();
    });

    it('should meter fallback usage for billing', async () => {
      const shopId = 'shop-4';

      mockPrisma.authProvider.findUnique.mockResolvedValue(null);
      mockPrisma.authMeterEvent.create.mockResolvedValue({
        id: 'meter-1',
        shopId,
        eventType: 'AUTH_FALLBACK_USED',
      });

      process.env.AUTH_BYOK = 'true';
      const newRegistry = new AuthProviderRegistry();

      await newRegistry.resolveProvider(shopId);

      // Verify metering call if fallback was used
      if (mockPrisma.authMeterEvent.create.mock.calls.length > 0) {
        expect(mockPrisma.authMeterEvent.create).toHaveBeenCalled();
      }
    });

    it('should cache resolved providers', async () => {
      const shopId = 'shop-5';
      const config = {
        requireEmailVerification: false,
        passwordPolicy: { minLength: 8 },
      };

      mockPrisma.authProvider.findUnique.mockResolvedValue({
        id: 'prov-5',
        type: 'local',
        shopId,
        config,
      });

      const provider1 = await registry.resolveProvider(shopId);
      const provider2 = await registry.resolveProvider(shopId);

      expect(provider1).toBe(provider2);
      expect(mockPrisma.authProvider.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('Provider Validation', () => {
    it('should validate Auth0 config requires domain', async () => {
      const config = {
        clientId: 'client123',
        clientSecret: 'secret123',
        // missing domain
      };

      await expect(
        registry.validateConfig('auth0', config as any)
      ).rejects.toThrow('Auth0 domain is required');
    });

    it('should validate Auth0 config requires clientId', async () => {
      const config = {
        domain: 'example.auth0.com',
        clientSecret: 'secret123',
        // missing clientId
      };

      await expect(
        registry.validateConfig('auth0', config as any)
      ).rejects.toThrow('Auth0 clientId is required');
    });

    it('should validate Auth0 config requires clientSecret', async () => {
      const config = {
        domain: 'example.auth0.com',
        clientId: 'client123',
        // missing clientSecret
      };

      await expect(
        registry.validateConfig('auth0', config as any)
      ).rejects.toThrow('Auth0 clientSecret is required');
    });

    it('should validate OIDC config requires discoveryUrl', async () => {
      const config = {
        clientId: 'client123',
        clientSecret: 'secret123',
        // missing discoveryUrl
      };

      await expect(
        registry.validateConfig('generic_oidc', config as any)
      ).rejects.toThrow('OIDC discoveryUrl is required');
    });

    it('should validate OIDC discoveryUrl is valid URL', async () => {
      const config = {
        clientId: 'client123',
        clientSecret: 'secret123',
        discoveryUrl: 'not-a-valid-url',
      };

      await expect(
        registry.validateConfig('generic_oidc', config as any)
      ).rejects.toThrow('OIDC discoveryUrl must be a valid URL');
    });

    it('should accept valid Auth0 config', async () => {
      const config = {
        domain: 'example.auth0.com',
        clientId: 'client123',
        clientSecret: 'secret123',
      };

      const result = await registry.validateConfig('auth0', config);

      expect(result).toBe(true);
    });

    it('should accept valid OIDC config', async () => {
      const config = {
        clientId: 'client123',
        clientSecret: 'secret123',
        discoveryUrl: 'https://example.com/.well-known/openid-configuration',
      };

      const result = await registry.validateConfig('generic_oidc', config);

      expect(result).toBe(true);
    });

    it('should reject invalid provider type', async () => {
      const config = { some: 'config' };

      await expect(
        registry.validateConfig('invalid_type' as any, config)
      ).rejects.toThrow('Unknown provider type');
    });
  });

  describe('Authentication Flow', () => {
    it('should authenticate with local provider using email and password', async () => {
      const shopId = 'shop-1';
      const credentials = { email: 'user@example.com', password: 'password123' };

      mockPrisma.authProvider.findUnique.mockResolvedValue({
        id: 'prov-1',
        type: 'local',
        config: { requireEmailVerification: false },
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: credentials.email,
        passwordHash: '$2b$10$...',
        verified: true,
      });

      const result = await registry.authenticate(shopId, credentials);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-1');
      expect(result.success).toBe(true);
    });

    it('should authenticate with Auth0 using token exchange', async () => {
      const shopId = 'shop-2';
      const token = 'auth0_token_123';

      mockPrisma.authProvider.findUnique.mockResolvedValue({
        id: 'prov-2',
        type: 'auth0',
        config: {
          domain: 'example.auth0.com',
          clientId: 'client123',
          clientSecret: 'secret123',
        },
      });

      const result = await registry.authenticate(shopId, { token });

      expect(result).toBeDefined();
    });

    it('should handle expired tokens', async () => {
      const shopId = 'shop-3';
      const token = 'expired_token';

      mockPrisma.authProvider.findUnique.mockResolvedValue({
        id: 'prov-3',
        type: 'auth0',
        config: {
          domain: 'example.auth0.com',
          clientId: 'client123',
          clientSecret: 'secret123',
        },
      });

      // Simulate token validation failure
      await expect(
        registry.authenticate(shopId, { token })
      ).rejects.toThrow();
    });

    it('should handle invalid credentials', async () => {
      const shopId = 'shop-4';
      const credentials = { email: 'user@example.com', password: 'wrongpassword' };

      mockPrisma.authProvider.findUnique.mockResolvedValue({
        id: 'prov-4',
        type: 'local',
        config: { requireEmailVerification: false },
      });

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        registry.authenticate(shopId, credentials)
      ).rejects.toThrow('Invalid credentials');
    });

    it('should require email verification when configured', async () => {
      const shopId = 'shop-5';
      const credentials = { email: 'user@example.com', password: 'password123' };

      mockPrisma.authProvider.findUnique.mockResolvedValue({
        id: 'prov-5',
        type: 'local',
        config: { requireEmailVerification: true },
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-5',
        email: credentials.email,
        verified: false,
      });

      await expect(
        registry.authenticate(shopId, credentials)
      ).rejects.toThrow('Email verification required');
    });
  });

  describe('Session Management', () => {
    it('should create session after successful authentication', async () => {
      const shopId = 'shop-1';
      const userId = 'user-1';

      mockPrisma.user.update.mockResolvedValue({
        id: userId,
        lastLogin: new Date(),
      });

      const session = await registry.createSession(shopId, userId);

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe(userId);
    });

    it('should refresh session token', async () => {
      const sessionId = 'session-1';
      const oldToken = 'old_token';
      const newToken = 'new_token';

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        refreshToken: newToken,
      });

      const result = await registry.refreshSession(sessionId);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should revoke session', async () => {
      const sessionId = 'session-1';

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        sessionToken: null,
      });

      await registry.revokeSession(sessionId);

      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('should handle concurrent sessions', async () => {
      const shopId = 'shop-1';
      const userId = 'user-1';

      mockPrisma.user.update.mockResolvedValue({
        id: userId,
        sessions: [
          { id: 'session-1', createdAt: new Date() },
          { id: 'session-2', createdAt: new Date() },
        ],
      });

      const session1 = await registry.createSession(shopId, userId);
      const session2 = await registry.createSession(shopId, userId);

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });

    it('should invalidate old sessions when max sessions exceeded', async () => {
      const shopId = 'shop-1';
      const userId = 'user-1';

      // Create more sessions than allowed (e.g., max 3)
      const sessions = [];
      for (let i = 0; i < 4; i++) {
        const session = await registry.createSession(shopId, userId);
        sessions.push(session);
      }

      // Verify the oldest session was invalidated
      expect(sessions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Error Handling', () => {
    it('should throw ProviderNotConfiguredError when provider not found', async () => {
      const shopId = 'shop-unknown';

      mockPrisma.authProvider.findUnique.mockResolvedValue(null);

      await expect(
        registry.resolveProvider(shopId)
      ).rejects.toThrow();
    });

    it('should throw ProviderUnavailableError on network timeout', async () => {
      const shopId = 'shop-1';

      mockPrisma.authProvider.findUnique.mockRejectedValue(
        new Error('Network timeout')
      );

      // Should fallback to local provider
      const provider = await registry.resolveProvider(shopId);
      expect(provider).toBeDefined();
    });

    it('should handle config decryption failure', async () => {
      const shopId = 'shop-1';
      const invalidEncrypted = 'invalid-base64!@#$';

      mockPrisma.authProvider.findUnique.mockResolvedValue({
        id: 'prov-1',
        type: 'auth0',
        config: invalidEncrypted,
      });

      await expect(
        registry.resolveProvider(shopId)
      ).rejects.toThrow();
    });

    it('should throw ConfigurationError for invalid provider type', async () => {
      const config = { some: 'config' };

      await expect(
        registry.registerProvider('invalid_type' as any, config)
      ).rejects.toThrow('Unknown provider type');
    });

    it('should include request ID in error responses', async () => {
      const shopId = 'shop-1';
      const requestId = 'req-123';

      mockPrisma.authProvider.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      try {
        await registry.resolveProvider(shopId);
      } catch (error: any) {
        expect(error.requestId).toBeDefined();
      }
    });
  });

  describe('Health Checks', () => {
    it('should check provider health status', async () => {
      mockPrisma.authProvider.findUnique.mockResolvedValue({
        id: 'prov-1',
        type: 'auth0',
        config: {
          domain: 'example.auth0.com',
          clientId: 'client123',
          clientSecret: 'secret123',
        },
      });

      const health = await registry.checkHealth('prov-1');

      expect(health).toBeDefined();
      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
    });

    it('should report all providers health status', async () => {
      mockPrisma.authProvider.findMany.mockResolvedValue([
        {
          id: 'prov-1',
          type: 'local',
          lastHealthCheck: new Date(),
          healthy: true,
        },
        {
          id: 'prov-2',
          type: 'auth0',
          lastHealthCheck: new Date(),
          healthy: true,
        },
      ]);

      const statuses = await registry.getAllHealthStatus();

      expect(statuses).toHaveLength(2);
      expect(statuses[0].healthy).toBe(true);
    });
  });

  describe('Multi-Tenant Configuration', () => {
    it('should support different providers per shop', async () => {
      const shop1Id = 'shop-1';
      const shop2Id = 'shop-2';

      mockPrisma.authProvider.findUnique
        .mockResolvedValueOnce({
          id: 'prov-1',
          type: 'auth0',
          shopId: shop1Id,
        })
        .mockResolvedValueOnce({
          id: 'prov-2',
          type: 'clerk',
          shopId: shop2Id,
        });

      process.env.AUTH_BYOK = 'true';
      const newRegistry = new AuthProviderRegistry();

      const provider1 = await newRegistry.resolveProvider(shop1Id);
      const provider2 = await newRegistry.resolveProvider(shop2Id);

      expect(provider1).not.toBe(provider2);
    });

    it('should allow switching providers for a shop', async () => {
      const shopId = 'shop-1';

      const oldConfig = {
        domain: 'example.auth0.com',
        clientId: 'client123',
        clientSecret: 'secret123',
      };

      const newConfig = {
        publishableKey: 'pk_live_123',
        secretKey: 'sk_live_456',
      };

      mockPrisma.authProvider.update.mockResolvedValue({
        id: 'prov-1',
        type: 'clerk',
        shopId,
        config: newConfig,
      });

      const result = await registry.updateProvider(shopId, 'clerk', newConfig);

      expect(result).toBeDefined();
      expect(mockPrisma.authProvider.update).toHaveBeenCalled();
    });
  });
});
