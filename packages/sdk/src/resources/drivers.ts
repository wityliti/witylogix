/**
 * Drivers resource - manage delivery drivers
 */

import type { WitylogixClient } from "../client";
import type {
  Driver,
  DriverLocation,
  ListParams,
  PaginatedResponse,
  DriverStatus,
} from "../types";

export interface CreateDriverData {
  name: string;
  email: string;
  phone: string;
  vehicle_id: string;
  assigned_zone_id?: string;
  total_capacity: number;
}

export interface UpdateDriverData {
  name?: string;
  email?: string;
  phone?: string;
  assigned_zone_id?: string;
  total_capacity?: number;
  status?: DriverStatus;
}

/**
 * DriversResource - handle all driver-related API calls
 */
export class DriversResource {
  constructor(private client: WitylogixClient) {}

  /**
   * List all drivers with pagination
   *
   * @example
   * const drivers = await client.drivers.list({ page: 1, limit: 50 });
   */
  public async list(params?: ListParams): Promise<PaginatedResponse<Driver>> {
    return this.client.get<PaginatedResponse<Driver>>("/v1/drivers", params);
  }

  /**
   * Get a single driver by ID
   *
   * @example
   * const driver = await client.drivers.get('driver-123');
   */
  public async get(id: string): Promise<Driver> {
    return this.client.get<Driver>(`/v1/drivers/${id}`);
  }

  /**
   * Create a new driver
   *
   * @example
   * const driver = await client.drivers.create({
   *   name: 'John Doe',
   *   email: 'john@example.com',
   *   phone: '+1234567890',
   *   vehicle_id: 'van-001',
   *   total_capacity: 500
   * });
   */
  public async create(data: CreateDriverData): Promise<Driver> {
    return this.client.post<Driver>("/v1/drivers", data);
  }

  /**
   * Update a driver
   *
   * @example
   * const driver = await client.drivers.update('driver-123', {
   *   phone: '+1234567890'
   * });
   */
  public async update(id: string, data: UpdateDriverData): Promise<Driver> {
    return this.client.patch<Driver>(`/v1/drivers/${id}`, data);
  }

  /**
   * Delete a driver (soft delete)
   *
   * @example
   * await client.drivers.delete('driver-123');
   */
  public async delete(id: string): Promise<void> {
    await this.client.delete(`/v1/drivers/${id}`);
  }

  /**
   * Update driver's current location
   *
   * @example
   * const driver = await client.drivers.updateLocation('driver-123', {
   *   latitude: 40.7128,
   *   longitude: -74.0060,
   *   accuracy: 10,
   *   timestamp: '2024-03-10T12:00:00Z'
   * });
   */
  public async updateLocation(
    id: string,
    location: DriverLocation,
  ): Promise<Driver> {
    return this.client.patch<Driver>(`/v1/drivers/${id}/location`, location);
  }

  /**
   * Get drivers by status
   *
   * @example
   * const activeDrivers = await client.drivers.getByStatus('active');
   */
  public async getByStatus(
    status: DriverStatus,
    params?: ListParams,
  ): Promise<PaginatedResponse<Driver>> {
    return this.client.get<PaginatedResponse<Driver>>("/v1/drivers", {
      ...params,
      status,
    });
  }

  /**
   * Get drivers assigned to a zone
   *
   * @example
   * const zoneDrivers = await client.drivers.getByZone('zone-123');
   */
  public async getByZone(
    zoneId: string,
    params?: ListParams,
  ): Promise<PaginatedResponse<Driver>> {
    return this.client.get<PaginatedResponse<Driver>>("/v1/drivers", {
      ...params,
      assigned_zone_id: zoneId,
    });
  }

  /**
   * Get available drivers with capacity
   *
   * @example
   * const availableDrivers = await client.drivers.getAvailable({ limit: 10 });
   */
  public async getAvailable(
    params?: ListParams,
  ): Promise<PaginatedResponse<Driver>> {
    return this.client.get<PaginatedResponse<Driver>>(
      "/v1/drivers/available",
      params,
    );
  }

  /**
   * Update driver status
   *
   * @example
   * const driver = await client.drivers.setStatus('driver-123', 'inactive');
   */
  public async setStatus(id: string, status: DriverStatus): Promise<Driver> {
    return this.client.patch<Driver>(`/v1/drivers/${id}`, { status });
  }
}
