/**
 * Fuel Optimizer - Fuel Management & Analytics
 *
 * Provides:
 * - FuelAnalyzer: Consumption tracking, MPG/L-per-100km trends
 * - IdleReductionMonitor: Idle detection, driver alerts, benchmarks
 * - RouteFuelCorrelator: Cost per route, optimal fueling stops
 * - FuelCardReconciler: Transaction matching, anomaly detection, fraud flagging
 * - FuelBudgetForecaster: Monthly spend prediction, seasonal adjustments
 * - FuelPriceTracker: Regional monitoring, cheapest fuel stops
 */

import type {
  FuelTransaction,
  FuelCard,
  FuelType,
  FuelAnalysis,
  FleetManagementError,
  CostForecast,
} from "./fleet-types.js";

// ─────────────────────────────────────────────────────────────────────────
// FUEL ANALYZER
// ─────────────────────────────────────────────────────────────────────────

export class FuelAnalyzer {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Analyze fuel consumption for vehicle
   */
  async analyzeFuelConsumption(
    vehicleId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<FuelAnalysis> {
    const transactions = await (this.prisma as any).fuelTransaction.findMany({
      where: {
        vehicleId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "asc" },
    });

    if (transactions.length === 0) {
      return {
        vehicleId,
        period: { start: startDate, end: endDate },
        totalGallons: 0,
        totalCost: 0,
        mpg: 0,
        avgPricePerGallon: 0,
        trendComparison: 0,
      };
    }

    const totalGallons = transactions.reduce((sum: number, t: any) => sum + t.gallons, 0);
    const totalCost = transactions.reduce((sum: number, t: any) => sum + t.totalCost, 0);
    const avgPricePerGallon = totalCost / totalGallons;

    // Calculate MPG from odometer readings
    const firstReading = transactions[0].odometerReading;
    const lastReading = transactions[transactions.length - 1].odometerReading;
    const miles = lastReading - firstReading;
    const mpg = miles > 0 ? miles / totalGallons : 0;

    // Compare with previous period
    const prevStartDate = new Date(startDate);
    prevStartDate.setMonth(prevStartDate.getMonth() - 1);
    const prevEndDate = new Date(endDate);
    prevEndDate.setMonth(prevEndDate.getMonth() - 1);

    const prevTransactions = await (this.prisma as any).fuelTransaction.findMany({
      where: {
        vehicleId,
        date: { gte: prevStartDate, lte: prevEndDate },
      },
    });

    const prevGallons = prevTransactions.reduce((sum: number, t: any) => sum + t.gallons, 0);
    const prevMiles = prevTransactions.length > 0
      ? (prevTransactions[prevTransactions.length - 1].odometerReading -
          prevTransactions[0].odometerReading)
      : 0;
    const prevMpg = prevMiles > 0 ? prevMiles / prevGallons : 0;

    const trendComparison = prevMpg > 0 ? ((mpg - prevMpg) / prevMpg) * 100 : 0;

    return {
      vehicleId,
      period: { start: startDate, end: endDate },
      totalGallons,
      totalCost,
      mpg: Math.round(mpg * 100) / 100,
      avgPricePerGallon: Math.round(avgPricePerGallon * 100) / 100,
      trendComparison: Math.round(trendComparison * 100) / 100,
    };
  }

  /**
   * Track fuel consumption by driver
   */
  async analyzeByDriver(driverId: string, startDate: Date, endDate: Date): Promise<{
    driverId: string;
    totalGallons: number;
    totalCost: number;
    avgMpg: number;
    vehicleCount: number;
  }> {
    const transactions = await (this.prisma as any).fuelTransaction.findMany({
      where: {
        driverId,
        date: { gte: startDate, lte: endDate },
      },
    });

    const totalGallons = transactions.reduce((sum: number, t: any) => sum + t.gallons, 0);
    const totalCost = transactions.reduce((sum: number, t: any) => sum + t.totalCost, 0);
    const totalMiles = transactions.reduce(
      (sum: number, t: any) => sum + (t.odometerReading || 0),
      0,
    );
    const avgMpg = totalGallons > 0 ? totalMiles / totalGallons : 0;

    const vehicleIds = new Set(transactions.map((t: any) => t.vehicleId));

    return {
      driverId,
      totalGallons,
      totalCost,
      avgMpg: Math.round(avgMpg * 100) / 100,
      vehicleCount: vehicleIds.size,
    };
  }

  /**
   * Get MPG trends
   */
  async getMPGTrends(vehicleId: string, months: number = 6): Promise<
    Array<{
      month: string;
      mpg: number;
      gallons: number;
      cost: number;
    }>
  > {
    const trends = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const analysis = await this.analyzeFuelConsumption(vehicleId, startDate, endDate);

      trends.push({
        month: startDate.toISOString().substring(0, 7),
        mpg: analysis.mpg,
        gallons: analysis.totalGallons,
        cost: analysis.totalCost,
      });
    }

    return trends;
  }

