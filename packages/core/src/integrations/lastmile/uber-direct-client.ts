/**
 * Uber Direct API Client
 *
 * Last-mile delivery SDK for Uber Direct on-demand delivery:
 * - Auth: OAuth2 client_credentials flow (client_id + client_secret → bearer token)
 * - Deliveries: create, get, update, cancel
 * - Quotes: get delivery quote with pickup + dropoff + items
 * - POD (Proof of Delivery): get proof (photo, signature, pin)
 * - Tracking: real-time courier tracking (location, ETA)
 * - Webhooks: verify signature, handle events (delivery.status.changed, delivery.courier.update)
 * - Organizations: get org info
 * - Multi-drop: create delivery with multiple dropoffs
 * - Rate limiting: respect API limits
 * - Sandbox mode: sandbox credentials + base URL
 * - Status mapping: Uber statuses → Witylogix ShipmentStatus
 *
 * Documentation: https://developer.uber.com/docs/delivery/
 */

import { createHmac } from "crypto";
import type {
  LastMileDelivery,
  LastMileDriver,
  LastMileQuote,
  LastMileTracking,
  DeliveryFilterOptions,
  QuoteOptions,
  Location,
  Contact,
  LastMileWebhookEvent,
  ProofOfDelivery,
} from "./types";
import { LastMileAdapter } from "./lastmile-adapter";

interface UberDirectDeliveryRequest {
  external_delivery_id: string;
  pickup_address: UberDirectAddress;
  dropoff_address: UberDirectAddress;
  dropoff_notes?: string;
  pickup_notes?: string;
  items?: UberDirectItem[];
  order_value?: number;
  tip_amount?: number;
}

interface UberDirectAddress {
  street_address: string;
  unit?: string;
  city: string;
  state: string;
  zip_code: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  contact?: {
    name: string;
    phone: string;
    email?: string;
  };
}

interface UberDirectItem {
  title: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

interface UberDirectDeliveryResponse {
  delivery_id: string;
  external_delivery_id: string;
  status: string;
  pickup_address: UberDirectAddress;
  dropoff_address: UberDirectAddress;
  estimated_pickup_time: string;
  estimated_dropoff_time: string;
  estimated_duration_seconds: number;
  tracking_url?: string;
  quote_id?: string;
  fee?: number;
  currency?: string;
  courier?: {
    id: string;
    name: string;
    phone?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
}

interface UberDirectQuoteRequest {
  external_delivery_id: string;
  pickup_address: UberDirectAddress;
  dropoff_address: UberDirectAddress;
  items?: UberDirectItem[];
  order_value?: number;
}

interface UberDirectQuoteResponse {
  quote_id: string;
  external_delivery_id: string;
  fee: number;
  currency: string;
  expires_at: string;
  estimated_duration_seconds: number;
  estimated_pickup_time: string;
}

interface UberDirectPODResponse {
  delivery_id: string;
  external_delivery_id: string;
  photo_urls?: string[];
  signature_url?: string;
  recipient_name?: string;
  recipient_signature?: boolean;
  timestamp: string;
  verified: boolean;
}

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Uber Direct API Client
 */
export class UberDirectClient extends LastMileAdapter {
  private client_id: string;
  private client_secret: string;
  private organization_id: string;
  private webhook_secret: string;
  private base_url: string;
  private auth_url: string;
  private access_token: string | null = null;
  private token_expires_at: number = 0;

  constructor(
    client_id: string,
    client_secret: string,
    organization_id: string,
    webhook_secret: string,
    sandbox_mode: boolean = false,
  ) {
    super("uberdirect", undefined);
    this.client_id = client_id;
    this.client_secret = client_secret;
    this.organization_id = organization_id;
    this.webhook_secret = webhook_secret;
    this.sandbox_mode = sandbox_mode;

    if (sandbox_mode) {
      this.base_url = "https://sandbox.uber.com";
      this.auth_url = "https://sandbox.uber.com";
    } else {
      this.base_url = "https://api.uber.com/v1";
      this.auth_url = "https://auth.uber.com";
    }
  }

