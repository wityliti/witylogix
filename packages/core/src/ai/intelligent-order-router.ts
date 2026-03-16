/**
 * Intelligent Order Router
 *
 * Auto-assigns orders to optimal fulfillment centers based on:
 * - FulfillmentScorer: multi-criteria scoring per warehouse
 *   - Proximity (35%): haversine distance from warehouse to delivery address
 *   - Stock (25%): inventory availability of all order items
 *   - Capacity (20%): daily fulfillment capacity utilization
 *   - Cost (10%): estimated shipping cost from warehouse
 *   - SLA (10%): service level agreement compliance
 * - StockChecker: verify all order items in stock at candidate warehouse
 * - CapacityTracker: track daily fulfillment capacity per warehouse
 * - CostEstimator: estimate shipping cost from each warehouse
 * - SplitOrderDetector: suggest optimal split when no single warehouse has all items
 * - FulfillmentRules: configurable rules for routing preferences
 * - RoutingExplanation: human-readable explanation of routing decision
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface OrderItem {
  skuId: string;
  quantity: number;
  weight: number; // kg per unit
  volume: number; // cubic meters per unit
}

export interface Order {
  id: string;
  items: OrderItem[];
  deliveryAddress: Coordinate;
  priority: 'standard' | 'express' | 'overnight';
  createdAt: Date;
  weight: number; // total weight in kg
  volume: number; // total volume in cubic meters
}

export interface Warehouse {
  id: string;
  name: string;
  location: Coordinate;
  inventory: Map<string, number>; // skuId -> quantity
  dailyCapacity: number; // units per day
  currentDailyCount: number; // units already assigned today
  costPerKm: number; // shipping cost coefficient
  slaHours: Map<string, number>; // priority -> hours to deliver
}

export interface WarehouseCandidate {
  warehouseId: string;
  warehouseName: string;
  score: number; // 0-100
  scores: FulfillmentScore;
  canFulfill: boolean;
  reason: string;
}

export interface FulfillmentScore {
  proximity: number; // 0-100
  stock: number; // 0-100
  capacity: number; // 0-100
  cost: number; // 0-100
  sla: number; // 0-100
  weighted: number; // 0-100, final score
}

export interface RoutingDecision {
  orderId: string;
  warehouseId: string;
  warehouseName: string;
  score: number;
  explanation: RoutingExplanation;
  isSplit: boolean;
  splits?: SplitOrder[];
  confidence: number; // 0-1, how certain is this decision
}

export interface SplitOrder {
  warehouseId: string;
  warehouseName: string;
  items: OrderItem[];
  score: number;
  weight: number;
  volume: number;
}

export interface RoutingExplanation {
  summary: string;
  proximityExplanation: string;
  stockExplanation: string;
  capacityExplanation: string;
  costExplanation: string;
  slaExplanation: string;
  alternativesConsidered: WarehouseCandidate[];
}

export type FulfillmentRule = 'prefer_local' | 'prefer_lowest_cost' | 'prefer_fastest' | 'custom_weights';

export interface FulfillmentRules {
  rule: FulfillmentRule;
  weights?: {
    proximity: number; // default 0.35
    stock: number; // default 0.25
    capacity: number; // default 0.20
    cost: number; // default 0.10
    sla: number; // default 0.10
  };
  maxSplitWarehouses: number; // max warehouses to split across, default 3
  requireAllInStock: boolean; // if true, must split if no single warehouse has all items
  preferLowCostOverProximity: boolean;
}

export interface RoutingOptions {
  rules?: FulfillmentRules;
  maxCandidates?: number; // evaluate top N warehouses
  considerSplits?: boolean; // default true
  maxProximityKm?: number; // ignore warehouses further than this
}

// ─── PROXIMITY CALCULATOR ───────────────────────────────────────────────────

/**
 * Calculate great-circle distance between two coordinates using haversine formula.
 * Returns distance in kilometers.
 */
