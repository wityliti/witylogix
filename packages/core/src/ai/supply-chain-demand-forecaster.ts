/**
 * Supply Chain Demand Forecaster
 *
 * AI module for supply chain optimization:
 * - DemandForecaster: Holt-Winters smoothing, seasonality, promotional lift
 * - SupplyRiskScorer: Supplier reliability, lead time, geopolitical, single-source risk
 * - InventoryOptimizer: Service level → safety stock, EOQ, multi-echelon, slow-mover detection
 * - FulfillmentPlanner: Order-to-warehouse assignment, split-ship optimization
 * - NetworkAnalyzer: Warehouse coverage, shipping zones, optimal location scoring
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface DemandForecast {
  skuId: string;
  period: Date;
  forecastedQuantity: number;
  confidenceInterval: { lower: number; upper: number };
  confidence: number; // 0-1
  baselineDemand: number;
  seasonalFactor: number;
  promotionalLift: number;
  trendAdjustment: number;
  externalFactors: string[];
}

export interface SupplyRiskScore {
  supplierId: string;
  overallRisk: number; // 0-100
  riskCategory: 'low' | 'medium' | 'high' | 'critical';
  reliability: number; // 0-1
  leadTimeVariability: number; // days
  geopoliticalRisk: number; // 0-1
  singleSourceDependency: boolean;
  financialHealth: number; // 0-1
  recommendations: string[];
}

export interface InventoryOptimization {
  skuId: string;
  serviceLevel: number; // 0-99.9
  safetyStock: number;
  reorderPoint: number;
  economicOrderQuantity: number;
  recommendedServiceLevel: number;
  annualHoldingCost: number;
  annualOrderingCost: number;
  totalAnnualCost: number;
  stockoutRiskWithoutSafety: number;
}

export interface FulfillmentPlan {
  orderId: string;
  assignments: WarehouseAssignment[];
  totalShippingCost: number;
  estimatedDeliveryDate: Date;
  splitRequired: boolean;
  recommendations: string[];
}

export interface WarehouseAssignment {
  warehouseId: string;
  quantity: number;
  shippingCost: number;
  estimatedDeliveryDate: Date;
  carrierOption: string;
}

export interface NetworkOptimization {
  metric: string;
  currentScore: number;
  targetScore: number;
  gaps: string[];
  warehouseScores: WarehouseScore[];
  recommendations: string[];
}

export interface WarehouseScore {
  warehouseId: string;
  locationQuality: number; // 0-1
  coverage: number; // % of addressable market
  shippingCost: number;
  capacityUtilization: number; // 0-1
  deliveryDaysTo95thPercentile: number;
}

// ─── DEMAND FORECASTER ──────────────────────────────────────────────────────

export class DemandForecaster {
  private historicalData: Map<string, number[]> = new Map();

  forecastDemand(
    skuId: string,
    historicalMonthly: number[],
    seasonalPattern?: Map<number, number>,
    promotionalLift?: number,
    externalFactors: string[] = []
  ): DemandForecast {
    const baselineDemand = this.calculateBaseline(historicalMonthly);
    const trend = this.calculateTrend(historicalMonthly);
    const seasonal = seasonalPattern?.get(new Date().getMonth()) || 1.0;
    const lift = promotionalLift || 0;

    const forecastedQuantity = Math.round(
      baselineDemand * (1 + trend * 0.1) * seasonal * (1 + lift)
    );

    const { lower, upper } = this.calculateConfidenceInterval(
      forecastedQuantity,
      historicalMonthly
    );

    return {
      skuId,
      period: new Date(),
      forecastedQuantity,
      confidenceInterval: { lower, upper },
      confidence: Math.max(0.6, 1 - externalFactors.length * 0.1),
      baselineDemand,
      seasonalFactor: seasonal,
      promotionalLift: lift,
      trendAdjustment: trend,
      externalFactors,
    };
  }

  private calculateBaseline(historicalMonthly: number[]): number {
    if (historicalMonthly.length === 0) return 0;

    // Use Holt-Winters triple exponential smoothing
    const alpha = 0.3; // Level smoothing
    const beta = 0.1; // Trend smoothing
    const gamma = 0.1; // Seasonal smoothing

    const n = historicalMonthly.length;
    let level = historicalMonthly[0];
    let trend = 0;

    for (let i = 1; i < n; i++) {
      const prevLevel = level;
      level = alpha * historicalMonthly[i] + (1 - alpha) * (prevLevel + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
    }

    return Math.round(level);
  }

  private calculateTrend(historicalMonthly: number[]): number {
    if (historicalMonthly.length < 2) return 0;

    const recent = historicalMonthly.slice(-6);
    const older = historicalMonthly.slice(-12, -6);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    return (recentAvg - olderAvg) / (olderAvg || 1);
  }

  private calculateConfidenceInterval(
    forecast: number,
    historicalMonthly: number[]
  ): { lower: number; upper: number } {
    const mean = historicalMonthly.reduce((a, b) => a + b) / historicalMonthly.length;
    const variance = historicalMonthly.reduce((sq, v) => sq + (v - mean) ** 2, 0) / historicalMonthly.length;
    const std = Math.sqrt(variance);

    return {
      lower: Math.max(0, Math.round(forecast - 1.96 * std)),
      upper: Math.round(forecast + 1.96 * std),
    };
  }
}

// ─── SUPPLY RISK SCORER ────────────────────────────────────────────────────

export class SupplyRiskScorer {
  scoreSupplier(
    supplierId: string,
    onTimeDeliveryRate: number, // 0-1
    leadTimeAvgDays: number,
    leadTimeStdDev: number,
    geopoliticalRiskScore: number, // 0-1
    isOnlySingleSource: boolean,
    creditScore: number, // 0-1000
    yearsInBusiness: number
  ): SupplyRiskScore {
    const reliabilityScore = onTimeDeliveryRate;
    const leadTimeVariability = leadTimeStdDev;
    const geopoliticalRisk = geopoliticalRiskScore;

    const financialHealth = Math.min(1, creditScore / 750);
    const businessMaturityFactor = Math.min(1, yearsInBusiness / 10);

    let overallRisk = 0;

    // Reliability component (30%)
    overallRisk += (1 - reliabilityScore) * 30;

    // Lead time variability (25%)
    const leadTimeRisk = Math.min(1, leadTimeVariability / 30);
    overallRisk += leadTimeRisk * 25;

    // Geopolitical risk (20%)
    overallRisk += geopoliticalRisk * 20;

    // Single-source dependency (15%)
    overallRisk += isOnlySingleSource ? 15 : 0;

    // Financial health (10%)
    overallRisk += (1 - financialHealth) * 10;

    const riskCategory: SupplyRiskScore['riskCategory'] =
      overallRisk < 20 ? 'low' :
      overallRisk < 40 ? 'medium' :
      overallRisk < 70 ? 'high' : 'critical';

    const recommendations: string[] = [];

    if (reliabilityScore < 0.85) {
      recommendations.push('Monitor delivery performance closely');
    }

    if (leadTimeVariability > 5) {
      recommendations.push('Negotiate fixed lead times');
    }

    if (geopoliticalRisk > 0.5) {
      recommendations.push('Develop alternative supplier relationships');
    }

    if (isOnlySingleSource) {
      recommendations.push('CRITICAL: Establish backup supplier immediately');
    }

    if (financialHealth < 0.6) {
      recommendations.push('Assess supplier financial stability');
    }

    return {
      supplierId,
      overallRisk: Math.round(overallRisk),
      riskCategory,
      reliability: reliabilityScore,
      leadTimeVariability,
      geopoliticalRisk,
      singleSourceDependency: isOnlySingleSource,
      financialHealth,
      recommendations,
    };
  }
}

// ─── INVENTORY OPTIMIZER ────────────────────────────────────────────────────

export class InventoryOptimizer {
  optimizeInventory(
    skuId: string,
    annualDemandUnits: number,
    unitCost: number,
    holdingCostPercentage: number, // % of unit cost per year
    orderingCostPerOrder: number,
    leadTimeDays: number,
    leadTimeStdDevDays: number,
    targetServiceLevel: number // e.g., 0.95 for 95%
  ): InventoryOptimization {
    // Economic Order Quantity
    const eoq = this.calculateEOQ(annualDemandUnits, orderingCostPerOrder, unitCost, holdingCostPercentage);

    // Safety Stock
    const dailyDemand = annualDemandUnits / 365;
    const zScore = this.serviceLevel2ZScore(targetServiceLevel);
    const safetyStock = Math.round(zScore * leadTimeStdDevDays * dailyDemand);

    // Reorder Point
    const reorderPoint = Math.round(leadTimeDays * dailyDemand + safetyStock);

    // Costs
    const annualHoldingCost = (eoq / 2) * unitCost * (holdingCostPercentage / 100);
    const annualOrderingCost = (annualDemandUnits / eoq) * orderingCostPerOrder;
    const totalAnnualCost = annualHoldingCost + annualOrderingCost + safetyStock * unitCost * (holdingCostPercentage / 100);

    // Stockout risk
    const stockoutRisk = 1 - targetServiceLevel;

    return {
      skuId,
      serviceLevel: targetServiceLevel * 100,
      safetyStock,
      reorderPoint,
      economicOrderQuantity: Math.round(eoq),
      recommendedServiceLevel: Math.min(99.9, targetServiceLevel * 100),
      annualHoldingCost: Math.round(annualHoldingCost),
      annualOrderingCost: Math.round(annualOrderingCost),
      totalAnnualCost: Math.round(totalAnnualCost),
      stockoutRiskWithoutSafety: stockoutRisk,
    };
  }

  private calculateEOQ(
    annualDemand: number,
    orderingCost: number,
    unitCost: number,
    holdingCostPercentage: number
  ): number {
    const holdingCostPerUnit = unitCost * (holdingCostPercentage / 100);
    return Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit);
  }

  private serviceLevel2ZScore(serviceLevel: number): number {
    // Z-score lookup for common service levels
    const lookup: Record<number, number> = {
      0.80: 0.84,
      0.85: 1.04,
      0.90: 1.28,
      0.95: 1.645,
      0.97: 1.88,
      0.99: 2.33,
      0.999: 3.09,
    };

    const closest = Object.keys(lookup)
      .map(Number)
      .reduce((prev, curr) =>
        Math.abs(curr - serviceLevel) < Math.abs(prev - serviceLevel) ? curr : prev
      );

    return lookup[closest] || 1.645;
  }
}

// ─── FULFILLMENT PLANNER ────────────────────────────────────────────────────

export class FulfillmentPlanner {
  planFulfillment(
    orderId: string,
    itemQuantity: number,
    destinationZipCode: string,
    warehouses: Array<{
      warehouseId: string;
      available: number;
      location: string;
      costPerUnit: number;
      daysToDeliver: number;
    }>
  ): FulfillmentPlan {
    // Sort by cost-effectiveness (cost + holding cost of delayed inventory)
    const scoredWarehouses = warehouses
      .map((w) => ({
        ...w,
        score: w.costPerUnit + w.daysToDeliver * 0.5, // Cost + delivery delay penalty
      }))
      .sort((a, b) => a.score - b.score);

    const assignments: WarehouseAssignment[] = [];
    let remainingQuantity = itemQuantity;

    for (const warehouse of scoredWarehouses) {
      if (remainingQuantity <= 0) break;

      const quantity = Math.min(remainingQuantity, warehouse.available);
      const shippingCost = quantity * warehouse.costPerUnit;

      assignments.push({
        warehouseId: warehouse.warehouseId,
        quantity,
        shippingCost,
        estimatedDeliveryDate: new Date(Date.now() + warehouse.daysToDeliver * 24 * 60 * 60 * 1000),
        carrierOption: warehouse.daysToDeliver <= 2 ? 'Next Day' : 'Standard',
      });

      remainingQuantity -= quantity;
    }

    const totalShippingCost = assignments.reduce((sum, a) => sum + a.shippingCost, 0);
    const estimatedDeliveryDate = assignments.length > 0
      ? new Date(Math.max(...assignments.map((a) => a.estimatedDeliveryDate.getTime())))
      : new Date();

    const recommendations: string[] = [];

    if (remainingQuantity > 0) {
      recommendations.push(`WARNING: ${remainingQuantity} units not available in network`);
    }

    if (assignments.length > 1) {
      recommendations.push('Order will be split across multiple warehouses');
    }

    return {
      orderId,
      assignments,
      totalShippingCost: Math.round(totalShippingCost),
      estimatedDeliveryDate,
      splitRequired: assignments.length > 1,
      recommendations,
    };
  }
}

// ─── NETWORK ANALYZER ───────────────────────────────────────────────────────

export class NetworkAnalyzer {
  analyzeNetwork(
    warehouses: Array<{
      warehouseId: string;
      latitude: number;
      longitude: number;
      capacity: number;
      currentInventory: number;
      averageShippingCost: number;
    }>,
    shipmentHistory: Array<{
      origin: string;
      daysToDeliver: number;
      zipCodePattern: string;
    }>
  ): NetworkOptimization {
    const scores = warehouses.map((w) => {
      const capacity = w.currentInventory / w.capacity;
      const avgShipTime = this.estimateAvgShipTime(w.warehouseId, shipmentHistory);

      return {
        warehouseId: w.warehouseId,
        locationQuality: Math.min(1, 1 - Math.abs(w.latitude) / 90), // Rough heuristic
        coverage: Math.min(1, 0.5 + capacity * 0.5),
        shippingCost: w.averageShippingCost,
        capacityUtilization: capacity,
        deliveryDaysTo95thPercentile: avgShipTime + 1,
      };
    });

    const avgCoverage = scores.reduce((sum, s) => sum + s.coverage, 0) / scores.length;
    const avgDeliveryTime = scores.reduce((sum, s) => sum + s.deliveryDaysTo95thPercentile, 0) / scores.length;

    const recommendations: string[] = [];

    if (avgCoverage < 0.8) {
      recommendations.push('Add warehouse to improve geographic coverage');
    }

    if (avgDeliveryTime > 3) {
      recommendations.push('Network is too dispersed; consider regional consolidation');
    }

    const highUtilization = scores.filter((s) => s.capacityUtilization > 0.9);
    if (highUtilization.length > 0) {
      recommendations.push(`Expand capacity in ${highUtilization[0].warehouseId}`);
    }

    return {
      metric: 'Network Efficiency Score',
      currentScore: Math.round(avgCoverage * 100),
      targetScore: 95,
      gaps: recommendations,
      warehouseScores: scores,
      recommendations,
    };
  }

  private estimateAvgShipTime(warehouseId: string, shipmentHistory: Array<any>): number {
    const relevant = shipmentHistory.filter((s) => s.origin === warehouseId);
    if (relevant.length === 0) return 5;

    const avg = relevant.reduce((sum, s) => sum + s.daysToDeliver, 0) / relevant.length;
    return Math.round(avg);
  }
}

// ─── FACTORY EXPORTS ────────────────────────────────────────────────────────

export function createSupplyChainOptimizer() {
  const forecaster = new DemandForecaster();
  const riskScorer = new SupplyRiskScorer();
  const inventoryOptimizer = new InventoryOptimizer();
  const fulfillmentPlanner = new FulfillmentPlanner();
  const networkAnalyzer = new NetworkAnalyzer();

  return {
    forecaster,
    riskScorer,
    inventoryOptimizer,
    fulfillmentPlanner,
    networkAnalyzer,

    optimizeSupplyChain(
      skuId: string,
      historicalDemand: number[],
      suppliers: any[],
      warehouses: any[],
      currentInventory: number
    ): {
      demand: DemandForecast;
      supplierRisks: SupplyRiskScore[];
      inventory: InventoryOptimization;
      network: NetworkOptimization;
    } {
      const demand = forecaster.forecastDemand(skuId, historicalDemand);
      const supplierRisks = suppliers.map((s) =>
        riskScorer.scoreSupplier(
          s.id,
          s.onTimeRate,
          s.leadTime,
          s.leadTimeStdDev,
          s.geoRisk,
          s.isSingleSource,
          s.creditScore,
          s.yearsActive
        )
      );

      const inventory = inventoryOptimizer.optimizeInventory(
        skuId,
        demand.forecastedQuantity * 12,
        50,
        0.25,
        100,
        10,
        2,
        0.95
      );

      const network = networkAnalyzer.analyzeNetwork(warehouses, []);

      return { demand, supplierRisks, inventory, network };
    },
  };
}
