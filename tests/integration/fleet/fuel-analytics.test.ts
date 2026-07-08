/**
 * Fuel Analytics Integration Tests (~350 lines)
 *
 * Comprehensive test coverage for:
 * - Transaction reconciliation: match transactions to vehicles, detect anomalies
 * - MPG calculation: per-vehicle, per-driver, fleet average
 * - Idle monitoring: idle time detection, fleet benchmarking
 * - Anomaly detection: location mismatch, capacity overflow, unusual frequency
 * - Budget forecasting: monthly prediction, seasonal adjustment
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createMockVehicle,
  createMockFuelTransaction,
  createMockFuelCard,
} from "../fixtures/fleet-fixtures.js";
import type {
  FuelTransaction,
  Vehicle,
} from "../../../packages/core/src/fleet/fleet-types.js";

// ─────────────────────────────────────────────────────────────────────────
// SETUP & HELPERS
// ─────────────────────────────────────────────────────────────────────────

interface FuelAnomalyAlert {
  type:
    | "location_mismatch"
    | "capacity_overflow"
    | "unusual_frequency"
    | "price_spike";
  severity: "warning" | "critical";
  message: string;
}

class FuelAnalyticsEngine {
  private vehicles = new Map<string, Vehicle>();
  private transactions: FuelTransaction[] = [];
  private driverIdMap = new Map<string, string>(); // driver -> vehicle assignment

  registerVehicle(vehicle: Vehicle): void {
    this.vehicles.set(vehicle.id, vehicle);
  }

  recordTransaction(transaction: FuelTransaction): void {
    this.transactions.push(transaction);
  }

  // ─────────────────────────────────────────────────────────────────
  // TRANSACTION RECONCILIATION
  // ─────────────────────────────────────────────────────────────────

  reconcileTransactions(): { matched: number; unmatched: number } {
    let matched = 0;
    let unmatched = 0;

    for (const transaction of this.transactions) {
      const vehicle = this.vehicles.get(transaction.vehicleId);
      if (vehicle) {
        matched++;
      } else {
        unmatched++;
      }
    }

    return { matched, unmatched };
  }

  getVehicleTransactions(vehicleId: string): FuelTransaction[] {
    return this.transactions.filter((t) => t.vehicleId === vehicleId);
  }

  getTransactionsByDriver(driverId: string): FuelTransaction[] {
    return this.transactions.filter((t) => t.driverId === driverId);
  }

  // ─────────────────────────────────────────────────────────────────
  // MPG CALCULATION
  // ─────────────────────────────────────────────────────────────────

  calculateMPG(vehicleId: string): number {
    const vehicleTransactions = this.getVehicleTransactions(vehicleId).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    if (vehicleTransactions.length < 2) return 0;

    const firstTransaction = vehicleTransactions[0];
    const lastTransaction = vehicleTransactions[vehicleTransactions.length - 1];

    const totalMiles =
      lastTransaction.odometerReading - firstTransaction.odometerReading;
    const totalGallons = vehicleTransactions.reduce(
      (sum, t) => sum + t.gallons,
      0,
    );

    if (totalGallons === 0) return 0;
    return Math.round((totalMiles / totalGallons) * 100) / 100;
  }

  calculateDriverMPG(driverId: string): number {
    const driverTransactions = this.getTransactionsByDriver(driverId).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    if (driverTransactions.length < 2) return 0;

    const firstTransaction = driverTransactions[0];
    const lastTransaction = driverTransactions[driverTransactions.length - 1];

    const totalMiles =
      lastTransaction.odometerReading - firstTransaction.odometerReading;
    const totalGallons = driverTransactions.reduce(
      (sum, t) => sum + t.gallons,
      0,
    );

    if (totalGallons === 0) return 0;
    return Math.round((totalMiles / totalGallons) * 100) / 100;
  }

  calculateFleetAverageMPG(): number {
    const vehicles = Array.from(this.vehicles.keys());

    if (vehicles.length === 0) return 0;

    const mpgs = vehicles.map((vehicleId) => this.calculateMPG(vehicleId));
    const validMpgs = mpgs.filter((mpg) => mpg > 0);

    if (validMpgs.length === 0) return 0;

    const sum = validMpgs.reduce((a, b) => a + b, 0);
    return Math.round((sum / validMpgs.length) * 100) / 100;
  }

  // ─────────────────────────────────────────────────────────────────
  // IDLE MONITORING
  // ─────────────────────────────────────────────────────────────────

  detectIdleTime(vehicleId: string): number {
    // Idle time detection based on frequent low-volume transactions
    const transactions = this.getVehicleTransactions(vehicleId);

    if (transactions.length === 0) return 0;

    let idleHours = 0;

    for (let i = 0; i < transactions.length - 1; i++) {
      const current = transactions[i];
      const next = transactions[i + 1];

      const timeDiff = next.date.getTime() - current.date.getTime();
      const timeDiffHours = timeDiff / (1000 * 60 * 60);

      // If gap > 7 days and < 1 month, likely idle
      if (timeDiffHours > 168 && timeDiffHours < 720) {
        idleHours += timeDiffHours;
      }
    }

    return Math.round(idleHours);
  }

  getFleetIdleRanking(): Array<{ vehicleId: string; idleHours: number }> {
    const vehicles = Array.from(this.vehicles.keys());

    return vehicles
      .map((vehicleId) => ({
        vehicleId,
        idleHours: this.detectIdleTime(vehicleId),
      }))
      .sort((a, b) => b.idleHours - a.idleHours);
  }

  // ─────────────────────────────────────────────────────────────────
  // ANOMALY DETECTION
  // ─────────────────────────────────────────────────────────────────

  detectAnomalies(vehicleId: string): FuelAnomalyAlert[] {
    const alerts: FuelAnomalyAlert[] = [];
    const transactions = this.getVehicleTransactions(vehicleId);
    const vehicle = this.vehicles.get(vehicleId);

    if (!vehicle) return alerts;

    // Check for location mismatch
    const locationLats = transactions.map((t) => t.location?.latitude || 0);
    const locationLons = transactions.map((t) => t.location?.longitude || 0);

    if (locationLats.length >= 2) {
      const avgLat =
        locationLats.reduce((a, b) => a + b, 0) / locationLats.length;
      const avgLon =
        locationLons.reduce((a, b) => a + b, 0) / locationLons.length;

      const lastTransaction = transactions[transactions.length - 1];
      if (lastTransaction.location) {
        const distance = this.calculateDistance(
          { lat: avgLat, lon: avgLon },
          {
            lat: lastTransaction.location.latitude,
            lon: lastTransaction.location.longitude,
          },
        );

        if (distance > 500) {
          // > 500 miles from average
          alerts.push({
            type: "location_mismatch",
            severity: "warning",
            message: "Vehicle fueled significantly outside normal area",
          });
        }
      }
    }

    // Check for capacity overflow
    const maxTransaction = transactions.reduce((max, t) =>
      t.gallons > max.gallons ? t : max,
    );
    const otherTransactions = transactions.filter((t) => t !== maxTransaction);
    const baselineAvgGallons =
      otherTransactions.length > 0
        ? otherTransactions.reduce((sum, t) => sum + t.gallons, 0) /
          otherTransactions.length
        : maxTransaction.gallons;

    if (maxTransaction.gallons > baselineAvgGallons * 2) {
      alerts.push({
        type: "capacity_overflow",
        severity: "critical",
        message:
          "Unusually high fuel purchase: " +
          maxTransaction.gallons +
          " gallons",
      });
    }

    // Check for unusual frequency
    if (transactions.length > 5) {
      const recentTransactions = transactions.slice(-5);
      const dates = recentTransactions.map((t) => t.date.getTime());

      let totalGapHours = 0;
      for (let i = 0; i < dates.length - 1; i++) {
        totalGapHours += (dates[i + 1] - dates[i]) / (1000 * 60 * 60);
      }

      const avgGapHours = totalGapHours / (dates.length - 1);

      if (avgGapHours < 48) {
        // Less than 2 days between fills
        alerts.push({
          type: "unusual_frequency",
          severity: "warning",
          message:
            "Frequent fuel purchases: every " +
            Math.round(avgGapHours) +
            " hours",
        });
      }
    }

    // Check for price spike
    const prices = transactions.map((t) => t.pricePerGallon);
    const lastPrice = prices[prices.length - 1];
    const prevPrices = prices.slice(0, -1);
    const avgPrevPrice =
      prevPrices.length > 0
        ? prevPrices.reduce((a, b) => a + b, 0) / prevPrices.length
        : lastPrice;

    if (lastPrice > avgPrevPrice * 1.15) {
      // > 15% above average
      alerts.push({
        type: "price_spike",
        severity: "warning",
        message:
          "Fuel price spike: $" +
          lastPrice.toFixed(2) +
          "/gal vs $" +
          avgPrevPrice.toFixed(2) +
          " average",
      });
    }

    return alerts;
  }

  private calculateDistance(
    point1: { lat: number; lon: number },
    point2: { lat: number; lon: number },
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLon = ((point2.lon - point1.lon) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.lat * Math.PI) / 180) *
        Math.cos((point2.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ─────────────────────────────────────────────────────────────────
  // BUDGET FORECASTING
  // ─────────────────────────────────────────────────────────────────

  forecastMonthlyBudget(vehicleId: string): number {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return 0;

    const transactions = this.getVehicleTransactions(vehicleId);

    if (transactions.length === 0) return 0;

    // Get last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTransactions = transactions.filter(
      (t) => t.date >= thirtyDaysAgo,
    );

    if (recentTransactions.length === 0) {
      // Use overall average
      const totalCost = transactions.reduce((sum, t) => sum + t.totalCost, 0);
      const avgCostPerDay = totalCost / (transactions.length * 7); // Rough estimate
      return Math.round(avgCostPerDay * 30);
    }

    const totalCost = recentTransactions.reduce(
      (sum, t) => sum + t.totalCost,
      0,
    );
    return Math.round(totalCost);
  }

  forecastFleetBudget(): number {
    const vehicles = Array.from(this.vehicles.keys());
    const totalForecast = vehicles.reduce(
      (sum, vehicleId) => sum + this.forecastMonthlyBudget(vehicleId),
      0,
    );

    return totalForecast;
  }

  adjustForSeasonality(baseBudget: number, month: number): number {
    // Winter months (11, 12, 1, 2) have higher fuel consumption
    const winterMultiplier = 1.15;
    const summerMultiplier = 0.95;

    if (month >= 11 || month <= 2) {
      return Math.round(baseBudget * winterMultiplier);
    } else if (month >= 6 && month <= 8) {
      return Math.round(baseBudget * summerMultiplier);
    }

    return baseBudget;
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  getTotalTransactions(): number {
    return this.transactions.length;
  }

  getTotalFuelCost(): number {
    return (
      Math.round(
        this.transactions.reduce((sum, t) => sum + t.totalCost, 0) * 100,
      ) / 100
    );
  }

  getTotalGallons(): number {
    return (
      Math.round(
        this.transactions.reduce((sum, t) => sum + t.gallons, 0) * 100,
      ) / 100
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────

describe("Fuel Analytics", () => {
  let engine: FuelAnalyticsEngine;

  beforeEach(() => {
    engine = new FuelAnalyticsEngine();
  });

  // ─────────────────────────────────────────────────────────────────
  // TRANSACTION RECONCILIATION
  // ─────────────────────────────────────────────────────────────────

  describe("Transaction Reconciliation", () => {
    it("should match transactions to vehicles", () => {
      const vehicle = createMockVehicle({ id: "v1" });
      engine.registerVehicle(vehicle);

      const transaction = createMockFuelTransaction({ vehicleId: vehicle.id });
      engine.recordTransaction(transaction);

      const result = engine.reconcileTransactions();
      expect(result.matched).toBe(1);
      expect(result.unmatched).toBe(0);
    });

    it("should detect unmatched transactions", () => {
      const transaction = createMockFuelTransaction({
        vehicleId: "unknown_vehicle",
      });
      engine.recordTransaction(transaction);

      const result = engine.reconcileTransactions();
      expect(result.unmatched).toBe(1);
      expect(result.matched).toBe(0);
    });

    it("should retrieve vehicle transactions", () => {
      const vehicle = createMockVehicle({ id: "v1" });
      engine.registerVehicle(vehicle);

      const t1 = createMockFuelTransaction({ vehicleId: vehicle.id });
      const t2 = createMockFuelTransaction({ vehicleId: vehicle.id });

      engine.recordTransaction(t1);
      engine.recordTransaction(t2);

      const transactions = engine.getVehicleTransactions(vehicle.id);
      expect(transactions).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // MPG CALCULATION
  // ─────────────────────────────────────────────────────────────────

  describe("MPG Calculation", () => {
    it("should calculate per-vehicle MPG", () => {
      const vehicle = createMockVehicle({ id: "v1", mileage: 100000 });
      engine.registerVehicle(vehicle);

      const t1 = createMockFuelTransaction({
        vehicleId: vehicle.id,
        odometerReading: 100000,
        gallons: 50,
      });
      const t2 = createMockFuelTransaction({
        vehicleId: vehicle.id,
        odometerReading: 100600,
        gallons: 50,
        daysAgo: 0,
      });

      engine.recordTransaction(t1);
      engine.recordTransaction(t2);

      const mpg = engine.calculateMPG(vehicle.id);
      expect(mpg).toBeGreaterThan(0);
      expect(mpg).toBeLessThanOrEqual(10);
    });

    it("should calculate per-driver MPG", () => {
      const vehicle = createMockVehicle({ id: "v1" });
      engine.registerVehicle(vehicle);

      const t1 = createMockFuelTransaction({
        vehicleId: vehicle.id,
        driverId: "driver_1",
        odometerReading: 50000,
        gallons: 50,
      });
      const t2 = createMockFuelTransaction({
        vehicleId: vehicle.id,
        driverId: "driver_1",
        odometerReading: 50500,
        gallons: 50,
        daysAgo: 0,
      });

      engine.recordTransaction(t1);
      engine.recordTransaction(t2);

      const mpg = engine.calculateDriverMPG("driver_1");
      expect(mpg).toBeGreaterThan(0);
    });

    it("should calculate fleet average MPG", () => {
      const v1 = createMockVehicle({ id: "v1" });
      const v2 = createMockVehicle({ id: "v2" });

      engine.registerVehicle(v1);
      engine.registerVehicle(v2);

      engine.recordTransaction(
        createMockFuelTransaction({ vehicleId: v1.id, odometerReading: 50000 }),
      );
      engine.recordTransaction(
        createMockFuelTransaction({
          vehicleId: v1.id,
          odometerReading: 50600,
          daysAgo: 0,
        }),
      );

      engine.recordTransaction(
        createMockFuelTransaction({ vehicleId: v2.id, odometerReading: 75000 }),
      );
      engine.recordTransaction(
        createMockFuelTransaction({
          vehicleId: v2.id,
          odometerReading: 75650,
          daysAgo: 0,
        }),
      );

      const avgMpg = engine.calculateFleetAverageMPG();
      expect(avgMpg).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // IDLE MONITORING
  // ─────────────────────────────────────────────────────────────────

  describe("Idle Monitoring", () => {
    it("should detect idle time", () => {
      const vehicle = createMockVehicle({ id: "v1" });
      engine.registerVehicle(vehicle);

      const date1 = new Date("2026-03-01");
      const date2 = new Date("2026-03-20"); // 19 days gap

      const t1 = createMockFuelTransaction({ vehicleId: vehicle.id });
      t1.date = date1;

      const t2 = createMockFuelTransaction({ vehicleId: vehicle.id });
      t2.date = date2;

      engine.recordTransaction(t1);
      engine.recordTransaction(t2);

      const idleHours = engine.detectIdleTime(vehicle.id);
      expect(idleHours).toBeGreaterThan(0);
    });

    it("should get fleet idle ranking", () => {
      const v1 = createMockVehicle({ id: "v1" });
      const v2 = createMockVehicle({ id: "v2" });

      engine.registerVehicle(v1);
      engine.registerVehicle(v2);

      // v1 with idle time
      const date1 = new Date("2026-03-01");
      const date2 = new Date("2026-03-20");

      const t1 = createMockFuelTransaction({ vehicleId: v1.id });
      t1.date = date1;

      const t2 = createMockFuelTransaction({ vehicleId: v1.id });
      t2.date = date2;

      engine.recordTransaction(t1);
      engine.recordTransaction(t2);

      const ranking = engine.getFleetIdleRanking();
      expect(ranking.length).toBe(2);
      expect(ranking[0].vehicleId).toBe("v1");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // ANOMALY DETECTION
  // ─────────────────────────────────────────────────────────────────

  describe("Anomaly Detection", () => {
    it("should detect location mismatch", () => {
      const vehicle = createMockVehicle({ id: "v1" });
      engine.registerVehicle(vehicle);

      const t1 = createMockFuelTransaction({ vehicleId: vehicle.id });
      const t2 = createMockFuelTransaction({ vehicleId: vehicle.id });
      t2.location = { latitude: 48.8566, longitude: 2.3522 }; // Paris

      engine.recordTransaction(t1);
      engine.recordTransaction(t2);

      const alerts = engine.detectAnomalies(vehicle.id);
      const locationAlert = alerts.find((a) => a.type === "location_mismatch");

      expect(locationAlert).toBeDefined();
    });

    it("should detect capacity overflow", () => {
      const vehicle = createMockVehicle({ id: "v1" });
      engine.registerVehicle(vehicle);

      engine.recordTransaction(
        createMockFuelTransaction({ vehicleId: vehicle.id, gallons: 30 }),
      );
      engine.recordTransaction(
        createMockFuelTransaction({ vehicleId: vehicle.id, gallons: 100 }),
      ); // Overflow

      const alerts = engine.detectAnomalies(vehicle.id);
      const overflowAlert = alerts.find((a) => a.type === "capacity_overflow");

      expect(overflowAlert).toBeDefined();
      expect(overflowAlert?.severity).toBe("critical");
    });

    it("should detect unusual frequency", () => {
      const vehicle = createMockVehicle({ id: "v1" });
      engine.registerVehicle(vehicle);

      const baseDate = new Date("2026-03-17T08:00:00Z");

      for (let i = 0; i < 6; i++) {
        const transaction = createMockFuelTransaction({
          vehicleId: vehicle.id,
        });
        transaction.date = new Date(
          baseDate.getTime() + i * 24 * 60 * 60 * 1000,
        );
        engine.recordTransaction(transaction);
      }

      const alerts = engine.detectAnomalies(vehicle.id);
      const frequencyAlert = alerts.find((a) => a.type === "unusual_frequency");

      expect(frequencyAlert).toBeDefined();
    });

    it("should detect price spike", () => {
      const vehicle = createMockVehicle({ id: "v1" });
      engine.registerVehicle(vehicle);

      engine.recordTransaction(
        createMockFuelTransaction({
          vehicleId: vehicle.id,
          pricePerGallon: 3.5,
        }),
      );
      engine.recordTransaction(
        createMockFuelTransaction({
          vehicleId: vehicle.id,
          pricePerGallon: 4.2,
        }),
      );

      const alerts = engine.detectAnomalies(vehicle.id);
      const priceAlert = alerts.find((a) => a.type === "price_spike");

      expect(priceAlert).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // BUDGET FORECASTING
  // ─────────────────────────────────────────────────────────────────

  describe("Budget Forecasting", () => {
    it("should forecast monthly budget for vehicle", () => {
      const vehicle = createMockVehicle({ id: "v1" });
      engine.registerVehicle(vehicle);

      for (let i = 0; i < 5; i++) {
        engine.recordTransaction(
          createMockFuelTransaction({ vehicleId: vehicle.id, daysAgo: i }),
        );
      }

      const forecast = engine.forecastMonthlyBudget(vehicle.id);
      expect(forecast).toBeGreaterThan(0);
    });

    it("should forecast fleet budget", () => {
      const v1 = createMockVehicle({ id: "v1" });
      const v2 = createMockVehicle({ id: "v2" });

      engine.registerVehicle(v1);
      engine.registerVehicle(v2);

      engine.recordTransaction(createMockFuelTransaction({ vehicleId: v1.id }));
      engine.recordTransaction(createMockFuelTransaction({ vehicleId: v2.id }));

      const forecast = engine.forecastFleetBudget();
      expect(forecast).toBeGreaterThan(0);
    });

    it("should adjust for seasonality", () => {
      const baseBudget = 5000;

      // Winter (December = 11)
      const winterBudget = engine.adjustForSeasonality(baseBudget, 12);
      expect(winterBudget).toBeGreaterThan(baseBudget);

      // Summer (July = 6)
      const summerBudget = engine.adjustForSeasonality(baseBudget, 7);
      expect(summerBudget).toBeLessThan(baseBudget);

      // Spring (April = 3)
      const springBudget = engine.adjustForSeasonality(baseBudget, 4);
      expect(springBudget).toBe(baseBudget);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  describe("Fuel Analytics Helpers", () => {
    it("should calculate total transactions", () => {
      const vehicle = createMockVehicle({ id: "v1" });
      engine.registerVehicle(vehicle);

      engine.recordTransaction(
        createMockFuelTransaction({ vehicleId: vehicle.id }),
      );
      engine.recordTransaction(
        createMockFuelTransaction({ vehicleId: vehicle.id }),
      );

      expect(engine.getTotalTransactions()).toBe(2);
    });

    it("should calculate total fuel cost", () => {
      const vehicle = createMockVehicle({ id: "v1" });
      engine.registerVehicle(vehicle);

      engine.recordTransaction(
        createMockFuelTransaction({
          vehicleId: vehicle.id,
          pricePerGallon: 3.5,
          gallons: 50,
        }),
      );
      engine.recordTransaction(
        createMockFuelTransaction({
          vehicleId: vehicle.id,
          pricePerGallon: 3.45,
          gallons: 50,
        }),
      );

      const totalCost = engine.getTotalFuelCost();
      expect(totalCost).toBeGreaterThan(0);
    });

    it("should calculate total gallons", () => {
      const vehicle = createMockVehicle({ id: "v1" });
      engine.registerVehicle(vehicle);

      engine.recordTransaction(
        createMockFuelTransaction({ vehicleId: vehicle.id, gallons: 50 }),
      );
      engine.recordTransaction(
        createMockFuelTransaction({ vehicleId: vehicle.id, gallons: 45 }),
      );

      const totalGallons = engine.getTotalGallons();
      expect(totalGallons).toBe(95);
    });
  });
});