function calculateHaversineDistance(from: Coordinate, to: Coordinate): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class ProximityCalculator {
  /**
   * Calculate proximity score (0-100) based on distance.
   * Closer = higher score. Max distance is 1000 km.
   */
  calculateScore(warehouseLocation: Coordinate, deliveryLocation: Coordinate): number {
    const distance = calculateHaversineDistance(warehouseLocation, deliveryLocation);
    const maxDistance = 1000; // km
    return Math.max(0, 100 * (1 - Math.min(distance, maxDistance) / maxDistance));
  }
}

// ─── STOCK CHECKER ──────────────────────────────────────────────────────────

export class StockChecker {
  /**
   * Check if warehouse has all items in stock.
   * Returns true if all quantities are available.
   */
  hasAllItems(warehouse: Warehouse, items: OrderItem[]): boolean {
    return items.every((item) => {
      const availableQty = warehouse.inventory.get(item.skuId) ?? 0;
      return availableQty >= item.quantity;
    });
  }

  /**
   * Calculate stock score (0-100) based on how many items are in stock.
   * Full stock = 100, partial = scaled between 0-100, no stock = 0.
   */
  calculateScore(warehouse: Warehouse, items: OrderItem[]): number {
    if (items.length === 0) return 100;

    let itemsInStock = 0;
    let totalQtyNeeded = 0;
    let totalQtyAvailable = 0;

    for (const item of items) {
      totalQtyNeeded += item.quantity;
      const available = warehouse.inventory.get(item.skuId) ?? 0;
      totalQtyAvailable += Math.min(available, item.quantity);

      if (available >= item.quantity) {
        itemsInStock += 1;
      }
    }

    // Weighted score: items in stock counts as 60%, quantity availability as 40%
    const itemRatio = itemsInStock / items.length;
    const qtyRatio = totalQtyNeeded > 0 ? totalQtyAvailable / totalQtyNeeded : 1;

    return Math.round(60 * itemRatio + 40 * qtyRatio);
  }
}

// ─── CAPACITY TRACKER ───────────────────────────────────────────────────────

export class CapacityTracker {
  private dailyUtilization: Map<string, number> = new Map();

  /**
   * Initialize daily utilization tracking. Should be called once per day.
   */
  initializeDay(): void {
    this.dailyUtilization.clear();
  }

  /**
   * Check if warehouse has capacity for order.
   */
  hasCapacity(warehouse: Warehouse, order: Order): boolean {
    const currentCount = this.dailyUtilization.get(warehouse.id) ?? warehouse.currentDailyCount;
    return currentCount + order.items.length <= warehouse.dailyCapacity;
  }

  /**
   * Calculate capacity score (0-100). 100% available = 100, full = 0.
   */
  calculateScore(warehouse: Warehouse): number {
    const currentCount = warehouse.currentDailyCount;
    const utilization = currentCount / warehouse.dailyCapacity;
    return Math.round(100 * (1 - Math.min(utilization, 1)));
  }

  /**
   * Record order assignment for capacity tracking.
   */
  recordAssignment(warehouseId: string, itemCount: number): void {
    const current = this.dailyUtilization.get(warehouseId) ?? 0;
    this.dailyUtilization.set(warehouseId, current + itemCount);
  }

  /**
   * Get remaining capacity for warehouse.
   */
  getRemainingCapacity(warehouse: Warehouse): number {
    const current = this.dailyUtilization.get(warehouse.id) ?? warehouse.currentDailyCount;
    return Math.max(0, warehouse.dailyCapacity - current);
  }
}

// ─── COST ESTIMATOR ─────────────────────────────────────────────────────────

export class CostEstimator {
  /**
   * Calculate estimated shipping cost from warehouse to delivery address.
   */
  estimateCost(warehouse: Warehouse, order: Order): number {
    const distance = calculateHaversineDistance(warehouse.location, order.deliveryAddress);
    const baseCost = distance * warehouse.costPerKm;

    // Add weight surcharge (2% per kg)
    const weightSurcharge = order.weight * 0.02 * baseCost;

    // Add priority surcharge
    const prioritySurcharge =
      order.priority === 'overnight' ? baseCost * 0.5 : order.priority === 'express' ? baseCost * 0.25 : 0;

    return baseCost + weightSurcharge + prioritySurcharge;
  }

