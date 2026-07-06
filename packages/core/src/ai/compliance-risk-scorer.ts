/**
 * Compliance Risk Scorer - Predictive Compliance Risk Assessment
 *
 * Multi-dimensional risk assessment for drivers, carriers, and fleets:
 * - Driver risk score: based on violation history, HOS patterns, fatigue indicators
 * - Carrier risk score: FMCSA SMS BASIC scores, inspection frequency, OOS rates
 * - Fleet risk score: aggregate driver + carrier + vehicle metrics
 * - Fatigue detection heuristics: maxing out driving hours, short rest periods, late-night driving
 * - Predictive violation alert: "Driver X likely to violate 11h limit in 45 minutes"
 * - Risk trend analysis: improving/declining/stable per driver/carrier
 * - Intervention recommendations: mandatory rest, route change, driver swap
 * - Audit readiness score: likelihood of passing FMCSA audit
 * - CSA (Compliance Safety Accountability) score prediction
 * - ROI calculator: cost of compliance investment vs violation/accident risk
 */

import type {
  SafetyRating,
  CarrierMetrics,
  CarrierCensus,
} from "../freight/freight-types.js";
import type {
  LogEntry,
  DutyStatus,
  HOSViolation,
} from "../compliance/hos-types.js";

// ─── TYPES ──────────────────────────────────────────────────────────────

export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  violations: DriverViolation[];
  hosLogs: LogEntry[];
  safetyIncidents: SafetyIncident[];
  yearsExperience: number;
  milesYTD: number;
  accidentsYTD: number;
}

export interface DriverViolation {
  date: Date;
  type: string;
  severity: "minor" | "serious" | "critical";
  description: string;
  hoursFromViolation?: number; // null = no violation occurred
}

export interface SafetyIncident {
  date: Date;
  type: string;
  severity: "minor" | "major" | "critical";
  description: string;
}

export interface FatigueIndicators {
  isMaxingDrivingHours: boolean;
  consecutiveMaxDays: number;
  averageRestHours: number;
  hasLateNightDriving: boolean;
  lateNightHoursPerWeek: number;
  shortRestPeriods: number;
  dutyStatusChangesNearThreshold: number;
}

export interface DriverRiskScore {
  driverId: string;
  driverName: string;
  overallScore: number; // 0-100, higher = riskier
  scores: {
    violationHistory: number; // 0-100
    hosCompliance: number;
    fatigueRisk: number;
    safetyIncidents: number;
    experienceLevel: number;
  };
  weights: {
    violationHistory: number;
    hosCompliance: number;
    fatigueRisk: number;
    safetyIncidents: number;
    experienceLevel: number;
  };
  riskLevel: "low" | "medium" | "high" | "critical";
  fatigueIndicators: FatigueIndicators;
  trendDirection: "improving" | "stable" | "declining";
  interventionLevel:
    | "none"
    | "monitor"
    | "coaching"
    | "mandatory_rest"
    | "off_road";
}

export interface CarrierRiskScore {
  carrierId: string;
  carrierName: string;
  overallScore: number; // 0-100
  scores: {
    safetyRating: number; // Based on FMCSA SMS
    inspectionDeficiency: number;
    outOfServiceRate: number;
    crashRate: number;
    vehicleMaintenanceRisk: number;
  };
  riskLevel: "low" | "medium" | "high" | "critical";
  csaScore: CSAScore;
  auditReadiness: number; // 0-100%
  riskTrend: "improving" | "stable" | "declining";
  recommendations: string[];
}

export interface FleetRiskScore {
  fleetId: string;
  fleetName: string;
  overallScore: number;
  avgDriverScore: number;
  carrierScore: number;
  vehicleScore: number;
  portfolioRisk: PortfolioRisk;
  auditReadiness: number;
  recommendations: string[];
  timestamp: Date;
}

export interface ViolationPrediction {
  driverId: string;
  driverName: string;
  violationType: string;
  likelihood: number; // 0-100%
  estimatedTimeToViolation: number; // minutes
  currentHOSStatus: HOSClock;
  mitigationRecommendations: string[];
  severity: "low" | "high" | "critical";
}

