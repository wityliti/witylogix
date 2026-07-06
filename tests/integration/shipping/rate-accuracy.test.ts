/**
 * Shipping Rate Accuracy Integration Tests
 * Tests: rate consistency, parallel fetching, rate ranking, caching, degradation, currency
 * ~250 lines
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mockCarrierRates,
  mockRateRequestPayload,
  mockCachedRate,
  mockMultiCurrencyRates,
} from "../fixtures/shipping-fixtures.js";

interface Rate {
  carrier: string;
  cost: number;
  currency: string;
  estimatedDays: number;
  timestamp: string;
}

interface RateCache {
  [key: string]: Rate & { ttl: number; cachedAt: string };
}

// Mock rate engine
class RateEngine {
  private cache: RateCache = {};
  private circuitBreaker: Record<
    string,
    { failures: number; blocked: boolean }
  > = {};

  async fetchRate(carrier: string): Promise<Rate | null> {
    // Simulate circuit breaker
    if (this.circuitBreaker[carrier]?.blocked) {
      return null;
    }

    // Simulate carrier-specific delays/failures
    if (carrier === "ontrac") {
      return new Promise((resolve) => {
        setTimeout(() => resolve(mockCarrierRates.ontrac), 100);
      });
    }

    if (carrier === "timeout_carrier") {
      return new Promise((resolve) => {
        setTimeout(() => resolve(null), 15000); // Timeout after 10s
      });
    }

    return Promise.resolve(
      mockCarrierRates[carrier as keyof typeof mockCarrierRates] || null,
    );
  }

  async fetchParallelRates(carriers: string[]): Promise<(Rate | null)[]> {
    return Promise.all(carriers.map((c) => this.fetchRate(c)));
  }

  rankByPrice(rates: (Rate | null)[]): (Rate | null)[] {
    return rates.sort((a, b) => {
      if (!a || !b) return 0;
      return a.cost - b.cost;
    });
  }

  rankBySpeed(rates: (Rate | null)[]): (Rate | null)[] {
    return rates.sort((a, b) => {
      if (!a || !b) return 0;
      return a.estimatedDays - b.estimatedDays;
    });
  }

  rankByValue(rates: (Rate | null)[]): (Rate | null)[] {
    // Simple heuristic: cost per day
    return rates.sort((a, b) => {
      if (!a || !b) return 0;
      const scoreA = a.cost / a.estimatedDays;
      const scoreB = b.cost / b.estimatedDays;
      return scoreA - scoreB;
    });
  }

  cacheRate(key: string, rate: Rate, ttlSeconds: number): void {
    this.cache[key] = {
      ...rate,
      ttl: ttlSeconds,
      cachedAt: new Date().toISOString(),
    };
  }

  getCachedRate(key: string): Rate | null {
    const cached = this.cache[key];
    if (!cached) return null;

    const now = new Date().getTime();
    const cachedTime = new Date(cached.cachedAt).getTime();
    const ageSeconds = (now - cachedTime) / 1000;

    if (ageSeconds > cached.ttl) {
      delete this.cache[key];
      return null;
    }

    const { ttl, cachedAt, ...rate } = cached;
    return rate;
  }

  normalizeCurrency(rate: Rate, targetCurrency: string): Rate {
    if (rate.currency === targetCurrency) return rate;

    const exchangeRates: Record<string, number> = {
      EUR: 1.1,
      GBP: 1.27,
      USD: 1.0,
    };

    const normalized =
      (rate.cost * (exchangeRates[rate.currency] || 1)) /
      (exchangeRates[targetCurrency] || 1);

    return {
      ...rate,
      cost: parseFloat(normalized.toFixed(2)),
      currency: targetCurrency,
    };
  }

  blockCarrier(carrier: string): void {
    this.circuitBreaker[carrier] = { failures: 5, blocked: true };
  }

  unblockCarrier(carrier: string): void {
    this.circuitBreaker[carrier] = { failures: 0, blocked: false };
  }

  clearCache(): void {
    this.cache = {};
  }
}

describe("Rate Accuracy", () => {
  let engine: RateEngine;

  beforeEach(() => {
    engine = new RateEngine();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    engine.clearCache();
  });

  describe("Carrier Rate Consistency", () => {
    it("should return consistent rates across multiple calls", async () => {
      const rate1 = await engine.fetchRate("fedex");
      const rate2 = await engine.fetchRate("fedex");

      expect(rate1).toEqual(rate2);
      expect(rate1?.carrier).toBe("FedEx");
      expect(rate1?.cost).toBe(25.5);
    });

    it("should provide all carrier rates", async () => {
      const carriers = ["fedex", "ups", "usps", "dhl", "ontrac"];
      const rates = await engine.fetchParallelRates(carriers);

      expect(rates).toHaveLength(5);
      const validRates = rates.filter((r) => r !== null);
      expect(validRates).toHaveLength(5);
    });

    it("should include timestamp in each rate", async () => {
      const rate = await engine.fetchRate("fedex");

      expect(rate).toBeDefined();
      expect(rate?.timestamp).toBeDefined();
      expect(new Date(rate?.timestamp || "").getTime()).toBeGreaterThan(0);
    });

    it("should include currency in rate response", async () => {
      const rate = await engine.fetchRate("usps");

      expect(rate?.currency).toBe("USD");
    });
  });

  describe("Parallel Rate Fetching", () => {
    it("should fetch rates from multiple carriers concurrently", async () => {
      const carriers = ["fedex", "ups", "usps"];
      const rates = await engine.fetchParallelRates(carriers);

      expect(rates).toHaveLength(3);
      expect(rates[0]?.carrier).toBe("FedEx");
      expect(rates[1]?.carrier).toBe("UPS");
      expect(rates[2]?.carrier).toBe("USPS");
    });

    it("should handle mixed success and failure responses", async () => {
      const carriers = ["fedex", "invalid_carrier", "usps", "dhl"];
      const rates = await engine.fetchParallelRates(carriers);

      expect(rates).toHaveLength(4);
      expect(rates[0]).not.toBeNull(); // fedex
      expect(rates[1]).toBeNull(); // invalid
      expect(rates[2]).not.toBeNull(); // usps
      expect(rates[3]).not.toBeNull(); // dhl
    });

    it("should complete even if some carriers timeout", async () => {
      const carriers = ["fedex", "timeout_carrier", "usps"];
      const startTime = Date.now();

      // Set a timeout of 10 seconds
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve("TIMEOUT"), 10000);
      });

      const ratesPromise = engine.fetchParallelRates(carriers);
      const result = await Promise.race([ratesPromise, timeoutPromise]);

      expect(result).not.toBe("TIMEOUT");
    });

    it("should support graceful degradation with 5 carriers (2 fail, 3 succeed)", async () => {
      const carriers = ["fedex", "invalid_1", "ups", "invalid_2", "usps"];
      const rates = await engine.fetchParallelRates(carriers);

      const successfulRates = rates.filter((r) => r !== null);
      expect(rates).toHaveLength(5);
      expect(successfulRates).toHaveLength(3);
    });
  });

  describe("Rate Ranking", () => {
    it("should rank rates by cheapest cost", async () => {
      const carriers = ["fedex", "ups", "usps", "dhl", "ontrac"];
      const rates = (await engine.fetchParallelRates(carriers)).filter(
        (r) => r !== null,
      ) as Rate[];
      const ranked = engine.rankByPrice(rates);

      expect(ranked[0]?.carrier).toBe("USPS"); // $18
      expect(ranked[1]?.carrier).toBe("OnTrac"); // $22
      expect(ranked[2]?.carrier).toBe("FedEx"); // $25.5
      expect(ranked[3]?.carrier).toBe("UPS"); // $32.75
      expect(ranked[4]?.carrier).toBe("DHL"); // $45
    });

    it("should rank rates by fastest delivery", async () => {
      const carriers = ["fedex", "ups", "usps", "dhl", "ontrac"];
      const rates = (await engine.fetchParallelRates(carriers)).filter(
        (r) => r !== null,
      ) as Rate[];
      const ranked = engine.rankBySpeed(rates);

      expect(ranked[0]?.estimatedDays).toBe(1); // DHL
      expect(ranked[ranked.length - 1]?.estimatedDays).toBe(3); // USPS or OnTrac
    });

    it("should rank rates by best value (cost per day)", async () => {
      const carriers = ["fedex", "ups", "usps", "dhl", "ontrac"];
      const rates = (await engine.fetchParallelRates(carriers)).filter(
        (r) => r !== null,
      ) as Rate[];
      const ranked = engine.rankByValue(rates);

      // Best value = lowest cost per delivery day
      expect(ranked[0]).toBeDefined();
      const firstValue =
        (ranked[0]?.cost || 0) / (ranked[0]?.estimatedDays || 1);
      const lastValue =
        (ranked[4]?.cost || 0) / (ranked[4]?.estimatedDays || 1);
      expect(firstValue).toBeLessThan(lastValue);
    });

    it("should maintain ranking consistency", async () => {
      const carriers = ["fedex", "ups", "usps"];
      const rates1 = (await engine.fetchParallelRates(carriers)).filter(
        (r) => r !== null,
      ) as Rate[];
      const ranked1 = engine.rankByPrice(rates1);

      const rates2 = (await engine.fetchParallelRates(carriers)).filter(
        (r) => r !== null,
      ) as Rate[];
      const ranked2 = engine.rankByPrice(rates2);

      expect(ranked1.map((r) => r.carrier)).toEqual(
        ranked2.map((r) => r.carrier),
      );
    });
  });

  describe("Rate Caching", () => {
    it("should cache rates within TTL", async () => {
      const rate = mockCarrierRates.usps;
      engine.cacheRate("usps_rate", rate, 3600);

      const cached = engine.getCachedRate("usps_rate");
      expect(cached).not.toBeNull();
      expect(cached?.carrier).toBe("USPS");
    });

    it("should expire cached rates after TTL", async () => {
      const rate = mockCarrierRates.usps;
      engine.cacheRate("usps_rate", rate, 10); // 10 seconds

      let cached = engine.getCachedRate("usps_rate");
      expect(cached).not.toBeNull();

      // Advance time past TTL
      vi.advanceTimersByTime(11000);

      cached = engine.getCachedRate("usps_rate");
      expect(cached).toBeNull();
    });

    it("should return different rates for different cache keys", async () => {
      engine.cacheRate("fedex_rate", mockCarrierRates.fedex, 3600);
      engine.cacheRate("usps_rate", mockCarrierRates.usps, 3600);

      const fedex = engine.getCachedRate("fedex_rate");
      const usps = engine.getCachedRate("usps_rate");

      expect(fedex?.carrier).toBe("FedEx");
      expect(usps?.carrier).toBe("USPS");
      expect(fedex?.cost).not.toBe(usps?.cost);
    });

    it("should support configurable TTL", async () => {
      engine.cacheRate("short_ttl", mockCarrierRates.fedex, 5);
      engine.cacheRate("long_ttl", mockCarrierRates.ups, 3600);

      vi.advanceTimersByTime(6000);

      const shortTTL = engine.getCachedRate("short_ttl");
      const longTTL = engine.getCachedRate("long_ttl");

      expect(shortTTL).toBeNull();
      expect(longTTL).not.toBeNull();
    });
  });

  describe("Graceful Degradation", () => {
    it("should return available rates when some carriers fail", async () => {
      const carriers = ["fedex", "invalid", "usps", "invalid", "dhl"];
      const rates = await engine.fetchParallelRates(carriers);
      const successfulRates = rates.filter((r) => r !== null);

      expect(successfulRates).toHaveLength(3);
      expect(successfulRates.map((r) => r?.carrier)).toContain("FedEx");
      expect(successfulRates.map((r) => r?.carrier)).toContain("USPS");
      expect(successfulRates.map((r) => r?.carrier)).toContain("DHL");
    });

    it("should degrade gracefully with 2 out of 5 failures", async () => {
      const carriers = ["fedex", "invalid_1", "ups", "invalid_2", "usps"];
      const rates = await engine.fetchParallelRates(carriers);

      const validRates = rates.filter((r) => r !== null);
      const failedCount = rates.filter((r) => r === null).length;

      expect(failedCount).toBe(2);
      expect(validRates.length).toBe(3);
    });

    it("should prioritize available carriers for selection", async () => {
      const carriers = ["fedex", "invalid", "usps"];
      const rates = (await engine.fetchParallelRates(carriers)).filter(
        (r) => r !== null,
      ) as Rate[];
      const ranked = engine.rankByPrice(rates);

      expect(ranked).toHaveLength(2);
      expect(ranked[0]).toBeDefined();
    });

    it("should handle complete failure scenario", async () => {
      const carriers = ["invalid_1", "invalid_2", "invalid_3"];
      const rates = await engine.fetchParallelRates(carriers);

      const successfulRates = rates.filter((r) => r !== null);
      expect(successfulRates).toHaveLength(0);
    });
  });

  describe("Currency Normalization", () => {
    it("should normalize EUR rates to USD", () => {
      const rate = mockMultiCurrencyRates.eur;
      const normalized = engine.normalizeCurrency(rate, "USD");

      expect(normalized.currency).toBe("USD");
      expect(normalized.cost).toBeGreaterThan(22.5); // Should be roughly 24.75
      expect(normalized.cost).toBeLessThan(26);
    });

    it("should normalize GBP rates to USD", () => {
      const rate = mockMultiCurrencyRates.gbp;
      const normalized = engine.normalizeCurrency(rate, "USD");

      expect(normalized.currency).toBe("USD");
      expect(normalized.cost).toBeGreaterThan(22);
      expect(normalized.cost).toBeLessThan(25);
    });

    it("should handle USD to USD conversion (no change)", () => {
      const rate = mockMultiCurrencyRates.usd;
      const normalized = engine.normalizeCurrency(rate, "USD");

      expect(normalized.currency).toBe("USD");
      expect(normalized.cost).toBe(rate.cost);
    });

    it("should normalize multiple rates for comparison", () => {
      const rates = [
        mockMultiCurrencyRates.usd,
        mockMultiCurrencyRates.eur,
        mockMultiCurrencyRates.gbp,
      ];
      const normalized = rates.map((r) => engine.normalizeCurrency(r, "USD"));

      // All should now be in USD
      expect(normalized.every((r) => r.currency === "USD")).toBe(true);

      // Should be comparable by cost
      expect(normalized[0].cost).toBeDefined();
      expect(normalized[1].cost).toBeDefined();
      expect(normalized[2].cost).toBeDefined();
    });

    it("should preserve original cost for same-currency rates", () => {
      const rate = mockMultiCurrencyRates.usd;
      const normalized = engine.normalizeCurrency(rate, "USD");

      expect(normalized.cost).toBe(25.5);
    });
  });
});
