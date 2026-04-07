/**
 * HERE SDK Client Tests
 *
 * Mock HTTP responses for:
 * - Autosuggest
 * - Geocoding (forward and reverse)
 * - Route calculation (standard, truck, EV)
 * - Matrix routing
 * - Error handling and rate limiting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HERESDKClient, createHEREClient } from '../here-sdk-client.js';
import type { RouteRequest, MatrixRequest } from '../types.js';

describe('HERESDKClient', () => {
  let client: HERESDKClient;

  beforeEach(() => {
    client = new HERESDKClient({
      apiKey: 'test-api-key',
      timeout: 5000,
    });

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  describe('autosuggest', () => {
    it('should return suggestions for partial query', async () => {
      const mockResponse = {
        items: [
          {
            title: 'New York, NY, United States',
            id: 'place-123',
            position: { lat: 40.7128, lng: -74.006 },
            address: {
              label: 'New York, NY, United States',
              city: 'New York',
              state: 'NY',
              countryCode: 'USA',
            },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const results = await client.autosuggest('New York', { limit: 5 });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        title: 'New York, NY, United States',
        placeId: 'place-123',
        position: { lat: 40.7128, lng: -74.006 },
        address: 'New York, NY, United States',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/autosuggest'),
        expect.any(Object),
      );
    });

    it('should handle empty results', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      } as Response);

      const results = await client.autosuggest('xyz123xyz');

      expect(results).toEqual([]);
    });

    it('should handle API errors', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Invalid API key' }),
        statusText: 'Unauthorized',
      } as Response);

      await expect(client.autosuggest('test')).rejects.toThrow('HERE autosuggest error');
    });
  });

  describe('geocode', () => {
    it('should geocode address to coordinates', async () => {
      const mockResponse = {
        items: [
          {
            id: 'result-1',
            position: { lat: 40.7128, lng: -74.006 },
            address: {
              label: '350 5th Avenue, New York, NY 10118, United States',
              street: '350 5th Avenue',
              city: 'New York',
              state: 'NY',
              postalCode: '10118',
            },
            localityType: 'address',
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const results = await client.geocode('350 5th Avenue, New York');

      expect(results).toHaveLength(1);
      expect(results[0].lat).toBe(40.7128);
      expect(results[0].lng).toBe(-74.006);
      expect(results[0].confidence).toBeGreaterThan(0.9);
    });

    it('should return multiple results', async () => {
      const mockResponse = {
        items: [
          {
            id: 'result-1',
            position: { lat: 40.7128, lng: -74.006 },
            address: { label: 'New York, NY' },
            localityType: 'address',
          },
          {
            id: 'result-2',
            position: { lat: 40.7589, lng: -73.9851 },
            address: { label: 'Central Park, New York' },
            localityType: 'park',
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const results = await client.geocode('New York');

      expect(results).toHaveLength(2);
      expect(results[0].formattedAddress).toContain('New York');
    });
  });

  describe('reverseGeocode', () => {
    it('should reverse geocode coordinates to address', async () => {
      const mockResponse = {
        items: [
          {
            id: 'result-1',
            position: { lat: 40.7128, lng: -74.006 },
            address: {
              label: 'Times Square, New York, NY, United States',
              street: 'Times Square',
              city: 'New York',
              state: 'NY',
              countryName: 'United States',
            },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.reverseGeocode(40.7128, -74.006);

      expect(result.address).toContain('Times Square');
      expect(result.components?.city).toBe('New York');
      expect(result.components?.country).toBe('United States');
    });

    it('should handle missing results', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      } as Response);

      const result = await client.reverseGeocode(90, 180);

      expect(result.address).toContain('90');
      expect(result.components).toEqual({});
    });
  });

  describe('route', () => {
    it('should calculate route with polyline and steps', async () => {
      const mockResponse = {
        routes: [
          {
            id: 'route-1',
            sections: [
              {
                id: 'section-1',
                type: 'pedestrian',
                departure: {
                  place: {
                    type: 'start',
                    location: { lat: 40.7128, lng: -74.006 },
                  },
                  time: '2024-01-01T10:00:00Z',
                },
                arrival: {
                  place: {
                    type: 'end',
                    location: { lat: 40.7589, lng: -73.9851 },
                  },
                  time: '2024-01-01T10:15:00Z',
                },
                summary: {
                  length: 2000, // meters
                  baseDuration: 900, // seconds
                  duration: 900,
                },
                polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
                steps: [
                  {
                    departure: {
                      place: {
                        location: { lat: 40.7128, lng: -74.006 },
                      },
                      time: '2024-01-01T10:00:00Z',
                    },
                    arrival: {
                      place: {
                        location: { lat: 40.714, lng: -73.99 },
                      },
                      time: '2024-01-01T10:05:00Z',
                    },
                    duration: 300,
                    length: 500,
                    instruction: 'Head north',
                    roadName: 'Broadway',
                  },
                ],
              },
            ],
            summary: {
              length: 2000,
              baseDuration: 900,
              duration: 900,
            },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
      };

      const route = await client.route(request);

      expect(route.distance_m).toBe(2000);
      expect(route.duration_s).toBe(900);
      expect(route.legs).toHaveLength(1);
      expect(route.legs[0].steps.length).toBeGreaterThan(0);
      expect(route.polyline).toBeTruthy();
      expect(route.bounds).toBeDefined();
    });

    it('should handle waypoints', async () => {
      const mockResponse = {
        routes: [
          {
            id: 'route-1',
            sections: [
              {
                id: 'section-1',
                departure: {
                  place: { type: 'start', location: { lat: 40.7128, lng: -74.006 } },
                  time: '2024-01-01T10:00:00Z',
                },
                arrival: {
                  place: { type: 'intermediate', location: { lat: 40.7489, lng: -73.9680 } },
                  time: '2024-01-01T10:10:00Z',
                },
                summary: { length: 1500, baseDuration: 600, duration: 600 },
                polyline: 'test',
                steps: [],
              },
              {
                id: 'section-2',
                departure: {
                  place: { type: 'intermediate', location: { lat: 40.7489, lng: -73.9680 } },
                  time: '2024-01-01T10:10:00Z',
                },
                arrival: {
                  place: { type: 'end', location: { lat: 40.7589, lng: -73.9851 } },
                  time: '2024-01-01T10:15:00Z',
                },
                summary: { length: 1000, baseDuration: 300, duration: 300 },
                polyline: 'test',
                steps: [],
              },
            ],
            summary: { length: 2500, baseDuration: 900, duration: 900 },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
        waypoints: [{ lat: 40.7489, lng: -73.968 }],
      };

      const route = await client.route(request);

      expect(route.legs).toHaveLength(2);
      expect(route.distance_m).toBe(2500);
    });

    it('should handle route options', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              sections: [
                {
                  summary: { length: 2000, baseDuration: 900, duration: 900 },
                  polyline: 'test',
                  departure: {
                    place: { type: 'start', location: { lat: 40.7128, lng: -74.006 } },
                  },
                  arrival: {
                    place: { type: 'end', location: { lat: 40.7589, lng: -73.9851 } },
                  },
                },
              ],
              summary: { length: 2000, baseDuration: 900, duration: 900 },
            },
          ],
        }),
      } as Response);

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.7589, -73.9851],
        options: {
          exclude_toll: true,
          exclude_motorway: true,
        },
      };

      await client.route(request);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should throw error for no route found', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ routes: [] }),
      } as Response);

      const request: RouteRequest = {
        origin: { lat: 0, lng: 0 },
        destination: { lat: 0.001, lng: 0.001 },
      };

      await expect(client.route(request)).rejects.toThrow('No route found');
    });
  });

  describe('truckRoute', () => {
    it('should calculate truck route with vehicle constraints', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              sections: [
                {
                  summary: { length: 2000, baseDuration: 900, duration: 900 },
                  polyline: 'test',
                  departure: {
                    place: { type: 'start', location: { lat: 40.7128, lng: -74.006 } },
                  },
                  arrival: {
                    place: { type: 'end', location: { lat: 40.7589, lng: -73.9851 } },
                  },
                },
              ],
              summary: { length: 2000, baseDuration: 900, duration: 900 },
            },
          ],
        }),
      } as Response);

      const route = await client.truckRoute({
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
        vehicleDimensions: { width: 2.5, height: 4.0, length: 12.0 },
        vehicleWeight: 5000,
      });

      expect(route.distance_m).toBe(2000);
      expect(route.duration_s).toBe(900);
    });
  });

  describe('evRoute', () => {
    it('should calculate EV route with battery constraints', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              sections: [
                {
                  summary: { length: 2000, baseDuration: 900, duration: 900 },
                  polyline: 'test',
                  departure: {
                    place: { type: 'start', location: { lat: 40.7128, lng: -74.006 } },
                  },
                  arrival: {
                    place: { type: 'end', location: { lat: 40.7589, lng: -73.9851 } },
                  },
                },
              ],
              summary: { length: 2000, baseDuration: 900, duration: 900 },
            },
          ],
        }),
      } as Response);

      const route = await client.evRoute({
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
        batteryCapacity: 60,
        currentCharge: 50,
      });

      expect(route.distance_m).toBe(2000);
    });
  });

  describe('matrix', () => {
    it('should calculate distance/duration matrix', async () => {
      const mockResponse = {
        matrix: [
          {
            startIndex: 0,
            endIndex: 2,
            summary: { distance: 2000, duration: 900, baseDuration: 900 },
          },
          {
            startIndex: 0,
            endIndex: 3,
            summary: { distance: 3000, duration: 1200, baseDuration: 1200 },
          },
          {
            startIndex: 1,
            endIndex: 2,
            summary: { distance: 1500, duration: 600, baseDuration: 600 },
          },
          {
            startIndex: 1,
            endIndex: 3,
            summary: { distance: 2500, duration: 900, baseDuration: 900 },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const request: MatrixRequest = {
        origins: [
          { lat: 40.7128, lng: -74.006 },
          { lat: 40.7489, lng: -73.968 },
        ],
        destinations: [
          { lat: 40.7589, lng: -73.9851 },
          { lat: 40.8, lng: -73.95 },
        ],
      };

      const matrix = await client.matrix(request);

      expect(matrix.matrix).toHaveLength(2);
      expect(matrix.matrix[0]).toHaveLength(2);
      expect(matrix.matrix[0][0].status).toBe('OK');
      expect(matrix.matrix[0][0].distance_m).toBeGreaterThan(0);
    });

    it('should handle unreachable routes', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          matrix: [
            {
              startIndex: 0,
              endIndex: 1,
              error: { type: 'UNREACHABLE', message: 'No route found' },
            },
          ],
        }),
      } as Response);

      const request: MatrixRequest = {
        origins: [{ lat: 0, lng: 0 }],
        destinations: [{ lat: 90, lng: 180 }],
      };

      const matrix = await client.matrix(request);

      expect(matrix.matrix[0][0].status).toBe('NO_ROUTE');
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
      };

      await expect(client.route(request)).rejects.toThrow();
    });

    it('should throw error if API key missing', () => {
      expect(() => {
        new HERESDKClient({
          apiKey: '',
        });
      }).toThrow('HERE API key is required');
    });
  });

  describe('factory function', () => {
    it('should create client via factory', () => {
      const factoryClient = createHEREClient({
        apiKey: 'test-key',
      });

      expect(factoryClient).toBeInstanceOf(HERESDKClient);
    });
  });
});