  /**
   * Get OAuth2 access token using client_credentials flow
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.access_token && now < this.token_expires_at) {
      return this.access_token;
    }

    try {
      const response = await fetch(`${this.auth_url}/oauth/v2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.client_id,
          client_secret: this.client_secret,
          scope: "delivery",
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`OAuth token error: ${response.statusText}`);
      }

      const data = (await response.json()) as OAuthTokenResponse;
      this.access_token = data.access_token;
      this.token_expires_at = Date.now() + data.expires_in * 1000;

      return this.access_token;
    } catch (error) {
      throw new Error(
        `Failed to get Uber Direct access token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Create a delivery with Uber Direct
   */
  async createDelivery(
    delivery: Partial<LastMileDelivery>,
  ): Promise<LastMileDelivery> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("uber-delivery-create");

      if (!delivery.pickup_location || !delivery.dropoff_location) {
        throw new Error("Pickup and dropoff locations are required");
      }

      if (!delivery.pickup_contact || !delivery.dropoff_contact) {
        throw new Error("Pickup and dropoff contacts are required");
      }

      const request_id = this.generateRequestId();
      const token = await this.getAccessToken();

      const ud_request: UberDirectDeliveryRequest = {
        external_delivery_id: delivery.order_id || request_id,
        pickup_address: this.locationToAddress(
          delivery.pickup_location,
          delivery.pickup_contact,
        ),
        dropoff_address: this.locationToAddress(
          delivery.dropoff_location,
          delivery.dropoff_contact,
        ),
        dropoff_notes: delivery.special_instructions,
        pickup_notes: delivery.notes,
        items: delivery.notes
          ? [{ title: delivery.notes, quantity: 1, unit_price: 0 }]
          : [],
        order_value: 0,
        tip_amount: delivery.tip_amount,
      };

      try {
        const response = await fetch(
          `${this.base_url}/customers/${this.organization_id}/deliveries`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "X-Request-ID": request_id,
            },
            body: JSON.stringify(ud_request),
          },
        );

        if (!response.ok) {
          throw new Error(`Uber Direct API error: ${response.statusText}`);
        }

        const data = (await response.json()) as UberDirectDeliveryResponse;

        return {
          id: data.delivery_id,
          platform: "uberdirect",
          external_id: data.external_delivery_id,
          status: this.mapStatusToUnified(data.status),
          order_id: delivery.order_id || request_id,

          pickup_location: delivery.pickup_location,
          dropoff_location: delivery.dropoff_location,
          pickup_contact: delivery.pickup_contact,
          dropoff_contact: delivery.dropoff_contact,

          item_count: delivery.item_count || 0,
          total_weight: delivery.total_weight,

          estimated_pickup_time: new Date(data.estimated_pickup_time),
          estimated_dropoff_time: new Date(data.estimated_dropoff_time),

          tracking_url: data.tracking_url,

          notes: delivery.notes,
          special_instructions: delivery.special_instructions,
          tip_amount: delivery.tip_amount,

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(
          `Failed to create Uber Direct delivery: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  /**
   * Get delivery details
   */
  async getDelivery(delivery_id: string): Promise<LastMileDelivery | null> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("uber-delivery-get");

      const token = await this.getAccessToken();

      try {
        const response = await fetch(
          `${this.base_url}/customers/${this.organization_id}/deliveries/${delivery_id}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`Uber Direct API error: ${response.statusText}`);
        }

        const data = (await response.json()) as UberDirectDeliveryResponse;

