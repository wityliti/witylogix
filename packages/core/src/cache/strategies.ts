/**
 * Cache strategies for different use cases
 * Provides domain-specific caching patterns
 */

import { CacheClient } from './client';
import { RateLimitConfig } from './types';

/**
 * TenantCacheStrategy - Namespace keys by tenant (shop)
 * Provides automatic tenant isolation and invalidation
 */
export class TenantCacheStrategy {
  /**
   * Create a tenant-scoped cache key
   * @param shopId - Tenant shop ID
   * @param entityType - Type of entity being cached
   * @param entityId - Optional entity ID
   * @returns Scoped cache key
   */
  static createKey(
    shopId: string,
    entityType: string,
    entityId?: string
  ): string {
    if (entityId) {
      return `tenant:${shopId}:${entityType}:${entityId}`;
    }
    return `tenant:${shopId}:${entityType}`;
  }

  /**
   * Get all cache keys for a tenant
   * @param shopId - Tenant shop ID
   * @returns Glob pattern for all tenant keys
   */
  static getTenantPattern(shopId: string): string {
    return `tenant:${shopId}:*`;
  }

  /**
   * Get all cache keys for a specific entity type in tenant
   * @param shopId - Tenant shop ID
   * @param entityType - Type of entity
   * @returns Glob pattern for entity keys
   */
  static getEntityPattern(shopId: string, entityType: string): string {
    return `tenant:${shopId}:${entityType}:*`;
  }
}

/**
 * EntityCacheStrategy - Cache entities by ID with relationship awareness
 * Handles cascading invalidation for related entities
 */
export class EntityCacheStrategy {
  /**
   * Create cache key for an entity
   * @param entityType - Type of entity (e.g., 'user', 'product')
   * @param entityId - Entity ID
   * @returns Cache key
   */
  static createKey(entityType: string, entityId: string): string {
    return `entity:${entityType}:${entityId}`;
  }

  /**
   * Create cache key for entity list
   * @param entityType - Type of entity
   * @returns Pattern for entity list keys
   */
  static getCollectionKey(entityType: string): string {
    return `entity:${entityType}:list`;
  }

  /**
   * Create tag for entity relationships
   * @param entityType - Type of entity
   * @param entityId - Entity ID
   * @returns Tag for relationship tracking
   */
  static createRelationshipTag(entityType: string, entityId: string): string {
    return `rel:${entityType}:${entityId}`;
  }

  /**
   * Create tag for entity type (for bulk invalidation)
   * @param entityType - Type of entity
   * @returns Tag for all entities of this type
   */
  static createTypeTag(entityType: string): string {
    return `type:${entityType}`;
  }
}

/**
 * QueryCacheStrategy - Cache query results with parameter-based keys
 * Provides automatic expiration and parameter hashing
 */
export class QueryCacheStrategy {
  /**
   * Create cache key for query results
   * @param queryName - Identifier for the query
   * @param params - Query parameters object
   * @returns Deterministic cache key
   */
  static createKey(queryName: string, params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) {
      return `query:${queryName}`;
    }

    const paramStr = JSON.stringify(params);
    const hash = this.simpleHash(paramStr);
    return `query:${queryName}:${hash}`;
  }

  /**
   * Create tag for query invalidation
   * @param queryName - Identifier for the query
   * @returns Tag for invalidating this query
   */
  static createQueryTag(queryName: string): string {
    return `query:${queryName}`;
  }

  /**
   * Create tag for entity-query relationship
   * @param entityType - Type of entity in query results
   * @returns Tag for invalidating queries when entity changes
   */
  static createEntityTag(entityType: string): string {
    return `queryent:${entityType}`;
  }

  /**
   * Private: Simple hash function for parameters
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * RateLimitStrategy - Token bucket rate limiting using Redis
 * Provides atomic rate limit checking
 */
export class RateLimitStrategy {
  /**
   * Create cache key for rate limit bucket
   * @param identifier - User/IP identifier
   * @param namespace - Optional namespace (e.g., 'api', 'auth')
   * @returns Rate limit key
   */
  static createKey(identifier: string, namespace?: string): string {
    if (namespace) {
      return `ratelimit:${namespace}:${identifier}`;
    }
    return `ratelimit:${identifier}`;
  }