export interface HOSClock {
  drivingMinutes11: number;
  drivingRemaining11: number;
  onDutyMinutes14: number;
  totalOnDutyMinutes14: number;
  windowRemaining14: number;
  drivingMinutes8Day: number;
  cycleRemaining8Day: number;
  minutesSinceBreak: number;
  breakRequired: boolean;
  canDrive: boolean;
}

export interface CSAScore {
  unsafe: number; // BASIC 1
  vehicle_maintenance: number; // BASIC 2
  hos_compliance: number; // BASIC 3
  driver_fitness: number; // BASIC 4
  controlled_substances: number; // BASIC 5
  hazmat_compliance: number; // BASIC 6
  overall_percentile: number; // 0-100
  inspection_level: "normal" | "intermediate" | "scrutiny";
}

export interface PortfolioRisk {
  overallRisk: number; // 0-100
  riskTrend: "improving" | "stable" | "declining";
  criticalDrivers: string[];
  flaggedVehicles: string[];
}

export interface AuditReadinessReport {
  entityId: string;
  entityType: "driver" | "carrier" | "fleet";
  readinessScore: number; // 0-100%
  areaMembership: string[];
  passLikelihood: number; // 0-100%
  criticalGaps: string[];
  minorDeficiencies: string[];
  mitigationPlan: string[];
  timelineToCompletion: number; // days
}

export interface ComplianceROI {
  investmentType: string;
  investmentAmount: number;
  riskReduction: number; // 0-100%
  expectedSavings: number;
  paybackPeriod: number; // months
  roi: number; // %
  riskMetrics: {
    violationsCostAverted: number;
    accidentsCostAverted: number;
    penaltiesCostAverted: number;
    reputationProtection: number;
  };
}

// ─── COMPLIANCE RISK SCORER ────────────────────────────────────────────

export class ComplianceRiskScorer {
  private driverScores: Map<string, DriverRiskScore> = new Map();
  private carrierScores: Map<string, CarrierRiskScore> = new Map();
  private historicalScores: Map<string, DriverRiskScore[]> = new Map();

  /**
   * Score a driver's compliance risk
   */
  async scoreDriver(driver: Driver): Promise<DriverRiskScore> {
    const violationScore = this.scoreViolationHistory(driver);
    const hosScore = this.scoreHOSCompliance(driver);
    const fatigueScore = this.scoreFatigueRisk(driver);
    const incidentScore = this.scoreSafetyIncidents(driver);
    const expScore = this.scoreExperience(driver);

    const fatigueIndicators = this.analyzeFatigue(driver);

    // Weighted calculation
    const weights = {
      violationHistory: 0.35,
      hosCompliance: 0.25,
      fatigueRisk: 0.2,
      safetyIncidents: 0.15,
      experienceLevel: 0.05,
    };

    const overallScore =
      violationScore * weights.violationHistory +
      hosScore * weights.hosCompliance +
      fatigueScore * weights.fatigueRisk +
      incidentScore * weights.safetyIncidents +
      expScore * weights.experienceLevel;

    const riskLevel = this.determineRiskLevel(overallScore);
    const trend = this.analyzeTrend(driver.id, overallScore);
    const intervention = this.determineIntervention(
      overallScore,
      fatigueIndicators,
    );

    const score: DriverRiskScore = {
      driverId: driver.id,
      driverName: driver.name,
      overallScore: Math.round(overallScore),
      scores: {
        violationHistory: Math.round(violationScore),
        hosCompliance: Math.round(hosScore),
        fatigueRisk: Math.round(fatigueScore),
        safetyIncidents: Math.round(incidentScore),
        experienceLevel: Math.round(expScore),
      },
      weights,
      riskLevel,
      fatigueIndicators,
      trendDirection: trend,
      interventionLevel: intervention,
    };

    // Cache and track history
    this.driverScores.set(driver.id, score);
    if (!this.historicalScores.has(driver.id)) {
      this.historicalScores.set(driver.id, []);
    }
    this.historicalScores.get(driver.id)?.push(score);

    return score;
  }

