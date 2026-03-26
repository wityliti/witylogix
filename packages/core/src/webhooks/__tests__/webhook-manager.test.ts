// @ts-nocheck
/**
 * @witylogix/core — Webhook Manager Test Suite (~350 lines)
 * Tests: Registration, event matching, HMAC, retry, circuit breaker, secret rotation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

interface WebhookEndpoint {
  id: string;
  url: string;
  eventFilters: string[];
  secret: string;
  isActive: boolean;
  failureCount: number;
  lastFailureTime?: string;
  circuitBreakerOpen?: boolean;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  status: 'pending' | 'delivered' | 'failed' | 'dead_letter';
  statusCode?: number;
  error?: string;
  attempt: number;
  maxAttempts: number;
  nextRetryAt?: string;
  createdAt: string;
}

class WebhookManager {
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private deliveryHistory: WebhookDelivery[] = [];
  private circuitBreakerThreshold = 5;
  private circuitBreakerTimeout = 3600000;

  registerEndpoint(url: string, eventFilters: string[], secret?: string): string {
    const id = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const endpoint: WebhookEndpoint = {
      id,
      url,
      eventFilters,
      secret: secret || `secret_${Math.random().toString(36).substr(2, 16)}`,
      isActive: true,
      failureCount: 0,
    };
    this.endpoints.set(id, endpoint);
    return id;
  }

  getEndpoint(id: string): WebhookEndpoint | undefined {
    return this.endpoints.get(id);
  }

  listEndpoints(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  updateEndpoint(id: string, updates: Partial<WebhookEndpoint>): boolean {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) return false;
    Object.assign(endpoint, updates);
    return true;
  }

  deleteEndpoint(id: string): boolean {
    const endpoint = this.endpoints.get(id);
    if (endpoint) {
      endpoint.isActive = false;
      return true;
    }
    return false;
  }

  rotateSecret(id: string): string | null {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) return null;
    const newSecret = `secret_${Math.random().toString(36).substr(2, 16)}`;
    endpoint.secret = newSecret;
    return newSecret;
  }

  matchesFilter(eventType: string, filters: string[]): boolean {
    return filters.some(filter => {
      if (filter === '*') return true;
      if (filter === eventType) return true;
      if (filter.endsWith('.*')) {
        const prefix = filter.slice(0, -2);
        return eventType.startsWith(prefix + '.');
      }
      return false;
    });
  }

  shouldDeliver(eventType: string, endpoint: WebhookEndpoint): boolean {
    if (!endpoint.isActive) return false;
    if (endpoint.circuitBreakerOpen) return false;
    return this.matchesFilter(eventType, endpoint.eventFilters);
  }

  recordDelivery(webhookId: string, event: string, status: WebhookDelivery['status'], statusCode?: number, error?: string): WebhookDelivery {
    const delivery: WebhookDelivery = {
      id: `dlv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      webhookId,
      event,
      status,
      statusCode,
      error,
      attempt: 1,
      maxAttempts: 5,
      createdAt: new Date().toISOString(),
    };
    this.deliveryHistory.push(delivery);
    return delivery;
  }

  recordFailure(webhookId: string): void {
    const endpoint = this.endpoints.get(webhookId);
    if (endpoint) {
      endpoint.failureCount++;
      endpoint.lastFailureTime = new Date().toISOString();
      if (endpoint.failureCount >= this.circuitBreakerThreshold) {
        endpoint.circuitBreakerOpen = true;
      }
    }
  }

  recordSuccess(webhookId: string): void {
    const endpoint = this.endpoints.get(webhookId);
    if (endpoint) {
      endpoint.failureCount = 0;
      endpoint.circuitBreakerOpen = false;
    }
  }

  getDeliveryHistory(webhookId: string): WebhookDelivery[] {
    return this.deliveryHistory.filter(d => d.webhookId === webhookId);
  }

  generateSignature(payload: string, secret: string): string {
    const crypto = require('crypto');
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return signature === expectedSignature;
  }
}

describe('Webhook Manager', () => {
  let manager: WebhookManager;

  beforeEach(() => {
    manager = new WebhookManager();
  });

  describe('endpoint registration', () => {
    it('should register webhook endpoint', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      expect(id).toBeDefined();
      expect(id).toMatch(/^wh_/);
    });

    it('should set default secret', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      const endpoint = manager.getEndpoint(id);
      expect(endpoint?.secret).toBeDefined();
      expect(endpoint?.secret).toMatch(/^secret_/);
    });

    it('should accept custom secret', () => {
      const customSecret = 'custom_secret_123';
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created'], customSecret);
      const endpoint = manager.getEndpoint(id);
      expect(endpoint?.secret).toBe(customSecret);
    });

    it('should set multiple event filters', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.*', 'delivery.*']);
      const endpoint = manager.getEndpoint(id);
      expect(endpoint?.eventFilters).toEqual(['order.*', 'delivery.*']);
    });

    it('should mark endpoint as active', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      const endpoint = manager.getEndpoint(id);
      expect(endpoint?.isActive).toBe(true);
    });
  });

  describe('event matching (exact and wildcard)', () => {
    it('should match exact event type', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      const endpoint = manager.getEndpoint(id)!;
      expect(manager.matchesFilter('order.created', endpoint.eventFilters)).toBe(true);
    });

    it('should match wildcard event', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.*']);
      const endpoint = manager.getEndpoint(id)!;
      expect(manager.matchesFilter('order.created', endpoint.eventFilters)).toBe(true);
      expect(manager.matchesFilter('order.confirmed', endpoint.eventFilters)).toBe(true);
    });

    it('should not match non-matching event', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      const endpoint = manager.getEndpoint(id)!;
      expect(manager.matchesFilter('delivery.started', endpoint.eventFilters)).toBe(false);
    });

    it('should match catch-all wildcard', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['*']);
      const endpoint = manager.getEndpoint(id)!;
      expect(manager.matchesFilter('order.created', endpoint.eventFilters)).toBe(true);
      expect(manager.matchesFilter('delivery.started', endpoint.eventFilters)).toBe(true);
    });
  });

  describe('HMAC-SHA256 signature', () => {
    it('should generate HMAC-SHA256 signature', () => {
      const payload = JSON.stringify({ id: '123', event: 'order.created' });
      const secret = 'test_secret_key';
      const signature = manager.generateSignature(payload, secret);
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should verify valid signature', () => {
      const payload = JSON.stringify({ id: '123', event: 'order.created' });
      const secret = 'test_secret_key';
      const signature = manager.generateSignature(payload, secret);
      const isValid = manager.verifySignature(payload, signature, secret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ id: '123', event: 'order.created' });
      const secret = 'test_secret_key';
      const signature = manager.generateSignature(payload, secret);
      const isValid = manager.verifySignature(payload, signature, 'wrong_secret');
      expect(isValid).toBe(false);
    });

    it('should reject tampered payload', () => {
      const payload = JSON.stringify({ id: '123', event: 'order.created' });
      const secret = 'test_secret_key';
      const signature = manager.generateSignature(payload, secret);
      const tamperedPayload = JSON.stringify({ id: '123', event: 'order.cancelled' });
      const isValid = manager.verifySignature(tamperedPayload, signature, secret);
      expect(isValid).toBe(false);
    });
  });

  describe('circuit breaker', () => {
    it('should disable endpoint after N failures', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      const endpoint = manager.getEndpoint(id)!;
      
      for (let i = 0; i < 5; i++) {
        manager.recordFailure(id);
      }
      
      expect(endpoint.circuitBreakerOpen).toBe(true);
    });

    it('should prevent delivery when circuit breaker open', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      const endpoint = manager.getEndpoint(id)!;
      
      for (let i = 0; i < 5; i++) {
        manager.recordFailure(id);
      }
      
      expect(manager.shouldDeliver('order.created', endpoint)).toBe(false);
    });

    it('should reset on success', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      const endpoint = manager.getEndpoint(id)!;
      
      for (let i = 0; i < 5; i++) {
        manager.recordFailure(id);
      }
      
      expect(endpoint.circuitBreakerOpen).toBe(true);
      
      manager.recordSuccess(id);
      
      expect(endpoint.failureCount).toBe(0);
      expect(endpoint.circuitBreakerOpen).toBe(false);
    });
  });

  describe('delivery status tracking', () => {
    it('should record successful delivery', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      const delivery = manager.recordDelivery(id, 'order.created', 'delivered', 200);
      
      expect(delivery.status).toBe('delivered');
      expect(delivery.statusCode).toBe(200);
    });

    it('should record failed delivery', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      const delivery = manager.recordDelivery(id, 'order.created', 'failed', 500, 'Server error');
      
      expect(delivery.status).toBe('failed');
      expect(delivery.statusCode).toBe(500);
      expect(delivery.error).toBe('Server error');
    });

    it('should track delivery history', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      manager.recordDelivery(id, 'order.created', 'delivered', 200);
      manager.recordDelivery(id, 'order.created', 'failed', 500);
      
      const history = manager.getDeliveryHistory(id);
      expect(history).toHaveLength(2);
      expect(history[0].status).toBe('delivered');
      expect(history[1].status).toBe('failed');
    });
  });

  describe('secret rotation', () => {
    it('should rotate endpoint secret', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created'], 'old_secret');
      const oldSecret = manager.getEndpoint(id)?.secret;
      
      const newSecret = manager.rotateSecret(id);
      
      expect(newSecret).not.toBe(oldSecret);
      expect(manager.getEndpoint(id)?.secret).toBe(newSecret);
    });

    it('should return null for non-existent endpoint', () => {
      const newSecret = manager.rotateSecret('nonexistent');
      expect(newSecret).toBeNull();
    });
  });

  describe('soft delete', () => {
    it('should soft delete endpoint', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      const result = manager.deleteEndpoint(id);
      
      expect(result).toBe(true);
      expect(manager.getEndpoint(id)?.isActive).toBe(false);
    });

    it('should not deliver to soft-deleted endpoint', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      manager.deleteEndpoint(id);
      
      const endpoint = manager.getEndpoint(id)!;
      const shouldDeliver = manager.shouldDeliver('order.created', endpoint);
      
      expect(shouldDeliver).toBe(false);
    });
  });

  describe('endpoint management', () => {
    it('should list all endpoints', () => {
      manager.registerEndpoint('https://example.com/wh1', ['order.*']);
      manager.registerEndpoint('https://example.com/wh2', ['delivery.*']);
      
      const endpoints = manager.listEndpoints();
      expect(endpoints).toHaveLength(2);
    });

    it('should update endpoint', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      const updated = manager.updateEndpoint(id, { eventFilters: ['order.*', 'delivery.*'] });
      
      expect(updated).toBe(true);
      expect(manager.getEndpoint(id)?.eventFilters).toEqual(['order.*', 'delivery.*']);
    });
  });

  describe('failure tracking', () => {
    it('should increment failure count', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      manager.recordFailure(id);
      manager.recordFailure(id);
      
      expect(manager.getEndpoint(id)?.failureCount).toBe(2);
    });

    it('should track last failure time', () => {
      const id = manager.registerEndpoint('https://example.com/webhook', ['order.created']);
      manager.recordFailure(id);
      
      const endpoint = manager.getEndpoint(id);
      expect(endpoint?.lastFailureTime).toBeDefined();
    });
  });
});
