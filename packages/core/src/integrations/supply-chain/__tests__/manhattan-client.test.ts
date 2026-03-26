/**
 * Manhattan Associates WMS Client Tests
 * Comprehensive test coverage for warehouse, inventory, and order operations.
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ManhattanClient } from '../manhattan-client';
import type { SupplyChainConfig } from '../types';

describe('ManhattanClient', () => {
  let client: ManhattanClient;
  let config: SupplyChainConfig;

  beforeEach(() => {
    config = {
      provider: 'manhattan',
      apiKey: 'test-key',
      clientSecret: 'test-secret',
      baseUrl: 'https://api.test.com',
      tokenUrl: 'https://api.test.com/oauth/token',
      warehouseId: 'WH001',
      timeout: 5000,
      debug: false,
    };

    client = new ManhattanClient(config);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // WAREHOUSE TESTS
  // ============================================================================

  describe('Warehouse Operations', () => {
    it('should initialize client with OAuth2 authentication', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'api',
        }),
      });

      await expect(client.initialize()).resolves.not.toThrow();
    });

    it('should verify connection successfully', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'test-token',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' }),
        });

      await client.initialize();
      const result = await client.verifyConnection();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should get warehouse by ID', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'test-token',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            WHID: 'WH001',
            WNAME: 'Main Warehouse',
            WCODE: 'MW',
            WCITY: 'Chicago',
            WSTATE: 'IL',
            WZIP: '60601',
            WCOUNTRY: 'US',
            WSTATUS: 'active',
          }),
        });

      await client.initialize();
      const warehouse = await client.getWarehouse('WH001');

      expect(warehouse).toBeDefined();
      expect(warehouse.id).toBe('WH001');
      expect(warehouse.name).toBe('Main Warehouse');
      expect(warehouse.address.city).toBe('Chicago');
    });

    it('should list warehouses', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'test-token',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                WHID: 'WH001',
                WNAME: 'Warehouse 1',
                WCODE: 'W1',
                WCITY: 'Chicago',
                WSTATE: 'IL',
                WZIP: '60601',
              },
              {
                WHID: 'WH002',
                WNAME: 'Warehouse 2',
                WCODE: 'W2',
                WCITY: 'Dallas',
                WSTATE: 'TX',
                WZIP: '75201',
              },
            ],
          }),
        });

      await client.initialize();
      const warehouses = await client.listWarehouses();

      expect(warehouses).toHaveLength(2);
      expect(warehouses[0].id).toBe('WH001');
      expect(warehouses[1].id).toBe('WH002');
    });

    it('should create warehouse', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'test-token',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            WHID: 'WH003',
            WNAME: 'New Warehouse',
            WCODE: 'NW',
            WSTATUS: 'active',
          }),
        });

      await client.initialize();
      const warehouse = await client.createWarehouse({
        id: 'WH003',
        name: 'New Warehouse',
        code: 'NW',
        address: {
          street: '123 Main',
          city: 'Boston',
          state: 'MA',
          postalCode: '02101',
          country: 'US',
        },
        type: 'dc',
        status: 'active',
      });

      expect(warehouse.id).toBe('WH003');
      expect(warehouse.name).toBe('New Warehouse');
    });

    it('should update warehouse', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'test-token',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            WHID: 'WH001',
            WNAME: 'Updated Warehouse',
            WCODE: 'UW',
            WSTATUS: 'active',
          }),
        });

      await client.initialize();
      const updated = await client.updateWarehouse('WH001', {
        name: 'Updated Warehouse',
      });

      expect(updated.name).toBe('Updated Warehouse');
    });
  });

  // ============================================================================
  // INVENTORY TESTS
  // ============================================================================

  describe('Inventory Operations', () => {
    beforeEach(async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
        }),
      });
      await client.initialize();
    });

    it('should get inventory for SKU', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              ITEMID: 'INV001',
              SKU: 'SKU-123',
              WHID: 'WH001',
              LOC: 'A-1-1',
              ZONE: 'PICK',
              QOH: 100,
              QAL: 50,
              QAV: 50,
              UOM: 'EACH',
              STATUS: 'available',
              COST: 10.5,
            },
          ],
        }),
      });

      const inventory = await client.getInventory('WH001', 'SKU-123');

      expect(inventory).toBeDefined();
      expect(inventory.sku).toBe('SKU-123');
      expect(inventory.quantityOnHand).toBe(100);
      expect(inventory.quantityAllocated).toBe(50);
      expect(inventory.quantityAvailable).toBe(50);
    });

    it('should list inventory with filters', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              ITEMID: 'INV001',
              SKU: 'SKU-123',
              WHID: 'WH001',
              LOC: 'A-1-1',
              ZONE: 'PICK',
              QOH: 100,
              QAL: 50,
              QAV: 50,
            },
            {
              ITEMID: 'INV002',
              SKU: 'SKU-456',
              WHID: 'WH001',
              LOC: 'A-1-2',
              ZONE: 'PICK',
              QOH: 200,
              QAL: 100,
              QAV: 100,
            },
          ],
        }),
      });

      const inventory = await client.listInventory('WH001', { zone: 'PICK' });

      expect(inventory).toHaveLength(2);
      expect(inventory[0].sku).toBe('SKU-123');
    });

    it('should adjust inventory', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                ITEMID: 'INV001',
                SKU: 'SKU-123',
                QOH: 110,
                QAL: 50,
                QAV: 60,
              },
            ],
          }),
        });

      const result = await client.adjustInventory('WH001', 'SKU-123', 10, 'Cycle count correction');

      expect(result.sku).toBe('SKU-123');
      expect(result.quantityOnHand).toBe(110);
    });

    it('should sync inventory in real-time', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              ITEMID: 'INV001',
              SKU: 'SKU-123',
              WHID: 'WH001',
              QOH: 100,
              QAL: 50,
              QAV: 50,
            },
          ],
        }),
      });

      const inventory = await client.syncInventoryRealTime('WH001');

      expect(inventory).toHaveLength(1);
      expect(inventory[0].sku).toBe('SKU-123');
    });

    it('should sync batch inventory', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              { ITEMID: 'INV001', SKU: 'SKU-123', QOH: 100, QAL: 50, QAV: 50 },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              { ITEMID: 'INV002', SKU: 'SKU-456', QOH: 200, QAL: 100, QAV: 100 },
            ],
          }),
        });

      const inventory = await client.syncInventoryBatch('WH001', ['SKU-123', 'SKU-456']);

      expect(inventory).toHaveLength(2);
    });

    it('should move inventory between locations', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              { ITEMID: 'INV001', SKU: 'SKU-123', LOC: 'B-2-2', QOH: 100, QAL: 50, QAV: 50 },
            ],
          }),
        });

      const result = await client.moveInventory('WH001', 'SKU-123', 'A-1-1', 'B-2-2', 50);

      expect(result).toHaveLength(1);
      expect(result[0].binLocation).toBe('B-2-2');
    });
  });

  // ============================================================================
  // ORDER & FULFILLMENT TESTS
  // ============================================================================

  describe('Order and Fulfillment Operations', () => {
    beforeEach(async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
        }),
      });
      await client.initialize();
    });

    it('should create outbound order', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          OrderID: 'ORD001',
          OrderNumber: 'ORD-2024-001',
          WHID: 'WH001',
          Status: 'pending',
          Items: [{ SKU: 'SKU-123', Qty: 10 }],
        }),
      });

      const order = await client.createOutboundOrder({
        id: '',
        orderNumber: 'ORD-2024-001',
        type: 'sales',
        sourceWarehouseId: 'WH001',
        orderDate: new Date(),
        status: 'pending',
        priority: 'standard',
        items: [{ sku: 'SKU-123', quantity: 10 }],
      });

      expect(order.orderNumber).toBe('ORD-2024-001');
      expect(order.status).toBe('pending');
    });

    it('should allocate order', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          FulfillmentID: 'FULF001',
          OrderID: 'ORD001',
          WHID: 'WH001',
          Status: 'allocated',
          Allocations: [
            { SKU: 'SKU-123', allocatedQty: 10 },
          ],
        }),
      });

      const fulfillment = await client.allocateOrder('ORD001', 'WH001', 'fifo');

      expect(fulfillment.status).toBe('allocated');
      expect(fulfillment.allocations).toHaveLength(1);
    });

    it('should cancel order', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            OrderID: 'ORD001',
            Status: 'cancelled',
          }),
        });

      const order = await client.cancelOutboundOrder('ORD001', 'Customer request');

      expect(order.status).toBe('cancelled');
    });
  });

  // ============================================================================
  // WAVE & PICK TESTS
  // ============================================================================

  describe('Wave and Pick Operations', () => {
    beforeEach(async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
        }),
      });
      await client.initialize();
    });

    it('should create wave', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          WaveID: 'WAVE001',
          WaveNumber: 'W-001',
          WHID: 'WH001',
          Status: 'planned',
          OrderCount: 5,
          UnitCount: 50,
        }),
      });

      const wave = await client.createWave('WH001', ['FULF001', 'FULF002'], 'zone');

      expect(wave.waveNumber).toBe('W-001');
      expect(wave.status).toBe('planned');
      expect(wave.orderCount).toBe(5);
    });

    it('should release wave', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            WaveID: 'WAVE001',
            Status: 'released',
          }),
        });

      const wave = await client.releaseWave('WAVE001');

      expect(wave.status).toBe('released');
    });

    it('should get pick task', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          TaskID: 'TASK001',
          WaveID: 'WAVE001',
          FromLoc: 'A-1-1',
          ToLoc: 'SORT-001',
          SKU: 'SKU-123',
          Qty: 10,
          Status: 'pending',
          Zone: 'PICK',
        }),
      });

      const task = await client.getPickTask('TASK001');

      expect(task.sku).toBe('SKU-123');
      expect(task.quantity).toBe(10);
      expect(task.status).toBe('pending');
    });

    it('should list pick tasks for wave', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              TaskID: 'TASK001',
              WaveID: 'WAVE001',
              FromLoc: 'A-1-1',
              SKU: 'SKU-123',
              Qty: 10,
              Status: 'pending',
              Zone: 'PICK',
            },
            {
              TaskID: 'TASK002',
              WaveID: 'WAVE001',
              FromLoc: 'A-2-1',
              SKU: 'SKU-456',
              Qty: 20,
              Status: 'pending',
              Zone: 'PICK',
            },
          ],
        }),
      });

      const tasks = await client.listPickTasks('WAVE001');

      expect(tasks).toHaveLength(2);
      expect(tasks[0].sku).toBe('SKU-123');
    });

    it('should update pick task', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            TaskID: 'TASK001',
            PickedQty: 10,
            Status: 'completed',
          }),
        });

      const task = await client.updatePickTask('TASK001', 10, 'completed');

      expect(task.pickedQuantity).toBe(10);
      expect(task.status).toBe('completed');
    });
  });

  // ============================================================================
  // SHIPPING TESTS
  // ============================================================================

  describe('Shipping Operations', () => {
    beforeEach(async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
        }),
      });
      await client.initialize();
    });

    it('should confirm shipment', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ShipConfirmID: 'SC001',
          ShipmentNumber: 'SHIP-001',
          TrackingNumber: 'TRK123456',
          Carrier: 'FEDEX',
        }),
      });

      const confirmation = await client.confirmShipment('ORD001', 'FEDEX', 'TRK123456', 5.5);

      expect(confirmation.trackingNumber).toBe('TRK123456');
      expect(confirmation.carrier).toBe('FEDEX');
    });

    it('should get pack station', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          StationID: 'PS001',
          StationName: 'Pack Station 1',
          WHID: 'WH001',
          Zone: 'PACK',
          Location: 'PS-1',
          Type: 'manual',
          Status: 'active',
        }),
      });

      const station = await client.getPackStation('PS001');

      expect(station.name).toBe('Pack Station 1');
      expect(station.type).toBe('manual');
    });

    it('should list pack stations', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              StationID: 'PS001',
              StationName: 'Pack Station 1',
              WHID: 'WH001',
              Zone: 'PACK',
              Type: 'manual',
            },
            {
              StationID: 'PS002',
              StationName: 'Pack Station 2',
              WHID: 'WH001',
              Zone: 'PACK',
              Type: 'semi_auto',
            },
          ],
        }),
      });

      const stations = await client.listPackStations('WH001');

      expect(stations).toHaveLength(2);
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    beforeEach(async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
        }),
      });
      await client.initialize();
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(client.getWarehouse('INVALID')).rejects.toThrow();
    });

    it('should handle network failures with retry logic', async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [{ WHID: 'WH001' }],
          }),
        });

      const warehouses = await client.listWarehouses();
      expect(warehouses).toBeDefined();
    });

    it('should validate required parameters', async () => {
      await expect(client.getWarehouse('')).rejects.toThrow();
    });
  });
});
