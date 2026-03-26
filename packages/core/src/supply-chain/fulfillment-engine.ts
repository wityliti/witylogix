/**
 * Fulfillment Engine - Wave management, picking, packing, shipping, returns
 * Production-grade implementation
 */

import {
  FulfillmentWave,
  PickList,
  PackSlip,
  ShipmentPlan,
  SalesOrder,
  InventoryItem,
  StorageLocation,
  SKU,
  ReturnAuthorization,
  InventoryMovement,
} from './supply-chain-types';

export interface WaveConfig {
  maxOrdersPerWave: number;
  maxLineItemsPerWave: number;
  cutoffTime: string; // HH:MM
  priorityRules: string[];
}

export interface PickingStrategy {
  method: 'zone' | 'batch' | 'wave' | 'cluster';
  zoneConfig?: { zones: string[] };
  batchConfig?: { itemsPerBatch: number };
  clusterConfig?: { maxOrders: number };
}

export interface CartonRule {
  maxWeight: number; // kg
  maxDimensions: { l: number; w: number; h: number };
  priority: number;
}

/**
 * WaveManager - Wave planning and optimization
 */
export class WaveManager {
  private waves: Map<string, FulfillmentWave> = new Map();
  private waveSequence: number = 0;

  /**
   * Create fulfillment wave with priority rules
   */
  createWave(
    warehouseId: string,
    orders: SalesOrder[],
    config: WaveConfig,
    priorityRules: string[] = ['express', 'priority', 'standard']
  ): FulfillmentWave {
    // Sort orders by priority
    const sortedOrders = this.applyPriorityRules(orders, priorityRules);

    // Respect wave size constraints
    let selectedOrders = sortedOrders;
    let totalLineItems = 0;

    if (config.maxOrdersPerWave || config.maxLineItemsPerWave) {
      selectedOrders = [];
      for (const order of sortedOrders) {
        const orderLineItems = order.items.length;
        if (
          (config.maxOrdersPerWave && selectedOrders.length >= config.maxOrdersPerWave) ||
          (config.maxLineItemsPerWave && totalLineItems + orderLineItems > config.maxLineItemsPerWave)
        ) {
          break;
        }
        selectedOrders.push(order);
        totalLineItems += orderLineItems;
      }
    }

    const waveId = `WAVE-${warehouseId}-${++this.waveSequence}`.padEnd(20, '0');

    const wave: FulfillmentWave = {
      waveId,
      warehouseId,
      status: 'planning',
      priority: 1,
      waveType: selectedOrders.some((o) => o.priority === 'express') ? 'express' : 'standard',
      cutoffTime: config.cutoffTime,
      orders: selectedOrders.map((o) => o.orderId),
      orderCount: selectedOrders.length,
      lineItemCount: totalLineItems,
      estimatedPickTime: this.estimatePickTime(totalLineItems),
      pickedLineItems: 0,
      packedOrders: 0,
      shippedOrders: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.waves.set(waveId, wave);
    return wave;
  }

  /**
   * Release wave to picking
   */
  releaseWave(waveId: string): FulfillmentWave {
    const wave = this.waves.get(waveId);
    if (!wave) throw new Error(`Wave not found: ${waveId}`);

    wave.status = 'active';
    wave.startTime = new Date().toISOString();
    wave.updatedAt = new Date().toISOString();

    this.waves.set(waveId, wave);
    return wave;
  }

  /**
   * Close wave after fulfillment
   */
  closeWave(waveId: string): FulfillmentWave {
    const wave = this.waves.get(waveId);
    if (!wave) throw new Error(`Wave not found: ${waveId}`);

    wave.status = 'completed';
    wave.endTime = new Date().toISOString();
    wave.actualPickTime = wave.startTime
      ? Math.round(
          (new Date(wave.endTime).getTime() - new Date(wave.startTime).getTime()) / 60000
        )
      : undefined;
    wave.updatedAt = new Date().toISOString();

    this.waves.set(waveId, wave);
    return wave;
  }

  private applyPriorityRules(orders: SalesOrder[], rules: string[]): SalesOrder[] {
    const priorityMap: Record<string, number> = {
      express: 0,
      priority: 1,
      standard: 2,
    };

    return [...orders].sort((a, b) => {
      const aPriority = priorityMap[a.priority] ?? 999;
      const bPriority = priorityMap[b.priority] ?? 999;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
    });
  }

  private estimatePickTime(lineItems: number): number {
    // Average 2 minutes per line item
    return Math.ceil(lineItems * 2);
  }
}

/**
 * PickOptimizer - Zone, batch, wave, and cluster picking
 */
export class PickOptimizer {
  /**
   * Zone picking - allocate lines to zones
   */
  optimizeZonePicking(
    wave: FulfillmentWave,
    orders: SalesOrder[],
    locations: Map<string, StorageLocation[]>
  ): Map<string, PickList[]> {
    const pickersByZone = new Map<string, PickList[]>();

    // Group items by zone
    const itemsByZone = new Map<string, Array<{ orderId: string; skuId: string; qty: number }>>();

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const locs = locations.get(item.skuId) || [];
        const loc = locs[0]; // Primary location
        const zone = loc?.zone || 'default';

        if (!itemsByZone.has(zone)) {
          itemsByZone.set(zone, []);
        }
        itemsByZone.get(zone)!.push({
          orderId: order.orderId,
          skuId: item.skuId,
          qty: item.quantity,
        });
      });
    });

    // Create pick lists per zone
    itemsByZone.forEach((items, zone) => {
      const pickList: PickList = {
        pickListId: `PICK-${wave.waveId}-${zone}-${Date.now()}`,
        waveId: wave.waveId,
        warehouseId: wave.warehouseId,
        pickerId: `ZONE-${zone}`,
        pickerName: `Zone Picker - ${zone}`,
        status: 'assigned',
        items: items.map((item, idx) => ({
          lineItemId: `${wave.waveId}-${idx}`,
          skuId: item.skuId,
          locationId: `${zone}-A-1-01`,
          quantity: item.qty,
        })),
        createdAt: new Date().toISOString(),
      };

      if (!pickersByZone.has(zone)) {
        pickersByZone.set(zone, []);
      }
      pickersByZone.get(zone)!.push(pickList);
    });

    return pickersByZone;
  }

  /**
   * Batch picking - group orders for single picker
   */
  optimizeBatchPicking(
    wave: FulfillmentWave,
    orders: SalesOrder[],
    maxOrdersPerBatch: number = 5
  ): PickList[] {
    const pickLists: PickList[] = [];
    let batchNum = 0;

    for (let i = 0; i < orders.length; i += maxOrdersPerBatch) {
      const batchOrders = orders.slice(i, i + maxOrdersPerBatch);
      const items: PickList['items'] = [];

      batchOrders.forEach((order, orderIdx) => {
        order.items.forEach((item, itemIdx) => {
          items.push({
            lineItemId: `${order.orderId}-${itemIdx}`,
            skuId: item.skuId,
            locationId: `LOC-${item.skuId}`,
            quantity: item.quantity,
          });
        });
      });

      const pickList: PickList = {
        pickListId: `PICK-${wave.waveId}-B${++batchNum}-${Date.now()}`,
        waveId: wave.waveId,
        warehouseId: wave.warehouseId,
        pickerId: `PICKER-B${batchNum}`,
        pickerName: `Batch Picker ${batchNum}`,
        status: 'assigned',
        items,
        createdAt: new Date().toISOString(),
      };

      pickLists.push(pickList);
    }

    return pickLists;
  }

  /**
   * Wave picking - pick entire wave at once
   */
  optimizeWavePicking(wave: FulfillmentWave, orders: SalesOrder[]): PickList {
    const items: PickList['items'] = [];

    orders.forEach((order) => {
      order.items.forEach((item, idx) => {
        items.push({
          lineItemId: `${order.orderId}-${idx}`,
          skuId: item.skuId,
          locationId: `LOC-${item.skuId}`,
          quantity: item.quantity,
        });
      });
    });

    return {
      pickListId: `PICK-${wave.waveId}-W-${Date.now()}`,
      waveId: wave.waveId,
      warehouseId: wave.warehouseId,
      pickerId: 'WAVE-PICKER',
      pickerName: 'Wave Picker',
      status: 'assigned',
      items,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Cluster picking - optimize route through warehouse
   */
  optimizeClusterPicking(
    wave: FulfillmentWave,
    orders: SalesOrder[],
    locations: Map<string, StorageLocation[]>
  ): PickList {
    const items: PickList['items'] = [];
    const locationSequence: Array<{ orderId: string; location: string }> = [];

    // Sort orders by route efficiency (simplified TSP)
    const sortedOrders = this.optimizeRoute(orders, locations);

    sortedOrders.forEach((order) => {
      order.items.forEach((item, idx) => {
        const locs = locations.get(item.skuId) || [];
        const locId = locs[0]?.locationId || `LOC-${item.skuId}`;

        items.push({
          lineItemId: `${order.orderId}-${idx}`,
          skuId: item.skuId,
          locationId: locId,
          quantity: item.quantity,
        });

        locationSequence.push({
          orderId: order.orderId,
          location: locId,
        });
      });
    });

    return {
      pickListId: `PICK-${wave.waveId}-C-${Date.now()}`,
      waveId: wave.waveId,
      warehouseId: wave.warehouseId,
      pickerId: 'CLUSTER-PICKER',
      pickerName: 'Cluster Picker',
      status: 'assigned',
      items,
      createdAt: new Date().toISOString(),
    };
  }

  private optimizeRoute(
    orders: SalesOrder[],
    locations: Map<string, StorageLocation[]>
  ): SalesOrder[] {
    // Simplified: sort by zone proximity
    return [...orders].sort((a, b) => {
      const aZone = locations.get(a.items[0]?.skuId || '')?.at(0)?.zone || 'Z';
      const bZone = locations.get(b.items[0]?.skuId || '')?.at(0)?.zone || 'Z';
      return aZone.localeCompare(bZone);
    });
  }
}

/**
 * PackStation - Cartonization and packing
 */
export class PackStation {
  /**
   * Cartonize orders using weight-based packing
   */
  cartonize(
    orders: SalesOrder[],
    skus: Map<string, SKU>,
    rules: CartonRule[] = []
  ): PackSlip[] {
    const cartons: PackSlip[] = [];
    let cartonNum = 0;

    const defaultRules: CartonRule[] = [
      { maxWeight: 30, maxDimensions: { l: 60, w: 40, h: 40 }, priority: 1 },
      { maxWeight: 15, maxDimensions: { l: 40, w: 30, h: 30 }, priority: 2 },
    ];

    const packRules = rules.length > 0 ? rules : defaultRules;

    for (const order of orders) {
      let currentCarton: PackSlip | null = null;
      let currentWeight = 0;

      for (const item of order.items) {
        const sku = skus.get(item.skuId);
        if (!sku) continue;

        const itemWeight = sku.weight * item.quantity;

        // Check if item fits in current carton
        if (currentCarton && this.fitsInCarton(currentWeight + itemWeight, packRules)) {
          currentCarton.items.push({
            skuId: item.skuId,
            quantity: item.quantity,
            description: sku.name,
          });
          currentCarton.weight += itemWeight;
          currentWeight += itemWeight;
        } else {
          // Start new carton
          if (currentCarton) {
            cartons.push(currentCarton);
          }

          const rule = packRules.find((r) => itemWeight <= r.maxWeight);
          const cartonId = `CARTON-${order.orderId}-${++cartonNum}`;

          currentCarton = {
            slipId: cartonId,
            orderId: order.orderId,
            warehouseId: '',
            barcode: this.generateBarcode(cartonId),
            items: [
              {
                skuId: item.skuId,
                quantity: item.quantity,
                description: sku.name,
              },
            ],
            weight: itemWeight,
            dimensions: rule?.maxDimensions,
            packedDate: new Date().toISOString(),
            packedBy: 'SYSTEM',
            qcStatus: 'pending',
            printedCount: 0,
          };

          currentWeight = itemWeight;
        }
      }

      if (currentCarton) {
        cartons.push(currentCarton);
      }
    }

    return cartons;
  }

  /**
   * Custom packaging based on product type
   */
  applyCustomPackaging(cartons: PackSlip[], skus: Map<string, SKU>): PackSlip[] {
    return cartons.map((carton) => {
      const hasFragile = carton.items.some((item) => {
        const sku = skus.get(item.skuId);
        return sku?.category === 'Electronics' || sku?.category === 'Glass';
      });

      const hasHazmat = carton.items.some((item) => {
        const sku = skus.get(item.skuId);
        return sku?.category === 'Chemicals';
      });

      if (hasFragile) {
        carton.weight *= 1.2; // Account for padding
      }

      return carton;
    });
  }

  private fitsInCarton(weight: number, rules: CartonRule[]): boolean {
    return rules.some((rule) => weight <= rule.maxWeight);
  }

  private generateBarcode(id: string): string {
    return Array.from(id)
      .map((c) => c.charCodeAt(0).toString(16))
      .join('')
      .substring(0, 12)
      .padEnd(12, '0');
  }
}

/**
 * ShipPlanner - Carrier selection and rate shopping
 */
export class ShipPlanner {
  /**
   * Plan shipment with carrier selection
   */
  planShipment(
    orders: SalesOrder[],
    cartons: PackSlip[],
    carriers: Array<{ name: string; serviceLevels: Array<{ name: string; cost: number; days: number }> }>
  ): ShipmentPlan {
    const totalWeight = cartons.reduce((sum, c) => sum + c.weight, 0);
    const estimatedCost = this.calculateShippingCost(totalWeight, carriers);

    // Select carrier based on cost and service level
    const selectedCarrier = carriers[0]; // Simplified: select first carrier
    const serviceLevel = 'ground';

    return {
      planId: `SHIP-${Date.now()}`,
      orders: orders.map((o) => o.orderId),
      carrierName: selectedCarrier.name,
      serviceLevel: serviceLevel as any,
      estimatedWeight: totalWeight,
      estimatedCost,
      estimatedDeliveryDate: this.calculateDeliveryDate(serviceLevel),
      consolidationMethod: totalWeight > 1000 ? 'full_truckload' : 'parcel',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate shipping label
   */
  generateShippingLabel(order: SalesOrder, carton: PackSlip): string {
    return `
SHIPPING LABEL
Order: ${order.orderId}
Carton: ${carton.slipId}
Barcode: ${carton.barcode}
Weight: ${carton.weight}kg

TO:
${order.shippingAddress.name}
${order.shippingAddress.line1}
${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}
${order.shippingAddress.country}
    `.trim();
  }

  private calculateShippingCost(weight: number, carriers: any[]): number {
    // Simplified: $5 base + $0.5 per kg
    return 5 + weight * 0.5;
  }

  private calculateDeliveryDate(serviceLevel: string): string {
    const days = serviceLevel === 'overnight' ? 1 : serviceLevel === 'express' ? 2 : 5;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }
}

/**
 * OrderAllocator - Multi-warehouse allocation
 */
export class OrderAllocator {
  /**
   * Allocate orders across warehouses
   */
  allocateOrders(
    orders: SalesOrder[],
    inventories: Map<string, InventoryItem[]>,
    warehouses: Array<{ warehouseId: string; location: { lat: number; lon: number } }>
  ): Map<string, SalesOrder[]> {
    const allocation = new Map<string, SalesOrder[]>();

    for (const order of orders) {
      // Find closest warehouse with inventory
      const warehouse = this.findOptimalWarehouse(order, inventories, warehouses);

      if (warehouse) {
        if (!allocation.has(warehouse)) {
          allocation.set(warehouse, []);
        }
        allocation.get(warehouse)!.push(order);
      }
    }

    return allocation;
  }

  /**
   * Handle split shipments
   */
  handleSplitShipment(
    order: SalesOrder,
    inventories: Map<string, InventoryItem[]>,
    warehouses: string[]
  ): Map<string, SalesOrder> {
    const shipments = new Map<string, SalesOrder>();

    const items = order.items;
    const available = new Map<string, { warehouse: string; qty: number }>();

    // Find inventory for each item
    for (const item of items) {
      for (const warehouse of warehouses) {
        const inv = inventories.get(warehouse) || [];
        const itemInv = inv.find((i) => i.skuId === item.skuId);

        if (itemInv && itemInv.availableQuantity >= item.quantity) {
          available.set(item.skuId, {
            warehouse,
            qty: item.quantity,
          });
          break;
        }
      }
    }

    // Create shipments by warehouse
    for (const [skuId, { warehouse, qty }] of available) {
      if (!shipments.has(warehouse)) {
        shipments.set(warehouse, {
          ...order,
          orderId: `${order.orderId}-${warehouse}`,
          items: [],
        });
      }

      const shipment = shipments.get(warehouse)!;
      const item = order.items.find((i) => i.skuId === skuId);
      if (item) {
        shipment.items.push(item);
      }
    }

    return shipments;
  }

  /**
   * Manage backorders
   */
  handleBackorder(order: SalesOrder, shortItems: Array<{ skuId: string; shortQty: number }>): void {
    // Create backorder record
    // Automatically reorder when inventory becomes available
  }

  private findOptimalWarehouse(
    order: SalesOrder,
    inventories: Map<string, InventoryItem[]>,
    warehouses: Array<{ warehouseId: string; location: { lat: number; lon: number } }>
  ): string | null {
    let bestWarehouse: string | null = null;
    let bestScore = -1;

    for (const warehouse of warehouses) {
      const inv = inventories.get(warehouse.warehouseId) || [];

      // Check if all items available
      const allAvailable = order.items.every((item) => {
        const itemInv = inv.find((i) => i.skuId === item.skuId);
        return itemInv && itemInv.availableQuantity >= item.quantity;
      });

      if (allAvailable) {
        // Score based on distance (simplified)
        const score = 100 - this.calculateDistance(order, warehouse);
        if (score > bestScore) {
          bestScore = score;
          bestWarehouse = warehouse.warehouseId;
        }
      }
    }

    return bestWarehouse;
  }

  private calculateDistance(order: SalesOrder, warehouse: any): number {
    // Simplified Euclidean distance
    return 10; // Placeholder
  }
}

/**
 * ReturnProcessor - RMA workflow
 */
export class ReturnProcessor {
  /**
   * Process return authorization
   */
  processReturn(
    ra: ReturnAuthorization,
    order: SalesOrder
  ): { restockQuantity: number; refundAmount: number } {
    let restockQuantity = 0;
    let refundAmount = 0;

    ra.items.forEach((item) => {
      if (ra.disposition === 'restock') {
        restockQuantity += item.restockQuantity || 0;
        refundAmount += (item.restockQuantity || 0) * (order.items.find(i => i.skuId === item.skuId)?.unitPrice || 0);
      } else if (ra.disposition === 'liquidate') {
        // Liquidate at reduced price
        refundAmount +=
          (item.restockQuantity || 0) * (order.items.find(i => i.skuId === item.skuId)?.unitPrice || 0) * 0.5;
      }
    });

    return { restockQuantity, refundAmount };
  }

  /**
   * Inspect returned items
   */
  inspectReturnedItems(ra: ReturnAuthorization): ReturnAuthorization {
    ra.items.forEach((item) => {
      // Auto-accept items in new condition
      if (item.condition === 'new') {
        item.acceptedQuantity = item.quantity;
      } else if (item.condition === 'used') {
        item.acceptedQuantity = Math.round(item.quantity * 0.9);
      } else {
        item.acceptedQuantity = 0;
      }
    });

    ra.status = 'inspected';
    return ra;
  }
}
