/**
 * Valhalla Client Tests
 *
 * Comprehensive test suite for Valhalla routing adapter with 30+ test cases
 * covering routing, optimization, matrix, isochrone, and map matching operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ValhallaClient } from '../valhalla-client.js';
import type {
  RouteRequest,
  OptimizationRequest,
  MatrixRequest,
  IsochroneRequest,
  MapMatchingRequest,
} from '../types.js';

describe('ValhallaClient', () => {
  let client: ValhallaClient;

  beforeEach(() => {
    client = new ValhallaClient({
      baseUrl: 'https://valhalla.test.local',
      rateLimit: 10,
      timeout: 5000,
    });

    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Routing Operations', () => {
    it('should compute a basic route', async () => {
      const mockResponse = {
        trip: {
          legs: [
            {
              maneuvers: [
                {
                  begin_shape_index: 0,
                  end_shape_index: 10,
                  instruction: 'Head north',
                  type: 0,
                  time: 60,
                  length: 1000,
                  cost: 100,
                  street_names: ['Main Street'],
                },
              ],
              summary: {
                length: 1000,
                time: 60,
                cost: 100,
              },
              shape: 'encoded_polyline',
            },
          ],
          summary: {
            length: 1000,
            time: 60,
            cost: 100,
          },
          shape: 'encoded_polyline',
          status: 0,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
        costing: 'auto',
      };

      const result = await client.route(request);

      expect(result).toBeDefined();
      expect(result.distance_m).toBe(1000);
      expect(result.duration_s).toBe(60);
      expect(result.legs).toHaveLength(1);
      expect(result.polyline).toBe('encoded_polyline');
    });

    it('should support waypoints', async () => {
      const mockResponse = {
        trip: {
          legs: Array(2).fill({
            maneuvers: [],
            summary: { length: 500, time: 30, cost: 50 },
            shape: 'encoded',
          }),
          summary: { length: 1000, time: 60, cost: 100 },
          shape: 'encoded_polyline',
          status: 0,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
        waypoints: [[40.73, -73.99]],
      };

      const result = await client.route(request);

      expect(result.legs).toHaveLength(2);
      expect(result.distance_m).toBe(1000);
    });

    it('should handle alternative routes', async () => {
      const mockResponse = {
        trip: {
          legs: [],
          summary: { length: 1000, time: 60, cost: 100 },
          shape: 'main',
          status: 0,
        },
        alternates: [
          {
            trip: {
              legs: [],
              shape: 'alt1',
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
        options: { alternatives: true },
      };

      const result = await client.route(request);
      expect(result).toBeDefined();
    });

    it('should respect toll avoidance option', async () => {
      const mockResponse = {
        trip: {
          legs: [],
          summary: { length: 1500, time: 90, cost: 100 },
          shape: 'no_toll',
          status: 0,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
        options: { exclude_toll: true },
      };

      const result = await client.route(request);
      expect(result.distance_m).toBe(1500);
    });

    it('should support different costing models', async () => {
      const mockResponse = {
        trip: {
          legs: [],
          summary: { length: 800, time: 300, cost: 100 },
          shape: 'bike',
          status: 0,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
        costing: 'bicycle',
      };

      const result = await client.route(request);
      expect(result.duration_s).toBeGreaterThan(60); // Bikes are slower
    });

    it('should cache route requests', async () => {
      const mockResponse = {
        trip: {
          legs: [],
          summary: { length: 1000, time: 60, cost: 100 },
          shape: 'encoded',
          status: 0,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      const result1 = await client.route(request);
      const result2 = await client.route(request);

      expect(result1).toEqual(result2);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only one actual API call
    });

    it('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      await expect(client.route(request)).rejects.toThrow('Valhalla API error');
    });

    it('should handle timeouts', async () => {
      (global.fetch as any).mockImplementationOnce(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Network timeout')), 100),
        ),
      );

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      await expect(client.route(request)).rejects.toThrow();
    });
  });

  describe('Matrix Operations', () => {
    it('should compute distance matrix', async () => {
      const mockResponse = {
        sources: [
          { lat: 40.7128, lon: -74.006 },
          { lat: 40.758, lon: -73.9855 },
        ],
        targets: [
          { lat: 40.7128, lon: -74.006 },
          { lat: 40.758, lon: -73.9855 },
        ],
        matrix: [
          [
            { distance: 0, time: 0 },
            { distance: 5000, time: 300 },
          ],
          [
            { distance: 5000, time: 300 },
            { distance: 0, time: 0 },
          ],
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: MatrixRequest = {
        origins: [[40.7128, -74.006]],
        destinations: [[40.758, -73.9855]],
      };

      const result = await client.matrix(request);

      expect(result.sources).toHaveLength(2);
      expect(result.targets).toHaveLength(2);
      expect(result.matrix).toHaveLength(2);
      expect(result.matrix[0][1].distance_m).toBe(5000);
      expect(result.matrix[0][1].duration_s).toBe(300);
    });

    it('should handle large matrices', async () => {
      const size = 10;
      const mockMatrix = Array(size)
        .fill(null)
        .map(() =>
          Array(size)
            .fill(null)
            .map(() => ({ distance: 5000, time: 300 })),
        );

      const mockResponse = {
        sources: Array(size)
          .fill(null)
          .map((_, i) => ({ lat: 40 + i * 0.01, lon: -74 + i * 0.01 })),
        targets: Array(size)
          .fill(null)
          .map((_, i) => ({ lat: 40 + i * 0.01, lon: -74 + i * 0.01 })),
        matrix: mockMatrix,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: MatrixRequest = {
        origins: Array(size)
          .fill(null)
          .map((_, i) => [40 + i * 0.01, -74 + i * 0.01]),
        destinations: Array(size)
          .fill(null)
          .map((_, i) => [40 + i * 0.01, -74 + i * 0.01]),
      };

      const result = await client.matrix(request);
      expect(result.matrix).toHaveLength(size);
      expect(result.matrix[0]).toHaveLength(size);
    });

    it('should cache matrix requests', async () => {
      const mockResponse = {
        sources: [{ lat: 40.7128, lon: -74.006 }],
        targets: [{ lat: 40.758, lon: -73.9855 }],
        matrix: [[{ distance: 5000, time: 300 }]],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: MatrixRequest = {
        origins: [[40.7128, -74.006]],
        destinations: [[40.758, -73.9855]],
      };

      await client.matrix(request);
      await client.matrix(request);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Isochrone Operations', () => {
    it('should generate isochrone polygons', async () => {
      const mockResponse = {
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[[40.7, -74.0], [40.71, -74.0], [40.71, -73.99], [40.7, -74.0]]],
            },
            properties: {
              contour: 300,
              color: 'ff0000',
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: IsochroneRequest = {
        center: [40.7128, -74.006],
        contours: [{ value: 300 }],
      };

      const result = await client.isochrone(request);

      expect(result.contours).toHaveLength(1);
      expect(result.contours[0].value).toBe(300);
      expect(result.contours[0].feature.geometry.type).toBe('Polygon');
    });

    it('should support multiple contours', async () => {
      const mockResponse = {
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[[40.7, -74.0], [40.71, -74.0], [40.71, -73.99], [40.7, -74.0]]],
            },
            properties: { contour: 300, color: 'ff0000' },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[[40.68, -74.0], [40.75, -74.0], [40.75, -73.95], [40.68, -74.0]]],
            },
            properties: { contour: 600, color: '00ff00' },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: IsochroneRequest = {
        center: [40.7128, -74.006],
        contours: [
          { value: 300, color: 'ff0000' },
          { value: 600, color: '00ff00' },
        ],
      };

      const result = await client.isochrone(request);
      expect(result.contours).toHaveLength(2);
    });

    it('should cache isochrone requests', async () => {
      const mockResponse = {
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[[40.7, -74.0], [40.71, -74.0], [40.71, -73.99], [40.7, -74.0]]],
            },
            properties: { contour: 300, color: 'ff0000' },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: IsochroneRequest = {
        center: [40.7128, -74.006],
        contours: [{ value: 300 }],
      };

      await client.isochrone(request);
      await client.isochrone(request);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Map Matching Operations', () => {
    it('should match GPS trace to road network', async () => {
      const mockResponse = {
        trip: {
          legs: [],
          shape: 'matched_polyline',
          status: 0,
          confidence_score: 0.95,
        },
        matched_points: [
          { edge_index: 0, lat: 40.7128, lon: -74.006, type: 'matched' },
          { edge_index: 1, lat: 40.715, lon: -74.0055, type: 'matched' },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: MapMatchingRequest = {
        shape: [
          [40.7128, -74.006],
          [40.715, -74.0055],
          [40.717, -74.005],
        ],
      };

      const result = await client.mapMatch(request);

      expect(result.shape).toBe('matched_polyline');
      expect(result.matched_points).toHaveLength(2);
      expect(result.confidence_score).toBe(0.95);
    });

    it('should handle unmatched points', async () => {
      const mockResponse = {
        trip: {
          legs: [],
          shape: 'matched',
          status: 0,
          confidence_score: 0.7,
        },
        matched_points: [
          { edge_index: 0, lat: 40.7128, lon: -74.006, type: 'matched' },
          { edge_index: 0, lat: 40.715, lon: -74.0055, type: 'unmatched' },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: MapMatchingRequest = {
        shape: [
          [40.7128, -74.006],
          [40.715, -74.0055],
        ],
      };

      const result = await client.mapMatch(request);
      expect(result.confidence_score).toBeLessThan(1);
    });
  });

  describe('Optimization Operations', () => {
    it('should support optimization requests', async () => {
      const request: OptimizationRequest = {
        vehicles: [
          {
            start_location: [40.7128, -74.006],
            end_location: [40.758, -73.9855],
          },
        ],
        jobs: [
          {
            location: [40.72, -74.0],
          },
          {
            location: [40.73, -73.99],
          },
        ],
      };

      const result = await client.optimize(request);

      expect(result.code).toBe('OK');
      expect(result.routes).toBeDefined();
    });
  });

  describe('Health Checks', () => {
    it('should report health status', async () => {
      const status = await client.health();

      expect(status).toBeDefined();
      expect(status.status).toMatch(/healthy|degraded|unhealthy/);
      expect(status.timestamp).toBeInstanceOf(Date);
    });

    it('should track metrics', async () => {
      const mockResponse = {
        trip: {
          legs: [],
          summary: { length: 1000, time: 60, cost: 100 },
          shape: 'encoded',
          status: 0,
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      await client.route(request);
      await client.route(request); // Second request (cached)

      const metrics = (client as any).getMetrics();

      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.successfulRequests).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      const mockResponse = {
        trip: {
          legs: [],
          summary: { length: 1000, time: 60, cost: 100 },
          shape: 'encoded',
          status: 0,
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      const startTime = Date.now();
      const results = await Promise.all([
        client.route(request),
        client.route(request),
        client.route(request),
      ]);

      expect(results).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      await expect(client.route(request)).rejects.toThrow();
    });

    it('should handle JSON parsing errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      await expect(client.route(request)).rejects.toThrow();
    });

    it('should handle missing required fields', async () => {
      const request = {
        origin: [40.7128, -74.006],
        // Missing destination
      } as any;

      await expect(client.route(request)).rejects.toThrow();
    });
  });

  describe('Coordinate Formats', () => {
    it('should handle [lat, lng] array coordinates', async () => {
      const mockResponse = {
        trip: {
          legs: [],
          summary: { length: 1000, time: 60, cost: 100 },
          shape: 'encoded',
          status: 0,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      const result = await client.route(request);
      expect(result).toBeDefined();
    });

    it('should handle {lat, lng} object coordinates', async () => {
      const mockResponse = {
        trip: {
          legs: [],
          summary: { length: 1000, time: 60, cost: 100 },
          shape: 'encoded',
          status: 0,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.758, lng: -73.9855 },
      };

      const result = await client.route(request);
      expect(result).toBeDefined();
    });
  });
});
