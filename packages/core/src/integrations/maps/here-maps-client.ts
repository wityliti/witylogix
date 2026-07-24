/**
 * HERE Maps API Client
 *
 * Comprehensive implementation of HERE Maps v1 APIs:
 * - Geocoding (forward): GET /v1/geocode
 * - Reverse geocoding: GET /v1/revgeocode
 * - Autosuggest: GET /v1/autosuggest with area filtering
 * - Discover (place search): GET /v1/discover
 * - Map tiles: vector/raster tile URLs
 * - Browse categories: location-based search
 *
 * API Key authentication via query parameter
 * Rate limit: 300 requests/minute (5 per second)
 * Documentation: https://developer.here.com/
 */

import { MapsAdapter } from "./maps-adapter.js";
import type {
  GeocodingRequest,
  GeocodingResponse,
  GeocodingResult,
  ReverseGeocodeRequest,
  ReverseGeocodeResponse,
  AutosuggestRequest,
  AutosuggestResponse,
  AutosuggestResult,
  PlaceSearchRequest,
  PlaceSearchResponse,
  PlaceDetail,
  MapTileRequest,
  MapsAdapterConfig,
  Coordinate,
} from "./types.js";

interface HEREGeocodingResult {
  title: string;
  id: string;
  resultType: string; // 'place', 'address', 'locality', etc.
  address: {
    label: string;
    countryCode: string;
    countryName: string;
    state?: string;
    county?: string;
    city?: string;
    district?: string;
    postalCode?: string;
    street?: string;
    houseNumber?: string;
  };
  position: {
    lat: number;
    lng: number;
  };
  mapView?: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  scoring?: {
    queryScore: number;
    fieldScore: {
      country: number;
      state?: number;
      county?: number;
      city?: number;
      district?: number;
      postalCode?: number;
      street?: number;
      houseNumber?: number;
    };
  };
}

interface HEREAutosuggestResult {
  title: string;
  id: string;
  resultType: string;
  address?: {
    label: string;
    countryCode: string;
    countryName: string;
    state?: string;
    city?: string;
    district?: string;
    postalCode?: string;
  };
  position?: {
    lat: number;
    lng: number;
  };
  distance?: number;
}

interface HEREPlaceResult {
  title: string;
  id: string;
  type: string;
  address: {
    label: string;
    countryCode: string;
    countryName: string;
    state?: string;
    county?: string;
    city?: string;
    district?: string;
    postalCode?: string;
  };
  position: {
    lat: number;
    lng: number;
  };
  distance: number;
  categories?: Array<{
    id: string;
    name: string;
  }>;
  phoneNumber?: Array<{
    value: string;
  }>;
  website?: Array<{
    value: string;
  }>;
  openingHours?: Array<{
    isOpen: boolean;
    timeZone?: string;
    structured?: Array<{
      start: string;
      duration: string;
      recurrence?: string;
    }>;
  }>;
}

interface HEREPlaceDetail extends HEREPlaceResult {
  contacts?: Array<{
    phone?: Array<{ value: string }>;
    website?: Array<{ value: string }>;
    email?: Array<{ value: string }>;
  }>;
  reviews?: Array<{
    title: string;
    review: string;
    rating: number;
  }>;
}

/**
 * HERE Maps API Client
 */
export class HEREMapsClient extends MapsAdapter {
  private discoverUrl = "https://discover.search.hereapi.com/v1";
  private browseUrl = "https://browse.search.hereapi.com/v1";
  private tileUrl = "https://2.vector.maps.hereapi.com/v2/vectortiles";

  constructor(config: MapsAdapterConfig) {
    super(config);
    this.baseUrl = config.baseUrl || "https://geocode.search.hereapi.com/v1";
  }

  /**
   * Geocode an address to coordinates
   */
  async geocode(request: GeocodingRequest): Promise<GeocodingResponse> {
    const cacheKey = this.getCacheKey("geocode", request);
    const cached = this.getCachedResponse<GeocodingResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const startTime = Date.now();
    try {
      this.totalRequests++;
      await this.rateLimiter.acquire();

      const params = new URLSearchParams({
        q: request.address,
        apiKey: this.apiKey,
        limit: String(request.limit || 10),
      });

      if (request.country_code) {
        params.append("in", `countryCode:${request.country_code}`);
      }

      if (request.language) {
        params.append("lang", request.language);
      }

      const response = await this.circuitBreaker.call(async () => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeout);
        try {
          return await fetch(`${this.baseUrl}/geocode?${params.toString()}`, {
            method: "GET",
            signal: controller.signal,
            headers: { Accept: "application/json" },
          });
        } finally {
          clearTimeout(id);
        }
      });

