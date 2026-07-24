/**
 * Predictive Maintenance Unit Tests
 * Test component health scoring, failure probability calculation, alerts, and cost projection
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ComponentHealthModel,
  FailureProbabilityCalculator,
  RemainingUsefulLife,
  MaintenancePrioritizer,
  CostProjector,
  AlertGenerator,
  type ComponentHealth,
  type FailurePrediction,
  type MaintenanceAlert,
} from "../../../packages/core/src/ai/predictive-maintenance.js";

// ─── TEST DATA ──────────────────────────────────────────────────────────────

const createMockComponent = (
  overrides?: Partial<ComponentHealth>,
): ComponentHealth => ({
  componentId: "comp-001",
  type: "engine",
  healthStatus: "good",
  healthScore: 85,
  mileageSinceService: 5000,
  recommendedServiceInterval: 10000,
  ageDays: 365,
  expectedLifespanDays: 2555,
  lastServiceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  anomalies: [],
  ...overrides,
});

// ─── COMPONENT HEALTH MODEL TESTS ───────────────────────────────────────────

describe("ComponentHealthModel", () => {
  let model: ComponentHealthModel;

  beforeEach(() => {
    model = new ComponentHealthModel();
  });

  it("should calculate health score based on mileage and age", () => {
    const component = createMockComponent({
      mileageSinceService: 8000,
      recommendedServiceInterval: 10000,
      ageDays: 500,
      expectedLifespanDays: 2555,
    });

    const score = model.calculateHealthScore(component);

    expect(score).toBeGreaterThan(60);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("should return 'critical' status for score below 30", () => {
    const component = createMockComponent({
      mileageSinceService: 9500,
      recommendedServiceInterval: 10000,
      ageDays: 2500,
      expectedLifespanDays: 2555,
    });

    const score = model.calculateHealthScore(component);
    const status = model.getHealthStatus(score);

    expect(status).toBe("critical");
  });

  it("should return 'excellent' status for score >= 85", () => {
    const component = createMockComponent({
      mileageSinceService: 2000,
      recommendedServiceInterval: 10000,
      ageDays: 100,
      expectedLifespanDays: 2555,
    });

    const score = model.calculateHealthScore(component);
    const status = model.getHealthStatus(score);

    expect(status).toBe("excellent");
  });

  it("should track component health over time", () => {
    const component1 = createMockComponent({
      componentId: "comp-001",
      mileageSinceService: 5000,
    });
    const component2 = createMockComponent({
      componentId: "comp-001",
      mileageSinceService: 7000,
    });

    model.updateComponentHealth("vehicle-001", component1);
    const updated = model.updateComponentHealth("vehicle-001", component2);

    expect(updated.mileageSinceService).toBe(7000);
    expect(updated.healthScore).toBeLessThan(component1.healthScore);
  });

  it("should penalize components with anomalies", () => {
    const componentGood = createMockComponent({
      anomalies: [],
    });

    const componentBad = createMockComponent({
      anomalies: ["unusual_vibration", "low_pressure"],
    });

    const scoreGood = model.calculateHealthScore(componentGood);
    const scoreBad = model.calculateHealthScore(componentBad);

    expect(scoreGood).toBeGreaterThan(scoreBad);
  });
});

// ─── FAILURE PROBABILITY CALCULATOR TESTS ───────────────────────────────────

describe("FailureProbabilityCalculator", () => {
  let calculator: FailureProbabilityCalculator;

  beforeEach(() => {
    calculator = new FailureProbabilityCalculator();
  });

  it("should calculate failure probability below 50% for healthy component", () => {
    const component = createMockComponent({
      mileageSinceService: 2000,
      recommendedServiceInterval: 10000,
      ageDays: 300,
      expectedLifespanDays: 2555,
    });

    const prediction = calculator.calculateFailureProbability(
      component,
      "moderate",
      "highway",
      0.5,
    );

    expect(prediction.failureProbability).toBeLessThan(0.5);
    expect(prediction.daysUntilFailure).toBeGreaterThan(100);
  });

  it("should calculate high failure probability for overdue service", () => {
    const component = createMockComponent({
      mileageSinceService: 9500,
      recommendedServiceInterval: 10000,
      ageDays: 2400,
      expectedLifespanDays: 2555,
    });

    const prediction = calculator.calculateFailureProbability(
      component,
      "hot",
      "city",
      1.0,
    );

    expect(prediction.failureProbability).toBeGreaterThan(0.5);
    expect(prediction.daysUntilFailure).toBeLessThan(200);
  });

  it("should apply climate factor to failure probability", () => {
    const component = createMockComponent();

    const predictionModerate = calculator.calculateFailureProbability(
      component,
      "moderate",
      "highway",
      0.5,
    );
    const predictionHot = calculator.calculateFailureProbability(
      component,
      "hot",
      "highway",
      0.5,
    );

    expect(predictionHot.failureProbability).toBeGreaterThan(
      predictionModerate.failureProbability,
    );
  });

  it("should apply terrain factor to failure probability", () => {
    const component = createMockComponent();

    const predictionCity = calculator.calculateFailureProbability(
      component,
      "moderate",
      "city",
      0.5,
    );
    const predictionHighway = calculator.calculateFailureProbability(
      component,
      "moderate",
      "highway",
      0.5,
    );

    expect(predictionCity.failureProbability).toBeGreaterThan(
      predictionHighway.failureProbability,
    );
  });

  it("should cap failure probability at 95%", () => {
    const component = createMockComponent({
      mileageSinceService: 9900,
      ageDays: 2540,
      anomalies: ["critical_fault_1", "critical_fault_2", "critical_fault_3"],
    });

    const prediction = calculator.calculateFailureProbability(
      component,
      "hot",
      "city",
      1.0,
    );

    expect(prediction.failureProbability).toBeLessThanOrEqual(0.95);
  });
});

// ─── REMAINING USEFUL LIFE TESTS ────────────────────────────────────────────

describe("RemainingUsefulLife", () => {
  let rul: RemainingUsefulLife;

  beforeEach(() => {
    rul = new RemainingUsefulLife();
  });

  it("should estimate RUL for component at 50% degradation", () => {
    const component = createMockComponent({
      mileageSinceService: 5000,
      recommendedServiceInterval: 10000,
      ageDays: 1277, // 50% of 2555
      expectedLifespanDays: 2555,
    });

    const estimate = rul.estimateRUL(component, 200);

    expect(estimate.daysRemaining).toBeGreaterThan(500);
    expect(estimate.milesRemaining).toBeGreaterThan(0);
  });

  it("should return zero RUL for component at end of life", () => {
    const component = createMockComponent({
      mileageSinceService: 9800,
      recommendedServiceInterval: 10000,
      ageDays: 2540,
      expectedLifespanDays: 2555,
    });

    const estimate = rul.estimateRUL(component, 200);

    expect(estimate.daysRemaining).toBeLessThanOrEqual(0);
  });

  it("should calculate service due date in future", () => {
    const component = createMockComponent({
      mileageSinceService: 5000,
      recommendedServiceInterval: 10000,
    });

    const dueDate = rul.calculateServiceDueDate(component, 200);
    const today = new Date();

    expect(dueDate.getTime()).toBeGreaterThan(today.getTime());
  });

  it("should calculate degradation rate", () => {
    const component = createMockComponent({
      ageDays: 365,
    });

    const estimate = rul.estimateRUL(component, 200);

    expect(estimate.degradationRate).toBeGreaterThanOrEqual(0);
    expect(estimate.degradationRate).toBeLessThan(1);
  });
});

// ─── MAINTENANCE PRIORITIZER TESTS ──────────────────────────────────────────

describe("MaintenancePrioritizer", () => {
  let prioritizer: MaintenancePrioritizer;

  beforeEach(() => {
    prioritizer = new MaintenancePrioritizer();
  });

  it("should rank vehicles by urgency", () => {
    const reports = [
      {
        vehicleId: "v-001",
        vehicleNumber: "VH-001",
        overallHealthScore: 85,
        components: [],
        predictions: [
          {
            componentId: "brakes-001",
            componentType: "brakes" as const,
            failureProbability: 0.8,
            daysUntilFailure: 7,
            milesUntilFailure: 500,
            confidence: 0.9,
            factors: {
              mileageFactor: 1.5,
              ageFactor: 1.2,
              historicalFactor: 1.1,
              conditionFactor: 1.3,
              anomalyFactor: 1.2,
            },
          },
        ],
        riskLevel: "critical" as const,
        recommendedActions: [],
        lastUpdateDate: new Date(),
      },
      {
        vehicleId: "v-002",
        vehicleNumber: "VH-002",
        overallHealthScore: 50,
        components: [],
        predictions: [
          {
            componentId: "engine-001",
            componentType: "engine" as const,
            failureProbability: 0.3,
            daysUntilFailure: 60,
            milesUntilFailure: 5000,
            confidence: 0.85,
            factors: {
              mileageFactor: 1.2,
              ageFactor: 1.1,
              historicalFactor: 1.1,
              conditionFactor: 1.0,
              anomalyFactor: 1.0,
            },
          },
        ],
        riskLevel: "medium" as const,
        recommendedActions: [],
        lastUpdateDate: new Date(),
      },
    ];

    const ranked = prioritizer.rankVehiclesByUrgency(reports);

    expect(ranked[0].vehicleNumber).toBe("VH-001");
    expect(ranked[0].urgencyScore).toBeGreaterThan(ranked[1].urgencyScore);
  });

  it("should calculate higher priority for safety-critical components", () => {
    const brakePrediction: FailurePrediction = {
      componentId: "brakes-001",
      componentType: "brakes",
      failureProbability: 0.6,
      daysUntilFailure: 30,
      milesUntilFailure: 2000,
      confidence: 0.9,
      factors: {
        mileageFactor: 1.5,
        ageFactor: 1.2,
        historicalFactor: 1.1,
        conditionFactor: 1.3,
        anomalyFactor: 1.2,
      },
    };

    const hvacPrediction: FailurePrediction = {
      ...brakePrediction,
      componentType: "hvac",
    };

    const brakePriority = prioritizer.calculatePriority(brakePrediction, 800);
    const hvacPriority = prioritizer.calculatePriority(hvacPrediction, 800);

    expect(brakePriority).toBeGreaterThan(hvacPriority);
  });
});

// ─── COST PROJECTOR TESTS ───────────────────────────────────────────────────

describe("CostProjector", () => {
  let projector: CostProjector;

  beforeEach(() => {
    projector = new CostProjector();
  });

  it("should project zero cost for components not failing in window", () => {
    const predictions: FailurePrediction[] = [
      {
        componentId: "engine-001",
        componentType: "engine",
        failureProbability: 0.1,
        daysUntilFailure: 120,
        milesUntilFailure: 10000,
        confidence: 0.9,
        factors: {
          mileageFactor: 1.0,
          ageFactor: 1.0,
          historicalFactor: 1.0,
          conditionFactor: 1.0,
          anomalyFactor: 1.0,
        },
      },
    ];

    const projection = projector.projectCosts(predictions, 4); // 30 days

    expect(projection.totalProjectedCost).toBe(0);
  });

  it("should project costs for components failing in window", () => {
    const predictions: FailurePrediction[] = [
      {
        componentId: "brakes-001",
        componentType: "brakes",
        failureProbability: 0.8,
        daysUntilFailure: 14,
        milesUntilFailure: 1000,
        confidence: 0.95,
        factors: {
          mileageFactor: 1.5,
          ageFactor: 1.2,
          historicalFactor: 1.1,
          conditionFactor: 1.3,
          anomalyFactor: 1.2,
        },
      },
    ];

    const projection = projector.projectCosts(predictions, 4);

    expect(projection.totalProjectedCost).toBeGreaterThan(0);
    expect(projection.costByType.get("brakes")).toBeGreaterThan(0);
  });

  it("should return top 3 priority components", () => {
    const predictions: FailurePrediction[] = [
      {
        componentId: "brakes-001",
        componentType: "brakes",
        failureProbability: 0.9,
        daysUntilFailure: 10,
        milesUntilFailure: 500,
        confidence: 0.95,
        factors: {
          mileageFactor: 1.5,
          ageFactor: 1.2,
          historicalFactor: 1.1,
          conditionFactor: 1.3,
          anomalyFactor: 1.2,
        },
      },
      {
        componentId: "tires-001",
        componentType: "tires",
        failureProbability: 0.7,
        daysUntilFailure: 15,
        milesUntilFailure: 1000,
        confidence: 0.9,
        factors: {
          mileageFactor: 1.3,
          ageFactor: 1.1,
          historicalFactor: 1.1,
          conditionFactor: 1.2,
          anomalyFactor: 1.1,
        },
      },
    ];

    const projection = projector.projectCosts(predictions, 4);

    expect(projection.topThreePriority.length).toBeLessThanOrEqual(3);
  });
});

// ─── ALERT GENERATOR TESTS ──────────────────────────────────────────────────

describe("AlertGenerator", () => {
  let generator: AlertGenerator;

  beforeEach(() => {
    generator = new AlertGenerator();
  });

  it("should generate critical alert for high failure probability", () => {
    const predictions: FailurePrediction[] = [
      {
        componentId: "brakes-001",
        componentType: "brakes",
        failureProbability: 0.85,
        daysUntilFailure: 5,
        milesUntilFailure: 300,
        confidence: 0.95,
        factors: {
          mileageFactor: 1.5,
          ageFactor: 1.2,
          historicalFactor: 1.1,
          conditionFactor: 1.3,
          anomalyFactor: 1.2,
        },
      },
    ];

    const alerts = generator.generateAlerts(
      "vehicle-001",
      "VH-001",
      predictions,
    );

    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].severity).toBe("critical");
  });

  it("should generate urgent alert for imminent failure", () => {
    const predictions: FailurePrediction[] = [
      {
        componentId: "tires-001",
        componentType: "tires",
        failureProbability: 0.65,
        daysUntilFailure: 8,
        milesUntilFailure: 1000,
        confidence: 0.9,
        factors: {
          mileageFactor: 1.3,
          ageFactor: 1.1,
          historicalFactor: 1.1,
          conditionFactor: 1.2,
          anomalyFactor: 1.1,
        },
      },
    ];

    const alerts = generator.generateAlerts(
      "vehicle-002",
      "VH-002",
      predictions,
    );

    expect(alerts[0].severity).toBe("urgent");
  });

  it("should format alert message with deadline and cost", () => {
    const alert: MaintenanceAlert = {
      vehicleId: "v-001",
      vehicleNumber: "VH-001",
      componentType: "brakes",
      severity: "urgent",
      message: "Brake failure risk at 70%",
      recommendedAction: "Schedule maintenance within 1 week",
      schedulingDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      estimatedCost: 850,
      createdAt: new Date(),
    };

    const formatted = generator.formatAlertMessage(alert);

    expect(formatted).toContain("VH-001");
    expect(formatted).toContain("$850");
    expect(formatted).toContain("Schedule maintenance");
  });
});
