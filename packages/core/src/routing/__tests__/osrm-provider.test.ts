/**
 * OSRM Routing Provider Tests
 * Comprehensive test suite for Open Source Routing Machine (OSRM)
 * Tests: routes, multi-waypoint routing, distance matrices, optimization, ETAs, snapping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OSRMProvider } from '../osrm-provider';

describe('OSRMProvider', () => {
  let provider: OSRMProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    provider = new OSRMProvider('http://router.local:5000');
  });

  describe('getRoute()', () => {
    it('should retrieve route between two points', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          routes: [
            {
              distance: 42567,
              duration: 2450,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-74.006, 40.7128],
                  [-74.0, 40.72],
                  [-73.99, 40.73],
                ],
              },
              legs: [
                {
                  distance: 21283,
                  duration: 1225,
                  steps: [],
                },
                {
                  distance: 21284,
                  duration: 1225,
                  steps: [],
                },
              ],
            },
          ],
        }),
      });

      const route = await provider.getRoute(
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7580, longitude: -73.9855 }
      );

      expect(route).toEqual(
        expect.objectContaining({
          distanceMeters: 42567,
          durationSeconds: 2450,
          geometry: expect.arrayContaining([
            expect.arrayContaining([expect.any(Number), expect.any(Number)]),
          ]),
        })
      );
    });

    it('should include geometry in route response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          routes: [
            {
              distance: 10000,
              duration: 600,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-74.006, 40.7128],
                  [-74.005, 40.715],
                  [-74.004, 40.718],
                ],
              },
              legs: [],
            },
          ],
        }),
      });

      const route = await provider.getRoute(
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7180, longitude: -74.004 }
      );

      expect(route.geometry).toHaveLength(3);
      expect(route.geometry[0]).toEqual([-74.006, 40.7128]);
    });

    it('should handle OSRM error code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'NoRoute',
          message: 'No route found',
          routes: [],
        }),
      });

      await expect(
        provider.getRoute(
          { latitude: 0, longitude: 0 },
          { latitude: 0.1, longitude: 0.1 }
        )
      ).rejects.toThrow();
    });

    it('should handle network failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        provider.getRoute(
          { latitude: 40.7128, longitude: -74.006 },
          { latitude: 40.7580, longitude: -73.9855 }
        )
      ).rejects.toThrow();
    });

    it('should handle timeout error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      await expect(
        provider.getRoute(
          { latitude: 40.7128, longitude: -74.006 },
          { latitude: 40.7580, longitude: -73.9855 }
        )
      ).rejects.toThrow();
    });
  });

  describe('getRouteWithWaypoints()', () => {
    it('should handle multi-waypoint routing (3+ points)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          routes: [
            {
              distance: 25000,
              duration: 1500,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-74.006, 40.7128],
                  [-74.0, 40.72],
                  [-73.99, 40.73],
                  [-73.98, 40.74],
                ],
              },
              legs: [],
            },
          ],
        }),
      });

      const waypoints = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7200, longitude: -74.000 },
        { latitude: 40.7300, longitude: -73.990 },
        { latitude: 40.7400, longitude: -73.980 },
      ];

      const route = await provider.getRouteWithWaypoints(waypoints);

      expect(route).toEqual(
        expect.objectContaining({
          distanceMeters: 25000,
          durationSeconds: 1500,
          geometry: expect.any(Array),
        })
      );

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain('/route/v1/driving/');
      expect(call[0]).toContain('-74.006,40.7128');
      expect(call[0]).toContain('-74,40.72');
      expect(call[0]).toContain('-73.99,40.73');
      expect(call[0]).toContain('-73.98,40.74');
    });

    it('should require at least 2 waypoints', async () => {
      await expect(
        provider.getRouteWithWaypoints([{ latitude: 40.7128, longitude: -74.006 }])
      ).rejects.toThrow('At least 2 waypoints required');
    });

    it('should include overview=full parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          routes: [
            {
              distance: 10000,
              duration: 600,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-74.006, 40.7128],
                  [-73.99, 40.73],
                ],
              },
              legs: [],
            },
          ],
        }),
      });

      await provider.getRouteWithWaypoints([
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7300, longitude: -73.990 },
      ]);

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain('overview=full');
    });
  });

  describe('getDistanceMatrix()', () => {
    it('should compute distance/duration matrix for multiple points', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          durations: [
            [0, 600, 1200],
            [600, 0, 800],
            [1200, 800, 0],
          ],
          distances: [
            [0, 10000, 25000],
            [10000, 0, 15000],
            [25000, 15000, 0],
          ],
          sources: [
            { location: [-74.006, 40.7128], name: 'Start' },
            { location: [-74.0, 40.72], name: 'Point1' },
            { location: [-73.99, 40.73], name: 'Point2' },
          ],
          destinations: [
            { location: [-74.006, 40.7128], name: 'Start' },
            { location: [-74.0, 40.72], name: 'Point1' },
            { location: [-73.99, 40.73], name: 'Point2' },
          ],
        }),
      });

      const points = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7200, longitude: -74.000 },
        { latitude: 40.7300, longitude: -73.990 },
      ];

      const matrix = await provider.getDistanceMatrix(points);

      expect(matrix.durations).toHaveLength(3);
      expect(matrix.durations[0]).toHaveLength(3);
      expect(matrix.distances).toHaveLength(3);
      expect(matrix.distances[0]).toHaveLength(3);
      expect(matrix.durations[0][1]).toBe(600);
      expect(matrix.distances[0][1]).toBe(10000);
    });

    it('should handle symmetric matrix (same origin/dest)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          durations: [
            [0, 300],
            [300, 0],
          ],
          distances: [
            [0, 5000],
            [5000, 0],
          ],
        }),
      });

      const points = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7200, longitude: -74.000 },
      ];

      const matrix = await provider.getDistanceMatrix(points);

      expect(matrix.durations[0][1]).toBe(matrix.durations[1][0]);
      expect(matrix.distances[0][1]).toBe(matrix.distances[1][0]);
    });

    it('should require at least 2 points', async () => {
      await expect(
        provider.getDistanceMatrix([{ latitude: 40.7128, longitude: -74.006 }])
      ).rejects.toThrow('At least 2 points required');
    });

    it('should include annotations=duration,distance in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          durations: [[0, 600], [600, 0]],
          distances: [[0, 10000], [10000, 0]],
        }),
      });

      await provider.getDistanceMatrix([
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7200, longitude: -74.000 },
      ]);

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain('annotations=duration,distance');
    });

    it('should handle matrix computation error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'InvalidInput',
          message: 'Coordinates not found',
        }),
      });

      await expect(
        provider.getDistanceMatrix([
          { latitude: 40.7128, longitude: -74.006 },
          { latitude: 40.7200, longitude: -74.000 },
        ])
      ).rejects.toThrow();
    });
  });

  describe('optimizeRoute()', () => {
    it('should optimize route order via Trip Service', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          trips: [
            {
              distance: 28000,
              duration: 1650,
              waypoint_indices: [0, 2, 1, 3],
              waypoint_names: [],
              legs: [],
            },
          ],
        }),
      });

      const waypoints = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7300, longitude: -73.990 },
        { latitude: 40.7200, longitude: -74.000 },
        { latitude: 40.7400, longitude: -73.980 },
      ];

      const result = await provider.optimizeRoute(waypoints);

      expect(result).toEqual(
        expect.objectContaining({
          order: [0, 2, 1, 3],
          distance: 28000,
          duration: 1650,
        })
      );
    });

    it('should return reordered waypoint indices', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          trips: [
            {
              distance: 15000,
              duration: 900,
              waypoint_indices: [0, 2, 1],
              waypoint_names: [],
              legs: [],
            },
          ],
        }),
      });

      const waypoints = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7300, longitude: -73.990 },
        { latitude: 40.7200, longitude: -74.000 },
      ];

      const result = await provider.optimizeRoute(waypoints);

      expect(result.order[0]).toBe(0);
      expect(result.order[1]).toBe(2);
      expect(result.order[2]).toBe(1);
    });

    it('should require at least 2 waypoints', async () => {
      await expect(
        provider.optimizeRoute([{ latitude: 40.7128, longitude: -74.006 }])
      ).rejects.toThrow('At least 2 waypoints required');
    });

    it('should include roundtrip=false parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          trips: [
            {
              distance: 10000,
              duration: 600,
              waypoint_indices: [0, 1],
              waypoint_names: [],
              legs: [],
            },
          ],
        }),
      });

      await provider.optimizeRoute([
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7200, longitude: -74.000 },
      ]);

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain('roundtrip=false');
    });

    it('should handle optimization error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'InvalidInput',
          message: 'Coordinates out of bounds',
        }),
      });

      await expect(
        provider.optimizeRoute([
          { latitude: 40.7128, longitude: -74.006 },
          { latitude: 40.7200, longitude: -74.000 },
        ])
      ).rejects.toThrow();
    });
  });

  describe('getETA()', () => {
    it('should calculate ETA from origin to destination', async () => {
      const futureTime = Date.now() + 2450 * 1000;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          routes: [
            {
              distance: 42567,
              duration: 2450,
              geometry: {
                type: 'LineString',
                coordinates: [[-74.006, 40.7128], [-73.99, 40.73]],
              },
              legs: [],
            },
          ],
        }),
      });

      const eta = await provider.getETA(
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7300, longitude: -73.990 }
      );

      expect(eta).toEqual(
        expect.objectContaining({
          durationSeconds: 2450,
          distanceMeters: 42567,
          arrivalTime: expect.any(Date),
        })
      );

      expect(eta.arrivalTime.getTime()).toBeGreaterThan(Date.now());
      expect(eta.arrivalTime.getTime()).toBeLessThan(futureTime + 1000);
    });

    it('should use getRoute internally', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          routes: [
            {
              distance: 10000,
              duration: 600,
              geometry: {
                type: 'LineString',
                coordinates: [[-74.006, 40.7128], [-74.0, 40.72]],
              },
              legs: [],
            },
          ],
        }),
      });

      const eta = await provider.getETA(
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7200, longitude: -74.000 }
      );

      expect(eta.durationSeconds).toBe(600);
      expect(eta.distanceMeters).toBe(10000);
    });
  });

  describe('snapToRoad()', () => {
    it('should snap GPS coordinates to nearest road', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          waypoints: [
            {
              distance: 10.5,
              name: 'Main Street',
              location: [-74.005, 40.7130],
              hint: 'abcd1234',
            },
          ],
        }),
      });

      const snapped = await provider.snapToRoad({
        latitude: 40.7128,
        longitude: -74.006,
      });

      expect(snapped).toEqual({
        latitude: 40.7130,
        longitude: -74.005,
      });
    });

    it('should extract snapped coordinates from waypoints', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          waypoints: [
            {
              distance: 25.3,
              name: 'Broadway',
              location: [-73.9850, 40.7400],
              hint: 'xyz789',
            },
          ],
        }),
      });

      const snapped = await provider.snapToRoad({
        latitude: 40.7395,
        longitude: -73.9860,
      });

      expect(snapped.longitude).toBe(-73.9850);
      expect(snapped.latitude).toBe(40.7400);
    });

    it('should use Nearest Service endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          waypoints: [
            {
              location: [-74.006, 40.7128],
              name: 'Unknown',
            },
          ],
        }),
      });

      await provider.snapToRoad({
        latitude: 40.7128,
        longitude: -74.006,
      });

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain('/nearest/v1/driving/');
      expect(call[0]).toContain('number=1');
    });

    it('should handle snapping error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'NoMatch',
          message: 'Coordinates not on routable graph',
          waypoints: [],
        }),
      });

      await expect(
        provider.snapToRoad({
          latitude: 0,
          longitude: 0,
        })
      ).rejects.toThrow();
    });

    it('should handle network failure during snapping', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      await expect(
        provider.snapToRoad({
          latitude: 40.7128,
          longitude: -74.006,
        })
      ).rejects.toThrow();
    });
  });

  describe('Custom baseUrl Configuration', () => {
    it('should use custom baseUrl when provided', async () => {
      const customProvider = new OSRMProvider('http://my-osrm-instance:5000');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          routes: [
            {
              distance: 10000,
              duration: 600,
              geometry: {
                type: 'LineString',
                coordinates: [[-74.006, 40.7128], [-74.0, 40.72]],
              },
              legs: [],
            },
          ],
        }),
      });

      await customProvider.getRoute(
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7200, longitude: -74.000 }
      );

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain('http://my-osrm-instance:5000');
    });

    it('should strip trailing slash from baseUrl', async () => {
      const customProvider = new OSRMProvider('http://osrm:5000/');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          routes: [
            {
              distance: 10000,
              duration: 600,
              geometry: {
                type: 'LineString',
                coordinates: [[-74.006, 40.7128], [-74.0, 40.72]],
              },
              legs: [],
            },
          ],
        }),
      });

      await customProvider.getRoute(
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7200, longitude: -74.000 }
      );

      const call = mockFetch.mock.calls[0];
      expect(call[0]).not.toContain('//route');
    });

    it('should use public demo OSRM by default', () => {
      const defaultProvider = new OSRMProvider();
      expect(defaultProvider.name).toBe('osrm');
    });
  });

  describe('Unsupported Methods', () => {
    it('should throw for geocode() method', async () => {
      await expect(provider.geocode('123 Main St')).rejects.toThrow(
        /OSRM does not support geocoding/
      );
    });

    it('should throw for reverseGeocode() method', async () => {
      await expect(
        provider.reverseGeocode({ latitude: 40.7128, longitude: -74.006 })
      ).rejects.toThrow(/OSRM does not support reverse geocoding/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle large distance matrices (10x10)', async () => {
      const points = Array.from({ length: 10 }, (_, i) => ({
        latitude: 40.7 + i * 0.01,
        longitude: -74.0 + i * 0.01,
      }));

      const durations = Array.from({ length: 10 }, () =>
        Array.from({ length: 10 }, () => Math.random() * 5000)
      );
      const distances = Array.from({ length: 10 }, () =>
        Array.from({ length: 10 }, () => Math.random() * 100000)
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          durations,
          distances,
        }),
      });

      const matrix = await provider.getDistanceMatrix(points);

      expect(matrix.durations).toHaveLength(10);
      expect(matrix.distances).toHaveLength(10);
    });

    it('should handle very long routes with many waypoints', async () => {
      const waypoints = Array.from({ length: 50 }, (_, i) => ({
        latitude: 40.7 + i * 0.01,
        longitude: -74.0 + i * 0.01,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          routes: [
            {
              distance: 700000,
              duration: 40000,
              geometry: {
                type: 'LineString',
                coordinates: waypoints.map(w => [w.longitude, w.latitude]),
              },
              legs: Array.from({ length: 49 }, () => ({
                distance: 14285,
                duration: 816,
                steps: [],
              })),
            },
          ],
        }),
      });

      const route = await provider.getRouteWithWaypoints(waypoints);

      expect(route.distanceMeters).toBe(700000);
      expect(route.durationSeconds).toBe(40000);
      expect(route.geometry.length).toBe(50);
    });

    it('should handle coordinates at boundary values', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          routes: [
            {
              distance: 50000,
              duration: 3000,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-180, 85],
                  [-170, 75],
                ],
              },
              legs: [],
            },
          ],
        }),
      });

      const route = await provider.getRoute(
        { latitude: 85, longitude: -180 },
        { latitude: 75, longitude: -170 }
      );

      expect(route.geometry[0][0]).toBe(-180);
      expect(route.geometry[0][1]).toBe(85);
    });

    it('should handle optimization with many waypoints', async () => {
      const waypoints = Array.from({ length: 20 }, (_, i) => ({
        latitude: 40.7 + i * 0.01,
        longitude: -74.0 + i * 0.01,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          code: 'Ok',
          trips: [
            {
              distance: 200000,
              duration: 12000,
              waypoint_indices: Array.from({ length: 20 }, (_, i) => i).sort(
                () => Math.random() - 0.5
              ),
              waypoint_names: [],
              legs: [],
            },
          ],
        }),
      });

      const result = await provider.optimizeRoute(waypoints);

      expect(result.order).toHaveLength(20);
    });
  });
});