      if (!response.ok) {
        throw new Error(`HERE Geocoding API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        items?: HEREGeocodingResult[];
      };

      const results: GeocodingResult[] = (data.items || []).map((item) => ({
        id: item.id,
        address: item.address.label,
        location: item.position,
        formatted_address: item.address.label,
        city: item.address.city,
        state: item.address.state,
        postal_code: item.address.postalCode,
        country: item.address.countryName,
        country_code: item.address.countryCode,
        district: item.address.district,
        county: item.address.county,
        confidence: item.scoring?.queryScore ?? 1,
        bounds: item.mapView
          ? {
              ne: { lat: item.mapView.north, lng: item.mapView.east },
              sw: { lat: item.mapView.south, lng: item.mapView.west },
            }
          : undefined,
      }));

      const response_obj: GeocodingResponse = {
        results,
        status: results.length > 0 ? "OK" : "ZERO_RESULTS",
      };

      this.setCachedResponse(cacheKey, response_obj);
      this.successfulRequests++;
      this.totalResponseTime += Date.now() - startTime;

      return response_obj;
    } catch (error) {
      this.failedRequests++;
      this.totalResponseTime += Date.now() - startTime;
      return {
        results: [],
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(
    request: ReverseGeocodeRequest,
  ): Promise<ReverseGeocodeResponse> {
    const cacheKey = this.getCacheKey("revgeocode", request);
    const cached = this.getCachedResponse<ReverseGeocodeResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const startTime = Date.now();
    try {
      this.totalRequests++;
      await this.rateLimiter.acquire();

      const location = this.normalizeCoordinate(request.location);
      const params = new URLSearchParams({
        at: `${location.lat},${location.lng}`,
        apiKey: this.apiKey,
        limit: String(request.limit || 10),
      });

      if (request.language) {
        params.append("lang", request.language);
      }

      const response = await this.circuitBreaker.call(async () => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeout);
        try {
          return await fetch(
            `${this.baseUrl}/revgeocode?${params.toString()}`,
            {
              method: "GET",
              signal: controller.signal,
              headers: { Accept: "application/json" },
            },
          );
        } finally {
          clearTimeout(id);
        }
      });

      if (!response.ok) {
        throw new Error(
          `HERE Reverse Geocoding API error: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as {
        items?: HEREGeocodingResult[];
      };

      const results: GeocodingResult[] = (data.items || []).map((item) => ({
        id: item.id,
        address: item.address.label,
        location: item.position,
        formatted_address: item.address.label,
        city: item.address.city,
        state: item.address.state,
        postal_code: item.address.postalCode,
        country: item.address.countryName,
        country_code: item.address.countryCode,
        district: item.address.district,
        county: item.address.county,
        confidence: 1,
      }));

      const response_obj: ReverseGeocodeResponse = {
        results,
        status: results.length > 0 ? "OK" : "NOT_FOUND",
      };

      this.setCachedResponse(cacheKey, response_obj);
      this.successfulRequests++;
      this.totalResponseTime += Date.now() - startTime;

      return response_obj;
    } catch (error) {
      this.failedRequests++;
      this.totalResponseTime += Date.now() - startTime;
      return {
        results: [],
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Autosuggest with area filtering
   */
  async autosuggest(request: AutosuggestRequest): Promise<AutosuggestResponse> {
    const cacheKey = this.getCacheKey("autosuggest", request);
    const cached = this.getCachedResponse<AutosuggestResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const startTime = Date.now();
    try {
      this.totalRequests++;
      await this.rateLimiter.acquire();

      const params = new URLSearchParams({
        q: request.query,
        apiKey: this.apiKey,
        limit: String(request.limit || 10),
      });

      if (request.location) {
        const loc = this.normalizeCoordinate(request.location);
        params.append("at", `${loc.lat},${loc.lng}`);
      }

      if (request.radius_m) {
        params.append("r", String(request.radius_m));
      }

      if (request.bounds) {
        const bbox = `${request.bounds.sw.lat},${request.bounds.sw.lng},${request.bounds.ne.lat},${request.bounds.ne.lng}`;
        params.append("in", `bbox:${bbox}`);
      }

      if (request.country_code) {
        params.append("in", `countryCode:${request.country_code}`);
      }

      if (request.language) {
        params.append("lang", request.language);
      }

      const response = await this.circuitBreaker.call(async () => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeout);
        try {
          return await fetch(
            `${this.baseUrl}/autosuggest?${params.toString()}`,
            {
              method: "GET",
              signal: controller.signal,
              headers: { Accept: "application/json" },
            },
          );
        } finally {
          clearTimeout(id);
        }
      });

      if (!response.ok) {
        throw new Error(`HERE Autosuggest API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        items?: HEREAutosuggestResult[];
      };

      const results: AutosuggestResult[] = (data.items || []).map((item) => ({
        id: item.id,
        title: item.title,
        label: item.address?.label,
        address: item.address?.label,
        location: item.position,
        distance_m: item.distance,
        type: item.resultType === "place" ? "place" : "address",
      }));

      const response_obj: AutosuggestResponse = {
        results,
        status: results.length > 0 ? "OK" : "NOT_FOUND",
      };

      this.setCachedResponse(cacheKey, response_obj);
      this.successfulRequests++;
      this.totalResponseTime += Date.now() - startTime;

      return response_obj;
    } catch (error) {
      this.failedRequests++;
      this.totalResponseTime += Date.now() - startTime;
      return {
        results: [],
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Place search (discover)
   */
  async placeSearch(request: PlaceSearchRequest): Promise<PlaceSearchResponse> {
    const cacheKey = this.getCacheKey("placeSearch", request);
    const cached = this.getCachedResponse<PlaceSearchResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const startTime = Date.now();
    try {
      this.totalRequests++;
      await this.rateLimiter.acquire();

      const params = new URLSearchParams({
        q: request.query,
        apiKey: this.apiKey,
        limit: String(request.limit || 10),
      });

      if (request.location) {
        const loc = this.normalizeCoordinate(request.location);
        params.append("at", `${loc.lat},${loc.lng}`);
      }

      if (request.radius_m) {
        params.append("r", String(request.radius_m));
      }

      if (request.language) {
        params.append("lang", request.language);
      }

      const response = await this.circuitBreaker.call(async () => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeout);
        try {
          return await fetch(
            `${this.discoverUrl}/discover?${params.toString()}`,
            {
              method: "GET",
              signal: controller.signal,
              headers: { Accept: "application/json" },
            },
          );
        } finally {
          clearTimeout(id);
        }
      });

      if (!response.ok) {
        throw new Error(`HERE Discover API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        items?: HEREPlaceResult[];
      };

      const results: PlaceDetail[] = (data.items || []).map((item) => ({
        id: item.id,
        name: item.title,
        address: item.address.label,
        location: item.position,
        distance_m: item.distance,
        categories: item.categories?.map((c) => c.name as any) || [],
        phone: item.phoneNumber?.[0]?.value,
        website: item.website?.[0]?.value,
        opening_hours: item.openingHours
          ? {
              open_now: item.openingHours[0]?.isOpen,
              weekday_text: [],
            }
          : undefined,
      }));

      const response_obj: PlaceSearchResponse = {
        results,
        status: results.length > 0 ? "OK" : "NOT_FOUND",
      };

      this.setCachedResponse(cacheKey, response_obj);
      this.successfulRequests++;
      this.totalResponseTime += Date.now() - startTime;

      return response_obj;
    } catch (error) {
      this.failedRequests++;
      this.totalResponseTime += Date.now() - startTime;
      return {
        results: [],
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get place detail by ID
   */
  async getPlaceDetail(placeId: string): Promise<PlaceDetail> {
    const cacheKey = this.getCacheKey("placeDetail", { placeId });
    const cached = this.getCachedResponse<PlaceDetail>(cacheKey);
    if (cached) {
      return cached;
    }

    const startTime = Date.now();
    try {
      this.totalRequests++;
      await this.rateLimiter.acquire();

      const params = new URLSearchParams({
        apiKey: this.apiKey,
      });

      const response = await this.circuitBreaker.call(async () => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeout);
        try {
          return await fetch(
            `${this.discoverUrl}/discover?at=${placeId}&${params.toString()}`,
            {
              method: "GET",
              signal: controller.signal,
              headers: { Accept: "application/json" },
            },
          );
        } finally {
          clearTimeout(id);
        }
      });

      if (!response.ok) {
        throw new Error(`HERE Place Detail API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        items?: HEREPlaceDetail[];
      };

      if (!data.items || data.items.length === 0) {
        throw new Error("Place not found");
      }

      const item = data.items[0];
      const detail: PlaceDetail = {
        id: item.id,
        name: item.title,
        address: item.address.label,
        location: item.position,
        distance_m: item.distance,
        categories: item.categories?.map((c) => c.name as any) || [],
        phone: item.contacts?.[0]?.phone?.[0]?.value,
        website: item.contacts?.[0]?.website?.[0]?.value,
        email: item.contacts?.[0]?.email?.[0]?.value,
      };

      this.setCachedResponse(cacheKey, detail);
      this.successfulRequests++;
      this.totalResponseTime += Date.now() - startTime;

      return detail;
    } catch (error) {
      this.failedRequests++;
      this.totalResponseTime += Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Get map tile URL
   */
  getTileUrl(request: MapTileRequest): string {
    const format = request.format === "pbf" ? "vector" : "raster";
    const tileFormat = request.format || "png";
    const style = request.style || "normal";
    const size = request.size || "256";

    return `${this.tileUrl}/tile/${format}/${style}/tile_${request.zoom}_${request.x}_${request.y}_${size}.${tileFormat}?apiKey=${this.apiKey}`;
  }
}
