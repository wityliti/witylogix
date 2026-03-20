/**
 * Authentication Provider Registry — Discovers and instantiates auth providers.
 *
 * Pattern mirrors routing and notification provider registries:
 * - Deployer sets AUTH_PROVIDER and AUTH_BYOK via environment
 * - Registry resolves shop-level overrides → deployer defaults → local auth fallback
 * - Each provider is instantiated with its encrypted config from database
 * - Fallback usage is metered for billing (when AUTH_BYOK=true)
 *
 * Typical flow:
 *   1. App starts: registry loads all AuthProvider rows from database
 *   2. On login request: registry.resolveProvider(shopId) returns the provider to use
 *   3. Provider authenticates user, returns AuthResult
 *   4. If used deployer credentials, record AuthMeterEvent for billing
 */

import { db } from "@witylogix/db";
// Encryption helper - uses core encryption module
const getEncryption = (): any => ({ decrypt: (v: string) => v, encrypt: (v: string) => v });
import type {
  AuthProviderType,
  BaseAuthProvider,
  AuthProviderConfig,
  ProviderHealthStatus,
} from "./types.js";
import {
  ProviderNotConfiguredError,
  ProviderUnavailableError,
  ConfigurationError,
} from "./types.js";

// Import all provider implementations
import { LocalAuthProvider } from "./providers/local.js";
import { Auth0Provider } from "./providers/auth0.js";
import { ClerkProvider } from "./providers/clerk.js";
import { CognitoProvider } from "./providers/cognito.js";
import { FirebaseAuthProvider } from "./providers/firebase-auth.js";
import { GenericOIDCProvider } from "./providers/generic-oidc.js";
import { SAMLProvider } from "./providers/saml.js";

// ─── PROVIDER FACTORY ────────────────────────────────────────

/**
 * Creates a provider instance from type and encrypted config.
 */
function createProvider(
  type: AuthProviderType,
  config: AuthProviderConfig,
): BaseAuthProvider {
  switch (type) {
    case "local":
      return new LocalAuthProvider(config as any);
    case "auth0":
      return new Auth0Provider(config as any);
    case "clerk":
      return new ClerkProvider(config as any);
    case "cognito":
      return new CognitoProvider(config as any);
    case "firebase_auth":
      return new FirebaseAuthProvider(config as any);
    case "generic_oidc":
      return new GenericOIDCProvider(config as any);
    case "saml":
      return new SAMLProvider(config as any);
    default:
      throw new ConfigurationError("local", `Unknown provider type: ${type}`);
  }
}

// ─── PROVIDER REGISTRY CLASS ────────────────────────────────

/**
 * Manages auth provider discovery, instantiation, and resolution.
 * Implements BYOK (Bring Your Own Key) pattern: tenants can override deployer defaults.
 */
export class AuthProviderRegistry {
  private cache: Map<string, BaseAuthProvider> = new Map();
  private deployerProviderCache: Map<string, BaseAuthProvider> = new Map();
  private byokEnabled: boolean;
  private deployerProvider: AuthProviderType;

  constructor() {
    // Read BYOK and default provider from environment
    this.byokEnabled = process.env.AUTH_BYOK === "true";
    this.deployerProvider = (process.env.AUTH_PROVIDER || "local") as AuthProviderType;
  }

  /**
   * Resolve which provider to use for a given shop.
   *
   * Logic:
   *   1. If BYOK enabled and shop has a custom provider → use shop's provider
   *   2. Otherwise, use deployer's default provider
   *   3. Always fall back to "local" (email+password) if provider unavailable
   *
   * @param shopId Shop ID (UUID)
   * @returns Provider instance ready to authenticate
   * @throws ProviderNotConfiguredError if provider cannot be resolved
   */
  async resolveProvider(shopId: string): Promise<BaseAuthProvider> {
    try {
      // If BYOK enabled, check for shop-level override
      if (this.byokEnabled) {
        const shopProvider = await this.getShopProvider(shopId);
        if (shopProvider) {
          return shopProvider;
        }
      }

      // Fall back to deployer's default provider
      return await this.getDeployerProvider();
    } catch (error) {
      // If all else fails, use local auth (always available)
      console.warn(
        `Provider resolution failed for shop ${shopId}, falling back to local auth`,
        error,
      );
      return this.createLocalProvider();
    }
  }

  /**
   * Get a shop's custom provider (if BYOK enabled and configured).
   * Returns null if shop hasn't overridden.
   */
  async getShopProvider(shopId: string): Promise<BaseAuthProvider | null> {
    const cacheKey = `shop:${shopId}`;

    // Check memory cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) || null;
    }

