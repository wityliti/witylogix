/**
 * Tests for OrdersResource
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WitylogixClient } from '../src/client';
import { OrdersResource } from '../src/resources/orders';
import type { Order, PaginatedResponse } from '../src/types';

global.fetch = vi.fn();

describe('OrdersResource', () => {
  const mockFetch = global.fetch as any;
  const baseUrl = 'https://api.witylogix.com';
  const apiKey = 'test-api-key';

  let client: WitylogixClient;
  let orders: OrdersResource;

  const mockOrder: Order = {
    id: 'order-123',
    reference_number: 'ORD-001',
    status: 'pending',
    customer_id: 'cust-123',
    origin: {
      latitude: 40.7128,
      longitude: -74.006,
      address: '123 Main St',
      postal_code: '10001',
      city: 'New York',
      country: 'USA',
    },
    destination: {
      latitude: 40.758,
      longitude: -73.9855,
      address: '456 Park Ave',
      postal_code: '10022',
      city: 'New York',
      country: 'USA',
    },
    items: [
      {
        sku: 'ITEM-1',
        name: 'Package',
        quantity: 1,
      },
    ],
    assigned_driver_id: 'driver-123',
    scheduled_date: '2024-03-15',
    created_at: '2024-03-10T12:00:00Z',
    updated_at: '2024-03-10T12:00:00Z',
  };

  beforeEach(() => {
    client = new WitylogixClient({ baseUrl, apiKey });
    orders = new OrdersResource(client);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should list orders with pagination params', async () => {
      const mockResponse: PaginatedResponse<Order> = {
        data: [mockOrder],
        pagination: {
          page: 1,
          limit: 20,
          total: 100,
          pages: 5,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await orders.list({ page: 1, limit: 20 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/orders'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('order-123');
      expect(result.pagination.page).toBe(1);
    });

    it('should list orders with sort parameters', async () => {
      const mockResponse: PaginatedResponse<Order> = {
        data: [mockOrder],
        pagination: {
          page: 1,
          limit: 20,
          total: 100,
          pages: 5,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      await orders.list({ page: 1, limit: 20, sort_by: 'created_at', sort_order: 'desc' });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('sort_by=created_at');
      expect(callUrl).toContain('sort_order=desc');
    });

    it('should list orders without params', async () => {
      const mockResponse: PaginatedResponse<Order> = {
        data: [mockOrder],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
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

      const result = await orders.list();
      expect(result.data).toBeDefined();
    });
  });

  describe('get', () => {
    it('should get a single order by ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockOrder,
        text: async () => JSON.stringify(mockOrder),
      });

      const result = await orders.get('order-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/orders/order-123'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.id).toBe('order-123');
      expect(result.reference_number).toBe('ORD-001');
    });

    it('should include order details in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockOrder,
        text: async () => JSON.stringify(mockOrder),
      });

      const result = await orders.get('order-123');
      expect(result.status).toBe('pending');
      expect(result.items).toHaveLength(1);
      expect(result.assigned_driver_id).toBe('driver-123');
    });
  });

  describe('create', () => {
    it('should create a new order with order data', async () => {
      const createData = {
        reference_number: 'ORD-001',
        customer_id: 'cust-123',
        origin: {
          latitude: 40.7128,
          longitude: -74.006,
        },
        destination: {
          latitude: 40.758,
          longitude: -73.9855,
        },
        items: [
          {
            sku: 'ITEM-1',
            name: 'Package',
            quantity: 1,
          },
        ],
        scheduled_date: '2024-03-15',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockOrder,
        text: async () => JSON.stringify(mockOrder),
      });

      const result = await orders.create(createData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/orders'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(createData),
        })
      );
      expect(result.id).toBe('order-123');
    });

    it('should include all order fields in request body', async () => {
      const createData = {
        reference_number: 'ORD-002',
        customer_id: 'cust-456',
        origin: {
          latitude: 40.7128,
          longitude: -74.006,
          address: '123 Main St',
          postal_code: '10001',
        },
        destination: {
          latitude: 40.758,
          longitude: -73.9855,
          address: '456 Park Ave',
          postal_code: '10022',
        },
        items: [
          {
            sku: 'ITEM-1',
            name: 'Package',
            quantity: 2,
            weight: 5.5,
          },
        ],
        scheduled_date: '2024-03-15',
        time_slot: {
          start_time: '09:00',
          end_time: '12:00',
          date: '2024-03-15',
        },
        special_instructions: 'Leave at door',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockOrder,
        text: async () => JSON.stringify(mockOrder),
      });

      await orders.create(createData);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.special_instructions).toBe('Leave at door');
      expect(callBody.time_slot).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update order with partial data', async () => {
      const updateData = {
        special_instructions: 'Ring doorbell twice',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ ...mockOrder, ...updateData }),
        text: async () => JSON.stringify({ ...mockOrder, ...updateData }),
      });

      const result = await orders.update('order-123', updateData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/orders/order-123'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updateData),
        })
      );
      expect(result.special_instructions).toBe('Ring doorbell twice');
    });

    it('should use PATCH method for updates', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockOrder,
        text: async () => JSON.stringify(mockOrder),
      });

      await orders.update('order-123', { special_instructions: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  describe('delete', () => {
    it('should delete an order', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: async () => '',
      });

      await orders.delete('order-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/orders/order-123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('assign', () => {
    it('should assign order to a driver', async () => {
      const assignedOrder = { ...mockOrder, assigned_driver_id: 'driver-456' };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => assignedOrder,
        text: async () => JSON.stringify(assignedOrder),
      });

      const result = await orders.assign('order-123', 'driver-456');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/orders/order-123/assign'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ driver_id: 'driver-456' }),
        })
      );
      expect(result.assigned_driver_id).toBe('driver-456');
    });
  });

  describe('updateStatus', () => {
    it('should update order status', async () => {
      const updatedOrder = { ...mockOrder, status: 'in_transit' };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => updatedOrder,
        text: async () => JSON.stringify(updatedOrder),
      });

      const result = await orders.updateStatus('order-123', 'in_transit');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/orders/order-123/status'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'in_transit' }),
        })
      );
      expect(result.status).toBe('in_transit');
    });

    it('should accept various status values', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockOrder,
        text: async () => JSON.stringify(mockOrder),
      });

      await orders.updateStatus('order-123', 'delivered');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.status).toBe('delivered');
    });
  });

  describe('getByStatus', () => {
    it('should get orders filtered by status', async () => {
      const mockResponse: PaginatedResponse<Order> = {
        data: [mockOrder],
        pagination: {
          page: 1,
          limit: 20,
          total: 50,
          pages: 3,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await orders.getByStatus('pending');

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('status=pending');
      expect(result.data).toHaveLength(1);
    });

    it('should accept pagination params along with status filter', async () => {
      const mockResponse: PaginatedResponse<Order> = {
        data: [mockOrder],
        pagination: {
          page: 2,
          limit: 10,
          total: 50,
          pages: 5,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      await orders.getByStatus('pending', { page: 2, limit: 10 });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('status=pending');
      expect(callUrl).toContain('page=2');
      expect(callUrl).toContain('limit=10');
    });
  });

  describe('getByDate', () => {
    it('should get orders filtered by scheduled date', async () => {
      const mockResponse: PaginatedResponse<Order> = {
        data: [mockOrder],
        pagination: {
          page: 1,
          limit: 20,
          total: 25,
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

      const result = await orders.getByDate('2024-03-15');

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('scheduled_date=2024-03-15');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getByDriver', () => {
    it('should get orders assigned to a specific driver', async () => {
      const mockResponse: PaginatedResponse<Order> = {
        data: [mockOrder],
        pagination: {
          page: 1,
          limit: 20,
          total: 10,
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

      const result = await orders.getByDriver('driver-123');

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('assigned_driver_id=driver-123');
      expect(result.data).toHaveLength(1);
    });
  });
});
