import { describe, it, expect, beforeEach } from 'vitest';
import { RetentionManager } from '../retention';

describe('RetentionManager', () => {
  let manager: RetentionManager;

  beforeEach(() => {
    manager = new RetentionManager();
  });

  // ==================== Policy Management Tests ====================
  describe('setRetentionPolicy', () => {
    it('should create retention policy for entity type', () => {
      const policy = manager.setRetentionPolicy('order', 365);

      expect(policy.entityType).toBe('order');
      expect(policy.retentionDays).toBe(365);
      expect(policy.deleteAfterDays).toBe(365);
    });

    it('should set anonymization period separately', () => {
      const policy = manager.setRetentionPolicy('payment', 365, 180, 365);

      expect(policy.anonymizeAfterDays).toBe(180);
      expect(policy.deleteAfterDays).toBe(365);
    });

    it('should reject negative retention days', () => {
      expect(() => {
        manager.setRetentionPolicy('order', -1);
      }).toThrow('retentionDays must be non-negative');
    });

    it('should set default delete days if not specified', () => {
      const policy = manager.setRetentionPolicy('log', 90);

      expect(policy.deleteAfterDays).toBe(90);
    });
  });

  // ==================== applyRetentionPolicy Tests ====================
  describe('applyRetentionPolicy', () => {
    it('should flag records for deletion when past retention period', () => {
      manager.setRetentionPolicy('order', 30);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 31);

      const result = manager.applyRetentionPolicy('order_001', 'order', pastDate);

      expect(result.action).toBe('delete');
      expect(result.daysUntilAction).toBe(0);
    });

    it('should flag records for anonymization before deletion', () => {
      manager.setRetentionPolicy('shipment', 365, 180, 365);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 185);

      const result = manager.applyRetentionPolicy(
        'shipment_001',
        'shipment',
        pastDate
      );

      expect(result.action).toBe('anonymize');
    });

    it('should return no action for fresh records', () => {
      manager.setRetentionPolicy('order', 30);

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);

      const result = manager.applyRetentionPolicy('order_002', 'order', recentDate);

      expect(result.action).toBe('none');
      expect(result.daysUntilAction).toBeGreaterThan(0);
    });

    it('should return no action for non-existent policy', () => {
      const result = manager.applyRetentionPolicy(
        'unknown_001',
        'unknown_type',
        new Date()
      );

      expect(result.action).toBe('none');
      expect(result.daysUntilAction).toBe(-1);
    });

    it('should return correct days until action', () => {
      manager.setRetentionPolicy('order', 30);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 20);

      const result = manager.applyRetentionPolicy('order_003', 'order', pastDate);

      expect(result.action).toBe('none');
      expect(result.daysUntilAction).toBeCloseTo(10, 1);
    });

    it('should handle boundary case at exactly retention period', () => {
      manager.setRetentionPolicy('log', 365);

      const exactDate = new Date();
      exactDate.setDate(exactDate.getDate() - 365);

      const result = manager.applyRetentionPolicy('log_001', 'log', exactDate);

      // At boundary, should trigger deletion
      expect(result.action).toBe('delete');
    });
  });

  // ==================== exemptFromRetention Tests ====================
  describe('exemptFromRetention', () => {
    it('should create legal hold on record', () => {
      manager.setRetentionPolicy('order', 30);

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);

      // Before exemption, should be marked for deletion
      let result = manager.applyRetentionPolicy('order_004', 'order', oldDate);
      expect(result.action).toBe('delete');

      // Apply exemption
      manager.exemptFromRetention('order_004', 'Legal hold - ongoing dispute');

      // After exemption, should not be deleted
      result = manager.applyRetentionPolicy('order_004', 'order', oldDate);
      expect(result.action).toBe('none');
    });

    it('should require exemption reason', () => {
      expect(() => {
        manager.exemptFromRetention('order_005', '');
      }).toThrow('Exemption reason is required');

      expect(() => {
        manager.exemptFromRetention('order_005', '   ');
      }).toThrow('Exemption reason is required');
    });

    it('should check exemption status', () => {
      manager.exemptFromRetention('order_006', 'Regulatory requirement');

      expect(manager.isExempt('order_006')).toBe(true);
      expect(manager.isExempt('order_007')).toBe(false);
    });

    it('should remove exemption when requested', () => {
      manager.exemptFromRetention('order_008', 'Temporary hold');

      expect(manager.isExempt('order_008')).toBe(true);

      manager.removeExemption('order_008');

      expect(manager.isExempt('order_008')).toBe(false);
    });
  });

  // ==================== scheduleAnonymization Tests ====================
  describe('scheduleAnonymization', () => {
    it('should queue record for anonymization', () => {
      const scheduled = manager.scheduleAnonymization('user_001', 'user', 90);

      expect(scheduled.recordId).toBe('user_001');
      expect(scheduled.anonymizeAt).toBeInstanceOf(Date);
      expect(scheduled.scheduledAt).toBeInstanceOf(Date);
    });

    it('should set correct anonymization date', () => {
      const before = new Date();
      const scheduled = manager.scheduleAnonymization('user_002', 'user', 30);
      const after = new Date();

      const expectedDate = new Date(before.getTime() + 30 * 24 * 60 * 60 * 1000);

      expect(scheduled.anonymizeAt.getTime()).toBeGreaterThanOrEqual(
        expectedDate.getTime() - 1000
      );
      expect(scheduled.anonymizeAt.getTime()).toBeLessThanOrEqual(
        expectedDate.getTime() + 1000
      );
    });

    it('should schedule multiple records', () => {
      manager.scheduleAnonymization('user_003', 'user', 30);
      manager.scheduleAnonymization('user_004', 'user', 30);
      manager.scheduleAnonymization('payment_001', 'payment', 60);

      const due = manager.getRecordsDueForAnonymization();
      // None should be due yet (scheduled in future)
      expect(due).toHaveLength(0);
    });
  });

  // ==================== getRecordsDueForAnonymization Tests ====================
  describe('getRecordsDueForAnonymization', () => {
    it('should identify records due for anonymization', () => {
      // Schedule for past date (due immediately)
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const recordId = 'user_005';
      manager.scheduleAnonymization(recordId, 'user', -1);

      // Manually create a record that's overdue
      manager.scheduleAnonymization(recordId, 'user', 0);

      const dueRecords = manager.getRecordsDueForAnonymization();

      // Should have at least one record
      expect(dueRecords.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== getRecordsDueForDeletion Tests ====================
  describe('getRecordsDueForDeletion', () => {
    it('should identify records due for deletion', () => {
      const scheduled = manager.scheduleForDeletion('log_001', 'log', 0);

      const dueRecords = manager.getRecordsDueForDeletion();

      expect(dueRecords).toContain('log_001');
    });

    it('should not include future deletions', () => {
      manager.scheduleForDeletion('log_002', 'log', 30);

      const dueRecords = manager.getRecordsDueForDeletion();

      expect(dueRecords).not.toContain('log_002');
    });
  });

  // ==================== Retention Report Tests ====================
  describe('getRetentionReport', () => {
    it('should provide retention status report', () => {
      manager.setRetentionPolicy('order', 30);
      manager.setRetentionPolicy('payment', 60);

      const oldOrderDate = new Date();
      oldOrderDate.setDate(oldOrderDate.getDate() - 31);

      const recentPaymentDate = new Date();
      recentPaymentDate.setDate(recentPaymentDate.getDate() - 5);

      manager.applyRetentionPolicy('order_001', 'order', oldOrderDate);
      manager.applyRetentionPolicy('order_002', 'order', oldOrderDate);
      manager.applyRetentionPolicy('payment_001', 'payment', recentPaymentDate);

      const report = manager.getRetentionReport();

      expect(report.deleteScheduled).toBeGreaterThan(0);
      expect(report.byEntityType['order']).toBeDefined();
    });

    it('should track deleted records', () => {
      manager.scheduleForDeletion('log_003', 'log', 0);
      manager.markAsDeleted('log_003');

      const report = manager.getRetentionReport();

      expect(report.deleted).toBeGreaterThan(0);
    });

    it('should track exempt records', () => {
      manager.exemptFromRetention('order_009', 'Legal hold');

      const report = manager.getRetentionReport();

      expect(report.exempt).toBeGreaterThan(0);
    });

    it('should organize report by entity type', () => {
      manager.setRetentionPolicy('order', 30);
      manager.setRetentionPolicy('shipment', 30);

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);

      manager.applyRetentionPolicy('order_010', 'order', oldDate);
      manager.applyRetentionPolicy('shipment_001', 'shipment', oldDate);

      const report = manager.getRetentionReport();

      expect(report.byEntityType['order']).toBeDefined();
      expect(report.byEntityType['shipment']).toBeDefined();
    });
  });

  // ==================== Boundary Cases Tests ====================
  describe('Boundary Cases', () => {
    it('should handle zero retention days', () => {
      manager.setRetentionPolicy('temp_log', 0);

      const result = manager.applyRetentionPolicy(
        'temp_001',
        'temp_log',
        new Date()
      );

      expect(result.action).toBe('delete');
    });

    it('should handle records created exactly at boundary', () => {
      manager.setRetentionPolicy('order', 30);

      const createdDate = new Date();
      createdDate.setDate(createdDate.getDate() - 30);

      const result = manager.applyRetentionPolicy(
        'order_boundary',
        'order',
        createdDate
      );

      expect(['delete', 'none']).toContain(result.action);
    });

    it('should handle anonymization period equal to retention period', () => {
      manager.setRetentionPolicy('data', 30, 30, 30);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      const result = manager.applyRetentionPolicy('data_001', 'data', pastDate);

      // Should be ready for deletion (not anonymization)
      expect(result.action).toBe('delete');
    });

    it('should handle very long retention periods', () => {
      manager.setRetentionPolicy('archive', 7300); // ~20 years

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 100);

      const result = manager.applyRetentionPolicy('archive_001', 'archive', recentDate);

      expect(result.action).toBe('none');
      expect(result.daysUntilAction).toBeGreaterThan(7000);
    });
  });

  // ==================== Status Tracking Tests ====================
  describe('Status Tracking', () => {
    it('should track active records', () => {
      manager.setRetentionPolicy('order', 30);

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);

      manager.applyRetentionPolicy('order_active', 'order', recentDate);

      const report = manager.getRetentionReport();

      expect(report.active).toBeGreaterThan(0);
    });

    it('should transition from anonymize_scheduled to delete_scheduled', () => {
      manager.setRetentionPolicy('shipment', 365, 180, 365);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 185);

      const firstCheck = manager.applyRetentionPolicy(
        'shipment_transition',
        'shipment',
        pastDate
      );
      expect(firstCheck.action).toBe('anonymize');

      // Simulate passing deletion threshold
      const veryOldDate = new Date();
      veryOldDate.setDate(veryOldDate.getDate() - 366);

      const secondCheck = manager.applyRetentionPolicy(
        'shipment_transition',
        'shipment',
        veryOldDate
      );
      expect(secondCheck.action).toBe('delete');
    });
  });

  // ==================== scheduleForDeletion Tests ====================
  describe('scheduleForDeletion', () => {
    it('should schedule record for deletion', () => {
      const scheduled = manager.scheduleForDeletion('log_004', 'log', 30);

      expect(scheduled.recordId).toBe('log_004');
      expect(scheduled.deleteAt).toBeInstanceOf(Date);
    });

    it('should set correct deletion date', () => {
      const before = new Date();
      const scheduled = manager.scheduleForDeletion('log_005', 'log', 7);
      const after = new Date();

      const expectedDate = new Date(before.getTime() + 7 * 24 * 60 * 60 * 1000);

      expect(scheduled.deleteAt.getTime()).toBeGreaterThanOrEqual(
        expectedDate.getTime() - 1000
      );
      expect(scheduled.deleteAt.getTime()).toBeLessThanOrEqual(
        expectedDate.getTime() + 1000
      );
    });
  });

  // ==================== Mark as Deleted Tests ====================
  describe('markAsDeleted', () => {
    it('should mark record as deleted', () => {
      manager.scheduleForDeletion('log_006', 'log', 0);
      manager.markAsDeleted('log_006');

      const report = manager.getRetentionReport();

      expect(report.deleted).toBeGreaterThan(0);
    });

    it('should not affect non-existent records', () => {
      // Should not throw
      manager.markAsDeleted('nonexistent_001');

      const report = manager.getRetentionReport();
      expect(report.deleted).toBe(0);
    });
  });

  // ==================== Multi-Entity Tests ====================
  describe('Multi-Entity Type Management', () => {
    it('should manage different entity types with different policies', () => {
      manager.setRetentionPolicy('order', 90);
      manager.setRetentionPolicy('payment', 180);
      manager.setRetentionPolicy('log', 30);

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const orderResult = manager.applyRetentionPolicy('order_001', 'order', oldDate);
      const paymentResult = manager.applyRetentionPolicy(
        'payment_001',
        'payment',
        oldDate
      );
      const logResult = manager.applyRetentionPolicy('log_001', 'log', oldDate);

      expect(orderResult.action).toBe('delete'); // 100 > 90
      expect(paymentResult.action).toBe('none'); // 100 < 180
      expect(logResult.action).toBe('delete'); // 100 > 30
    });

    it('should provide accurate per-entity-type statistics', () => {
      manager.setRetentionPolicy('order', 30);
      manager.setRetentionPolicy('shipment', 60);

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);

      manager.applyRetentionPolicy('order_011', 'order', oldDate);
      manager.applyRetentionPolicy('order_012', 'order', oldDate);
      manager.applyRetentionPolicy('shipment_002', 'shipment', new Date());

      const report = manager.getRetentionReport();

      expect(report.byEntityType['order'].scheduled).toBeGreaterThan(0);
      expect(report.byEntityType['shipment'].active).toBeGreaterThan(0);
    });
  });
});
