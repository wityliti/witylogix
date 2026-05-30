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
} from './types';
import { LastMileAdapter } from './lastmile-adapter';

interface GrubhubOrderRequest {
  external_order_id: string;
  restaurant_id: string;
  delivery_address: GrubhubAddress;
  delivery_contact: GrubhubContact;
  items: GrubhubOrderItem[];
  order_value: number;
  delivery_notes?: string;
}

interface GrubhubAddress {
  street_address: string;
  apt_number?: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface GrubhubContact {
  first_name: string;
  last_name: string;
  phone_number: string;
  email?: string;
}

interface GrubhubOrderItem {
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

interface GrubhubOrderResponse {
  order_id: string;
  external_order_id: string;
  status: string;
  restaurant_id: string;
  delivery_address: GrubhubAddress;
  delivery_contact: GrubhubContact;
  estimated_prep_time_minutes: number;
  estimated_delivery_time: string;
  driver?: {
    id: string;
    name: string;
    phone: string;
    vehicle: {
      type: string;
      license_plate: string;
    };
  };
  tracking_url: string;
}

interface GrubhubQuoteRequest {
  restaurant_id: string;
  delivery_address: GrubhubAddress;
  order_value: number;
}

interface GrubhubQuoteResponse {
  quote_id: string;
  delivery_fee: number;
  tax: number;
  total: number;
  currency: string;
  expires_at: string;
  estimated_delivery_time_minutes: number;
}

export class GrubhubClient extends LastMileAdapter {
  // api_key is inherited from LastMileAdapter as protected
  private oauth_token?: string;
  private oauth_client_id?: string;
  private oauth_client_secret?: string;
  private webhook_secret: string;
  private base_url: string;
  private restaurant_id: string;
  private token_expires_at: number = 0;

  constructor(
    api_key: string,
    webhook_secret: string,
    restaurant_id: string,
    oauth_client_id?: string,
    oauth_client_secret?: string,
    initial_token?: string,
    sandbox_mode: boolean = false
  ) {
    super('grubhub', api_key);
    this.api_key = api_key;
    this.webhook_secret = webhook_secret;
    this.restaurant_id = restaurant_id;
    this.oauth_client_id = oauth_client_id;
    this.oauth_client_secret = oauth_client_secret;
    this.oauth_token = initial_token;
    this.sandbox_mode = sandbox_mode;
    this.base_url = sandbox_mode
      ? 'https://sandbox.grubhub.com'
      : 'https://api.grubhub.com';
  }

  private async refreshTokenIfNeeded(): Promise<void> {
    if (!this.oauth_client_id || !this.oauth_client_secret) {
      return;
    }

    if (Date.now() < this.token_expires_at) {
      return;
    }

    try {
      const response = await fetch(`${this.base_url}/oauth/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.oauth_client_id,
          client_secret: this.oauth_client_secret,
          grant_type: 'client_credentials',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      this.oauth_token = data.access_token;
      this.token_expires_at = Date.now() + (data.expires_in - 300) * 1000;
    } catch (error) {
      throw new Error(`Failed to refresh OAuth token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.oauth_token) {
      headers.Authorization = `Bearer ${this.oauth_token}`;
    } else {
      headers['X-Api-Key'] = this.api_key ?? '';
    }

    return headers;
  }

  async createDelivery(delivery: Partial<LastMileDelivery>): Promise<LastMileDelivery> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit('grubhub-order-create');
      await this.refreshTokenIfNeeded();

      if (!delivery.pickup_location || !delivery.dropoff_location) {
        throw new Error('Pickup and dropoff locations are required');
      }

      if (!delivery.dropoff_contact) {
        throw new Error('Dropoff contact is required');
      }

      const request_id = this.generateRequestId();
      const path = '/v1/orders';

      const grubhub_request: GrubhubOrderRequest = {
        external_order_id: delivery.order_id || request_id,
        restaurant_id: this.restaurant_id,
        delivery_address: this.locationToAddress(delivery.dropoff_location),
        delivery_contact: this.contactToGrubhub(delivery.dropoff_contact),
        items: delivery.notes ? [{ item_id: '1', name: delivery.notes, quantity: 1, unit_price: 0 }] : [],
        order_value: 0,
        delivery_notes: delivery.special_instructions,
      };

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: 'POST',
          headers: {
            ...this.getAuthHeaders(),
            'X-Request-ID': request_id,
          },
          body: JSON.stringify(grubhub_request),
        });