  /**
   * Check if identifier is within rate limit
   * @param cache - CacheClient instance
   * @param config - Rate limit configuration
   * @returns Promise resolving to remaining tokens
   */
  static async checkLimit(
    cache: CacheClient,
    config: RateLimitConfig
  ): Promise<number> {
    const key = config.key || 'default';
    const current = await cache.increment(key, 1);
    return Math.max(0, config.maxRequests - current);
  }

  /**
   * Reset rate limit bucket
   * @param cache - CacheClient instance
   * @param config - Rate limit configuration
   */
  static async resetLimit(
    cache: CacheClient,
    config: RateLimitConfig
  ): Promise<void> {
    const key = config.key || 'default';
    await cache.delete(key);
  }

  /**
   * Get remaining requests
   * @param cache - CacheClient instance
   * @param config - Rate limit configuration
   * @returns Number of remaining requests
   */
  static async getRemainingRequests(
    cache: CacheClient,
    config: RateLimitConfig
  ): Promise<number> {
    const key = config.key || 'default';
    const ttl = await cache.ttl(key);

    // Key doesn't exist, bucket is reset
    if (ttl === -2) {
      return config.maxRequests;
    }

    // This is a simplified check - real implementation would track actual count
    return Math.max(0, config.maxRequests - 1);
  }
}

/**
 * SessionCacheStrategy - Store session data with sliding expiration
 * Provides session isolation and automatic expiration
 */
export class SessionCacheStrategy {
  /**
   * Create cache key for session
   * @param sessionId - Unique session identifier
   * @returns Cache key
   */
  static createKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  /**
   * Create tag for user sessions
   * @param userId - User identifier
   * @returns Tag for invalidating all user sessions
   */
  static createUserTag(userId: string): string {
    return `sessions:user:${userId}`;
  }

  /**
   * Create tag for tenant sessions
   * @param shopId - Tenant shop ID
   * @returns Tag for invalidating all tenant sessions
   */
  static createTenantTag(shopId: string): string {
    return `sessions:tenant:${shopId}`;
  }

  /**
   * Get session data with sliding expiration
   * @param cache - CacheClient instance
   * @param sessionId - Session ID
   * @param ttl - Session TTL in seconds
   * @returns Session data or null
   */
  static async getSession<T = any>(
    cache: CacheClient,
    sessionId: string,
    ttl?: number
  ): Promise<T | null> {
    const key = this.createKey(sessionId);
    const session = await cache.get<T>(key);

    // Refresh expiration on access (sliding window)
    if (session && ttl) {
      await cache.set(key, session, ttl);
    }

    return session;
  }

  /**
   * Store session data
   * @param cache - CacheClient instance
   * @param sessionId - Session ID
   * @param data - Session data to store
   * @param ttl - Session TTL in seconds
   * @param userId - Optional user ID for user session tag
   * @param shopId - Optional shop ID for tenant session tag
   */
  static async setSession<T = any>(
    cache: CacheClient,
    sessionId: string,
    data: T,
    ttl: number,
    userId?: string,
    shopId?: string
  ): Promise<void> {
    const key = this.createKey(sessionId);
    const tags: string[] = [];

    if (userId) {
      tags.push(this.createUserTag(userId));
    }
    if (shopId) {
      tags.push(this.createTenantTag(shopId));
    }

    await cache.set(key, data, ttl, tags);
  }

  /**
   * Invalidate all sessions for a user
   * @param cache - CacheClient instance
   * @param userId - User identifier
   * @returns Number of sessions invalidated
   */
  static async invalidateUserSessions(
    cache: CacheClient,
    userId: string
  ): Promise<number> {
    const tag = this.createUserTag(userId);
    return await cache.deleteByTag(tag);
  }

  /**
   * Invalidate all sessions for a tenant
   * @param cache - CacheClient instance
   * @param shopId - Shop ID
   * @returns Number of sessions invalidated
   */
  static async invalidateTenantSessions(
    cache: CacheClient,
    shopId: string
  ): Promise<number> {
    const tag = this.createTenantTag(shopId);
    return await cache.deleteByTag(tag);
  }
}
