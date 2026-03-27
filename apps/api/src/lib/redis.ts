/**
 * Redis client with tenant-aware key prefixing.
 *
 * Provides:
 * - Singleton ioredis connection with reconnection logic
 * - TenantRedis wrapper that auto-prefixes keys with tenant:{shopId}:
 * - Version-based cache invalidation (no SCAN+DEL needed)
 * - Graceful shutdown
 */

import Redis from "ioredis";

// ─── Singleton Connection ───────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    const opts: any = {
      // Fail commands immediately (no retry) so Redis errors don't block
      // HTTP request handlers. Background reconnection still uses retryStrategy.
      maxRetriesPerRequest: 0,
      connectTimeout: 5000,
      commandTimeout: 5000,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
      lazyConnect: false,
      enableReadyCheck: false,
    };

    _redis = new Redis(REDIS_URL, opts);

    _redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    _redis.on("connect", () => {
      console.info("[Redis] Connected");
    });
  }

  return _redis;
}

export async function disconnectRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}

// ─── Tenant-Scoped Redis Wrapper ────────────────────────────

export class TenantRedis {
  private readonly prefix: string;
  private readonly redis: Redis;

  constructor(shopId: string) {
    this.prefix = `tenant:${shopId}:`;
    this.redis = getRedis();
  }

  private key(k: string): string {
    return `${this.prefix}${k}`;
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(this.key(key));
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.set(this.key(key), value, "EX", ttlSeconds);
    } else {
      await this.redis.set(this.key(key), value);
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(this.key(key));
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redis.exists(this.key(key))) === 1;
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(this.key(key));
  }

  /**
   * Version-based cache invalidation.
   * Instead of SCAN+DEL (expensive), increment a version counter.
   * Cache keys include the version, and old keys expire via TTL.
   */
  async invalidateGroup(group: string): Promise<number> {
    return this.redis.incr(this.key(`version:${group}`));
  }

  async getVersion(group: string): Promise<number> {
    const v = await this.redis.get(this.key(`version:${group}`));
    return v ? parseInt(v, 10) : 0;
  }

  async getVersionedKey(group: string, suffix: string): Promise<string> {
    const version = await this.getVersion(group);
    return `cache:v${version}:${group}:${suffix}`;
  }
}

// ─── Carrier Rate Cache (Performance-Critical) ─────────────

const RATE_CACHE_TTL = 900; // 15 minutes (matches Shopify's cache TTL)

export async function getCachedRate(
  shopId: string,
  originZip: string,
  destZip: string,
  weightBucket: number,
): Promise<string | null> {
  const redis = getRedis();
  const key = `tenant:${shopId}:cache:rates:${originZip}_${destZip}_${weightBucket}`;
  return redis.get(key);
}

export async function setCachedRate(
  shopId: string,
  originZip: string,
  destZip: string,
  weightBucket: number,
  ratesJson: string,
): Promise<void> {
  const redis = getRedis();
  const key = `tenant:${shopId}:cache:rates:${originZip}_${destZip}_${weightBucket}`;
  await redis.set(key, ratesJson, "EX", RATE_CACHE_TTL);
}

// ─── Driver Location (Redis GEO) ───────────────────────────

const DRIVER_GEO_KEY = "driver:locations";

export async function updateDriverGeo(
  driverId: string,
  longitude: number,
  latitude: number,
): Promise<void> {
  const redis = getRedis();
  await redis.geoadd(DRIVER_GEO_KEY, longitude, latitude, driverId);
}

export async function findNearbyDriversGeo(
  longitude: number,
  latitude: number,
  radiusKm: number,
  count: number = 20,
): Promise<Array<{ driverId: string; distance: number }>> {
  const redis = getRedis();
  const results = await redis.georadius(
    DRIVER_GEO_KEY,
    longitude,
    latitude,
    radiusKm,
    "km",
    "WITHDIST",
    "ASC",
    "COUNT",
    count,
  );

  return (results as Array<[string, string]>).map(([driverId, dist]) => ({
    driverId,
    distance: parseFloat(dist),
  }));
}

export async function removeDriverGeo(driverId: string): Promise<void> {
  const redis = getRedis();
  await redis.zrem(DRIVER_GEO_KEY, driverId);
}
