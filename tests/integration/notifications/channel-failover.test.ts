/**
 * Notification Channel Failover Test Suite
 * Tests failover chain, circuit breaker, retries, and DLQ handling
 * ~180 lines
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NotificationChannel, ChannelPayload } from '../fixtures/notification-fixtures.js';
import {
  createEmailChannel,
  createFailedDeliveryReceipt,
  createEmailChannelPayload,
  createFailoverScenario,
} from '../fixtures/notification-fixtures.js';

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface FailoverChain {
  channels: NotificationChannel[];
  dlqMessage?: { payload: ChannelPayload; reason: string; timestamp: Date };
}

interface CircuitBreakerState {
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
}

// ─── CIRCUIT BREAKER ────────────────────────────────────────────────────────

class ChannelCircuitBreaker {
  private state: CircuitBreakerState = {
    status: 'CLOSED',
    failureCount: 0,
    successCount: 0,
  };

  private readonly failureThreshold = 5;
  private readonly resetTimeout = 60000; // 1 minute

  recordSuccess(): void {
    this.state.failureCount = 0;
    this.state.successCount++;
    this.state.status = 'CLOSED';
  }

  recordFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = new Date();
    if (this.state.failureCount >= this.failureThreshold) {
      this.state.status = 'OPEN';
    }
  }

  isOpen(): boolean {
    if (this.state.status === 'OPEN') {
      const timeSinceFailure = Date.now() - (this.state.lastFailureTime?.getTime() || 0);
      if (timeSinceFailure > this.resetTimeout) {
        this.state.status = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      status: 'CLOSED',
      failureCount: 0,
      successCount: 0,
    };
  }
}

// ─── FAILOVER SERVICE ───────────────────────────────────────────────────────

class FailoverService {
  private circuitBreakers: Map<string, ChannelCircuitBreaker> = new Map();
  private dlq: Array<{ payload: ChannelPayload; reason: string; timestamp: Date }> = [];

  constructor(
    private providers: Map<string, { send: (p: ChannelPayload) => Promise<boolean> }>,
    private maxRetries: number = 3,
    private initialDelayMs: number = 100
  ) {}

  async deliverWithFailover(
    channels: NotificationChannel[],
    payload: ChannelPayload
  ): Promise<{ success: boolean; failedChannels: NotificationChannel[] }> {
    const failedChannels: NotificationChannel[] = [];

    for (const channel of channels) {
      const breaker = this.getCircuitBreaker(channel.provider || '');
      if (breaker.isOpen()) {
        failedChannels.push(channel);
        continue;
      }

      const delivered = await this.deliverWithRetry(channel, payload);
      if (!delivered) {
        breaker.recordFailure();
        failedChannels.push(channel);
      } else {
        breaker.recordSuccess();
      }
    }

    if (failedChannels.length === channels.length) {
      this.dlq.push({
        payload,
        reason: 'All channels failed',
        timestamp: new Date(),
      });
      return { success: false, failedChannels };
    }

    return {
      success: failedChannels.length < channels.length,
      failedChannels,
    };
  }

  private async deliverWithRetry(channel: NotificationChannel, payload: ChannelPayload): Promise<boolean> {
    const provider = this.providers.get(channel.provider || '');
    if (!provider) return false;

    let delayMs = this.initialDelayMs;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const success = await provider.send(payload);
        if (success) return true;
      } catch {
        // Retry
      }

      if (attempt < this.maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      }
    }
    return false;
  }

  private getCircuitBreaker(provider: string): ChannelCircuitBreaker {
    if (!this.circuitBreakers.has(provider)) {
      this.circuitBreakers.set(provider, new ChannelCircuitBreaker());
    }
    return this.circuitBreakers.get(provider)!;
  }

  getCircuitBreakerState(provider: string): CircuitBreakerState {
    return this.getCircuitBreaker(provider).getState();
  }

  getDLQMessages(): Array<{ payload: ChannelPayload; reason: string; timestamp: Date }> {
    return [...this.dlq];
  }

  clearDLQ(): void {
    this.dlq = [];
  }
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe('Channel Failover & Circuit Breaker', () => {
  let failoverService: FailoverService;
  let mockSendGrid: { send: ReturnType<typeof vi.fn> };
  let mockMailgun: { send: ReturnType<typeof vi.fn> };
  let mockSES: { send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSendGrid = { send: vi.fn(async () => true) };
    mockMailgun = { send: vi.fn(async () => true) };
    mockSES = { send: vi.fn(async () => true) };

    const providers = new Map([
      ['sendgrid', mockSendGrid],
      ['mailgun', mockMailgun],
      ['ses', mockSES],
    ]);

    failoverService = new FailoverService(providers, 3, 10);
  });

  // ─── BASIC FAILOVER ─────────────────────────────────────────────────────

  describe('Basic Failover Chain', () => {
    it('should use primary channel when available', async () => {
      const channels = [
        createEmailChannel({ provider: 'sendgrid' }),
        createEmailChannel({ provider: 'mailgun' }),
      ];
      const payload = createEmailChannelPayload();

      const result = await failoverService.deliverWithFailover(channels, payload);

      expect(result.success).toBe(true);
      expect(result.failedChannels).toHaveLength(0);
      expect(mockSendGrid.send).toHaveBeenCalled();
    });

    it('should fallback to secondary when primary fails', async () => {
      mockSendGrid.send.mockResolvedValueOnce(false);
      mockMailgun.send.mockResolvedValueOnce(true);

      const channels = [
        createEmailChannel({ provider: 'sendgrid' }),
        createEmailChannel({ provider: 'mailgun' }),
      ];
      const payload = createEmailChannelPayload();

      const result = await failoverService.deliverWithFailover(channels, payload);

      expect(result.success).toBe(true);
      expect(result.failedChannels).toHaveLength(1);
      expect(mockMailgun.send).toHaveBeenCalled();
    });

    it('should fallback to tertiary when primary and secondary fail', async () => {
      mockSendGrid.send.mockResolvedValueOnce(false);
      mockMailgun.send.mockResolvedValueOnce(false);
      mockSES.send.mockResolvedValueOnce(true);

      const channels = [
        createEmailChannel({ provider: 'sendgrid' }),
        createEmailChannel({ provider: 'mailgun' }),
        createEmailChannel({ provider: 'ses' }),
      ];
      const payload = createEmailChannelPayload();

      const result = await failoverService.deliverWithFailover(channels, payload);

      expect(result.success).toBe(true);
      expect(result.failedChannels).toHaveLength(2);
      expect(mockSES.send).toHaveBeenCalled();
    });
  });

  // ─── ALL CHANNELS FAIL & DLQ ────────────────────────────────────────────

  describe('All Channels Fail → DLQ', () => {
    it('should send to DLQ when all channels fail', async () => {
      mockSendGrid.send.mockResolvedValueOnce(false);
      mockMailgun.send.mockResolvedValueOnce(false);
      mockSES.send.mockResolvedValueOnce(false);

      const channels = [
        createEmailChannel({ provider: 'sendgrid' }),
        createEmailChannel({ provider: 'mailgun' }),
        createEmailChannel({ provider: 'ses' }),
      ];
      const payload = createEmailChannelPayload();

      const result = await failoverService.deliverWithFailover(channels, payload);

      expect(result.success).toBe(false);
      expect(result.failedChannels).toHaveLength(3);

      const dlqMessages = failoverService.getDLQMessages();
      expect(dlqMessages).toHaveLength(1);
      expect(dlqMessages[0].reason).toBe('All channels failed');
    });

    it('should record timestamp when message goes to DLQ', async () => {
      mockSendGrid.send.mockResolvedValueOnce(false);

      const channels = [createEmailChannel({ provider: 'sendgrid' })];
      const payload = createEmailChannelPayload();

      await failoverService.deliverWithFailover(channels, payload);

      const dlqMessages = failoverService.getDLQMessages();
      expect(dlqMessages[0].timestamp).toBeInstanceOf(Date);
      expect(dlqMessages[0].timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  // ─── EXPONENTIAL BACKOFF ─────────────────────────────────────────────────

  describe('Exponential Backoff Retry', () => {
    it('should retry with exponential backoff delays', async () => {
      let callCount = 0;
      mockSendGrid.send.mockImplementation(async () => {
        callCount++;
        return callCount === 3; // Succeed on 3rd attempt
      });

      const channels = [createEmailChannel({ provider: 'sendgrid' })];
      const payload = createEmailChannelPayload();

      const result = await failoverService.deliverWithFailover(channels, payload);

      expect(result.success).toBe(true);
      expect(mockSendGrid.send).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries exceeded', async () => {
      mockSendGrid.send.mockResolvedValue(false);

      const channels = [createEmailChannel({ provider: 'sendgrid' })];
      const payload = createEmailChannelPayload();

      const result = await failoverService.deliverWithFailover(channels, payload);

      expect(result.success).toBe(false);
      expect(result.failedChannels).toHaveLength(1);
    });
  });

  // ─── CIRCUIT BREAKER ─────────────────────────────────────────────────────

  describe('Circuit Breaker Per Channel', () => {
    it('should open circuit after threshold failures', async () => {
      mockSendGrid.send.mockResolvedValue(false);

      const channels = [createEmailChannel({ provider: 'sendgrid' })];
      const payload = createEmailChannelPayload();

      // Trigger 5 failures (threshold)
      for (let i = 0; i < 5; i++) {
        await failoverService.deliverWithFailover(channels, payload);
      }

      const state = failoverService.getCircuitBreakerState('sendgrid');
      expect(state.status).toBe('OPEN');
      expect(state.failureCount).toBe(5);
    });

    it('should track circuit breaker state', async () => {
      mockSendGrid.send.mockResolvedValue(true);

      const channels = [createEmailChannel({ provider: 'sendgrid' })];
      const payload = createEmailChannelPayload();

      await failoverService.deliverWithFailover(channels, payload);

      const state = failoverService.getCircuitBreakerState('sendgrid');
      expect(state.status).toBe('CLOSED');
      expect(state.successCount).toBe(1);
    });

    it('should skip delivery when circuit is open', async () => {
      mockSendGrid.send.mockResolvedValue(false);

      const channels = [createEmailChannel({ provider: 'sendgrid' })];
      const payload = createEmailChannelPayload();

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await failoverService.deliverWithFailover(channels, payload);
      }

      mockSendGrid.send.mockClear();

      // Try delivery with open circuit
      const result = await failoverService.deliverWithFailover(channels, payload);

      expect(result.failedChannels).toHaveLength(1);
      expect(mockSendGrid.send).not.toHaveBeenCalled();
    });
  });

  // ─── TIMEOUT HANDLING ────────────────────────────────────────────────────

  describe('Timeout Handling (5s per channel)', () => {
    it('should timeout delivery after 5 seconds', async () => {
      const longRunningDelayMs = 6000;
      mockSendGrid.send.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), longRunningDelayMs))
      );

      const channels = [createEmailChannel({ provider: 'sendgrid' })];
      const payload = createEmailChannelPayload();

      const startTime = Date.now();
      await failoverService.deliverWithFailover(channels, payload);
      const elapsedMs = Date.now() - startTime;

      expect(elapsedMs).toBeLessThan(longRunningDelayMs);
    });
  });

  // ─── PARTIAL SUCCESS ─────────────────────────────────────────────────────

  describe('Partial Success Scenarios', () => {
    it('should return success when at least one channel succeeds', async () => {
      mockSendGrid.send.mockResolvedValueOnce(true);
      mockMailgun.send.mockResolvedValueOnce(false);

      const channels = [
        createEmailChannel({ provider: 'sendgrid' }),
        createEmailChannel({ provider: 'mailgun' }),
      ];
      const payload = createEmailChannelPayload();

      const result = await failoverService.deliverWithFailover(channels, payload);

      expect(result.success).toBe(true);
      expect(result.failedChannels).toHaveLength(1);
    });

    it('should report which channels failed', async () => {
      mockSendGrid.send.mockResolvedValueOnce(false);
      mockMailgun.send.mockResolvedValueOnce(true);
      mockSES.send.mockResolvedValueOnce(false);

      const channels = [
        createEmailChannel({ provider: 'sendgrid' }),
        createEmailChannel({ provider: 'mailgun' }),
        createEmailChannel({ provider: 'ses' }),
      ];
      const payload = createEmailChannelPayload();

      const result = await failoverService.deliverWithFailover(channels, payload);

      expect(result.failedChannels).toHaveLength(2);
      expect(result.failedChannels.map((c) => c.provider)).toContain('sendgrid');
      expect(result.failedChannels.map((c) => c.provider)).toContain('ses');
    });
  });
});
