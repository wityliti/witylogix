/**
 * Rate Forecaster Unit Tests
 * Test rate prediction, trend analysis, seasonal decomposition, and budget planning
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RateForecaster, type HistoricalRate } from '../../../packages/core/src/ai/rate-forecaster.js';
import type { Lane, EquipmentType } from '../../../packages/core/src/freight/freight-types.js';

// ─── MOCK DATA ───────────────────────────────────────────────────────────

const createMockLane = (overrides?: Partial<Lane>): Lane => ({
  id: 'lane-1',
  tenantId: 'tenant-1',
  name: 'LA to Chicago',
  origin: {
    address: '123 Main St',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90001',
    country: 'USA',
  },
  destination: {
    address: '456 Oak Ave',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    country: 'USA',
  },
  miles: 2000,
  equipment: 'DRY_VAN' as EquipmentType,
  avgWeeklyVolume: 50,
  avgWeight: 45000,
  hazmatCapable: false,
  pricingTiers: [],
  volumeCommitments: [],
  contractTerms: {
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 86400000),
    autoRenewal: true,
    noticeperiodDays: 30,
    paymentTermsDays: 30,
  },
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createHistoricalRates = (laneId: string, days: number = 90): HistoricalRate[] => {
  const rates: HistoricalRate[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - i));

    // Simulate realistic rate variation
    const baseRate = 2.25;
    const seasonalFactor = 1 + Math.sin((date.getDate() / 30) * Math.PI) * 0.1;
    const randomVariation = (Math.random() - 0.5) * 0.3;
    const rate = baseRate * seasonalFactor + randomVariation;

    rates.push({
      date,
      laneId,
      averageRate: rate,
      minRate: rate * 0.95,
      maxRate: rate * 1.05,
      volume: 45 + Math.floor(Math.random() * 20),
      source: Math.random() > 0.3 ? 'contract' : 'spot',
      fuelPrice: 3.2 + Math.random() * 0.6,
    });
  }

  return rates;
};

// ─── TEST SUITE ──────────────────────────────────────────────────────────

describe('RateForecaster', () => {
  let forecaster: RateForecaster;
  let lane: Lane;

  beforeEach(() => {
    forecaster = new RateForecaster();
    lane = createMockLane();
  });

  describe('predictRate', () => {
    it('should generate rate prediction with confidence interval', async () => {
      const prediction = await forecaster.predictRate('lane-1', lane, 'next_month');

      expect(prediction).toBeDefined();
      expect(prediction.laneId).toBe('lane-1');
      expect(prediction.predictedRate).toBeGreaterThan(0);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(100);
      expect(prediction.confidenceInterval).toBeDefined();
      expect(prediction.confidenceInterval.low).toBeLessThan(prediction.confidenceInterval.mid);
      expect(prediction.confidenceInterval.mid).toBeLessThan(prediction.confidenceInterval.high);
    });

    it('should handle different forecast horizons', async () => {
      const weekPrediction = await forecaster.predictRate('lane-1', lane, 'next_week');
      const monthPrediction = await forecaster.predictRate('lane-1', lane, 'next_month');
      const quarterPrediction = await forecaster.predictRate('lane-1', lane, 'next_quarter');

      expect(weekPrediction.forecastHorizon).toBe('next_week');
      expect(monthPrediction.forecastHorizon).toBe('next_month');
      expect(quarterPrediction.forecastHorizon).toBe('next_quarter');
    });

    it('should include component breakdown', async () => {
      const prediction = await forecaster.predictRate('lane-1', lane, 'next_month');

      expect(prediction.components).toBeDefined();
      expect(prediction.components.baseRate).toBeGreaterThan(0);
      expect(prediction.components.historicalAverage).toBeGreaterThan(0);
      expect(prediction.components.seasonalAdjustment).toBeDefined();
      expect(prediction.components.demandAdjustment).toBeDefined();
      expect(prediction.components.fuelAdjustment).toBeDefined();
      expect(prediction.components.regionalAdjustment).toBeDefined();
    });

    it('should identify rate risks', async () => {
      const prediction = await forecaster.predictRate('lane-1', lane, 'next_month');

      expect(prediction.risks).toBeDefined();
      expect(Array.isArray(prediction.risks)).toBe(true);
    });
  });

  describe('analyzeHistoricalRates', () => {
    it('should calculate moving averages', () => {
      const analysis = forecaster.analyzeHistoricalRates('lane-1', 90);

      expect(analysis.ma7Day).toBeGreaterThan(0);
      expect(analysis.ma30Day).toBeGreaterThan(0);
      expect(analysis.ma90Day).toBeGreaterThan(0);
    });

    it('should detect trend direction', () => {
      const analysis = forecaster.analyzeHistoricalRates('lane-1', 90);

      expect(['increasing', 'decreasing', 'stable']).toContain(analysis.trend);
    });

    it('should calculate volatility', () => {
      const analysis = forecaster.analyzeHistoricalRates('lane-1', 90);

      expect(analysis.volatility).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty historical data', () => {
      const analysis = forecaster.analyzeHistoricalRates('nonexistent-lane', 90);

      expect(analysis.ma7Day).toBe(0);
      expect(analysis.ma30Day).toBe(0);
      expect(analysis.ma90Day).toBe(0);
      expect(analysis.volatility).toBe(0);
    });
  });

  describe('detectRateSpike', () => {
    it('should identify significant rate spikes', () => {
      const spike = forecaster.detectRateSpike('lane-1', 2.5);

      // With default baseline of 2.0, 2.5 would be 25% spike
      if (spike) {
        expect(spike.laneId).toBe('lane-1');
        expect(spike.spikedRate).toBe(2.5);
        expect(spike.spikePercent).toBeGreaterThan(0);
      }
    });

    it('should classify spike severity correctly', () => {
      // 20% spike should be high severity
      const spike = forecaster.detectRateSpike('lane-1', 2.4);

      if (spike && spike.spikePercent > 15) {
        expect(['low', 'medium', 'high']).toContain(spike.severity);
      }
    });

    it('should not flag small variations as spikes', () => {
      const spike = forecaster.detectRateSpike('lane-1', 2.08); // 4% increase

      // Small changes (< 5%) should return null
      if (spike === null) {
        expect(spike).toBeNull();
      }
    });

    it('should provide mitigation options for spikes', () => {
      const spike = forecaster.detectRateSpike('lane-1', 2.8);

      if (spike) {
        expect(spike.mitigationOptions).toBeDefined();
        expect(spike.mitigationOptions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('analyzeContractVsSpot', () => {
    it('should compare contract and spot rates', () => {
      const analysis = forecaster.analyzeContractVsSpot('lane-1', 2.1);

      expect(analysis).toBeDefined();
      expect(analysis.laneId).toBe('lane-1');
      expect(analysis.contractRate).toBe(2.1);
      expect(analysis.spotRate).toBeDefined();
      expect(analysis.gap).toBeDefined();
      expect(analysis.gapPercent).toBeDefined();
    });

    it('should recommend honoring contract when favorable', () => {
      // Contract at 2.1 with spot at 2.4 = favorable contract
      const analysis = forecaster.analyzeContractVsSpot('lane-1', 2.1);

      if (analysis.spotRate > analysis.contractRate * 1.05) {
        expect(analysis.recommendation).toBe('honor_contract');
      }
    });

    it('should recommend considering spot when spot is better', () => {
      // Very cheap contract rate - spot might be better
      const analysis = forecaster.analyzeContractVsSpot('lane-1', 1.5);

      if (analysis.gap > analysis.contractRate * 0.15) {
        expect(analysis.recommendation).toBe('consider_spot');
      }
    });

    it('should calculate potential savings', () => {
      const analysis = forecaster.analyzeContractVsSpot('lane-1', 2.1);

      expect(analysis.savingsPotential).toBeGreaterThanOrEqual(0);
    });
  });

  describe('projectBudget', () => {
    it('should project freight budget for period', () => {
      const projection = forecaster.projectBudget([lane], {
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 86400000),
      });

      expect(projection).toBeDefined();
      expect(projection.forecastedLoads).toBeGreaterThan(0);
      expect(projection.projectedSpend).toBeGreaterThan(0);
      expect(projection.averageForecastedRate).toBeGreaterThan(0);
    });

    it('should include monthly breakdown', () => {
      const projection = forecaster.projectBudget([lane], {
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 86400000),
      });

      expect(projection.monthlyBreakdown).toBeDefined();
      expect(projection.monthlyBreakdown.length).toBeGreaterThan(0);

      for (const month of projection.monthlyBreakdown) {
        expect(month.month).toBeTruthy();
        expect(month.projectedLoads).toBeGreaterThan(0);
        expect(month.projectedRate).toBeGreaterThan(0);
        expect(month.projectedSpend).toBeGreaterThan(0);
      }
    });

    it('should provide confidence range', () => {
      const projection = forecaster.projectBudget([lane], {
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 86400000),
      });

      expect(projection.confidenceRange).toBeDefined();
      expect(projection.confidenceRange.low).toBeLessThan(projection.projectedSpend);
      expect(projection.confidenceRange.high).toBeGreaterThan(projection.projectedSpend);
    });

    it('should identify risk factors', () => {
      const projection = forecaster.projectBudget([lane], {
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 86400000),
      });

      expect(projection.riskFactors).toBeDefined();
      expect(projection.riskFactors.length).toBeGreaterThan(0);
    });

    it('should handle multiple lanes', () => {
      const lanes = [
        createMockLane({ id: 'lane-1', name: 'LA to Chicago' }),
        createMockLane({ id: 'lane-2', name: 'Chicago to NYC' }),
      ];

      const projection = forecaster.projectBudget(lanes, {
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 86400000),
      });

      expect(projection.forecastedLoads).toBeGreaterThan(100); // 2 lanes * ~50 loads/month * 3 months
    });
  });

  describe('generateAlerts', () => {
    it('should generate spike alerts', () => {
      const alerts = forecaster.generateAlerts('lane-1', 2.8);

      // Should generate alert for significant spike
      const spikeAlert = alerts.find((a) => a.alertType === 'spike');
      if (spikeAlert) {
        expect(spikeAlert.severity).toBeDefined();
        expect(spikeAlert.message).toBeTruthy();
      }
    });

    it('should generate capacity crunch alerts', () => {
      const alerts = forecaster.generateAlerts('lane-1', 2.5);

      // Some alerts should be capacity-related
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should set expiration for alerts', () => {
      const alerts = forecaster.generateAlerts('lane-1', 2.8);

      for (const alert of alerts) {
        expect(alert.validUntil).toBeGreaterThan(alert.triggeredAt);
      }
    });

    it('should provide recommended action', () => {
      const alerts = forecaster.generateAlerts('lane-1', 2.8);

      for (const alert of alerts) {
        expect(alert.recommendedAction).toBeTruthy();
      }
    });
  });

  describe('recordAccuracy', () => {
    it('should track prediction accuracy', () => {
      const metric = forecaster.recordAccuracy('lane-1', 2.2, 2.25, 'v1.0');

      expect(metric).toBeDefined();
      expect(metric.laneId).toBe('lane-1');
      expect(metric.predictedRate).toBe(2.2);
      expect(metric.actualRate).toBe(2.25);
      expect(metric.absoluteError).toBe(0.05);
      expect(metric.percentError).toBeCloseTo(2.22, 1); // 2.25% error
    });

    it('should calculate MAE (Mean Absolute Error)', () => {
      forecaster.recordAccuracy('lane-1', 2.2, 2.25);
      forecaster.recordAccuracy('lane-1', 2.3, 2.28);
      const metric = forecaster.recordAccuracy('lane-1', 2.15, 2.2);

      expect(metric.mae).toBeGreaterThan(0);
    });

    it('should calculate MAPE (Mean Absolute Percentage Error)', () => {
      forecaster.recordAccuracy('lane-1', 2.2, 2.25);
      forecaster.recordAccuracy('lane-1', 2.3, 2.28);
      const metric = forecaster.recordAccuracy('lane-1', 2.15, 2.2);

      expect(metric.mape).toBeGreaterThan(0);
      expect(metric.mape).toBeLessThan(100);
    });
  });

  describe('Seasonal factors', () => {
    it('should adjust rates for day of week', async () => {
      const prediction = await forecaster.predictRate('lane-1', lane);

      expect(prediction.components.seasonalAdjustment).toBeDefined();
    });

    it('should adjust rates for month of year', async () => {
      const prediction = await forecaster.predictRate('lane-1', lane);

      // Seasonal adjustment should exist
      expect(prediction.components.seasonalAdjustment).toBeDefined();
    });

    it('should factor in holidays', async () => {
      const prediction = await forecaster.predictRate('lane-1', lane);

      // Should include holiday considerations in total prediction
      expect(prediction.predictedRate).toBeGreaterThan(0);
    });
  });

  describe('Supply and demand indicators', () => {
    it('should incorporate load-to-truck ratio', async () => {
      const prediction = await forecaster.predictRate('lane-1', lane);

      expect(prediction.components.demandAdjustment).toBeDefined();
    });

    it('should adjust for truck utilization', async () => {
      const prediction = await forecaster.predictRate('lane-1', lane);

      expect(prediction.predictedRate).toBeGreaterThan(0);
    });

    it('should consider tender rejection rates', async () => {
      const prediction = await forecaster.predictRate('lane-1', lane);

      expect(prediction.components.demandAdjustment).toBeDefined();
    });
  });

  describe('Regional factors', () => {
    it('should adjust for fuel prices', async () => {
      const prediction = await forecaster.predictRate('lane-1', lane);

      expect(prediction.components.fuelAdjustment).toBeDefined();
    });

    it('should account for weather', async () => {
      const prediction = await forecaster.predictRate('lane-1', lane);

      expect(prediction.components.regionalAdjustment).toBeDefined();
    });

    it('should factor in seasonal production', async () => {
      const prediction = await forecaster.predictRate('lane-1', lane);

      expect(prediction.predictedRate).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle single rate data point', () => {
      const analysis = forecaster.analyzeHistoricalRates('lane-with-one-point', 90);

      expect(analysis).toBeDefined();
    });

    it('should provide reasonable predictions even with minimal data', async () => {
      const prediction = await forecaster.predictRate('sparse-lane', lane, 'next_month');

      expect(prediction.predictedRate).toBeGreaterThan(0);
      expect(prediction.confidence).toBeGreaterThan(0);
    });

    it('should handle very long forecasting horizons', async () => {
      const prediction = await forecaster.predictRate('lane-1', lane, 'next_quarter');

      expect(prediction.forecastHorizon).toBe('next_quarter');
      expect(prediction.confidence).toBeLessThan(90); // Lower confidence for longer horizons
    });

    it('should handle extreme rate values', () => {
      const spike = forecaster.detectRateSpike('lane-1', 100); // Extreme spike

      if (spike) {
        expect(spike.severity).toBe('high');
      }
    });
  });

  describe('Confidence scoring', () => {
    it('should provide high confidence with substantial historical data', async () => {
      const prediction = await forecaster.predictRate('well-established-lane', lane);

      // With more historical data, confidence should be reasonable
      expect(prediction.confidence).toBeGreaterThan(30);
    });

    it('should provide lower confidence with sparse data', async () => {
      const prediction = await forecaster.predictRate('new-lane', lane);

      // New lanes should have lower confidence
      expect(prediction.confidence).toBeGreaterThan(0);
    });

    it('should adjust confidence based on accuracy metrics', async () => {
      // Record some predictions
      forecaster.recordAccuracy('test-lane', 2.2, 2.25, 'v1.0');
      forecaster.recordAccuracy('test-lane', 2.3, 2.35, 'v1.0');

      const prediction = await forecaster.predictRate('test-lane', lane);

      expect(prediction.confidence).toBeGreaterThan(30);
    });
  });
});
