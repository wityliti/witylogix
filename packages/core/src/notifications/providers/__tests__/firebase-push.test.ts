/**
 * Firebase Push Notification Provider Tests
 * Comprehensive test suite for Firebase Cloud Messaging push provider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebasePushProvider } from '../firebase-push';
import {
  InvalidRecipientError,
  AuthenticationError,
  ProviderError,
} from '../types';

describe('FirebasePushProvider', () => {
  let provider: FirebasePushProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  const validConfig = {
    projectId: 'test-firebase-project',
    privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7W1Q8zZzNLu4V
Qvx2i0v6Y0j7YM7H2x7R3K4H6L4L5M4H6N5M6L6N7O7K7R4L5S5L6S6L7T7M8U8
L8T8M9V9M9U9N0V0N0W0O1W1O1X1P2X2P2Y2Q3Y3Q3Z3R4Z4R4A4S5A5S5B5T6
B6T6C6U7C7U7D7V8D8V8E8W9E9W9F9X0F9X0GaY1GaY1HbZ2HbZ2IcA3IcA3JdB
4JdB4KeC5KeC5LfD6LfD6MgE7MgE7NhF8NhF8OiG9OiG9PjHaPjHaQkIbQkIbRl
JcRlJcSmKdSmKdTnLeUnLeVoMfVoMfWpNgWpNgXqOhXqOhYrPiYrPiZsQjZsQjau
RkaupRkaVqUlVqUlWrVmWrVmXsWnXsWnYtXoYtXoZuYpZuYpavZqavZqbwarywar
ywbsxysxysytzutytuvauvavwbwvbwvxcxwcxwyeyxyeyzezyeza{0zezAfAaAf0bg
AgAg1chBhB1di
-----END PRIVATE KEY-----`,
    clientEmail: 'test-service@test-project.iam.gserviceaccount.com',
  };

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    provider = new FirebasePushProvider(validConfig);
  });

  describe('send()', () => {
    it('should send push notification successfully with 200 response', async () => {
      // Mock token exchange
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'test-access-token-12345',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      // Mock FCM send
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          name: 'projects/test-project/messages/1234567890',
        }),
      });

      const result = await provider.send({
        to: 'device-token-abc123def456',
        subject: 'New Notification',
        body: 'This is a test push notification',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('projects/test-project/messages/1234567890');
    });

    it('should create JWT and exchange for access token', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'test-token',
          expires_in: 3600,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({ name: 'msg123' }),
      });

      await provider.send({
        to: 'device-token-abc123',
        body: 'Test',
      });

      // Verify OAuth2 token exchange was called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );

      // Verify the assertion (JWT) was included in the request
      const tokenCall = mockFetch.mock.calls[0];
      const tokenBody = tokenCall[1].body;
      expect(tokenBody).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
      expect(tokenBody).toContain('assertion=');
    });

    it('should cache and refresh access token', async () => {
      // First token exchange
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'first-token',
          expires_in: 3600,
        }),
      });

      // First send
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({ name: 'msg1' }),
      });

      // Second send (should use cached token)
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({ name: 'msg2' }),
      });

      await provider.send({
        to: 'device-token-1',
        body: 'Test 1',
      });

      await provider.send({
        to: 'device-token-2',
        body: 'Test 2',
      });

      // Should have 3 calls: token + send + send (no second token exchange)
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify second FCM call has the same token
      const secondFcmCall = mockFetch.mock.calls[2];
      expect(secondFcmCall[1].headers.Authorization).toBe('Bearer first-token');
    });

    it('should build correct FCM payload structure', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'token',
          expires_in: 3600,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({ name: 'msg123' }),
      });

      await provider.send({
        to: 'device-token-abc',
        subject: 'Test Title',
        body: 'Test Body',
        metadata: { orderId: 'ORD123', amount: '99.99' },
      });

      const fcmCall = mockFetch.mock.calls[1];
      const fcmUrl = fcmCall[0];
      const fcmBody = JSON.parse(fcmCall[1].body);

      expect(fcmUrl).toContain('https://fcm.googleapis.com/v1/projects/test-firebase-project/messages:send');
      expect(fcmBody).toHaveProperty('message');
      expect(fcmBody.message).toEqual(
        expect.objectContaining({
          token: 'device-token-abc',
          notification: {
            title: 'Test Title',
            body: 'Test Body',
          },
          data: {
            orderId: 'ORD123',
            amount: '99.99',
          },
        })
      );
    });

    it('should include Android-specific options in payload', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'token',
          expires_in: 3600,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({ name: 'msg123' }),
      });

      await provider.send({
        to: 'device-token',
        body: 'Test',
      });

      const fcmCall = mockFetch.mock.calls[1];
      const fcmBody = JSON.parse(fcmCall[1].body);

      expect(fcmBody.message).toHaveProperty('android');
      expect(fcmBody.message.android).toEqual(
        expect.objectContaining({
          priority: 'high',
          notification: {
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        })
      );
    });

    it('should include APNs (iOS) specific options in payload', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'token',
          expires_in: 3600,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({ name: 'msg123' }),
      });

      await provider.send({
        to: 'device-token',
        body: 'Test',
      });

      const fcmCall = mockFetch.mock.calls[1];
      const fcmBody = JSON.parse(fcmCall[1].body);

      expect(fcmBody.message).toHaveProperty('apns');
      expect(fcmBody.message.apns).toEqual(
        expect.objectContaining({
          headers: {
            'apns-priority': '10',
          },
        })
      );
    });

    it('should handle invalid registration token (404 response)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'token',
          expires_in: 3600,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        status: 404,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          error: { message: 'Requested entity was not found' },
        }),
      });

      const result = await provider.send({
        to: 'invalid-token',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid registration token or project ID');
    });

    it('should handle authentication error (401 response)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'token',
          expires_in: 3600,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        status: 401,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          error: { message: 'Unauthorized' },
        }),
      });

      const result = await provider.send({
        to: 'device-token',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid access token');
    });

    it('should handle rate limit error (429 response)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'token',
          expires_in: 3600,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        status: 429,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          error: { message: 'Too many requests' },
        }),
      });

      const result = await provider.send({
        to: 'device-token',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Firebase rate limit exceeded');
    });

    it('should reject invalid device token format', async () => {
      const result = await provider.send({
        to: 'tok', // Too short
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject missing project ID', async () => {
      const providerNoProject = new FirebasePushProvider({
        projectId: '',
        privateKey: validConfig.privateKey,
        clientEmail: validConfig.clientEmail,
      });

      const result = await providerNoProject.send({
        to: 'device-token-abc123',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing projectId');
    });

    it('should handle token exchange failures', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        text: vi.fn().mockResolvedValueOnce('Invalid JWT'),
      });

      const result = await provider.send({
        to: 'device-token',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed');
    });
  });

  describe('validateConfig()', () => {
    it('should validate correct configuration', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'token',
          expires_in: 3600,
        }),
      });

      const result = await provider.validateConfig({
        projectId: 'test-project',
        privateKey: validConfig.privateKey,
        clientEmail: 'test@test.iam.gserviceaccount.com',
      });

      expect(result).toBe(true);
    });

    it('should reject missing projectId', async () => {
      const result = await provider.validateConfig({
        projectId: '',
        privateKey: validConfig.privateKey,
        clientEmail: 'test@test.iam.gserviceaccount.com',
      });

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject invalid private key format', async () => {
      const result = await provider.validateConfig({
        projectId: 'project',
        privateKey: 'invalid-key-format',
        clientEmail: 'test@test.iam.gserviceaccount.com',
      });

      expect(result).toBe(false);
    });

    it('should reject missing clientEmail', async () => {
      const result = await provider.validateConfig({
        projectId: 'project',
        privateKey: validConfig.privateKey,
        clientEmail: '',
      });

      expect(result).toBe(false);
    });

    it('should handle token exchange failures during validation', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        text: vi.fn().mockResolvedValueOnce('Invalid JWT'),
      });

      const result = await provider.validateConfig({
        projectId: 'project',
        privateKey: validConfig.privateKey,
        clientEmail: 'test@test.iam.gserviceaccount.com',
      });

      expect(result).toBe(false);
    });
  });

  describe('getStatus()', () => {
    it('should return healthy status after successful token exchange', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'token',
          expires_in: 3600,
        }),
      });

      const status = await provider.getStatus();

      expect(status.healthy).toBe(true);
      expect(status.latency).toBeDefined();
      expect(typeof status.latency).toBe('number');
    });

    it('should cache status for 60 seconds', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'token',
          expires_in: 3600,
        }),
      });

      const status1 = await provider.getStatus();
      const status2 = await provider.getStatus();

      expect(status1).toEqual(status2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should report unhealthy on token exchange failure', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        text: vi.fn().mockResolvedValueOnce('Invalid JWT'),
      });

      const status = await provider.getStatus();

      expect(status.healthy).toBe(false);
      expect(status.lastError).toBeDefined();
    });
  });

  describe('channel and name properties', () => {
    it('should have correct channel type', () => {
      expect(provider.channel).toBe('PUSH');
    });

    it('should have correct provider name', () => {
      expect(provider.name).toBe('Firebase');
    });
  });
});
