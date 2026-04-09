/**
 * Tests for Proof-of-Delivery submission flow via OfflineQueue
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfflineQueue } from '../offline-queue';

// Stub browser globals not available in Node
vi.stubGlobal('window', { addEventListener: vi.fn() });
vi.stubGlobal('localStorage', (() => {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
})());
// navigator.onLine is read-only in jsdom — define it as configurable
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  writable: true,
  configurable: true,
});

const makePODPayload = (overrides: Partial<Record<string, unknown>> = {}) => ({
  shipmentId: 'ship-abc-123',
  recipientName: 'John Doe',
  notes: 'Left at door',
  photoBase64: 'data:image/jpeg;base64,/9j/abc',
  signatureBase64: 'data:image/svg+xml;base64,PHN2Zy8+',
  latitude: 19.076,
  longitude: 72.877,
  timestamp: 1712345678000,
  ...overrides,
});

describe('OfflineQueue — Proof of Delivery', () => {
  let queue: OfflineQueue;

  beforeEach(() => {
    localStorage.clear?.();
    // Reset the module-level singleton by creating a new instance
    queue = new OfflineQueue();
  });

  it('enqueues a POD submission and returns an operation id', () => {
    const payload = makePODPayload();
    const id = queue.enqueue({
      type: 'POST',
      endpoint: `/api/v4/shipments/${payload.shipmentId}/proof-of-delivery`,
      method: 'POST',
      body: payload,
    });

    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');

    const status = queue.getQueueStatus();
    expect(status.pending).toBe(1);
    expect(status.total).toBe(1);
  });

  it('stores endpoint and body correctly', () => {
    const payload = makePODPayload();
    const id = queue.enqueue({
      type: 'POST',
      endpoint: '/api/v4/shipments/ship-abc-123/proof-of-delivery',
      method: 'POST',
      body: payload,
    });

    const op = queue.getOperation(id);
    expect(op).toBeDefined();
    expect(op?.endpoint).toBe('/api/v4/shipments/ship-abc-123/proof-of-delivery');
    expect(op?.body.recipientName).toBe('John Doe');
    expect(op?.body.photoBase64).toBe('data:image/jpeg;base64,/9j/abc');
    expect(op?.body.signatureBase64).toBe('data:image/svg+xml;base64,PHN2Zy8+');
  });

  it('includes GPS coordinates in queued body', () => {
    const payload = makePODPayload({ latitude: 51.5074, longitude: -0.1278 });
    const id = queue.enqueue({
      type: 'POST',
      endpoint: '/api/v4/shipments/ship-abc-123/proof-of-delivery',
      method: 'POST',
      body: payload,
    });

    const op = queue.getOperation(id);
    expect(op?.body.latitude).toBeCloseTo(51.5074, 4);
    expect(op?.body.longitude).toBeCloseTo(-0.1278, 4);
  });

  it('queues submission when offline', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      writable: true,
      configurable: true,
    });
    queue = new OfflineQueue();

    const id = queue.enqueue({
      type: 'POST',
      endpoint: '/api/v4/shipments/s1/proof-of-delivery',
      method: 'POST',
      body: makePODPayload(),
    });

    expect(queue.isCurrentlyOnline()).toBe(false);
    expect(id).toBeTruthy();
    const status = queue.getQueueStatus();
    expect(status.pending).toBe(1);

    // Restore
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      writable: true,
      configurable: true,
    });
  });

  it('reports empty queue before any enqueue', () => {
    const status = queue.getQueueStatus();
    expect(status.total).toBe(0);
    expect(status.pending).toBe(0);
  });

  it('handles multiple POD submissions', () => {
    const ids = ['ship-1', 'ship-2', 'ship-3'].map((shipmentId) =>
      queue.enqueue({
        type: 'POST',
        endpoint: `/api/v4/shipments/${shipmentId}/proof-of-delivery`,
        method: 'POST',
        body: makePODPayload({ shipmentId }),
      }),
    );

    expect(new Set(ids).size).toBe(3); // all unique
    expect(queue.getQueueStatus().total).toBe(3);
  });
});
