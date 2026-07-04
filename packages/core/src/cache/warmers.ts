/**
 * Cache warming utilities for pre-loading frequently accessed data
 * Provides background cache population
 */

import { CacheClient } from "./client";
import { TenantCacheStrategy, EntityCacheStrategy } from "./strategies";
import { WarmingStatus } from "./types";

/**
 * Data loaders for warming strategies
 */
export interface CacheDataLoaders {
  /** Load shop/zone data */
  loadZones?: (shopId: string) => Promise<any[]>;
  /** Load driver data */
  loadDrivers?: (shopId: string) => Promise<any[]>;
  /** Load shipping profiles */
  loadShippingProfiles?: (shopId: string) => Promise<any[]>;
  /** Load products */
  loadProducts?: (shopId: string) => Promise<any[]>;
  /** Load rate cards */
  loadRateCards?: (shopId: string) => Promise<any[]>;
}

/**
 * CacheWarmer - Manages background cache population
 */
export class CacheWarmer {
  private cache: CacheClient;
  private loaders: CacheDataLoaders;
  private warmingInterval: NodeJS.Timeout | null = null;
  private status: WarmingStatus;
  private warmingPromise: Promise<void> | null = null;

  /**
   * Initialize cache warmer
   * @param cache - CacheClient instance
   * @param loaders - Data loaders for warming
   */
  constructor(cache: CacheClient, loaders: CacheDataLoaders) {
    this.cache = cache;
    this.loaders = loaders;
    this.status = {
      isRunning: false,
      coverage: 0,
    };
  }

  /**
   * Pre-load shop data (zones, drivers, shipping profiles)
   * @param shopId - Tenant shop ID
   * @param ttl - TTL for cached data
   */
  async warmShopData(shopId: string, ttl: number = 3600): Promise<void> {
    try {
      const promises: Promise<any>[] = [];

      // Warm zones
      if (this.loaders.loadZones) {
        const zonesPromise = this.loaders.loadZones(shopId).then((zones) => {
          const key = TenantCacheStrategy.createKey(shopId, "zones");
          return this.cache.set(key, zones, ttl, [`tenant:${shopId}:zones`]);
        });
        promises.push(zonesPromise);
      }

      // Warm drivers
      if (this.loaders.loadDrivers) {
        const driversPromise = this.loaders
          .loadDrivers(shopId)
          .then((drivers) => {
            const key = TenantCacheStrategy.createKey(shopId, "drivers");
            return this.cache.set(key, drivers, ttl, [
              `tenant:${shopId}:drivers`,
            ]);
          });
        promises.push(driversPromise);
      }

      // Warm shipping profiles
      if (this.loaders.loadShippingProfiles) {
        const profilesPromise = this.loaders
          .loadShippingProfiles(shopId)
          .then((profiles) => {
            const key = TenantCacheStrategy.createKey(
              shopId,
              "shipping_profiles",
            );
            return this.cache.set(key, profiles, ttl, [
              `tenant:${shopId}:shipping_profiles`,
            ]);
          });
        promises.push(profilesPromise);
      }

      await Promise.all(promises);
    } catch (error) {
      console.error(`Cache warming error for shop ${shopId}:`, error);
      this.status.lastError = (error as Error).message;
    }
  }

  /**
   * Pre-load product cache for shop
   * @param shopId - Tenant shop ID
   * @param ttl - TTL for cached data
   */
  async warmProductCache(shopId: string, ttl: number = 7200): Promise<void> {
    try {
      if (!this.loaders.loadProducts) {
        return;
      }

      const products = await this.loaders.loadProducts(shopId);
      const cacheTag = EntityCacheStrategy.createTypeTag("product");

      for (const product of products) {
        const key = EntityCacheStrategy.createKey("product", product.id);
        await this.cache.set(key, product, ttl, [cacheTag]);
      }
    } catch (error) {
      console.error(`Product cache warming error for shop ${shopId}:`, error);
      this.status.lastError = (error as Error).message;
    }
  }

  /**
   * Pre-load rate cards for shop
   * @param shopId - Tenant shop ID
   * @param ttl - TTL for cached data
   */
  async warmRateCards(shopId: string, ttl: number = 3600): Promise<void> {
    try {
      if (!this.loaders.loadRateCards) {
        return;
      }

      const rateCards = await this.loaders.loadRateCards(shopId);
      const key = TenantCacheStrategy.createKey(shopId, "rate_cards");
      await this.cache.set(key, rateCards, ttl, [
        `tenant:${shopId}:rate_cards`,
      ]);
    } catch (error) {
      console.error(`Rate card cache warming error for shop ${shopId}:`, error);
      this.status.lastError = (error as Error).message;
    }
  }

  /**
   * Perform full warming for shop
   * @param shopId - Tenant shop ID
   */
  async warmAll(shopId: string): Promise<number> {
    const startTime = Date.now();
    let itemsWarmed = 0;

    try {
      await this.warmShopData(shopId);
      itemsWarmed += 3; // zones, drivers, profiles

      await this.warmProductCache(shopId);
      const products = await this.loaders.loadProducts?.(shopId);
      if (products) {
        itemsWarmed += products.length;
      }

      await this.warmRateCards(shopId);
      itemsWarmed += 1;

      const duration = Date.now() - startTime;
      console.log(
        `Cache warming completed for shop ${shopId}: ${itemsWarmed} items in ${duration}ms`,
      );

      return itemsWarmed;
    } catch (error) {
      console.error(`Full cache warming error for shop ${shopId}:`, error);
      throw error;
    }
  }

  /**
   * Schedule periodic cache warming
   * @param shopIds - List of shop IDs to warm
   * @param interval - Interval in milliseconds
   * @param ttl - TTL for cached data
   */
  scheduleWarming(
    shopIds: string[],
    interval: number = 3600000, // 1 hour default
    ttl: number = 3600,
  ): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
    }

    this.status.isRunning = true;

    // Run immediately
    this.executeWarming(shopIds, ttl);

    // Schedule periodic runs
    this.warmingInterval = setInterval(() => {
      this.executeWarming(shopIds, ttl);
    }, interval);

    this.status.nextExecution = Date.now() + interval;
  }

  /**
   * Stop periodic warming
   */
  stopWarming(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
    }
    this.status.isRunning = false;
  }

  /**
   * Get warming status
   */
  getStatus(): WarmingStatus {
    return { ...this.status };
  }

  /**
   * Private: Execute warming for all shops
   */
  private async executeWarming(shopIds: string[], ttl: number): Promise<void> {
    if (this.warmingPromise) {
      return; // Skip if already warming
    }

    this.warmingPromise = (async () => {
      const startTime = Date.now();
      let totalItems = 0;

      try {
        for (const shopId of shopIds) {
          const items = await this.warmAll(shopId);
          totalItems += items;
        }

        this.status.lastExecution = Date.now();
        this.status.itemsWarmed = totalItems;
        this.status.coverage = Math.min(
          100,
          (totalItems / (shopIds.length * 10)) * 100,
        );
        this.status.lastError = undefined;
      } catch (error) {
        this.status.lastError = (error as Error).message;
      } finally {
        this.warmingPromise = null;
      }
    })();

    await this.warmingPromise;
  }
}
