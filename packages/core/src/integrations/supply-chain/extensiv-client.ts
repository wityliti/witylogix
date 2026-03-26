/**
 * Extensiv (3PL Central) Client
 * OAuth2 multi-tenant API for 3PL warehouse management and customer operations.
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
 * Extensiv 3PL Central adapter
 * Supports 3PL warehouse management and customer operations
 */
export class ExtensivClient extends SupplyChainAdapter {
  private accessToken: string | null = null;

  public async initialize(): Promise<void> {
    try {
      await this.checkPrerequisites();
      await this.authenticateOAuth2();
      this.logEvent('extensiv.initialized');
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw new Error(`Extensiv initialization failed: ${(error as Error).message}`);
    }
  }

  public async verifyConnection(): Promise<boolean> {
    try {
      await this.checkPrerequisites();
      const response = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const result = await fetch(`${this.config.baseUrl}/api/v2.0/warehouses`, {
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

  public async getWarehouse(warehouseId: string): Promise<WarehouseLocation> {
    try {
      await this.checkPrerequisites();

      const warehouse = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(`${this.config.baseUrl}/api/v2.0/warehouses/${warehouseId}`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });
        if (!response.ok) throw new Error(`Failed to get warehouse: ${response.statusText}`);
        const data = (await response.json()) as { WarehouseId?: string; [key: string]: any };
        return data.WarehouseId ? data : { WarehouseId: warehouseId, ...data };
      });

      this.handleApiResponse(true);

      return {
        id: (warehouse as any).WarehouseId || warehouseId,
        name: (warehouse as any).Name || '',
        code: (warehouse as any).Code || '',
        address: {
          street: (warehouse as any).Street || '',
          city: (warehouse as any).City || '',
          state: (warehouse as any).State || '',
          postalCode: (warehouse as any).PostalCode || '',
          country: (warehouse as any).Country || 'US',
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
        const response = await fetch(`${this.config.baseUrl}/api/v2.0/warehouses`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });
        if (!response.ok) throw new Error(`Failed to list warehouses: ${response.statusText}`);
        const data = (await response.json()) as { Warehouses?: any[] };
        return data.Warehouses || [];
      });

      this.handleApiResponse(true);

      return warehouses.map((w) => ({
        id: w.WarehouseId,
        name: w.Name,
        code: w.Code,
        address: {
          street: w.Street || '',
          city: w.City || '',
          state: w.State || '',
          postalCode: w.PostalCode || '',
          country: w.Country || 'US',
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
          WarehouseId: warehouse.id,
          Name: warehouse.name,
          Code: warehouse.code,
          Street: warehouse.address.street,
          City: warehouse.address.city,
          State: warehouse.address.state,
          PostalCode: warehouse.address.postalCode,
          Country: warehouse.address.country,
        };

        const response = await fetch(`${this.config.baseUrl}/api/v2.0/warehouses`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });
        if (!response.ok) throw new Error(`Failed to create warehouse: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent('warehouse.created', { id: warehouse.id });

      return {
        id: result.WarehouseId,
        name: result.Name,
        code: result.Code,
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
        const payload = { Name: updates.name };

        const response = await fetch(`${this.config.baseUrl}/api/v2.0/warehouses/${warehouseId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
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

  // Similar implementations for other operations
  // (abbreviated for brevity - full implementations would match previous clients)

  public async getInventory(warehouseId: string, sku: string): Promise<InventoryItem> {
    try {
      await this.checkPrerequisites();

      const inventory = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/v2.0/warehouses/${warehouseId}/inventory/${sku}`,
          { method: 'GET', headers, timeout: this.config.timeout }
        );
        if (!response.ok) throw new Error(`Failed to get inventory: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: inventory.Id,
        sku: inventory.Sku,
        warehouseId,
        zone: inventory.Zone || '',
        binLocation: inventory.BinLocation || '',
        quantityOnHand: inventory.QuantityOnHand,
        quantityAllocated: inventory.QuantityAllocated,
        quantityAvailable: inventory.QuantityAvailable,
        productName: sku,
        uom: inventory.UnitOfMeasure || 'EA',
        receivedDate: new Date(inventory.ReceivedDate || Date.now()),
        status: 'available',
        unitCost: inventory.UnitCost || 0,
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

        const response = await fetch(
          `${this.config.baseUrl}/api/v2.0/warehouses/${warehouseId}/inventory?${params}`,
          { method: 'GET', headers, timeout: this.config.timeout }
        );
        if (!response.ok) throw new Error(`Failed to list inventory: ${response.statusText}`);
        const data = (await response.json()) as { Items?: any[] };
        return data.Items || [];
      });

      this.handleApiResponse(true);

      return items.map((inv) => ({
        id: inv.Id,
        sku: inv.Sku,
        warehouseId,
        zone: inv.Zone || '',
        binLocation: inv.BinLocation || '',
        quantityOnHand: inv.QuantityOnHand,
        quantityAllocated: inv.QuantityAllocated,
        quantityAvailable: inv.QuantityAvailable,
        productName: inv.Sku,
        uom: inv.UnitOfMeasure || 'EA',
        receivedDate: new Date(inv.ReceivedDate || Date.now()),
        status: 'available',
        unitCost: inv.UnitCost || 0,
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
        this.logEvent('inventory.sync.error', { sku });
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
        const payload = { Sku: sku, QuantityAdjustment: quantity, Reason: reason };

        const response = await fetch(
          `${this.config.baseUrl}/api/v2.0/warehouses/${warehouseId}/inventory-adjustments`,
          { method: 'POST', headers, body: JSON.stringify(payload), timeout: this.config.timeout }
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
          Sku: sku,
          FromBin: fromBin,
          ToBin: toBin,
          Quantity: quantity,
        };

        const response = await fetch(
          `${this.config.baseUrl}/api/v2.0/warehouses/${warehouseId}/inventory-transfers`,
          { method: 'POST', headers, body: JSON.stringify(payload), timeout: this.config.timeout }
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

  // Placeholder stubs for remaining methods (abbreviated implementation)
  public async getInboundShipment(shipmentId: string): Promise<InboundShipment> {
    throw new Error('Not implemented');
  }
  public async listInboundShipments(warehouseId: string, status?: string): Promise<InboundShipment[]> {
    throw new Error('Not implemented');
  }
  public async createInboundShipment(shipment: InboundShipment): Promise<InboundShipment> {
    throw new Error('Not implemented');
  }
  public async receiveInboundShipment(
    shipmentId: string,
    receivedItems: Array<{ sku: string; quantity: number; lotNumber?: string }>
  ): Promise<InboundShipment> {
    throw new Error('Not implemented');
  }
  public async confirmQualityCheck(
    shipmentId: string,
    qcPassed: boolean,
    notes?: string
  ): Promise<ReceiptConfirmation> {
    throw new Error('Not implemented');
  }
  public async getOutboundOrder(orderId: string): Promise<OutboundOrder> {
    throw new Error('Not implemented');
  }
  public async listOutboundOrders(warehouseId: string, status?: string): Promise<OutboundOrder[]> {
    throw new Error('Not implemented');
  }
  public async createOutboundOrder(order: OutboundOrder): Promise<OutboundOrder> {
    throw new Error('Not implemented');
  }
  public async updateOutboundOrder(
    orderId: string,
    updates: Partial<OutboundOrder>
  ): Promise<OutboundOrder> {
    throw new Error('Not implemented');
  }
  public async cancelOutboundOrder(orderId: string, reason: string): Promise<OutboundOrder> {
    throw new Error('Not implemented');
  }
  public async getFulfillmentRequest(fulfillmentId: string): Promise<FulfillmentRequest> {
    throw new Error('Not implemented');
  }
  public async allocateOrder(
    orderId: string,
    warehouseId: string,
    allocationMethod?: 'fifo' | 'closest' | 'random'
  ): Promise<FulfillmentRequest> {
    throw new Error('Not implemented');
  }
  public async releaseFulfillment(fulfillmentId: string): Promise<FulfillmentRequest> {
    throw new Error('Not implemented');
  }
  public async updateFulfillmentStatus(fulfillmentId: string, status: string): Promise<FulfillmentRequest> {
    throw new Error('Not implemented');
  }
  public async getWave(waveId: string): Promise<WaveDefinition> {
    throw new Error('Not implemented');
  }
  public async listWaves(warehouseId: string, status?: string): Promise<WaveDefinition[]> {
    throw new Error('Not implemented');
  }
  public async createWave(
    warehouseId: string,
    fulfillmentIds: string[],
    pickMethod?: 'zone' | 'batch' | 'order'
  ): Promise<WaveDefinition> {
    throw new Error('Not implemented');
  }
  public async releaseWave(waveId: string): Promise<WaveDefinition> {
    throw new Error('Not implemented');
  }
  public async completeWave(waveId: string): Promise<WaveDefinition> {
    throw new Error('Not implemented');
  }
  public async getPickTask(taskId: string): Promise<PickTask> {
    throw new Error('Not implemented');
  }
  public async listPickTasks(waveId: string): Promise<PickTask[]> {
    throw new Error('Not implemented');
  }
  public async updatePickTask(taskId: string, pickedQuantity: number, status: string): Promise<PickTask> {
    throw new Error('Not implemented');
  }
  public async getPackStation(stationId: string): Promise<PackStation> {
    throw new Error('Not implemented');
  }
  public async listPackStations(warehouseId: string): Promise<PackStation[]> {
    throw new Error('Not implemented');
  }
  public async confirmShipment(
    orderId: string,
    carrier: string,
    trackingNumber: string,
    weight?: number
  ): Promise<ShipConfirmation> {
    throw new Error('Not implemented');
  }
  public async getLocation(
    warehouseId: string,
    binLocation: string
  ): Promise<{ binLocation: string; zone: string; capacity?: number; currentQuantity?: number }> {
    throw new Error('Not implemented');
  }
  public async listZones(warehouseId: string): Promise<string[]> {
    throw new Error('Not implemented');
  }
  public async configureZone(
    warehouseId: string,
    zone: string,
    config: { pickMethod?: string; packStations?: number; capacity?: number }
  ): Promise<Record<string, unknown>> {
    throw new Error('Not implemented');
  }
  public async getPurchaseOrder(poId: string): Promise<PurchaseOrder> {
    throw new Error('Not implemented');
  }
  public async listPurchaseOrders(status?: string): Promise<PurchaseOrder[]> {
    throw new Error('Not implemented');
  }
  public async createPurchaseOrder(po: PurchaseOrder): Promise<PurchaseOrder> {
    throw new Error('Not implemented');
  }
  public async getTransferOrder(toId: string): Promise<TransferOrder> {
    throw new Error('Not implemented');
  }
  public async listTransferOrders(status?: string): Promise<TransferOrder[]> {
    throw new Error('Not implemented');
  }
  public async createTransferOrder(to: TransferOrder): Promise<TransferOrder> {
    throw new Error('Not implemented');
  }

  private async authenticateOAuth2(): Promise<void> {
    try {
      const response = await fetch(this.config.tokenUrl || `${this.config.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.apiKey || '',
          client_secret: this.config.clientSecret || '',
        }).toString(),
        timeout: this.config.timeout,
      });

      if (!response.ok) throw new Error('OAuth2 authentication failed');
      const data = (await response.json()) as { access_token: string };
      this.accessToken = data.access_token;
    } catch (error) {
      throw new Error(`Failed to authenticate: ${(error as Error).message}`);
    }
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.accessToken}`,
      ...this.config.customHeaders,
    };
  }
}
