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
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDaHt8Y0cGjByFY
UXisiT6JPlbe/rSv3gLvCiWcf4+jQk705e2zRYj8Lr7juR/JeLD8jXZ71yn9B2nJ
Qbt0+xCnCMtCSpGC/lpk5Hw1W9kv9hYNAC9yAu5Qf7kNiQU76nsWR2Y29SXialzF
3zDth+5Dv1qs919JWQEXoyMbTuRN3MmHBtiUQU16TuY8DAgEjix39OY8MY7iPvoz
YAvL7Np2kkcAWshdEkM/t387GvYOxADR7CWjZrhOQ2HFqGJiAOxgSKyl+K4eAGtR
eWhbyWTL2oDxMds7sJie3YjeCClFe5Y7bGbjbXSw4OzwRCmIEqLuyAZP11zGRZHh
sN2k2msnAgMBAAECggEAYpP/OiVagUawsEyp4Dhq1fYhpsiweqc45jXMx8zy6tMG
AjKEWjg779VkmmDJV/G+83UvrkqRBHU8PyQBB56MaSFVU5GF8BDqY5zL8gWfw8hR
MPD7gGiIskL3LIHXpruTg38jWAU1aP2vDhKP91ouudmarn9iRjD+iGNHc4kVL4aa
b5Z1qDTTAXIIr8LZ/oo10NhG0HPUp6KVTVrqvv7oOr3RznDkxr9GrlWqruFN/trt
Z+bhkdfRpUZ/g+/TF5mhigQuhypKB5I4fEdX5blBxduYgcdLzHP2ghC/yOE0Ve2J
IxLfmOZQ2DVCQQ9e9BdZQh2Vusn4b4C2bcUSP1mawQKBgQD6SFbT+IC2OOIApBDR
eFtpFeNDIfphwYMw4TUcySswqmpjCvhu8TTXowPfT4tgqOrXjL2mTlhhUSY5rWUa
lkbPPLoUE5ZPPgAE8/sMErFvCPP/rIhURd73wh0ztcRk+udpNYeJN/br5h10drVu
k5+XvXiyfTE0h0C2ayysDlNUhwKBgQDfGnKtATxFk3B9wdo7raL9pU+5NIUBqF4f
JcHvtixIWXzFBcqXhDiBnLdH0y/7uxQdEVIPRt6MQV4B8vKWlSgoFYgb5F/Rt5Nb
pu99D0CsYWLBSNAG93r7S3nQnCJb/Di5AFzB10jHrLpW6THwFrMK+PeDzl1avC2t
4jskXnp8YQKBgQCP+XUZUuaX7Hj17WtPVHEhLlohkDY8bdlOEP9Ao+iYgi/Y8cKf
71l6gmgD2fpPjFwryuZ9+KuWr9vRahGzDaeGJ2TTj8DzrLLOJpvQAiDXwsq51UJH
WDo/RAcQbAuiG0NrnkNtiCge460mBfOwvHMeEvyPkLzxfqyXQ2fbQhJlmQKBgQC8
szsBN0VKN81yoG68AT4VuSe4J0LERyrsv1vMK1JDE2Vjo2VaSBwfDHU8y9QO34nA
mDDG+RMsn/EqRtmGIbxoQuXvaXbeA54gbA6twSPbaTdE8hf5fILJX2o11ol9MdSs
LTFHRpapRGALOIvjXN+szS1Uj0wIfZdJNkr9lOeWoQKBgBMtbeKctlPxvL1Q85K4
lvSxUx9Zh3ALVq+HCk3KrG3NJ04uIeBLUz77jNlRrMPL+fJHfWPe+Sv1+cCyY3am
rK39xMNz3XKgxwhpTXDwKFLaQJkms6Mh533nq0crHmRwn8w9riLoc/80rzBtwUpQ
SEgGkht6jcD8rnVWsduQR3kA
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
