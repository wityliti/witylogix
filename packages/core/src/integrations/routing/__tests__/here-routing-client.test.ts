/**
 * HERE Routing Client Tests
 *
 * Comprehensive test suite covering:
 * - Route calculation with various transport modes
 * - Truck routing with restrictions
 * - Matrix routing
 * - Isoline (isochrone) generation
 * - Rate limiting and circuit breaker
 * - Error handling and recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HERERoutingClient } from '../here-routing-client.js';
import type { RoutingAdapterConfig, RouteRequest, MatrixRequest } from '../types.js';

describe('HERERoutingClient', () => {
  let client: HERERoutingClient;
  const mockConfig: RoutingAdapterConfig = {
    apiKey: 'test-api-key',
    rateLimit: 50,
    timeout: 30000,
  };

  beforeEach(() => {
    client = new HERERoutingClient(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('route', () => {
    it('should calculate a basic car route', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              id: 'route-1',
              polyline: 'encoded_polyline_here',
              legs: [
                {
                  summary: {
                    distance: 2500,
                    duration: 300,
                  },
                  links: [
                    {
                      id: 'link-1',
                      length: 2500,
                      speed: 30,
                      duration: 300,
                      direction: 'north',
                      road: {
                        names: ['5th Avenue'],
                      },
                    },
                  ],
                  arrival: {
                    place: { type: 'place', location: { lat: 40.8, lng: -74 } },
                    time: '2024-03-12T10:05:00Z',
                  },
                  departure: {
                    place: { type: 'place', location: { lat: 40.7, lng: -74.1 } },
                    time: '2024-03-12T10:00:00Z',
                  },
                },
              ],
              sections: [
                {
                  id: 'section-1',
                  type: 'default',
                  summary: {
                    distance: 2500,
                    duration: 300,
                  },
                },
              ],
            },
          ],
        }),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7, lng: -74.1 },
        destination: { lat: 40.8, lng: -74 },
        costing: 'auto',
      };

      const response = await client.route(request);

      expect(response.status).toBeDefined();
      expect(response.distance_m).toBe(2500);
      expect(response.duration_s).toBe(300);
      expect(response.legs).toHaveLength(1);
    });

    it('should calculate truck route with restrictions', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              id: 'route-1',
              polyline: 'encoded_polyline_here',
              legs: [
                {
                  summary: { distance: 3000, duration: 360 },
                  links: [],
                  arrival: {
                    place: { type: 'place', location: { lat: 40.8, lng: -74 } },
                    time: '2024-03-12T10:06:00Z',
                  },
                  departure: {
                    place: { type: 'place', location: { lat: 40.7, lng: -74.1 } },
                    time: '2024-03-12T10:00:00Z',
                  },
                },
              ],
              sections: [
                {
                  id: 'section-1',
                  type: 'default',
                  summary: { distance: 3000, duration: 360 },
                },
              ],
            },
          ],
        }),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7, lng: -74.1 },
        destination: { lat: 40.8, lng: -74 },
        costing: 'truck',
      };

      const response = await client.route(request, {
        truck: {
          maxHeight: 4.2,
          maxWeight: 18000,
          maxLength: 21,
          tunnelCategory: 'B',
        },
      });

      expect(response).toBeDefined();
      expect(global.fetch).toHaveBeenCalled();
      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('truck');
    });

    it('should handle waypoints', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              id: 'route-1',
              polyline: 'encoded_polyline',
              legs: [],
              sections: [
                {
                  id: 'section-1',
                  type: 'default',
                  summary: { distance: 5000, duration: 600 },
                },
              ],
            },
          ],
        }),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7, lng: -74.1 },
        destination: { lat: 40.9, lng: -73.9 },
        waypoints: [{ lat: 40.75, lng: -74 }],
      };

      const response = await client.route(request);

      expect(response).toBeDefined();
      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('40.75');
    });

    it('should support alternative routes', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              id: 'route-1',
              polyline: 'encoded_polyline_1',
              legs: [],
              sections: [
                {
                  id: 'section-1',
                  type: 'default',
                  summary: { distance: 2500, duration: 300 },
                },
              ],
            },
            {
              id: 'route-2',
              polyline: 'encoded_polyline_2',
              legs: [],
              sections: [
                {
                  id: 'section-1',
                  type: 'default',
                  summary: { distance: 2800, duration: 330 },
                },
              ],
            },
          ],
        }),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7, lng: -74.1 },
        destination: { lat: 40.8, lng: -74 },
      };

      await client.route(request, { alternatives: true });

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('alternatives=true');
    });

    it('should handle array coordinates', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              id: 'route-1',
              polyline: 'encoded_polyline',
              legs: [],
              sections: [
                {
                  id: 'section-1',
                  type: 'default',
                  summary: { distance: 2500, duration: 300 },
                },
              ],
            },
          ],
        }),
      });

      const request: RouteRequest = {
        origin: [40.7, -74.1],
        destination: [40.8, -74],
      };

      const response = await client.route(request);

      expect(response).toBeDefined();
    });

    it('should throw error on API failure', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
      });

      const request: RouteRequest = {
        origin: { lat: 40.7, lng: -74.1 },
        destination: { lat: 40.8, lng: -74 },
      };

      await expect(client.route(request)).rejects.toThrow();
    });

    it('should throw error when no routes found', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [],
        }),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7, lng: -74.1 },
        destination: { lat: 40.8, lng: -74 },
      };

      await expect(client.route(request)).rejects.toThrow();
    });
  });

  describe('matrix', () => {
    it('should calculate distance/time matrix', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          matrix: [
            [
              { distance: 0, time: 0 },
              { distance: 2500, time: 300000 },
              { distance: 5000, time: 600000 },
            ],
            [
              { distance: 2500, time: 300000 },
              { distance: 0, time: 0 },
              { distance: 2800, time: 330000 },
            ],
          ],
        }),
      });

      const request: MatrixRequest = {
        origins: [
          { lat: 40.7, lng: -74.1 },
          { lat: 40.75, lng: -74 },
        ],
        destinations: [
          { lat: 40.8, lng: -74 },
          { lat: 40.9, lng: -73.9 },
          { lat: 40.6, lng: -73.8 },
        ],
      };

      const response = await client.matrix(request);

      expect(response.sources).toHaveLength(2);
      expect(response.targets).toHaveLength(3);
      expect(response.matrix).toHaveLength(2);
      expect(response.matrix[0]).toHaveLength(3);
    });

    it('should handle POST method', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          matrix: [
            [
              { distance: 0, time: 0 },
              { distance: 1000, time: 120000 },
            ],
          ],
        }),
      });

      const request: MatrixRequest = {
        origins: [{ lat: 0, lng: 0 }],
        destinations: [{ lat: 1, lng: 1 }],
      };

      await client.matrix(request);

      expect(global.fetch).toHaveBeenCalled();
      const call = (global.fetch as any).mock.calls[0];
      expect(call[1].method).toBe('POST');
    });

    it('should support truck routing for matrix', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          matrix: [
            [
              { distance: 0, time: 0 },
              { distance: 1000, time: 150000 },
            ],
          ],
        }),
      });

      const request: MatrixRequest = {
        origins: [{ lat: 0, lng: 0 }],
        destinations: [{ lat: 1, lng: 1 }],
        costing: 'truck',
      };

      await client.matrix(request);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('truck');
    });

    it('should throw error on failure', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });

      const request: MatrixRequest = {
        origins: [{ lat: 0, lng: 0 }],
        destinations: [{ lat: 1, lng: 1 }],
      };

      await expect(client.matrix(request)).rejects.toThrow();
    });
  });

  describe('isoline', () => {
    it('should generate time-based isochrone', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          isolines: [
            {
              range: {
                type: 'time',
                value: 300,
              },
              shape: 'encoded_polygon',
            },
            {
              range: {
                type: 'time',
                value: 600,
              },
              shape: 'encoded_polygon_2',
            },
          ],
        }),
      });

      const request = {
        center: { lat: 40.7, lng: -74.1 },
        contours: [
          { value: 300, color: '#ff0000' },
          { value: 600, color: '#00ff00' },
        ],
      };

      const response = await client.isoline(request);

      expect(response.contours).toHaveLength(2);
      expect(response.contours[0].value).toBe(300);
      expect(response.contours[1].value).toBe(600);
    });

    it('should generate distance-based isochrone', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          isolines: [
            {
              range: {
                type: 'distance',
                value: 5000,
              },
              shape: 'encoded_polygon',
            },
          ],
        }),
      });

      const request = {
        center: { lat: 40.7, lng: -74.1 },
        contours: [{ value: 5000 }],
      };

      await client.isoline(request);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('distance');
    });

    it('should support array center coordinates', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          isolines: [
            {
              range: { type: 'time', value: 300 },
              shape: 'encoded_polygon',
            },
          ],
        }),
      });

      const request = {
        center: [40.7, -74.1] as [number, number],
        contours: [{ value: 300 }],
      };

      const response = await client.isoline(request);

      expect(response.contours).toHaveLength(1);
    });

    it('should throw error on API failure', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable',
      });

      const request = {
        center: { lat: 40.7, lng: -74.1 },
        contours: [{ value: 300 }],
      };

      await expect(client.isoline(request)).rejects.toThrow();
    });
  });

  describe('Rate limiting', () => {
    it('should enforce rate limiting', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          routes: [
            {
              id: 'route-1',
              polyline: 'encoded',
              legs: [],
              sections: [{ id: 's1', type: 'default', summary: { distance: 1000, duration: 100 } }],
            },
          ],
        }),
      });

      const slowClient = new HERERoutingClient({
        ...mockConfig,
        rateLimit: 5,
      });

      const startTime = Date.now();

      const requests = Array.from({ length: 3 }, () =>
        slowClient.route({
          origin: { lat: 0, lng: 0 },
          destination: { lat: 1, lng: 1 },
        })
      );

      await Promise.all(requests);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(300); // ~200ms per request after first
    });
  });

  describe('Circuit breaker', () => {
    it('should open circuit after multiple failures', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const request: RouteRequest = {
        origin: { lat: 40.7, lng: -74.1 },
        destination: { lat: 40.8, lng: -74 },
      };

      for (let i = 0; i < 5; i++) {
        try {
          await client.route(request);
        } catch (e) {
          // Expected
        }
      }

      // Circuit should be open now
      await expect(client.route(request)).rejects.toThrow('Circuit breaker is open');
    });
  });

  describe('Metrics', () => {
    it('should track request metrics', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          routes: [
            {
              id: 'route-1',
              polyline: 'encoded',
              legs: [],
              sections: [{ id: 's1', type: 'default', summary: { distance: 1000, duration: 100 } }],
            },
          ],
        }),
      });

      const request: RouteRequest = {
        origin: { lat: 0, lng: 0 },
        destination: { lat: 1, lng: 1 },
      };

      await client.route(request);
      await client.matrix({ origins: [{ lat: 0, lng: 0 }], destinations: [{ lat: 1, lng: 1 }] });
      await client.isoline({ center: { lat: 0, lng: 0 }, contours: [{ value: 300 }] });

      const metrics = client.getMetrics();

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.successfulRequests).toBe(3);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });

    it('should calculate success rate', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            routes: [
              {
                id: 'route-1',
                polyline: 'encoded',
                legs: [],
                sections: [{ id: 's1', type: 'default', summary: { distance: 1000, duration: 100 } }],
              },
            ],
          }),
        })
        .mockRejectedValueOnce(new Error('Timeout'));

      const request: RouteRequest = {
        origin: { lat: 0, lng: 0 },
        destination: { lat: 1, lng: 1 },
      };

      await client.route(request);

      try {
        await client.route(request);
      } catch (e) {
        // Expected
      }

      const metrics = client.getMetrics();

      expect(metrics.successRate).toBe(0.5);
    });

    it('should reset metrics', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          routes: [
            {
              id: 'route-1',
              polyline: 'encoded',
              legs: [],
              sections: [{ id: 's1', type: 'default', summary: { distance: 1000, duration: 100 } }],
            },
          ],
        }),
      });

      await client.route({
        origin: { lat: 0, lng: 0 },
        destination: { lat: 1, lng: 1 },
      });

      client.resetMetrics();
      const metrics = client.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
    });
  });
});
