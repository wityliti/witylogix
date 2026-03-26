/**
 * Feature Store Tests
 *
 * Tests the feature store implementation including caching, versioning,
 * and temporal features.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZoneFeatureStore, VersionedFeatureStore, type ZoneFeatures } from '../feature-store.js';

describe('ZoneFeatureStore', () => {
  let store: ZoneFeatureStore;

  beforeEach(() => {
    store = new ZoneFeatureStore(undefined, 3600000); // 1 hour TTL
  });

  describe('Zone Features Storage', () => {
    it('should retrieve features for a zone', async () => {
      const features = await store.getZoneFeatures('zone_1');

      expect(features).toBeDefined();
      expect(features?.zoneId).toBe('zone_1');
      expect(features?.timestamp).toBeInstanceOf(Date);
      expect(features?.version).toBe(1);
    });

    it('should return same features from cache on second call', async () => {
      const features1 = await store.getZoneFeatures('zone_1');
      const features2 = await store.getZoneFeatures('zone_1');

      expect(features1).toBe(features2); // Same reference (cached)
    });

    it('should retrieve multiple zones features', async () => {
      const zoneIds = ['zone_1', 'zone_2', 'zone_3'];
      const featureMap = await store.getZoneFeaturesMultiple(zoneIds);

      expect(featureMap.size).toBe(3);
      zoneIds.forEach(zoneId => {
        const features = featureMap.get(zoneId);
        expect(features).toBeDefined();
        expect(features?.zoneId).toBe(zoneId);
      });
    });

    it('should save and retrieve zone features', async () => {
      const features: ZoneFeatures = {
        zoneId: 'zone_test',
        timestamp: new Date(),
        version: 1,
        deliveryCountHourly: { 9: 150, 14: 120, 18: 180 },
        deliveryCountDaily: { 0: 1100, 1: 1000, 5: 800, 6: 700 },
        deliveryCountWeekly: 7000,
        averageDeliveryTime: 28,
        peakHourDistribution: { 9: 0.12, 14: 0.10, 18: 0.15 },
        dayOfWeekPattern: { 0: 1.1, 1: 1.0, 5: 0.8, 6: 0.7 },
        seasonalIndex: 1.1,
        growthTrendCoefficient: 0.03,
        volatilityScore: 0.32,
        samplesCount: 5000,
        lastUpdatedAt: new Date(),
      };

      await store.saveZoneFeatures(features);
      const retrieved = await store.getZoneFeatures('zone_test');

      expect(retrieved).toBeDefined();
      expect(retrieved?.averageDeliveryTime).toBe(28);
      expect(retrieved?.growthTrendCoefficient).toBe(0.03);
    });
  });

  describe('Feature Characteristics', () => {
    it('should have hourly delivery counts', async () => {
      const features = await store.getZoneFeatures('zone_1');

      expect(features?.deliveryCountHourly).toBeDefined();
      expect(Object.keys(features!.deliveryCountHourly).length).toBe(24);

      // Check peak hours
      const values = Object.values(features!.deliveryCountHourly);
      expect(Math.max(...values)).toBeGreaterThan(50);
    });

    it('should have daily pattern (day of week)', async () => {
      const features = await store.getZoneFeatures('zone_1');

      expect(features?.deliveryCountDaily).toBeDefined();
      expect(Object.keys(features!.deliveryCountDaily).length).toBe(7);

      // Weekdays should have more deliveries
      expect(features!.deliveryCountDaily[1]).toBeGreaterThan(features!.deliveryCountDaily[6]);
    });

    it('should have peak hour distribution', async () => {
      const features = await store.getZoneFeatures('zone_1');

      expect(features?.peakHourDistribution).toBeDefined();
      const sum = Object.values(features!.peakHourDistribution).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.01); // Should sum to ~1.0
    });

    it('should have growth trend coefficient', async () => {
      const features = await store.getZoneFeatures('zone_1');

      expect(features?.growthTrendCoefficient).toBeDefined();
      expect(typeof features?.growthTrendCoefficient).toBe('number');
    });

    it('should have volatility score between 0 and 1', async () => {
      const features = await store.getZoneFeatures('zone_1');

      expect(features?.volatilityScore).toBeGreaterThanOrEqual(0);
      expect(features?.volatilityScore).toBeLessThanOrEqual(1);
    });

    it('should have seasonal index', async () => {
      const features = await store.getZoneFeatures('zone_1');

      expect(features?.seasonalIndex).toBeDefined();
      expect(features?.seasonalIndex).toBeGreaterThan(0);
    });
  });

  describe('Temporal Features', () => {
    it('should get temporal features for a date', async () => {
      const date = new Date(2026, 0, 15); // Mid-January
      const temporal = await store.getTemporalFeatures(date);

      expect(temporal).toBeDefined();
      expect(temporal.date).toEqual(date);
      expect(temporal.demandMultiplier).toBeGreaterThan(0);
    });

    it('should identify holidays', async () => {
      const christmas = new Date(2026, 11, 25);
      const temporal = await store.getTemporalFeatures(christmas);

      // Christmas should typically have low demand
      expect(temporal.demandMultiplier).toBeLessThan(1.0);
    });

    it('should handle regular (non-holiday) dates', async () => {
      const regularDay = new Date(2026, 5, 15); // Mid-June
      const temporal = await store.getTemporalFeatures(regularDay);

      expect(temporal.isHoliday).toBe(false);
      expect(temporal.demandMultiplier).toBeCloseTo(1.0, 1);
    });

    it('should get temporal features for date range', async () => {
      const startDate = new Date(2026, 0, 1);
      const endDate = new Date(2026, 0, 31);

      const features = await store.getTemporalFeaturesRange(startDate, endDate);

      expect(features.length).toBe(31);
      features.forEach((f, i) => {
        const expectedDate = new Date(2026, 0, i + 1);
        expect(f.date.getDate()).toBe(expectedDate.getDate());
      });
    });

    it('should apply demand multipliers to special dates', async () => {
      const blackFriday = new Date(2026, 10, 27); // Black Friday
      const temporal = await store.getTemporalFeatures(blackFriday);

      // Black Friday should have high demand
      expect(temporal.demandMultiplier).toBeGreaterThan(1.2);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      await store.getZoneFeatures('zone_1');
      await store.clearCache();

      // Cache should be empty
      const features = await store.getZoneFeatures('zone_1');
      expect(features).toBeDefined(); // Should still work, just recomputed
    });

    it('should respect TTL settings', async () => {
      const shortTtlStore = new ZoneFeatureStore(undefined, 100); // 100ms TTL
      const features1 = await shortTtlStore.getZoneFeatures('zone_1');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should recompute on next access
      const features2 = await shortTtlStore.getZoneFeatures('zone_1');
      expect(features2).toBeDefined();
    });
  });

  describe('Batch Operations', () => {
    it('should efficiently retrieve multiple zones', async () => {
      const zoneIds = Array.from({ length: 10 }, (_, i) => `zone_${i}`);
      const start = Date.now();

      const featureMap = await store.getZoneFeaturesMultiple(zoneIds);
      const elapsed = Date.now() - start;

      expect(featureMap.size).toBe(10);
      expect(elapsed).toBeLessThan(1000); // Should be fast
    });

    it('should mix cached and new features', async () => {
      // Prime cache with some zones
      await store.getZoneFeatures('zone_1');
      await store.getZoneFeatures('zone_2');

      // Request mix of cached and new
      const zoneIds = ['zone_1', 'zone_2', 'zone_3', 'zone_4'];
      const featureMap = await store.getZoneFeaturesMultiple(zoneIds);

      expect(featureMap.size).toBe(4);
      zoneIds.forEach(id => expect(featureMap.has(id)).toBe(true));
    });
  });
});

describe('VersionedFeatureStore', () => {
  let store: VersionedFeatureStore;

  beforeEach(() => {
    store = new VersionedFeatureStore(undefined, 3600000);
  });

  describe('Feature Versioning', () => {
    it('should track multiple versions of zone features', async () => {
      const baseFeatures: ZoneFeatures = {
        zoneId: 'zone_versioned',
        timestamp: new Date(),
        version: 1,
        deliveryCountHourly: { 9: 150 },
        deliveryCountDaily: { 1: 1000 },
        deliveryCountWeekly: 7000,
        averageDeliveryTime: 25,
        peakHourDistribution: { 9: 0.10 },
        dayOfWeekPattern: { 1: 1.0 },
        seasonalIndex: 1.0,
        growthTrendCoefficient: 0.02,
        volatilityScore: 0.30,
        samplesCount: 5000,
        lastUpdatedAt: new Date(),
      };

      // Save first version
      await store.saveZoneFeatures(baseFeatures);

      // Save second version with updated values
      const updatedFeatures = {
        ...baseFeatures,
        averageDeliveryTime: 26,
        growthTrendCoefficient: 0.03,
      };
      await store.saveZoneFeatures(updatedFeatures);

      // Save third version
      updatedFeatures.averageDeliveryTime = 27;
      await store.saveZoneFeatures(updatedFeatures);

      const history = await store.getZoneFeaturesHistory('zone_versioned');

      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[history.length - 1].averageDeliveryTime).toBe(27);
    });

    it('should retrieve specific version', async () => {
      const features1: ZoneFeatures = {
        zoneId: 'zone_v1',
        timestamp: new Date(),
        version: 1,
        deliveryCountHourly: { 9: 100 },
        deliveryCountDaily: { 1: 1000 },
        deliveryCountWeekly: 7000,
        averageDeliveryTime: 20,
        peakHourDistribution: { 9: 0.10 },
        dayOfWeekPattern: { 1: 1.0 },
        seasonalIndex: 1.0,
        growthTrendCoefficient: 0.01,
        volatilityScore: 0.30,
        samplesCount: 5000,
        lastUpdatedAt: new Date(),
      };

      await store.saveZoneFeatures(features1);

      const features2 = { ...features1, averageDeliveryTime: 25 };
      await store.saveZoneFeatures(features2);

      const v1 = await store.getZoneFeaturesVersion('zone_v1', 1);
      const v2 = await store.getZoneFeaturesVersion('zone_v1', 2);

      expect(v1?.averageDeliveryTime).toBe(20);
      expect(v2?.averageDeliveryTime).toBe(25);
    });

    it('should limit version history', async () => {
      const features: ZoneFeatures = {
        zoneId: 'zone_limited',
        timestamp: new Date(),
        version: 1,
        deliveryCountHourly: { 9: 150 },
        deliveryCountDaily: { 1: 1000 },
        deliveryCountWeekly: 7000,
        averageDeliveryTime: 25,
        peakHourDistribution: { 9: 0.10 },
        dayOfWeekPattern: { 1: 1.0 },
        seasonalIndex: 1.0,
        growthTrendCoefficient: 0.02,
        volatilityScore: 0.30,
        samplesCount: 5000,
        lastUpdatedAt: new Date(),
      };

      // Save more versions than the limit
      for (let i = 0; i < 15; i++) {
        features.averageDeliveryTime = 25 + i * 0.1;
        await store.saveZoneFeatures(features);
      }

      const history = await store.getZoneFeaturesHistory('zone_limited');

      // Should keep max 10 versions
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Feature Updates', () => {
    it('should update latest version while keeping history', async () => {
      const features: ZoneFeatures = {
        zoneId: 'zone_update',
        timestamp: new Date(),
        version: 1,
        deliveryCountHourly: { 9: 150 },
        deliveryCountDaily: { 1: 1000 },
        deliveryCountWeekly: 7000,
        averageDeliveryTime: 25,
        peakHourDistribution: { 9: 0.10 },
        dayOfWeekPattern: { 1: 1.0 },
        seasonalIndex: 1.0,
        growthTrendCoefficient: 0.02,
        volatilityScore: 0.30,
        samplesCount: 5000,
        lastUpdatedAt: new Date(),
      };

      await store.saveZoneFeatures(features);

      const updated = {
        ...features,
        growthTrendCoefficient: 0.05,
        volatilityScore: 0.35,
      };

      await store.saveZoneFeatures(updated);

      const latest = await store.getZoneFeatures('zone_update');

      expect(latest?.growthTrendCoefficient).toBe(0.05);
      expect(latest?.volatilityScore).toBe(0.35);
    });
  });
});