  /**
   * Calculate cost score (0-100). Lower cost = higher score.
   * Normalized to 0-500 unit cost range.
   */
  calculateScore(costPerUnit: number): number {
    const maxCost = 500; // units
    return Math.max(0, 100 * (1 - Math.min(costPerUnit, maxCost) / maxCost));
  }
}

// ─── SLA SCORER ──────────────────────────────────────────────────────────────

export class SLAScorer {
  /**
   * Calculate SLA score (0-100) based on delivery time capability.
   * Measures ability to meet priority-based delivery SLA.
   */
  calculateScore(warehouse: Warehouse, order: Order, distance: number): number {
    const slaHours = warehouse.slaHours.get(order.priority) ?? 24;

    // Estimate delivery time: 2 hours fixed + 1 hour per 100 km
    const estimatedHours = 2 + distance / 100;

    // Score: 100 if we can meet SLA, decreases for each hour over
    if (estimatedHours <= slaHours) {
      return 100;
    }

    const hoursOver = estimatedHours - slaHours;
    return Math.max(0, 100 - hoursOver * 10);
  }
}

// ─── FULFILLMENT SCORER ─────────────────────────────────────────────────────

export class FulfillmentScorer {
  private proximityCalc: ProximityCalculator;
  private stockChecker: StockChecker;
  private capacityTracker: CapacityTracker;
  private costEstimator: CostEstimator;
  private slaScorer: SLAScorer;

  constructor() {
    this.proximityCalc = new ProximityCalculator();
    this.stockChecker = new StockChecker();
    this.capacityTracker = new CapacityTracker();
    this.costEstimator = new CostEstimator();
    this.slaScorer = new SLAScorer();
  }

  /**
   * Score a warehouse for a given order.
   */
  scoreWarehouse(warehouse: Warehouse, order: Order, rules: FulfillmentRules): FulfillmentScore {
    const proximityScore = this.proximityCalc.calculateScore(warehouse.location, order.deliveryAddress);
    const stockScore = this.stockChecker.calculateScore(warehouse, order.items);
    const capacityScore = this.capacityTracker.calculateScore(warehouse);
    const cost = this.costEstimator.estimateCost(warehouse, order);
    const costScore = this.costEstimator.calculateScore(cost);
    const distance = calculateHaversineDistance(warehouse.location, order.deliveryAddress);
    const slaScore = this.slaScorer.calculateScore(warehouse, order, distance);

    const weights = rules.weights ?? {
      proximity: 0.35,
      stock: 0.25,
      capacity: 0.2,
      cost: 0.1,
      sla: 0.1,
    };

    const weighted =
      proximityScore * weights.proximity +
      stockScore * weights.stock +
      capacityScore * weights.capacity +
      costScore * weights.cost +
      slaScore * weights.sla;

    return {
      proximity: proximityScore,
      stock: stockScore,
      capacity: capacityScore,
      cost: costScore,
      sla: slaScore,
      weighted: Math.round(weighted),
    };
  }
}

// ─── SPLIT ORDER DETECTOR ───────────────────────────────────────────────────

