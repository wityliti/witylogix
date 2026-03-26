/**
 * Fishbowl Inventory Client
 * Token-based authentication for inventory, manufacturing, and order management.
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
 * Fishbowl Inventory adapter
 * Supports inventory, manufacturing, and order management
 */
export class FishbowlClient extends SupplyChainAdapter {
  private sessionToken: string | null = null;

  public async initialize(): Promise<void> {
    try {
      await this.checkPrerequisites();
      await this.authenticateToken();
      this.logEvent('fishbowl.initialized');
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw new Error(`Fishbowl initialization failed: ${(error as Error).message}`);
    }
  }

  public async verifyConnection(): Promise<boolean> {
    try {
      await this.checkPrerequisites();
      const response = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const result = await fetch(`${this.config.baseUrl}/api/v1/account`, {
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
        const response = await fetch(`${this.config.baseUrl}/api/v1/locations/${warehouseId}`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });
        if (!response.ok) throw new Error(`Failed to get warehouse: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: warehouse.id,
        name: warehouse.name,
        code: warehouse.abbr,
        address: {
          street: warehouse.address || '',
          city: warehouse.city || '',
          state: warehouse.state || '',
          postalCode: warehouse.zip || '',
          country: warehouse.country || 'US',
        },
        type: 'dc',
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
        const response = await fetch(`${this.config.baseUrl}/api/v1/locations`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });
        if (!response.ok) throw new Error(`Failed to list warehouses: ${response.statusText}`);
        const data = (await response.json()) as { locations?: any[] };
        return data.locations || [];
      });

      this.handleApiResponse(true);

      return warehouses.map((w) => ({
        id: w.id,
        name: w.name,
        code: w.abbr,
        address: {
          street: w.address || '',
          city: w.city || '',
          state: w.state || '',
          postalCode: w.zip || '',
          country: w.country || 'US',
        },
        type: 'dc',
        status: 'active',
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async createWarehouse(warehouse: WarehouseLocation): Promise<WarehouseLocation> {
    throw new Error('Fishbowl does not support warehouse creation via API');
  }

  public async updateWarehouse(
    warehouseId: string,
    updates: Partial<WarehouseLocation>
  ): Promise<WarehouseLocation> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = { name: updates.name };

        const response = await fetch(`${this.config.baseUrl}/api/v1/locations/${warehouseId}`, {
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

  // ============================================================================
  // INVENTORY MANAGEMENT
  // ============================================================================

  public async getInventory(warehouseId: string, sku: string): Promise<InventoryItem> {
    try {
      await this.checkPrerequisites();

      const inventory = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/v1/parts/${sku}/inventory?locationId=${warehouseId}`,
          { method: 'GET', headers, timeout: this.config.timeout }
        );
        if (!response.ok) throw new Error(`Failed to get inventory: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: inventory.id,
        sku: inventory.sku,
        warehouseId,
        zone: '',
        binLocation: '',
        quantityOnHand: inventory.qtyOnHand,
        quantityAllocated: inventory.qtyAllocated,
        quantityAvailable: inventory.qtyAvailable,
        productName: inventory.partName,
        uom: inventory.uom || 'Each',
        receivedDate: new Date(),
        status: 'available',
        unitCost: inventory.avgCost || 0,
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
        const params = new URLSearchParams({ locationId: warehouseId });
        if (filters?.sku) params.append('partNumber', filters.sku);

        const response = await fetch(`${this.config.baseUrl}/api/v1/inventory?${params}`, {
          method: 'GET',
          headers,
          timeout: this.config.timeout,
        });
        if (!response.ok) throw new Error(`Failed to list inventory: ${response.statusText}`);
        const data = (await response.json()) as { inventory?: any[] };
        return data.inventory || [];
      });

      this.handleApiResponse(true);

      return items.map((inv) => ({
        id: inv.id,
        sku: inv.sku,
        warehouseId,
        zone: '',
        binLocation: inv.binLocation || '',
        quantityOnHand: inv.qtyOnHand,
        quantityAllocated: inv.qtyAllocated,
        quantityAvailable: inv.qtyAvailable,
        productName: inv.partName,
        uom: inv.uom || 'Each',
        receivedDate: new Date(),
        status: 'available',
        unitCost: inv.avgCost || 0,
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
        const payload = {
          partNumber: sku,
          locationId: warehouseId,
          qtyAdjustment: quantity,
          notes: reason,
        };

        const response = await fetch(`${this.config.baseUrl}/api/v1/inventory-adjustments`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });
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
          partNumber: sku,
          locationId: warehouseId,
          fromBin,
          toBin,
          quantity,
        };

        const response = await fetch(`${this.config.baseUrl}/api/v1/inventory-moves`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: this.config.timeout,
        });
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

  // Placeholder stubs for remaining methods
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

  private async authenticateToken(): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.config.apiKey,
          password: this.config.clientSecret,
        }),
        timeout: this.config.timeout,
      });

      if (!response.ok) throw new Error('Token authentication failed');
      const data = (await response.json()) as { token?: string };
      this.sessionToken = data.token || '';
    } catch (error) {
      throw new Error(`Failed to authenticate: ${(error as Error).message}`);
    }
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.sessionToken}`,
      ...this.config.customHeaders,
    };
  }
}
