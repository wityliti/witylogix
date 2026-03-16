/**
 * Demand Forecaster Tests
 *
 * Tests for:
 * - Time series analysis and anomaly detection
 * - Seasonal decomposition (weekly, monthly, yearly)
 * - Trend detection and acceleration
 * - Demand prediction with confidence intervals
 * - External factor application (holidays, promotions)
 * - SKU clustering
 * - Reorder suggestions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDemandForecaster,
  TimeSeriesAnalyzer,
  SeasonalDecomposer,
  TrendDetector,
  DemandPredictor,
  ReorderSuggester,
  SKUClusterer,
  type SalesDataPoint,
  type ExternalFactor,
} from '../demand-forecaster.js';

describe('Demand Forecaster', () => {
  let forecaster = createDemandForecaster();
  let historicalData: SalesDataPoint[];

  beforeEach(() => {
    forecaster = createDemandForecaster();

    // Create 60 days of historical sales data with weekly pattern
    historicalData = [];
    const baseDate = new Date('2026-01-01');

    for (let i = 0; i < 60; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);

      const dow = date.getDay();
      const isWeekend = dow === 0 || dow === 6;

      // Weekly pattern: higher sales on weekdays
      const weeklyMultiplier = isWeekend ? 0.6 : 1.2;
      const baseQuantity = 100;
      const quantity = Math.round(baseQuantity * weeklyMultiplier + Math.random() * 20);

      historicalData.push({
        date,
        quantity,
        dayOfWeek: dow,
        isWeekend,
        isHoliday: false,
        isPromotion: false,
      });
    }
  });

  describe('TimeSeriesAnalyzer', () => {
    it('should detect anomalies in data', () => {
      const analyzer = new TimeSeriesAnalyzer();
      const dataWithAnomaly = [...historicalData];

      // Add anomaly
      dataWithAnomaly[30].quantity = 500; // Much higher than normal

      const anomalies = analyzer.detectAnomalies(dataWithAnomaly, 2);

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies).toContain(30);
    });

    it('should return clean data without anomalies', () => {
      const analyzer = new TimeSeriesAnalyzer();
      const dataWithAnomaly = [...historicalData];

      dataWithAnomaly[30].quantity = 500;

      const cleanData = analyzer.getCleanData(dataWithAnomaly);

      expect(cleanData.length).toBeLessThan(dataWithAnomaly.length);
      expect(cleanData.every((d) => d.quantity < 300)).toBe(true);
    });
  });

  describe('SeasonalDecomposer', () => {
    it('should extract weekly seasonality', () => {
      const decomposer = new SeasonalDecomposer();
      const pattern = decomposer.extractSeasonality(historicalData);

      expect(pattern.weeklyPattern.size).toBeGreaterThan(0);
      expect(pattern.weeklyStrength).toBeGreaterThan(0);

      // Weekday should have higher multiplier than weekend
      const weekdayAvg =
        (pattern.weeklyPattern.get(1) ?? 1 +
          pattern.weeklyPattern.get(2) ?? 1 +
          pattern.weeklyPattern.get(3) ?? 1) /
        3;
      const weekendAvg =
        (pattern.weeklyPattern.get(0) ?? 1 + pattern.weeklyPattern.get(6) ?? 1) / 2;

      expect(weekdayAvg).toBeGreaterThan(weekendAvg);
    });

    it('should extract monthly seasonality', () => {
      const decomposer = new SeasonalDecomposer();
      const pattern = decomposer.extractSeasonality(historicalData);

      expect(pattern.monthlyPattern.size).toBeGreaterThan(0);
    });

    it('should extract yearly seasonality', () => {
      const decomposer = new SeasonalDecomposer();
      const pattern = decomposer.extractSeasonality(historicalData);

      expect(pattern.yearlyPattern.size).toBeGreaterThan(0);
    });

    it('should handle insufficient data', () => {
      const decomposer = new SeasonalDecomposer();
      const shortData = historicalData.slice(0, 3);

      const pattern = decomposer.extractSeasonality(shortData);

      expect(pattern).toBeDefined();
      expect(pattern.weeklyStrength).toBe(0);
    });
  });

  describe('TrendDetector', () => {
    it('should detect increasing trend', () => {
      const detector = new TrendDetector();

      // Create data with increasing trend
      const trendData = historicalData.map((d, i) => ({
        ...d,
        quantity: 100 + i * 2, // +2 per day
      }));

      const trend = detector.detectTrend(trendData);

      expect(trend.direction).toBe('increasing');
      expect(trend.slope).toBeGreaterThan(0);
      expect(trend.strength).toBeGreaterThan(0.5);
    });

    it('should detect decreasing trend', () => {
      const detector = new TrendDetector();

      // Create data with decreasing trend
      const trendData = historicalData.map((d, i) => ({
        ...d,
        quantity: 200 - i * 2, // -2 per day
      }));

      const trend = detector.detectTrend(trendData);

      expect(trend.direction).toBe('decreasing');
      expect(trend.slope).toBeLessThan(0);
    });

    it('should detect stable trend', () => {
      const detector = new TrendDetector();

      // Create stable data
      const stableData = historicalData.map((d) => ({
        ...d,
        quantity: 100,
      }));

      const trend = detector.detectTrend(stableData);

      expect(trend.direction).toBe('stable');
      expect(Math.abs(trend.slope)).toBeLessThan(5);
    });

    it('should calculate acceleration', () => {
      const detector = new TrendDetector();

      const trendData = historicalData.map((d, i) => ({
        ...d,
        quantity: 100 + i * 2 + i * 0.5, // Accelerating growth
      }));

      const trend = detector.detectTrend(trendData);

      expect(trend.acceleration).toBeDefined();
    });
  });

  describe('DemandPredictor', () => {
    it('should predict demand for future date', () => {
      const predictor = new DemandPredictor();
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + 7);

      const forecast = predictor.predictDemand('sku_1', historicalData, forecastDate);

      expect(forecast.skuId).toBe('sku_1');
      expect(forecast.forecastedDemand).toBeGreaterThan(0);
      expect(forecast.confidence).toBeGreaterThan(0);
      expect(forecast.confidence).toBeLessThanOrEqual(1);
    });

    it('should provide confidence intervals', () => {
      const predictor = new DemandPredictor();
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + 7);

      const forecast = predictor.predictDemand('sku_1', historicalData, forecastDate);

      expect(forecast.confidenceInterval.lower).toBeLessThanOrEqual(forecast.forecastedDemand);
      expect(forecast.confidenceInterval.upper).toBeGreaterThanOrEqual(forecast.forecastedDemand);
    });

    it('should apply seasonality adjustment', () => {
      const predictor = new DemandPredictor();

      // Forecast for weekend vs weekday
      const fridayDate = new Date('2026-03-20'); // Friday
      const saturdayDate = new Date('2026-03-21'); // Saturday

      const fridayForecast = predictor.predictDemand('sku_1', historicalData, fridayDate);
      const saturdayForecast = predictor.predictDemand('sku_1', historicalData, saturdayDate);

      // Friday (weekday) should have higher forecast than Saturday (weekend)
      expect(fridayForecast.forecastedDemand).toBeGreaterThan(saturdayForecast.forecastedDemand);
    });

    it('should apply external factors', () => {
      const predictor = new DemandPredictor();
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + 7);

      const promotion: ExternalFactor = {
        date: forecastDate,
        type: 'promotion',
        impactMultiplier: 1.5,
        duration: 3,
        confidence: 0.9,
      };

      const forecastWithPromo = predictor.predictDemand('sku_1', historicalData, forecastDate, [
        promotion,
      ]);
      const forecastWithoutPromo = predictor.predictDemand('sku_1', historicalData, forecastDate);

      expect(forecastWithPromo.forecastedDemand).toBeGreaterThan(forecastWithoutPromo.forecastedDemand);
    });

    it('should handle empty historical data', () => {
      const predictor = new DemandPredictor();
      const forecastDate = new Date();

      const forecast = predictor.predictDemand('sku_1', [], forecastDate);

      expect(forecast.forecastedDemand).toBe(0);
      expect(forecast.confidence).toBe(0);
    });
  });

  describe('ReorderSuggester', () => {
    it('should suggest reorder quantity', () => {
      const suggester = new ReorderSuggester();

      const suggestion = suggester.suggestReorder(
        'sku_1',
        50, // current stock
        10, // avg daily demand
        7 // lead time days
      );

      expect(suggestion.suggestedReorderQuantity).toBeGreaterThan(0);
      expect(suggestion.reorderPoint).toBeGreaterThan(0);
      expect(suggestion.safetyStock).toBeGreaterThan(0);
    });

    it('should calculate urgency levels', () => {
      const suggester = new ReorderSuggester();

      // Critical stock
      const critical = suggester.suggestReorder('sku_1', 5, 10, 7);
      expect(critical.urgency).toBe('critical');

      // High stock (below reorder point but not critical)
      const high = suggester.suggestReorder('sku_1', 100, 10, 7);
      expect(['high', 'normal', 'low']).toContain(high.urgency);

      // Low urgency
      const low = suggester.suggestReorder('sku_1', 500, 10, 7);
      expect(low.urgency).toBe('low');
    });

    it('should predict days until stockout', () => {
      const suggester = new ReorderSuggester();

      const suggestion = suggester.suggestReorder('sku_1', 100, 10, 7);

      expect(suggestion.daysUntilStockout).toBe(10); // 100 / 10
    });

    it('should recommend reorder date', () => {
      const suggester = new ReorderSuggester();

      const suggestion = suggester.suggestReorder('sku_1', 100, 10, 7);

      expect(suggestion.recommendedReorderDate).toBeInstanceOf(Date);
      expect(suggestion.recommendedReorderDate.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('DemandForecasterService', () => {
    it('should forecast multiple days ahead', () => {
      const forecasts = forecaster.forecastMultipleDays('sku_1', historicalData, 7);

      expect(forecasts.length).toBe(7);
      expect(forecasts.every((f) => f.skuId === 'sku_1')).toBe(true);
    });

    it('should provide reorder suggestions', () => {
      const suggestion = forecaster.getReorderSuggestion(
        'sku_1',
        100,
        historicalData,
        7
      );

      expect(suggestion.skuId).toBe('sku_1');
      expect(suggestion.suggestedReorderQuantity).toBeGreaterThan(0);
    });

    it('should add external factors', () => {
      const holiday: ExternalFactor = {
        date: new Date('2026-03-17'),
        type: 'holiday',
        impactMultiplier: 0.5, // Lower demand on holiday
        duration: 1,
        confidence: 1,
      };

      forecaster.addExternalFactor(holiday);
      // No error should occur
      expect(true).toBe(true);
    });

    it('should analyze trends', () => {
      const trend = forecaster.getTrendAnalysis('sku_1', historicalData);

      expect(trend).toBeDefined();
      expect(trend.direction).toBeDefined();
      expect(trend.slope).toBeDefined();
    });

    it('should cluster SKUs', () => {
      const skuData = new Map<string, SalesDataPoint[]>([
        ['sku_1', historicalData],
        ['sku_2', historicalData],
        ['sku_3', historicalData],
      ]);

      const skuProperties = new Map([
        ['sku_1', { price: 50, category: 'electronics' }],
        ['sku_2', { price: 55, category: 'electronics' }],
        ['sku_3', { price: 200, category: 'furniture' }],
      ]);

      const clusters = forecaster.clusterSKUs(skuData, skuProperties);

      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters.every((c) => c.skuIds.length > 0)).toBe(true);
    });
  });

  describe('SKUClusterer', () => {
    it('should cluster SKUs by category and price', () => {
      const clusterer = new SKUClusterer();

      const skuData = new Map<string, SalesDataPoint[]>([
        ['sku_1', historicalData],
        ['sku_2', historicalData],
        ['sku_3', historicalData],
        ['sku_4', historicalData],
      ]);

      const skuProperties = new Map([
        ['sku_1', { price: 10, category: 'books' }],
        ['sku_2', { price: 15, category: 'books' }],
        ['sku_3', { price: 100, category: 'electronics' }],
        ['sku_4', { price: 500, category: 'electronics' }],
      ]);

      const clusters = clusterer.clusterSKUs(skuData, skuProperties);

      expect(clusters.length).toBeGreaterThanOrEqual(2);
      clusters.forEach((cluster) => {
        expect(cluster.skuIds.length).toBeGreaterThan(0);
        expect(cluster.clusterId).toBeDefined();
        expect(cluster.representativeSKU).toBeDefined();
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete forecasting workflow', () => {
      // 1. Forecast demand
      const forecasts = forecaster.forecastMultipleDays('sku_1', historicalData, 7);
      expect(forecasts.length).toBe(7);

      // 2. Get reorder suggestion based on forecast
      const avgForecastDemand = forecasts.reduce((a, b) => a + b.forecastedDemand, 0) / forecasts.length;
      const suggestion = forecaster.getReorderSuggestion('sku_1', 50, historicalData, 5);
      expect(suggestion.suggestedReorderQuantity).toBeGreaterThan(0);

      // 3. Analyze trend
      const trend = forecaster.getTrendAnalysis('sku_1', historicalData);
      expect(trend.direction).toBeDefined();
    });

    it('should apply multiple external factors', () => {
      const factors: ExternalFactor[] = [
        {
          date: new Date('2026-03-17'),
          type: 'holiday',
          impactMultiplier: 0.7,
          duration: 1,
          confidence: 0.9,
        },
        {
          date: new Date('2026-03-20'),
          type: 'promotion',
          impactMultiplier: 1.5,
          duration: 3,
          confidence: 0.95,
        },
      ];

      factors.forEach((f) => forecaster.addExternalFactor(f));

      const forecastDate = new Date('2026-03-20');
      const forecasts = forecaster.forecastMultipleDays('sku_1', historicalData, 5);

      expect(forecasts.length).toBeGreaterThan(0);
    });
  });
});