        if (!response.ok) {
          throw new Error(`Grubhub API error: ${response.statusText}`);
        }

        const data = (await response.json()) as GrubhubOrderResponse;

        return {
          id: data.order_id,
          platform: 'grubhub',
          external_id: data.external_order_id,
          status: this.mapStatusToUnified(data.status),
          order_id: delivery.order_id || request_id,

          pickup_location: delivery.pickup_location,
          dropoff_location: delivery.dropoff_location,
          pickup_contact: { name: 'Restaurant', phone: '' },
          dropoff_contact: delivery.dropoff_contact,

          item_count: delivery.item_count || 0,
          total_weight: delivery.total_weight,

          estimated_pickup_time: new Date(Date.now() + data.estimated_prep_time_minutes * 60000),
          estimated_dropoff_time: new Date(data.estimated_delivery_time),

          driver: data.driver
            ? {
                id: data.driver.id,
                platform: 'grubhub',
                external_id: data.driver.id,
                first_name: data.driver.name.split(' ')[0] || '',
                last_name: data.driver.name.split(' ')[1] || '',
                phone: data.driver.phone,
                vehicle: {
                  type: (data.driver.vehicle.type || 'car') as 'car' | 'bike' | 'scooter' | 'truck',
                  license_plate: data.driver.vehicle.license_plate,
                },
                status: 'on_delivery',
              }
            : undefined,

          tracking_url: data.tracking_url,

          notes: delivery.notes,
          special_instructions: delivery.special_instructions,

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(`Failed to create Grubhub order: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  async getDelivery(delivery_id: string): Promise<LastMileDelivery | null> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit('grubhub-order-get');
      await this.refreshTokenIfNeeded();

      const path = `/v1/orders/${delivery_id}`;

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`Grubhub API error: ${response.statusText}`);
        }

        const data = (await response.json()) as GrubhubOrderResponse;

        return {
          id: data.order_id,
          platform: 'grubhub',
          external_id: data.external_order_id,
          status: this.mapStatusToUnified(data.status),
          order_id: data.external_order_id,

          pickup_location: {
            latitude: data.delivery_address.latitude || 0,
            longitude: data.delivery_address.longitude || 0,
            address: data.delivery_address.street_address,
          },
          dropoff_location: {
            latitude: data.delivery_address.latitude || 0,
            longitude: data.delivery_address.longitude || 0,
            address: data.delivery_address.street_address,
          },
          pickup_contact: { name: 'Restaurant', phone: '' },
          dropoff_contact: {
            name: `${data.delivery_contact.first_name} ${data.delivery_contact.last_name}`,
            phone: data.delivery_contact.phone_number,
            email: data.delivery_contact.email,
          },

          estimated_pickup_time: new Date(Date.now() + data.estimated_prep_time_minutes * 60000),
          estimated_dropoff_time: new Date(data.estimated_delivery_time),

          driver: data.driver
            ? {
                id: data.driver.id,
                platform: 'grubhub',
                external_id: data.driver.id,
                first_name: data.driver.name.split(' ')[0] || '',
                last_name: data.driver.name.split(' ')[1] || '',
                phone: data.driver.phone,
                vehicle: {
                  type: (data.driver.vehicle.type || 'car') as 'car' | 'bike' | 'scooter' | 'truck',
                  license_plate: data.driver.vehicle.license_plate,
                },
                status: 'on_delivery',
              }
            : undefined,

          tracking_url: data.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(`Failed to get Grubhub order: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  async updateDelivery(
    delivery_id: string,
    updates: Partial<LastMileDelivery>
  ): Promise<LastMileDelivery> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit('grubhub-order-update');
      await this.refreshTokenIfNeeded();

      const path = `/v1/orders/${delivery_id}`;

      const update_body: Record<string, any> = {};
      if (updates.notes) update_body.delivery_notes = updates.notes;

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: 'PATCH',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(update_body),
        });

        if (!response.ok) {
          throw new Error(`Grubhub API error: ${response.statusText}`);
        }

        const data = (await response.json()) as GrubhubOrderResponse;

