/**
 * Witylogix API Client for WooCommerce Checkout Block
 * Handles all communication with the Witylogix backend
 * Uses WC Store API nonce for authentication
 */

import { z } from 'zod';

/**
 * Slot availability for a specific time period
 */
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

/**
 * Delivery rate for a zone
 */
export interface ZoneRate {
  zone: string;
  baseFee: number; // In cents
  perMile: number; // In cents
  estimatedDelivery: string;
}

/**
 * Slot reservation result
 */
export interface SlotReservation {
  slotId: string;
  orderId: string;
  reservationId: string;
  expiresAt: string; // ISO 8601
  confirmationCode: string;
}

/**
 * Address validation result
 */
export interface AddressValidationResult {
  valid: boolean;
  address?: {
    street: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  zone?: string;
  message?: string;
}

/**
 * Validation schemas
 */
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

const SlotReservationSchema = z.object({
  slotId: z.string(),
  orderId: z.string(),
  reservationId: z.string(),
  expiresAt: z.string().datetime(),
  confirmationCode: z.string(),
});

const AddressValidationSchema = z.object({
  valid: z.boolean(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipcode: z.string(),
    country: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  zone: z.string().optional(),
  message: z.string().optional(),
});

/**
 * WooCommerce Checkout Block API Client
 */
export class WitylogixAPI {
  private apiUrl: string;
  private merchantId: string;
  private nonce: string = '';

  constructor(apiUrl: string, merchantId: string) {
    this.apiUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.merchantId = merchantId;
  }

  /**
   * Get WC Store API nonce from page
   */
  private getNonce(): string {
    if (this.nonce) {
      return this.nonce;
    }

    if (typeof window !== 'undefined') {
      const nonce = (window as any)?.wc?.wcStoreApiNonce ||
                    (document.querySelector('meta[name="wc-store-api-nonce"]') as HTMLMetaElement)?.content ||
                    '';
      if (nonce) {
        this.nonce = nonce;
        return nonce;
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
    const url = `${this.apiUrl}${endpoint}`;
    const nonce = this.getNonce();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Merchant-ID': this.merchantId,
      ...options.headers as Record<string, string>,
    };

    if (nonce) {
      headers['X-WC-Store-API-Nonce'] = nonce;
    }

    try {
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

      return data as T;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * Fetch available delivery slots for a specific date
   */
  async fetchAvailableSlots(date: string, zoneId?: string): Promise<SlotAvailability[]> {
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }

    const params = new URLSearchParams({ date });
    if (zoneId) {
      params.append('zone_id', zoneId);
    }

    const endpoint = `/wc/v1/witylogix/slots?${params.toString()}`;

    const response = await this.request<{ slots: unknown[] }>(endpoint);

    // Validate each slot
    const validatedSlots = z.array(SlotAvailabilitySchema).parse(response.slots);
    return validatedSlots;
  }

  /**
   * Fetch delivery rates based on shipping address
   */
  async fetchZoneRates(address: {
    street: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
  }): Promise<ZoneRate> {
    const params = new URLSearchParams({
      zip: address.zipcode,
      country: address.country,
    });

    const endpoint = `/wc/v1/witylogix/rates?${params.toString()}`;

    const response = await this.request<ZoneRate>(
      endpoint,
      {},
      ZoneRateSchema
    );

    return response;
  }

  /**
   * Reserve a delivery slot for an order
   */
  async reserveSlot(slotId: string, orderId: string): Promise<SlotReservation> {
    if (!slotId || !orderId) {
      throw new Error('Missing required parameters: slotId and orderId');
    }

    const endpoint = `/wc/v1/witylogix/reserve`;

    const response = await this.request<SlotReservation>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({
          slotId,
          orderId,
        }),
      },
      SlotReservationSchema
    );

    return response;
  }

  /**
   * Validate shipping address and get zone information
   */
  async validateAddress(address: {
    street: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
  }): Promise<AddressValidationResult> {
    const endpoint = `/wc/v1/witylogix/validate-address`;

    const response = await this.request<AddressValidationResult>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(address),
      },
      AddressValidationSchema
    );

    return response;
  }

  /**
   * Check if delivery service is available for a zipcode
   */
  async checkServiceAvailability(zipcode: string, country: string = 'US'): Promise<boolean> {
    if (!zipcode) {
      throw new Error('Zipcode is required');
    }

    const params = new URLSearchParams({ zip: zipcode, country });
    const endpoint = `/wc/v1/witylogix/availability?${params.toString()}`;

    const response = await this.request<{ available: boolean }>(endpoint);
    return response.available;
  }
}

/**
 * Initialize API client
 */
export function createWitylogixAPI(apiUrl: string, merchantId: string): WitylogixAPI {
  if (!apiUrl) {
    throw new Error('Witylogix API URL is required');
  }

  if (!merchantId) {
    throw new Error('Merchant ID is required');
  }

  return new WitylogixAPI(apiUrl, merchantId);
}
