/**
 * Provider Comparison Engine Tests
 *
 * Test scenarios:
 * - Multi-provider route comparison
 * - Provider ranking and scoring
 * - Cost analysis and recommendations
 * - Matrix comparison across providers
 * - Route type classification (urban/suburban/highway/multi-stop)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ProviderComparisonEngine,
  DEFAULT_COST_MODELS,
} from '../provider-comparison.js';
import type { RouteResponse, MatrixResponse } from '../types.js';
import type { HERESDKClient } from '../here-sdk-client.js';
import type { TomTomSDKClient } from '../tomtom-sdk-client.js';

describe('ProviderComparisonEngine', () => {
  let engine: ProviderComparisonEngine;
  let mockHEREClient: Partial<HERESDKClient>;
  let mockTomTomClient: Partial<TomTomSDKClient>;

  beforeEach(() => {
    engine = new ProviderComparisonEngine();

    // Create mock clients
    mockHEREClient = {
      route: vi.fn(),
      matrix: vi.fn(),
    };

    mockTomTomClient = {
      route: vi.fn(),
      matrix: vi.fn(),
    };

    // Register providers
    engine.registerProvider('here', mockHEREClient as HERESDKClient);
    engine.registerProvider('tomtom', mockTomTomClient as TomTomSDKClient);

    // Register cost models
    DEFAULT_COST_MODELS.forEach((model) => {
      engine.registerCostModel(model);
    });
  });

  describe('compareRoute', () => {
    it('should compare routes from multiple providers', async () => {
      const mockHEREResponse: RouteResponse = {
        distance_m: 2000,
        duration_s: 900,
        legs: [
          {
            distance_m: 2000,
            duration_s: 900,
            steps: [
              {
                distance_m: 500,
                duration_s: 200,
                instruction: 'Head north',
                start_location: { lat: 40.7128, lng: -74.006 },
                end_location: { lat: 40.714, lng: -73.99 },
              },
            ],
            start_location: { lat: 40.7128, lng: -74.006 },
            end_location: { lat: 40.7589, lng: -73.9851 },
          },
        ],
        polyline: 'test_polyline',
        bounds: {
          ne: { lat: 40.7589, lng: -73.9851 },
          sw: { lat: 40.7128, lng: -74.006 },
        },
      };

      const mockTomTomResponse: RouteResponse = {
        distance_m: 2100,
        duration_s: 950,
        legs: [
          {
            distance_m: 2100,
            duration_s: 950,
            steps: [
              {
                distance_m: 500,
                duration_s: 200,
                instruction: 'Head north on Broadway',
                start_location: { lat: 40.7128, lng: -74.006 },
                end_location: { lat: 40.714, lng: -73.99 },
              },
            ],
            start_location: { lat: 40.7128, lng: -74.006 },
            end_location: { lat: 40.7589, lng: -73.9851 },
          },
        ],
        polyline: 'test_polyline',
        bounds: {
          ne: { lat: 40.7589, lng: -73.9851 },
          sw: { lat: 40.7128, lng: -74.006 },
        },
      };

      vi.mocked(mockHEREClient.route as any).mockResolvedValueOnce(mockHEREResponse);
      vi.mocked(mockTomTomClient.route as any).mockResolvedValueOnce(mockTomTomResponse);

      const report = await engine.compareRoute({
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
      });

      expect(report.routes).toHaveLength(2);
      expect(report.routes[0].provider).toBe('here');
      expect(report.routes[1].provider).toBe('tomtom');

      // HERE should be cheaper (shorter distance)
      expect(report.routes[0].distance).toBeLessThan(report.routes[1].distance);

      // Check ranking
      expect(report.ranking).toHaveLength(2);
      expect(report.ranking[0].rank).toBe(1);
      expect(report.ranking[1].rank).toBe(2);

      // Check recommendations
      expect(report.recommendations.bestForSpeed).toBeDefined();
      expect(report.recommendations.bestOverall).toBeDefined();

      // Check summary
      expect(report.summary).toBeTruthy();
      expect(report.summary.length).toBeGreaterThan(0);
    });

    it('should classify urban routes', async () => {
      const shortRoute: RouteResponse = {
        distance_m: 5000, // 5km
        duration_s: 600,
        legs: [
          {
            distance_m: 5000,
            duration_s: 600,
            steps: [],
            start_location: { lat: 40.7128, lng: -74.006 },
            end_location: { lat: 40.7200, lng: -74.0 },
          },
        ],
        polyline: 'test',
        bounds: {
          ne: { lat: 40.7200, lng: -74.0 },
          sw: { lat: 40.7128, lng: -74.006 },
        },
      };

      vi.mocked(mockHEREClient.route as any).mockResolvedValueOnce(shortRoute);
      vi.mocked(mockTomTomClient.route as any).mockResolvedValueOnce(shortRoute);

      const report = await engine.compareRoute({
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7200, lng: -74.0 },
      });

      expect(report.routeType).toBe('urban');
    });

    it('should classify highway routes', async () => {
      const longRoute: RouteResponse = {
        distance_m: 150000, // 150km
        duration_s: 5400,
        legs: [
          {
            distance_m: 150000,
            duration_s: 5400,
            steps: [],
            start_location: { lat: 40.7128, lng: -74.006 },
            end_location: { lat: 42.6526, lng: -73.7562 },
          },
        ],
        polyline: 'test',
        bounds: {
          ne: { lat: 42.6526, lng: -73.7562 },
          sw: { lat: 40.7128, lng: -74.006 },
        },
      };

      vi.mocked(mockHEREClient.route as any).mockResolvedValueOnce(longRoute);
      vi.mocked(mockTomTomClient.route as any).mockResolvedValueOnce(longRoute);

      const report = await engine.compareRoute({
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 42.6526, lng: -73.7562 },
      });

      expect(report.routeType).toBe('highway');
    });

    it('should classify multi-stop routes', async () => {
      const routeResponse: RouteResponse = {
        distance_m: 5000,
        duration_s: 600,
        legs: [
          {
            distance_m: 2000,
            duration_s: 300,
            steps: [],
            start_location: { lat: 40.7128, lng: -74.006 },
            end_location: { lat: 40.7200, lng: -74.0 },
          },
          {
            distance_m: 3000,
            duration_s: 300,
            steps: [],
            start_location: { lat: 40.7200, lng: -74.0 },
            end_location: { lat: 40.7300, lng: -74.05 },
          },
        ],
        polyline: 'test',
        bounds: {
          ne: { lat: 40.7300, lng: -74.05 },
          sw: { lat: 40.7128, lng: -74.006 },
        },
      };

      vi.mocked(mockHEREClient.route as any).mockResolvedValueOnce(routeResponse);
      vi.mocked(mockTomTomClient.route as any).mockResolvedValueOnce(routeResponse);

      const report = await engine.compareRoute({
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7300, lng: -74.05 },
        waypoints: [{ lat: 40.7200, lng: -74.0 }],
      });

      expect(report.routeType).toBe('multi-stop');
    });

    it('should handle provider failures gracefully', async () => {
      vi.mocked(mockHEREClient.route as any).mockRejectedValueOnce(
        new Error('HERE API error'),
      );

      const mockTomTomResponse: RouteResponse = {
        distance_m: 2000,
        duration_s: 900,
        legs: [
          {
            distance_m: 2000,
            duration_s: 900,
            steps: [],
            start_location: { lat: 40.7128, lng: -74.006 },
            end_location: { lat: 40.7589, lng: -73.9851 },
          },
        ],
        polyline: 'test',
        bounds: {
          ne: { lat: 40.7589, lng: -73.9851 },
          sw: { lat: 40.7128, lng: -74.006 },
        },
      };

      vi.mocked(mockTomTomClient.route as any).mockResolvedValueOnce(mockTomTomResponse);

      const report = await engine.compareRoute({
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
      });

      // Should only have TomTom result
      expect(report.routes).toHaveLength(1);
      expect(report.routes[0].provider).toBe('tomtom');
    });

    it('should calculate quality scores', async () => {
      const response: RouteResponse = {
        distance_m: 2000,
        duration_s: 900,
        legs: [
          {
            distance_m: 2000,
            duration_s: 900,
            steps: [],
            start_location: { lat: 40.7128, lng: -74.006 },
            end_location: { lat: 40.7589, lng: -73.9851 },
          },
        ],
        polyline: 'test',
        bounds: {
          ne: { lat: 40.7589, lng: -73.9851 },
          sw: { lat: 40.7128, lng: -74.006 },
        },
      };

      vi.mocked(mockHEREClient.route as any).mockResolvedValueOnce(response);
      vi.mocked(mockTomTomClient.route as any).mockResolvedValueOnce({
        ...response,
        distance_m: 2000, // Same distance
        duration_s: 900, // Same duration
      });

      const report = await engine.compareRoute({
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
      });

      // Both should have high quality scores since they match
      expect(report.routes[0].quality).toBeGreaterThan(85);
      expect(report.routes[1].quality).toBeGreaterThan(85);
    });

    it('should provide cost analysis', async () => {
      const response: RouteResponse = {
        distance_m: 2000,
        duration_s: 900,
        legs: [
          {
            distance_m: 2000,
            duration_s: 900,
            steps: [],
            start_location: { lat: 40.7128, lng: -74.006 },
            end_location: { lat: 40.7589, lng: -73.9851 },
          },
        ],
        polyline: 'test',
        bounds: {
          ne: { lat: 40.7589, lng: -73.9851 },
          sw: { lat: 40.7128, lng: -74.006 },
        },
      };

      vi.mocked(mockHEREClient.route as any).mockResolvedValueOnce(response);
      vi.mocked(mockTomTomClient.route as any).mockResolvedValueOnce(response);

      const report = await engine.compareRoute({
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
      });

      expect(report.costAnalysis).toBeDefined();
      expect(report.costAnalysis?.cheapest).toBeTruthy();
      expect(report.costAnalysis?.costPerRequest).toBeDefined();
      expect(report.costAnalysis?.monthlySavings).toBeGreaterThanOrEqual(0);
    });

    it('should generate recommendations', async () => {
      const hereResponse: RouteResponse = {
        distance_m: 2000,
        duration_s: 800, // Faster
        legs: [
          {
            distance_m: 2000,
            duration_s: 800,
            steps: [],
            start_location: { lat: 40.7128, lng: -74.006 },
            end_location: { lat: 40.7589, lng: -73.9851 },
          },
        ],
        polyline: 'test',
        bounds: {
          ne: { lat: 40.7589, lng: -73.9851 },
          sw: { lat: 40.7128, lng: -74.006 },
        },
      };

      const tomtomResponse: RouteResponse = {
        distance_m: 2100,
        duration_s: 950,
        legs: [
          {
            distance_m: 2100,
            duration_s: 950,
            steps: [],
            start_location: { lat: 40.7128, lng: -74.006 },
            end_location: { lat: 40.7589, lng: -73.9851 },
          },
        ],
        polyline: 'test',
        bounds: {
          ne: { lat: 40.7589, lng: -73.9851 },
          sw: { lat: 40.7128, lng: -74.006 },
        },
      };

      vi.mocked(mockHEREClient.route as any).mockResolvedValueOnce(hereResponse);
      vi.mocked(mockTomTomClient.route as any).mockResolvedValueOnce(tomtomResponse);

      const report = await engine.compareRoute({
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
      });

      // HERE should be recommended for speed
      expect(report.recommendations.bestForSpeed).toBe('here');
      expect(report.recommendations.bestForCost).toBe('here');
    });
  });

  describe('compareMatrix', () => {
    it('should compare matrix routes across providers', async () => {
      const mockMatrixResponse: MatrixResponse = {
        sources: [
          { lat: 40.7128, lng: -74.006 },
          { lat: 40.7489, lng: -73.968 },
        ],
        targets: [
          { lat: 40.7589, lng: -73.9851 },
          { lat: 40.8, lng: -73.95 },
        ],
        matrix: [
          [
            { distance_m: 2000, duration_s: 900, status: 'OK' },
            { distance_m: 3000, duration_s: 1200, status: 'OK' },
          ],
          [
            { distance_m: 1500, duration_s: 600, status: 'OK' },
            { distance_m: 2500, duration_s: 900, status: 'OK' },
          ],
        ],
      };

      vi.mocked(mockHEREClient.matrix as any).mockResolvedValueOnce(mockMatrixResponse);
      vi.mocked(mockTomTomClient.matrix as any).mockResolvedValueOnce(mockMatrixResponse);

      const results = await engine.compareMatrix({
        origins: [
          { lat: 40.7128, lng: -74.006 },
          { lat: 40.7489, lng: -73.968 },
        ],
        destinations: [
          { lat: 40.7589, lng: -73.9851 },
          { lat: 40.8, lng: -73.95 },
        ],
      });

      expect(results).toHaveLength(2);
      expect(results[0].provider).toBe('here');
      expect(results[1].provider).toBe('tomtom');

      // Both should have quality > 0
      expect(results[0].quality).toBeGreaterThan(0);
      expect(results[1].quality).toBeGreaterThan(0);
    });

    it('should handle matrix errors', async () => {
      vi.mocked(mockHEREClient.matrix as any).mockRejectedValueOnce(
        new Error('Matrix API error'),
      );

      const mockMatrixResponse: MatrixResponse = {
        sources: [{ lat: 40.7128, lng: -74.006 }],
        targets: [{ lat: 40.7589, lng: -73.9851 }],
        matrix: [
          [{ distance_m: 2000, duration_s: 900, status: 'OK' }],
        ],
      };

      vi.mocked(mockTomTomClient.matrix as any).mockResolvedValueOnce(mockMatrixResponse);

      const results = await engine.compareMatrix({
        origins: [{ lat: 40.7128, lng: -74.006 }],
        destinations: [{ lat: 40.7589, lng: -73.9851 }],
      });

      // Should only have TomTom result
      expect(results).toHaveLength(1);
      expect(results[0].provider).toBe('tomtom');
    });
  });

  describe('cost models', () => {
    it('should use registered cost models', async () => {
      const response: RouteResponse = {
        distance_m: 2000,
        duration_s: 900,
        legs: [
          {
            distance_m: 2000,
            duration_s: 900,
            steps: [],
            start_location: { lat: 40.7128, lng: -74.006 },
            end_location: { lat: 40.7589, lng: -73.9851 },
          },
        ],
        polyline: 'test',
        bounds: {
          ne: { lat: 40.7589, lng: -73.9851 },
          sw: { lat: 40.7128, lng: -74.006 },
        },
      };

      vi.mocked(mockHEREClient.route as any).mockResolvedValueOnce(response);
      vi.mocked(mockTomTomClient.route as any).mockResolvedValueOnce(response);

      const report = await engine.compareRoute({
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
      });

      // Costs should be calculated
      for (const route of report.routes) {
        expect(route.cost).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('provider ranking', () => {
    it('should identify provider strengths and weaknesses', async () => {
      const hereResponse: RouteResponse = {
        distance_m: 2000,
        duration_s: 900,
        legs: [
          {
            distance_m: 2000,
            duration_s: 900,
            steps: [],
            start_location: { lat: 40.7128, lng: -74.006 },
            end_location: { lat: 40.7589, lng: -73.9851 },
          },
        ],
        polyline: 'test',
        bounds: {
          ne: { lat: 40.7589, lng: -73.9851 },
          sw: { lat: 40.7128, lng: -74.006 },
        },
      };

      const tomtomResponse: RouteResponse = {
        distance_m: 2200, // Longer
        duration_s: 950, // Slower
        legs: [
          {
            distance_m: 2200,
            duration_s: 950,
            steps: [],
            start_location: { lat: 40.7128, lng: -74.006 },
            end_location: { lat: 40.7589, lng: -73.9851 },
          },
        ],
        polyline: 'test',
        bounds: {
          ne: { lat: 40.7589, lng: -73.9851 },
          sw: { lat: 40.7128, lng: -74.006 },
        },
      };

      vi.mocked(mockHEREClient.route as any).mockResolvedValueOnce(hereResponse);
      vi.mocked(mockTomTomClient.route as any).mockResolvedValueOnce(tomtomResponse);

      const report = await engine.compareRoute({
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
      });

      const hereRank = report.ranking.find((r) => r.provider === 'here');
      expect(hereRank).toBeDefined();
      expect(hereRank?.strengths.length).toBeGreaterThan(0);

      const tomtomRank = report.ranking.find((r) => r.provider === 'tomtom');
      expect(tomtomRank).toBeDefined();
      expect(tomtomRank?.weaknesses.length).toBeGreaterThan(0);
    });
  });
});
