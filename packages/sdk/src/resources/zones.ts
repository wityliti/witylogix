/**
 * Zones resource - manage delivery zones
 */

import type { WitylogixClient } from '../client';
import type { Zone, ZoneCheckResult, Location, ListParams, PaginatedResponse, ZoneStatus } from '../types';

export interface CreateZoneData {
  name: string;
  polygon_coordinates: Array<{
    latitude: number;
    longitude: number;
  }>;
  capacity: number;
}

export interface UpdateZoneData {
  name?: string;
  polygon_coordinates?: Array<{
    latitude: number;
    longitude: number;
  }>;
  capacity?: number;
  status?: ZoneStatus;
}

/**
 * ZonesResource - handle all zone-related API calls
 */
export class ZonesResource {
  constructor(private client: WitylogixClient) {}

  /**
   * List all zones with pagination
   *
   * @example
   * const zones = await client.zones.list({ page: 1, limit: 20 });
   */
  public async list(params?: ListParams): Promise<PaginatedResponse<Zone>> {
    return this.client.get<PaginatedResponse<Zone>>('/v1/zones', params);
  }

  /**
   * Get a single zone by ID
   *
   * @example
   * const zone = await client.zones.get('zone-123');
   */
  public async get(id: string): Promise<Zone> {
    return this.client.get<Zone>(`/v1/zones/${id}`);
  }

  /**
   * Create a new zone
   *
   * @example
   * const zone = await client.zones.create({
   *   name: 'Downtown Manhattan',
   *   polygon_coordinates: [
   *     { latitude: 40.7128, longitude: -74.0060 },
   *     { latitude: 40.7150, longitude: -74.0100 },
   *     { latitude: 40.7100, longitude: -74.0080 }
   *   ],
   *   capacity: 200
   * });
   */
  public async create(data: CreateZoneData): Promise<Zone> {
    return this.client.post<Zone>('/v1/zones', data);
  }

  /**
   * Update a zone
   *
   * @example
   * const zone = await client.zones.update('zone-123', {
   *   capacity: 250
   * });
   */
  public async update(id: string, data: UpdateZoneData): Promise<Zone> {
    return this.client.patch<Zone>(`/v1/zones/${id}`, data);
  }

  /**
   * Delete a zone
   *
   * @example
   * await client.zones.delete('zone-123');
   */
  public async delete(id: string): Promise<void> {
    await this.client.delete(`/v1/zones/${id}`);
  }

  /**
   * Check if a point is inside a zone
   *
   * @example
   * const result = await client.zones.checkPoint(40.7128, -74.0060);
   * if (result.inside) {
   *   console.log(`Location is in zone: ${result.zone_id}`);
   * }
   */
  public async checkPoint(latitude: number, longitude: number): Promise<ZoneCheckResult> {
    return this.client.post<ZoneCheckResult>('/v1/zones/check-point', {
      latitude,
      longitude,
    });
  }

  /**
   * Check if a point is inside a specific zone
   *
   * @example
   * const isInside = await client.zones.isPointInZone('zone-123', 40.7128, -74.0060);
   */
  public async isPointInZone(
    zoneId: string,
    latitude: number,
    longitude: number
  ): Promise<boolean> {
    const result = await this.checkPoint(latitude, longitude);
    return result.zone_id === zoneId && result.inside;
  }

  /**
   * Get zones by status
   *
   * @example
   * const activeZones = await client.zones.getByStatus('active');
   */
  public async getByStatus(
    status: ZoneStatus,
    params?: ListParams
  ): Promise<PaginatedResponse<Zone>> {
    return this.client.get<PaginatedResponse<Zone>>('/v1/zones', {
      ...params,
      status,
    });
  }

  /**
   * Find all zones containing a location
   *
   * @example
   * const zones = await client.zones.findByLocation(40.7128, -74.0060);
   */
  public async findByLocation(latitude: number, longitude: number): Promise<Zone[]> {
    const response = await this.client.get<{ zones: Zone[] }>('/v1/zones/by-location', {
      latitude,
      longitude,
    });
    return response.zones || [];
  }

  /**
   * Add a driver to a zone
   *
   * @example
   * const zone = await client.zones.addDriver('zone-123', 'driver-456');
   */
  public async addDriver(zoneId: string, driverId: string): Promise<Zone> {
    return this.client.patch<Zone>(`/v1/zones/${zoneId}/drivers`, {
      driver_id: driverId,
      action: 'add',
    });
  }

  /**
   * Remove a driver from a zone
   *
   * @example
   * const zone = await client.zones.removeDriver('zone-123', 'driver-456');
   */
  public async removeDriver(zoneId: string, driverId: string): Promise<Zone> {
    return this.client.patch<Zone>(`/v1/zones/${zoneId}/drivers`, {
      driver_id: driverId,
      action: 'remove',
    });
  }
}
