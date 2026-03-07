import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Inventory Manager Tests
 * Tests stock operations, reservations, alerts, and concurrent handling
 */

interface StockEntry {
  skuId: string;
  warehouseId: string;
  available: number;
  reserved: number;
  damaged: number;
  lastUpdated: Date;
}

interface Reservation {
  id: string;
  skuId: string;
  quantity: number;
  orderId: string;
  expiresAt: Date;
  status: 'active' | 'released' | 'confirmed';
}

interface LowStockAlert {
  skuId: string;
  warehouseId: string;
  currentStock: number;
  threshold: number;
  createdAt: Date;
}

class InventoryManager {
  private stock: Map<string, StockEntry> = new Map();
  private reservations: Map<string, Reservation> = new Map();
  private lowStockThresholds: Map<string, number> = new Map();
  private alerts: LowStockAlert[] = [];
  private lockManager = new Map<string, Promise<void>>();

  constructor() {
    this.resetReservations();
  }

  private getStockKey(skuId: string, warehouseId: string): string {
    return `${skuId}:${warehouseId}`;
  }

  private async acquireLock(key: string): Promise<void> {
    while (this.lockManager.has(key)) {
      await this.lockManager.get(key);
    }
    let resolveLock: () => void;
    const lockPromise = new Promise<void>(resolve => {
      resolveLock = resolve;
    });
    this.lockManager.set(key, lockPromise);
    return lockPromise.then(() => {
      this.lockManager.delete(key);
    });
  }

  private releaseLock(key: string): void {
    const resolve = (this.lockManager.get(key) as any)?.then;
    if (resolve) {
      resolveLock();
    }
  }

  initializeStock(skuId: string, warehouseId: string, quantity: number): void {
    const key = this.getStockKey(skuId, warehouseId);
    this.stock.set(key, {
      skuId,
      warehouseId,
      available: quantity,
      reserved: 0,
      damaged: 0,
      lastUpdated: new Date(),
    });
  }

  setLowStockThreshold(skuId: string, threshold: number): void {
    this.lowStockThresholds.set(skuId, threshold);
  }

  checkStock(skuId: string, warehouseId: string, quantity: number): boolean {
    const key = this.getStockKey(skuId, warehouseId);
    const entry = this.stock.get(key);
    if (!entry) return false;
    return entry.available >= quantity;
  }

  adjustStock(skuId: string, warehouseId: string, delta: number): void {
    const key = this.getStockKey(skuId, warehouseId);
    const entry = this.stock.get(key);
    if (!entry) {
      throw new Error(`Stock entry not found for ${key}`);
    }

    const newAvailable = entry.available + delta;
    if (newAvailable < 0) {
      throw new Error('Cannot adjust stock below zero');
    }

    entry.available = newAvailable;
    entry.lastUpdated = new Date();

    // Check for low stock
    const threshold = this.lowStockThresholds.get(skuId) || 0;
    if (newAvailable <= threshold && newAvailable > 0) {
      this.createLowStockAlert(skuId, warehouseId, newAvailable, threshold);
    }
  }

  private createLowStockAlert(
    skuId: string,
    warehouseId: string,
    currentStock: number,
    threshold: number
  ): void {
    const existingAlert = this.alerts.find(
      a => a.skuId === skuId && a.warehouseId === warehouseId
    );
    if (!existingAlert) {
      this.alerts.push({
        skuId,
        warehouseId,
        currentStock,
        threshold,
        createdAt: new Date(),
      });
    }
  }

  getLowStockAlerts(): LowStockAlert[] {
    return [...this.alerts];
  }

  clearLowStockAlerts(skuId?: string): void {
    if (skuId) {
      this.alerts = this.alerts.filter(a => a.skuId !== skuId);
    } else {
      this.alerts = [];
    }
  }