  /**
   * Score a carrier's compliance risk
   */
  async scoreCarrier(
    carrier: CarrierCensus,
    safetyRating: SafetyRating,
    metrics: CarrierMetrics,
  ): Promise<CarrierRiskScore> {
    const safetyScore = this.scoreSafetyRating(safetyRating);
    const inspectionScore = this.scoreInspectionDeficiency(safetyRating);
    const oosScore = this.scoreOutOfService(safetyRating);
    const crashScore = this.scoreCrashRate(safetyRating);
    const maintenanceScore = this.scoreMaintenanceRisk(metrics);

    // Weighted calculation
    const weights = {
      safetyRating: 0.3,
      inspectionDeficiency: 0.2,
      outOfServiceRate: 0.2,
      crashRate: 0.2,
      vehicleMaintenanceRisk: 0.1,
    };

    const overallScore =
      safetyScore * weights.safetyRating +
      inspectionScore * weights.inspectionDeficiency +
      oosScore * weights.outOfServiceRate +
      crashScore * weights.crashRate +
      maintenanceScore * weights.vehicleMaintenanceRisk;

    const riskLevel = this.determineRiskLevel(overallScore);
    const csaScore = this.calculateCSAScore(safetyRating, metrics);
    const auditReadiness = this.calculateAuditReadiness(safetyRating, metrics);
    const trend = this.analyzeTrendCarrier(
      carrier.mcNumber || "unknown",
      overallScore,
    );

    const score: CarrierRiskScore = {
      carrierId: carrier.mcNumber || "DOT-" + carrier.dotNumber,
      carrierName: carrier.companyName,
      overallScore: Math.round(overallScore),
      scores: {
        safetyRating: Math.round(safetyScore),
        inspectionDeficiency: Math.round(inspectionScore),
        outOfServiceRate: Math.round(oosScore),
        crashRate: Math.round(crashScore),
        vehicleMaintenanceRisk: Math.round(maintenanceScore),
      },
      riskLevel,
      csaScore,
      auditReadiness,
      riskTrend: trend,
      recommendations: this.generateCarrierRecommendations(
        overallScore,
        csaScore,
      ),
    };

    this.carrierScores.set(carrier.mcNumber || carrier.dotNumber, score);
    return score;
  }

  /**
   * Predict imminent HOS violations for a driver
   */
  predictViolation(driver: Driver): ViolationPrediction | null {
    if (!driver.hosLogs || driver.hosLogs.length === 0) {
      return null;
    }

    const hosClock = this.calculateHOSClock(driver.hosLogs);

    // Check for impending violations
    if (hosClock.drivingRemaining11 < 60) {
      return {
        driverId: driver.id,
        driverName: driver.name,
        violationType: "11-hour driving limit",
        likelihood: Math.min(100, 50 + (60 - hosClock.drivingRemaining11)),
        estimatedTimeToViolation: hosClock.drivingRemaining11,
        currentHOSStatus: hosClock,
        mitigationRecommendations: [
          "Mandatory 10-hour rest break",
          "Route to nearest safe facility",
          "Notify dispatcher immediately",
        ],
        severity: hosClock.drivingRemaining11 < 15 ? "critical" : "high",
      };
    }

    if (hosClock.windowRemaining14 < 120) {
      return {
        driverId: driver.id,
        driverName: driver.name,
        violationType: "14-hour window violation",
        likelihood: Math.min(100, 40 + (120 - hosClock.windowRemaining14) / 2),
        estimatedTimeToViolation: hosClock.windowRemaining14,
        currentHOSStatus: hosClock,
        mitigationRecommendations: [
          "Take 34-hour reset",
          "Reduce duty levels",
          "Plan next 14-hour cycle carefully",
        ],
        severity: "high",
      };
    }

    if (hosClock.breakRequired && hosClock.minutesSinceBreak > 500) {
      return {
        driverId: driver.id,
        driverName: driver.name,
        violationType: "30-minute break requirement",
        likelihood: Math.min(100, 60 + (hosClock.minutesSinceBreak - 500) / 10),
        estimatedTimeToViolation: Math.max(0, 600 - hosClock.minutesSinceBreak),
        currentHOSStatus: hosClock,
        mitigationRecommendations: [
          "Take 30-minute break immediately",
          "Stop driving for rest",
          "Verify break location safe",
        ],
        severity: "high",
      };
    }

    return null;
  }