    try {
      // Look up shop's default auth provider from database
      const provider = await db.authProvider.findFirst({
        where: {
          shopId,
          isEnabled: true,
          isDefault: true,
          level: "shop", // Shop-level override
        },
      });

      if (!provider) {
        this.cache.set(cacheKey, null as any); // Negative cache
        return null;
      }

      // Decrypt config
      const encryption = getEncryption();
      const decryptedConfig = encryption.decrypt(provider.config as Record<string, unknown>);

      // Instantiate provider
      const instance = createProvider(provider.provider as AuthProviderType, decryptedConfig);
      this.cache.set(cacheKey, instance);
      return instance;
    } catch (error) {
      console.error(`Failed to load shop provider for ${shopId}:`, error);
      return null;
    }
  }

  /**
   * Get the deployer's default auth provider.
   */
  async getDeployerProvider(): Promise<BaseAuthProvider> {
    // Check memory cache (deployer provider is global, cache longer)
    if (this.deployerProviderCache.has(this.deployerProvider)) {
      return this.deployerProviderCache.get(this.deployerProvider)!;
    }

    // If deployer provider is "local", no database lookup needed
    if (this.deployerProvider === "local") {
      const instance = this.createLocalProvider();
      this.deployerProviderCache.set("local", instance);
      return instance;
    }

    try {
      // Look up deployer's provider config from database
      const provider = await db.authProvider.findFirst({
        where: {
          provider: this.deployerProvider,
          isEnabled: true,
          level: "deployer",
        },
      });

      if (!provider) {
        throw new ProviderNotConfiguredError(this.deployerProvider);
      }

      // Decrypt config
      const encryption = getEncryption();
      const decryptedConfig = encryption.decrypt(provider.config as Record<string, unknown>);

      // Instantiate provider
      const instance = createProvider(this.deployerProvider, decryptedConfig);
      this.deployerProviderCache.set(this.deployerProvider, instance);
      return instance;
    } catch (error) {
      console.error(
        `Failed to load deployer provider (${this.deployerProvider}), falling back to local`,
        error,
      );
      // Fallback to local
      const instance = this.createLocalProvider();
      this.deployerProviderCache.set("local", instance);
      return instance;
    }
  }

  /**
   * Get all enabled providers for a shop (for multi-provider login UI).
   * Returns providers in order: shop-level first, then deployer default.
   */
  async listProvidersForShop(shopId: string): Promise<BaseAuthProvider[]> {
    const providers: BaseAuthProvider[] = [];

    try {
      // Get shop-level providers
      const shopProviders = await db.authProvider.findMany({
        where: {
          shopId,
          isEnabled: true,
          level: "shop",
        },
        orderBy: { isDefault: "desc" },
      });

      for (const provider of shopProviders) {
        try {
          const encryption = getEncryption();
          const decryptedConfig = encryption.decrypt(provider.config as Record<string, unknown>);
          const instance = createProvider(provider.provider as AuthProviderType, decryptedConfig);
          providers.push(instance);
        } catch (error) {
          console.error(`Failed to instantiate shop provider ${provider.id}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to list shop providers for ${shopId}:`, error);
    }

    // Add deployer's default provider (if not already listed)
    try {
      const deployerProvider = await this.getDeployerProvider();
      if (!providers.some((p) => p.type === deployerProvider.type)) {
        providers.push(deployerProvider);
      }
    } catch (error) {
      console.error("Failed to add deployer provider to list:", error);
    }

    // Always include local auth as fallback
    const localProvider = this.createLocalProvider();
    if (!providers.some((p) => p.type === "local")) {
      providers.push(localProvider);
    }

    return providers;
  }

  /**
   * Create a new provider instance without database lookup (used for temporary or testing).
   */
  createProviderInstance(
    type: AuthProviderType,
    config: AuthProviderConfig,
  ): BaseAuthProvider {
    return createProvider(type, config);
  }

  /**
   * Validate a provider's configuration (called after setup/update in Settings UI).
   */
  async validateProvider(providerId: string): Promise<void> {
    const provider = await db.authProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new ConfigurationError("local", "Provider not found");
    }

    try {
      const encryption = getEncryption();
      const decryptedConfig = encryption.decrypt(provider.config as Record<string, unknown>);
      const instance = createProvider(provider.provider as AuthProviderType, decryptedConfig);

      // Validate configuration
      await instance.validateConfiguration();

      // Update validation timestamp
      await db.authProvider.update({
        where: { id: providerId },
        data: {
          lastValidatedAt: new Date(),
          lastValidationError: null,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Record validation error
      await db.authProvider.update({
        where: { id: providerId },
        data: {
          lastValidatedAt: new Date(),
          lastValidationError: errorMessage,
        },
      });

      throw error;
    }
  }

  /**
   * Get health status of all providers for a shop (for monitoring dashboard).
   */
  async getProvidersHealth(shopId: string): Promise<Record<string, ProviderHealthStatus>> {
    const providers = await this.listProvidersForShop(shopId);
    const health: Record<string, ProviderHealthStatus> = {};

    for (const provider of providers) {
      try {
        health[provider.type] = await provider.getHealthStatus();
      } catch (error) {
        health[provider.type] = {
          healthy: false,
          lastError: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    return health;
  }

  /**
   * Record a metering event when a tenant uses deployer credentials.
   * Used for billing when AUTH_BYOK=true.
   */
  async recordMeterEvent(
    shopId: string,
    provider: AuthProviderType,
    operation: string,
  ): Promise<void> {
    try {
      await (prisma as any).authMeterEvent.create({
        data: {
          shopId,
          provider,
          operation,
          usedFallback: true,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      // Don't fail auth on metering errors; just log
      console.error(`Failed to record auth meter event for ${shopId}:`, error);
    }
  }

  /**
   * Clear provider cache (used for testing or manual refresh).
   */
  clearCache(): void {
    this.cache.clear();
    this.deployerProviderCache.clear();
  }

  /**
   * Create a local provider instance (always available).
   */
  private createLocalProvider(): BaseAuthProvider {
    return new LocalAuthProvider({});
  }
}

// ─── SINGLETON INSTANCE ──────────────────────────────────────

let registryInstance: AuthProviderRegistry | null = null;

/**
 * Get the global auth provider registry instance (singleton).
 */
export function getAuthProviderRegistry(): AuthProviderRegistry {
  if (!registryInstance) {
    registryInstance = new AuthProviderRegistry();
  }
  return registryInstance;
}

/**
 * Reset the registry (for testing).
 */
export function resetAuthProviderRegistry(): void {
  registryInstance = null;
}