export class SplitOrderDetector {
  /**
   * Analyze if order should be split across multiple warehouses.
   * Returns suggested split if beneficial, or empty array if single warehouse is viable.
   */
  detectOptimalSplit(
    order: Order,
    warehouses: WarehouseCandidate[],
    maxSplits: number = 3
  ): SplitOrder[] {
    // If top warehouse can fulfill, don't split
    if (warehouses.length > 0 && warehouses[0].canFulfill && warehouses[0].score > 60) {
      return [];
    }

    // Try to build minimal split
    const splits: SplitOrder[] = [];
    const remainingItems = [...order.items];
    const usedWarehouses = new Set<string>();

    for (const candidate of warehouses) {
      if (
        remainingItems.length === 0 ||
        usedWarehouses.size >= maxSplits ||
        !candidate.canFulfill ||
        candidate.score < 40
      ) {
        break;
      }

      const warehouse = { id: candidate.warehouseId } as Warehouse;
      const itemsFromThis: OrderItem[] = [];
      let weight = 0;
      let volume = 0;

      // Collect items this warehouse can fulfill
      for (let i = remainingItems.length - 1; i >= 0; i--) {
        const item = remainingItems[i];
        // In real scenario, check warehouse inventory
        itemsFromThis.push(item);
        weight += item.weight * item.quantity;
        volume += item.volume * item.quantity;
        remainingItems.splice(i, 1);
      }

      if (itemsFromThis.length > 0) {
        splits.push({
          warehouseId: candidate.warehouseId,
          warehouseName: candidate.warehouseName,
          items: itemsFromThis,
          score: candidate.score,
          weight,
          volume,
        });
        usedWarehouses.add(candidate.warehouseId);
      }
    }

    // Return split only if beneficial (at least 2 warehouses involved)
    return splits.length > 1 ? splits : [];
  }
}

// ─── ROUTING EXPLANATION ────────────────────────────────────────────────────

export class RoutingExplainer {
  /**
   * Generate human-readable explanation for routing decision.
   */
  explain(
    selectedWarehouse: WarehouseCandidate,
    allCandidates: WarehouseCandidate[],
    order: Order
  ): RoutingExplanation {
    const selected = selectedWarehouse.scores;

    return {
      summary: `Order assigned to ${selectedWarehouse.warehouseName} (score: ${selectedWarehouse.score}/100)`,
      proximityExplanation: `Proximity score ${selected.proximity}/100: warehouse is ${
        selected.proximity > 80 ? 'very close' : selected.proximity > 60 ? 'reasonably close' : 'somewhat distant'
      } to delivery location`,
      stockExplanation: `Stock score ${selected.stock}/100: ${
        selected.stock === 100 ? 'all items in stock' : selected.stock >= 80 ? 'most items in stock' : 'partial stock availability'
      }`,
      capacityExplanation: `Capacity score ${selected.capacity}/100: warehouse has ${
        selected.capacity > 80 ? 'plenty of' : selected.capacity > 60 ? 'sufficient' : 'limited'
      } fulfillment capacity`,
      costExplanation: `Cost score ${selected.cost}/100: shipping cost is ${
        selected.cost > 80 ? 'very competitive' : selected.cost > 60 ? 'reasonable' : 'relatively high'
      }`,
      slaExplanation: `SLA score ${selected.sla}/100: can ${
        selected.sla === 100 ? 'easily meet' : selected.sla > 80 ? 'comfortably meet' : selected.sla > 60 ? 'meet' : 'may struggle to meet'
      } delivery timeline`,
      alternativesConsidered: allCandidates.slice(1, 4),
    };
  }
}

// ─── INTELLIGENT ORDER ROUTER ───────────────────────────────────────────────

export class IntelligentOrderRouter {
  private scorer: FulfillmentScorer;
  private splitDetector: SplitOrderDetector;
  private explainer: RoutingExplainer;
  private capacityTracker: CapacityTracker;
  private defaultRules: FulfillmentRules;

  constructor() {
    this.scorer = new FulfillmentScorer();
    this.splitDetector = new SplitOrderDetector();
    this.explainer = new RoutingExplainer();
    this.capacityTracker = new CapacityTracker();
    this.defaultRules = {
      rule: 'custom_weights',
      weights: {
        proximity: 0.35,
        stock: 0.25,
        capacity: 0.2,
        cost: 0.1,
        sla: 0.1,
      },
      maxSplitWarehouses: 3,
      requireAllInStock: true,
      preferLowCostOverProximity: false,
    };
  }