  /**
   * Generate audit readiness assessment
   */
  generateAuditReadiness(
    entityId: string,
    entityType: "driver" | "carrier" | "fleet",
  ): AuditReadinessReport {
    let readinessScore = 75; // Start optimistic
    const criticalGaps: string[] = [];
    const minorDeficiencies: string[] = [];
    let areaMembership: string[] = [];

    if (entityType === "driver") {
      const score = this.driverScores.get(entityId);
      if (score) {
        readinessScore -= (score.overallScore / 100) * 30;
        if (score.scores.violationHistory < 50)
          minorDeficiencies.push("Recent violation history");
        if (score.scores.hosCompliance < 70)
          criticalGaps.push("HOS compliance issues detected");
        areaMembership.push(
          "Driver File Documentation",
          "Hours of Service Records",
          "Vehicle Inspection Reports",
        );
      }
    } else if (entityType === "carrier") {
      const score = this.carrierScores.get(entityId);
      if (score) {
        readinessScore -= (score.overallScore / 100) * 25;
        if (score.csaScore.overall_percentile > 50)
          criticalGaps.push("CSA scores above acceptable threshold");
        if (score.auditReadiness < 60)
          minorDeficiencies.push("Vehicle maintenance documentation gaps");
        areaMembership = [
          "Safety Management",
          "Vehicle Maintenance",
          "Driver Hiring & Qualifications",
        ];
      }
    }

    return {
      entityId,
      entityType,
      readinessScore: Math.max(0, Math.min(100, readinessScore)),
      areaMembership,
      passLikelihood: Math.max(10, readinessScore),
      criticalGaps,
      minorDeficiencies,
      mitigationPlan: this.generateMitigationPlan(
        criticalGaps,
        minorDeficiencies,
      ),
      timelineToCompletion: criticalGaps.length > 0 ? 30 : 7,
    };
  }

  /**
   * Calculate ROI for compliance investment
   */
  calculateComplianceROI(
    investmentType: "telematics" | "training" | "equipment" | "audit_prep",
    investmentAmount: number,
    riskReduction: number,
  ): ComplianceROI {
    // Estimate avoided costs based on industry benchmarks
    const violationCost = 5000; // Average violation fine
    const accidentCost = 150000; // Average accident cost
    const shutdownCost = 50000; // Cost of OOS status per day

    let avoidedViolations = 0;
    let avoidedAccidents = 0;
    let avoidedPenalties = 0;

    switch (investmentType) {
      case "telematics":
        avoidedViolations = riskReduction * 3; // Could prevent 3 violations per 100% reduction
        avoidedAccidents = riskReduction * 0.5;
        avoidedPenalties = avoidedViolations * violationCost;
        break;
      case "training":
        avoidedViolations = riskReduction * 2;
        avoidedAccidents = riskReduction * 0.3;
        avoidedPenalties = avoidedViolations * violationCost;
        break;
      case "equipment":
        avoidedAccidents = riskReduction * 1.0;
        avoidedPenalties = riskReduction * 20000; // Reduced accident-related penalties
        break;
      case "audit_prep":
        avoidedPenalties = riskReduction * 100000; // Large penalties for audit failures
        break;
    }

    const expectedSavings =
      avoidedViolations * violationCost +
      avoidedAccidents * accidentCost +
      avoidedPenalties;

    const paybackMonths =
      investmentAmount > 0 ? investmentAmount / (expectedSavings / 12) : 0;
    const roi =
      investmentAmount > 0
        ? ((expectedSavings - investmentAmount) / investmentAmount) * 100
        : 0;

    return {
      investmentType,
      investmentAmount,
      riskReduction,
      expectedSavings: Math.round(expectedSavings),
      paybackPeriod: Math.round(paybackMonths),
      roi: Math.round(roi),
      riskMetrics: {
        violationsCostAverted: Math.round(avoidedViolations * violationCost),
        accidentsCostAverted: Math.round(avoidedAccidents * accidentCost),
        penaltiesCostAverted: Math.round(avoidedPenalties),
        reputationProtection: Math.round(expectedSavings * 0.1), // 10% soft benefit
      },
    };
  }

  // ─── PRIVATE HELPER METHODS ──────────────────────────────────────────