  /**
   * Identify inefficient fuel consumption
   */
  async identifyInefficiency(vehicleId: string): Promise<{
    isInefficient: boolean;
    currentMpg: number;
    targetMpg: number;
    efficiencyGap: number;
    recommendation: string;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const analysis = await this.analyzeFuelConsumption(vehicleId, thirtyDaysAgo, new Date());

    // Target MPG varies by vehicle type (using average sedan: 25 MPG)
    const targetMpg = 25;
    const efficiencyGap = Math.max(0, targetMpg - analysis.mpg);
    const isInefficient = efficiencyGap > 2;

    let recommendation = "Fuel consumption is optimal";
    if (efficiencyGap > 5) {
      recommendation = "Critical: Schedule immediate maintenance and driver coaching";
    } else if (efficiencyGap > 2) {
      recommendation = "Consider driver training and maintenance review";
    }

    return {
      isInefficient,
      currentMpg: analysis.mpg,
      targetMpg,
      efficiencyGap: Math.round(efficiencyGap * 100) / 100,
      recommendation,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// IDLE REDUCTION MONITOR
// ─────────────────────────────────────────────────────────────────────────

export class IdleReductionMonitor {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Detect idle time
   */
  async detectIdleTime(
    vehicleId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalIdleHours: number;
    idleIncidents: number;
    averageIdleDuration: number;
    costOfIdling: number;
    co2Emissions: number;
  }> {
    // Placeholder: would integrate with telematics data
    // For now, estimate based on fuel transactions
    const transactions = await (this.prisma as any).fuelTransaction.findMany({
      where: {
        vehicleId,
        date: { gte: startDate, lte: endDate },
      },
    });

    // Estimate idle time as 15% of operation time (industry average)
    const idlePercentage = 0.15;
    const estimatedTotalHours = transactions.length * 8; // Assume 8 hours per fuel fill
    const totalIdleHours = estimatedTotalHours * idlePercentage;

    // Cost of idling: ~$0.03/minute at highway fuel prices
    const costOfIdling = totalIdleHours * 60 * 0.03;

    // CO2: ~4.7 lbs per gallon burned at idle
    const idleGallons = totalIdleHours / 6; // Idle consumption ~6 hours per gallon
    const co2Emissions = idleGallons * 4.7;

    return {
      totalIdleHours: Math.round(totalIdleHours * 10) / 10,
      idleIncidents: Math.ceil(totalIdleHours / 0.5), // Assume avg idle is 30 min
      averageIdleDuration: 0.5,
      costOfIdling: Math.round(costOfIdling * 100) / 100,
      co2Emissions: Math.round(co2Emissions),
    };
  }

  /**
   * Generate driver alerts
   */
  async generateDriverAlerts(driverId: string): Promise<
    Array<{
      vehicleId: string;
      alertType: string;
      severity: "LOW" | "MEDIUM" | "HIGH";
      message: string;
      potentialSavings: number;
    }>
  > {
    // Placeholder: would get real-time telematics data
    const alerts = [];

    // Sample alerts
    alerts.push({
      vehicleId: "vehicle-123",
      alertType: "EXCESSIVE_IDLING",
      severity: "MEDIUM",
      message: "Vehicle idle time exceeded 2 hours today. Turn off engine when stopped.",
      potentialSavings: 5.5,
    });

    alerts.push({
      vehicleId: "vehicle-456",
      alertType: "HARSH_ACCELERATION",
      severity: "HIGH",
      message: "Harsh acceleration detected. Smooth acceleration saves fuel.",
      potentialSavings: 12.3,
    });

    return alerts;
  }

  /**
   * Get fleet idle benchmarks
   */
  async getFleetIdleBenchmarks(): Promise<{
    averageIdlePercentage: number;
    topIdlers: Array<{ vehicleId: string; idlePercentage: number }>;
    totalFleetIdleCost: number;
    recommendation: string;
  }> {
    const vehicles = await (this.prisma as any).vehicle.findMany({
      where: { status: "ACTIVE" },
    });

    // Placeholder calculations
    const averageIdlePercentage = 12.5;
    const topIdlers = vehicles
      .slice(0, 5)
      .map((v: any, i: number) => ({
        vehicleId: v.id,
        idlePercentage: 15 + i * 2,
      }));

    const totalFleetIdleCost = 2500;
    const recommendation =
      "Implement idle reduction program. Current idle costs $2,500/month. Target: <10% idle time.";

    return {
      averageIdlePercentage,
      topIdlers,
      totalFleetIdleCost,
      recommendation,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ROUTE FUEL CORRELATOR
// ─────────────────────────────────────────────────────────────────────────

export class RouteFuelCorrelator {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Calculate fuel cost per route
   */
  async calculateRouteFuelCost(
    vehicleId: string,
    routeName: string,
  ): Promise<{
    route: string;
    totalFuelCost: number;
    averageCostPerMile: number;
    numberOfTrips: number;
    recommendedOptimization: string;
  }> {
    // Placeholder: would correlate with route data from routing service
    const baseCost = 50;
    const trips = Math.floor(Math.random() * 20) + 5;

    return {
      route: routeName,
      totalFuelCost: baseCost * trips,
      averageCostPerMile: 0.85,
      numberOfTrips: trips,
      recommendedOptimization: "Consider consolidating stops to reduce total distance",
    };
  }

  /**
   * Find optimal fueling stops
   */
  async findOptimalFuelingStops(
    currentLocation: { latitude: number; longitude: number },
    destinationLocation: { latitude: number; longitude: number },
  ): Promise<
    Array<{
      station: string;
      location: string;
      pricePerGallon: number;
      distanceFromRoute: number;
      savings: number;
    }>
  > {
    // Placeholder: would use real fuel price data
    return [
      {
        station: "Shell Station #123",
        location: "Main St, Downtown",
        pricePerGallon: 3.45,
        distanceFromRoute: 0.2,
        savings: 8.5,
      },
      {
        station: "Chevron #456",
        location: "Highway 101",
        pricePerGallon: 3.38,
        distanceFromRoute: 1.2,
        savings: 12.3,
      },
      {
        station: "BP Station #789",
        location: "Industrial Park",
        pricePerGallon: 3.52,
        distanceFromRoute: 2.5,
        savings: -2.1,
      },
    ];
  }

  /**
   * Recommend refueling strategy
   */
  async recommendRefuelingStrategy(
    vehicleId: string,
    fuelLevel: number,
    distance: number,
  ): Promise<{
    recommendation: string;
    refuelNow: boolean;
    bestStopLocation: string;
    estimatedSavings: number;
  }> {
    const fuelEfficiency = 20; // MPG placeholder
    const rangeRemaining = fuelLevel * fuelEfficiency;

    return {
      recommendation: rangeRemaining > distance * 1.2
        ? "Continue to destination, refuel there for better price"
        : "Refuel at next available cheaper station",
      refuelNow: rangeRemaining < distance * 1.5,
      bestStopLocation: "Chevron #456 (2 miles ahead)",
      estimatedSavings: 12.3,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// FUEL CARD RECONCILER
// ─────────────────────────────────────────────────────────────────────────

export class FuelCardReconciler {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Reconcile fuel transactions with card statements
   */
  async reconcileTransactions(
    fuelCardId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalTransactions: number;
    matchedTransactions: number;
    unmatchedTransactions: number;
    discrepancies: number;
    reconciliationRate: number;
  }> {
    const cardTransactions = await (this.prisma as any).fuelTransaction.findMany({
      where: {
        fuelCardId,
        date: { gte: startDate, lte: endDate },
      },
    });

    // Placeholder: would match against actual card statement
    const matched = Math.floor(cardTransactions.length * 0.95);
    const unmatched = cardTransactions.length - matched;

    return {
      totalTransactions: cardTransactions.length,
      matchedTransactions: matched,
      unmatchedTransactions: unmatched,
      discrepancies: unmatched,
      reconciliationRate: (matched / cardTransactions.length) * 100,
    };
  }

  /**
   * Detect transaction anomalies
   */
  async detectAnomalies(vehicleId: string): Promise<
    Array<{
      transactionId: string;
      anomalyType: string;
      severity: "LOW" | "MEDIUM" | "HIGH";
      details: string;
      suspiciousScore: number;
    }>
  > {
    const transactions = await (this.prisma as any).fuelTransaction.findMany({
      where: { vehicleId },
      orderBy: { date: "desc" },
      take: 100,
    });

    const anomalies: any[] = [];

    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      const anomaly: any = null;

      // Check for location mismatch
      if (i > 0) {
        const prevT = transactions[i + 1];
        const distance = this.calculateDistance(
          prevT.location?.latitude || 0,
          prevT.location?.longitude || 0,
          t.location?.latitude || 0,
          t.location?.longitude || 0,
        );

        const timeDiff = (t.date.getTime() - prevT.date.getTime()) / (1000 * 60 * 60); // hours
        const speed = distance / timeDiff;

        if (speed > 100) {
          // Impossible speed
          anomalies.push({
            transactionId: t.id,
            anomalyType: "LOCATION_MISMATCH",
            severity: "HIGH",
            details: `Traveled ${distance} miles in ${timeDiff} hours (${speed} mph)`,
            suspiciousScore: 85,
          });
        }
      }

      // Check for capacity overflow
      const vehicle = await (this.prisma as any).vehicle.findUnique({
        where: { id: vehicleId },
      });

      if (vehicle && t.gallons > vehicle.fuelCapacity || false) {
        // Assuming fuelCapacity exists
        anomalies.push({
          transactionId: t.id,
          anomalyType: "CAPACITY_OVERFLOW",
          severity: "HIGH",
          details: `Attempted to fill ${t.gallons} gallons (capacity: ${vehicle.fuelCapacity})`,
          suspiciousScore: 90,
        });
      }

      // Check for frequency anomalies
      if (t.gallons > 0 && t.pricePerGallon > 10) {
        anomalies.push({
          transactionId: t.id,
          anomalyType: "PRICE_ANOMALY",
          severity: "MEDIUM",
          details: `Fuel price $${t.pricePerGallon}/gallon (typical: $3-4)`,
          suspiciousScore: 65,
        });
      }
    }

    return anomalies;
  }

  /**
   * Flag potential fraud
   */
  async flagPotentialFraud(vehicleId: string): Promise<{
    fraudScore: number;
    flagged: boolean;
    riskFactors: string[];
    recommendation: string;
  }> {
    const anomalies = await this.detectAnomalies(vehicleId);
    const highSeverityCount = anomalies.filter((a) => a.severity === "HIGH").length;

    const fraudScore = Math.min(100, anomalies.reduce((sum, a) => sum + a.suspiciousScore, 0) / 10);
    const flagged = fraudScore > 50 || highSeverityCount > 2;

    const riskFactors = [
      ...new Set(anomalies.map((a) => a.anomalyType)),
    ];

    let recommendation = "Normal activity";
    if (fraudScore > 70) {
      recommendation = "ALERT: Investigate immediately. Possible fraud detected.";
    } else if (fraudScore > 50) {
      recommendation = "Review transactions. Potential irregularities detected.";
    }

    return {
      fraudScore: Math.round(fraudScore),
      flagged,
      riskFactors,
      recommendation,
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Simplified distance calculation (in miles)
    const R = 3959; // Earth's radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// FUEL BUDGET FORECASTER
// ─────────────────────────────────────────────────────────────────────────

export class FuelBudgetForecaster {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Forecast monthly fuel spend
   */
  async forecastMonthlySpend(
    vehicleId: string,
    forecastMonths: number = 3,
  ): Promise<CostForecast> {
    // Get historical data
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const historical = await (this.prisma as any).fuelTransaction.findMany({
      where: { vehicleId, date: { gte: sixMonthsAgo } },
    });

    const avgMonthlySpend =
      historical.reduce((sum: any, t: any) => sum + t.totalCost, 0) / 6;

    // Apply seasonal adjustments
    const seasonalMultiplier = this.getSeasonalMultiplier();
    const projectedFuel = avgMonthlySpend * seasonalMultiplier;

    const forecastStart = new Date();
    const forecastEnd = new Date();
    forecastEnd.setMonth(forecastEnd.getMonth() + forecastMonths);

    return {
      vehicleId,
      period: { start: forecastStart, end: forecastEnd },
      projectedFuel: Math.round(projectedFuel * 100) / 100,
      projectedMaintenance: 200, // Placeholder
      projectedInsurance: 0, // Usually fixed
      projectedTotal: Math.round((projectedFuel + 200) * 100) / 100,
      confidenceLevel: 75,
    };
  }

  /**
   * Forecast fleet fuel spend
   */
  async forecastFleetSpend(forecastMonths: number = 3): Promise<{
    projectedSpend: number;
    byVehicle: Array<{ vehicleId: string; projectedSpend: number }>;
    budgetStatus: string;
    variance: number;
  }> {
    const vehicles = await (this.prisma as any).vehicle.findMany({
      where: { status: "ACTIVE" },
    });

    const forecasts = await Promise.all(
      vehicles.map((v: any) => this.forecastMonthlySpend(v.id, forecastMonths)),
    );

    const projectedSpend = forecasts.reduce((sum, f) => sum + f.projectedFuel, 0);
    const budgetedSpend = 50000; // Placeholder annual budget = ~4166/month

    const variance = ((projectedSpend - budgetedSpend / 12) / (budgetedSpend / 12)) * 100;

    return {
      projectedSpend: Math.round(projectedSpend * 100) / 100,
      byVehicle: forecasts.map((f) => ({
        vehicleId: f.vehicleId || "",
        projectedSpend: f.projectedFuel,
      })),
      budgetStatus:
        variance > 10
          ? "OVER_BUDGET"
          : variance < -10
            ? "UNDER_BUDGET"
            : "ON_TRACK",
      variance: Math.round(variance),
    };
  }

  /**
   * Adjust forecast for seasonal changes
   */
  applySeasonalAdjustment(baseSpend: number, month: number): number {
    // Winter (heating, cold engine) = +15%, Summer = normal, Spring/Fall = -5%
    if (month >= 11 || month <= 2) return baseSpend * 1.15;
    if (month >= 3 && month <= 4) return baseSpend * 0.95;
    if (month >= 8 && month <= 9) return baseSpend * 0.95;
    return baseSpend;
  }

  private getSeasonalMultiplier(): number {
    const month = new Date().getMonth();
    if (month >= 10 || month <= 1) return 1.15; // Winter
    if ((month >= 2 && month <= 4) || (month >= 8 && month <= 9)) return 0.95; // Spring/Fall
    return 1.0; // Summer
  }
}

// ─────────────────────────────────────────────────────────────────────────
// FUEL PRICE TRACKER
// ─────────────────────────────────────────────────────────────────────────

export class FuelPriceTracker {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Monitor regional fuel prices
   */
  async monitorRegionalPrices(region: string): Promise<{
    region: string;
    averagePrice: number;
    trend: "UP" | "DOWN" | "STABLE";
    priceRange: { min: number; max: number };
    lastUpdated: Date;
  }> {
    // Placeholder: would integrate with fuel price API
    return {
      region,
      averagePrice: 3.45,
      trend: "UP",
      priceRange: { min: 3.25, max: 3.65 },
      lastUpdated: new Date(),
    };
  }

  /**
   * Find cheapest fuel stop
   */
  async findCheapestStop(
    location: { latitude: number; longitude: number },
    radius: number = 10,
  ): Promise<{
    station: string;
    address: string;
    price: number;
    distance: number;
    savings: number;
  }> {
    // Placeholder: would query actual fuel price database
    return {
      station: "Costco Gas",
      address: "123 Main St",
      price: 3.25,
      distance: 2.3,
      savings: 0.2,
    };
  }

  /**
   * Track historical price trends
   */
  async getPriceTrends(months: number = 6): Promise<
    Array<{
      month: string;
      averagePrice: number;
      trend: string;
    }>
  > {
    const trends = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      // Simulate price data
      const basePrice = 3.4;
      const volatility = Math.sin(i * 0.5) * 0.3;
      const trend = i % 2 === 0 ? "UP" : "DOWN";

      trends.push({
        month: date.toISOString().substring(0, 7),
        averagePrice: Number((basePrice + volatility).toFixed(2)),
        trend,
      });
    }

    return trends;
  }
}