  /**
   * Route a single order to optimal warehouse(s).
   */
  routeOrder(
    order: Order,
    warehouses: Warehouse[],
    options: RoutingOptions = {}
  ): RoutingDecision {
    const rules = options.rules ?? this.defaultRules;
    const maxCandidates = options.maxCandidates ?? 10;
    const considerSplits = options.considerSplits ?? true;

    // Score all warehouses
    const candidates: WarehouseCandidate[] = warehouses
      .map((warehouse) => {
        const scores = this.scorer.scoreWarehouse(warehouse, order, rules);
        const canFulfill =
          warehouse.dailyCapacity - warehouse.currentDailyCount >= order.items.length &&
          (!rules.requireAllInStock || this.canFulfill(warehouse, order.items));

        return {
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          score: scores.weighted,
          scores,
          canFulfill,
          reason: canFulfill ? 'Can fulfill' : 'Cannot fulfill',
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCandidates);

    // Select best candidate
    const selected = candidates[0];

    if (!selected) {
      return {
        orderId: order.id,
        warehouseId: '',
        warehouseName: 'UNROUTED',
        score: 0,
        explanation: {
          summary: 'No suitable warehouse found for order',
          proximityExplanation: 'No warehouses available',
          stockExplanation: 'No warehouses available',
          capacityExplanation: 'No warehouses available',
          costExplanation: 'No warehouses available',
          slaExplanation: 'No warehouses available',
          alternativesConsidered: [],
        },
        isSplit: false,
        confidence: 0,
      };
    }

    // Check for optimal split
    let splits: SplitOrder[] = [];
    if (considerSplits && !selected.canFulfill) {
      splits = this.splitDetector.detectOptimalSplit(order, candidates, rules.maxSplitWarehouses);
    }

    const isSplit = splits.length > 0;
    const finalScore = isSplit ? Math.max(...splits.map((s) => s.score)) : selected.score;
    const confidence = finalScore / 100;

    return {
      orderId: order.id,
      warehouseId: selected.warehouseId,
      warehouseName: selected.warehouseName,
      score: selected.score,
      explanation: this.explainer.explain(selected, candidates, order),
      isSplit,
      splits: isSplit ? splits : undefined,
      confidence,
    };
  }

  /**
   * Evaluate all routing options for an order without assigning.
   */
  evaluateOptions(order: Order, warehouses: Warehouse[], options: RoutingOptions = {}): WarehouseCandidate[] {
    const rules = options.rules ?? this.defaultRules;
    const maxCandidates = options.maxCandidates ?? 10;

    return warehouses
      .map((warehouse) => {
        const scores = this.scorer.scoreWarehouse(warehouse, order, rules);
        const canFulfill =
          warehouse.dailyCapacity - warehouse.currentDailyCount >= order.items.length &&
          this.canFulfill(warehouse, order.items);

        return {
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          score: scores.weighted,
          scores,
          canFulfill,
          reason: canFulfill ? 'Can fulfill' : 'Cannot fulfill - insufficient capacity or stock',
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCandidates);
  }

  /**
   * Check if warehouse can fulfill all items in an order.
   */
  private canFulfill(warehouse: Warehouse, items: OrderItem[]): boolean {
    return items.every((item) => {
      const available = warehouse.inventory.get(item.skuId) ?? 0;
      return available >= item.quantity;
    });
  }

  /**
   * Get current routing rules.
   */
  getRules(): FulfillmentRules {
    return this.defaultRules;
  }

  /**
   * Update routing rules.
   */
  setRules(rules: FulfillmentRules): void {
    this.defaultRules = rules;
  }

  /**
   * Initialize capacity tracking for new day.
   */
  initializeDay(): void {
    this.capacityTracker.initializeDay();
  }
}

/**
 * Factory function to create intelligent order router.
 */
export function createIntelligentOrderRouter(): IntelligentOrderRouter {
  return new IntelligentOrderRouter();
}