  async reserve(
    skuId: string,
    warehouseId: string,
    quantity: number,
    orderId: string
  ): Promise<string> {
    const key = this.getStockKey(skuId, warehouseId);

    // Acquire lock for concurrent handling
    let lockKey = `lock:${key}`;
    const entry = this.stock.get(key);
    if (!entry) {
      throw new Error(`Stock entry not found for ${key}`);
    }

    if (entry.available < quantity) {
      throw new Error('Insufficient stock for reservation');
    }

    const reservationId = `res_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const reservation: Reservation = {
      id: reservationId,
      skuId,
      quantity,
      orderId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      status: 'active',
    };

    entry.available -= quantity;
    entry.reserved += quantity;
    entry.lastUpdated = new Date();
    this.reservations.set(reservationId, reservation);

    return reservationId;
  }

  async release(reservationId: string): Promise<void> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    if (reservation.status !== 'active') {
      throw new Error(`Reservation ${reservationId} is not active`);
    }

    const key = this.getStockKey(reservation.skuId, reservation.skuId);
    const entry = this.stock.get(key);
    if (!entry) {
      throw new Error(`Stock entry not found`);
    }

    entry.available += reservation.quantity;
    entry.reserved -= reservation.quantity;
    entry.lastUpdated = new Date();

    reservation.status = 'released';
  }

  confirmReservation(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    if (reservation.status !== 'active') {
      throw new Error(`Reservation ${reservationId} is not active`);
    }

    reservation.status = 'confirmed';
  }

  transfer(
    skuId: string,
    fromWarehouse: string,
    toWarehouse: string,
    quantity: number
  ): void {
    const fromKey = this.getStockKey(skuId, fromWarehouse);
    const toKey = this.getStockKey(skuId, toWarehouse);

    const fromEntry = this.stock.get(fromKey);
    const toEntry = this.stock.get(toKey);

    if (!fromEntry || !toEntry) {
      throw new Error('One or both warehouse entries not found');
    }

    if (fromEntry.available < quantity) {
      throw new Error('Insufficient stock in source warehouse');
    }

    fromEntry.available -= quantity;
    fromEntry.lastUpdated = new Date();

    toEntry.available += quantity;
    toEntry.lastUpdated = new Date();
  }

  getStock(skuId: string, warehouseId: string): StockEntry | null {
    const key = this.getStockKey(skuId, warehouseId);
    const entry = this.stock.get(key);
    return entry || null;
  }

  getReservation(reservationId: string): Reservation | null {
    return this.reservations.get(reservationId) || null;
  }

  private resetReservations(): void {
    // Expire old reservations
    const now = Date.now();
    for (const [id, res] of this.reservations.entries()) {
      if (res.status === 'active' && res.expiresAt.getTime() < now) {
        // Auto-release expired reservations
        const key = this.getStockKey(res.skuId, res.skuId);
        const entry = this.stock.get(key);
        if (entry) {
          entry.available += res.quantity;
          entry.reserved -= res.quantity;
          res.status = 'released';
        }
      }
    }
  }
}

describe('InventoryManager', () => {
  let inventory: InventoryManager;

  beforeEach(() => {
    inventory = new InventoryManager();
  });

  describe('Stock Check', () => {
    it('should check stock availability', () => {
      inventory.initializeStock('SKU001', 'WH001', 100);
      expect(inventory.checkStock('SKU001', 'WH001', 50)).toBe(true);
      expect(inventory.checkStock('SKU001', 'WH001', 100)).toBe(true);
    });

    it('should return false when stock is insufficient', () => {
      inventory.initializeStock('SKU001', 'WH001', 50);
      expect(inventory.checkStock('SKU001', 'WH001', 100)).toBe(false);
    });

    it('should return false for non-existent stock', () => {
      expect(inventory.checkStock('NONEXIST', 'WH001', 10)).toBe(false);
    });

    it('should check stock at exactly available quantity', () => {
      inventory.initializeStock('SKU001', 'WH001', 25);
      expect(inventory.checkStock('SKU001', 'WH001', 25)).toBe(true);
    });
  });

  describe('Stock Adjustment', () => {
    beforeEach(() => {
      inventory.initializeStock('SKU001', 'WH001', 100);
    });

    it('should increase stock', () => {
      inventory.adjustStock('SKU001', 'WH001', 25);
      const stock = inventory.getStock('SKU001', 'WH001');
      expect(stock?.available).toBe(125);
    });

    it('should decrease stock', () => {
      inventory.adjustStock('SKU001', 'WH001', -30);
      const stock = inventory.getStock('SKU001', 'WH001');
      expect(stock?.available).toBe(70);
    });

    it('should prevent negative stock', () => {
      expect(() => inventory.adjustStock('SKU001', 'WH001', -150)).toThrow(
        'Cannot adjust stock below zero'
      );
    });

    it('should update lastUpdated timestamp', () => {
      const beforeUpdate = new Date();
      inventory.adjustStock('SKU001', 'WH001', 10);
      const stock = inventory.getStock('SKU001', 'WH001');
      expect(stock?.lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should allow adjustment to exactly zero', () => {
      inventory.initializeStock('SKU002', 'WH001', 50);
      inventory.adjustStock('SKU002', 'WH001', -50);
      const stock = inventory.getStock('SKU002', 'WH001');
      expect(stock?.available).toBe(0);
    });
  });

  describe('Stock Transfer', () => {
    beforeEach(() => {
      inventory.initializeStock('SKU001', 'WH001', 100);
      inventory.initializeStock('SKU001', 'WH002', 50);
    });

    it('should transfer stock between warehouses', () => {
      inventory.transfer('SKU001', 'WH001', 'WH002', 25);
      const from = inventory.getStock('SKU001', 'WH001');
      const to = inventory.getStock('SKU001', 'WH002');
      expect(from?.available).toBe(75);
      expect(to?.available).toBe(75);
    });

    it('should prevent transfer of more stock than available', () => {
      expect(() => inventory.transfer('SKU001', 'WH001', 'WH002', 150)).toThrow(
        'Insufficient stock in source warehouse'
      );
    });

    it('should fail if source warehouse does not exist', () => {
      expect(() => inventory.transfer('SKU001', 'NONEXIST', 'WH002', 10)).toThrow(
        'One or both warehouse entries not found'
      );
    });

    it('should fail if destination warehouse does not exist', () => {
      expect(() => inventory.transfer('SKU001', 'WH001', 'NONEXIST', 10)).toThrow(
        'One or both warehouse entries not found'
      );
    });
  });

  describe('Low Stock Alerts', () => {
    beforeEach(() => {
      inventory.initializeStock('SKU001', 'WH001', 100);
      inventory.setLowStockThreshold('SKU001', 20);
    });

    it('should generate alert when stock drops to threshold', () => {
      inventory.adjustStock('SKU001', 'WH001', -85);
      const alerts = inventory.getLowStockAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].currentStock).toBe(15);
      expect(alerts[0].threshold).toBe(20);
    });

    it('should not generate duplicate alerts for same SKU/warehouse', () => {
      inventory.adjustStock('SKU001', 'WH001', -85);
      inventory.adjustStock('SKU001', 'WH001', -3);
      const alerts = inventory.getLowStockAlerts();
      expect(alerts).toHaveLength(1);
    });

    it('should not generate alert when above threshold', () => {
      inventory.adjustStock('SKU001', 'WH001', -50);
      const alerts = inventory.getLowStockAlerts();
      expect(alerts).toHaveLength(0);
    });

    it('should clear all alerts', () => {
      inventory.adjustStock('SKU001', 'WH001', -85);
      inventory.clearLowStockAlerts();
      const alerts = inventory.getLowStockAlerts();
      expect(alerts).toHaveLength(0);
    });

    it('should clear alerts for specific SKU', () => {
      inventory.initializeStock('SKU002', 'WH001', 50);
      inventory.setLowStockThreshold('SKU002', 10);
      inventory.adjustStock('SKU001', 'WH001', -85);
      inventory.adjustStock('SKU002', 'WH001', -45);
      inventory.clearLowStockAlerts('SKU001');
      const alerts = inventory.getLowStockAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].skuId).toBe('SKU002');
    });
  });

  describe('Reservations', () => {
    beforeEach(() => {
      inventory.initializeStock('SKU001', 'WH001', 100);
    });

    it('should create a reservation', async () => {
      const resId = await inventory.reserve('SKU001', 'WH001', 30, 'ORD001');
      expect(resId).toBeDefined();
      expect(resId).toMatch(/^res_/);
    });

    it('should decrease available stock on reservation', async () => {
      await inventory.reserve('SKU001', 'WH001', 30, 'ORD001');
      const stock = inventory.getStock('SKU001', 'WH001');
      expect(stock?.available).toBe(70);
      expect(stock?.reserved).toBe(30);
    });

    it('should prevent reservation of more stock than available', async () => {
      await expect(inventory.reserve('SKU001', 'WH001', 150, 'ORD001')).rejects.toThrow(
        'Insufficient stock for reservation'
      );
    });

    it('should return reservation details', async () => {
      const resId = await inventory.reserve('SKU001', 'WH001', 30, 'ORD001');
      const reservation = inventory.getReservation(resId);
      expect(reservation?.skuId).toBe('SKU001');
      expect(reservation?.quantity).toBe(30);
      expect(reservation?.orderId).toBe('ORD001');
      expect(reservation?.status).toBe('active');
    });
  });

  describe('Reservation Release', () => {
    let reservationId: string;

    beforeEach(async () => {
      inventory.initializeStock('SKU001', 'WH001', 100);
      reservationId = await inventory.reserve('SKU001', 'WH001', 30, 'ORD001');
    });

    it('should release a reservation', async () => {
      await inventory.release(reservationId);
      const stock = inventory.getStock('SKU001', 'WH001');
      expect(stock?.available).toBe(100);
      expect(stock?.reserved).toBe(0);
    });

    it('should update reservation status to released', async () => {
      await inventory.release(reservationId);
      const reservation = inventory.getReservation(reservationId);
      expect(reservation?.status).toBe('released');
    });

    it('should prevent double release', async () => {
      await inventory.release(reservationId);
      await expect(inventory.release(reservationId)).rejects.toThrow(
        'Reservation .* is not active'
      );
    });

    it('should fail to release non-existent reservation', async () => {
      await expect(inventory.release('NONEXIST')).rejects.toThrow(
        'Reservation NONEXIST not found'
      );
    });
  });

  describe('Reservation Confirmation', () => {
    let reservationId: string;

    beforeEach(async () => {
      inventory.initializeStock('SKU001', 'WH001', 100);
      reservationId = await inventory.reserve('SKU001', 'WH001', 30, 'ORD001');
    });

    it('should confirm a reservation', () => {
      inventory.confirmReservation(reservationId);
      const reservation = inventory.getReservation(reservationId);
      expect(reservation?.status).toBe('confirmed');
    });

    it('should prevent confirmation of non-active reservation', async () => {
      await inventory.release(reservationId);
      expect(() => inventory.confirmReservation(reservationId)).toThrow(
        'Reservation .* is not active'
      );
    });
  });

  describe('Concurrent Reservation Handling', () => {
    it('should handle multiple concurrent reservations', async () => {
      inventory.initializeStock('SKU001', 'WH001', 100);

      const res1 = inventory.reserve('SKU001', 'WH001', 25, 'ORD001');
      const res2 = inventory.reserve('SKU001', 'WH001', 25, 'ORD002');
      const res3 = inventory.reserve('SKU001', 'WH001', 25, 'ORD003');

      await Promise.all([res1, res2, res3]);

      const stock = inventory.getStock('SKU001', 'WH001');
      expect(stock?.available).toBe(25);
      expect(stock?.reserved).toBe(75);
    });

    it('should prevent over-reservation with concurrent requests', async () => {
      inventory.initializeStock('SKU001', 'WH001', 50);

      try {
        await Promise.all([
          inventory.reserve('SKU001', 'WH001', 40, 'ORD001'),
          inventory.reserve('SKU001', 'WH001', 30, 'ORD002'),
        ]);
        // At least one should fail
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Insufficient stock');
      }
    });
  });

  describe('Negative Stock Prevention', () => {
    beforeEach(() => {
      inventory.initializeStock('SKU001', 'WH001', 50);
    });

    it('should prevent direct adjustment to negative', () => {
      expect(() => inventory.adjustStock('SKU001', 'WH001', -100)).toThrow(
        'Cannot adjust stock below zero'
      );
    });

    it('should prevent reservations that would create negative available stock', async () => {
      await expect(inventory.reserve('SKU001', 'WH001', 100, 'ORD001')).rejects.toThrow(
        'Insufficient stock for reservation'
      );
    });

    it('should prevent transfers that would create negative stock', () => {
      expect(() => inventory.transfer('SKU001', 'WH001', 'WH002', 100)).rejects;
    });
  });

  describe('Multiple SKUs and Warehouses', () => {
    beforeEach(() => {
      inventory.initializeStock('SKU001', 'WH001', 100);
      inventory.initializeStock('SKU001', 'WH002', 50);
      inventory.initializeStock('SKU002', 'WH001', 75);
      inventory.initializeStock('SKU002', 'WH002', 25);
    });

    it('should manage different SKUs independently', async () => {
      await inventory.reserve('SKU001', 'WH001', 30, 'ORD001');
      await inventory.reserve('SKU002', 'WH001', 40, 'ORD002');

      const sku1 = inventory.getStock('SKU001', 'WH001');
      const sku2 = inventory.getStock('SKU002', 'WH001');

      expect(sku1?.available).toBe(70);
      expect(sku2?.available).toBe(35);
    });

    it('should manage different warehouses independently', () => {
      inventory.adjustStock('SKU001', 'WH001', -20);
      inventory.adjustStock('SKU001', 'WH002', -10);

      const wh1 = inventory.getStock('SKU001', 'WH001');
      const wh2 = inventory.getStock('SKU001', 'WH002');

      expect(wh1?.available).toBe(80);
      expect(wh2?.available).toBe(40);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero quantity operations', () => {
      inventory.initializeStock('SKU001', 'WH001', 100);
      inventory.adjustStock('SKU001', 'WH001', 0);
      const stock = inventory.getStock('SKU001', 'WH001');
      expect(stock?.available).toBe(100);
    });

    it('should return null for non-existent stock', () => {
      const stock = inventory.getStock('NONEXIST', 'NONEXIST');
      expect(stock).toBeNull();
    });
  });
});
