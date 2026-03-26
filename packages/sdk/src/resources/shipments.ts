/**
 * Shipments resource - track and manage shipments
 */

import type { WitylogixClient } from '../client';
import type { Shipment, ShipmentTracking, ListParams, PaginatedResponse, ShipmentStatus } from '../types';

export interface CreateShipmentData {
  order_id: string;
  driver_id?: string;
}

export interface UpdateShipmentData {
  driver_id?: string;
  estimated_delivery?: string;
}

/**
 * ShipmentsResource - handle all shipment-related API calls
 */
export class ShipmentsResource {
  constructor(private client: WitylogixClient) {}

  /**
   * List all shipments with pagination
   *
   * @example
   * const shipments = await client.shipments.list({ page: 1, limit: 50 });
   */
  public async list(params?: ListParams): Promise<PaginatedResponse<Shipment>> {
    return this.client.get<PaginatedResponse<Shipment>>('/v1/shipments', params);
  }

  /**
   * Get a single shipment by ID
   *
   * @example
   * const shipment = await client.shipments.get('shipment-123');
   */
  public async get(id: string): Promise<Shipment> {
    return this.client.get<Shipment>(`/v1/shipments/${id}`);
  }

  /**
   * Create a new shipment from an order
   *
   * @example
   * const shipment = await client.shipments.create({
   *   order_id: 'order-123',
   *   driver_id: 'driver-456'
   * });
   */
  public async create(data: CreateShipmentData): Promise<Shipment> {
    return this.client.post<Shipment>('/v1/shipments', data);
  }

  /**
   * Update a shipment
   *
   * @example
   * const shipment = await client.shipments.update('shipment-123', {
   *   driver_id: 'driver-789'
   * });
   */
  public async update(id: string, data: UpdateShipmentData): Promise<Shipment> {
    return this.client.patch<Shipment>(`/v1/shipments/${id}`, data);
  }

  /**
   * Delete a shipment (only for pending shipments)
   *
   * @example
   * await client.shipments.delete('shipment-123');
   */
  public async delete(id: string): Promise<void> {
    await this.client.delete(`/v1/shipments/${id}`);
  }

  /**
   * Update shipment status
   *
   * @example
   * const shipment = await client.shipments.updateStatus(
   *   'shipment-123',
   *   'out_for_delivery'
   * );
   */
  public async updateStatus(id: string, status: ShipmentStatus): Promise<Shipment> {
    return this.client.patch<Shipment>(`/v1/shipments/${id}/status`, {
      status,
    });
  }

  /**
   * Get full tracking information for a shipment
   *
   * @example
   * const tracking = await client.shipments.getTracking('shipment-123');
   * console.log(`Status: ${tracking.status}`);
   * console.log(`Location: ${tracking.location.address}`);
   */
  public async getTracking(id: string): Promise<ShipmentTracking> {
    return this.client.get<ShipmentTracking>(`/v1/shipments/${id}/tracking`);
  }

  /**
   * Get shipments by status
   *
   * @example
   * const inTransit = await client.shipments.getByStatus('in_transit');
   */
  public async getByStatus(
    status: ShipmentStatus,
    params?: ListParams
  ): Promise<PaginatedResponse<Shipment>> {
    return this.client.get<PaginatedResponse<Shipment>>('/v1/shipments', {
      ...params,
      status,
    });
  }

  /**
   * Get shipments for a specific order
   *
   * @example
   * const orderShipments = await client.shipments.getByOrder('order-123');
   */
  public async getByOrder(orderId: string, params?: ListParams): Promise<PaginatedResponse<Shipment>> {
    return this.client.get<PaginatedResponse<Shipment>>('/v1/shipments', {
      ...params,
      order_id: orderId,
    });
  }

  /**
   * Get shipments assigned to a driver
   *
   * @example
   * const driverShipments = await client.shipments.getByDriver('driver-123');
   */
  public async getByDriver(
    driverId: string,
    params?: ListParams
  ): Promise<PaginatedResponse<Shipment>> {
    return this.client.get<PaginatedResponse<Shipment>>('/v1/shipments', {
      ...params,
      driver_id: driverId,
    });
  }

  /**
   * Track a shipment by tracking number
   *
   * @example
   * const tracking = await client.shipments.trackByNumber('TRK-123456');
   */
  public async trackByNumber(trackingNumber: string): Promise<ShipmentTracking> {
    return this.client.get<ShipmentTracking>('/v1/shipments/track', {
      tracking_number: trackingNumber,
    });
  }

  /**
   * Bulk update shipment statuses
   *
   * @example
   * const results = await client.shipments.bulkUpdateStatus(
   *   ['shipment-1', 'shipment-2', 'shipment-3'],
   *   'delivered'
   * );
   */
  public async bulkUpdateStatus(
    ids: string[],
    status: ShipmentStatus
  ): Promise<{ updated: number; failed: number }> {
    return this.client.post<{ updated: number; failed: number }>(
      '/v1/shipments/bulk-update-status',
      {
        shipment_ids: ids,
        status,
      }
    );
  }
}
