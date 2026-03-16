/**
 * Google Routes SDK Tests
 *
 * Tests for Google Routes API v2 integration
 * Mock HTTP requests to avoid real API calls
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleRoutesSDK } from '../google-routes-sdk.js';
import type { RouteRequest, MatrixRequest } from '../types.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('GoogleRoutesSDK', () => {
  let sdk: GoogleRoutesSDK;

  beforeEach(() => {
    vi.clearAllMocks();

    sdk = new GoogleRoutesSDK({
      apiKey: 'test-api-key',
      timeout: 10000,
      retries: 1,
    });
  });

  describe('initialization', () => {
    it('should throw error if apiKey is not provided', () => {
      expect(() => {
        new GoogleRoutesSDK({} as any);
      }).toThrow('Google Routes API requires apiKey');
    });

    it('should initialize with valid config', () => {
      const config = { apiKey: 'test-key' };
      const instance = new GoogleRoutesSDK(config);

      expect(instance).toBeDefined();
    });

    it('should use custom baseUrl if provided', () => {
      const sdk = new GoogleRoutesSDK({
        apiKey: 'test-key',
        baseUrl: 'https://custom.example.com',
      });

      expect(sdk).toBeDefined();
    });
  });

  describe('route', () => {
    it('should compute route between origin and destination', async () => {
      const mockResponse = {
        routes: [
          {
            polyline: {
              encoded_polyline: '_p~iF~ps|U_ulLnnqC',
            },
            distance_meters: 5000,
            duration: '300s',
            legs: [
              {
                distance_meters: 5000,
                duration: '300s',
              },
            ],
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 34.0522, lng: -118.2437 },
        costing: 'auto',
        options: {
          language: 'en',
        },
      };

      const result = await sdk.route(request);

      expect(result).toBeDefined();
      expect(result.distance_m).toBeGreaterThan(0);
      expect(result.duration_s).toBeGreaterThan(0);
      expect(result.polyline).toBeDefined();
      expect(result.legs).toBeDefined();
    });

    it('should throw error if no route found', async () => {
      const mockResponse = {
        routes: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 34.0522, lng: -118.2437 },
      };

      await expect(sdk.route(request)).rejects.toThrow();
    });

    it('should handle API error responses', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'Invalid request' },
        }),
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 34.0522, lng: -118.2437 },
      };

      await expect(sdk.route(request)).rejects.toThrow();
    });

    it('should include waypoints in route request', async () => {
      const mockResponse = {
        routes: [
          {
            polyline: { encoded_polyline: 'test' },
            distance_meters: 5000,
            duration: '300s',
            legs: [],
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 34.0522, lng: -118.2437 },
        waypoints: [{ lat: 35.0, lng: -100.0 }],
      };

      await sdk.route(request);

      expect(global.fetch).toHaveBeenCalled();
      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[0]).toContain('/computeRoutes');
    });

    it('should set traffic mode when alternatives requested', async () => {
      const mockResponse = {
        routes: [
          {
            polyline: { encoded_polyline: 'test' },
            distance_meters: 5000,
            duration: '300s',
            legs: [],
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 34.0522, lng: -118.2437 },
        options: { alternatives: true },
      };

      await sdk.route(request);

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('matrix', () => {
    it('should compute distance/duration matrix', async () => {
      const mockResponse = {
        elements: [
          { distance_meters: 1000, duration: '60s' },
          { distance_meters: 2000, duration: '120s' },
          { distance_meters: 1500, duration: '90s' },
          { distance_meters: 2500, duration: '150s' },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: MatrixRequest = {
        origins: [
          { lat: 40.7128, lng: -74.006 },
          { lat: 34.0522, lng: -118.2437 },
        ],
        destinations: [
          { lat: 41.8781, lng: -87.6298 },
          { lat: 29.7604, lng: -95.3698 },
        ],
      };

      const result = await sdk.matrix(request);

      expect(result).toBeDefined();
      expect(result.sources).toHaveLength(2);
      expect(result.targets).toHaveLength(2);
      expect(result.matrix).toHaveLength(2);
      expect(result.matrix[0]).toHaveLength(2);
    });

    it('should handle empty matrix response', async () => {
      const mockResponse = {
        elements: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: MatrixRequest = {
        origins: [{ lat: 0, lng: 0 }],
        destinations: [{ lat: 1, lng: 1 }],
      };

      const result = await sdk.matrix(request);

      expect(result.matrix).toBeDefined();
    });

    it('should map element status codes correctly', async () => {
      const mockResponse = {
        elements: [
          { distance_meters: 1000, duration: '60s', status: { code: 0 } }, // OK
          { status: { code: 12 } }, // UNREACHABLE
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: MatrixRequest = {
        origins: [{ lat: 0, lng: 0 }],
        destinations: [{ lat: 1, lng: 1 }],
      };

      const result = await sdk.matrix(request);

      expect(result.matrix[0][0].status).toBe('OK');
      expect(result.matrix[0][1].status).toBe('UNREACHABLE');
    });
  });

  describe('rate limiting', () => {
    it('should track rate limit info from response headers', async () => {
      const headers = new Headers();
      headers.set('x-goog-remaining-quota', '95');
      headers.set('x-goog-quota-limit', '100');

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              polyline: { encoded_polyline: 'test' },
              distance_meters: 1000,
              duration: '60s',
              legs: [],
            },
          ],
        }),
        headers,
      });

      const request: RouteRequest = {
        origin: { lat: 0, lng: 0 },
        destination: { lat: 1, lng: 1 },
      };

      await sdk.route(request);

      const rateLimitInfo = sdk.getRateLimitInfo();
      expect(rateLimitInfo.remaining).toBe(95);
      expect(rateLimitInfo.limit).toBe(100);
    });

    it('should have default rate limit info', () => {
      const rateLimitInfo = sdk.getRateLimitInfo();

      expect(rateLimitInfo).toBeDefined();
      expect(rateLimitInfo.limit).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const request: RouteRequest = {
        origin: { lat: 0, lng: 0 },
        destination: { lat: 1, lng: 1 },
      };

      await expect(sdk.route(request)).rejects.toThrow();
    });

    it('should extract error message from Google error response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 3,
            message: 'Invalid Argument: test error',
            details: [{ reason: 'INVALID_ARGUMENT' }],
          },
        }),
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 0, lng: 0 },
        destination: { lat: 1, lng: 1 },
      };

      await expect(sdk.route(request)).rejects.toThrow('Invalid Argument: test error');
    });
  });

  describe('coordinate normalization', () => {
    it('should handle [lat, lng] array format', async () => {
      const mockResponse = {
        routes: [
          {
            polyline: { encoded_polyline: 'test' },
            distance_meters: 1000,
            duration: '60s',
            legs: [],
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [34.0522, -118.2437],
      };

      await sdk.route(request);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle {lat, lng} object format', async () => {
      const mockResponse = {
        routes: [
          {
            polyline: { encoded_polyline: 'test' },
            distance_meters: 1000,
            duration: '60s',
            legs: [],
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 34.0522, lng: -118.2437 },
      };

      await sdk.route(request);

      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
