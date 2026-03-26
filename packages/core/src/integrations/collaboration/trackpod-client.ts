interface TrackPODOrder {
  job_id: string;
  external_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  notes?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TrackPODRoute {
  route_id: string;
  date: string;
  driver_id: string;
  vehicle_id: string;
  jobs: string[]; // job IDs
  status: string;
  planned_distance_km: number;
  planned_duration_minutes: number;
  actual_distance_km?: number;
  actual_duration_minutes?: number;
}

interface TrackPODDriver {
  driver_id: string;
  name: string;
  phone: string;
  email: string;
  vehicle_id: string;
  status: string;
  current_location: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  total_deliveries: number;
  rating: number;
}

interface TrackPODProofOfDelivery {
  job_id: string;
  pod_type: 'photo' | 'signature' | 'both';
  photo_urls?: string[];
  signature_url?: string;
  recipient_name: string;
  timestamp: string;
  latitude: number;
  longitude: number;
}

export class TrackPODClient {
  private api_key: string;
  private base_url: string;

  constructor(api_key: string, sandbox_mode: boolean = false) {
    this.api_key = api_key;
    this.base_url = sandbox_mode
      ? 'https://sandbox.trackpod.com/api'
      : 'https://api.trackpod.com/api';
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.api_key}`,
      'Content-Type': 'application/json',
    };
  }

  async createOrder(order: Partial<TrackPODOrder>): Promise<TrackPODOrder> {
    try {
      const response = await fetch(`${this.base_url}/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(order),
      });

      if (!response.ok) {
        throw new Error(`Track-POD API error: ${response.statusText}`);
      }

      return (await response.json()) as TrackPODOrder;
    } catch (error) {
      throw new Error(`Failed to create Track-POD order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getOrder(job_id: string): Promise<TrackPODOrder | null> {
    try {
      const response = await fetch(`${this.base_url}/orders/${job_id}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Track-POD API error: ${response.statusText}`);
      }

      return (await response.json()) as TrackPODOrder;
    } catch (error) {
      throw new Error(`Failed to get Track-POD order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateOrder(job_id: string, updates: Partial<TrackPODOrder>): Promise<TrackPODOrder> {
    try {
      const response = await fetch(`${this.base_url}/orders/${job_id}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Track-POD API error: ${response.statusText}`);
      }

      return (await response.json()) as TrackPODOrder;
    } catch (error) {
      throw new Error(`Failed to update Track-POD order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listOrders(filters?: {
    status?: string;
    date?: string;
    limit?: number;
    offset?: number;
  }): Promise<TrackPODOrder[]> {
    try {
      const query_params = new URLSearchParams();
      if (filters?.status) query_params.append('status', filters.status);
      if (filters?.date) query_params.append('date', filters.date);
      if (filters?.limit) query_params.append('limit', String(filters.limit));
      if (filters?.offset) query_params.append('offset', String(filters.offset));

      const response = await fetch(
        `${this.base_url}/orders?${query_params.toString()}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Track-POD API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { orders: TrackPODOrder[] };
      return data.orders;
    } catch (error) {
      throw new Error(`Failed to list Track-POD orders: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createRoute(route: Partial<TrackPODRoute>): Promise<TrackPODRoute> {
    try {
      const response = await fetch(`${this.base_url}/routes`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(route),
      });

      if (!response.ok) {
        throw new Error(`Track-POD API error: ${response.statusText}`);
      }

      return (await response.json()) as TrackPODRoute;
    } catch (error) {
      throw new Error(`Failed to create Track-POD route: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getRoute(route_id: string): Promise<TrackPODRoute | null> {
    try {
      const response = await fetch(`${this.base_url}/routes/${route_id}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Track-POD API error: ${response.statusText}`);
      }

      return (await response.json()) as TrackPODRoute;
    } catch (error) {
      throw new Error(`Failed to get Track-POD route: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async optimizeRoute(route_id: string): Promise<TrackPODRoute> {
    try {
      const response = await fetch(`${this.base_url}/routes/${route_id}/optimize`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Track-POD API error: ${response.statusText}`);
      }

      return (await response.json()) as TrackPODRoute;
    } catch (error) {
      throw new Error(`Failed to optimize Track-POD route: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getDriver(driver_id: string): Promise<TrackPODDriver | null> {
    try {
      const response = await fetch(`${this.base_url}/drivers/${driver_id}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Track-POD API error: ${response.statusText}`);
      }

      return (await response.json()) as TrackPODDriver;
    } catch (error) {
      throw new Error(`Failed to get Track-POD driver: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listDrivers(filters?: { status?: string }): Promise<TrackPODDriver[]> {
    try {
      const query_params = new URLSearchParams();
      if (filters?.status) query_params.append('status', filters.status);

      const response = await fetch(
        `${this.base_url}/drivers?${query_params.toString()}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Track-POD API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { drivers: TrackPODDriver[] };
      return data.drivers;
    } catch (error) {
      throw new Error(`Failed to list Track-POD drivers: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getDriverTracking(
    driver_id: string
  ): Promise<{
    driver_id: string;
    current_location: { latitude: number; longitude: number };
    current_route: string | null;
    status: string;
    last_update: string;
  } | null> {
    try {
      const response = await fetch(`${this.base_url}/drivers/${driver_id}/tracking`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Track-POD API error: ${response.statusText}`);
      }

      return (await response.json()) as {
        driver_id: string;
        current_location: { latitude: number; longitude: number };
        current_route: string | null;
        status: string;
        last_update: string;
      };
    } catch (error) {
      throw new Error(`Failed to get Track-POD driver tracking: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async submitProofOfDelivery(pod: TrackPODProofOfDelivery): Promise<boolean> {
    try {
      const response = await fetch(`${this.base_url}/orders/${pod.job_id}/proof-of-delivery`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(pod),
      });

      return response.ok;
    } catch (error) {
      throw new Error(`Failed to submit Track-POD proof of delivery: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getProofOfDelivery(job_id: string): Promise<TrackPODProofOfDelivery | null> {
    try {
      const response = await fetch(`${this.base_url}/orders/${job_id}/proof-of-delivery`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Track-POD API error: ${response.statusText}`);
      }

      return (await response.json()) as TrackPODProofOfDelivery;
    } catch (error) {
      throw new Error(`Failed to get Track-POD proof of delivery: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async notifyCustomer(
    job_id: string,
    customer_phone: string,
    message: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.base_url}/orders/${job_id}/notify`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ customer_phone, message }),
      });

      return response.ok;
    } catch (error) {
      throw new Error(`Failed to notify customer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getDeliveryConfirmation(job_id: string): Promise<{
    job_id: string;
    confirmed: boolean;
    confirmed_at: string;
    customer_name: string;
  } | null> {
    try {
      const response = await fetch(`${this.base_url}/orders/${job_id}/confirmation`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Track-POD API error: ${response.statusText}`);
      }

      return (await response.json()) as {
        job_id: string;
        confirmed: boolean;
        confirmed_at: string;
        customer_name: string;
      };
    } catch (error) {
      throw new Error(`Failed to get Track-POD delivery confirmation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
