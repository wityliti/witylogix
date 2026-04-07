/**
 * Manhattan Associates WMS Client
 * WSDL/REST hybrid API client for warehouse management operations.
 * Supports OAuth2 authentication, wave management, pick optimization, dock scheduling.
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
 * Manhattan OAuth2 token response
 */
interface ManhattanTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/**
 * Manhattan warehouse API response
 */
interface ManhattanWarehouse {
  WHID: string;
  WNAME?: string;
  WCODE?: string;
  WCITY?: string;
  WSTATE?: string;
  WZIP?: string;
  WCOUNTRY?: string;
  WSTATUS?: string;
}

/**
 * Manhattan inventory response
 */
interface ManhattanInventory {
  ITEMID: string;
  SKU: string;
  WHID: string;
  LOC: string;
  ZONE?: string;
  QOH: number;
  QAL: number;
  QAV: number;
  UOM?: string;
  COST?: number;
  STATUS?: string;
}

/**
 * Manhattan wave response
 */
interface ManhattanWave {
  WaveID: string;
  WaveNumber: string;
  WHID: string;
  CreatedOn: string;
  Status: string;
  OrderCount?: number;
  UnitCount?: number;
}

/**
 * Manhattan pick task response
 */
interface ManhattanPickTask {
  TaskID: string;
  WaveID: string;
  FromLoc: string;
  ToLoc?: string;
  SKU: string;
  Qty: number;
  PickedQty?: number;
  Status: string;
  AssignedWorker?: string;
  Zone?: string;
}

/**
 * Manhattan Associates WMS adapter
 * Implements warehouse management operations via WSDL/REST hybrid API
 */
export class ManhattanClient extends SupplyChainAdapter {
  private accessToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private wsClient: any = null;

