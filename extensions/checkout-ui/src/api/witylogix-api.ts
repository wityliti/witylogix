/**
 * Witylogix API Client for Checkout Extension
 * Handles all communication with the Witylogix backend
 */

import { z } from 'zod';

// Type definitions
export interface SlotAvailability {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  label: string;
  timeGroup: 'morning' | 'afternoon' | 'evening';
  capacity: number;
  reserved: number;
  price: number; // In cents
  available: boolean;
}

export interface ZoneRate {
  zone: string;
  baseFee: number; // In cents
  perMile: number; // In cents
  estimatedDelivery: string;
}

export interface Reservation {
  slotId: string;
  cartId: string;
  reservationId: string;
  expiresAt: string; // ISO 8601
  confirmationCode: string;
}

export interface GeocodingResult {
  address: string;
  latitude: number;
  longitude: number;
  zipcode: string;
  city: string;
  state: string;
}

// Validation schemas
const SlotAvailabilitySchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string(),
  timeGroup: z.enum(['morning', 'afternoon', 'evening']),
  capacity: z.number().int().positive(),
  reserved: z.number().int().nonnegative(),
  price: z.number().int().nonnegative(),
  available: z.boolean(),
});

const ZoneRateSchema = z.object({
  zone: z.string(),
  baseFee: z.number().int().nonnegative(),
  perMile: z.number().int().nonnegative(),
  estimatedDelivery: z.string(),
});

const ReservationSchema = z.object({
  slotId: z.string(),
  cartId: z.string(),
  reservationId: z.string(),
  expiresAt: z.string().datetime(),
  confirmationCode: z.string(),
});

const GeocodingResultSchema = z.object({
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  zipcode: z.string(),
  city: z.string(),
  state: z.string(),
});

/**
 * API Client class
 */
export class WitylogixAPI {
  private apiUrl: string;
  private apiKey: string;
  private shopDomain: string;
  private sessionToken: string = '';

  constructor(apiUrl: string, apiKey: string, shopDomain: string) {
    this.apiUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
    this.shopDomain = shopDomain;
  }

  /**
   * Get session token from Shopify App Bridge
   */
  private async getSessionToken(): Promise<string> {
    if (this.sessionToken) {
      return this.sessionToken;
    }

    if (typeof window !== 'undefined') {
      const token = (window as any).__SHOPIFY_SESSION_TOKEN__;
      if (token) {
        this.sessionToken = token;
        return token;
      }
    }

    return '';
  }

  /**
   * Common fetch wrapper with error handling and validation
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: z.ZodSchema
  ): Promise<T> {
    const token = await this.getSessionToken();
    const url = `${this.apiUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      'X-Shop-Domain': this.shopDomain,
      ...options.headers as Record<string, string>,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error [${response.status}]: ${error || response.statusText}`);
    }

    const data = await response.json();

    if (schema) {
      try {
        return schema.parse(data);
      } catch (validationError) {
        console.error('Validation error:', validationError);
        throw new Error('Invalid response format from API');
      }
    }

    return data;
  }

  /**
   * Fetch available delivery slots for a specific date
   */
  async fetchSlots(date: string, shopDomain?: string): Promise<SlotAvailability[]> {
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }

    const domain = shopDomain || this.shopDomain;
    const endpoint = `/api/checkout/slots?date=${encodeURIComponent(date)}&shop=${encodeURIComponent(domain)}`;

    const response = await this.request<{ slots: unknown[] }>(endpoint);

    // Validate each slot
    const validatedSlots = z.array(SlotAvailabilitySchema).parse(response.slots);
    return validatedSlots;
  }

  /**
   * Fetch delivery rates for a zipcode
   */
  async fetchRates(zipcode: string, shopDomain?: string): Promise<ZoneRate> {
    if (!zipcode || zipcode.length < 3) {
      throw new Error('Invalid zipcode');
    }

    const domain = shopDomain || this.shopDomain;
    const endpoint = `/api/checkout/rates?zipcode=${encodeURIComponent(zipcode)}&shop=${encodeURIComponent(domain)}`;

    const response = await this.request<ZoneRate>(endpoint, {}, ZoneRateSchema);
    return response;
  }

  /**
   * Reserve a delivery slot
   */
  async reserveSlot(slotId: string, cartId: string): Promise<Reservation> {
    if (!slotId || !cartId) {
      throw new Error('Missing required parameters: slotId and cartId');
    }

    const endpoint = `/api/checkout/reserve`;

    const response = await this.request<Reservation>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({
          slotId,
          cartId,
          shopDomain: this.shopDomain,
        }),
      },
      ReservationSchema
    );

    return response;
  }

  /**
   * Geocode an address to get coordinates and zipcode
   */
  async geocodeAddress(address: string): Promise<GeocodingResult> {
    if (!address || address.trim().length < 5) {
      throw new Error('Address is too short or empty');
    }

    const endpoint = `/api/checkout/geocode?address=${encodeURIComponent(address)}`;

    const response = await this.request<GeocodingResult>(
      endpoint,
      {},
      GeocodingResultSchema
    );

    return response;
  }

  /**
   * Get address suggestions for autocomplete
   */
  async getAddressSuggestions(address: string): Promise<string[]> {
    if (!address || address.trim().length < 3) {
      return [];
    }

    const endpoint = `/api/checkout/address-suggestions?query=${encodeURIComponent(address)}`;

    const response = await this.request<{ suggestions: string[] }>(endpoint);
    return response.suggestions || [];
  }

  /**
   * Check service availability for an address
   */
  async checkServiceAvailability(zipcode: string): Promise<boolean> {
    if (!zipcode) {
      throw new Error('Zipcode is required');
    }

    const endpoint = `/api/checkout/availability?zipcode=${encodeURIComponent(zipcode)}`;

    const response = await this.request<{ available: boolean }>(endpoint);
    return response.available;
  }
}

/**
 * Initialize API client from shop metafields
 */
export async function initializeAPIClient(shopDomain: string): Promise<WitylogixAPI> {
  // In production, these would come from shop metafields
  // For now, get from environment variables
  const apiUrl = process.env.VITE_WITYLOGIX_API_URL || 'https://api.witylogix.app';
  const apiKey = process.env.VITE_WITYLOGIX_API_KEY || '';

  if (!apiKey) {
    throw new Error('Witylogix API key not configured');
  }

  return new WitylogixAPI(apiUrl, apiKey, shopDomain);
}
