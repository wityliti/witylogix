/**
 * ETA Engine Tests
 *
 * Tests for the ML-powered traffic-aware ETA prediction engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ETAEngine } from '../eta-engine.js';
import type { HistoricalRoute, TrafficZone } from '../types.js';

describe('ETAEngine', () => {
  let engine: ETAEngine;

  beforeEach(() => {
    engine = new ETAEngine({
      enableTimeOfDay: true,
      enableDistance: true,
      enableHistorical: true,
      enableTraffic: true,
    });
  });

  it('should predict ETA for a delivery', () => {
    const prediction = engine.predictETA({
      origin: { lat: 40.7128, lng: -74.006 },
      destination: { lat: 40.758, lng: -73.9855 },
      distanceKm: 5.5,
      departureTime: new Date('2026-03-15T10:00:00'),
    });

    expect(prediction).toBeDefined();
    expect(prediction.prediction.expected).toBeDefined();
    expect(prediction.prediction.low).toBeDefined();
    expect(prediction.prediction.high).toBeDefined();
    expect(prediction.confidence).toBeGreaterThan(0);
    expect(prediction.confidence).toBeLessThanOrEqual(1);
  });

  it('should generate confidence intervals', () => {
    const prediction = engine.predictETA({
      origin: { lat: 40.7128, lng: -74.006 },
      destination: { lat: 40.758, lng: -73.9855 },
      distanceKm: 5.5,
      departureTime: new Date('2026-03-15T10:00:00'),
    });

    // Verify interval ordering
    expect(prediction.prediction.low.getTime()).toBeLessThanOrEqual(
      prediction.prediction.expected.getTime(),
    );
    expect(prediction.prediction.expected.getTime()).toBeLessThanOrEqual(
      prediction.prediction.high.getTime(),
    );
  });

  it('should adjust for time of day', () => {
    // Morning rush hour (7 AM)
    const rushPrediction = engine.predictETA({
      origin: { lat: 40.7128, lng: -74.006 },
      destination: { lat: 40.758, lng: -73.9855 },
      distanceKm: 5.5,
      departureTime: new Date('2026-03-15T07:00:00'),
    });

    // Night time (11 PM)
    const nightPrediction = engine.predictETA({
      origin: { lat: 40.7128, lng: -74.006 },
      destination: { lat: 40.758, lng: -73.9855 },
      distanceKm: 5.5,
      departureTime: new Date('2026-03-15T23:00:00'),
    });

    // Rush hour should have longer ETA
    expect(rushPrediction.prediction.expected.getTime()).toBeGreaterThan(
      nightPrediction.prediction.expected.getTime(),
    );
  });

  it('should adjust for distance', () => {
    // Short distance
    const shortPrediction = engine.predictETA({
      origin: { lat: 40.7128, lng: -74.006 },
      destination: { lat: 40.7150, lng: -74.0050 },
      distanceKm: 0.5,
      departureTime: new Date('2026-03-15T10:00:00'),
    });

    // Long distance
    const longPrediction = engine.predictETA({
      origin: { lat: 40.7128, lng: -74.006 },
      destination: { lat: 40.8, lng: -73.9 },
      distanceKm: 15,
      departureTime: new Date('2026-03-15T10:00:00'),
    });

    // Longer distance should have longer ETA
    expect(longPrediction.prediction.expected.getTime()).toBeGreaterThan(
      shortPrediction.prediction.expected.getTime(),
    );
  });

  it('should estimate traffic condition', () => {
    const prediction = engine.predictETA({
      origin: { lat: 40.7128, lng: -74.006 },
      destination: { lat: 40.758, lng: -73.9855 },
      distanceKm: 5.5,
      departureTime: new Date('2026-03-15T10:00:00'),
    });

    expect(['light', 'moderate', 'heavy', 'unknown']).toContain(
      prediction.trafficCondition,
    );
  });

  it('should load historical data', () => {
    const historicalData: HistoricalRoute[] = [
      {
        routeId: 'route_1',
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.758, lng: -73.9855 },
        distanceKm: 5.5,
        departureTime: new Date('2026-03-10T10:00:00'),
        estimatedArrival: new Date('2026-03-10T10:25:00'),
        actualArrival: new Date('2026-03-10T10:22:00'),
        dayOfWeek: 2,
        hourOfDay: 10,
        trafficCondition: 'moderate',
        zoneType: 'urban',
        driverId: 'driver_1',
        success: true,
      },
    ];

    engine.loadHistoricalData(historicalData);

    const prediction = engine.predictETA({
      origin: { lat: 40.7128, lng: -74.006 },
      destination: { lat: 40.758, lng: -73.9855 },
      distanceKm: 5.5,
      departureTime: new Date('2026-03-15T10:00:00'),
    });

    expect(prediction).toBeDefined();
    expect(prediction.modelsConsidered.length).toBeGreaterThan(0);
  });

  it('should register traffic zones', () => {
    const zones: TrafficZone[] = [
      {
        zoneId: 'zone_1',
        zoneName: 'Downtown',
        zoneType: 'urban',
        center: { lat: 40.7128, lng: -74.006 },
        boundingBox: {
          ne: { lat: 40.8, lng: -73.9 },
          sw: { lat: 40.6, lng: -74.1 },
        },
        averageSpeed: 25,
        peakHours: [7, 8, 17, 18],
      },
    ];

    engine.registerTrafficZones(zones);

    const prediction = engine.predictETA({
      origin: { lat: 40.7128, lng: -74.006 },
      destination: { lat: 40.758, lng: -73.9855 },
      distanceKm: 5.5,
      departureTime: new Date('2026-03-15T10:00:00'),
      zoneId: 'zone_1',
    });

    expect(prediction).toBeDefined();
  });

  it('should record actual deliveries for model training', () => {
    const prediction = engine.predictETA({
      origin: { lat: 40.7128, lng: -74.006 },
      destination: { lat: 40.758, lng: -73.9855 },
      distanceKm: 5.5,
      departureTime: new Date('2026-03-15T10:00:00'),
      orderId: 'order_1',
    });

    const actualTime = new Date('2026-03-15T10:18:00');
    engine.recordActualDelivery(prediction, actualTime);

    // Should not throw
    expect(prediction.orderId).toBe('order_1');
  });

  it('should get model accuracy metrics', () => {
    // Record some predictions
    const prediction = engine.predictETA({
      origin: { lat: 40.7128, lng: -74.006 },
      destination: { lat: 40.758, lng: -73.9855 },
      distanceKm: 5.5,
      departureTime: new Date('2026-03-15T10:00:00'),
    });

    engine.recordActualDelivery(
      prediction,
      new Date('2026-03-15T10:18:00'),
    );

    const accuracies = engine.getModelAccuracy();
    expect(Array.isArray(accuracies)).toBe(true);
  });

  it('should get specific model accuracy', () => {
    engine.recordActualDelivery(
      engine.predictETA({
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.758, lng: -73.9855 },
        distanceKm: 5.5,
        departureTime: new Date('2026-03-15T10:00:00'),
      }),
      new Date('2026-03-15T10:18:00'),
    );

    const accuracy = engine.getModelAccuracy('TimeOfDayModel');
    expect(Array.isArray(accuracy)).toBe(true);
  });

  it('should return statistics', () => {
    const stats = engine.getStatistics();

    expect(stats).toHaveProperty('registeredModels');
    expect(stats).toHaveProperty('enabledModels');
    expect(stats).toHaveProperty('predictionsRecorded');
    expect(stats).toHaveProperty('averageAccuracy');
    expect(stats.registeredModels).toBeGreaterThan(0);
  });

  it('should support batch predictions', () => {
    const response = engine.predictBatch({
      deliveries: [
        {
          orderId: 'order_1',
          origin: { lat: 40.7128, lng: -74.006 },
          destination: { lat: 40.758, lng: -73.9855 },
          departureTime: new Date('2026-03-15T10:00:00'),
        },
        {
          orderId: 'order_2',
          origin: { lat: 40.7, lng: -73.95 },
          destination: { lat: 40.75, lng: -73.9 },
          departureTime: new Date('2026-03-15T10:30:00'),
        },
      ],
    });

    expect(response.predictions.length).toBe(2);
    expect(response.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should allow disabling models', () => {
    const limitedEngine = new ETAEngine({
      enableTimeOfDay: true,
      enableDistance: true,
      enableHistorical: false,
      enableTraffic: false,
    });

    const prediction = limitedEngine.predictETA({
      origin: { lat: 40.7128, lng: -74.006 },
      destination: { lat: 40.758, lng: -73.9855 },
      distanceKm: 5.5,
      departureTime: new Date('2026-03-15T10:00:00'),
    });

    expect(prediction.modelsConsidered.length).toBeLessThanOrEqual(2);
  });

  it('should reset to defaults', () => {
    engine.reset();

    const stats = engine.getStatistics();
    expect(stats.predictionsRecorded).toBe(0);
  });
});
