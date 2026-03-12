interface WorkWaveOrder {
  order_id: string;
  external_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  service_duration_minutes: number;
  notes?: string;
  status: string;
  scheduled_date: string;
  time_window_start?: string;
  time_window_end?: string;
}

interface WorkWaveRoute {
  route_id: string;
  date: string;
  driver_id: string;
  vehicle_id: string;
  orders: string[]; // order IDs
  status: string;
  planned_distance_km: number;
  planned_duration_minutes: number;
  planned_service_time_minutes: number;
  actual_distance_km?: number;
  actual_duration_minutes?: number;
}

interface WorkWaveVehicle {
  vehicle_id: string;
  name: string;
  type: string;
  capacity: number;
  current_load: number;
  fuel_type: string;
  license_plate: string;
  status: string;
}

interface WorkWaveDriver {
  driver_id: string;
  name: string;
  phone: string;
  email?: string;
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

interface WorkWaveGPSTracking {
  driver_id: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: string;
  address?: string;
}

export class WorkWaveClient {
  private api_key: string;
  private base_url: string;

  constructor(api_key: string, sandbox_mode: boolean = false) {
    this.api_key = api_key;
    this.base_url = sandbox_mode
      ? 'https://sandbox.workwaveapi.com/v2'
      : 'https://api.workwaveapi.com/v2';
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.api_key}`,
      'Content-Type': 'application/json',
    };
  }

  async createOrder(order: Partial<WorkWaveOrder>): Promise<WorkWaveOrder> {
    try {
      const response = await fetch(`${this.base_url}/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(order),
      });

      if (!response.ok) {
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      return (await response.json()) as WorkWaveOrder;
    } catch (error) {
      throw new Error(`Failed to create WorkWave order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getOrder(order_id: string): Promise<WorkWaveOrder | null> {
    try {
      const response = await fetch(`${this.base_url}/orders/${order_id}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      return (await response.json()) as WorkWaveOrder;
    } catch (error) {
      throw new Error(`Failed to get WorkWave order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateOrder(order_id: string, updates: Partial<WorkWaveOrder>): Promise<WorkWaveOrder> {
    try {
      const response = await fetch(`${this.base_url}/orders/${order_id}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      return (await response.json()) as WorkWaveOrder;
    } catch (error) {
      throw new Error(`Failed to update WorkWave order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listOrders(filters?: {
    status?: string;
    date?: string;
    limit?: number;
    offset?: number;
  }): Promise<WorkWaveOrder[]> {
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
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { orders: WorkWaveOrder[] };
      return data.orders;
    } catch (error) {
      throw new Error(`Failed to list WorkWave orders: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createRoute(route: Partial<WorkWaveRoute>): Promise<WorkWaveRoute> {
    try {
      const response = await fetch(`${this.base_url}/routes`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(route),
      });

      if (!response.ok) {
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      return (await response.json()) as WorkWaveRoute;
    } catch (error) {
      throw new Error(`Failed to create WorkWave route: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getRoute(route_id: string): Promise<WorkWaveRoute | null> {
    try {
      const response = await fetch(`${this.base_url}/routes/${route_id}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      return (await response.json()) as WorkWaveRoute;
    } catch (error) {
      throw new Error(`Failed to get WorkWave route: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async optimizeRoute(
    route_id: string,
    options?: {
      consider_service_time?: boolean;
      consider_time_windows?: boolean;
      consider_capacity?: boolean;
    }
  ): Promise<WorkWaveRoute> {
    try {
      const response = await fetch(`${this.base_url}/routes/${route_id}/optimize`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(options || {}),
      });

      if (!response.ok) {
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      return (await response.json()) as WorkWaveRoute;
    } catch (error) {
      throw new Error(`Failed to optimize WorkWave route: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createVehicle(vehicle: Partial<WorkWaveVehicle>): Promise<WorkWaveVehicle> {
    try {
      const response = await fetch(`${this.base_url}/vehicles`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(vehicle),
      });

      if (!response.ok) {
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      return (await response.json()) as WorkWaveVehicle;
    } catch (error) {
      throw new Error(`Failed to create WorkWave vehicle: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getVehicle(vehicle_id: string): Promise<WorkWaveVehicle | null> {
    try {
      const response = await fetch(`${this.base_url}/vehicles/${vehicle_id}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      return (await response.json()) as WorkWaveVehicle;
    } catch (error) {
      throw new Error(`Failed to get WorkWave vehicle: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listVehicles(): Promise<WorkWaveVehicle[]> {
    try {
      const response = await fetch(`${this.base_url}/vehicles`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { vehicles: WorkWaveVehicle[] };
      return data.vehicles;
    } catch (error) {
      throw new Error(`Failed to list WorkWave vehicles: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createDriver(driver: Partial<WorkWaveDriver>): Promise<WorkWaveDriver> {
    try {
      const response = await fetch(`${this.base_url}/drivers`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(driver),
      });

      if (!response.ok) {
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      return (await response.json()) as WorkWaveDriver;
    } catch (error) {
      throw new Error(`Failed to create WorkWave driver: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getDriver(driver_id: string): Promise<WorkWaveDriver | null> {
    try {
      const response = await fetch(`${this.base_url}/drivers/${driver_id}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      return (await response.json()) as WorkWaveDriver;
    } catch (error) {
      throw new Error(`Failed to get WorkWave driver: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listDrivers(filters?: { status?: string }): Promise<WorkWaveDriver[]> {
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
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { drivers: WorkWaveDriver[] };
      return data.drivers;
    } catch (error) {
      throw new Error(`Failed to list WorkWave drivers: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async trackDriverGPS(driver_id: string): Promise<WorkWaveGPSTracking | null> {
    try {
      const response = await fetch(`${this.base_url}/drivers/${driver_id}/tracking`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      return (await response.json()) as WorkWaveGPSTracking;
    } catch (error) {
      throw new Error(`Failed to get WorkWave GPS tracking: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateGPSTracking(tracking: WorkWaveGPSTracking): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.base_url}/drivers/${tracking.driver_id}/tracking`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(tracking),
        }
      );

      return response.ok;
    } catch (error) {
      throw new Error(`Failed to update WorkWave GPS tracking: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async assignOrderToRoute(route_id: string, order_id: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.base_url}/routes/${route_id}/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ order_id }),
      });

      return response.ok;
    } catch (error) {
      throw new Error(`Failed to assign order to WorkWave route: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async removeOrderFromRoute(route_id: string, order_id: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.base_url}/routes/${route_id}/orders/${order_id}`,
        {
          method: 'DELETE',
          headers: this.getHeaders(),
        }
      );

      return response.ok;
    } catch (error) {
      throw new Error(`Failed to remove order from WorkWave route: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getServiceTimeWindow(order_id: string): Promise<{
    order_id: string;
    window_start: string;
    window_end: string;
    service_duration_minutes: number;
  } | null> {
    try {
      const response = await fetch(`${this.base_url}/orders/${order_id}/service-window`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      return (await response.json()) as {
        order_id: string;
        window_start: string;
        window_end: string;
        service_duration_minutes: number;
      };
    } catch (error) {
      throw new Error(`Failed to get WorkWave service time window: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateServiceTime(
    order_id: string,
    service_duration_minutes: number
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.base_url}/orders/${order_id}/service-duration`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ service_duration_minutes }),
      });

      return response.ok;
    } catch (error) {
      throw new Error(`Failed to update WorkWave service time: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getRouteStats(route_id: string): Promise<{
    route_id: string;
    total_orders: number;
    completed_orders: number;
    remaining_orders: number;
    total_distance_km: number;
    estimated_time_remaining_minutes: number;
    stops_remaining: number;
  }> {
    try {
      const response = await fetch(`${this.base_url}/routes/${route_id}/stats`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`WorkWave API error: ${response.statusText}`);
      }

      return (await response.json()) as {
        route_id: string;
        total_orders: number;
        completed_orders: number;
        remaining_orders: number;
        total_distance_km: number;
        estimated_time_remaining_minutes: number;
        stops_remaining: number;
      };
    } catch (error) {
      throw new Error(`Failed to get WorkWave route stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
