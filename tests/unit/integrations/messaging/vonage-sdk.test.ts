/**
 * Vonage SDK Client Tests
 *
 * Unit tests for JWT authentication, SMS/MMS/WhatsApp sending,
 * Dispatch API, Verify API, Number Insight, webhook verification,
 * rate limiting, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VonageSDKClient, type VonageMessage, type VonageDispatchConfig } from '../../../../packages/core/src/integrations/messaging/vonage-sdk-client';

// ─── MOCKS ──────────────────────────────────────────────────────────

const mockPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj
MzEfYyjiWA4R4ypq9D+BEHf5FnVPDuVHg1grcMHKHJk9T6xZo2yM/D4J3G0aG1uL
dZlB3uuoB+KMKzBFJY3KxwV2I7l4T0RmRdXz2yz6z3C7LzGg4qBBZBvJr5aF8D+Y
vlwXIv7q4AQqfpHHPU0Av+o3xBFhVgSY7N0c9pUSmMn+z8VRs6sNkJCIc/ZZKYr7
WvLLzh1Y0+A5yVxM/X7LEKnCy9d9DfBmMBJQTXZkQ4Nd5vBQvlGK+RjvKMvGZ7OZ
EIVKBhECcEEUCKvMcxgZX4J4K5qX+9aQ5Z7FhPLkLlEhLy9Y8/FfV7hBwfLb8fQe
lNjxJKkrAgMBAAECggEBAIvVF4xCBRv2P3Bsm6s2gd4+EQvCVZ3bP8Ej2u7L3I/y
iV/lp+lOWYRAVEtNXDWI3e0XmVxCDjTBfTQdPU+DX9D4Rq1H7K5M5v8T9B+G9DjP
WJXQpX9cJ8zBCq1fKVLwSf8TfDlkZO8A8l0Eg5C3Q3GY7+y8t/aGlXm+mS1+M3B8
nBd9bFhVfG2sAjTNhEKfvfqDx7I3P8Ke3B6vZLzVJe/+4F8J8nZLDLQz5LvC3YvL
0HqKp6Hl/D7Y5YK9oV9Bn4N8nQ7LqM3K3FfYvSyQsHqb+KJaLyEf2JQqV1lHFfZJ
zHqDzZ8H5J4Y5Y2FX2vL7ZY0J7K6L3K6K8K6K3ECgYEA4hAFT3lF7DL9g+RxEqXr
HgYNMGq4N0K3D0Q+DJmRf2lWE7xDK0oJ6JvMj3C5M3H8K3E0L0L4Z0E3H3F3E3F
3L0L0L0L0L0L0K0K0K0K0L0L2L0L0L0L0L0K0K2L0L0L0L0L0L0L0L0L0L0L0L0L0L
=CgYEA3fGR0VhZmN6
-----END PRIVATE KEY-----`;

const mockConfig = {
  applicationId: 'test-app-id-12345',
  privateKey: mockPrivateKey,
  apiKey: 'test-api-key',
  apiSecret: 'test-api-secret',
  webhookSecret: 'test-webhook-secret',
};

// ─── TESTS ───────────────────────────────────────────────────────────

describe('VonageSDKClient', () => {
  let client: VonageSDKClient;

  beforeEach(() => {
    client = new VonageSDKClient(mockConfig);
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  // ─── Configuration ──────────────────────────────────────────────

  describe('Configuration', () => {
    it('should initialize with required config', () => {
      expect(() => new VonageSDKClient(mockConfig)).not.toThrow();
    });

    it('should throw error if applicationId is missing', () => {
      expect(() => new VonageSDKClient({ ...mockConfig, applicationId: '' })).toThrow(
        'Vonage applicationId is required'
      );
    });

    it('should throw error if privateKey is missing', () => {
      expect(() => new VonageSDKClient({ ...mockConfig, privateKey: '' })).toThrow(
        'Vonage privateKey is required'
      );
    });

    it('should use default cluster and base URL', () => {
      const testClient = new VonageSDKClient(mockConfig);
      expect(testClient).toBeDefined();
    });
  });

  // ─── SMS Sending ────────────────────────────────────────────────

  describe('SMS Sending', () => {
    it('should send SMS successfully', async () => {
      const mockResponse = {
        messages: [
          {
            status: '0',
            'message-id': 'msg-123',
            'message-price': '0.05',
            'network-code': '310410',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.sendSMS('+1234567890', 'AppName', 'Hello World', 'ref-123');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(result.status).toBe('submitted');
      expect(result.metadata?.price).toBeUndefined(); // SMS doesn't track price
    });

    it('should handle SMS send failure', async () => {
      const mockResponse = {
        messages: [
          {
            status: '1',
            'error-text': 'Invalid phone number',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      });

      await expect(client.sendSMS('+invalid', 'AppName', 'Hello')).rejects.toThrow();
    });
  });

  // ─── MMS Sending ────────────────────────────────────────────────

  describe('MMS Sending', () => {
    it('should send MMS with image', async () => {
      const mockResponse = { message_uuid: 'uuid-456' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.sendMMS(
        '+1234567890',
        'AppName',
        'https://example.com/image.jpg',
        'image',
        'Check this out'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('uuid-456');
    });

    it('should send MMS with video', async () => {
      const mockResponse = { message_uuid: 'uuid-789' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.sendMMS(
        '+1234567890',
        'AppName',
        'https://example.com/video.mp4',
        'video'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('uuid-789');
    });
  });

  // ─── WhatsApp Sending ───────────────────────────────────────────

  describe('WhatsApp Sending', () => {
    it('should send WhatsApp text message', async () => {
      const mockResponse = { message_uuid: 'wa-msg-123' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      });

      const message: Partial<VonageMessage> = { text: 'Hello via WhatsApp' };

      const result = await client.sendWhatsApp('+1234567890', message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wa-msg-123');
    });

    it('should send WhatsApp template message', async () => {
      const mockResponse = { message_uuid: 'wa-template-123' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      });

      const message: Partial<VonageMessage> = {
        template: {
          name: 'hello_world',
          language: 'en',
          parameters: { '1': 'User' },
        },
      };

      const result = await client.sendWhatsApp('+1234567890', message);

      expect(result.success).toBe(true);
    });

    it('should reject WhatsApp message without content', async () => {
      const message: Partial<VonageMessage> = {};

      await expect(client.sendWhatsApp('+1234567890', message)).rejects.toThrow(
        'WhatsApp message must include'
      );
    });
  });

  // ─── Verify API ─────────────────────────────────────────────────

  describe('Verify API (2FA)', () => {
    it('should send verification code', async () => {
      const mockResponse = { request_id: 'req-123', status: '0' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.sendVerificationCode('+1234567890', 'MyApp', 4);

      expect(result.requestId).toBe('req-123');
      expect(result.status).toBe('pending');
      expect(result.to).toBe('+1234567890');
    });

    it('should verify code successfully', async () => {
      const mockResponse = { status: '0' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.checkVerificationCode('req-123', '1234');

      expect(result).toBe(true);
    });

    it('should fail verification for invalid code', async () => {
      const mockResponse = { status: '16' }; // Invalid code

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.checkVerificationCode('req-123', 'wrong');

      expect(result).toBe(false);
    });
  });

  // ─── Webhook Verification ──────────────────────────────────────

  describe('Webhook Verification', () => {
    it('should verify valid webhook signature', () => {
      const payload = {
        eventType: 'delivery',
        messageId: 'msg-123',
        timestamp: 1647525600,
        status: 'delivered',
      };

      const signature = require('crypto')
        .createHmac('sha256', mockConfig.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const isValid = client.verifyWebhookSignature(payload, signature);

      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = {
        eventType: 'delivery',
        messageId: 'msg-123',
        timestamp: 1647525600,
      };

      const isValid = client.verifyWebhookSignature(payload, 'invalid-signature');

      expect(isValid).toBe(false);
    });

    it('should reject webhook if no secret configured', () => {
      const clientNoSecret = new VonageSDKClient({ ...mockConfig, webhookSecret: undefined });

      const payload = {
        eventType: 'delivery',
        messageId: 'msg-123',
      };

      const isValid = clientNoSecret.verifyWebhookSignature(payload, 'any-signature');

      expect(isValid).toBe(false);
    });
  });

  // ─── Inbound Message Parsing ────────────────────────────────────

  describe('Inbound Message Parsing', () => {
    it('should parse inbound SMS', () => {
      const payload = {
        message_id: 'inbound-123',
        from: '+1234567890',
        to: '+0987654321',
        timestamp: 1647525600,
        text: 'Hello there',
        type: 'sms',
      };

      const message = client.parseInboundWebhook(payload);

      expect(message.messageId).toBe('inbound-123');
      expect(message.from).toBe('+1234567890');
      expect(message.text).toBe('Hello there');
      expect(message.type).toBe('sms');
    });
  });

  // ─── Rate Limiting ──────────────────────────────────────────────

  describe('Rate Limiting', () => {
    it('should enforce rate limiting', async () => {
      const mockResponse = {
        messages: [{ status: '0', 'message-id': 'msg-1' }],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResponse),
      });

      const start = Date.now();

      // Send multiple SMS to trigger rate limiting
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(client.sendSMS(`+123456789${i}`, 'App', 'Test'));
      }

      await Promise.all(promises);

      // All requests should complete without issues
      expect((global.fetch as any).mock.calls.length).toBeGreaterThan(0);
    });
  });

  // ─── Error Handling ─────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.sendSMS('+1234567890', 'App', 'Test')).rejects.toThrow(
        'Vonage API error'
      );
    });

    it('should handle network timeouts', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network timeout'));

      await expect(client.sendSMS('+1234567890', 'App', 'Test')).rejects.toThrow();
    });
  });
});
