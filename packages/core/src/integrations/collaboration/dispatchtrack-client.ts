interface DispatchTrackOrder {
  order_id: string;
  external_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  pickup_address: string;
  delivery_address: string;
  notes?: string;
  status: string;
  scheduled_date: string;
  time_window_start?: string;
  time_window_end?: string;
}

interface DispatchTrackRoute {
  route_id: string;
  date: string;
  driver_id: string;
  vehicle_id: string;
  orders: string[]; // order IDs
  status: string;
  sequence: number[];
  planned_distance_km: number;
  planned_duration_minutes: number;
  actual_distance_km?: number;
  actual_duration_minutes?: number;
}

interface DispatchTrackDriver {
  driver_id: string;
  name: string;
  phone: string;
  email?: string;
  vehicle_id: string;
  vehicle_type: string;
  status: string;
  current_location: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  capacity_units: number;
  current_load: number;
}

interface DispatchTrackETA {
  order_id: string;
  current_eta: string;
  eta_window_minutes: number;
  distance_to_delivery_meters: number;
  duration_to_delivery_seconds: number;
  driver_id: string;
  driver_name: string;
}

export class DispatchTrackClient {
  private api_key: string;
  private base_url: string;

  constructor(api_key: string, sandbox_mode: boolean = false) {
    this.api_key = api_key;
    this.base_url = sandbox_mode
      ? "https://sandbox.dispatchtrack.com/api/v1"
      : "https://api.dispatchtrack.com/api/v1";
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.api_key}`,
      "Content-Type": "application/json",
    };
  }

  async createOrder(
    order: Partial<DispatchTrackOrder>,
  ): Promise<DispatchTrackOrder> {
    try {
      const response = await fetch(`${this.base_url}/orders`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(order),
      });

      if (!response.ok) {
        throw new Error(`DispatchTrack API error: ${response.statusText}`);
      }

      return (await response.json()) as DispatchTrackOrder;
    } catch (error) {
      throw new Error(
        `Failed to create DispatchTrack order: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getOrder(order_id: string): Promise<DispatchTrackOrder | null> {
    try {
      const response = await fetch(`${this.base_url}/orders/${order_id}`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`DispatchTrack API error: ${response.statusText}`);
      }

      return (await response.json()) as DispatchTrackOrder;
    } catch (error) {
      throw new Error(
        `Failed to get DispatchTrack order: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async updateOrder(
    order_id: string,
    updates: Partial<DispatchTrackOrder>,
  ): Promise<DispatchTrackOrder> {
    try {
      const response = await fetch(`${this.base_url}/orders/${order_id}`, {
        method: "PATCH",
        headers: this.getHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`DispatchTrack API error: ${response.statusText}`);
      }

      return (await response.json()) as DispatchTrackOrder;
    } catch (error) {
      throw new Error(
        `Failed to update DispatchTrack order: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async listOrders(filters?: {
    status?: string;
    date?: string;
    limit?: number;
    offset?: number;
  }): Promise<DispatchTrackOrder[]> {
    try {
      const query_params = new URLSearchParams();
      if (filters?.status) query_params.append("status", filters.status);
      if (filters?.date) query_params.append("date", filters.date);
      if (filters?.limit) query_params.append("limit", String(filters.limit));
      if (filters?.offset)
        query_params.append("offset", String(filters.offset));

      const response = await fetch(
        `${this.base_url}/orders?${query_params.toString()}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error(`DispatchTrack API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { orders: DispatchTrackOrder[] };
      return data.orders;
    } catch (error) {
      throw new Error(
        `Failed to list DispatchTrack orders: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async createRoute(
    route: Partial<DispatchTrackRoute>,
  ): Promise<DispatchTrackRoute> {
    try {
      const response = await fetch(`${this.base_url}/routes`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(route),
      });

      if (!response.ok) {
        throw new Error(`DispatchTrack API error: ${response.statusText}`);
      }

      return (await response.json()) as DispatchTrackRoute;
    } catch (error) {
      throw new Error(
        `Failed to create DispatchTrack route: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getRoute(route_id: string): Promise<DispatchTrackRoute | null> {
    try {
      const response = await fetch(`${this.base_url}/routes/${route_id}`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`DispatchTrack API error: ${response.statusText}`);
      }

      return (await response.json()) as DispatchTrackRoute;
    } catch (error) {
      throw new Error(
        `Failed to get DispatchTrack route: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async optimizeRoute(
    route_id: string,
    options?: {
      consider_time_windows?: boolean;
      consider_capacity?: boolean;
    },
  ): Promise<DispatchTrackRoute> {
    try {
      const response = await fetch(
        `${this.base_url}/routes/${route_id}/optimize`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(options || {}),
        },
      );

      if (!response.ok) {
        throw new Error(`DispatchTrack API error: ${response.statusText}`);
      }

      return (await response.json()) as DispatchTrackRoute;
    } catch (error) {
      throw new Error(
        `Failed to optimize DispatchTrack route: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getDriver(driver_id: string): Promise<DispatchTrackDriver | null> {
    try {
      const response = await fetch(`${this.base_url}/drivers/${driver_id}`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`DispatchTrack API error: ${response.statusText}`);
      }

      return (await response.json()) as DispatchTrackDriver;
    } catch (error) {
      throw new Error(
        `Failed to get DispatchTrack driver: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async listDrivers(filters?: {
    status?: string;
  }): Promise<DispatchTrackDriver[]> {
    try {
      const query_params = new URLSearchParams();
      if (filters?.status) query_params.append("status", filters.status);

      const response = await fetch(
        `${this.base_url}/drivers?${query_params.toString()}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error(`DispatchTrack API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        drivers: DispatchTrackDriver[];
      };
      return data.drivers;
    } catch (error) {
      throw new Error(
        `Failed to list DispatchTrack drivers: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getETA(order_id: string): Promise<DispatchTrackETA | null> {
    try {
      const response = await fetch(`${this.base_url}/orders/${order_id}/eta`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`DispatchTrack API error: ${response.statusText}`);
      }

      return (await response.json()) as DispatchTrackETA;
    } catch (error) {
      throw new Error(
        `Failed to get DispatchTrack ETA: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async sendCustomerCommunication(
    order_id: string,
    message: string,
    communication_type: "sms" | "email" | "push",
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.base_url}/orders/${order_id}/communicate`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify({ message, communication_type }),
        },
      );

      return response.ok;
    } catch (error) {
      throw new Error(
        `Failed to send DispatchTrack customer communication: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getDeliveryWindow(order_id: string): Promise<{
    order_id: string;
    window_start: string;
    window_end: string;
    current_eta: string;
    is_on_time: boolean;
  } | null> {
    try {
      const response = await fetch(
        `${this.base_url}/orders/${order_id}/delivery-window`,
        {
          method: "GET",
          headers: this.getHeaders(),
        },
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`DispatchTrack API error: ${response.statusText}`);
      }

      return (await response.json()) as {
        order_id: string;
        window_start: string;
        window_end: string;
        current_eta: string;
        is_on_time: boolean;
      };
    } catch (error) {
      throw new Error(
        `Failed to get DispatchTrack delivery window: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async updateCapacityConstraints(
    driver_id: string,
    capacity_units: number,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.base_url}/drivers/${driver_id}/capacity`,
        {
          method: "PATCH",
          headers: this.getHeaders(),
          body: JSON.stringify({ capacity_units }),
        },
      );

      return response.ok;
    } catch (error) {
      throw new Error(
        `Failed to update DispatchTrack capacity constraints: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async assignOrderToDriver(
    order_id: string,
    driver_id: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.base_url}/orders/${order_id}/assign`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify({ driver_id }),
        },
      );

      return response.ok;
    } catch (error) {
      throw new Error(
        `Failed to assign order to driver: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getRouteOptimizationStatus(route_id: string): Promise<{
    route_id: string;
    status: "pending" | "processing" | "completed" | "failed";
    progress_percentage: number;
    completion_time_estimate?: string;
  }> {
    try {
      const response = await fetch(
        `${this.base_url}/routes/${route_id}/optimization-status`,
        {
          method: "GET",
          headers: this.getHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error(`DispatchTrack API error: ${response.statusText}`);
      }

      return (await response.json()) as {
        route_id: string;
        status: "pending" | "processing" | "completed" | "failed";
        progress_percentage: number;
        completion_time_estimate?: string;
      };
    } catch (error) {
      throw new Error(
        `Failed to get DispatchTrack optimization status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
