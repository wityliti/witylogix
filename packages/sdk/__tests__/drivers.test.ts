/**
 * Tests for DriversResource
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WitylogixClient } from '../src/client';
import { DriversResource } from '../src/resources/drivers';
import type { Driver, PaginatedResponse } from '../src/types';

global.fetch = vi.fn();

describe('DriversResource', () => {
  const mockFetch = global.fetch as any;
  const baseUrl = 'https://api.witylogix.com';
  const apiKey = 'test-api-key';

  let client: WitylogixClient;
  let drivers: DriversResource;

  const mockDriver: Driver = {
    id: 'driver-123',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    status: 'active',
    vehicle_id: 'van-001',
    current_location: {
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 10,
      address: '123 Main St',
    },
    assigned_zone_id: 'zone-123',
    available_capacity: 400,
    total_capacity: 500,
    created_at: '2024-03-10T12:00:00Z',
    updated_at: '2024-03-10T12:00:00Z',
  };

  beforeEach(() => {
    client = new WitylogixClient({ baseUrl, apiKey });
    drivers = new DriversResource(client);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should list drivers with pagination', async () => {
      const mockResponse: PaginatedResponse<Driver> = {
        data: [mockDriver],
        pagination: {
          page: 1,
          limit: 50,
          total: 100,
          pages: 2,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await drivers.list({ page: 1, limit: 50 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/drivers'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('driver-123');
    });
  });

  describe('get', () => {
    it('should get a single driver by ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockDriver,
        text: async () => JSON.stringify(mockDriver),
      });

      const result = await drivers.get('driver-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/drivers/driver-123'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.id).toBe('driver-123');
      expect(result.name).toBe('John Doe');
    });

    it('should include all driver details in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockDriver,
        text: async () => JSON.stringify(mockDriver),
      });

      const result = await drivers.get('driver-123');
      expect(result.status).toBe('active');
      expect(result.vehicle_id).toBe('van-001');
      expect(result.available_capacity).toBe(400);
      expect(result.assigned_zone_id).toBe('zone-123');
    });
  });

  describe('create', () => {
    it('should create a new driver', async () => {
      const createData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+9876543210',
        vehicle_id: 'van-002',
        total_capacity: 500,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ ...mockDriver, ...createData, id: 'driver-456' }),
        text: async () => JSON.stringify({ ...mockDriver, ...createData, id: 'driver-456' }),
      });

      const result = await drivers.create(createData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/drivers'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(createData),
        })
      );
      expect(result.id).toBeDefined();
    });

    it('should include all create fields in request body', async () => {
      const createData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+9876543210',
        vehicle_id: 'van-002',
        assigned_zone_id: 'zone-456',
        total_capacity: 600,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ ...mockDriver, ...createData }),
        text: async () => JSON.stringify({ ...mockDriver, ...createData }),
      });

      await drivers.create(createData);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.assigned_zone_id).toBe('zone-456');
    });
  });

  describe('update', () => {
    it('should update a driver with partial data', async () => {
      const updateData = {
        phone: '+1111111111',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ ...mockDriver, ...updateData }),
        text: async () => JSON.stringify({ ...mockDriver, ...updateData }),
      });

      const result = await drivers.update('driver-123', updateData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/drivers/driver-123'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updateData),
        })
      );
      expect(result.phone).toBe('+1111111111');
    });

    it('should use PATCH method for updates', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockDriver,
        text: async () => JSON.stringify(mockDriver),
      });

      await drivers.update('driver-123', { phone: '+1111111111' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  describe('delete', () => {
    it('should delete a driver', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: async () => '',
      });

      await drivers.delete('driver-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/drivers/driver-123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('updateLocation', () => {
    it('should update driver location with coordinates', async () => {
      const locationData = {
        latitude: 40.7580,
        longitude: -73.9855,
        accuracy: 5,
        timestamp: '2024-03-10T13:00:00Z',
      };

      const updatedDriver = {
        ...mockDriver,
        current_location: {
          latitude: 40.7580,
          longitude: -73.9855,
          accuracy: 5,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => updatedDriver,
        text: async () => JSON.stringify(updatedDriver),
      });

      const result = await drivers.updateLocation('driver-123', locationData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/drivers/driver-123/location'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(locationData),
        })
      );
      expect(result.current_location?.latitude).toBe(40.7580);
      expect(result.current_location?.longitude).toBe(-73.9855);
    });

    it('should include all location fields in request', async () => {
      const locationData = {
        latitude: 40.7580,
        longitude: -73.9855,
        accuracy: 5,
        timestamp: '2024-03-10T13:00:00Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockDriver,
        text: async () => JSON.stringify(mockDriver),
      });

      await drivers.updateLocation('driver-123', locationData);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.latitude).toBe(40.7580);
      expect(callBody.longitude).toBe(-73.9855);
      expect(callBody.accuracy).toBe(5);
      expect(callBody.timestamp).toBe('2024-03-10T13:00:00Z');
    });
  });

  describe('getByStatus', () => {
    it('should get drivers filtered by status', async () => {
      const mockResponse: PaginatedResponse<Driver> = {
        data: [mockDriver],
        pagination: {
          page: 1,
          limit: 50,
          total: 50,
          pages: 1,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await drivers.getByStatus('active');

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('status=active');
      expect(result.data).toHaveLength(1);
    });

    it('should accept pagination params with status filter', async () => {
      const mockResponse: PaginatedResponse<Driver> = {
        data: [mockDriver],
        pagination: {
          page: 2,
          limit: 10,
          total: 20,
          pages: 2,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      await drivers.getByStatus('inactive', { page: 2, limit: 10 });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('status=inactive');
      expect(callUrl).toContain('page=2');
    });
  });

  describe('getByZone', () => {
    it('should get drivers assigned to a specific zone', async () => {
      const mockResponse: PaginatedResponse<Driver> = {
        data: [mockDriver],
        pagination: {
          page: 1,
          limit: 50,
          total: 5,
          pages: 1,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await drivers.getByZone('zone-123');

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('assigned_zone_id=zone-123');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getAvailable', () => {
    it('should get available drivers with capacity', async () => {
      const mockResponse: PaginatedResponse<Driver> = {
        data: [mockDriver],
        pagination: {
          page: 1,
          limit: 10,
          total: 3,
          pages: 1,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await drivers.getAvailable({ limit: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/drivers/available'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.data).toHaveLength(1);
    });
  });

  describe('setStatus', () => {
    it('should update driver status', async () => {
      const updatedDriver = { ...mockDriver, status: 'on_leave' as const };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => updatedDriver,
        text: async () => JSON.stringify(updatedDriver),
      });

      const result = await drivers.setStatus('driver-123', 'on_leave');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/drivers/driver-123'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'on_leave' }),
        })
      );
      expect(result.status).toBe('on_leave');
    });

    it('should accept various status values', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockDriver,
        text: async () => JSON.stringify(mockDriver),
      });

      await drivers.setStatus('driver-123', 'suspended');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.status).toBe('suspended');
    });
  });
});
