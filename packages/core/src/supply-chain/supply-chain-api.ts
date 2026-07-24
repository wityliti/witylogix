/**
 * Supply Chain Orchestration API
 * REST endpoints for inventory, fulfillment, forecasting, and logistics
 */

import type { Request, Response } from "express";
import {
  DemandPlanner,
  SafetyStockCalculator,
  ReorderPointEngine,
  InventoryOptimizer,
  ReplenishmentPlanner,
  type TimeSeriesData,
  type ForecastResult,
} from "./supply-chain-orchestrator-v2";
import {
  WaveManager,
  PickOptimizer,
  PackStation,
  ShipPlanner,
  OrderAllocator,
  ReturnProcessor,
  type WaveConfig,
  type PickingStrategy,
  type CartonRule,
} from "./fulfillment-engine";
import type {
  SKU,
  InventoryItem,
  PurchaseOrder,
  SalesOrder,
  FulfillmentWave,
  PickList,
  DemandForecast,
  SafetyStock,
  ReorderPoint,
  CycleCount,
  Warehouse,
  Carrier,
  Vendor,
  ReturnAuthorization,
  StorageLocation,
} from "./supply-chain-types";

export class SupplyChainAPI {
  private skus: Map<string, SKU> = new Map();
  private inventory: Map<string, InventoryItem> = new Map();
  private purchaseOrders: Map<string, PurchaseOrder> = new Map();
  private salesOrders: Map<string, SalesOrder> = new Map();
  private warehouses: Map<string, Warehouse> = new Map();
  private carriers: Map<string, Carrier> = new Map();
  private vendors: Map<string, Vendor> = new Map();
  private cycles: Map<string, CycleCount> = new Map();
  private returns: Map<string, ReturnAuthorization> = new Map();
  private forecasts: Map<string, DemandForecast> = new Map();
  private reorderPoints: Map<string, ReorderPoint> = new Map();

  private demandPlanner: DemandPlanner;
  private safetyStockCalc: SafetyStockCalculator;
  private reorderEngine: ReorderPointEngine;
  private inventoryOptimizer: InventoryOptimizer;
  private replenishmentPlanner: ReplenishmentPlanner;
  private waveManager: WaveManager;
  private pickOptimizer: PickOptimizer;
  private packStation: PackStation;
  private shipPlanner: ShipPlanner;
  private orderAllocator: OrderAllocator;
  private returnProcessor: ReturnProcessor;

  constructor() {
    this.demandPlanner = new DemandPlanner();
    this.safetyStockCalc = new SafetyStockCalculator();
    this.reorderEngine = new ReorderPointEngine();
    this.inventoryOptimizer = new InventoryOptimizer();
    this.replenishmentPlanner = new ReplenishmentPlanner();
    this.waveManager = new WaveManager();
    this.pickOptimizer = new PickOptimizer();
    this.packStation = new PackStation();
    this.shipPlanner = new ShipPlanner();
    this.orderAllocator = new OrderAllocator();
    this.returnProcessor = new ReturnProcessor();
  }

  /**
   * Inventory Management Endpoints
   */