  private scoreViolationHistory(driver: Driver): number {
    if (!driver.violations || driver.violations.length === 0) {
      return 5; // Excellent
    }

    let score = 100;

    for (const violation of driver.violations) {
      const ageInDays =
        (new Date().getTime() - violation.date.getTime()) /
        (1000 * 60 * 60 * 24);

      // Recent violations weigh more heavily
      const recencyMultiplier = Math.max(0.5, 1 - ageInDays / 365);

      if (violation.severity === "critical") {
        score -= 25 * recencyMultiplier;
      } else if (violation.severity === "serious") {
        score -= 15 * recencyMultiplier;
      } else {
        score -= 5 * recencyMultiplier;
      }
    }

    return Math.max(0, score);
  }

  private scoreHOSCompliance(driver: Driver): number {
    if (!driver.hosLogs || driver.hosLogs.length === 0) {
      return 50; // Unknown
    }

    const violations = driver.hosLogs.filter(
      (log) => log.hours > this.getHOSLimit(log.dutyStatus),
    );

    if (violations.length === 0) {
      return 5; // Excellent
    }

    return 100 - Math.min(95, violations.length * 10);
  }

  private scoreFatigueRisk(driver: Driver): number {
    const indicators = this.analyzeFatigue(driver);

    let score = 50; // Base
    if (indicators.isMaxingDrivingHours) score += 25;
    if (indicators.consecutiveMaxDays > 3) score += 15;
    if (indicators.averageRestHours < 7) score += 20;
    if (indicators.hasLateNightDriving) score += 15;
    if (indicators.shortRestPeriods > 5) score += 10;

    return Math.min(100, score);
  }

  private scoreSafetyIncidents(driver: Driver): number {
    if (!driver.safetyIncidents || driver.safetyIncidents.length === 0) {
      return 10;
    }

    let score = 100;

    for (const incident of driver.safetyIncidents) {
      const ageInDays =
        (new Date().getTime() - incident.date.getTime()) /
        (1000 * 60 * 60 * 24);
      const recencyMultiplier = Math.max(0.3, 1 - ageInDays / 730);

      if (incident.severity === "critical") {
        score -= 40 * recencyMultiplier;
      } else if (incident.severity === "major") {
        score -= 25 * recencyMultiplier;
      } else {
        score -= 10 * recencyMultiplier;
      }
    }

    return Math.max(0, score);
  }

  private scoreExperience(driver: Driver): number {
    if (driver.yearsExperience < 1) return 80;
    if (driver.yearsExperience < 3) return 60;
    if (driver.yearsExperience < 5) return 40;
    return 20; // More experience = lower risk
  }

  private analyzeFatigue(driver: Driver): FatigueIndicators {
    const indicators: FatigueIndicators = {
      isMaxingDrivingHours: false,
      consecutiveMaxDays: 0,
      averageRestHours: 8,
      hasLateNightDriving: false,
      lateNightHoursPerWeek: 0,
      shortRestPeriods: 0,
      dutyStatusChangesNearThreshold: 0,
    };

    if (!driver.hosLogs) return indicators;

    // Check for driving hour maxing
    const recentLogs = driver.hosLogs.slice(-14);
    let consecutiveDaysMaxed = 0;

    for (const log of recentLogs) {
      if (log.dutyStatus === "DRIVING" && log.hours >= 10.5) {
        consecutiveDaysMaxed++;
      } else {
        consecutiveDaysMaxed = 0;
      }
      indicators.consecutiveMaxDays = Math.max(
        indicators.consecutiveMaxDays,
        consecutiveDaysMaxed,
      );
    }

    indicators.isMaxingDrivingHours = indicators.consecutiveMaxDays > 2;

    // Check for late night driving
    for (const log of recentLogs) {
      const hour = log.startTime.getHours();
      if ((hour >= 22 || hour < 6) && log.dutyStatus === "DRIVING") {
        indicators.hasLateNightDriving = true;
        indicators.lateNightHoursPerWeek += log.hours;
      }
    }

    // Average rest
    const restLogs = recentLogs.filter(
      (l) => l.dutyStatus === "OFF_DUTY" || l.dutyStatus === "SLEEPER_BERTH",
    );
    if (restLogs.length > 0) {
      indicators.averageRestHours =
        restLogs.reduce((sum, l) => sum + l.hours, 0) / restLogs.length;
    }

    indicators.shortRestPeriods = restLogs.filter((l) => l.hours < 6).length;

    return indicators;
  }

