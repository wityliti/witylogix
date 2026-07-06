import { createHmac, createSign } from "crypto";
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

interface DoorDashDeliveryRequest {
  external_delivery_id: string;
  pickup_address: DoorDashAddress;
  dropoff_address: DoorDashAddress;
  pickup_contact: DoorDashContact;
  dropoff_contact: DoorDashContact;
  items: DoorDashItem[];
  order_value: number;
  notes?: string;
}

interface DoorDashAddress {
  street_address: string;
  unit?: string;
  city: string;
  state: string;
  zip_code: string;
  country_code?: string;
}

interface DoorDashContact {
  name: string;
  phone_number: string;
  email?: string;
}

interface DoorDashItem {
  title: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

interface DoorDashDeliveryResponse {
  delivery_id: string;
  external_delivery_id: string;
  status: string;
  pickup_address: DoorDashAddress;
  dropoff_address: DoorDashAddress;
  estimated_pickup_time_ms: number;
  estimated_dropoff_time_ms: number;
  tracking_url: string;
}

interface DoorDashQuoteRequest {
  external_delivery_id: string;
  pickup_address: DoorDashAddress;
  dropoff_address: DoorDashAddress;
  item_count?: number;
  order_value?: number;
}

interface DoorDashQuoteResponse {
  quote_id: string;
  external_delivery_id: string;
  fee: number;
  currency: string;
  expires_at_ms: number;
  estimated_duration_seconds: number;
  estimated_pickup_time_ms: number;
}

export class DoorDashDriveClient extends LastMileAdapter {
  private developer_id: string;
  private key_id: string;
  private signing_secret: string;
  private webhook_secret: string;
  private base_url: string;

  constructor(
    developer_id: string,
    key_id: string,
    signing_secret: string,
    webhook_secret: string,
    sandbox_mode: boolean = false,
  ) {
    super("doordash", undefined);
    this.developer_id = developer_id;
    this.key_id = key_id;
    this.signing_secret = signing_secret;
    this.webhook_secret = webhook_secret;
    this.sandbox_mode = sandbox_mode;
    this.base_url = sandbox_mode
      ? "https://sandbox.doordash.com"
      : "https://api.doordash.com";
  }

  private generateJWT(method: string, path: string, body?: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const headers = {
      kid: this.key_id,
      typ: "JWT",
    };

    const signature_base = `${method}\n${path}\n${timestamp}`;
    const signature = createHmac("sha256", this.signing_secret)
      .update(signature_base)
      .digest("hex");

    // Simplified JWT (note: in production, use proper JWT library)
    const payload = {
      iss: this.developer_id,
      iat: timestamp,
      exp: timestamp + 300,
      kid: this.key_id,
      signature,
    };

    return Buffer.from(JSON.stringify(payload)).toString("base64");
  }

  async createDelivery(
    delivery: Partial<LastMileDelivery>,
  ): Promise<LastMileDelivery> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("doordash-delivery-create");

      if (!delivery.pickup_location || !delivery.dropoff_location) {
        throw new Error("Pickup and dropoff locations are required");
      }

      if (!delivery.pickup_contact || !delivery.dropoff_contact) {
        throw new Error("Pickup and dropoff contacts are required");
      }

      const request_id = this.generateRequestId();
      const path = "/v2/deliveries";

      const dd_request: DoorDashDeliveryRequest = {
        external_delivery_id: delivery.order_id || request_id,
        pickup_address: this.locationToAddress(delivery.pickup_location),
        dropoff_address: this.locationToAddress(delivery.dropoff_location),
        pickup_contact: this.contactToDoorDash(delivery.pickup_contact),
        dropoff_contact: this.contactToDoorDash(delivery.dropoff_contact),
        items: delivery.notes
          ? [{ title: delivery.notes, quantity: 1, unit_price: 0 }]
          : [],
        order_value: 0,
        notes: delivery.special_instructions,
      };