  async createInventoryItem(req: Request, res: Response): Promise<void> {
    try {
      const item = req.body as InventoryItem;
      this.inventory.set(item.itemId, item);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  async getInventoryItem(req: Request, res: Response): Promise<void> {
    try {
      const { itemId } = req.params;
      const item = this.inventory.get(itemId);

      if (!item) {
        res.status(404).json({ error: "Item not found" });
        return;
      }

      res.json(item);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  async updateInventoryItem(req: Request, res: Response): Promise<void> {
    try {
      const { itemId } = req.params;
      const updated = { ...req.body, itemId } as InventoryItem;
      this.inventory.set(itemId, updated);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  async searchInventory(req: Request, res: Response): Promise<void> {
    try {
      const { warehouseId, skuId, _count = "20", _offset = "0" } = req.query;
      let results = Array.from(this.inventory.values());

      if (warehouseId) {
        results = results.filter((i) => i.warehouseId === warehouseId);
      }
      if (skuId) {
        results = results.filter((i) => i.skuId === skuId);
      }

      const count = parseInt(_count as string);
      const offset = parseInt(_offset as string);
      const paged = results.slice(offset, offset + count);

      res.json({
        items: paged,
        total: results.length,
        count: paged.length,
        offset,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * Purchase Order Endpoints
   */

  async createPurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const po = req.body as PurchaseOrder;
      this.purchaseOrders.set(po.poId, po);
      res.status(201).json(po);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  async getPurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const { poId } = req.params;
      const po = this.purchaseOrders.get(poId);

      if (!po) {
        res.status(404).json({ error: "PO not found" });
        return;
      }

      res.json(po);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  async updatePurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const { poId } = req.params;
      const updated = { ...req.body, poId } as PurchaseOrder;
      this.purchaseOrders.set(poId, updated);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  async receivePurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const { poId } = req.params;
      const { receivedItems } = req.body as {
        receivedItems: Array<{ skuId: string; quantity: number }>;
      };

      const po = this.purchaseOrders.get(poId);
      if (!po) {
        res.status(404).json({ error: "PO not found" });
        return;
      }

      po.status = "received";
      po.actualDeliveryDate = new Date().toISOString().split("T")[0];

      // Update inventory
      receivedItems.forEach((item) => {
        const inv = Array.from(this.inventory.values()).find(
          (i) => i.skuId === item.skuId,
        );
        if (inv) {
          inv.quantity += item.quantity;
          inv.availableQuantity += item.quantity;
          inv.lastMovementDate = new Date().toISOString();
        }
      });

      this.purchaseOrders.set(poId, po);
      res.json(po);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * Sales Order Endpoints
   */

  async createSalesOrder(req: Request, res: Response): Promise<void> {
    try {
      const order = req.body as SalesOrder;
      order.status = "pending";
      this.salesOrders.set(order.orderId, order);
      res.status(201).json(order);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  async getSalesOrder(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const order = this.salesOrders.get(orderId);

      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  async allocateOrder(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const order = this.salesOrders.get(orderId);

      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      const allocation = this.orderAllocator.allocateOrders(
        [order],
        this.inventory as any,
        Array.from(this.warehouses.values()),
      );

      res.json({
        orderId,
        allocation: Object.fromEntries(allocation),
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * Fulfillment Wave Endpoints
   */

  async createFulfillmentWave(req: Request, res: Response): Promise<void> {
    try {
      const { warehouseId, orderIds, config } = req.body as {
        warehouseId: string;
        orderIds: string[];
        config: WaveConfig;
      };

      const orders = orderIds
        .map((id) => this.salesOrders.get(id))
        .filter(Boolean) as SalesOrder[];
      const wave = this.waveManager.createWave(warehouseId, orders, config);

      res.status(201).json(wave);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  async releaseWave(req: Request, res: Response): Promise<void> {
    try {
      const { waveId } = req.params;
      const wave = this.waveManager.releaseWave(waveId);
      res.json(wave);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * Picking Endpoints
   */

  async generatePickLists(req: Request, res: Response): Promise<void> {
    try {
      const { waveId, strategy } = req.body as {
        waveId: string;
        strategy: PickingStrategy;
      };

      const orders = Array.from(this.salesOrders.values());

      let pickLists: PickList[] = [];

      if (strategy.method === "zone") {
        const zonePickLists = this.pickOptimizer.optimizeZonePicking(
          {} as any,
          orders,
          new Map(),
        );
        pickLists = Array.from(zonePickLists.values()).flat();
      } else if (strategy.method === "batch") {
        pickLists = this.pickOptimizer.optimizeBatchPicking({} as any, orders);
      } else if (strategy.method === "wave") {
        pickLists = [this.pickOptimizer.optimizeWavePicking({} as any, orders)];
      } else if (strategy.method === "cluster") {
        pickLists = [
          this.pickOptimizer.optimizeClusterPicking(
            {} as any,
            orders,
            new Map(),
          ),
        ];
      }

      res.json({
        waveId,
        strategy: strategy.method,
        pickLists,
        count: pickLists.length,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * Demand Forecast Endpoints
   */

  async forecastDemand(req: Request, res: Response): Promise<void> {
    try {
      const {
        skuId,
        historicalData,
        method = "exponential_smoothing",
        promotionFactor = 1.0,
      } = req.body as {
        skuId: string;
        historicalData: TimeSeriesData[];
        method: string;
        promotionFactor: number;
      };

      const result = this.demandPlanner.forecastDemand(
        historicalData,
        method as any,
        promotionFactor,
      );

      const forecast: DemandForecast = {
        forecastId: `FORECAST-${skuId}-${Date.now()}`,
        skuId,
        period: new Date().toISOString().substring(0, 7),
        baseDemand: historicalData[historicalData.length - 1]?.demand || 0,
        seasonalFactor: 1.0,
        promotionLift: promotionFactor,
        forecastedDemand: Math.round(
          result.forecast.reduce((a, b) => a + b) / result.forecast.length,
        ),
        confidenceInterval: { lower: result.lower[0], upper: result.upper[0] },
        method: method as any,
        mae: result.mae,
        rmse: result.rmse,
        mape: result.mape,
        createdAt: new Date().toISOString(),
        createdBy: "SYSTEM",
      };

      this.forecasts.set(forecast.forecastId, forecast);
      res.status(201).json(forecast);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * Reorder Point Endpoints
   */

  async calculateReorderPoint(req: Request, res: Response): Promise<void> {
    try {
      const {
        skuId,
        leadTimeDays,
        averageDailyDemand,
        safetyStock,
        minOrderQuantity,
      } = req.body;

      const reorderPoint = this.reorderEngine.calculateReorderPoint(
        leadTimeDays,
        averageDailyDemand,
        safetyStock,
        minOrderQuantity,
      );

      reorderPoint.skuId = skuId;
      this.reorderPoints.set(skuId, reorderPoint);

      res.status(201).json(reorderPoint);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  async getReorderAlerts(req: Request, res: Response): Promise<void> {
    try {
      const alerts: Array<{
        skuId: string;
        currentQuantity: number;
        reorderPoint: number;
        alert: boolean;
      }> = [];

      for (const [skuId, reorderPoint] of this.reorderPoints) {
        const inv = Array.from(this.inventory.values()).find(
          (i) => i.skuId === skuId,
        );

        if (inv && inv.availableQuantity <= reorderPoint.reorderPointQuantity) {
          alerts.push({
            skuId,
            currentQuantity: inv.availableQuantity,
            reorderPoint: reorderPoint.reorderPointQuantity,
            alert: true,
          });
        }
      }

      res.json({
        alerts,
        count: alerts.length,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * Cycle Count Endpoints
   */

  async createCycleCount(req: Request, res: Response): Promise<void> {
    try {
      const count = req.body as CycleCount;
      this.cycles.set(count.countId, count);
      res.status(201).json(count);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  async completeCycleCount(req: Request, res: Response): Promise<void> {
    try {
      const { countId } = req.params;
      const { countedQuantity } = req.body as { countedQuantity: number };

      const count = this.cycles.get(countId);
      if (!count) {
        res.status(404).json({ error: "Cycle count not found" });
        return;
      }

      count.countedQuantity = countedQuantity;
      count.variance = countedQuantity - count.expectedQuantity;
      count.variancePercentage =
        (count.variance / count.expectedQuantity) * 100;
      count.status = Math.abs(count.variance) < 5 ? "completed" : "discrepancy";
      count.countDate = new Date().toISOString();

      this.cycles.set(countId, count);
      res.json(count);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * Return Authorization Endpoints
   */

  async createReturnAuthorization(req: Request, res: Response): Promise<void> {
    try {
      const ra = req.body as ReturnAuthorization;
      ra.status = "authorized";
      this.returns.set(ra.raId, ra);
      res.status(201).json(ra);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  async processReturn(req: Request, res: Response): Promise<void> {
    try {
      const { raId } = req.params;
      const ra = this.returns.get(raId);

      if (!ra) {
        res.status(404).json({ error: "RMA not found" });
        return;
      }

      const order = this.salesOrders.get(ra.orderId);
      if (!order) {
        res.status(404).json({ error: "Original order not found" });
        return;
      }

      const result = this.returnProcessor.processReturn(ra, order);
      ra.status = "processed";

      this.returns.set(raId, ra);

      res.json({
        raId,
        ...result,
        status: ra.status,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * ABC/XYZ Analysis Endpoint
   */

  async analyzeInventoryABCXYZ(req: Request, res: Response): Promise<void> {
    try {
      const items = Array.from(this.inventory.values());

      const analysis = items.map((item) => {
        const sku = this.skus.get(item.skuId);
        const demands = [item.turnoverRate * 365]; // Simplified

        return this.inventoryOptimizer.calculateABCXYZ(
          item.skuId,
          (sku?.price || 0) * item.quantity,
          demands,
        );
      });

      res.json({
        analysis,
        count: analysis.length,
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * Register all API routes
   */
  registerRoutes(router: any): void {
    // Inventory routes
    router.post("/inventory", this.createInventoryItem.bind(this));
    router.get("/inventory/:itemId", this.getInventoryItem.bind(this));
    router.put("/inventory/:itemId", this.updateInventoryItem.bind(this));
    router.get("/inventory", this.searchInventory.bind(this));

    // Purchase order routes
    router.post("/purchase-orders", this.createPurchaseOrder.bind(this));
    router.get("/purchase-orders/:poId", this.getPurchaseOrder.bind(this));
    router.put("/purchase-orders/:poId", this.updatePurchaseOrder.bind(this));
    router.post(
      "/purchase-orders/:poId/receive",
      this.receivePurchaseOrder.bind(this),
    );

    // Sales order routes
    router.post("/sales-orders", this.createSalesOrder.bind(this));
    router.get("/sales-orders/:orderId", this.getSalesOrder.bind(this));
    router.post(
      "/sales-orders/:orderId/allocate",
      this.allocateOrder.bind(this),
    );

    // Wave routes
    router.post("/waves", this.createFulfillmentWave.bind(this));
    router.post("/waves/:waveId/release", this.releaseWave.bind(this));

    // Picking routes
    router.post("/picking/lists", this.generatePickLists.bind(this));

    // Demand forecast routes
    router.post("/forecasts/demand", this.forecastDemand.bind(this));

    // Reorder point routes
    router.post("/reorder-points", this.calculateReorderPoint.bind(this));
    router.get("/reorder-points/alerts", this.getReorderAlerts.bind(this));

    // Cycle count routes
    router.post("/cycle-counts", this.createCycleCount.bind(this));
    router.post(
      "/cycle-counts/:countId/complete",
      this.completeCycleCount.bind(this),
    );

    // Return routes
    router.post("/returns", this.createReturnAuthorization.bind(this));
    router.post("/returns/:raId/process", this.processReturn.bind(this));

    // Analysis routes
    router.get("/analysis/abc-xyz", this.analyzeInventoryABCXYZ.bind(this));
  }
}

export default SupplyChainAPI;
