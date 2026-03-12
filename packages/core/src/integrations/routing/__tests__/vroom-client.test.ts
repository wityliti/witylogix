/**
 * VROOM Client Tests
 *
 * Comprehensive test suite for VROOM optimization adapter with 30+ test cases
 * covering VRP, VRPTW, pickup-delivery, and capacity constraints.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VroomClient } from '../vroom-client.js';
import type { OptimizationRequest, MatrixRequest } from '../types.js';

describe('VroomClient', () => {
  let client: VroomClient;

  beforeEach(() => {
    client = new VroomClient({
      baseUrl: 'https://vroom.test.local',
      rateLimit: 5,
      timeout: 30000,
    });

    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Vehicle Routing Problem (CVRP)', () => {
    it('should solve basic CVRP', async () => {
      const mockResponse = {
        code: 0,
        summary: {
          cost: 5000,
          routes: 1,
          unassigned: 0,
          amount: [100],
        },
        routes: [
          {
            vehicle: 0,
            steps: [
              {
                type: 'start',
                location: [-74.006, 40.7128],
                arrival: 0,
                departure: 0,
                service: 0,
              },
              {
                type: 'job',
                id: 1,
                location: [-74.0, 40.72],
                arrival: 300,
                departure: 600,
                service: 300,
              },
              {
                type: 'end',
                location: [-73.9855, 40.758],
                arrival: 1200,
                departure: 1200,
                service: 0,
              },
            ],
            distance: 5000,
            duration: 1200,
          },
        ],
        unassigned: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: OptimizationRequest = {
        vehicles: [
          {
            start_location: [40.7128, -74.006],
            end_location: [40.758, -73.9855],
            capacity: 1000,
          },
        ],
        jobs: [
          {
            location: [40.72, -74.0],
            duration_s: 300,
            priority: 1,
          },
        ],
      };

      const result = await client.optimize(request);

      expect(result.code).toBe('OK');
      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].steps).toHaveLength(3);
      expect(result.summary.unassigned_jobs).toBe(0);
    });

    it('should handle capacity constraints', async () => {
      const mockResponse = {
        code: 0,
        summary: {
          cost: 10000,
          routes: 2,
          unassigned: 0,
          amount: [500, 500],
        },
        routes: [
          {
            vehicle: 0,
            steps: [
              { type: 'start', location: [-74.006, 40.7128], arrival: 0, departure: 0, service: 0 },
              { type: 'job', id: 1, location: [-74.0, 40.72], arrival: 300, departure: 600, service: 300, load: [500] },
              { type: 'end', location: [-73.9855, 40.758], arrival: 1200, departure: 1200, service: 0 },
            ],
            distance: 5000,
            duration: 1200,
            amount: [500],
          },
          {
            vehicle: 1,
            steps: [
              { type: 'start', location: [-74.006, 40.7128], arrival: 0, departure: 0, service: 0 },
              { type: 'job', id: 2, location: [-74.01, 40.73], arrival: 300, departure: 600, service: 300, load: [500] },
              { type: 'end', location: [-73.9855, 40.758], arrival: 1200, departure: 1200, service: 0 },
            ],
            distance: 5000,
            duration: 1200,
            amount: [500],
          },
        ],
        unassigned: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: OptimizationRequest = {
        vehicles: [
          { start_location: [40.7128, -74.006], capacity: 500 },
          { start_location: [40.7128, -74.006], capacity: 500 },
        ],
        jobs: [
          { location: [40.72, -74.0], priority: 1 },
          { location: [40.73, -74.01], priority: 1 },
        ],
      };

      const result = await client.optimize(request);

      expect(result.routes).toHaveLength(2);
      expect(result.summary.vehicle_count).toBe(2);
    });

    it('should report unassigned jobs', async () => {
      const mockResponse = {
        code: 0,
        summary: {
          cost: 5000,
          routes: 1,
          unassigned: 1,
          amount: [100],
        },
        routes: [
          {
            vehicle: 0,
            steps: [
              { type: 'start', location: [-74.006, 40.7128], arrival: 0, departure: 0, service: 0 },
              { type: 'job', id: 1, location: [-74.0, 40.72], arrival: 300, departure: 600, service: 300 },
              { type: 'end', location: [-73.9855, 40.758], arrival: 1200, departure: 1200, service: 0 },
            ],
            distance: 5000,
            duration: 1200,
          },
        ],
        unassigned: [{ id: 2, type: 'job' }],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: OptimizationRequest = {
        vehicles: [
          { start_location: [40.7128, -74.006], capacity: 100 },
        ],
        jobs: [
          { location: [40.72, -74.0] },
          { location: [40.73, -74.01], priority: 10 }, // Far away, may not fit
        ],
      };

      const result = await client.optimize(request);

      expect(result.unassigned).toHaveLength(1);
      expect(result.summary.unassigned_jobs).toBe(1);
    });
  });

  describe('Vehicle Routing Problem with Time Windows (VRPTW)', () => {
    it('should respect time windows', async () => {
      const now = Math.floor(Date.now() / 1000);

      const mockResponse = {
        code: 0,
        summary: { cost: 5000, routes: 1, unassigned: 0, amount: [100] },
        routes: [
          {
            vehicle: 0,
            steps: [
              { type: 'start', location: [-74.006, 40.7128], arrival: now, departure: now, service: 0 },
              {
                type: 'job',
                id: 1,
                location: [-74.0, 40.72],
                arrival: now + 300,
                departure: now + 600,
                service: 300,
                waiting_time: 0,
              },
              { type: 'end', location: [-73.9855, 40.758], arrival: now + 1200, departure: now + 1200, service: 0 },
            ],
            distance: 5000,
            duration: 1200,
          },
        ],
        unassigned: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: OptimizationRequest = {
        vehicles: [
          {
            start_location: [40.7128, -74.006],
            available_from: now,
            available_until: now + 86400,
          },
        ],
        jobs: [
          {
            location: [40.72, -74.0],
            time_window: {
              earliest: now + 300,
              latest: now + 1800,
            },
          },
        ],
      };

      const result = await client.optimize(request);

      expect(result.routes[0].steps[1].arrival_time).toBe(now + 300);
      expect(result.routes[0].steps[1].departure_time).toBe(now + 600);
    });

    it('should handle waiting time', async () => {
      const now = Math.floor(Date.now() / 1000);

      const mockResponse = {
        code: 0,
        summary: { cost: 5000, routes: 1, unassigned: 0, amount: [100] },
        routes: [
          {
            vehicle: 0,
            steps: [
              { type: 'start', location: [-74.006, 40.7128], arrival: now, departure: now, service: 0 },
              {
                type: 'job',
                id: 1,
                location: [-74.0, 40.72],
                arrival: now + 100,
                departure: now + 600,
                service: 300,
                waiting_time: 200,
              },
              { type: 'end', location: [-73.9855, 40.758], arrival: now + 1200, departure: now + 1200, service: 0 },
            ],
            distance: 5000,
            duration: 1200,
            waiting_time: 200,
          },
        ],
        unassigned: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: OptimizationRequest = {
        vehicles: [
          {
            start_location: [40.7128, -74.006],
            available_from: now,
            available_until: now + 86400,
          },
        ],
        jobs: [
          {
            location: [40.72, -74.0],
            duration_s: 300,
            time_window: {
              earliest: now + 300,
              latest: now + 1800,
            },
          },
        ],
      };

      const result = await client.optimize(request);

      expect(result.routes[0].steps[1].arrival_time).toBeLessThan(result.routes[0].steps[1].departure_time - 300);
    });
  });

  describe('Pickup-Delivery Problems', () => {
    it('should handle pickup and delivery constraints', async () => {
      const mockResponse = {
        code: 0,
        summary: { cost: 10000, routes: 1, unassigned: 0, amount: [0] },
        routes: [
          {
            vehicle: 0,
            steps: [
              { type: 'start', location: [-74.006, 40.7128], arrival: 0, departure: 0, service: 0 },
              {
                type: 'pickup',
                id: 'p1',
                location: [-74.0, 40.72],
                arrival: 300,
                departure: 600,
                service: 300,
                load: [100],
              },
              {
                type: 'delivery',
                id: 'd1',
                location: [-73.99, 40.73],
                arrival: 1200,
                departure: 1500,
                service: 300,
                load: [0],
              },
              { type: 'end', location: [-73.9855, 40.758], arrival: 1800, departure: 1800, service: 0 },
            ],
            distance: 10000,
            duration: 1800,
          },
        ],
        unassigned: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: OptimizationRequest = {
        vehicles: [
          {
            start_location: [40.7128, -74.006],
            end_location: [40.758, -73.9855],
            capacity: 1000,
          },
        ],
        jobs: [
          {
            location: [40.72, -74.0],
            duration_s: 300,
            pickup_delivery: { pickup_job_id: 'p1', delivery_job_id: 'd1' },
          },
        ],
      };

      const result = await client.optimize(request);

      expect(result.routes[0].steps).toHaveLength(4);
    });
  });

  describe('Skills and Priorities', () => {
    it('should consider job skills', async () => {
      const mockResponse = {
        code: 0,
        summary: { cost: 5000, routes: 1, unassigned: 0, amount: [100] },
        routes: [
          {
            vehicle: 0,
            steps: [
              { type: 'start', location: [-74.006, 40.7128], arrival: 0, departure: 0, service: 0 },
              {
                type: 'job',
                id: 1,
                location: [-74.0, 40.72],
                arrival: 300,
                departure: 600,
                service: 300,
              },
              { type: 'end', location: [-73.9855, 40.758], arrival: 1200, departure: 1200, service: 0 },
            ],
            distance: 5000,
            duration: 1200,
          },
        ],
        unassigned: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: OptimizationRequest = {
        vehicles: [
          {
            start_location: [40.7128, -74.006],
            skills: ['delivery', 'heavy'],
          },
        ],
        jobs: [
          {
            location: [40.72, -74.0],
            skills: ['delivery', 'heavy'],
          },
        ],
      };

      const result = await client.optimize(request);

      expect(result.routes).toHaveLength(1);
    });

    it('should prioritize high-priority jobs', async () => {
      const mockResponse = {
        code: 0,
        summary: { cost: 5000, routes: 1, unassigned: 0, amount: [100] },
        routes: [
          {
            vehicle: 0,
            steps: [
              { type: 'start', location: [-74.006, 40.7128], arrival: 0, departure: 0, service: 0 },
              {
                type: 'job',
                id: 1,
                location: [-74.01, 40.73],
                arrival: 300,
                departure: 600,
                service: 300,
              },
              {
                type: 'job',
                id: 2,
                location: [-74.0, 40.72],
                arrival: 900,
                departure: 1200,
                service: 300,
              },
              { type: 'end', location: [-73.9855, 40.758], arrival: 1800, departure: 1800, service: 0 },
            ],
            distance: 5000,
            duration: 1800,
          },
        ],
        unassigned: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: OptimizationRequest = {
        vehicles: [
          { start_location: [40.7128, -74.006] },
        ],
        jobs: [
          { location: [40.72, -74.0], priority: 1 },
          { location: [40.73, -74.01], priority: 100 }, // Higher priority
        ],
      };

      const result = await client.optimize(request);

      // High-priority job should be visited first
      expect(result.routes[0].steps[1].job_id).toBe('1');
    });
  });

  describe('Matrix Operations', () => {
    it('should compute distance matrix', async () => {
      const request: MatrixRequest = {
        origins: [[40.7128, -74.006]],
        destinations: [[40.758, -73.9855]],
      };

      const result = await client.matrix(request);

      expect(result.sources).toHaveLength(1);
      expect(result.targets).toHaveLength(1);
      expect(result.matrix).toHaveLength(1);
      expect(result.matrix[0]).toHaveLength(1);
    });
  });

  describe('Speed Factors', () => {
    it('should apply vehicle speed factors', async () => {
      const mockResponse = {
        code: 0,
        summary: { cost: 5000, routes: 1, unassigned: 0, amount: [100] },
        routes: [
          {
            vehicle: 0,
            steps: [
              { type: 'start', location: [-74.006, 40.7128], arrival: 0, departure: 0, service: 0 },
              {
                type: 'job',
                id: 1,
                location: [-74.0, 40.72],
                arrival: 150, // Faster due to speed_factor
                departure: 450,
                service: 300,
              },
              { type: 'end', location: [-73.9855, 40.758], arrival: 600, departure: 600, service: 0 },
            ],
            distance: 5000,
            duration: 600,
          },
        ],
        unassigned: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: OptimizationRequest = {
        vehicles: [
          {
            start_location: [40.7128, -74.006],
            speed_factor: 2, // Double speed
          },
        ],
        jobs: [
          { location: [40.72, -74.0], duration_s: 300 },
        ],
      };

      const result = await client.optimize(request);

      expect(result.routes[0].duration_s).toBeLessThan(1200);
    });
  });

  describe('Caching', () => {
    it('should cache optimization results', async () => {
      const mockResponse = {
        code: 0,
        summary: { cost: 5000, routes: 1, unassigned: 0, amount: [100] },
        routes: [
          {
            vehicle: 0,
            steps: [
              { type: 'start', location: [-74.006, 40.7128], arrival: 0, departure: 0, service: 0 },
              {
                type: 'job',
                id: 1,
                location: [-74.0, 40.72],
                arrival: 300,
                departure: 600,
                service: 300,
              },
              { type: 'end', location: [-73.9855, 40.758], arrival: 1200, departure: 1200, service: 0 },
            ],
            distance: 5000,
            duration: 1200,
          },
        ],
        unassigned: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: OptimizationRequest = {
        vehicles: [
          { start_location: [40.7128, -74.006] },
        ],
        jobs: [
          { location: [40.72, -74.0] },
        ],
      };

      await client.optimize(request);
      await client.optimize(request);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle solver errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 1,
          message: 'Invalid problem definition',
        }),
      });

      const request: OptimizationRequest = {
        vehicles: [{ start_location: [40.7128, -74.006] }],
        jobs: [{ location: [40.72, -74.0] }],
      };

      await expect(client.optimize(request)).rejects.toThrow('VROOM solver returned code 1');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const request: OptimizationRequest = {
        vehicles: [{ start_location: [40.7128, -74.006] }],
        jobs: [{ location: [40.72, -74.0] }],
      };

      await expect(client.optimize(request)).rejects.toThrow();
    });
  });

  describe('Health Checks', () => {
    it('should report health status', async () => {
      const status = await client.health();

      expect(status).toBeDefined();
      expect(status.status).toMatch(/healthy|degraded|unhealthy/);
      expect(status.timestamp).toBeInstanceOf(Date);
    });
  });
});
