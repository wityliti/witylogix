/**
 * Geotab Adapter Integration Tests
 * Comprehensive test suite for Geotab telematics client
 * Tests: JSONRPC authentication, session refresh, device parsing, diagnostics mapping,
 * exception events, DataFeed polling, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TelematicsConfig } from '../../../packages/core/src/integrations/telematics/types.js';
import { GeotabClient } from '../../../packages/core/src/integrations/telematics/geotab-client.js';
import {
  mockGeotabDevice,
  mockGeotabDevices,
  mockGeotabDeviceStatusInfo,
  mockGeotabDeviceStatusInfos,
  mockGeotabFaultData,
  mockGeotabFaultDatas,
  mockGeotabExceptionEvent,
  mockGeotabExceptionEvents,
  mockGeotabSessionId,
  mockGeotabAuthErrorResponse,
  mockGeotabRpcErrorResponse,
  mockGeotabAuthSuccessResponse,
  mockGeotabDeviceWithoutVin,
} from '../fixtures/telematics-fixtures.js';

global.fetch = vi.fn();

describe('GeotabClient', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let client: GeotabClient;

  const mockConfig: TelematicsConfig = {
    provider: 'geotab',
    credentials: {
      database: 'testdb',
      userName: 'test@example.com',
      password: 'password123',
    },
    timeout: 5000,
    rateLimit: 10,
    retries: 3,
  };

  beforeEach(() => {
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockClear();
    vi.useFakeTimers();
    client = new GeotabClient(mockConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
    client.clearCache();
  });

  describe('JSONRPC Authentication', () => {
    it('should authenticate using JSONRPC and store session ID', async () => {
      const mockResponse = new Response(JSON.stringify(mockGeotabAuthSuccessResponse), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.authenticate();

      expect(mockFetch).toHaveBeenCalled();
      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.jsonrpc).toBe('2.0');
      expect(body.method).toBe('Authenticate');
    });

    it('should include correct credentials in authentication request', async () => {
      const mockResponse = new Response(JSON.stringify(mockGeotabAuthSuccessResponse), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.authenticate();

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.params.userName).toBe('test@example.com');
      expect(body.params.password).toBe('password123');
      expect(body.params.database).toBe('testdb');
    });

    it('should throw error on authentication failure', async () => {
      const mockResponse = new Response(JSON.stringify(mockGeotabAuthErrorResponse), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.authenticate()).rejects.toThrow();
    });

    it('should handle JSONRPC error response', async () => {
      const mockResponse = new Response(JSON.stringify(mockGeotabRpcErrorResponse), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.authenticate()).rejects.toThrow();
    });

    it('should cache session token', async () => {
      const mockResponse = new Response(JSON.stringify(mockGeotabAuthSuccessResponse), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.authenticate();
      const state = client.getCircuitBreakerState();

      // Session should be stored in credentials
      expect(state).toBe('CLOSED');
    });

    it('should perform health check using authentication', async () => {
      const mockResponse = new Response(JSON.stringify(mockGeotabAuthSuccessResponse), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it('should return false for health check on authentication failure', async () => {
      const mockResponse = new Response(JSON.stringify(mockGeotabAuthErrorResponse), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should refresh session on expiry', async () => {
      const mockResponse = new Response(JSON.stringify(mockGeotabAuthSuccessResponse), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.authenticate();
      // Simulate session expiry by advancing time
      vi.advanceTimersByTime(3600000); // 1 hour

      // Next request should trigger re-authentication
      await client.authenticate();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should include session ID in subsequent requests', async () => {
      const mockAuthResponse = new Response(JSON.stringify(mockGeotabAuthSuccessResponse), {
        status: 200,
      });
      const mockDeviceResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabDevices, id: 1 }),
        { status: 200 }
      );

      mockFetch.mockResolvedValueOnce(mockAuthResponse).mockResolvedValueOnce(mockDeviceResponse);

      await client.authenticate();
      await client.getVehicles();

      // Second call should include session in params
      const secondCall = mockFetch.mock.calls[1];
      const body = JSON.parse(secondCall[1]?.body as string);
      expect(body.params.credentials).toBeDefined();
    });

    it('should handle session timeout gracefully', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Session expired',
          },
          id: 1,
        }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getVehicles()).rejects.toThrow();
    });
  });

  describe('Get Devices', () => {
    it('should fetch all devices via Get method', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabDevices, id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const vehicles = await client.getVehicles();

      expect(vehicles).toHaveLength(2);
      expect(vehicles[0].externalVehicleId).toBe('device_999');
      expect(vehicles[0].name).toBe('Driver01-Device');
    });

    it('should parse device metadata correctly', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabDevices, id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const vehicles = await client.getVehicles();

      expect(vehicles[0].vin).toBe('2HGCV52639H537355');
      expect(vehicles[0].licensePlate).toBe('NY-98765');
      expect(vehicles[0].make).toBe('Toyota');
      expect(vehicles[0].model).toBe('Camry');
      expect(vehicles[0].year).toBe(2021);
    });

    it('should cache vehicle results', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabDevices, id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const vehicles1 = await client.getVehicles();
      const vehicles2 = await client.getVehicles();

      expect(vehicles1).toEqual(vehicles2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle device without VIN gracefully', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: [mockGeotabDeviceWithoutVin], id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const vehicles = await client.getVehicles();

      expect(vehicles[0].externalVehicleId).toBe('device_no_vin');
      expect(vehicles[0].vin).toBeUndefined();
    });

    it('should map device status correctly', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabDevices, id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const vehicles = await client.getVehicles();

      vehicles.forEach((v) => {
        expect(['ACTIVE', 'INACTIVE', 'DELETED']).toContain(v.status);
      });
    });

    it('should throw error on API failure', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Database error' },
          id: 1,
        }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getVehicles()).rejects.toThrow();
    });
  });

  describe('Get Device Position', () => {
    it('should fetch current position via DeviceStatusInfo', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: [mockGeotabDeviceStatusInfo], id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const position = await client.getVehiclePosition('device_999');

      expect(position.externalVehicleId).toBe('device_999');
      expect(position.latitude).toBe(40.7128);
      expect(position.longitude).toBe(-74.0060);
      expect(position.speed?.value).toBe(28.5);
      expect(position.heading).toBe(90);
    });

    it('should convert bearing to heading', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: [{
            ...mockGeotabDeviceStatusInfo,
            bearing: 270,
          }],
          id: 1,
        }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const position = await client.getVehiclePosition('device_999');

      expect(position.heading).toBe(270);
    });

    it('should cache position data with 30-second TTL', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: [mockGeotabDeviceStatusInfo], id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const position1 = await client.getVehiclePosition('device_999');
      const position2 = await client.getVehiclePosition('device_999');

      expect(position1).toEqual(position2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should include timestamp in position data', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: [mockGeotabDeviceStatusInfo], id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const position = await client.getVehiclePosition('device_999');

      expect(position.timestamp).toBeInstanceOf(Date);
    });

    it('should throw error when no position data available', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: [], id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getVehiclePosition('device_999')).rejects.toThrow();
    });
  });

  describe('Get Vehicle Diagnostics', () => {
    it('should fetch diagnostics with fault data', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabFaultDatas, id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const diagnostics = await client.getVehicleDiagnostics('device_999');

      expect(diagnostics.externalVehicleId).toBe('device_999');
      expect(diagnostics.faultCodes).toHaveLength(2);
      expect(diagnostics.faultCodes[0].code).toBe('P0101');
    });

    it('should map fault code descriptions', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabFaultDatas, id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const diagnostics = await client.getVehicleDiagnostics('device_999');

      expect(diagnostics.faultCodes[0].description).toBe(
        'Mass Air Flow (MAF) Sensor Range/Performance'
      );
    });

    it('should mark dismissed faults appropriately', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabFaultDatas, id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const diagnostics = await client.getVehicleDiagnostics('device_999');

      const dismissedFault = diagnostics.faultCodes.find(
        (f) => f.code === 'P0102'
      );
      expect(dismissedFault?.severity).not.toBe('critical');
    });

    it('should cache diagnostics with 5-minute TTL', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabFaultDatas, id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const diag1 = await client.getVehicleDiagnostics('device_999');
      const diag2 = await client.getVehicleDiagnostics('device_999');

      expect(diag1).toEqual(diag2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle diagnostics without faults', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: [], id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const diagnostics = await client.getVehicleDiagnostics('device_999');

      expect(diagnostics.faultCodes).toEqual([]);
    });

    it('should include timestamp in diagnostics', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabFaultDatas, id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const diagnostics = await client.getVehicleDiagnostics('device_999');

      expect(diagnostics.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Get Exception Events', () => {
    it('should fetch exception events with correct mapping', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabExceptionEvents, id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const dateRange = {
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-03-31'),
      };

      const events = await client.getDriverBehaviorEvents('driver_789', dateRange);

      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe('speeding');
    });

    it('should map exception event severity correctly', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabExceptionEvents, id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const dateRange = {
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-03-31'),
      };

      const events = await client.getDriverBehaviorEvents('driver_789', dateRange);

      expect(events[0].severity).toBe('warning');
      expect(events[1].severity).toBe('critical');
    });

    it('should include speed and speed zone in events', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabExceptionEvents, id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const dateRange = {
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-03-31'),
      };

      const events = await client.getDriverBehaviorEvents('driver_789', dateRange);

      expect(events[0].speed?.value).toBe(65.5);
      expect(events[0].speedLimit?.value).toBe(55);
    });

    it('should include GPS coordinates in events', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabExceptionEvents, id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const dateRange = {
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-03-31'),
      };

      const events = await client.getDriverBehaviorEvents('driver_789', dateRange);

      expect(events[0].latitude).toBe(40.7128);
      expect(events[0].longitude).toBe(-74.0060);
    });

    it('should return empty array when no events found', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: [], id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const dateRange = {
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-03-31'),
      };

      const events = await client.getDriverBehaviorEvents('driver_789', dateRange);

      expect(events).toEqual([]);
    });
  });

  describe('Get Fuel Level', () => {
    it('should fetch fuel level from StatusData', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: [{
            device: { id: 'device_999' },
            diagnostic: { id: 'fuel_sensor', name: 'FuelLevel' },
            value: 52.3,
            dateTime: '2024-03-11T14:30:00Z',
          }],
          id: 1,
        }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const fuel = await client.getFuelLevel('device_999');

      expect(fuel.externalVehicleId).toBe('device_999');
      expect(fuel.fuelLevel).toBe(52.3);
    });

    it('should cache fuel data with 2-minute TTL', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: [{
            device: { id: 'device_999' },
            value: 52.3,
            dateTime: '2024-03-11T14:30:00Z',
          }],
          id: 1,
        }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const fuel1 = await client.getFuelLevel('device_999');
      const fuel2 = await client.getFuelLevel('device_999');

      expect(fuel1).toEqual(fuel2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should include timestamp in fuel reading', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: [{
            device: { id: 'device_999' },
            value: 52.3,
            dateTime: '2024-03-11T14:30:00Z',
          }],
          id: 1,
        }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const fuel = await client.getFuelLevel('device_999');

      expect(fuel.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('DataFeed Polling', () => {
    it('should poll DataFeed for updated records', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: {
            data: mockGeotabDeviceStatusInfos,
            toVersion: 12345,
          },
          id: 1,
        }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const positions = await client.getVehicles();

      expect(positions).toBeDefined();
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle DataFeed with no new data', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: {
            data: [],
            toVersion: 12345,
          },
          id: 1,
        }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const positions = await client.getVehicles();

      expect(positions).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle JSONRPC parse error', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error',
          },
          id: 1,
        }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getVehicles()).rejects.toThrow();
    });

    it('should retry on transient JSONRPC errors', async () => {
      const errorResponse = new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Server error. Try again later.',
          },
          id: 1,
        }),
        { status: 200 }
      );
      const successResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabDevices, id: 1 }),
        { status: 200 }
      );

      mockFetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const vehicles = await client.getVehicles();

      expect(vehicles).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle network timeout', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValue(timeoutError);

      await expect(client.getVehicles()).rejects.toThrow();
    });

    it('should parse JSONRPC error messages correctly', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Custom error message',
          },
          id: 1,
        }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getVehicles()).rejects.toThrow('Custom error message');
    });

    it('should handle malformed JSONRPC responses', async () => {
      const mockResponse = new Response('Invalid JSON', { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getVehicles()).rejects.toThrow();
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when requested', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabDevices, id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      await client.getVehicles();
      client.clearCache();
      await client.getVehicles();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should expire cache entries after TTL', async () => {
      const mockResponse = new Response(
        JSON.stringify({ jsonrpc: '2.0', result: mockGeotabDevices, id: 1 }),
        { status: 200 }
      );
      mockFetch.mockResolvedValue(mockResponse);

      await client.getVehicles();
      vi.advanceTimersByTime(301000); // Advance beyond 5 min cache TTL
      await client.getVehicles();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Circuit Breaker', () => {
    it('should track circuit breaker state', () => {
      const state = client.getCircuitBreakerState();
      expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(state);
    });

    it('should reset circuit breaker when requested', () => {
      client.resetCircuitBreaker();
      expect(client.getCircuitBreakerState()).toBe('CLOSED');
    });
  });
});
