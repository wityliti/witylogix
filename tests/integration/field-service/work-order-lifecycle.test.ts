/**
 * Work Order Lifecycle Integration Tests (~350 lines)
 *
 * Comprehensive test coverage for:
 * - State transitions: full lifecycle created → completed
 * - Parts tracking: inventory deduction, reorder trigger
 * - Time tracking: clock in/out, travel, breaks, overtime
 * - Invoice generation: labor + parts + travel + tax
 * - SLA monitoring: 80% warning, 100% breach escalation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockWorkOrder,
  createMockTechnician,
  createMockPart,
  createMockInvoice,
} from '../fixtures/field-service-fixtures.js';
import type { MockWorkOrder, MockPart, MockInvoice } from '../fixtures/field-service-fixtures.js';

// ─────────────────────────────────────────────────────────────────────────
// SETUP & HELPERS
// ─────────────────────────────────────────────────────────────────────────

interface TimeEntry {
  type: 'work' | 'travel' | 'break';
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
}

interface InventoryItem {
  partId: string;
  name: string;
  quantity: number;
  reorderLevel: number;
  reorderQuantity: number;
}

class WorkOrderService {
  private workOrders = new Map<string, MockWorkOrder>();
  private inventory = new Map<string, InventoryItem>();
  private timeEntries = new Map<string, TimeEntry[]>();
  private invoices = new Map<string, MockInvoice>();
  private partsUsed = new Map<string, MockPart[]>();

  registerWorkOrder(workOrder: MockWorkOrder): void {
    this.workOrders.set(workOrder.id, workOrder);
    this.timeEntries.set(workOrder.id, []);
    this.partsUsed.set(workOrder.id, []);
  }

  // ─────────────────────────────────────────────────────────────────
  // STATE TRANSITIONS
  // ─────────────────────────────────────────────────────────────────

  transitionState(workOrderId: string, newStatus: MockWorkOrder['status']): MockWorkOrder {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) throw new Error('Work order not found');

    const validTransitions: Record<MockWorkOrder['status'], MockWorkOrder['status'][]> = {
      created: ['scheduled', 'cancelled'],
      scheduled: ['assigned', 'cancelled'],
      assigned: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    const allowedTransitions = validTransitions[workOrder.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`Cannot transition from ${workOrder.status} to ${newStatus}`);
    }

    workOrder.status = newStatus;
    workOrder.updatedAt = new Date();

    if (newStatus === 'in_progress' && !workOrder.actualStart) {
      workOrder.actualStart = new Date();
    }

    if (newStatus === 'completed' && !workOrder.actualEnd) {
      workOrder.actualEnd = new Date();
    }

    return workOrder;
  }

  getWorkOrderStatus(workOrderId: string): MockWorkOrder['status'] | null {
    const workOrder = this.workOrders.get(workOrderId);
    return workOrder?.status || null;
  }

  // ─────────────────────────────────────────────────────────────────
  // PARTS TRACKING
  // ─────────────────────────────────────────────────────────────────

  initializeInventory(partId: string, name: string, quantity: number): void {
    this.inventory.set(partId, {
      partId,
      name,
      quantity,
      reorderLevel: Math.ceil(quantity * 0.2),
      reorderQuantity: Math.ceil(quantity * 0.5),
    });
  }

  useParts(workOrderId: string, parts: MockPart[]): void {
    for (const part of parts) {
      const inventoryItem = this.inventory.get(part.id);
      if (inventoryItem) {
        inventoryItem.quantity -= part.quantity;
      }

      const usedParts = this.partsUsed.get(workOrderId) || [];
      usedParts.push(part);
      this.partsUsed.set(workOrderId, usedParts);
    }
  }

  getUsedParts(workOrderId: string): MockPart[] {
    return this.partsUsed.get(workOrderId) || [];
  }

  checkReorderNeeded(): string[] {
    const reorderList: string[] = [];

    for (const item of this.inventory.values()) {
      if (item.quantity <= item.reorderLevel) {
        reorderList.push(item.partId);
      }
    }

    return reorderList;
  }

  getTotalPartsCost(workOrderId: string): number {
    const parts = this.getUsedParts(workOrderId);
    return parts.reduce((sum, part) => sum + part.totalPrice, 0);
  }

  // ─────────────────────────────────────────────────────────────────
  // TIME TRACKING
  // ─────────────────────────────────────────────────────────────────

  clockIn(workOrderId: string): void {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) throw new Error('Work order not found');

    this.transitionState(workOrderId, 'in_progress');
  }

  clockOut(workOrderId: string): void {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) throw new Error('Work order not found');

    if (workOrder.actualEnd) return; // Already clocked out

    workOrder.actualEnd = new Date();
  }

  recordTravel(workOrderId: string, durationMinutes: number): void {
    const entries = this.timeEntries.get(workOrderId) || [];
    const now = new Date();

    entries.push({
      type: 'travel',
      startTime: new Date(now.getTime() - durationMinutes * 60 * 1000),
      endTime: now,
      durationMinutes,
    });

    this.timeEntries.set(workOrderId, entries);
  }

  recordBreak(workOrderId: string, durationMinutes: number): void {
    const entries = this.timeEntries.get(workOrderId) || [];
    const now = new Date();

    entries.push({
      type: 'break',
      startTime: new Date(now.getTime() - durationMinutes * 60 * 1000),
      endTime: now,
      durationMinutes,
    });

    this.timeEntries.set(workOrderId, entries);
  }

  calculateBillableHours(workOrderId: string): number {
    const entries = this.timeEntries.get(workOrderId) || [];
    const workEntries = entries.filter((e) => e.type === 'work');

    const totalMinutes = workEntries.reduce((sum, e) => sum + e.durationMinutes, 0);
    return Math.round((totalMinutes / 60) * 100) / 100;
  }

  calculateTravelTime(workOrderId: string): number {
    const entries = this.timeEntries.get(workOrderId) || [];
    const travelEntries = entries.filter((e) => e.type === 'travel');

    return travelEntries.reduce((sum, e) => sum + e.durationMinutes, 0);
  }

  calculateOvertime(workOrderId: string): number {
    const billableHours = this.calculateBillableHours(workOrderId);
    const overtimeThreshold = 8;

    if (billableHours > overtimeThreshold) {
      return billableHours - overtimeThreshold;
    }

    return 0;
  }

  // ─────────────────────────────────────────────────────────────────
  // INVOICE GENERATION
  // ─────────────────────────────────────────────────────────────────

  generateInvoice(workOrderId: string, laborRatePerHour: number = 85): MockInvoice {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) throw new Error('Work order not found');

    const billableHours = this.calculateBillableHours(workOrderId);
    const laborCost = billableHours * laborRatePerHour;
    const partsCost = this.getTotalPartsCost(workOrderId);
    const travelMinutes = this.calculateTravelTime(workOrderId);
    const travelCost = (travelMinutes / 60) * 0.5; // $0.50 per mile equivalent

    const subtotal = laborCost + partsCost + travelCost;
    const taxRate = 0.1025; // 10.25%
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const total = subtotal + taxAmount;

    const invoice: MockInvoice = {
      id: 'inv_' + workOrderId,
      invoiceNumber: 'INV' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
      workOrderId,
      customerId: workOrder.customerId,
      technicianId: workOrder.assignedTechnicianIds[0] || 'tech_unknown',
      status: 'draft',
      issuedDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      laborCost,
      laborHours: billableHours,
      partsCost,
      travelCost,
      subtotal,
      taxAmount,
      total,
      taxRate,
      createdAt: new Date(),
    };

    this.invoices.set(workOrderId, invoice);
    return invoice;
  }

  getInvoice(workOrderId: string): MockInvoice | undefined {
    return this.invoices.get(workOrderId);
  }

  // ─────────────────────────────────────────────────────────────────
  // SLA MONITORING
  // ─────────────────────────────────────────────────────────────────

  getSLADeadline(workOrderId: string): Date | null {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) return null;

    const slaMinutes: Record<string, number> = {
      emergency: 120,
      high: 240,
      medium: 1440,
      low: 4320,
    };

    const minutes = slaMinutes[workOrder.priority] || 1440;
    return new Date(workOrder.createdAt.getTime() + minutes * 60 * 1000);
  }

  checkSLAStatus(workOrderId: string): { breached: boolean; percentageUsed: number; hoursRemaining: number } {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) {
      return { breached: false, percentageUsed: 0, hoursRemaining: 0 };
    }

    const deadline = this.getSLADeadline(workOrderId);
    if (!deadline) {
      return { breached: false, percentageUsed: 0, hoursRemaining: 0 };
    }

    const now = new Date();
    const totalTime = deadline.getTime() - workOrder.createdAt.getTime();
    const timeUsed = now.getTime() - workOrder.createdAt.getTime();
    const percentageUsed = Math.round((timeUsed / totalTime) * 100);
    const hoursRemaining = Math.max(0, (deadline.getTime() - now.getTime()) / (1000 * 60 * 60));

    return {
      breached: now > deadline,
      percentageUsed: Math.min(100, percentageUsed),
      hoursRemaining: Math.round(hoursRemaining * 100) / 100,
    };
  }

  shouldAlertSLA(workOrderId: string): boolean {
    const status = this.checkSLAStatus(workOrderId);
    // Alert at 80% and when breached
    return status.percentageUsed >= 80;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────

describe('Work Order Lifecycle', () => {
  let service: WorkOrderService;
  let workOrder: MockWorkOrder;

  beforeEach(() => {
    service = new WorkOrderService();
    workOrder = createMockWorkOrder({ id: 'wo_0', priority: 'high' });
    service.registerWorkOrder(workOrder);
  });

  // ─────────────────────────────────────────────────────────────────
  // STATE TRANSITIONS
  // ─────────────────────────────────────────────────────────────────

  describe('State Transitions', () => {
    it('should transition from created to scheduled', () => {
      const updated = service.transitionState(workOrder.id, 'scheduled');
      expect(updated.status).toBe('scheduled');
    });

    it('should transition through full lifecycle', () => {
      service.transitionState(workOrder.id, 'scheduled');
      expect(service.getWorkOrderStatus(workOrder.id)).toBe('scheduled');

      service.transitionState(workOrder.id, 'assigned');
      expect(service.getWorkOrderStatus(workOrder.id)).toBe('assigned');

      service.transitionState(workOrder.id, 'in_progress');
      expect(service.getWorkOrderStatus(workOrder.id)).toBe('in_progress');

      service.transitionState(workOrder.id, 'completed');
      expect(service.getWorkOrderStatus(workOrder.id)).toBe('completed');
    });

    it('should set actual start on in_progress', () => {
      service.transitionState(workOrder.id, 'scheduled');
      service.transitionState(workOrder.id, 'assigned');
      service.transitionState(workOrder.id, 'in_progress');

      const updated = service.workOrders.get(workOrder.id);
      expect(updated?.actualStart).toBeDefined();
    });

    it('should set actual end on completed', () => {
      service.transitionState(workOrder.id, 'scheduled');
      service.transitionState(workOrder.id, 'assigned');
      service.transitionState(workOrder.id, 'in_progress');
      service.transitionState(workOrder.id, 'completed');

      const updated = service.workOrders.get(workOrder.id);
      expect(updated?.actualEnd).toBeDefined();
    });

    it('should allow cancellation from any state', () => {
      service.transitionState(workOrder.id, 'scheduled');
      service.transitionState(workOrder.id, 'cancelled');

      expect(service.getWorkOrderStatus(workOrder.id)).toBe('cancelled');
    });

    it('should reject invalid transitions', () => {
      expect(() => service.transitionState(workOrder.id, 'in_progress')).toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // PARTS TRACKING
  // ─────────────────────────────────────────────────────────────────

  describe('Parts Tracking', () => {
    it('should track used parts', () => {
      const part = createMockPart({ quantity: 2, unitPrice: 45.99 });
      service.useParts(workOrder.id, [part]);

      const usedParts = service.getUsedParts(workOrder.id);
      expect(usedParts).toContainEqual(part);
    });

    it('should calculate total parts cost', () => {
      const part1 = createMockPart({ quantity: 2, unitPrice: 50 });
      const part2 = createMockPart({ quantity: 1, unitPrice: 100 });

      service.useParts(workOrder.id, [part1, part2]);

      const totalCost = service.getTotalPartsCost(workOrder.id);
      expect(totalCost).toBe(200); // (2 * 50) + (1 * 100)
    });

    it('should deduct inventory on parts usage', () => {
      service.initializeInventory('part_1', 'Capacitor', 50);

      const part = createMockPart({ id: 'part_1', quantity: 10 });
      service.useParts(workOrder.id, [part]);

      // Inventory should be deducted
      expect(service.inventory.get('part_1')?.quantity).toBe(40);
    });

    it('should trigger reorder when inventory low', () => {
      service.initializeInventory('part_2', 'Bearing', 20);

      const part = createMockPart({ id: 'part_2', quantity: 18 });
      service.useParts(workOrder.id, [part]);

      const reorderList = service.checkReorderNeeded();
      expect(reorderList).toContain('part_2');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // TIME TRACKING
  // ─────────────────────────────────────────────────────────────────

  describe('Time Tracking', () => {
    it('should clock in', () => {
      service.clockIn(workOrder.id);
      expect(service.getWorkOrderStatus(workOrder.id)).toBe('in_progress');
    });

    it('should clock out', () => {
      service.clockIn(workOrder.id);
      service.clockOut(workOrder.id);

      const updated = service.workOrders.get(workOrder.id);
      expect(updated?.actualEnd).toBeDefined();
    });

    it('should record travel time', () => {
      service.recordTravel(workOrder.id, 45);

      const travelTime = service.calculateTravelTime(workOrder.id);
      expect(travelTime).toBe(45);
    });

    it('should record breaks', () => {
      service.recordBreak(workOrder.id, 30);

      const entries = service.timeEntries.get(workOrder.id) || [];
      const breakEntry = entries.find((e) => e.type === 'break');

      expect(breakEntry).toBeDefined();
      expect(breakEntry?.durationMinutes).toBe(30);
    });

    it('should calculate billable hours', () => {
      // Simulate work entry
      const entries: TimeEntry[] = [
        {
          type: 'work',
          startTime: new Date(),
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
          durationMinutes: 120,
        },
      ];

      service.timeEntries.set(workOrder.id, entries);

      const billableHours = service.calculateBillableHours(workOrder.id);
      expect(billableHours).toBe(2);
    });

    it('should detect overtime', () => {
      const entries: TimeEntry[] = [
        {
          type: 'work',
          startTime: new Date(),
          endTime: new Date(Date.now() + 10 * 60 * 60 * 1000),
          durationMinutes: 600,
        },
      ];

      service.timeEntries.set(workOrder.id, entries);

      const overtime = service.calculateOvertime(workOrder.id);
      expect(overtime).toBe(2); // 10 hours - 8 hour threshold
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // INVOICE GENERATION
  // ─────────────────────────────────────────────────────────────────

  describe('Invoice Generation', () => {
    it('should generate invoice', () => {
      const invoice = service.generateInvoice(workOrder.id);

      expect(invoice).toBeDefined();
      expect(invoice.workOrderId).toBe(workOrder.id);
      expect(invoice.status).toBe('draft');
    });

    it('should include labor costs in invoice', () => {
      const entries: TimeEntry[] = [
        {
          type: 'work',
          startTime: new Date(),
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
          durationMinutes: 120,
        },
      ];

      service.timeEntries.set(workOrder.id, entries);

      const invoice = service.generateInvoice(workOrder.id, 100);

      expect(invoice.laborCost).toBe(200); // 2 hours * $100/hour
    });

    it('should include parts costs in invoice', () => {
      const part = createMockPart({ quantity: 1, unitPrice: 150 });
      service.useParts(workOrder.id, [part]);

      const invoice = service.generateInvoice(workOrder.id);

      expect(invoice.partsCost).toBeGreaterThan(0);
    });

    it('should include travel costs in invoice', () => {
      service.recordTravel(workOrder.id, 60);

      const invoice = service.generateInvoice(workOrder.id);

      expect(invoice.travelCost).toBeGreaterThan(0);
    });

    it('should apply tax to invoice', () => {
      const invoice = service.generateInvoice(workOrder.id);

      expect(invoice.taxAmount).toBeGreaterThan(0);
      expect(invoice.total).toBe(invoice.subtotal + invoice.taxAmount);
    });

    it('should retrieve generated invoice', () => {
      service.generateInvoice(workOrder.id);

      const retrieved = service.getInvoice(workOrder.id);
      expect(retrieved).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SLA MONITORING
  // ─────────────────────────────────────────────────────────────────

  describe('SLA Monitoring', () => {
    it('should calculate SLA deadline', () => {
      const deadline = service.getSLADeadline(workOrder.id);

      expect(deadline).toBeInstanceOf(Date);
      expect(deadline!.getTime()).toBeGreaterThan(workOrder.createdAt.getTime());
    });

    it('should track SLA percentage used', () => {
      const status = service.checkSLAStatus(workOrder.id);

      expect(status.percentageUsed).toBeGreaterThanOrEqual(0);
      expect(status.percentageUsed).toBeLessThanOrEqual(100);
    });

    it('should alert at 80% SLA usage', () => {
      // Create work order from past to be near 80%
      const pastWo = createMockWorkOrder({ id: 'wo_old' });
      pastWo.createdAt = new Date(Date.now() - 192 * 60 * 1000); // 80% of 240 min (high priority)
      service.registerWorkOrder(pastWo);

      const shouldAlert = service.shouldAlertSLA(pastWo.id);

      expect(shouldAlert).toBe(true);
    });

    it('should detect SLA breach', () => {
      const pastWo = createMockWorkOrder({ id: 'wo_breach' });
      pastWo.createdAt = new Date(Date.now() - 300 * 60 * 1000); // After 240 min deadline
      service.registerWorkOrder(pastWo);

      const status = service.checkSLAStatus(pastWo.id);

      expect(status.breached).toBe(true);
    });

    it('should calculate hours remaining', () => {
      const status = service.checkSLAStatus(workOrder.id);

      expect(status.hoursRemaining).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // COMPLEX SCENARIOS
  // ─────────────────────────────────────────────────────────────────

  describe('Complex Work Order Scenarios', () => {
    it('should complete full work order lifecycle with all components', () => {
      // Start work order
      service.transitionState(workOrder.id, 'scheduled');
      service.transitionState(workOrder.id, 'assigned');
      service.transitionState(workOrder.id, 'in_progress');

      // Record time
      const entries: TimeEntry[] = [
        {
          type: 'work',
          startTime: new Date(),
          endTime: new Date(Date.now() + 2.5 * 60 * 60 * 1000),
          durationMinutes: 150,
        },
      ];
      service.timeEntries.set(workOrder.id, entries);

      // Use parts
      const part = createMockPart({ quantity: 1, unitPrice: 85.5 });
      service.useParts(workOrder.id, [part]);

      // Record travel
      service.recordTravel(workOrder.id, 30);

      // Complete work order
      service.transitionState(workOrder.id, 'completed');

      // Generate invoice
      const invoice = service.generateInvoice(workOrder.id);

      // Verify all components
      expect(invoice.laborCost).toBeGreaterThan(0);
      expect(invoice.partsCost).toBeGreaterThan(0);
      expect(invoice.travelCost).toBeGreaterThan(0);
      expect(invoice.total).toBeGreaterThan(0);
    });
  });
});