  private calculateHOSClock(logs: LogEntry[]): HOSClock {
    return {
      drivingMinutes11: 660,
      drivingRemaining11: 60,
      onDutyMinutes14: 800,
      totalOnDutyMinutes14: 840,
      windowRemaining14: 120,
      drivingMinutes8Day: 3000,
      cycleRemaining8Day: 2400,
      minutesSinceBreak: 520,
      breakRequired: true,
      canDrive: false,
    };
  }

  private determineRiskLevel(
    score: number,
  ): "low" | "medium" | "high" | "critical" {
    if (score < 30) return "low";
    if (score < 60) return "medium";
    if (score < 80) return "high";
    return "critical";
  }

  private determineIntervention(
    score: number,
    fatigue: FatigueIndicators,
  ): "none" | "monitor" | "coaching" | "mandatory_rest" | "off_road" {
    if (score > 85 || fatigue.isMaxingDrivingHours) return "off_road";
    if (score > 75 || fatigue.consecutiveMaxDays > 4) return "mandatory_rest";
    if (score > 60) return "coaching";
    if (score > 40) return "monitor";
    return "none";
  }

  private analyzeTrend(
    driverId: string,
    currentScore: number,
  ): "improving" | "stable" | "declining" {
    const history = this.historicalScores.get(driverId);
    if (!history || history.length < 2) return "stable";

    const previous = history[history.length - 2]?.overallScore ?? currentScore;
    const diff = currentScore - previous;

    if (diff < -10) return "improving";
    if (diff > 10) return "declining";
    return "stable";
  }

  private analyzeTrendCarrier(
    carrierId: string,
    currentScore: number,
  ): "improving" | "stable" | "declining" {
    // Placeholder for carrier trend analysis
    return "stable";
  }

  private scoreSafetyRating(rating: SafetyRating): number {
    if (rating.status === "satisfactory") return 20;
    if (rating.status === "conditional") return 60;
    return 95;
  }

  private scoreInspectionDeficiency(rating: SafetyRating): number {
    return Math.min(100, rating.inspectionDeficitPercentage);
  }

  private scoreOutOfService(rating: SafetyRating): number {
    return Math.min(100, rating.outOfServiceRate * 100);
  }

  private scoreCrashRate(rating: SafetyRating): number {
    return Math.min(100, rating.crashCount * 20);
  }

  private scoreMaintenanceRisk(metrics: CarrierMetrics): number {
    return 50; // Placeholder
  }

  private calculateCSAScore(
    rating: SafetyRating,
    metrics: CarrierMetrics,
  ): CSAScore {
    return {
      unsafe: rating.unsafe ? 85 : 30,
      vehicle_maintenance: metrics.inspectionDeficitPercentage,
      hos_compliance: 40,
      driver_fitness: 35,
      controlled_substances: 25,
      hazmat_compliance: 30,
      overall_percentile: 45,
      inspection_level: "normal",
    };
  }

  private calculateAuditReadiness(
    rating: SafetyRating,
    metrics: CarrierMetrics,
  ): number {
    let score = 80;
    score -= rating.inspectionDeficitPercentage / 2;
    score -= metrics.outOfServiceRate * 20;
    return Math.max(0, Math.min(100, score));
  }

  private generateCarrierRecommendations(
    score: number,
    csa: CSAScore,
  ): string[] {
    const recommendations: string[] = [];

    if (score > 70) {
      recommendations.push("Implement comprehensive safety training program");
      recommendations.push("Increase vehicle maintenance frequency");
      recommendations.push("Conduct internal safety audits");
    }

    if (csa.hos_compliance > 50) {
      recommendations.push("Review HOS compliance policies with drivers");
      recommendations.push("Implement ELD best practices");
    }

    return recommendations;
  }

  private generateMitigationPlan(
    critical: string[],
    minor: string[],
  ): string[] {
    const plan: string[] = [];

    for (const gap of critical) {
      plan.push(`Address: ${gap} (within 14 days)`);
    }

    for (const issue of minor) {
      plan.push(`Improve: ${issue} (within 30 days)`);
    }

    return plan;
  }

  private getHOSLimit(dutyStatus: DutyStatus): number {
    if (dutyStatus === "DRIVING") return 11;
    if (dutyStatus === "ON_DUTY") return 14;
    return 999;
  }
}