        return {
          id: data.order_id,
          platform: 'grubhub',
          external_id: data.external_order_id,
          status: this.mapStatusToUnified(data.status),
          order_id: data.external_order_id,

          pickup_location: {
            latitude: data.delivery_address.latitude || 0,
            longitude: data.delivery_address.longitude || 0,
            address: data.delivery_address.street_address,
          },
          dropoff_location: {
            latitude: data.delivery_address.latitude || 0,
            longitude: data.delivery_address.longitude || 0,
            address: data.delivery_address.street_address,
          },
          pickup_contact: { name: 'Restaurant', phone: '' },
          dropoff_contact: {
            name: `${data.delivery_contact.first_name} ${data.delivery_contact.last_name}`,
            phone: data.delivery_contact.phone_number,
          },

          estimated_pickup_time: new Date(Date.now() + data.estimated_prep_time_minutes * 60000),
          estimated_dropoff_time: new Date(data.estimated_delivery_time),

          tracking_url: data.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(`Failed to update Grubhub order: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  async cancelDelivery(delivery_id: string, reason?: string): Promise<LastMileDelivery> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit('grubhub-order-cancel');
      await this.refreshTokenIfNeeded();

      const path = `/v1/orders/${delivery_id}/cancel`;

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ reason_code: reason || 'MERCHANT_REQUESTED' }),
        });

        if (!response.ok) {
          throw new Error(`Grubhub API error: ${response.statusText}`);
        }

        const data = (await response.json()) as GrubhubOrderResponse;

        return {
          id: data.order_id,
          platform: 'grubhub',
          external_id: data.external_order_id,
          status: this.mapStatusToUnified(data.status),
          order_id: data.external_order_id,

          pickup_location: {
            latitude: data.delivery_address.latitude || 0,
            longitude: data.delivery_address.longitude || 0,
            address: data.delivery_address.street_address,
          },
          dropoff_location: {
            latitude: data.delivery_address.latitude || 0,
            longitude: data.delivery_address.longitude || 0,
            address: data.delivery_address.street_address,
          },
          pickup_contact: { name: 'Restaurant', phone: '' },
          dropoff_contact: {
            name: `${data.delivery_contact.first_name} ${data.delivery_contact.last_name}`,
            phone: data.delivery_contact.phone_number,
          },

          estimated_pickup_time: new Date(Date.now() + data.estimated_prep_time_minutes * 60000),
          estimated_dropoff_time: new Date(data.estimated_delivery_time),

          tracking_url: data.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        };
      } catch (error) {
        throw new Error(`Failed to cancel Grubhub order: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  async listDeliveries(filters?: DeliveryFilterOptions): Promise<LastMileDelivery[]> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit('grubhub-order-list');
      await this.refreshTokenIfNeeded();

      const path = `/v1/restaurants/${this.restaurant_id}/orders`;

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: 'GET',
          headers: this.getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error(`Grubhub API error: ${response.statusText}`);
        }

        const data = (await response.json()) as { orders: GrubhubOrderResponse[] };

        return data.orders.map((order) => ({
          id: order.order_id,
          platform: 'grubhub',
          external_id: order.external_order_id,
          status: this.mapStatusToUnified(order.status),
          order_id: order.external_order_id,

          pickup_location: {
            latitude: order.delivery_address.latitude || 0,
            longitude: order.delivery_address.longitude || 0,
            address: order.delivery_address.street_address,
          },
          dropoff_location: {
            latitude: order.delivery_address.latitude || 0,
            longitude: order.delivery_address.longitude || 0,
            address: order.delivery_address.street_address,
          },
          pickup_contact: { name: 'Restaurant', phone: '' },
          dropoff_contact: {
            name: `${order.delivery_contact.first_name} ${order.delivery_contact.last_name}`,
            phone: order.delivery_contact.phone_number,
          },

          estimated_pickup_time: new Date(Date.now() + order.estimated_prep_time_minutes * 60000),
          estimated_dropoff_time: new Date(order.estimated_delivery_time),

          tracking_url: order.tracking_url,

          created_at: new Date(),
          updated_at: new Date(),
        }));
      } catch (error) {
        throw new Error(`Failed to list Grubhub orders: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  async getQuote(
    pickup: Location,
    dropoff: Location,
    options?: QuoteOptions
  ): Promise<LastMileQuote> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit('grubhub-quote');
      await this.refreshTokenIfNeeded();

      const request_id = this.generateRequestId();
      const path = '/v1/quotes';

      const quote_request: GrubhubQuoteRequest = {
        restaurant_id: this.restaurant_id,
        delivery_address: this.locationToAddress(dropoff),
        order_value: 0,
      };

      try {
        const response = await fetch(`${this.base_url}${path}`, {
          method: 'POST',
          headers: {
            ...this.getAuthHeaders(),
            'X-Request-ID': request_id,
          },
          body: JSON.stringify(quote_request),
        });

        if (!response.ok) {
          throw new Error(`Grubhub API error: ${response.statusText}`);
        }

        const data = (await response.json()) as GrubhubQuoteResponse;

        const distance = this.calculateDistance(pickup, dropoff);
        const commission_rate = 0.25;
        const commission = Math.round(data.delivery_fee * commission_rate);

        return {
          id: data.quote_id,
          platform: 'grubhub',

          pickup_location: pickup,
          dropoff_location: dropoff,

          distance_meters: distance.distance_meters,
          duration_seconds: distance.duration_seconds,

          base_fee: Math.round(data.delivery_fee * 0.3),
          distance_fee: Math.round(data.delivery_fee * 0.4),
          time_fee: Math.round(data.delivery_fee * 0.3),
          surge_multiplier: 1.0,

          service_fee: 0,

          subtotal: data.delivery_fee,
          tax: data.tax,
          total: data.total,

          currency: data.currency || 'USD',

          estimated_pickup_time: new Date(),
          estimated_dropoff_time: new Date(Date.now() + data.estimated_delivery_time_minutes * 60000),

          valid_until: new Date(data.expires_at),
          expires_at: new Date(data.expires_at),

          platform_commission_rate: commission_rate,
          platform_commission_amount: commission,
        };
      } catch (error) {
        throw new Error(`Failed to get Grubhub quote: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  async getTracking(delivery_id: string): Promise<LastMileTracking> {
    return this.executeWithCircuitBreaker(async () => {
      await this.checkRateLimit('grubhub-tracking');

      const delivery = await this.getDelivery(delivery_id);
      if (!delivery) {
        throw new Error(`Order ${delivery_id} not found`);
      }

      return this.buildTracking(delivery);
    });
  }

  async getTrackingByExternalId(external_id: string): Promise<LastMileTracking> {
    const deliveries = await this.listDeliveries();
    const delivery = deliveries.find((d) => d.external_id === external_id);

    if (!delivery) {
      throw new Error(`Order with external ID ${external_id} not found`);
    }

    return this.buildTracking(delivery);
  }

  async getDriver(driver_id: string): Promise<LastMileDriver | null> {
    // Grubhub doesn't expose driver information API
    return null;
  }

  async listAvailableDrivers(location: Location, radius_meters: number = 5000): Promise<LastMileDriver[]> {
    return [];
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    return this.verifyHmacSignature(payload, signature, this.webhook_secret);
  }

  parseWebhookEvent(payload: string): LastMileWebhookEvent {
    const data = JSON.parse(payload);

    return {
      id: data.order_id || this.generateRequestId(),
      platform: 'grubhub',
      event_type: data.event_type || 'order.status_changed',
      external_id: data.external_order_id,

      delivery_id: data.order_id,
      order_id: data.external_order_id,

      status: this.mapStatusToUnified(data.status),
      previous_status: data.previous_status ? this.mapStatusToUnified(data.previous_status) : undefined,

      timestamp: new Date(data.timestamp || Date.now()),

      data,
      raw_payload: payload,

      signature_verified: true,
      processed: false,

      created_at: new Date(),
    };
  }

  private locationToAddress(location: Location): GrubhubAddress {
    return {
      street_address: location.address || '',
      city: location.city || '',
      state: location.state || '',
      postal_code: location.zip_code || '',
      country: location.country_code || 'US',
      latitude: location.latitude,
      longitude: location.longitude,
    };
  }

  private contactToGrubhub(contact: Contact): GrubhubContact {
    const parts = contact.name.split(' ');
    return {
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' ') || '',
      phone_number: contact.phone,
      email: contact.email,
    };
  }

  private buildTracking(delivery: LastMileDelivery): LastMileTracking {
    return {
      delivery_id: delivery.id,
      platform: 'grubhub',

      current_location: delivery.dropoff_location,
      current_latitude: delivery.dropoff_location.latitude,
      current_longitude: delivery.dropoff_location.longitude,

      status: delivery.status,

      driver: delivery.driver
        ? {
            id: delivery.driver.id,
            name: `${delivery.driver.first_name} ${delivery.driver.last_name}`,
            phone: delivery.driver.phone,
          }
        : undefined,

      vehicle: delivery.driver?.vehicle,

      estimated_arrival: delivery.estimated_dropoff_time || new Date(),
      distance_to_dropoff_meters: 0,
      duration_to_dropoff_seconds: 0,

      events: [
        {
          timestamp: delivery.created_at,
          status: 'created',
          description: 'Order created',
        },
      ],
    };
  }
}