  /**
   * Initialize Manhattan client and authenticate
   * @throws Error if authentication fails
   */
  public async initialize(): Promise<void> {
    try {
      await this.checkPrerequisites();
      await this.authenticateOAuth2();
      this.logEvent('manhattan.initialized');
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw new Error(`Manhattan initialization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Verify connection to Manhattan system
   * @returns True if connection successful
   */
  public async verifyConnection(): Promise<boolean> {
    try {
      await this.checkPrerequisites();
      const response = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const result = await fetch(`${this.config.baseUrl}/api/v2/warehouses`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
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

  // ============================================================================
  // WAREHOUSE OPERATIONS
  // ============================================================================

  /**
   * Get warehouse from Manhattan
   * @param warehouseId Warehouse identifier
   * @returns Warehouse location
   */
  public async getWarehouse(warehouseId: string): Promise<WarehouseLocation> {
    try {
      await this.checkPrerequisites();

      const warehouse = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v2/warehouses/${warehouseId}`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to get warehouse: ${response.statusText}`);
        }

        return response.json() as Promise<ManhattanWarehouse>;
      });

      this.handleApiResponse(true);

      return {
        id: warehouse.WHID,
        name: warehouse.WNAME || warehouseId,
        code: warehouse.WCODE || '',
        address: {
          street: '',
          city: warehouse.WCITY || '',
          state: warehouse.WSTATE || '',
          postalCode: warehouse.WZIP || '',
          country: warehouse.WCOUNTRY || 'US',
        },
        type: 'dc',
        status: (warehouse.WSTATUS as any) || 'active',
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * List warehouses accessible to tenant
   * @returns Array of warehouses
   */
  public async listWarehouses(): Promise<WarehouseLocation[]> {
    try {
      await this.checkPrerequisites();

      const warehouses = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v2/warehouses`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to list warehouses: ${response.statusText}`);
        }

        const data = (await response.json()) as { items?: ManhattanWarehouse[] };
        return data.items || [];
      });

      this.handleApiResponse(true);

      return warehouses.map((w) => ({
        id: w.WHID,
        name: w.WNAME || w.WHID,
        code: w.WCODE || '',
        address: {
          street: '',
          city: w.WCITY || '',
          state: w.WSTATE || '',
          postalCode: w.WZIP || '',
          country: w.WCOUNTRY || 'US',
        },
        type: 'dc',
        status: (w.WSTATUS as any) || 'active',
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Create warehouse in Manhattan
   * @param warehouse Warehouse to create
   * @returns Created warehouse
   */
  public async createWarehouse(warehouse: WarehouseLocation): Promise<WarehouseLocation> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          WHID: warehouse.id,
          WNAME: warehouse.name,
          WCODE: warehouse.code,
          WCITY: warehouse.address.city,
          WSTATE: warehouse.address.state,
          WZIP: warehouse.address.postalCode,
          WCOUNTRY: warehouse.address.country,
          WSTATUS: warehouse.status,
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/warehouses`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to create warehouse: ${response.statusText}`);
        }

        return response.json() as Promise<ManhattanWarehouse>;
      });

      this.handleApiResponse(true);
      this.logEvent('warehouse.created', { id: warehouse.id });

      return {
        id: result.WHID,
        name: result.WNAME || warehouse.name,
        code: result.WCODE || warehouse.code,
        address: warehouse.address,
        type: warehouse.type,
        status: (result.WSTATUS as any) || warehouse.status,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Update warehouse configuration
   * @param warehouseId Warehouse ID
   * @param updates Partial updates
   * @returns Updated warehouse
   */
  public async updateWarehouse(
    warehouseId: string,
    updates: Partial<WarehouseLocation>
  ): Promise<WarehouseLocation> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          WNAME: updates.name,
          WSTATUS: updates.status,
          WCITY: updates.address?.city,
          WSTATE: updates.address?.state,
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/warehouses/${warehouseId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to update warehouse: ${response.statusText}`);
        }
      });

      this.handleApiResponse(true);
      this.logEvent('warehouse.updated', { id: warehouseId });

      return await this.getWarehouse(warehouseId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  // ============================================================================
  // INVENTORY MANAGEMENT
  // ============================================================================

  /**
   * Get inventory for SKU
   * @param warehouseId Warehouse ID
   * @param sku Stock keeping unit
   * @returns Inventory item
   */
  public async getInventory(warehouseId: string, sku: string): Promise<InventoryItem> {
    try {
      await this.checkPrerequisites();

      const inventory = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/v2/inventory?WHID=${warehouseId}&SKU=${sku}`,
          {
            method: 'GET',
            headers,
            timeout: this.config.timeout,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to get inventory: ${response.statusText}`);
        }

        const data = (await response.json()) as { items?: ManhattanInventory[] };
        return data.items?.[0];
      });

      if (!inventory) {
        throw new Error(`Inventory not found for SKU ${sku}`);
      }

      this.handleApiResponse(true);

      return {
        id: inventory.ITEMID,
        sku: inventory.SKU,
        warehouseId,
        zone: inventory.ZONE || '',
        binLocation: inventory.LOC,
        quantityOnHand: inventory.QOH,
        quantityAllocated: inventory.QAL,
        quantityAvailable: inventory.QAV,
        productName: sku,
        uom: inventory.UOM || 'EACH',
        receivedDate: new Date(),
        status: (inventory.STATUS as any) || 'available',
        unitCost: inventory.COST || 0,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * List inventory at warehouse
   * @param warehouseId Warehouse ID
   * @param filters Optional filters
   * @returns Array of inventory items
   */
  public async listInventory(
    warehouseId: string,
    filters?: {
      zone?: string;
      status?: string;
      sku?: string;
    }
  ): Promise<InventoryItem[]> {
    try {
      await this.checkPrerequisites();

      const items = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams({ WHID: warehouseId });
        if (filters?.zone) params.append('ZONE', filters.zone);
        if (filters?.status) params.append('STATUS', filters.status);
        if (filters?.sku) params.append('SKU', filters.sku);

        const response = await fetch(`${this.config.baseUrl}/api/v2/inventory?${params}`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to list inventory: ${response.statusText}`);
        }

        const data = (await response.json()) as { items?: ManhattanInventory[] };
        return data.items || [];
      });

      this.handleApiResponse(true);

      return items.map((inv) => ({
        id: inv.ITEMID,
        sku: inv.SKU,
        warehouseId,
        zone: inv.ZONE || '',
        binLocation: inv.LOC,
        quantityOnHand: inv.QOH,
        quantityAllocated: inv.QAL,
        quantityAvailable: inv.QAV,
        productName: inv.SKU,
        uom: inv.UOM || 'EACH',
        receivedDate: new Date(),
        status: (inv.STATUS as any) || 'available',
        unitCost: inv.COST || 0,
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Real-time inventory sync
   * @param warehouseId Warehouse ID
   * @returns Synced inventory
   */
  public async syncInventoryRealTime(warehouseId: string): Promise<InventoryItem[]> {
    return this.listInventory(warehouseId);
  }

  /**
   * Batch inventory sync
   * @param warehouseId Warehouse ID
   * @param skus SKUs to sync
   * @returns Synced inventory
   */
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

  /**
   * Adjust inventory
   * @param warehouseId Warehouse ID
   * @param sku SKU
   * @param quantity Adjustment quantity
   * @param reason Reason for adjustment
   * @returns Updated inventory
   */
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
          WHID: warehouseId,
          SKU: sku,
          ADJQTY: quantity,
          REASON: reason,
          ADJDATE: new Date().toISOString(),
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/inventory/adjust`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to adjust inventory: ${response.statusText}`);
        }
      });

      this.handleApiResponse(true);
      this.logEvent('inventory.adjusted', { sku, quantity, reason });

      return this.getInventory(warehouseId, sku);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Move inventory between locations
   * @param warehouseId Warehouse ID
   * @param sku SKU
   * @param fromBin From bin
   * @param toBin To bin
   * @param quantity Quantity
   * @returns Updated inventory items
   */
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
          WHID: warehouseId,
          SKU: sku,
          FROMLOC: fromBin,
          TOLOC: toBin,
          QTY: quantity,
          MOVEDATE: new Date().toISOString(),
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/inventory/move`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to move inventory: ${response.statusText}`);
        }
      });

      this.handleApiResponse(true);
      this.logEvent('inventory.moved', { sku, fromBin, toBin, quantity });

      return [await this.getInventory(warehouseId, sku)];
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  // ============================================================================
  // INBOUND OPERATIONS
  // ============================================================================

  /**
   * Get inbound shipment
   * @param shipmentId Shipment ID
   * @returns Inbound shipment
   */
  public async getInboundShipment(shipmentId: string): Promise<InboundShipment> {
    try {
      await this.checkPrerequisites();

      const shipment = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v2/inbound/${shipmentId}`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to get inbound shipment: ${response.statusText}`);
        }

        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: shipment.ShipmentID,
        trackingNumber: shipment.TrackingNumber || '',
        warehouseId: shipment.WHID,
        status: (shipment.Status as any) || 'in_transit',
        items: shipment.Items || [],
        expectedDeliveryDate: new Date(shipment.ExpectedDeliveryDate),
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * List inbound shipments
   * @param warehouseId Warehouse ID
   * @param status Status filter
   * @returns Array of shipments
   */
  public async listInboundShipments(
    warehouseId: string,
    status?: string
  ): Promise<InboundShipment[]> {
    try {
      await this.checkPrerequisites();

      const shipments = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams({ WHID: warehouseId });
        if (status) params.append('Status', status);

        const response = await fetch(`${this.config.baseUrl}/api/v2/inbound?${params}`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to list inbound shipments: ${response.statusText}`);
        }

        const data = (await response.json()) as { items?: any[] };
        return data.items || [];
      });

      this.handleApiResponse(true);

      return shipments.map((s) => ({
        id: s.ShipmentID,
        trackingNumber: s.TrackingNumber || '',
        warehouseId,
        status: (s.Status as any) || 'in_transit',
        items: s.Items || [],
        expectedDeliveryDate: new Date(s.ExpectedDeliveryDate),
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Create inbound shipment
   * @param shipment Shipment data
   * @returns Created shipment
   */
  public async createInboundShipment(shipment: InboundShipment): Promise<InboundShipment> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          TrackingNumber: shipment.trackingNumber,
          WHID: shipment.warehouseId,
          ExpectedDeliveryDate: shipment.expectedDeliveryDate,
          Items: shipment.items,
          Status: 'in_transit',
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/inbound`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to create inbound shipment: ${response.statusText}`);
        }

        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('inbound.created', { id: result.ShipmentID });

      return {
        id: result.ShipmentID,
        trackingNumber: result.TrackingNumber,
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

  /**
   * Receive inbound shipment
   * @param shipmentId Shipment ID
   * @param receivedItems Received items
   * @returns Updated shipment
   */
  public async receiveInboundShipment(
    shipmentId: string,
    receivedItems: Array<{
      sku: string;
      quantity: number;
      lotNumber?: string;
    }>
  ): Promise<InboundShipment> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          ShipmentID: shipmentId,
          ReceiveDate: new Date().toISOString(),
          Items: receivedItems,
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/inbound/${shipmentId}/receive`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to receive shipment: ${response.statusText}`);
        }
      });

      this.handleApiResponse(true);
      this.logEvent('inbound.received', { id: shipmentId });

      return this.getInboundShipment(shipmentId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Confirm quality check
   * @param shipmentId Shipment ID
   * @param qcPassed QC passed flag
   * @param notes QC notes
   * @returns Receipt confirmation
   */
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
          ShipmentID: shipmentId,
          QCPassed: qcPassed,
          QCNotes: notes || '',
          QCDate: new Date().toISOString(),
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/inbound/${shipmentId}/qc`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to confirm QC: ${response.statusText}`);
        }

        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('qc.confirmed', { shipmentId, qcPassed });

      return {
        id: result.ReceiptID,
        shipmentId,
        warehouseId: this.config.warehouseId || '',
        receiptDate: new Date(),
        receivedBy: 'system',
        status: qcPassed ? 'qc_passed' : 'qc_failed',
        items: result.Items || [],
        qcStatus: qcPassed ? 'pass' : 'fail',
        qcNotes: notes,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  // ============================================================================
  // OUTBOUND OPERATIONS
  // ============================================================================

  /**
   * Get outbound order
   * @param orderId Order ID
   * @returns Outbound order
   */
  public async getOutboundOrder(orderId: string): Promise<OutboundOrder> {
    try {
      await this.checkPrerequisites();

      const order = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v2/orders/${orderId}`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to get order: ${response.statusText}`);
        }

        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: order.OrderID,
        orderNumber: order.OrderNumber,
        type: 'sales',
        sourceWarehouseId: order.WHID,
        orderDate: new Date(order.OrderDate),
        status: (order.Status as any) || 'pending',
        priority: 'standard',
        items: order.Items || [],
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * List outbound orders
   * @param warehouseId Warehouse ID
   * @param status Status filter
   * @returns Array of orders
   */
  public async listOutboundOrders(
    warehouseId: string,
    status?: string
  ): Promise<OutboundOrder[]> {
    try {
      await this.checkPrerequisites();

      const orders = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams({ WHID: warehouseId });
        if (status) params.append('Status', status);

        const response = await fetch(`${this.config.baseUrl}/api/v2/orders?${params}`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to list orders: ${response.statusText}`);
        }

        const data = (await response.json()) as { items?: any[] };
        return data.items || [];
      });

      this.handleApiResponse(true);

      return orders.map((o) => ({
        id: o.OrderID,
        orderNumber: o.OrderNumber,
        type: 'sales',
        sourceWarehouseId: warehouseId,
        orderDate: new Date(o.OrderDate),
        status: (o.Status as any) || 'pending',
        priority: 'standard',
        items: o.Items || [],
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Create outbound order
   * @param order Order data
   * @returns Created order
   */
  public async createOutboundOrder(order: OutboundOrder): Promise<OutboundOrder> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          OrderNumber: order.orderNumber,
          WHID: order.sourceWarehouseId,
          OrderDate: order.orderDate,
          Items: order.items,
          Status: 'pending',
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/orders`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to create order: ${response.statusText}`);
        }

        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('order.created', { id: result.OrderID });

      return {
        id: result.OrderID,
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

  /**
   * Update outbound order
   * @param orderId Order ID
   * @param updates Updates
   * @returns Updated order
   */
  public async updateOutboundOrder(
    orderId: string,
    updates: Partial<OutboundOrder>
  ): Promise<OutboundOrder> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          Status: updates.status,
          Priority: updates.priority,
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/orders/${orderId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to update order: ${response.statusText}`);
        }
      });

      this.handleApiResponse(true);
      this.logEvent('order.updated', { id: orderId });

      return this.getOutboundOrder(orderId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Cancel outbound order
   * @param orderId Order ID
   * @param reason Cancellation reason
   * @returns Cancelled order
   */
  public async cancelOutboundOrder(orderId: string, reason: string): Promise<OutboundOrder> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = { Reason: reason };

        const response = await fetch(`${this.config.baseUrl}/api/v2/orders/${orderId}/cancel`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to cancel order: ${response.statusText}`);
        }
      });

      this.handleApiResponse(true);
      this.logEvent('order.cancelled', { id: orderId, reason });

      return this.getOutboundOrder(orderId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  // ============================================================================
  // FULFILLMENT & ALLOCATION
  // ============================================================================

  /**
   * Get fulfillment request
   * @param fulfillmentId Fulfillment ID
   * @returns Fulfillment request
   */
  public async getFulfillmentRequest(fulfillmentId: string): Promise<FulfillmentRequest> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/v2/fulfillment/${fulfillmentId}`,
          {
            method: 'GET',
            headers,
            timeout: this.config.timeout,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to get fulfillment: ${response.statusText}`);
        }

        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: result.FulfillmentID,
        orderId: result.OrderID,
        warehouseId: result.WHID,
        createdAt: new Date(result.CreatedDate),
        status: (result.Status as any) || 'pending',
        allocations: result.Allocations || [],
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Allocate order
   * @param orderId Order ID
   * @param warehouseId Warehouse ID
   * @param allocationMethod Allocation method
   * @returns Fulfillment request
   */
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
          OrderID: orderId,
          WHID: warehouseId,
          AllocationMethod: allocationMethod || 'fifo',
          AllocatedDate: new Date().toISOString(),
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/allocate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to allocate order: ${response.statusText}`);
        }

        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('order.allocated', { orderId, warehouseId });

      return {
        id: result.FulfillmentID,
        orderId,
        warehouseId,
        createdAt: new Date(),
        status: 'allocated',
        allocations: result.Allocations || [],
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Release fulfillment
   * @param fulfillmentId Fulfillment ID
   * @returns Released fulfillment
   */
  public async releaseFulfillment(fulfillmentId: string): Promise<FulfillmentRequest> {
    return this.updateFulfillmentStatus(fulfillmentId, 'in_progress');
  }

  /**
   * Update fulfillment status
   * @param fulfillmentId Fulfillment ID
   * @param status New status
   * @returns Updated fulfillment
   */
  public async updateFulfillmentStatus(
    fulfillmentId: string,
    status: string
  ): Promise<FulfillmentRequest> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = { Status: status };

        const response = await fetch(
          `${this.config.baseUrl}/api/v2/fulfillment/${fulfillmentId}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify(payload),
            timeout: this.config.timeout,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to update fulfillment: ${response.statusText}`);
        }
      });

      this.handleApiResponse(true);
      this.logEvent('fulfillment.updated', { id: fulfillmentId, status });

      return this.getFulfillmentRequest(fulfillmentId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  // ============================================================================
  // WAVE MANAGEMENT
  // ============================================================================

  /**
   * Get wave
   * @param waveId Wave ID
   * @returns Wave definition
   */
  public async getWave(waveId: string): Promise<WaveDefinition> {
    try {
      await this.checkPrerequisites();

      const wave = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v2/waves/${waveId}`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to get wave: ${response.statusText}`);
        }

        return response.json() as Promise<ManhattanWave>;
      });

      this.handleApiResponse(true);

      return {
        id: wave.WaveID,
        waveNumber: wave.WaveNumber,
        warehouseId: wave.WHID,
        createdAt: new Date(wave.CreatedOn),
        status: (wave.Status as any) || 'planned',
        fulfillmentRequestIds: [],
        orderCount: wave.OrderCount,
        unitCount: wave.UnitCount,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * List waves
   * @param warehouseId Warehouse ID
   * @param status Status filter
   * @returns Array of waves
   */
  public async listWaves(warehouseId: string, status?: string): Promise<WaveDefinition[]> {
    try {
      await this.checkPrerequisites();

      const waves = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams({ WHID: warehouseId });
        if (status) params.append('Status', status);

        const response = await fetch(`${this.config.baseUrl}/api/v2/waves?${params}`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to list waves: ${response.statusText}`);
        }

        const data = (await response.json()) as { items?: ManhattanWave[] };
        return data.items || [];
      });

      this.handleApiResponse(true);

      return waves.map((w) => ({
        id: w.WaveID,
        waveNumber: w.WaveNumber,
        warehouseId,
        createdAt: new Date(w.CreatedOn),
        status: (w.Status as any) || 'planned',
        fulfillmentRequestIds: [],
        orderCount: w.OrderCount,
        unitCount: w.UnitCount,
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Create wave
   * @param warehouseId Warehouse ID
   * @param fulfillmentIds Fulfillment IDs
   * @param pickMethod Pick method
   * @returns Created wave
   */
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
          WHID: warehouseId,
          FulfillmentIDs: fulfillmentIds,
          PickMethod: pickMethod || 'zone',
          CreatedDate: new Date().toISOString(),
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/waves`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to create wave: ${response.statusText}`);
        }

        return response.json() as Promise<ManhattanWave>;
      });

      this.handleApiResponse(true);
      this.logEvent('wave.created', { id: result.WaveID });

      return {
        id: result.WaveID,
        waveNumber: result.WaveNumber,
        warehouseId,
        createdAt: new Date(result.CreatedOn),
        status: 'planned',
        fulfillmentRequestIds: fulfillmentIds,
        orderCount: result.OrderCount,
        unitCount: result.UnitCount,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Release wave
   * @param waveId Wave ID
   * @returns Released wave
   */
  public async releaseWave(waveId: string): Promise<WaveDefinition> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = { ReleasedDate: new Date().toISOString() };

        const response = await fetch(`${this.config.baseUrl}/api/v2/waves/${waveId}/release`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to release wave: ${response.statusText}`);
        }
      });

      this.handleApiResponse(true);
      this.logEvent('wave.released', { id: waveId });

      return this.getWave(waveId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Complete wave
   * @param waveId Wave ID
   * @returns Completed wave
   */
  public async completeWave(waveId: string): Promise<WaveDefinition> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = { CompletedDate: new Date().toISOString() };

        const response = await fetch(`${this.config.baseUrl}/api/v2/waves/${waveId}/complete`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to complete wave: ${response.statusText}`);
        }
      });

      this.handleApiResponse(true);
      this.logEvent('wave.completed', { id: waveId });

      return this.getWave(waveId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  // ============================================================================
  // PICK TASKS
  // ============================================================================

  /**
   * Get pick task
   * @param taskId Pick task ID
   * @returns Pick task
   */
  public async getPickTask(taskId: string): Promise<PickTask> {
    try {
      await this.checkPrerequisites();

      const task = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v2/pick-tasks/${taskId}`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to get pick task: ${response.statusText}`);
        }

        return response.json() as Promise<ManhattanPickTask>;
      });

      this.handleApiResponse(true);

      return {
        id: task.TaskID,
        waveId: task.WaveID,
        fromBinLocation: task.FromLoc,
        zone: task.Zone || '',
        sku: task.SKU,
        quantity: task.Qty,
        pickedQuantity: task.PickedQty || 0,
        toBinLocation: task.ToLoc || '',
        status: (task.Status as any) || 'pending',
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * List pick tasks for wave
   * @param waveId Wave ID
   * @returns Array of pick tasks
   */
  public async listPickTasks(waveId: string): Promise<PickTask[]> {
    try {
      await this.checkPrerequisites();

      const tasks = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/v2/pick-tasks?WaveID=${waveId}`,
          {
            method: 'GET',
            headers,
            timeout: this.config.timeout,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to list pick tasks: ${response.statusText}`);
        }

        const data = (await response.json()) as { items?: ManhattanPickTask[] };
        return data.items || [];
      });

      this.handleApiResponse(true);

      return tasks.map((t) => ({
        id: t.TaskID,
        waveId,
        fromBinLocation: t.FromLoc,
        zone: t.Zone || '',
        sku: t.SKU,
        quantity: t.Qty,
        pickedQuantity: t.PickedQty || 0,
        toBinLocation: t.ToLoc || '',
        status: (t.Status as any) || 'pending',
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Update pick task
   * @param taskId Pick task ID
   * @param pickedQuantity Picked quantity
   * @param status Task status
   * @returns Updated pick task
   */
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
          PickedQty: pickedQuantity,
          Status: status,
          UpdatedDate: new Date().toISOString(),
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/pick-tasks/${taskId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to update pick task: ${response.statusText}`);
        }
      });

      this.handleApiResponse(true);
      this.logEvent('pick_task.updated', { id: taskId, pickedQuantity, status });

      return this.getPickTask(taskId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  // ============================================================================
  // PACK STATIONS & SHIPPING
  // ============================================================================

  /**
   * Get pack station
   * @param stationId Station ID
   * @returns Pack station
   */
  public async getPackStation(stationId: string): Promise<PackStation> {
    try {
      await this.checkPrerequisites();

      const station = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v2/pack-stations/${stationId}`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to get pack station: ${response.statusText}`);
        }

        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: station.StationID,
        name: station.StationName,
        warehouseId: station.WHID,
        zone: station.Zone,
        location: station.Location,
        type: (station.Type as any) || 'manual',
        status: (station.Status as any) || 'active',
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * List pack stations
   * @param warehouseId Warehouse ID
   * @returns Array of pack stations
   */
  public async listPackStations(warehouseId: string): Promise<PackStation[]> {
    try {
      await this.checkPrerequisites();

      const stations = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/v2/pack-stations?WHID=${warehouseId}`,
          {
            method: 'GET',
            headers,
            timeout: this.config.timeout,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to list pack stations: ${response.statusText}`);
        }

        const data = (await response.json()) as { items?: any[] };
        return data.items || [];
      });

      this.handleApiResponse(true);

      return stations.map((s) => ({
        id: s.StationID,
        name: s.StationName,
        warehouseId,
        zone: s.Zone,
        location: s.Location,
        type: (s.Type as any) || 'manual',
        status: (s.Status as any) || 'active',
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Confirm shipment
   * @param orderId Order ID
   * @param carrier Carrier code
   * @param trackingNumber Tracking number
   * @param weight Weight
   * @returns Ship confirmation
   */
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
          OrderID: orderId,
          Carrier: carrier,
          TrackingNumber: trackingNumber,
          Weight: weight || 0,
          ShipDate: new Date().toISOString(),
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/ship-confirm`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to confirm shipment: ${response.statusText}`);
        }

        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('shipment.confirmed', { orderId, trackingNumber });

      return {
        id: result.ShipConfirmID,
        orderId,
        shipmentNumber: result.ShipmentNumber,
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

  // ============================================================================
  // LOCATION & ZONE MANAGEMENT
  // ============================================================================

  /**
   * Get location
   * @param warehouseId Warehouse ID
   * @param binLocation Bin location
   * @returns Location info
   */
  public async getLocation(
    warehouseId: string,
    binLocation: string
  ): Promise<{
    binLocation: string;
    zone: string;
    capacity?: number;
    currentQuantity?: number;
  }> {
    try {
      await this.checkPrerequisites();

      const location = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/v2/locations/${warehouseId}/${binLocation}`,
          {
            method: 'GET',
            headers,
            timeout: this.config.timeout,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to get location: ${response.statusText}`);
        }

        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        binLocation: location.BinLocation,
        zone: location.Zone,
        capacity: location.Capacity,
        currentQuantity: location.CurrentQuantity,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * List zones
   * @param warehouseId Warehouse ID
   * @returns Array of zones
   */
  public async listZones(warehouseId: string): Promise<string[]> {
    try {
      await this.checkPrerequisites();

      const zones = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/v2/zones?WHID=${warehouseId}`,
          {
            method: 'GET',
            headers,
            timeout: this.config.timeout,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to list zones: ${response.statusText}`);
        }

        const data = (await response.json()) as { items?: Array<{ Zone: string }> };
        return (data.items || []).map((z) => z.Zone);
      });

      this.handleApiResponse(true);

      return zones;
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Configure zone
   * @param warehouseId Warehouse ID
   * @param zone Zone ID
   * @param config Zone config
   * @returns Updated config
   */
  public async configureZone(
    warehouseId: string,
    zone: string,
    config: {
      pickMethod?: string;
      packStations?: number;
      capacity?: number;
    }
  ): Promise<Record<string, unknown>> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          WHID: warehouseId,
          Zone: zone,
          ...config,
          UpdatedDate: new Date().toISOString(),
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/zones/${zone}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to configure zone: ${response.statusText}`);
        }

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

  // ============================================================================
  // PURCHASE ORDERS
  // ============================================================================

  /**
   * Get purchase order
   * @param poId PO ID
   * @returns Purchase order
   */
  public async getPurchaseOrder(poId: string): Promise<PurchaseOrder> {
    try {
      await this.checkPrerequisites();

      const po = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v2/purchase-orders/${poId}`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to get PO: ${response.statusText}`);
        }

        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: po.POID,
        poNumber: po.PONumber,
        supplierId: po.SupplierID,
        warehouseId: po.WHID,
        createdDate: new Date(po.CreatedDate),
        expectedDeliveryDate: new Date(po.ExpectedDeliveryDate),
        status: (po.Status as any) || 'draft',
        items: po.Items || [],
        totalValue: po.TotalValue,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * List purchase orders
   * @param status Status filter
   * @returns Array of POs
   */
  public async listPurchaseOrders(status?: string): Promise<PurchaseOrder[]> {
    try {
      await this.checkPrerequisites();

      const pos = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams();
        if (status) params.append('Status', status);

        const response = await fetch(
          `${this.config.baseUrl}/api/v2/purchase-orders?${params}`,
          {
            method: 'GET',
            headers,
            timeout: this.config.timeout,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to list POs: ${response.statusText}`);
        }

        const data = (await response.json()) as { items?: any[] };
        return data.items || [];
      });

      this.handleApiResponse(true);

      return pos.map((p) => ({
        id: p.POID,
        poNumber: p.PONumber,
        supplierId: p.SupplierID,
        warehouseId: p.WHID,
        createdDate: new Date(p.CreatedDate),
        expectedDeliveryDate: new Date(p.ExpectedDeliveryDate),
        status: (p.Status as any) || 'draft',
        items: p.Items || [],
        totalValue: p.TotalValue,
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Create purchase order
   * @param po PO data
   * @returns Created PO
   */
  public async createPurchaseOrder(po: PurchaseOrder): Promise<PurchaseOrder> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          PONumber: po.poNumber,
          SupplierID: po.supplierId,
          WHID: po.warehouseId,
          CreatedDate: po.createdDate,
          ExpectedDeliveryDate: po.expectedDeliveryDate,
          Items: po.items,
          Status: 'draft',
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/purchase-orders`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to create PO: ${response.statusText}`);
        }

        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('po.created', { id: result.POID });

      return {
        id: result.POID,
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

  // ============================================================================
  // TRANSFER ORDERS
  // ============================================================================

  /**
   * Get transfer order
   * @param toId TO ID
   * @returns Transfer order
   */
  public async getTransferOrder(toId: string): Promise<TransferOrder> {
    try {
      await this.checkPrerequisites();

      const to = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v2/transfer-orders/${toId}`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to get transfer order: ${response.statusText}`);
        }

        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: to.TOID,
        toNumber: to.TONumber,
        fromWarehouseId: to.FromWHID,
        toWarehouseId: to.ToWHID,
        createdDate: new Date(to.CreatedDate),
        expectedDeliveryDate: new Date(to.ExpectedDeliveryDate),
        status: (to.Status as any) || 'pending',
        items: to.Items || [],
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * List transfer orders
   * @param status Status filter
   * @returns Array of TOs
   */
  public async listTransferOrders(status?: string): Promise<TransferOrder[]> {
    try {
      await this.checkPrerequisites();

      const tos = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams();
        if (status) params.append('Status', status);

        const response = await fetch(
          `${this.config.baseUrl}/api/v2/transfer-orders?${params}`,
          {
            method: 'GET',
            headers,
            timeout: this.config.timeout,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to list transfer orders: ${response.statusText}`);
        }

        const data = (await response.json()) as { items?: any[] };
        return data.items || [];
      });

      this.handleApiResponse(true);

      return tos.map((t) => ({
        id: t.TOID,
        toNumber: t.TONumber,
        fromWarehouseId: t.FromWHID,
        toWarehouseId: t.ToWHID,
        createdDate: new Date(t.CreatedDate),
        expectedDeliveryDate: new Date(t.ExpectedDeliveryDate),
        status: (t.Status as any) || 'pending',
        items: t.Items || [],
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  /**
   * Create transfer order
   * @param to TO data
   * @returns Created TO
   */
  public async createTransferOrder(to: TransferOrder): Promise<TransferOrder> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          TONumber: to.toNumber,
          FromWHID: to.fromWarehouseId,
          ToWHID: to.toWarehouseId,
          CreatedDate: to.createdDate,
          ExpectedDeliveryDate: to.expectedDeliveryDate,
          Items: to.items,
          Status: 'pending',
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2/transfer-orders`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });

        if (!response.ok) {
          throw new Error(`Failed to create transfer order: ${response.statusText}`);
        }

        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('to.created', { id: result.TOID });

      return {
        id: result.TOID,
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

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Authenticate using OAuth2
   * @throws Error if authentication fails
   */
  private async authenticateOAuth2(): Promise<void> {
    try {
      const response = await fetch(this.config.tokenUrl || `${this.config.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.apiKey || '',
          client_secret: this.config.clientSecret || '',
        }).toString(),
        timeout: this.config.timeout,
      });

      if (!response.ok) {
        throw new Error(`OAuth2 authentication failed: ${response.statusText}`);
      }

      const data = (await response.json()) as ManhattanTokenResponse;
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

      this.logEvent('authentication.successful');
    } catch (error) {
      throw new Error(`Failed to authenticate: ${(error as Error).message}`);
    }
  }

  /**
   * Build request headers with auth token
   * @returns Headers object
   */
  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.accessToken}`,
      'X-Tenant-ID': this.config.tenantId || '',
      ...this.config.customHeaders,
    };
  }
}
