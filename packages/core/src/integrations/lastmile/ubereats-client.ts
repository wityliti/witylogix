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
} from "./types";
import { LastMileAdapter } from "./lastmile-adapter";

interface UberDirectDeliveryRequest {
  external_delivery_id: string;
  pickup: UberDirectLocation;
  dropoff: UberDirectLocation;
  items: UberDirectItem[];
  order_value: number;
  notes?: string;
}

interface UberDirectLocation {
  address: string;
  latitude: number;
  longitude: number;
  contact: {
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
  pickup: UberDirectLocation;
  dropoff: UberDirectLocation;
  estimated_pickup_time: string;
  estimated_dropoff_time: string;
  tracking_url: string;
  quote_id?: string;
}

interface UberDirectQuoteResponse {
  quote_id: string;
  expires_at: string;
  pickup: UberDirectLocation;
  dropoff: UberDirectLocation;
  fee: number;
  currency: string;
  estimated_duration_seconds: number;
}

export class UberEatsClient extends LastMileAdapter {
  private oauth_client_id: string;
  private oauth_client_secret: string;
  private oauth_token: string;
  private webhook_secret: string;
  private base_url: string;
  private token_expires_at: number = 0;

  constructor(
    oauth_client_id: string,
    oauth_client_secret: string,
    initial_token: string,
    webhook_secret: string,
    sandbox_mode: boolean = false,
  ) {
    super("ubereats", undefined);
    this.oauth_client_id = oauth_client_id;
    this.oauth_client_secret = oauth_client_secret;
    this.oauth_token = initial_token;
    this.webhook_secret = webhook_secret;
    this.sandbox_mode = sandbox_mode;
    this.base_url = sandbox_mode
      ? "https://sandbox.uber.com"
      : "https://api.uber.com";
  }

