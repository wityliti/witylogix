/**
 * Geocoding Service — Multi-provider forward/reverse geocoding with fallback chain
 *
 * Features:
 * - Forward geocoding: address string → { lat, lng, formattedAddress, confidence }
 * - Reverse geocoding: { lat, lng } → address
 * - Autocomplete/type-ahead: partial input → suggestions[]
 * - Provider fallback: Google Maps → Mapbox → HERE → Nominatim
 * - Per-provider rate limiting
 * - Result caching (Redis, 24hr TTL for geocode, 1hr for autocomplete)
 * - Batch geocoding support
 *
 * Provider selection order:
 * 1. Primary provider (configured per-tenant)
 * 2. Secondary provider (fallback)
 * 3. Tertiary provider (last resort)
 * 4. Nominatim (open-source, unlimited)
 */

import { RouteCache } from './route-cache.js';

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  confidence: number; // 0-1
  provider: string;
  cached: boolean;
}

export interface AutocompleteResult {
  placeId: string;
  mainText: string;
  secondaryText?: string;
  lat?: number;
  lng?: number;
  provider: string;
}

export interface ReverseGeocodeResult {
  lat: number;
  lng: number;
  address: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  provider: string;
  cached: boolean;
}

export interface GeocodingServiceConfig {
  providers: string[]; // Priority order: ['google', 'mapbox', 'here', 'nominatim']
  rateLimitPerProvider?: Record<string, number>; // Requests per second
  cacheEnabled?: boolean;
  cache?: RouteCache;
}

interface ProviderClient {
  name: string;
  geocode(address: string): Promise<GeocodingResult[]>;
  reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult>;
  autocomplete(input: string): Promise<AutocompleteResult[]>;
}

/**
 * Geocoding Service with multi-provider support
 */
export class GeocodingService {
  private providers: Map<string, ProviderClient> = new Map();
  private providerOrder: string[];
  private cache: RouteCache | null;
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private stats = {
    geocodes: 0,
    reverseGeocodes: 0,
    autocompletes: 0,
    cacheHits: 0,
    cacheMisses: 0,
    failovers: 0,
  };

  constructor(config: GeocodingServiceConfig) {
    this.providerOrder = config.providers || ['google', 'mapbox', 'here', 'nominatim'];
    this.cache = config.cacheEnabled !== false ? config.cache || new RouteCache() : null;

    // Initialize rate limiters
    const defaultRateLimit = config.rateLimitPerProvider || {};
    this.providerOrder.forEach((provider) => {
      const limit = defaultRateLimit[provider] || 10; // Default 10 req/sec
      this.rateLimiters.set(provider, new RateLimiter(limit));
    });

    // Initialize provider clients (in production, would instantiate real clients)
    this.initializeProviders();
  }

  /**
   * Initialize provider clients
   * In production, would instantiate actual API clients
   */
  private initializeProviders(): void {
    // Placeholder for provider initialization
    // In production:
    // this.providers.set('google', new GoogleMapsGeocoder(config));
    // this.providers.set('mapbox', new MapboxGeocoder(config));
    // etc.
  }

  /**
   * Register a provider client
   */
  registerProvider(name: string, client: ProviderClient): void {
    this.providers.set(name, client);
  }

  /**
   * Forward geocoding: address → coordinates
   * Returns array of possible matches (typically sorted by confidence)
   */
  async geocode(address: string): Promise<GeocodingResult[]> {
    this.stats.geocodes++;

    // Check cache
    if (this.cache) {
      const cacheKey = this.cache.generateGeocodeKey(address, 'all');
      const cached = await this.cache.get<GeocodingResult[]>(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return cached.map((r) => ({ ...r, cached: true }));
      }
      this.stats.cacheMisses++;
    }

    // Try providers in order
    for (const providerName of this.providerOrder) {
      try {
        await this.rateLimiters.get(providerName)?.acquire();
        const provider = this.providers.get(providerName);

        if (!provider) {
          // Provider not configured, skip to next
          if (this.providerOrder.indexOf(providerName) > 0) {
            this.stats.failovers++;
          }
          continue;
        }

        const results = await provider.geocode(address);

        if (results.length > 0) {
          // Cache results
          if (this.cache) {
            const cacheKey = this.cache.generateGeocodeKey(address, providerName);
            await this.cache.set(cacheKey, results, this.cache['GEOCODE_TTL'] || 86400, providerName);
          }

          return results.map((r) => ({ ...r, cached: false }));
        }
      } catch (error) {
        console.warn(`Geocoding failed for provider ${providerName}:`, error);
        if (this.providerOrder.indexOf(providerName) > 0) {
          this.stats.failovers++;
        }
        // Continue to next provider
      }
    }

    throw new Error(`Geocoding failed for address: ${address} (all providers exhausted)`);
  }

