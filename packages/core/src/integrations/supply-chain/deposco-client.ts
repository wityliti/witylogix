/**
 * Deposco Bright Suite Client
 * API key authentication for order management, fulfillment, and shipping execution.
 * @packageDocumentation
 */

import { SupplyChainAdapter } from './supply-chain-adapter';
import { RetryHandler } from './supply-chain-adapter';
import type {
  SupplyChainConfig,
  WarehouseLocation,
  InventoryItem,
  InboundShipment,
  OutboundOrder,
  FulfillmentRequest,
  PurchaseOrder,
  TransferOrder,
  ReceiptConfirmation,
  WaveDefinition,
  PickTask,
  PackStation,
  ShipConfirmation,
} from './types';

/**
 * Deposco Bright Suite adapter
 * Supports order management and fulfillment operations
 */
export class DeposcoClient extends SupplyChainAdapter {
  public async initialize(): Promise<void> {
    try {
      await this.checkPrerequisites();
      this.logEvent('deposco.initialized');
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw new Error(`Deposco initialization failed: ${(error as Error).message}`);
    }
  }

  public async verifyConnection(): Promise<boolean> {
    try {
      await this.checkPrerequisites();
      const response = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const result = await fetch(`${this.config.baseUrl}/api/v1/warehouses`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        return result.ok;
      });
      this.handleApiResponse(true);
      return response;
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      return false;
    }
  }

  public async getWarehouse(warehouseId: string): Promise<WarehouseLocation> {
    try {
      await this.checkPrerequisites();

      const warehouse = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v1/warehouses/${warehouseId}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to get warehouse: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: warehouse.id,
        name: warehouse.name,
        code: warehouse.code,
        address: {
          street: warehouse.address?.street || '',
          city: warehouse.address?.city || '',
          state: warehouse.address?.state || '',
          postalCode: warehouse.address?.zip || '',
          country: warehouse.address?.country || 'US',
        },
        type: 'fc',
        status: 'active',
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async listWarehouses(): Promise<WarehouseLocation[]> {
    try {
      await this.checkPrerequisites();

      const warehouses = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v1/warehouses`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to list warehouses: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return warehouses.map((w: any) => ({
        id: w.id,
        name: w.name,
        code: w.code,
        address: {
          street: w.address?.street || '',
          city: w.address?.city || '',
          state: w.address?.state || '',
          postalCode: w.address?.zip || '',
          country: w.address?.country || 'US',
        },
        type: 'fc',
        status: 'active',
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async createWarehouse(warehouse: WarehouseLocation): Promise<WarehouseLocation> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          id: warehouse.id,
          name: warehouse.name,
          code: warehouse.code,
          address: {
            street: warehouse.address.street,
            city: warehouse.address.city,
            state: warehouse.address.state,
            zip: warehouse.address.postalCode,
            country: warehouse.address.country,
          },
        };

        const response = await fetch(`${this.config.baseUrl}/api/v1/warehouses`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to create warehouse: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('warehouse.created', { id: warehouse.id });

      return {
        id: result.id,
        name: result.name,
        code: result.code,
        address: warehouse.address,
        type: 'fc',
        status: 'active',
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async updateWarehouse(
    warehouseId: string,
    updates: Partial<WarehouseLocation>
  ): Promise<WarehouseLocation> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          name: updates.name,
        };

        const response = await fetch(`${this.config.baseUrl}/api/v1/warehouses/${warehouseId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to update warehouse: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent('warehouse.updated', { id: warehouseId });

      return this.getWarehouse(warehouseId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async getInventory(warehouseId: string, sku: string): Promise<InventoryItem> {
    try {
      await this.checkPrerequisites();

      const inventory = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/v1/warehouses/${warehouseId}/inventory/${sku}`,
          { method: 'GET', headers, signal: AbortSignal.timeout(this.config.timeout ?? 30000) }
        );
        if (!response.ok) throw new Error(`Failed to get inventory: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: inventory.id,
        sku: inventory.sku,
        warehouseId,
        zone: inventory.location?.zone || '',
        binLocation: inventory.location?.bin || '',
        quantityOnHand: inventory.qty_on_hand,
        quantityAllocated: inventory.qty_allocated,
        quantityAvailable: inventory.qty_available,
        productName: sku,
        uom: inventory.uom || 'EA',
        receivedDate: new Date(inventory.received_date || Date.now()),
        status: 'available',
        unitCost: inventory.cost || 0,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async listInventory(
    warehouseId: string,
    filters?: { zone?: string; status?: string; sku?: string }
  ): Promise<InventoryItem[]> {
    try {
      await this.checkPrerequisites();

      const items = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams();
        if (filters?.sku) params.append('sku', filters.sku);
        if (filters?.zone) params.append('zone', filters.zone);

        const response = await fetch(
          `${this.config.baseUrl}/api/v1/warehouses/${warehouseId}/inventory?${params}`,
          { method: 'GET', headers, signal: AbortSignal.timeout(this.config.timeout ?? 30000) }
        );
        if (!response.ok) throw new Error(`Failed to list inventory: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return items.map((inv: any) => ({
        id: inv.id,
        sku: inv.sku,
        warehouseId,
        zone: inv.location?.zone || '',
        binLocation: inv.location?.bin || '',
        quantityOnHand: inv.qty_on_hand,
        quantityAllocated: inv.qty_allocated,
        quantityAvailable: inv.qty_available,
        productName: inv.sku,
        uom: inv.uom || 'EA',
        receivedDate: new Date(inv.received_date || Date.now()),
        status: 'available',
        unitCost: inv.cost || 0,
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async syncInventoryRealTime(warehouseId: string): Promise<InventoryItem[]> {
    return this.listInventory(warehouseId);
  }

  public async syncInventoryBatch(warehouseId: string, skus: string[]): Promise<InventoryItem[]> {
    const results: InventoryItem[] = [];
    for (const sku of skus) {
      try {
        const item = await this.getInventory(warehouseId, sku);
        results.push(item);
      } catch (error) {
        this.logEvent('inventory.sync.error', { sku, error: (error as Error).message });
      }
    }
    return results;
  }

  public async adjustInventory(
    warehouseId: string,
    sku: string,
    quantity: number,
    reason: string
  ): Promise<InventoryItem> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          sku,
          qty_adjustment: quantity,
          reason,
          adjustment_date: new Date().toISOString(),
        };

        const response = await fetch(
          `${this.config.baseUrl}/api/v1/warehouses/${warehouseId}/inventory-adjustments`,
          { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(this.config.timeout ?? 30000) }
        );
        if (!response.ok) throw new Error(`Failed to adjust inventory: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent('inventory.adjusted', { sku, quantity, reason });

      return this.getInventory(warehouseId, sku);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async moveInventory(
    warehouseId: string,
    sku: string,
    fromBin: string,
    toBin: string,
    quantity: number
  ): Promise<InventoryItem[]> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          sku,
          from_bin: fromBin,
          to_bin: toBin,
          quantity,
          move_date: new Date().toISOString(),
        };

        const response = await fetch(
          `${this.config.baseUrl}/api/v1/warehouses/${warehouseId}/inventory-moves`,
          { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(this.config.timeout ?? 30000) }
        );
        if (!response.ok) throw new Error(`Failed to move inventory: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent('inventory.moved', { sku, fromBin, toBin, quantity });

      return [await this.getInventory(warehouseId, sku)];
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async getInboundShipment(shipmentId: string): Promise<InboundShipment> {
    try {
      await this.checkPrerequisites();

      const shipment = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v1/inbound/${shipmentId}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to get inbound shipment: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: shipment.id,
        trackingNumber: shipment.tracking_number || '',
        warehouseId: shipment.warehouse_id,
        status: (shipment.status as any) || 'in_transit',
        items: shipment.items || [],
        expectedDeliveryDate: new Date(shipment.expected_arrival),
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async listInboundShipments(
    warehouseId: string,
    status?: string
  ): Promise<InboundShipment[]> {
    try {
      await this.checkPrerequisites();

      const shipments = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams({ warehouse_id: warehouseId });
        if (status) params.append('status', status);

        const response = await fetch(
          `${this.config.baseUrl}/api/v1/inbound?${params}`,
          { method: 'GET', headers, signal: AbortSignal.timeout(this.config.timeout ?? 30000) }
        );
        if (!response.ok)
          throw new Error(`Failed to list inbound shipments: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return shipments.map((s: any) => ({
        id: s.id,
        trackingNumber: s.tracking_number || '',
        warehouseId,
        status: (s.status as any) || 'in_transit',
        items: s.items || [],
        expectedDeliveryDate: new Date(s.expected_arrival),
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async createInboundShipment(shipment: InboundShipment): Promise<InboundShipment> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          tracking_number: shipment.trackingNumber,
          warehouse_id: shipment.warehouseId,
          expected_arrival: shipment.expectedDeliveryDate,
          items: shipment.items,
          status: 'in_transit',
        };

        const response = await fetch(`${this.config.baseUrl}/api/v1/inbound`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to create inbound shipment: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('inbound.created', { id: result.id });

      return {
        id: result.id,
        trackingNumber: result.tracking_number,
        warehouseId: shipment.warehouseId,
        status: 'in_transit',
        items: shipment.items,
        expectedDeliveryDate: shipment.expectedDeliveryDate,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async receiveInboundShipment(
    shipmentId: string,
    receivedItems: Array<{ sku: string; quantity: number; lotNumber?: string }>
  ): Promise<InboundShipment> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          shipment_id: shipmentId,
          receive_date: new Date().toISOString(),
          items: receivedItems,
        };

        const response = await fetch(`${this.config.baseUrl}/api/v1/inbound/${shipmentId}/receive`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to receive shipment: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent('inbound.received', { id: shipmentId });

      return this.getInboundShipment(shipmentId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async confirmQualityCheck(
    shipmentId: string,
    qcPassed: boolean,
    notes?: string
  ): Promise<ReceiptConfirmation> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          shipment_id: shipmentId,
          qc_passed: qcPassed,
          qc_notes: notes || '',
          qc_date: new Date().toISOString(),
        };

        const response = await fetch(
          `${this.config.baseUrl}/api/v1/inbound/${shipmentId}/qc`,
          { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(this.config.timeout ?? 30000) }
        );
        if (!response.ok) throw new Error(`Failed to confirm QC: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('qc.confirmed', { shipmentId, qcPassed });

      return {
        id: result.receipt_id,
        shipmentId,
        warehouseId: this.config.warehouseId || '',
        receiptDate: new Date(),
        receivedBy: 'system',
        status: qcPassed ? 'qc_passed' : 'qc_failed',
        items: result.items || [],
        qcStatus: qcPassed ? 'pass' : 'fail',
        qcNotes: notes,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async getOutboundOrder(orderId: string): Promise<OutboundOrder> {
    try {
      await this.checkPrerequisites();

      const order = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v1/orders/${orderId}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to get order: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: order.id,
        orderNumber: order.order_number,
        type: 'sales',
        sourceWarehouseId: order.warehouse_id,
        orderDate: new Date(order.order_date),
        status: (order.status as any) || 'pending',
        priority: 'standard',
        items: order.items || [],
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async listOutboundOrders(
    warehouseId: string,
    status?: string
  ): Promise<OutboundOrder[]> {
    try {
      await this.checkPrerequisites();

      const orders = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams({ warehouse_id: warehouseId });
        if (status) params.append('status', status);

        const response = await fetch(`${this.config.baseUrl}/api/v1/orders?${params}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to list orders: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return orders.map((o: any) => ({
        id: o.id,
        orderNumber: o.order_number,
        type: 'sales',
        sourceWarehouseId: warehouseId,
        orderDate: new Date(o.order_date),
        status: (o.status as any) || 'pending',
        priority: 'standard',
        items: o.items || [],
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async createOutboundOrder(order: OutboundOrder): Promise<OutboundOrder> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          order_number: order.orderNumber,
          warehouse_id: order.sourceWarehouseId,
          order_date: order.orderDate,
          items: order.items,
          status: 'pending',
        };

        const response = await fetch(`${this.config.baseUrl}/api/v1/orders`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to create order: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('order.created', { id: result.id });

      return {
        id: result.id,
        orderNumber: order.orderNumber,
        type: order.type,
        sourceWarehouseId: order.sourceWarehouseId,
        orderDate: order.orderDate,
        status: 'pending',
        priority: order.priority,
        items: order.items,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async updateOutboundOrder(
    orderId: string,
    updates: Partial<OutboundOrder>
  ): Promise<OutboundOrder> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = { status: updates.status, priority: updates.priority };

        const response = await fetch(`${this.config.baseUrl}/api/v1/orders/${orderId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to update order: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent('order.updated', { id: orderId });

      return this.getOutboundOrder(orderId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async cancelOutboundOrder(orderId: string, reason: string): Promise<OutboundOrder> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = { reason };

        const response = await fetch(`${this.config.baseUrl}/api/v1/orders/${orderId}/cancel`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to cancel order: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent('order.cancelled', { id: orderId, reason });

      return this.getOutboundOrder(orderId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async getFulfillmentRequest(fulfillmentId: string): Promise<FulfillmentRequest> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/v1/fulfillment-requests/${fulfillmentId}`,
          { method: 'GET', headers, signal: AbortSignal.timeout(this.config.timeout ?? 30000) }
        );
        if (!response.ok)
          throw new Error(`Failed to get fulfillment request: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: result.id,
        orderId: result.order_id,
        warehouseId: result.warehouse_id,
        createdAt: new Date(result.created_date),
        status: (result.status as any) || 'pending',
        allocations: result.allocations || [],
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async allocateOrder(
    orderId: string,
    warehouseId: string,
    allocationMethod?: 'fifo' | 'closest' | 'random'
  ): Promise<FulfillmentRequest> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          order_id: orderId,
          warehouse_id: warehouseId,
          allocation_method: allocationMethod || 'fifo',
          allocated_date: new Date().toISOString(),
        };

        const response = await fetch(`${this.config.baseUrl}/api/v1/allocate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to allocate order: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('order.allocated', { orderId, warehouseId });

      return {
        id: result.id,
        orderId,
        warehouseId,
        createdAt: new Date(),
        status: 'allocated',
        allocations: result.allocations || [],
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async releaseFulfillment(fulfillmentId: string): Promise<FulfillmentRequest> {
    return this.updateFulfillmentStatus(fulfillmentId, 'in_progress');
  }

  public async updateFulfillmentStatus(
    fulfillmentId: string,
    status: string
  ): Promise<FulfillmentRequest> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = { status };

        const response = await fetch(
          `${this.config.baseUrl}/api/v1/fulfillment-requests/${fulfillmentId}`,
          { method: 'PUT', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(this.config.timeout ?? 30000) }
        );
        if (!response.ok)
          throw new Error(`Failed to update fulfillment: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent('fulfillment.updated', { id: fulfillmentId, status });

      return this.getFulfillmentRequest(fulfillmentId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async getWave(waveId: string): Promise<WaveDefinition> {
    try {
      await this.checkPrerequisites();

      const wave = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v1/waves/${waveId}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to get wave: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: wave.id,
        waveNumber: wave.wave_number,
        warehouseId: wave.warehouse_id,
        createdAt: new Date(wave.created_date),
        status: (wave.status as any) || 'planned',
        fulfillmentRequestIds: wave.fulfillment_ids || [],
        orderCount: wave.order_count,
        unitCount: wave.unit_count,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async listWaves(warehouseId: string, status?: string): Promise<WaveDefinition[]> {
    try {
      await this.checkPrerequisites();

      const waves = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams({ warehouse_id: warehouseId });
        if (status) params.append('status', status);

        const response = await fetch(`${this.config.baseUrl}/api/v1/waves?${params}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to list waves: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return waves.map((w: any) => ({
        id: w.id,
        waveNumber: w.wave_number,
        warehouseId,
        createdAt: new Date(w.created_date),
        status: (w.status as any) || 'planned',
        fulfillmentRequestIds: w.fulfillment_ids || [],
        orderCount: w.order_count,
        unitCount: w.unit_count,
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async createWave(
    warehouseId: string,
    fulfillmentIds: string[],
    pickMethod?: 'zone' | 'batch' | 'order'
  ): Promise<WaveDefinition> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          warehouse_id: warehouseId,
          fulfillment_ids: fulfillmentIds,
          pick_method: pickMethod || 'zone',
          created_date: new Date().toISOString(),
        };

        const response = await fetch(`${this.config.baseUrl}/api/v1/waves`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to create wave: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('wave.created', { id: result.id });

      return {
        id: result.id,
        waveNumber: result.wave_number,
        warehouseId,
        createdAt: new Date(result.created_date),
        status: 'planned',
        fulfillmentRequestIds: fulfillmentIds,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async releaseWave(waveId: string): Promise<WaveDefinition> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = { released_date: new Date().toISOString() };

        const response = await fetch(`${this.config.baseUrl}/api/v1/waves/${waveId}/release`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to release wave: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent('wave.released', { id: waveId });

      return this.getWave(waveId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async completeWave(waveId: string): Promise<WaveDefinition> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = { completed_date: new Date().toISOString() };

        const response = await fetch(`${this.config.baseUrl}/api/v1/waves/${waveId}/complete`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to complete wave: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent('wave.completed', { id: waveId });

      return this.getWave(waveId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async getPickTask(taskId: string): Promise<PickTask> {
    try {
      await this.checkPrerequisites();

      const task = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v1/pick-tasks/${taskId}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to get pick task: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: task.id,
        waveId: task.wave_id,
        fromBinLocation: task.from_bin,
        zone: task.zone || '',
        sku: task.sku,
        quantity: task.quantity,
        pickedQuantity: task.picked_quantity || 0,
        toBinLocation: task.to_bin || '',
        status: (task.status as any) || 'pending',
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async listPickTasks(waveId: string): Promise<PickTask[]> {
    try {
      await this.checkPrerequisites();

      const tasks = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v1/pick-tasks?wave_id=${waveId}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to list pick tasks: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return tasks.map((t: any) => ({
        id: t.id,
        waveId,
        fromBinLocation: t.from_bin,
        zone: t.zone || '',
        sku: t.sku,
        quantity: t.quantity,
        pickedQuantity: t.picked_quantity || 0,
        toBinLocation: t.to_bin || '',
        status: (t.status as any) || 'pending',
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async updatePickTask(
    taskId: string,
    pickedQuantity: number,
    status: string
  ): Promise<PickTask> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          picked_quantity: pickedQuantity,
          status,
          updated_date: new Date().toISOString(),
        };

        const response = await fetch(`${this.config.baseUrl}/api/v1/pick-tasks/${taskId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to update pick task: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent('pick_task.updated', { id: taskId, pickedQuantity, status });

      return this.getPickTask(taskId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async getPackStation(stationId: string): Promise<PackStation> {
    try {
      await this.checkPrerequisites();

      const station = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v1/pack-stations/${stationId}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to get pack station: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: station.id,
        name: station.name,
        warehouseId: station.warehouse_id,
        zone: station.zone,
        location: station.location,
        type: (station.type as any) || 'manual',
        status: (station.status as any) || 'active',
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async listPackStations(warehouseId: string): Promise<PackStation[]> {
    try {
      await this.checkPrerequisites();

      const stations = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/v1/pack-stations?warehouse_id=${warehouseId}`,
          { method: 'GET', headers, signal: AbortSignal.timeout(this.config.timeout ?? 30000) }
        );
        if (!response.ok) throw new Error(`Failed to list pack stations: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return stations.map((s: any) => ({
        id: s.id,
        name: s.name,
        warehouseId,
        zone: s.zone,
        location: s.location,
        type: (s.type as any) || 'manual',
        status: (s.status as any) || 'active',
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async confirmShipment(
    orderId: string,
    carrier: string,
    trackingNumber: string,
    weight?: number
  ): Promise<ShipConfirmation> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          order_id: orderId,
          carrier,
          tracking_number: trackingNumber,
          weight: weight || 0,
          ship_date: new Date().toISOString(),
        };

        const response = await fetch(`${this.config.baseUrl}/api/v1/ship-confirm`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to confirm shipment: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('shipment.confirmed', { orderId, trackingNumber });

      return {
        id: result.id,
        orderId,
        shipmentNumber: result.shipment_number,
        warehouseId: this.config.warehouseId || '',
        shipDate: new Date(),
        items: [],
        carrier,
        trackingNumber,
        weight,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async getLocation(
    warehouseId: string,
    binLocation: string
  ): Promise<{ binLocation: string; zone: string; capacity?: number; currentQuantity?: number }> {
    try {
      await this.checkPrerequisites();

      const location = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/v1/warehouses/${warehouseId}/locations/${binLocation}`,
          { method: 'GET', headers, signal: AbortSignal.timeout(this.config.timeout ?? 30000) }
        );
        if (!response.ok) throw new Error(`Failed to get location: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        binLocation: location.bin_location,
        zone: location.zone,
        capacity: location.capacity,
        currentQuantity: location.current_quantity,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async listZones(warehouseId: string): Promise<string[]> {
    try {
      await this.checkPrerequisites();

      const zones = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/v1/warehouses/${warehouseId}/zones`,
          { method: 'GET', headers, signal: AbortSignal.timeout(this.config.timeout ?? 30000) }
        );
        if (!response.ok) throw new Error(`Failed to list zones: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return zones.map((z: any) => z.zone);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async configureZone(
    warehouseId: string,
    zone: string,
    config: { pickMethod?: string; packStations?: number; capacity?: number }
  ): Promise<Record<string, unknown>> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          warehouse_id: warehouseId,
          zone,
          ...config,
          updated_date: new Date().toISOString(),
        };

        const response = await fetch(`${this.config.baseUrl}/api/v1/zones/${zone}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to configure zone: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('zone.configured', { zone });

      return result;
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async getPurchaseOrder(poId: string): Promise<PurchaseOrder> {
    try {
      await this.checkPrerequisites();

      const po = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v1/purchase-orders/${poId}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to get PO: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: po.id,
        poNumber: po.po_number,
        supplierId: po.supplier_id,
        warehouseId: po.warehouse_id,
        createdDate: new Date(po.created_date),
        expectedDeliveryDate: new Date(po.expected_delivery_date),
        status: (po.status as any) || 'draft',
        items: po.items || [],
        totalValue: po.total_value,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async listPurchaseOrders(status?: string): Promise<PurchaseOrder[]> {
    try {
      await this.checkPrerequisites();

      const pos = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams();
        if (status) params.append('status', status);

        const response = await fetch(
          `${this.config.baseUrl}/api/v1/purchase-orders?${params}`,
          { method: 'GET', headers, signal: AbortSignal.timeout(this.config.timeout ?? 30000) }
        );
        if (!response.ok) throw new Error(`Failed to list POs: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return pos.map((p: any) => ({
        id: p.id,
        poNumber: p.po_number,
        supplierId: p.supplier_id,
        warehouseId: p.warehouse_id,
        createdDate: new Date(p.created_date),
        expectedDeliveryDate: new Date(p.expected_delivery_date),
        status: (p.status as any) || 'draft',
        items: p.items || [],
        totalValue: p.total_value,
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async createPurchaseOrder(po: PurchaseOrder): Promise<PurchaseOrder> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          po_number: po.poNumber,
          supplier_id: po.supplierId,
          warehouse_id: po.warehouseId,
          created_date: po.createdDate,
          expected_delivery_date: po.expectedDeliveryDate,
          items: po.items,
          status: 'draft',
        };

        const response = await fetch(`${this.config.baseUrl}/api/v1/purchase-orders`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to create PO: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('po.created', { id: result.id });

      return {
        id: result.id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        warehouseId: po.warehouseId,
        createdDate: po.createdDate,
        expectedDeliveryDate: po.expectedDeliveryDate,
        status: 'draft',
        items: po.items,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async getTransferOrder(toId: string): Promise<TransferOrder> {
    try {
      await this.checkPrerequisites();

      const to = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v1/transfer-orders/${toId}`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to get transfer order: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: to.id,
        toNumber: to.to_number,
        fromWarehouseId: to.from_warehouse_id,
        toWarehouseId: to.to_warehouse_id,
        createdDate: new Date(to.created_date),
        expectedDeliveryDate: new Date(to.expected_delivery_date),
        status: (to.status as any) || 'pending',
        items: to.items || [],
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async listTransferOrders(status?: string): Promise<TransferOrder[]> {
    try {
      await this.checkPrerequisites();

      const tos = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams();
        if (status) params.append('status', status);

        const response = await fetch(
          `${this.config.baseUrl}/api/v1/transfer-orders?${params}`,
          { method: 'GET', headers, signal: AbortSignal.timeout(this.config.timeout ?? 30000) }
        );
        if (!response.ok) throw new Error(`Failed to list transfer orders: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return tos.map((t: any) => ({
        id: t.id,
        toNumber: t.to_number,
        fromWarehouseId: t.from_warehouse_id,
        toWarehouseId: t.to_warehouse_id,
        createdDate: new Date(t.created_date),
        expectedDeliveryDate: new Date(t.expected_delivery_date),
        status: (t.status as any) || 'pending',
        items: t.items || [],
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async createTransferOrder(to: TransferOrder): Promise<TransferOrder> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          to_number: to.toNumber,
          from_warehouse_id: to.fromWarehouseId,
          to_warehouse_id: to.toWarehouseId,
          created_date: to.createdDate,
          expected_delivery_date: to.expectedDeliveryDate,
          items: to.items,
          status: 'pending',
        };

        const response = await fetch(`${this.config.baseUrl}/api/v1/transfer-orders`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok) throw new Error(`Failed to create transfer order: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('to.created', { id: result.id });

      return {
        id: result.id,
        toNumber: to.toNumber,
        fromWarehouseId: to.fromWarehouseId,
        toWarehouseId: to.toWarehouseId,
        createdDate: to.createdDate,
        expectedDeliveryDate: to.expectedDeliveryDate,
        status: 'pending',
        items: to.items,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey || '',
      ...this.config.customHeaders,
    };
  }
}