      const jwt = this.generateJWT("POST", path, JSON.stringify(dd_request));

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json",
            "X-Request-ID": request_id,
          },
          body: JSON.stringify(dd_request),
        });

        if (!response.ok) {
          throw new Error(`DoorDash API error: ${response.statusText}`);
        }

        const data = (await response.json()) as DoorDashDeliveryResponse;

        return {
          id: data.delivery_id,
          platform: "doordash",
          external_id: data.external_delivery_id,
          status: this.mapStatusToUnified(data.status),
          order_id: delivery.order_id || request_id,

          pickup_location: delivery.pickup_location,
          dropoff_location: delivery.dropoff_location,
          pickup_contact: delivery.pickup_contact,
          dropoff_contact: delivery.dropoff_contact,

          item_count: delivery.item_count || 0,
          total_weight: delivery.total_weight,

          estimated_pickup_time: new Date(data.estimated_pickup_time_ms),
          estimated_dropoff_time: new Date(data.estimated_dropoff_time_ms),

          tracking_url: data.tracking_url,

          notes: delivery.notes,
          special_instructions: delivery.special_instructions,

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(
          `Failed to create DoorDash delivery: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async getDelivery(delivery_id: string): Promise<LastMileDelivery | null> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("doordash-delivery-get");

      const path = `/v2/deliveries/${delivery_id}`;
      const jwt = this.generateJWT("GET", path);

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        });

        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`DoorDash API error: ${response.statusText}`);
        }

        const data = (await response.json()) as DoorDashDeliveryResponse;

        return {
          id: data.delivery_id,
          platform: "doordash",
          external_id: data.external_delivery_id,
          status: this.mapStatusToUnified(data.status),
          order_id: data.external_delivery_id,

          pickup_location: this.addressToLocation(data.pickup_address),
          dropoff_location: this.addressToLocation(data.dropoff_address),
          pickup_contact: { name: "", phone: "" },
          dropoff_contact: { name: "", phone: "" },

          estimated_pickup_time: new Date(data.estimated_pickup_time_ms),
          estimated_dropoff_time: new Date(data.estimated_dropoff_time_ms),

          tracking_url: data.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(
          `Failed to get DoorDash delivery: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async updateDelivery(
    delivery_id: string,
    updates: Partial<LastMileDelivery>,
  ): Promise<LastMileDelivery> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("doordash-delivery-update");

      const path = `/v2/deliveries/${delivery_id}`;
      const jwt = this.generateJWT("PATCH", path, JSON.stringify(updates));

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error(`DoorDash API error: ${response.statusText}`);
        }

        const data = (await response.json()) as DoorDashDeliveryResponse;

        return {
          id: data.delivery_id,
          platform: "doordash",
          external_id: data.external_delivery_id,
          status: this.mapStatusToUnified(data.status),
          order_id: data.external_delivery_id,

          pickup_location: this.addressToLocation(data.pickup_address),
          dropoff_location: this.addressToLocation(data.dropoff_address),
          pickup_contact: { name: "", phone: "" },
          dropoff_contact: { name: "", phone: "" },

          estimated_pickup_time: new Date(data.estimated_pickup_time_ms),
          estimated_dropoff_time: new Date(data.estimated_dropoff_time_ms),

          tracking_url: data.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(
          `Failed to update DoorDash delivery: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async cancelDelivery(
    delivery_id: string,
    reason?: string,
  ): Promise<LastMileDelivery> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("doordash-delivery-cancel");

      const path = `/v2/deliveries/${delivery_id}/cancel`;
      const body = { reason_code: reason || "MERCHANT_REQUESTED" };
      const jwt = this.generateJWT("POST", path, JSON.stringify(body));

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`DoorDash API error: ${response.statusText}`);
        }

        const data = (await response.json()) as DoorDashDeliveryResponse;

        return {
          id: data.delivery_id,
          platform: "doordash",
          external_id: data.external_delivery_id,
          status: this.mapStatusToUnified(data.status),
          order_id: data.external_delivery_id,

          pickup_location: this.addressToLocation(data.pickup_address),
          dropoff_location: this.addressToLocation(data.dropoff_address),
          pickup_contact: { name: "", phone: "" },
          dropoff_contact: { name: "", phone: "" },

          estimated_pickup_time: new Date(data.estimated_pickup_time_ms),
          estimated_dropoff_time: new Date(data.estimated_dropoff_time_ms),

          tracking_url: data.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(
          `Failed to cancel DoorDash delivery: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async listDeliveries(
    filters?: DeliveryFilterOptions,
  ): Promise<LastMileDelivery[]> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("doordash-delivery-list");

      const path = "/v2/deliveries";
      const jwt = this.generateJWT("GET", path);

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        });

        if (!response.ok) {
          throw new Error(`DoorDash API error: ${response.statusText}`);
        }

        const data = (await response.json()) as {
          deliveries: DoorDashDeliveryResponse[];
        };

        return data.deliveries.map((dd_delivery) => ({
          id: dd_delivery.delivery_id,
          platform: "doordash",
          external_id: dd_delivery.external_delivery_id,
          status: this.mapStatusToUnified(dd_delivery.status),
          order_id: dd_delivery.external_delivery_id,

          pickup_location: this.addressToLocation(dd_delivery.pickup_address),
          dropoff_location: this.addressToLocation(dd_delivery.dropoff_address),
          pickup_contact: { name: "", phone: "" },
          dropoff_contact: { name: "", phone: "" },

          estimated_pickup_time: new Date(dd_delivery.estimated_pickup_time_ms),
          estimated_dropoff_time: new Date(
            dd_delivery.estimated_dropoff_time_ms,
          ),

          tracking_url: dd_delivery.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        }));
      } catch (error) {
        throw new Error(
          `Failed to list DoorDash deliveries: ${error instanceof Error ? error.message : String(error)}`,
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
      await this.checkRateLimit("doordash-quote");

      const request_id = this.generateRequestId();
      const path = "/v2/quotes";

      const quote_request: DoorDashQuoteRequest = {
        external_delivery_id: request_id,
        pickup_address: this.locationToAddress(pickup),
        dropoff_address: this.locationToAddress(dropoff),
        item_count: options?.item_count,
        order_value: 0,
      };

      const jwt = this.generateJWT("POST", path, JSON.stringify(quote_request));

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json",
            "X-Request-ID": request_id,
          },
          body: JSON.stringify(quote_request),
        });

        if (!response.ok) {
          throw new Error(`DoorDash API error: ${response.statusText}`);
        }

        const data = (await response.json()) as DoorDashQuoteResponse;

        const distance = this.calculateDistance(pickup, dropoff);
        const commission_rate = 0.25; // 25% commission
        const commission = Math.round(data.fee * commission_rate);

        const estimate = this.estimateDeliveryTime(pickup, dropoff);

        return {
          id: data.quote_id,
          platform: "doordash",

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

          estimated_pickup_time: new Date(data.estimated_pickup_time_ms),
          estimated_dropoff_time: new Date(
            Date.now() + data.estimated_duration_seconds * 1000,
          ),

          valid_until: new Date(data.expires_at_ms),
          expires_at: new Date(data.expires_at_ms),

          platform_commission_rate: commission_rate,
          platform_commission_amount: commission,
        };
      } catch (error) {
        throw new Error(
          `Failed to get DoorDash quote: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async getTracking(delivery_id: string): Promise<LastMileTracking> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit("doordash-tracking");

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
      await this.checkRateLimit("doordash-driver-get");

      const path = `/v2/drivers/${driver_id}`;
      const jwt = this.generateJWT("GET", path);

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        });

        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`DoorDash API error: ${response.statusText}`);
        }

        const data = (await response.json()) as any;

        return {
          id: driver_id,
          platform: "doordash",
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
          `Failed to get DoorDash driver: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async listAvailableDrivers(
    location: Location,
    radius_meters: number = 5000,
  ): Promise<LastMileDriver[]> {
    // DoorDash doesn't expose driver list API, returning empty
    return [];
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    return this.verifyHmacSignature(payload, signature, this.webhook_secret);
  }

  parseWebhookEvent(payload: string): LastMileWebhookEvent {
    const data = JSON.parse(payload);

    return {
      id: data.delivery_id || this.generateRequestId(),
      platform: "doordash",
      event_type: data.event_type || "delivery.status_changed",
      external_id: data.external_delivery_id,

      delivery_id: data.delivery_id,
      order_id: data.external_delivery_id,

      status: this.mapStatusToUnified(data.status),
      previous_status: data.previous_status
        ? this.mapStatusToUnified(data.previous_status)
        : undefined,

      timestamp: new Date(data.timestamp_ms || Date.now()),

      data,
      raw_payload: payload,

      signature_verified: true,
      processed: false,

      created_at: new Date(),
    };
  }

  private locationToAddress(location: Location): DoorDashAddress {
    return {
      street_address: location.address || "",
      city: location.city || "",
      state: location.state || "",
      zip_code: location.zip_code || "",
      country_code: location.country_code || "US",
    };
  }

  private addressToLocation(address: DoorDashAddress): Location {
    return {
      latitude: 0,
      longitude: 0,
      address: address.street_address,
      city: address.city,
      state: address.state,
      zip_code: address.zip_code,
      country_code: address.country_code,
    };
  }

  private contactToDoorDash(contact: Contact): DoorDashContact {
    return {
      name: contact.name,
      phone_number: contact.phone,
      email: contact.email,
    };
  }

  private buildTracking(delivery: LastMileDelivery): LastMileTracking {
    return {
      delivery_id: delivery.id,
      platform: "doordash",

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
