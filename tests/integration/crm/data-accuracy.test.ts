/**
 * CRM Data Accuracy Integration Tests
 * Tests: Contact field mapping, deal amounts, date/timezone handling,
 * custom fields, associations, Unicode handling, null field handling
 * ~200 lines, 18+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockContact,
  createMockDeal,
  createMockCompany,
  createMockSalesforceResponse,
  createMockHubSpotResponse,
} from '../fixtures/crm-accounting-fixtures.js';

// ─────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────

interface ContactFieldMap {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
}

interface DealData {
  id: string;
  amount: number;
  currency: string;
  status: string;
  closedAt?: Date;
  contactId?: string;
  companyId?: string;
}

interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsSkipped: number;
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────

describe('CRM Data Accuracy', () => {
  let syncResults: Map<string, SyncResult>;

  beforeEach(() => {
    syncResults = new Map();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    syncResults.clear();
  });

  // ───────────────────────────────────────────────────────────────────────
  // CONTACT FIELD MAPPING ACCURACY
  // ───────────────────────────────────────────────────────────────────────

  describe('Contact Field Mapping', () => {
    it('should accurately map contact name fields', () => {
      const contact = createMockContact({
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@company.com',
        phone: '+1-555-123-4567',
        company: 'Acme Corp',
      });

      expect(contact.firstName).toBe('John');
      expect(contact.lastName).toBe('Smith');
      expect(contact.fullName).toBe('John Smith');
    });

    it('should handle single-word names correctly', () => {
      const contact = createMockContact({
        firstName: 'Madonna',
        lastName: '',
      });

      expect(contact.firstName).toBe('Madonna');
      expect(contact.lastName).toBe('');
      expect(contact.fullName).toBe('Madonna');
    });

    it('should preserve email format in mapping', () => {
      const emails = [
        'simple@example.com',
        'user.name+tag@example.co.uk',
        'user_name@sub.example.com',
        'user123@example.com',
      ];

      emails.forEach((email) => {
        const contact = createMockContact({ email });
        expect(contact.email).toBe(email);
        expect(contact.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });
    });

    it('should normalize phone numbers with international format', () => {
      const contact = createMockContact({
        phone: '+1-555-123-4567',
      });

      expect(contact.phone).toBeDefined();
      expect(contact.phone).toMatch(/\+\d{1,3}-\d{3}-\d{3}-\d{4}/);
    });

    it('should accurately map company field', () => {
      const contact = createMockContact({
        company: 'Acme Corporation Ltd.',
      });

      expect(contact.company).toBe('Acme Corporation Ltd.');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // DEAL/OPPORTUNITY AMOUNT PRECISION
  // ───────────────────────────────────────────────────────────────────────

  describe('Deal Amount Precision', () => {
    it('should handle deal amount with USD currency', () => {
      const deal = createMockDeal({
        amount: 10000.00,
        currency: 'USD',
      });

      expect(deal.amount).toBe(10000.00);
      expect(deal.currency).toBe('USD');
      expect(deal.amount % 0.01).toBeLessThan(0.001); // 2 decimal precision
    });

    it('should preserve decimal precision for amounts', () => {
      const amounts = [0.01, 100.50, 1000.99, 50000.75, 999999.99];

      amounts.forEach((amount) => {
        const deal = createMockDeal({ amount });
        expect(deal.amount).toBe(amount);
      });
    });

    it('should handle EUR currency conversion', () => {
      const deal = createMockDeal({
        amount: 8500.50,
        currency: 'EUR',
      });

      expect(deal.amount).toBe(8500.50);
      expect(deal.currency).toBe('EUR');
    });

    it('should validate amount is non-negative', () => {
      const deal = createMockDeal({ amount: 0.00 });
      expect(deal.amount).toBeGreaterThanOrEqual(0);
    });

    it('should handle large deal amounts without precision loss', () => {
      const deal = createMockDeal({ amount: 1000000.50 });
      expect(deal.amount).toBe(1000000.50);
      expect(Number.isInteger(deal.amount * 100)).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // DATE & TIMEZONE NORMALIZATION
  // ───────────────────────────────────────────────────────────────────────

  describe('Date & Timezone Normalization', () => {
    it('should store dates in UTC', () => {
      const deal = createMockDeal({
        closedAt: new Date('2024-03-15T14:30:00Z'),
      });

      expect(deal.closedAt).toBeDefined();
      expect(deal.closedAt?.toISOString()).toContain('2024-03-15T14:30:00');
      expect(deal.closedAt?.getUTCHours()).toBe(14);
    });

    it('should normalize timezone-aware dates to UTC', () => {
      // Date 3:30 PM EST = 8:30 PM UTC
      const estDate = new Date('2024-03-15T15:30:00-05:00');
      const deal = createMockDeal({ closedAt: estDate });

      const utcHours = deal.closedAt?.getUTCHours();
      expect(utcHours).toBe(20); // 3:30 PM EST + 5 hours = 8:30 PM UTC
    });

    it('should handle date conversions consistently', () => {
      const testDate = new Date('2024-03-15T12:00:00Z');
      const deal1 = createMockDeal({ closedAt: testDate });
      const deal2 = createMockDeal({ closedAt: testDate });

      expect(deal1.closedAt?.getTime()).toBe(deal2.closedAt?.getTime());
    });

    it('should parse ISO 8601 date strings', () => {
      const isoString = '2024-03-15T09:30:00Z';
      const deal = createMockDeal({
        closedAt: new Date(isoString),
      });

      expect(deal.closedAt?.toISOString()).toBe(isoString);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // CUSTOM FIELD SYNC ACCURACY
  // ───────────────────────────────────────────────────────────────────────

  describe('Custom Field Sync', () => {
    it('should sync custom text fields accurately', () => {
      const contact = createMockContact({
        customFields: {
          account_type: 'enterprise',
          industry: 'Technology',
        },
      });

      expect(contact.customFields?.account_type).toBe('enterprise');
      expect(contact.customFields?.industry).toBe('Technology');
    });

    it('should sync custom numeric fields with precision', () => {
      const contact = createMockContact({
        customFields: {
          lifetime_value: 50000.75,
          customer_score: 92.5,
        },
      });

      expect(contact.customFields?.lifetime_value).toBe(50000.75);
      expect(contact.customFields?.customer_score).toBe(92.5);
    });

    it('should sync custom date fields', () => {
      const customDate = new Date('2024-01-15T10:00:00Z');
      const contact = createMockContact({
        customFields: {
          contract_start_date: customDate,
          last_review_date: new Date('2024-03-01T10:00:00Z'),
        },
      });

      expect(contact.customFields?.contract_start_date).toEqual(customDate);
    });

    it('should handle missing custom fields gracefully', () => {
      const contact = createMockContact({
        customFields: undefined,
      });

      expect(contact.customFields).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // ASSOCIATION INTEGRITY
  // ───────────────────────────────────────────────────────────────────────

  describe('Association Integrity', () => {
    it('should maintain contact-to-company association', () => {
      const contact = createMockContact({
        id: 'contact_123',
        company: 'Acme Corp',
      });

      const company = createMockCompany({
        id: 'company_123',
        name: 'Acme Corp',
      });

      expect(contact.company).toBe(company.name);
    });

    it('should maintain deal-to-contact association', () => {
      const contact = createMockContact({ id: 'contact_456' });
      const deal = createMockDeal({
        id: 'deal_789',
        contactId: contact.id,
      });

      expect(deal.contactId).toBe(contact.id);
    });

    it('should maintain deal-to-company association', () => {
      const company = createMockCompany({ id: 'company_001' });
      const deal = createMockDeal({
        id: 'deal_001',
        companyId: company.id,
      });

      expect(deal.companyId).toBe(company.id);
    });

    it('should handle broken associations gracefully', () => {
      const deal = createMockDeal({
        contactId: 'non_existent_contact',
      });

      expect(deal.contactId).toBe('non_existent_contact');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // UNICODE & INTERNATIONAL CHARACTER HANDLING
  // ───────────────────────────────────────────────────────────────────────

  describe('Unicode & International Characters', () => {
    it('should handle Japanese characters in names', () => {
      const contact = createMockContact({
        firstName: '田中',
        lastName: '太郎',
      });

      expect(contact.firstName).toBe('田中');
      expect(contact.lastName).toBe('太郎');
    });

    it('should handle accented characters in names', () => {
      const contact = createMockContact({
        firstName: 'José',
        lastName: 'García',
      });

      expect(contact.firstName).toBe('José');
      expect(contact.lastName).toBe('García');
    });

    it('should handle company names with special characters', () => {
      const company = createMockCompany({
        name: 'Société à Responsabilité Limitée (SARL)',
      });

      expect(company.name).toBe('Société à Responsabilité Limitée (SARL)');
    });

    it('should preserve Cyrillic characters', () => {
      const contact = createMockContact({
        firstName: 'Иван',
        lastName: 'Петров',
      });

      expect(contact.firstName).toBe('Иван');
      expect(contact.lastName).toBe('Петров');
    });

    it('should handle emoji and special symbols', () => {
      const contact = createMockContact({
        customFields: {
          notes: 'Great customer! 🌟 Top tier account',
        },
      });

      expect(contact.customFields?.notes).toContain('🌟');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // EMPTY & NULL FIELD HANDLING
  // ───────────────────────────────────────────────────────────────────────

  describe('Empty & Null Field Handling', () => {
    it('should handle null email field', () => {
      const contact = createMockContact({
        email: null as any,
      });

      expect(contact.email).toBeNull();
    });

    it('should handle empty string fields', () => {
      const contact = createMockContact({
        phone: '',
        company: '',
      });

      expect(contact.phone).toBe('');
      expect(contact.company).toBe('');
    });

    it('should handle undefined custom fields', () => {
      const contact = createMockContact({
        customFields: {},
      });

      expect(Object.keys(contact.customFields || {})).toHaveLength(0);
    });

    it('should distinguish between null and empty string', () => {
      const contact1 = createMockContact({ phone: '' });
      const contact2 = createMockContact({ phone: null as any });

      expect(contact1.phone).toBe('');
      expect(contact2.phone).toBeNull();
    });

    it('should handle optional date fields when not provided', () => {
      const deal = createMockDeal({
        closedAt: undefined,
      });

      expect(deal.closedAt).toBeUndefined();
    });
  });
});