  private async refreshTokenIfNeeded(): Promise<void> {
    if (Date.now() < this.token_expires_at) {
      return;
    }

    const auth = Buffer.from(
      `${this.oauth_client_id}:${this.oauth_client_secret}`,
    ).toString("base64");

    try {
      const response = await fetch(`${this.base_url}/oauth/v2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials&scope=delivery.read delivery.write",
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      this.oauth_token = data.access_token;
      this.token_expires_at = Date.now() + (data.expires_in - 300) * 1000;
    } catch (error) {
      throw new Error(
        `Failed to refresh OAuth token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.oauth_token}`,
      "Content-Type": "application/json",
    };
  }

  async createDelivery(
    delivery: Partial<LastMileDelivery>,
  ): Promise<LastMileDelivery> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("ubereats-delivery-create");
      await this.refreshTokenIfNeeded();

      if (!delivery.pickup_location || !delivery.dropoff_location) {
        throw new Error("Pickup and dropoff locations are required");
      }

      if (!delivery.pickup_contact || !delivery.dropoff_contact) {
        throw new Error("Pickup and dropoff contacts are required");
      }

      const request_id = this.generateRequestId();
      const path = "/v1/deliveries";

      const uber_request: UberDirectDeliveryRequest = {
        external_delivery_id: delivery.order_id || request_id,
        pickup: this.locationToUberDirect(
          delivery.pickup_location,
          delivery.pickup_contact,
        ),
        dropoff: this.locationToUberDirect(
          delivery.dropoff_location,
          delivery.dropoff_contact,
        ),
        items: delivery.notes
          ? [{ title: delivery.notes, quantity: 1, unit_price: 0 }]
          : [],
        order_value: 0,
        notes: delivery.special_instructions,
      };

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: "POST",
          headers: {
            ...this.getAuthHeaders(),
            "X-Request-ID": request_id,
          },
          body: JSON.stringify(uber_request),
        });

        if (!response.ok) {
          throw new Error(`Uber Eats API error: ${response.statusText}`);
        }

        const data = (await response.json()) as UberDirectDeliveryResponse;

        return {
          id: data.delivery_id,
          platform: "ubereats",
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

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(
          `Failed to create Uber Eats delivery: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async getDelivery(delivery_id: string): Promise<LastMileDelivery | null> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("ubereats-delivery-get");
      await this.refreshTokenIfNeeded();

      const path = `/v1/deliveries/${delivery_id}`;

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: "GET",
          headers: this.getAuthHeaders(),
        });

        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`Uber Eats API error: ${response.statusText}`);
        }

        const data = (await response.json()) as UberDirectDeliveryResponse;

        return {
          id: data.delivery_id,
          platform: "ubereats",
          external_id: data.external_delivery_id,
          status: this.mapStatusToUnified(data.status),
          order_id: data.external_delivery_id,

          pickup_location: {
            latitude: data.pickup.latitude,
            longitude: data.pickup.longitude,
            address: data.pickup.address,
          },
          dropoff_location: {
            latitude: data.dropoff.latitude,
            longitude: data.dropoff.longitude,
            address: data.dropoff.address,
          },
          pickup_contact: data.pickup.contact,
          dropoff_contact: data.dropoff.contact,

          estimated_pickup_time: new Date(data.estimated_pickup_time),
          estimated_dropoff_time: new Date(data.estimated_dropoff_time),

          tracking_url: data.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(
          `Failed to get Uber Eats delivery: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async updateDelivery(
    delivery_id: string,
    updates: Partial<LastMileDelivery>,
  ): Promise<LastMileDelivery> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("ubereats-delivery-update");
      await this.refreshTokenIfNeeded();

      const path = `/v1/deliveries/${delivery_id}`;

      const update_body: Record<string, any> = {};
      if (updates.notes) update_body.notes = updates.notes;
      if (updates.special_instructions)
        update_body.special_instructions = updates.special_instructions;

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: "PATCH",
          headers: this.getAuthHeaders(),
          body: JSON.stringify(update_body),
        });

        if (!response.ok) {
          throw new Error(`Uber Eats API error: ${response.statusText}`);
        }

        const data = (await response.json()) as UberDirectDeliveryResponse;

        return {
          id: data.delivery_id,
          platform: "ubereats",
          external_id: data.external_delivery_id,
          status: this.mapStatusToUnified(data.status),
          order_id: data.external_delivery_id,

          pickup_location: {
            latitude: data.pickup.latitude,
            longitude: data.pickup.longitude,
            address: data.pickup.address,
          },
          dropoff_location: {
            latitude: data.dropoff.latitude,
            longitude: data.dropoff.longitude,
            address: data.dropoff.address,
          },
          pickup_contact: data.pickup.contact,
          dropoff_contact: data.dropoff.contact,

          estimated_pickup_time: new Date(data.estimated_pickup_time),
          estimated_dropoff_time: new Date(data.estimated_dropoff_time),

          tracking_url: data.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(
          `Failed to update Uber Eats delivery: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async cancelDelivery(
    delivery_id: string,
    reason?: string,
  ): Promise<LastMileDelivery> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("ubereats-delivery-cancel");
      await this.refreshTokenIfNeeded();

      const path = `/v1/deliveries/${delivery_id}/cancel`;

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ reason_code: reason || "MERCHANT_REQUESTED" }),
        });

        if (!response.ok) {
          throw new Error(`Uber Eats API error: ${response.statusText}`);
        }

        const data = (await response.json()) as UberDirectDeliveryResponse;

        return {
          id: data.delivery_id,
          platform: "ubereats",
          external_id: data.external_delivery_id,
          status: this.mapStatusToUnified(data.status),
          order_id: data.external_delivery_id,

          pickup_location: {
            latitude: data.pickup.latitude,
            longitude: data.pickup.longitude,
            address: data.pickup.address,
          },
          dropoff_location: {
            latitude: data.dropoff.latitude,
            longitude: data.dropoff.longitude,
            address: data.dropoff.address,
          },
          pickup_contact: data.pickup.contact,
          dropoff_contact: data.dropoff.contact,

          estimated_pickup_time: new Date(data.estimated_pickup_time),
          estimated_dropoff_time: new Date(data.estimated_dropoff_time),

          tracking_url: data.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(
          `Failed to cancel Uber Eats delivery: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async listDeliveries(
    filters?: DeliveryFilterOptions,
  ): Promise<LastMileDelivery[]> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("ubereats-delivery-list");
      await this.refreshTokenIfNeeded();

      const path = "/v1/deliveries";

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: "GET",
          headers: this.getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error(`Uber Eats API error: ${response.statusText}`);
        }

        const data = (await response.json()) as {
          deliveries: UberDirectDeliveryResponse[];
        };

        return data.deliveries.map((delivery) => ({
          id: delivery.delivery_id,
          platform: "ubereats",
          external_id: delivery.external_delivery_id,
          status: this.mapStatusToUnified(delivery.status),
          order_id: delivery.external_delivery_id,

          pickup_location: {
            latitude: delivery.pickup.latitude,
            longitude: delivery.pickup.longitude,
            address: delivery.pickup.address,
          },
          dropoff_location: {
            latitude: delivery.dropoff.latitude,
            longitude: delivery.dropoff.longitude,
            address: delivery.dropoff.address,
          },
          pickup_contact: delivery.pickup.contact,
          dropoff_contact: delivery.dropoff.contact,

          estimated_pickup_time: new Date(delivery.estimated_pickup_time),
          estimated_dropoff_time: new Date(delivery.estimated_dropoff_time),

          tracking_url: delivery.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        }));
      } catch (error) {
        throw new Error(
          `Failed to list Uber Eats deliveries: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async getQuote(
    pickup: Location,
    dropoff: Location,
    options?: QuoteOptions,
  ): Promise<LastMileQuote> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("ubereats-quote");
      await this.refreshTokenIfNeeded();

      const request_id = this.generateRequestId();
      const path = "/v1/quotes";

      const quote_request = {
        external_delivery_id: request_id,
        pickup: {
          address: pickup.address || "",
          latitude: pickup.latitude,
          longitude: pickup.longitude,
        },
        dropoff: {
          address: dropoff.address || "",
          latitude: dropoff.latitude,
          longitude: dropoff.longitude,
        },
      };

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: "POST",
          headers: {
            ...this.getAuthHeaders(),
            "X-Request-ID": request_id,
          },
          body: JSON.stringify(quote_request),
        });

        if (!response.ok) {
          throw new Error(`Uber Eats API error: ${response.statusText}`);
        }

        const data = (await response.json()) as UberDirectQuoteResponse;

        const distance = this.calculateDistance(pickup, dropoff);
        const commission_rate = 0.25;
        const commission = Math.round(data.fee * commission_rate);

        return {
          id: data.quote_id,
          platform: "ubereats",

          pickup_location: pickup,
          dropoff_location: dropoff,

          distance_meters: distance.distance_meters,
          duration_seconds: distance.duration_seconds,

          base_fee: Math.round(data.fee * 0.3),
          distance_fee: Math.round(data.fee * 0.4),
          time_fee: Math.round(data.fee * 0.2),
          surge_multiplier: 1.0,

          service_fee: Math.round(data.fee * 0.1),

          subtotal: data.fee,
          tax: Math.round(data.fee * 0.0875),
          total: data.fee + Math.round(data.fee * 0.0875),

          currency: data.currency || "USD",

          estimated_pickup_time: new Date(),
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
          `Failed to get Uber Eats quote: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async getTracking(delivery_id: string): Promise<LastMileTracking> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("ubereats-tracking");

      const delivery = await this.getDelivery(delivery_id);
      if (!delivery) {
        throw new Error(`Delivery ${delivery_id} not found`);
      }

      return this.buildTracking(delivery);
    });
  }

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

  async getDriver(driver_id: string): Promise<LastMileDriver | null> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("ubereats-driver-get");
      await this.refreshTokenIfNeeded();

      const path = `/v1/drivers/${driver_id}`;

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: "GET",
          headers: this.getAuthHeaders(),
        });

        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`Uber Eats API error: ${response.statusText}`);
        }

        const data = (await response.json()) as any;

        return {
          id: driver_id,
          platform: "ubereats",
          external_id: data.external_id || driver_id,
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          phone: data.phone || "",
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
          `Failed to get Uber Eats driver: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async listAvailableDrivers(
    location: Location,
    radius_meters: number = 5000,
  ): Promise<LastMileDriver[]> {
    // Uber Eats doesn't expose driver list API
    return [];
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    return this.verifyHmacSignature(payload, signature, this.webhook_secret);
  }

  parseWebhookEvent(payload: string): LastMileWebhookEvent {
    const data = JSON.parse(payload);

    return {
      id: data.delivery_id || this.generateRequestId(),
      platform: "ubereats",
      event_type: data.event_type || "delivery.status_changed",
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

  private locationToUberDirect(
    location: Location,
    contact: Contact,
  ): UberDirectLocation {
    return {
      address: location.address || "",
      latitude: location.latitude,
      longitude: location.longitude,
      contact: {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
      },
    };
  }

  private buildTracking(delivery: LastMileDelivery): LastMileTracking {
    return {
      delivery_id: delivery.id,
      platform: "ubereats",

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