  /**
   * Reverse geocoding: coordinates → address
   */
  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
    this.stats.reverseGeocodes++;

    // Check cache
    if (this.cache) {
      const cacheKey = this.cache.generateReverseGeocodeKey(lat, lng, 'all');
      const cached = await this.cache.get<ReverseGeocodeResult>(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return { ...cached, cached: true };
      }
      this.stats.cacheMisses++;
    }

    // Try providers in order
    for (const providerName of this.providerOrder) {
      try {
        await this.rateLimiters.get(providerName)?.acquire();
        const provider = this.providers.get(providerName);

        if (!provider) {
          if (this.providerOrder.indexOf(providerName) > 0) {
            this.stats.failovers++;
          }
          continue;
        }

        const result = await provider.reverseGeocode(lat, lng);

        // Cache result
        if (this.cache) {
          const cacheKey = this.cache.generateReverseGeocodeKey(lat, lng, providerName);
          await this.cache.set(cacheKey, result, 86400, providerName); // 24hr TTL
        }

        return { ...result, cached: false };
      } catch (error) {
        console.warn(`Reverse geocoding failed for provider ${providerName}:`, error);
        if (this.providerOrder.indexOf(providerName) > 0) {
          this.stats.failovers++;
        }
        // Continue to next provider
      }
    }

    throw new Error(
      `Reverse geocoding failed for coordinates: ${lat},${lng} (all providers exhausted)`
    );
  }

  /**
   * Autocomplete/type-ahead: partial input → suggestions
   */
  async autocomplete(input: string): Promise<AutocompleteResult[]> {
    this.stats.autocompletes++;

    if (input.length < 2) {
      return [];
    }

    // Check cache
    if (this.cache) {
      const cacheKey = this.cache.generateAutocompleteKey(input, 'all');
      const cached = await this.cache.get<AutocompleteResult[]>(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
      this.stats.cacheMisses++;
    }

    // Try providers in order
    for (const providerName of this.providerOrder) {
      try {
        await this.rateLimiters.get(providerName)?.acquire();
        const provider = this.providers.get(providerName);

        if (!provider) {
          continue;
        }

        const results = await provider.autocomplete(input);

        if (results.length > 0) {
          // Cache results with shorter TTL
          if (this.cache) {
            const cacheKey = this.cache.generateAutocompleteKey(input, providerName);
            await this.cache.set(cacheKey, results, 3600, providerName); // 1hr TTL
          }

          return results;
        }
      } catch (error) {
        console.warn(`Autocomplete failed for provider ${providerName}:`, error);
        // Continue to next provider
      }
    }

    return [];
  }

  /**
   * Batch geocoding
   */
  async batchGeocode(addresses: string[]): Promise<Map<string, GeocodingResult[]>> {
    const results = new Map<string, GeocodingResult[]>();

    for (const address of addresses) {
      try {
        const result = await this.geocode(address);
        results.set(address, result);
      } catch (error) {
        console.warn(`Batch geocoding failed for address: ${address}`, error);
        results.set(address, []);
      }
    }

    return results;
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      providers: Array.from(this.providers.keys()),
      rateLimiters: Array.from(this.rateLimiters.entries()).map(([name, limiter]) => ({
        name,
        remaining: limiter.remaining(),
      })),
    };
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.flush();
    }
  }
}

/**
 * Simple rate limiter (token bucket algorithm)
 */
class RateLimiter {
  private tokens: number;
  private capacity: number;
  private refillRate: number;
  private lastRefillTime: number;

  constructor(requestsPerSecond: number) {
    this.capacity = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.refillRate = requestsPerSecond;
    this.lastRefillTime = Date.now();
  }

  async acquire(): Promise<void> {
    while (this.tokens < 1) {
      this.refill();
      if (this.tokens < 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefillTime) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  remaining(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}
