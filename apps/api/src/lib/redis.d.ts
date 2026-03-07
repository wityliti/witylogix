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
export declare function getRedis(): Redis;
export declare function disconnectRedis(): Promise<void>;
export declare class TenantRedis {
    private readonly prefix;
    private readonly redis;
    constructor(shopId: string);
    private key;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttlSeconds?: number): Promise<void>;
    getJson<T>(key: string): Promise<T | null>;
    setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    incr(key: string): Promise<number>;
    /**
     * Version-based cache invalidation.
     * Instead of SCAN+DEL (expensive), increment a version counter.
     * Cache keys include the version, and old keys expire via TTL.
     */
    invalidateGroup(group: string): Promise<number>;
    getVersion(group: string): Promise<number>;
    getVersionedKey(group: string, suffix: string): Promise<string>;
}
export declare function getCachedRate(shopId: string, originZip: string, destZip: string, weightBucket: number): Promise<string | null>;
export declare function setCachedRate(shopId: string, originZip: string, destZip: string, weightBucket: number, ratesJson: string): Promise<void>;
export declare function updateDriverGeo(driverId: string, longitude: number, latitude: number): Promise<void>;
export declare function findNearbyDriversGeo(longitude: number, latitude: number, radiusKm: number, count?: number): Promise<Array<{
    driverId: string;
    distance: number;
}>>;
export declare function removeDriverGeo(driverId: string): Promise<void>;
//# sourceMappingURL=redis.d.ts.map