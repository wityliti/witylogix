/**
 * Analytics Anomaly Detector
 *
 * AI module for time series anomaly detection and analysis:
 * - TimeSeriesAnalyzer: Detect trends, seasonality, change-points
 * - AnomalyDetector: Z-score, IQR, isolation forest-inspired algorithms
 * - PatternRecognizer: Find recurring patterns, cycles, correlations
 * - ForecastEngine: Exponential smoothing, moving averages, projections
 * - AlertGenerator: Threshold-based, rate-of-change, comparative alerts
 * - RootCauseAnalyzer: Drill-down analysis, contribution, feature importance
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  dimension?: string; // For multi-dimensional metrics
  metadata?: Record<string, any>;
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable';
  slope: number; // units per day
  strength: number; // 0-1
  changePointDate?: Date;
  acceleration: number; // rate of change of slope
}

export interface SeasonalityInfo {
  hasSeasonality: boolean;
  period: number; // days
  strength: number; // 0-1
  pattern: Map<number, number>; // index -> multiplier
}

export interface Anomaly {
  timestamp: Date;
  value: number;
  expectedRange: { min: number; max: number };
  zScore: number;
  anomalyScore: number; // 0-1
  type: 'point' | 'contextual' | 'collective';
  severity: 'low' | 'medium' | 'high';
  explanation: string;
}

export interface RecurringPattern {
  patternId: string;
  period: number; // days
  occurrences: number;
  strength: number; // 0-1
  description: string;
  nextOccurrence?: Date;
}

export interface Forecast {
  timestamp: Date;
  predictedValue: number;
  confidenceInterval: { lower: number; upper: number };
  confidence: number; // 0-1
  method: string;
}

export interface Alert {
  alertId: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestedActions: string[];
  relatedAnomalies: string[];
}

export interface RootCauseAnalysis {
  primaryCause: string;
  contributionFactors: Array<{ factor: string; contribution: number }>;
  affectedDimensions: string[];
  timelineOfEvents: string[];
  recommendations: string[];
}

// ─── TIME SERIES ANALYZER ───────────────────────────────────────────────────

export class TimeSeriesAnalyzer {
  analyzeTrend(data: TimeSeriesDataPoint[]): TrendAnalysis {
    if (data.length < 2) {
      return {
        direction: 'stable',
        slope: 0,
        strength: 0,
        acceleration: 0,
      };
    }

    const sorted = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const values = sorted.map((d) => d.value);
    const timeDeltas = sorted.map((d, i) => {
      if (i === 0) return 0;
      return (d.timestamp.getTime() - sorted[i - 1].timestamp.getTime()) / (1000 * 86400);
    });

    const { slope, intercept } = this.linearRegression(values);
    const acceleration = this.calculateAcceleration(values);

    const trend = values[values.length - 1] - values[0];
    const direction = trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable';

    const strength = Math.min(1, Math.abs(slope) / Math.max(...values.map(Math.abs), 1));

    let changePointDate: Date | undefined;
    const changePoints = this.detectChangePoints(sorted);
    if (changePoints.length > 0) {
      changePointDate = changePoints[0].timestamp;
    }

    return {
      direction,
      slope,
      strength,
      changePointDate,
      acceleration,
    };
  }

  analyzeSeasonality(data: TimeSeriesDataPoint[]): SeasonalityInfo {
    if (data.length < 30) {
      return { hasSeasonality: false, period: 0, strength: 0, pattern: new Map() };
    }

    const sorted = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const values = sorted.map((d) => d.value);

    const periods = [7, 14, 30, 365]; // Daily, weekly, monthly, yearly
    let bestPeriod = 0;
    let bestScore = 0;

    periods.forEach((period) => {
      const score = this.calculateSeasonalityScore(values, period);
      if (score > bestScore) {
        bestScore = score;
        bestPeriod = period;
      }
    });

    const pattern = this.extractSeasonalPattern(values, bestPeriod);

    return {
      hasSeasonality: bestScore > 0.3,
      period: bestPeriod,
      strength: Math.min(1, bestScore),
      pattern,
    };
  }

  private calculateSeasonalityScore(values: number[], period: number): number {
    if (period > values.length / 2) return 0;

    const detrended = this.detrend(values);
    const seasonal: number[] = [];

    for (let i = 0; i < period; i++) {
      const indices = [];
      for (let j = i; j < detrended.length; j += period) {
        indices.push(detrended[j]);
      }

      if (indices.length > 0) {
        const mean = indices.reduce((a, b) => a + b, 0) / indices.length;
        seasonal[i] = mean;
      }
    }

    const seasonalVariance = this.calculateVariance(seasonal);
    const totalVariance = this.calculateVariance(detrended);

    return totalVariance > 0 ? Math.sqrt(seasonalVariance / totalVariance) : 0;
  }

  private extractSeasonalPattern(values: number[], period: number): Map<number, number> {
    const pattern = new Map<number, number>();
    const means: number[] = [];

    for (let i = 0; i < period; i++) {
      const indices = [];
      for (let j = i; j < values.length; j += period) {
        indices.push(values[j]);
      }
      if (indices.length > 0) {
        means.push(indices.reduce((a, b) => a + b) / indices.length);
      }
    }

    const overallMean = means.reduce((a, b) => a + b) / means.length;
    means.forEach((mean, i) => {
      pattern.set(i, mean / overallMean);
    });

    return pattern;
  }

  detectChangePoints(data: TimeSeriesDataPoint[]): TimeSeriesDataPoint[] {
    const values = data.map((d) => d.value);
    const sorted = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const changePoints: TimeSeriesDataPoint[] = [];
    const windowSize = Math.max(3, Math.floor(values.length / 10));

    for (let i = windowSize; i < values.length - windowSize; i++) {
      const before = values.slice(i - windowSize, i);
      const after = values.slice(i, i + windowSize);

      const meanBefore = before.reduce((a, b) => a + b) / before.length;
      const meanAfter = after.reduce((a, b) => a + b) / after.length;

      const change = Math.abs(meanAfter - meanBefore) / Math.max(meanBefore, 1);

      if (change > 0.3) {
        changePoints.push(sorted[i]);
      }
    }

    return changePoints;
  }

  private detrend(values: number[]): number[] {
    const { slope, intercept } = this.linearRegression(values);
    return values.map((v, i) => v - (intercept + slope * i));
  }

  private linearRegression(values: number[]): { slope: number; intercept: number } {
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      const x = i - xMean;
      const y = values[i] - yMean;
      numerator += x * y;
      denominator += x * x;
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = yMean - slope * xMean;

    return { slope, intercept };
  }

  private calculateAcceleration(values: number[]): number {
    const diffs1 = [];
    for (let i = 1; i < values.length; i++) {
      diffs1.push(values[i] - values[i - 1]);
    }

    const diffs2 = [];
    for (let i = 1; i < diffs1.length; i++) {
      diffs2.push(diffs1[i] - diffs1[i - 1]);
    }

    return diffs2.length > 0 ? diffs2.reduce((a, b) => a + b) / diffs2.length : 0;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => (v - mean) ** 2);
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }
}

// ─── ANOMALY DETECTOR ───────────────────────────────────────────────────────

export class AnomalyDetector {
  detectAnomalies(data: TimeSeriesDataPoint[], method: 'zscore' | 'iqr' | 'isolation' = 'zscore'): Anomaly[] {
    const sorted = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const values = sorted.map((d) => d.value);

    let anomalies: Anomaly[] = [];

    switch (method) {
      case 'zscore':
        anomalies = this.detectZScoreAnomalies(sorted, values);
        break;
      case 'iqr':
        anomalies = this.detectIQRAnomalies(sorted, values);
        break;
      case 'isolation':
        anomalies = this.detectIsolationAnomalies(sorted, values);
        break;
    }

    return anomalies;
  }

  private detectZScoreAnomalies(data: TimeSeriesDataPoint[], values: number[]): Anomaly[] {
    const mean = values.reduce((a, b) => a + b) / values.length;
    const std = Math.sqrt(values.reduce((sq, n) => sq + (n - mean) ** 2, 0) / values.length);

    const anomalies: Anomaly[] = [];

    values.forEach((value, i) => {
      const zScore = std === 0 ? 0 : (value - mean) / std;

      if (Math.abs(zScore) > 3) {
        anomalies.push({
          timestamp: data[i].timestamp,
          value,
          expectedRange: { min: mean - 3 * std, max: mean + 3 * std },
          zScore,
          anomalyScore: Math.min(1, Math.abs(zScore) / 5),
          type: 'point',
          severity: Math.abs(zScore) > 4 ? 'high' : 'medium',
          explanation: `Value ${value} is ${Math.abs(zScore).toFixed(1)} standard deviations from mean`,
        });
      }
    });

    return anomalies;
  }

  private detectIQRAnomalies(data: TimeSeriesDataPoint[], values: number[]): Anomaly[] {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const anomalies: Anomaly[] = [];

    values.forEach((value, i) => {
      if (value < lowerBound || value > upperBound) {
        const anomalyScore = Math.min(1, Math.abs(value - (value < lowerBound ? lowerBound : upperBound)) / (iqr || 1));

        anomalies.push({
          timestamp: data[i].timestamp,
          value,
          expectedRange: { min: lowerBound, max: upperBound },
          zScore: 0,
          anomalyScore,
          type: 'point',
          severity: anomalyScore > 0.7 ? 'high' : 'medium',
          explanation: `Value ${value} outside IQR bounds [${lowerBound.toFixed(0)}, ${upperBound.toFixed(0)}]`,
        });
      }
    });

    return anomalies;
  }

  private detectIsolationAnomalies(data: TimeSeriesDataPoint[], values: number[]): Anomaly[] {
    const mean = values.reduce((a, b) => a + b) / values.length;
    const std = Math.sqrt(values.reduce((sq, n) => sq + (n - mean) ** 2, 0) / values.length);

    const anomalies: Anomaly[] = [];
    const threshold = mean + 2.5 * std;

    values.forEach((value, i) => {
      const distance = Math.abs(value - mean);
      const anomalyScore = Math.min(1, distance / Math.max(threshold - mean, 1));

      if (anomalyScore > 0.6) {
        anomalies.push({
          timestamp: data[i].timestamp,
          value,
          expectedRange: { min: mean - 2.5 * std, max: mean + 2.5 * std },
          zScore: std === 0 ? 0 : (value - mean) / std,
          anomalyScore,
          type: distance > threshold ? 'point' : 'contextual',
          severity: anomalyScore > 0.8 ? 'high' : anomalyScore > 0.7 ? 'medium' : 'low',
          explanation: `Isolated value detected: ${value}`,
        });
      }
    });

    return anomalies;
  }
}

// ─── PATTERN RECOGNIZER ────────────────────────────────────────────────────

export class PatternRecognizer {
  findPatterns(data: TimeSeriesDataPoint[]): RecurringPattern[] {
    const sorted = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const patterns: RecurringPattern[] = [];

    // Detect daily patterns
    const dailyPattern = this.detectPeriodPattern(sorted, 1);
    if (dailyPattern) patterns.push(dailyPattern);

    // Detect weekly patterns
    const weeklyPattern = this.detectPeriodPattern(sorted, 7);
    if (weeklyPattern) patterns.push(weeklyPattern);

    // Detect monthly patterns
    const monthlyPattern = this.detectPeriodPattern(sorted, 30);
    if (monthlyPattern) patterns.push(monthlyPattern);

    return patterns.filter((p) => p.strength > 0.4);
  }

  private detectPeriodPattern(data: TimeSeriesDataPoint[], periodDays: number): RecurringPattern | null {
    const values = data.map((d) => d.value);
    const strength = this.calculatePatternStrength(values, periodDays);

    if (strength < 0.3) return null;

    let occurrences = 0;
    for (let i = periodDays; i < data.length; i += periodDays) {
      occurrences++;
    }

    const lastDate = data[data.length - 1].timestamp;
    const nextOccurrence = new Date(lastDate.getTime() + periodDays * 24 * 60 * 60 * 1000);

    return {
      patternId: `pattern_${periodDays}d_${Date.now()}`,
      period: periodDays,
      occurrences,
      strength,
      description: `Repeating pattern every ${periodDays} days`,
      nextOccurrence,
    };
  }

  private calculatePatternStrength(values: number[], period: number): number {
    const correlations: number[] = [];

    for (let lag = period; lag < values.length / 2; lag += period) {
      const correlation = this.calculateCorrelation(
        values.slice(0, values.length - lag),
        values.slice(lag)
      );
      correlations.push(Math.abs(correlation));
    }

    return correlations.length > 0 ? correlations.reduce((a, b) => a + b) / correlations.length : 0;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    const xMean = x.slice(0, n).reduce((a, b) => a + b) / n;
    const yMean = y.slice(0, n).reduce((a, b) => a + b) / n;

    let numerator = 0;
    let xSumSq = 0;
    let ySumSq = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      numerator += xDiff * yDiff;
      xSumSq += xDiff * xDiff;
      ySumSq += yDiff * yDiff;
    }

    const denominator = Math.sqrt(xSumSq * ySumSq);
    return denominator === 0 ? 0 : numerator / denominator;
  }
}

// ─── FORECAST ENGINE ────────────────────────────────────────────────────────

export class ForecastEngine {
  forecast(data: TimeSeriesDataPoint[], daysAhead: number = 7): Forecast[] {
    const sorted = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const values = sorted.map((d) => d.value);

    const forecasts: Forecast[] = [];
    const lastDate = sorted[sorted.length - 1].timestamp;

    // Use exponential smoothing
    const smoothed = this.exponentialSmoothing(values);
    const trend = this.calculateTrendComponent(values);

    for (let i = 1; i <= daysAhead; i++) {
      const timestamp = new Date(lastDate.getTime() + i * 24 * 60 * 60 * 1000);
      const predictedValue = smoothed[smoothed.length - 1] + trend * i;

      const std = Math.sqrt(
        values.reduce((sq, v) => sq + (v - smoothed[smoothed.length - 1]) ** 2, 0) / values.length
      );

      forecasts.push({
        timestamp,
        predictedValue,
        confidenceInterval: {
          lower: predictedValue - 1.96 * std,
          upper: predictedValue + 1.96 * std,
        },
        confidence: Math.max(0.5, 1 - i / (daysAhead * 2)),
        method: 'exponential_smoothing',
      });
    }

    return forecasts;
  }

  private exponentialSmoothing(values: number[], alpha: number = 0.3): number[] {
    const smoothed: number[] = [values[0]];

    for (let i = 1; i < values.length; i++) {
      smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
    }

    return smoothed;
  }

  private calculateTrendComponent(values: number[]): number {
    const n = Math.min(10, values.length);
    const recent = values.slice(-n);
    const { slope } = this.linearRegression(recent);
    return slope;
  }

  private linearRegression(values: number[]): { slope: number } {
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      const x = i - xMean;
      const y = values[i] - yMean;
      numerator += x * y;
      denominator += x * x;
    }

    return { slope: denominator === 0 ? 0 : numerator / denominator };
  }
}

// ─── ALERT GENERATOR ────────────────────────────────────────────────────────

export class AlertGenerator {
  generateAlerts(
    anomalies: Anomaly[],
    forecasts: Forecast[],
    thresholds: { warning: number; critical: number } = { warning: 80, critical: 95 }
  ): Alert[] {
    const alerts: Alert[] = [];

    // Threshold-based alerts
    anomalies.forEach((anomaly) => {
      if (anomaly.severity === 'high') {
        alerts.push({
          alertId: `alert_${Date.now()}_${Math.random()}`,
          timestamp: anomaly.timestamp,
          severity: 'critical',
          message: `Critical anomaly detected: ${anomaly.explanation}`,
          suggestedActions: [
            'Investigate root cause',
            'Check data source',
            'Review recent changes',
          ],
          relatedAnomalies: [],
        });
      } else if (anomaly.severity === 'medium') {
        alerts.push({
          alertId: `alert_${Date.now()}_${Math.random()}`,
          timestamp: anomaly.timestamp,
          severity: 'warning',
          message: `Anomaly detected: ${anomaly.explanation}`,
          suggestedActions: ['Monitor closely', 'Check related metrics'],
          relatedAnomalies: [],
        });
      }
    });

    // Rate-of-change alerts
    if (forecasts.length > 1) {
      const changeRate = (forecasts[1].predictedValue - forecasts[0].predictedValue) / forecasts[0].predictedValue;

      if (Math.abs(changeRate) > 0.3) {
        alerts.push({
          alertId: `alert_roc_${Date.now()}`,
          timestamp: new Date(),
          severity: Math.abs(changeRate) > 0.5 ? 'critical' : 'warning',
          message: `Rapid change detected: ${(changeRate * 100).toFixed(1)}% change expected`,
          suggestedActions: ['Review forecast', 'Check for external factors'],
          relatedAnomalies: [],
        });
      }
    }

    return alerts;
  }
}

// ─── ROOT CAUSE ANALYZER ────────────────────────────────────────────────────

export class RootCauseAnalyzer {
  analyze(
    anomalies: Anomaly[],
    dimensionalData: Record<string, TimeSeriesDataPoint[]>
  ): RootCauseAnalysis {
    const primaryAnomaly = anomalies[0];
    const affectedDimensions = this.identifyAffectedDimensions(primaryAnomaly, dimensionalData);
    const contributionFactors = this.calculateContributions(affectedDimensions, dimensionalData);

    return {
      primaryCause: this.inferPrimaryCause(affectedDimensions, contributionFactors),
      contributionFactors,
      affectedDimensions,
      timelineOfEvents: this.buildTimeline(anomalies),
      recommendations: this.generateRecommendations(affectedDimensions),
    };
  }

  private identifyAffectedDimensions(
    anomaly: Anomaly,
    dimensionalData: Record<string, TimeSeriesDataPoint[]>
  ): string[] {
    const affected: string[] = [];

    Object.entries(dimensionalData).forEach(([dimension, data]) => {
      const anomalyCount = data.filter(
        (d) => d.timestamp.getTime() === anomaly.timestamp.getTime() &&
        (d.value > anomaly.expectedRange.max || d.value < anomaly.expectedRange.min)
      ).length;

      if (anomalyCount > 0) {
        affected.push(dimension);
      }
    });

    return affected;
  }

  private calculateContributions(
    dimensions: string[],
    dimensionalData: Record<string, TimeSeriesDataPoint[]>
  ): Array<{ factor: string; contribution: number }> {
    const contributions: Array<{ factor: string; contribution: number }> = [];

    dimensions.forEach((dim) => {
      const data = dimensionalData[dim] || [];
      const variance = this.calculateVariance(data.map((d) => d.value));
      contributions.push({ factor: dim, contribution: Math.min(1, variance) });
    });

    return contributions.sort((a, b) => b.contribution - a.contribution);
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b) / values.length;
    return values.reduce((sq, v) => sq + (v - mean) ** 2, 0) / values.length;
  }

  private inferPrimaryCause(
    dimensions: string[],
    factors: Array<{ factor: string; contribution: number }>
  ): string {
    if (factors.length === 0) return 'Unknown cause';
    return `Primary cause likely in ${factors[0].factor} dimension`;
  }

  private buildTimeline(anomalies: Anomaly[]): string[] {
    return anomalies.map((a) => `${a.timestamp.toISOString()}: ${a.explanation}`);
  }

  private generateRecommendations(dimensions: string[]): string[] {
    return [
      `Investigate ${dimensions[0]} dimension`,
      'Review data quality and sources',
      'Check for external factors or events',
      'Consider correlation with other metrics',
    ];
  }
}

// ─── FACTORY EXPORTS ────────────────────────────────────────────────────────

export function createAnomalyDetector() {
  const analyzer = new TimeSeriesAnalyzer();
  const detector = new AnomalyDetector();
  const recognizer = new PatternRecognizer();
  const forecastEngine = new ForecastEngine();
  const alertGenerator = new AlertGenerator();
  const rootCauseAnalyzer = new RootCauseAnalyzer();

  return {
    analyzer,
    detector,
    recognizer,
    forecastEngine,
    alertGenerator,
    rootCauseAnalyzer,

    analyzeMetric(data: TimeSeriesDataPoint[]): {
      trend: TrendAnalysis;
      seasonality: SeasonalityInfo;
      anomalies: Anomaly[];
      patterns: RecurringPattern[];
      forecasts: Forecast[];
      alerts: Alert[];
    } {
      const trend = analyzer.analyzeTrend(data);
      const seasonality = analyzer.analyzeSeasonality(data);
      const anomalies = detector.detectAnomalies(data, 'zscore');
      const patterns = recognizer.findPatterns(data);
      const forecasts = forecastEngine.forecast(data, 7);
      const alerts = alertGenerator.generateAlerts(anomalies, forecasts);

      return {
        trend,
        seasonality,
        anomalies,
        patterns,
        forecasts,
        alerts,
      };
    },
  };
}