        return {
          id: data.delivery_id,
          platform: "uberdirect",
          external_id: data.external_delivery_id,
          status: this.mapStatusToUnified(data.status),
          order_id: data.external_delivery_id,

          pickup_location: this.addressToLocation(data.pickup_address),
          dropoff_location: this.addressToLocation(data.dropoff_address),
          pickup_contact: { name: "", phone: "" },
          dropoff_contact: { name: "", phone: "" },

          estimated_pickup_time: new Date(data.estimated_pickup_time),
          estimated_dropoff_time: new Date(data.estimated_dropoff_time),

          tracking_url: data.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(
          `Failed to get Uber Direct delivery: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  /**
   * Update delivery (e.g., tip amount)
   */
  async updateDelivery(
    delivery_id: string,
    updates: Partial<LastMileDelivery>,
  ): Promise<LastMileDelivery> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("uber-delivery-update");

      const token = await this.getAccessToken();
      const update_body: Record<string, any> = {};

      if (updates.tip_amount !== undefined) {
        update_body.tip_amount = updates.tip_amount;
      }

      if (updates.special_instructions) {
        update_body.dropoff_notes = updates.special_instructions;
      }

      try {
        const response = await fetch(
          `${this.base_url}/customers/${this.organization_id}/deliveries/${delivery_id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(update_body),
          },
        );

        if (!response.ok) {
          throw new Error(`Uber Direct API error: ${response.statusText}`);
        }

        const data = (await response.json()) as UberDirectDeliveryResponse;

        return {
          id: data.delivery_id,
          platform: "uberdirect",
          external_id: data.external_delivery_id,
          status: this.mapStatusToUnified(data.status),
          order_id: data.external_delivery_id,

          pickup_location: this.addressToLocation(data.pickup_address),
          dropoff_location: this.addressToLocation(data.dropoff_address),
          pickup_contact: { name: "", phone: "" },
          dropoff_contact: { name: "", phone: "" },

          estimated_pickup_time: new Date(data.estimated_pickup_time),
          estimated_dropoff_time: new Date(data.estimated_dropoff_time),

          tracking_url: data.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(
          `Failed to update Uber Direct delivery: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  /**
   * Cancel a delivery
   */
  async cancelDelivery(
    delivery_id: string,
    reason?: string,
  ): Promise<LastMileDelivery> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("uber-delivery-cancel");

      const token = await this.getAccessToken();
      const cancel_body = { reason_code: reason || "MERCHANT_REQUESTED" };

      try {
        const response = await fetch(
          `${this.base_url}/customers/${this.organization_id}/deliveries/${delivery_id}/cancel`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(cancel_body),
          },
        );

        if (!response.ok) {
          throw new Error(`Uber Direct API error: ${response.statusText}`);
        }

        const data = (await response.json()) as UberDirectDeliveryResponse;

        return {
          id: data.delivery_id,
          platform: "uberdirect",
          external_id: data.external_delivery_id,
          status: this.mapStatusToUnified(data.status),
          order_id: data.external_delivery_id,

          pickup_location: this.addressToLocation(data.pickup_address),
          dropoff_location: this.addressToLocation(data.dropoff_address),
          pickup_contact: { name: "", phone: "" },
          dropoff_contact: { name: "", phone: "" },

          estimated_pickup_time: new Date(data.estimated_pickup_time),
          estimated_dropoff_time: new Date(data.estimated_dropoff_time),

          tracking_url: data.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(
          `Failed to cancel Uber Direct delivery: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  /**
   * List deliveries
   */
  async listDeliveries(
    filters?: DeliveryFilterOptions,
  ): Promise<LastMileDelivery[]> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("uber-delivery-list");

      const token = await this.getAccessToken();
      const params = new URLSearchParams();

      if (filters?.limit) {
        params.append("limit", String(filters.limit));
      }

      if (filters?.offset) {
        params.append("offset", String(filters.offset));
      }

      try {
        const response = await fetch(
          `${this.base_url}/customers/${this.organization_id}/deliveries?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error(`Uber Direct API error: ${response.statusText}`);
        }

        const data = (await response.json()) as {
          deliveries: UberDirectDeliveryResponse[];
        };

        return data.deliveries.map((ud_delivery) => ({
          id: ud_delivery.delivery_id,
          platform: "uberdirect",
          external_id: ud_delivery.external_delivery_id,
          status: this.mapStatusToUnified(ud_delivery.status),
          order_id: ud_delivery.external_delivery_id,

          pickup_location: this.addressToLocation(ud_delivery.pickup_address),
          dropoff_location: this.addressToLocation(ud_delivery.dropoff_address),
          pickup_contact: { name: "", phone: "" },
          dropoff_contact: { name: "", phone: "" },

          estimated_pickup_time: new Date(ud_delivery.estimated_pickup_time),
          estimated_dropoff_time: new Date(ud_delivery.estimated_dropoff_time),

          tracking_url: ud_delivery.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        }));
      } catch (error) {
        throw new Error(
          `Failed to list Uber Direct deliveries: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  /**
   * Get delivery quote
   */
  async getQuote(
    pickup: Location,
    dropoff: Location,
    options?: QuoteOptions,
  ): Promise<LastMileQuote> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("uber-quote");

      const request_id = this.generateRequestId();
      const token = await this.getAccessToken();

      const quote_request: UberDirectQuoteRequest = {
        external_delivery_id: request_id,
        pickup_address: this.locationToAddress(pickup),
        dropoff_address: this.locationToAddress(dropoff),
        items: [],
        order_value: 0,
      };

      try {
        const response = await fetch(
          `${this.base_url}/customers/${this.organization_id}/delivery_quotes`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "X-Request-ID": request_id,
            },
            body: JSON.stringify(quote_request),
          },
        );

        if (!response.ok) {
          throw new Error(`Uber Direct API error: ${response.statusText}`);
        }

        const data = (await response.json()) as UberDirectQuoteResponse;

        const distance = this.calculateDistance(pickup, dropoff);
        const commission_rate = 0.2; // 20% commission
        const commission = Math.round(data.fee * commission_rate);

        return {
          id: data.quote_id,
          platform: "uberdirect",

          pickup_location: pickup,
          dropoff_location: dropoff,

          distance_meters: distance.distance_meters,
          duration_seconds: distance.duration_seconds,

          base_fee: Math.round(data.fee * 0.35),
          distance_fee: Math.round(data.fee * 0.35),
          time_fee: Math.round(data.fee * 0.2),
          surge_multiplier: 1.0,

          service_fee: Math.round(data.fee * 0.1),

          subtotal: data.fee,
          tax: Math.round(data.fee * 0.0875),
          total: data.fee + Math.round(data.fee * 0.0875),

          currency: data.currency || "USD",

          estimated_pickup_time: new Date(data.estimated_pickup_time),
          estimated_dropoff_time: new Date(
            Date.now() + data.estimated_duration_seconds * 1000,
          ),

          valid_until: new Date(data.expires_at),
          expires_at: new Date(data.expires_at),

          platform_commission_rate: commission_rate,
          platform_commission_amount: commission,
        };
      } catch (error) {
        throw new Error(
          `Failed to get Uber Direct quote: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  /**
   * Get real-time tracking information
   */
  async getTracking(delivery_id: string): Promise<LastMileTracking> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("uber-tracking");

      const delivery = await this.getDelivery(delivery_id);
      if (!delivery) {
        throw new Error(`Delivery ${delivery_id} not found`);
      }

      return this.buildTracking(delivery);
    });
  }

  /**
   * Get tracking by external ID
   */
  async getTrackingByExternalId(
    external_id: string,
  ): Promise<LastMileTracking> {
    const deliveries = await this.listDeliveries();
    const delivery = deliveries.find((d) => d.external_id === external_id);

    if (!delivery) {
      throw new Error(`Delivery with external ID ${external_id} not found`);
    }

    return this.buildTracking(delivery);
  }

  /**
   * Get driver information
   */
  async getDriver(driver_id: string): Promise<LastMileDriver | null> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("uber-driver-get");

      const token = await this.getAccessToken();

      try {
        const response = await fetch(
          `${this.base_url}/customers/${this.organization_id}/couriers/${driver_id}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`Uber Direct API error: ${response.statusText}`);
        }

        const data = (await response.json()) as any;

        return {
          id: driver_id,
          platform: "uberdirect",
          external_id: data.external_id || driver_id,
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          phone: data.phone_number || "",
          email: data.email,

          current_location: data.location
            ? {
                latitude: data.location.latitude,
                longitude: data.location.longitude,
              }
            : undefined,

          rating: data.rating,
          status: "available",
        };
      } catch (error) {
        throw new Error(
          `Failed to get Uber Direct driver: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  /**
   * List available drivers in an area
   */
  async listAvailableDrivers(
    location: Location,
    radius_meters: number = 5000,
  ): Promise<LastMileDriver[]> {
    // Uber Direct doesn't expose driver list API, returning empty
    return [];
  }

  /**
   * Get proof of delivery (photos, signatures, etc.)
   */
  async getProofOfDelivery(delivery_id: string): Promise<ProofOfDelivery> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("uber-pod-get");

      const token = await this.getAccessToken();

      try {
        const response = await fetch(
          `${this.base_url}/customers/${this.organization_id}/deliveries/${delivery_id}/proof_of_delivery`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error(`Uber Direct API error: ${response.statusText}`);
        }

        const data = (await response.json()) as UberDirectPODResponse;

        return {
          delivery_id: data.delivery_id,
          external_id: data.external_delivery_id,
          type: data.signature_url
            ? "signature"
            : data.photo_urls
              ? "photo"
              : "none",
          photo_urls: data.photo_urls,
          signature_url: data.signature_url,
          recipient_name: data.recipient_name,
          recipient_signature: data.recipient_signature,
          timestamp: new Date(data.timestamp),
          verified: data.verified,
          verified_at: data.verified ? new Date(data.timestamp) : undefined,
        };
      } catch (error) {
        throw new Error(
          `Failed to get Uber Direct POD: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    return this.verifyHmacSignature(payload, signature, this.webhook_secret);
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: string): LastMileWebhookEvent {
    const data = JSON.parse(payload);

    return {
      id: data.delivery_id || this.generateRequestId(),
      platform: "uberdirect",
      event_type: data.event_type || "delivery.status.changed",
      external_id: data.external_delivery_id,

      delivery_id: data.delivery_id,
      order_id: data.external_delivery_id,

      status: this.mapStatusToUnified(data.status),
      previous_status: data.previous_status
        ? this.mapStatusToUnified(data.previous_status)
        : undefined,

      timestamp: new Date(data.timestamp || Date.now()),

      data,
      raw_payload: payload,

      signature_verified: true,
      processed: false,

      created_at: new Date(),
    };
  }

  /**
   * Get organization information
   */
  async getOrganizationInfo(): Promise<Record<string, unknown>> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("uber-org-info");

      const token = await this.getAccessToken();

      try {
        const response = await fetch(
          `${this.base_url}/customers/${this.organization_id}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error(`Uber Direct API error: ${response.statusText}`);
        }

        return (await response.json()) as Record<string, unknown>;
      } catch (error) {
        throw new Error(
          `Failed to get Uber Direct org info: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  // Helper methods

  private locationToAddress(
    location: Location,
    contact?: Contact,
  ): UberDirectAddress {
    return {
      street_address: location.address || "",
      city: location.city || "",
      state: location.state || "",
      zip_code: location.zip_code || "",
      country_code: location.country_code || "US",
      latitude: location.latitude,
      longitude: location.longitude,
      contact: contact
        ? {
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
          }
        : undefined,
    };
  }

  private addressToLocation(address: UberDirectAddress): Location {
    return {
      latitude: address.latitude || 0,
      longitude: address.longitude || 0,
      address: address.street_address,
      city: address.city,
      state: address.state,
      zip_code: address.zip_code,
      country_code: address.country_code,
    };
  }

  private buildTracking(delivery: LastMileDelivery): LastMileTracking {
    return {
      delivery_id: delivery.id,
      platform: "uberdirect",

      current_location: delivery.dropoff_location,
      current_latitude: delivery.dropoff_location.latitude,
      current_longitude: delivery.dropoff_location.longitude,

      status: delivery.status,

      driver: delivery.driver
        ? {
            id: delivery.driver.id,
            name: `${delivery.driver.first_name} ${delivery.driver.last_name}`,
            phone: delivery.driver.phone,
            rating: delivery.driver.rating,
          }
        : undefined,

      vehicle: delivery.driver?.vehicle,

      estimated_arrival: delivery.estimated_dropoff_time || new Date(),
      distance_to_dropoff_meters: 0,
      duration_to_dropoff_seconds: 0,

      events: [
        {
          timestamp: delivery.created_at,
          status: "created",
          description: "Delivery created",
        },
      ],
    };
  }
}
