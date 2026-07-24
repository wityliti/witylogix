/**
 * Körber Supply Chain Platform Client
 * API key + OAuth2 auth for warehouse operations, voice-directed workflows, and robotics.
 * @packageDocumentation
 */

import { SupplyChainAdapter } from "./supply-chain-adapter";
import { RetryHandler } from "./supply-chain-adapter";
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
} from "./types";

/**
 * Körber Supply Chain Platform adapter
 * Supports warehouse operations, voice workflows, and robotics integration
 */
export class KorberClient extends SupplyChainAdapter {
  private accessToken: string | null = null;
  private tokenExpiresAt: number | null = null;

  public async initialize(): Promise<void> {
    try {
      await this.checkPrerequisites();
      await this.authenticateOAuth2();
      this.logEvent("korber.initialized");
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw new Error(
        `Körber initialization failed: ${(error as Error).message}`,
      );
    }
  }

  public async verifyConnection(): Promise<boolean> {
    try {
      await this.checkPrerequisites();
      const response = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const result = await fetch(`${this.config.baseUrl}/api/warehouses`, {
          method: "GET",
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
        const response = await fetch(
          `${this.config.baseUrl}/api/warehouses/${warehouseId}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to get warehouse: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: warehouse.warehouseId,
        name: warehouse.warehouseName,
        code: warehouse.warehouseCode,
        address: {
          street: warehouse.address?.street || "",
          city: warehouse.address?.city || "",
          state: warehouse.address?.state || "",
          postalCode: warehouse.address?.postalCode || "",
          country: warehouse.address?.country || "US",
        },
        type: (warehouse.type as any) || "dc",
        status: (warehouse.status as any) || "active",
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
        const response = await fetch(`${this.config.baseUrl}/api/warehouses`, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok)
          throw new Error(`Failed to list warehouses: ${response.statusText}`);
        const data = (await response.json()) as { data?: any[] };
        return data.data || [];
      });

      this.handleApiResponse(true);

      return warehouses.map((w) => ({
        id: w.warehouseId,
        name: w.warehouseName,
        code: w.warehouseCode,
        address: {
          street: w.address?.street || "",
          city: w.address?.city || "",
          state: w.address?.state || "",
          postalCode: w.address?.postalCode || "",
          country: w.address?.country || "US",
        },
        type: (w.type as any) || "dc",
        status: (w.status as any) || "active",
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async createWarehouse(
    warehouse: WarehouseLocation,
  ): Promise<WarehouseLocation> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          warehouseCode: warehouse.code,
          type: warehouse.type,
          address: warehouse.address,
          status: warehouse.status,
        };

        const response = await fetch(`${this.config.baseUrl}/api/warehouses`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok)
          throw new Error(`Failed to create warehouse: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent("warehouse.created", { id: warehouse.id });

      return {
        id: result.warehouseId,
        name: result.warehouseName,
        code: result.warehouseCode,
        address: warehouse.address,
        type: warehouse.type,
        status: (result.status as any) || warehouse.status,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async updateWarehouse(
    warehouseId: string,
    updates: Partial<WarehouseLocation>,
  ): Promise<WarehouseLocation> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          warehouseName: updates.name,
          status: updates.status,
        };

        const response = await fetch(
          `${this.config.baseUrl}/api/warehouses/${warehouseId}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to update warehouse: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent("warehouse.updated", { id: warehouseId });

      return this.getWarehouse(warehouseId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async getInventory(
    warehouseId: string,
    sku: string,
  ): Promise<InventoryItem> {
    try {
      await this.checkPrerequisites();

      const inventory = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/warehouses/${warehouseId}/inventory/${sku}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to get inventory: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: inventory.inventoryId,
        sku: inventory.sku,
        warehouseId,
        zone: inventory.zone || "",
        binLocation: inventory.binLocation || "",
        quantityOnHand: inventory.qoh,
        quantityAllocated: inventory.qal,
        quantityAvailable: inventory.qav,
        productName: sku,
        uom: inventory.uom || "EACH",
        receivedDate: new Date(inventory.receivedDate || Date.now()),
        status: (inventory.status as any) || "available",
        unitCost: inventory.cost || 0,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async listInventory(
    warehouseId: string,
    filters?: { zone?: string; status?: string; sku?: string },
  ): Promise<InventoryItem[]> {
    try {
      await this.checkPrerequisites();

      const items = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams();
        if (filters?.zone) params.append("zone", filters.zone);
        if (filters?.status) params.append("status", filters.status);
        if (filters?.sku) params.append("sku", filters.sku);

        const response = await fetch(
          `${this.config.baseUrl}/api/warehouses/${warehouseId}/inventory?${params}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to list inventory: ${response.statusText}`);
        const data = (await response.json()) as { data?: any[] };
        return data.data || [];
      });

      this.handleApiResponse(true);

      return items.map((inv) => ({
        id: inv.inventoryId,
        sku: inv.sku,
        warehouseId,
        zone: inv.zone || "",
        binLocation: inv.binLocation || "",
        quantityOnHand: inv.qoh,
        quantityAllocated: inv.qal,
        quantityAvailable: inv.qav,
        productName: inv.sku,
        uom: inv.uom || "EACH",
        receivedDate: new Date(inv.receivedDate || Date.now()),
        status: (inv.status as any) || "available",
        unitCost: inv.cost || 0,
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async syncInventoryRealTime(
    warehouseId: string,
  ): Promise<InventoryItem[]> {
    return this.listInventory(warehouseId);
  }

  public async syncInventoryBatch(
    warehouseId: string,
    skus: string[],
  ): Promise<InventoryItem[]> {
    const results: InventoryItem[] = [];
    for (const sku of skus) {
      try {
        const item = await this.getInventory(warehouseId, sku);
        results.push(item);
      } catch (error) {
        this.logEvent("inventory.sync.error", {
          sku,
          error: (error as Error).message,
        });
      }
    }
    return results;
  }

  public async adjustInventory(
    warehouseId: string,
    sku: string,
    quantity: number,
    reason: string,
  ): Promise<InventoryItem> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          sku,
          quantity,
          reason,
          adjustmentDate: new Date().toISOString(),
        };

        const response = await fetch(
          `${this.config.baseUrl}/api/warehouses/${warehouseId}/inventory-adjustments`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to adjust inventory: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent("inventory.adjusted", { sku, quantity, reason });

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
    quantity: number,
  ): Promise<InventoryItem[]> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          sku,
          fromBin,
          toBin,
          quantity,
          moveDate: new Date().toISOString(),
        };

        const response = await fetch(
          `${this.config.baseUrl}/api/warehouses/${warehouseId}/inventory-moves`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to move inventory: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent("inventory.moved", { sku, fromBin, toBin, quantity });

      return [await this.getInventory(warehouseId, sku)];
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async getInboundShipment(
    shipmentId: string,
  ): Promise<InboundShipment> {
    try {
      await this.checkPrerequisites();

      const shipment = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/inbound-shipments/${shipmentId}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(
            `Failed to get inbound shipment: ${response.statusText}`,
          );
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: shipment.shipmentId,
        trackingNumber: shipment.trackingNumber || "",
        warehouseId: shipment.warehouseId,
        status: (shipment.status as any) || "in_transit",
        items: shipment.items || [],
        expectedDeliveryDate: new Date(shipment.expectedDeliveryDate),
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async listInboundShipments(
    warehouseId: string,
    status?: string,
  ): Promise<InboundShipment[]> {
    try {
      await this.checkPrerequisites();

      const shipments = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams({ warehouseId });
        if (status) params.append("status", status);

        const response = await fetch(
          `${this.config.baseUrl}/api/inbound-shipments?${params}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(
            `Failed to list inbound shipments: ${response.statusText}`,
          );
        const data = (await response.json()) as { data?: any[] };
        return data.data || [];
      });

      this.handleApiResponse(true);

      return shipments.map((s) => ({
        id: s.shipmentId,
        trackingNumber: s.trackingNumber || "",
        warehouseId,
        status: (s.status as any) || "in_transit",
        items: s.items || [],
        expectedDeliveryDate: new Date(s.expectedDeliveryDate),
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async createInboundShipment(
    shipment: InboundShipment,
  ): Promise<InboundShipment> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          trackingNumber: shipment.trackingNumber,
          warehouseId: shipment.warehouseId,
          expectedDeliveryDate: shipment.expectedDeliveryDate,
          items: shipment.items,
          status: "in_transit",
        };

        const response = await fetch(
          `${this.config.baseUrl}/api/inbound-shipments`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(
            `Failed to create inbound shipment: ${response.statusText}`,
          );
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent("inbound.created", { id: result.shipmentId });

      return {
        id: result.shipmentId,
        trackingNumber: result.trackingNumber,
        warehouseId: shipment.warehouseId,
        status: "in_transit",
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
    receivedItems: Array<{ sku: string; quantity: number; lotNumber?: string }>,
  ): Promise<InboundShipment> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          shipmentId,
          receiveDate: new Date().toISOString(),
          items: receivedItems,
        };

        const response = await fetch(
          `${this.config.baseUrl}/api/inbound-shipments/${shipmentId}/receive`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to receive shipment: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent("inbound.received", { id: shipmentId });

      return this.getInboundShipment(shipmentId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async confirmQualityCheck(
    shipmentId: string,
    qcPassed: boolean,
    notes?: string,
  ): Promise<ReceiptConfirmation> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          shipmentId,
          qcPassed,
          qcNotes: notes || "",
          qcDate: new Date().toISOString(),
        };

        const response = await fetch(
          `${this.config.baseUrl}/api/inbound-shipments/${shipmentId}/quality-check`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to confirm QC: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent("qc.confirmed", { shipmentId, qcPassed });

      return {
        id: result.receiptId,
        shipmentId,
        warehouseId: this.config.warehouseId || "",
        receiptDate: new Date(),
        receivedBy: "system",
        status: qcPassed ? "qc_passed" : "qc_failed",
        items: result.items || [],
        qcStatus: qcPassed ? "pass" : "fail",
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
        const response = await fetch(
          `${this.config.baseUrl}/api/orders/${orderId}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to get order: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: order.orderId,
        orderNumber: order.orderNumber,
        type: "sales",
        sourceWarehouseId: order.warehouseId,
        orderDate: new Date(order.orderDate),
        status: (order.status as any) || "pending",
        priority: "standard",
        items: order.items || [],
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async listOutboundOrders(
    warehouseId: string,
    status?: string,
  ): Promise<OutboundOrder[]> {
    try {
      await this.checkPrerequisites();

      const orders = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams({ warehouseId });
        if (status) params.append("status", status);

        const response = await fetch(
          `${this.config.baseUrl}/api/orders?${params}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to list orders: ${response.statusText}`);
        const data = (await response.json()) as { data?: any[] };
        return data.data || [];
      });

      this.handleApiResponse(true);

      return orders.map((o) => ({
        id: o.orderId,
        orderNumber: o.orderNumber,
        type: "sales",
        sourceWarehouseId: warehouseId,
        orderDate: new Date(o.orderDate),
        status: (o.status as any) || "pending",
        priority: "standard",
        items: o.items || [],
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async createOutboundOrder(
    order: OutboundOrder,
  ): Promise<OutboundOrder> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          orderNumber: order.orderNumber,
          warehouseId: order.sourceWarehouseId,
          orderDate: order.orderDate,
          items: order.items,
          status: "pending",
        };

        const response = await fetch(`${this.config.baseUrl}/api/orders`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok)
          throw new Error(`Failed to create order: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent("order.created", { id: result.orderId });

      return {
        id: result.orderId,
        orderNumber: order.orderNumber,
        type: order.type,
        sourceWarehouseId: order.sourceWarehouseId,
        orderDate: order.orderDate,
        status: "pending",
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
    updates: Partial<OutboundOrder>,
  ): Promise<OutboundOrder> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = { status: updates.status, priority: updates.priority };

        const response = await fetch(
          `${this.config.baseUrl}/api/orders/${orderId}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to update order: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent("order.updated", { id: orderId });

      return this.getOutboundOrder(orderId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async cancelOutboundOrder(
    orderId: string,
    reason: string,
  ): Promise<OutboundOrder> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = { reason };

        const response = await fetch(
          `${this.config.baseUrl}/api/orders/${orderId}/cancel`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to cancel order: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent("order.cancelled", { id: orderId, reason });

      return this.getOutboundOrder(orderId);
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async getFulfillmentRequest(
    fulfillmentId: string,
  ): Promise<FulfillmentRequest> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const response = await fetch(
          `${this.config.baseUrl}/api/fulfillment-requests/${fulfillmentId}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(
            `Failed to get fulfillment request: ${response.statusText}`,
          );
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: result.fulfillmentId,
        orderId: result.orderId,
        warehouseId: result.warehouseId,
        createdAt: new Date(result.createdDate),
        status: (result.status as any) || "pending",
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
    allocationMethod?: "fifo" | "closest" | "random",
  ): Promise<FulfillmentRequest> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          orderId,
          warehouseId,
          allocationMethod: allocationMethod || "fifo",
          allocatedDate: new Date().toISOString(),
        };

        const response = await fetch(`${this.config.baseUrl}/api/allocate`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok)
          throw new Error(`Failed to allocate order: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent("order.allocated", { orderId, warehouseId });

      return {
        id: result.fulfillmentId,
        orderId,
        warehouseId,
        createdAt: new Date(),
        status: "allocated",
        allocations: result.allocations || [],
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async releaseFulfillment(
    fulfillmentId: string,
  ): Promise<FulfillmentRequest> {
    return this.updateFulfillmentStatus(fulfillmentId, "in_progress");
  }

  public async updateFulfillmentStatus(
    fulfillmentId: string,
    status: string,
  ): Promise<FulfillmentRequest> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = { status };

        const response = await fetch(
          `${this.config.baseUrl}/api/fulfillment-requests/${fulfillmentId}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(
            `Failed to update fulfillment: ${response.statusText}`,
          );
      });

      this.handleApiResponse(true);
      this.logEvent("fulfillment.updated", { id: fulfillmentId, status });

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
        const response = await fetch(
          `${this.config.baseUrl}/api/waves/${waveId}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to get wave: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: wave.waveId,
        waveNumber: wave.waveNumber,
        warehouseId: wave.warehouseId,
        createdAt: new Date(wave.createdDate),
        status: (wave.status as any) || "planned",
        fulfillmentRequestIds: wave.fulfillmentIds || [],
        orderCount: wave.orderCount,
        unitCount: wave.unitCount,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async listWaves(
    warehouseId: string,
    status?: string,
  ): Promise<WaveDefinition[]> {
    try {
      await this.checkPrerequisites();

      const waves = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const params = new URLSearchParams({ warehouseId });
        if (status) params.append("status", status);

        const response = await fetch(
          `${this.config.baseUrl}/api/waves?${params}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to list waves: ${response.statusText}`);
        const data = (await response.json()) as { data?: any[] };
        return data.data || [];
      });

      this.handleApiResponse(true);

      return waves.map((w) => ({
        id: w.waveId,
        waveNumber: w.waveNumber,
        warehouseId,
        createdAt: new Date(w.createdDate),
        status: (w.status as any) || "planned",
        fulfillmentRequestIds: w.fulfillmentIds || [],
        orderCount: w.orderCount,
        unitCount: w.unitCount,
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async createWave(
    warehouseId: string,
    fulfillmentIds: string[],
    pickMethod?: "zone" | "batch" | "order",
  ): Promise<WaveDefinition> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          warehouseId,
          fulfillmentIds,
          pickMethod: pickMethod || "zone",
          createdDate: new Date().toISOString(),
        };

        const response = await fetch(`${this.config.baseUrl}/api/waves`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });
        if (!response.ok)
          throw new Error(`Failed to create wave: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent("wave.created", { id: result.waveId });

      return {
        id: result.waveId,
        waveNumber: result.waveNumber,
        warehouseId,
        createdAt: new Date(result.createdDate),
        status: "planned",
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
        const payload = { releasedDate: new Date().toISOString() };

        const response = await fetch(
          `${this.config.baseUrl}/api/waves/${waveId}/release`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to release wave: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent("wave.released", { id: waveId });

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
        const payload = { completedDate: new Date().toISOString() };

        const response = await fetch(
          `${this.config.baseUrl}/api/waves/${waveId}/complete`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to complete wave: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent("wave.completed", { id: waveId });

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
        const response = await fetch(
          `${this.config.baseUrl}/api/pick-tasks/${taskId}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to get pick task: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: task.taskId,
        waveId: task.waveId,
        fromBinLocation: task.fromBin,
        zone: task.zone || "",
        sku: task.sku,
        quantity: task.quantity,
        pickedQuantity: task.pickedQuantity || 0,
        toBinLocation: task.toBin || "",
        status: (task.status as any) || "pending",
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
        const response = await fetch(
          `${this.config.baseUrl}/api/pick-tasks?waveId=${waveId}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to list pick tasks: ${response.statusText}`);
        const data = (await response.json()) as { data?: any[] };
        return data.data || [];
      });

      this.handleApiResponse(true);

      return tasks.map((t) => ({
        id: t.taskId,
        waveId,
        fromBinLocation: t.fromBin,
        zone: t.zone || "",
        sku: t.sku,
        quantity: t.quantity,
        pickedQuantity: t.pickedQuantity || 0,
        toBinLocation: t.toBin || "",
        status: (t.status as any) || "pending",
      }));
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async updatePickTask(
    taskId: string,
    pickedQuantity: number,
    status: string,
  ): Promise<PickTask> {
    try {
      await this.checkPrerequisites();

      await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          pickedQuantity,
          status,
          updatedDate: new Date().toISOString(),
        };

        const response = await fetch(
          `${this.config.baseUrl}/api/pick-tasks/${taskId}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to update pick task: ${response.statusText}`);
      });

      this.handleApiResponse(true);
      this.logEvent("pick_task.updated", {
        id: taskId,
        pickedQuantity,
        status,
      });

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
        const response = await fetch(
          `${this.config.baseUrl}/api/pack-stations/${stationId}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to get pack station: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: station.stationId,
        name: station.stationName,
        warehouseId: station.warehouseId,
        zone: station.zone,
        location: station.location,
        type: (station.type as any) || "manual",
        status: (station.status as any) || "active",
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
          `${this.config.baseUrl}/api/pack-stations?warehouseId=${warehouseId}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(
            `Failed to list pack stations: ${response.statusText}`,
          );
        const data = (await response.json()) as { data?: any[] };
        return data.data || [];
      });

      this.handleApiResponse(true);

      return stations.map((s) => ({
        id: s.stationId,
        name: s.stationName,
        warehouseId,
        zone: s.zone,
        location: s.location,
        type: (s.type as any) || "manual",
        status: (s.status as any) || "active",
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
    weight?: number,
  ): Promise<ShipConfirmation> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          orderId,
          carrier,
          trackingNumber,
          weight: weight || 0,
          shipDate: new Date().toISOString(),
        };

        const response = await fetch(
          `${this.config.baseUrl}/api/ship-confirm`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to confirm shipment: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent("shipment.confirmed", { orderId, trackingNumber });

      return {
        id: result.shipConfirmId,
        orderId,
        shipmentNumber: result.shipmentNumber,
        warehouseId: this.config.warehouseId || "",
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
    binLocation: string,
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
          `${this.config.baseUrl}/api/warehouses/${warehouseId}/locations/${binLocation}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to get location: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        binLocation: location.binLocation,
        zone: location.zone,
        capacity: location.capacity,
        currentQuantity: location.currentQuantity,
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
          `${this.config.baseUrl}/api/warehouses/${warehouseId}/zones`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to list zones: ${response.statusText}`);
        const data = (await response.json()) as {
          data?: Array<{ zone: string }>;
        };
        return (data.data || []).map((z) => z.zone);
      });

      this.handleApiResponse(true);

      return zones;
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  public async configureZone(
    warehouseId: string,
    zone: string,
    config: { pickMethod?: string; packStations?: number; capacity?: number },
  ): Promise<Record<string, unknown>> {
    try {
      await this.checkPrerequisites();

      const result = await RetryHandler.execute(async () => {
        const headers = this.buildHeaders();
        const payload = {
          warehouseId,
          zone,
          ...config,
          updatedDate: new Date().toISOString(),
        };

        const response = await fetch(
          `${this.config.baseUrl}/api/zones/${zone}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to configure zone: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent("zone.configured", { zone });

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
        const response = await fetch(
          `${this.config.baseUrl}/api/purchase-orders/${poId}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to get PO: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: po.poId,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        warehouseId: po.warehouseId,
        createdDate: new Date(po.createdDate),
        expectedDeliveryDate: new Date(po.expectedDeliveryDate),
        status: (po.status as any) || "draft",
        items: po.items || [],
        totalValue: po.totalValue,
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
        if (status) params.append("status", status);

        const response = await fetch(
          `${this.config.baseUrl}/api/purchase-orders?${params}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to list POs: ${response.statusText}`);
        const data = (await response.json()) as { data?: any[] };
        return data.data || [];
      });

      this.handleApiResponse(true);

      return pos.map((p) => ({
        id: p.poId,
        poNumber: p.poNumber,
        supplierId: p.supplierId,
        warehouseId: p.warehouseId,
        createdDate: new Date(p.createdDate),
        expectedDeliveryDate: new Date(p.expectedDeliveryDate),
        status: (p.status as any) || "draft",
        items: p.items || [],
        totalValue: p.totalValue,
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
          poNumber: po.poNumber,
          supplierId: po.supplierId,
          warehouseId: po.warehouseId,
          createdDate: po.createdDate,
          expectedDeliveryDate: po.expectedDeliveryDate,
          items: po.items,
          status: "draft",
        };

        const response = await fetch(
          `${this.config.baseUrl}/api/purchase-orders`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(`Failed to create PO: ${response.statusText}`);
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent("po.created", { id: result.poId });

      return {
        id: result.poId,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        warehouseId: po.warehouseId,
        createdDate: po.createdDate,
        expectedDeliveryDate: po.expectedDeliveryDate,
        status: "draft",
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
        const response = await fetch(
          `${this.config.baseUrl}/api/transfer-orders/${toId}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(
            `Failed to get transfer order: ${response.statusText}`,
          );
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);

      return {
        id: to.toId,
        toNumber: to.toNumber,
        fromWarehouseId: to.fromWarehouseId,
        toWarehouseId: to.toWarehouseId,
        createdDate: new Date(to.createdDate),
        expectedDeliveryDate: new Date(to.expectedDeliveryDate),
        status: (to.status as any) || "pending",
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
        if (status) params.append("status", status);

        const response = await fetch(
          `${this.config.baseUrl}/api/transfer-orders?${params}`,
          {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(
            `Failed to list transfer orders: ${response.statusText}`,
          );
        const data = (await response.json()) as { data?: any[] };
        return data.data || [];
      });

      this.handleApiResponse(true);

      return tos.map((t) => ({
        id: t.toId,
        toNumber: t.toNumber,
        fromWarehouseId: t.fromWarehouseId,
        toWarehouseId: t.toWarehouseId,
        createdDate: new Date(t.createdDate),
        expectedDeliveryDate: new Date(t.expectedDeliveryDate),
        status: (t.status as any) || "pending",
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
          toNumber: to.toNumber,
          fromWarehouseId: to.fromWarehouseId,
          toWarehouseId: to.toWarehouseId,
          createdDate: to.createdDate,
          expectedDeliveryDate: to.expectedDeliveryDate,
          items: to.items,
          status: "pending",
        };

        const response = await fetch(
          `${this.config.baseUrl}/api/transfer-orders`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.timeout ?? 30000),
          },
        );
        if (!response.ok)
          throw new Error(
            `Failed to create transfer order: ${response.statusText}`,
          );
        return response.json() as Promise<any>;
      });

      this.handleApiResponse(true);
      this.logEvent("to.created", { id: result.toId });

      return {
        id: result.toId,
        toNumber: to.toNumber,
        fromWarehouseId: to.fromWarehouseId,
        toWarehouseId: to.toWarehouseId,
        createdDate: to.createdDate,
        expectedDeliveryDate: to.expectedDeliveryDate,
        status: "pending",
        items: to.items,
      };
    } catch (error) {
      this.handleApiResponse(false, error as Error);
      throw error;
    }
  }

  private async authenticateOAuth2(): Promise<void> {
    try {
      const response = await fetch(
        this.config.tokenUrl || `${this.config.baseUrl}/oauth/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: this.config.apiKey || "",
            client_secret: this.config.clientSecret || "",
          }).toString(),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        },
      );

      if (!response.ok) {
        throw new Error(`OAuth2 authentication failed: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
      };
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

      this.logEvent("authentication.successful");
    } catch (error) {
      throw new Error(`Failed to authenticate: ${(error as Error).message}`);
    }
  }

  private buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.accessToken}`,
      "X-API-Key": this.config.apiKey || "",
      ...this.config.customHeaders,
    };
  }
}
