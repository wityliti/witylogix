/**
 * Credential Validator Tests
 *
 * 25+ tests covering API key validation, OAuth tokens,
 * basic auth, provider-specific endpoints, and error scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CredentialValidator,
  testCredentials,
} from '../credential-validator';
import { IntegrationAuthType } from '../types';

describe('CredentialValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateCredentials', () => {
    it('should return valid result for correct API key', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      const result = await CredentialValidator.validateCredentials('stripe', {
        secretKey: 'sk_test_123456',
      });

      expect(result.valid).toBe(true);
      expect(result.providerId).toBe('stripe');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.latencyMs).toBeGreaterThan(0);
    });

    it('should return invalid result for missing credentials', async () => {
      const result = await CredentialValidator.validateCredentials('stripe', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should return invalid result for bad credentials', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      );

      const result = await CredentialValidator.validateCredentials('stripe', {
        secretKey: 'sk_invalid',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle network errors gracefully', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const result = await CredentialValidator.validateCredentials('shopify', {
        shopDomain: 'myshop.myshopify.com',
        accessToken: 'test_token',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Network error');
    });

    it('should handle unknown provider', async () => {
      const result = await CredentialValidator.validateCredentials('unknown-provider', {
        apiKey: 'test',
      });

      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toMatch(/No setup config/);
    });
  });

  describe('testConnection', () => {
    it('should test API key authentication', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const result = await CredentialValidator.testConnection(
        'stripe',
        IntegrationAuthType.BEARER_TOKEN,
        { secretKey: 'sk_test_123' }
      );

      expect(result.success).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should test Bearer token authentication', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const result = await CredentialValidator.testConnection(
        'mapbox-directions',
        IntegrationAuthType.BEARER_TOKEN,
        { accessToken: 'pk_test_123' }
      );

      expect(result.success).toBe(true);
      const calls = (global.fetch as any).mock.calls;
      expect(calls[0][1].headers.Authorization).toMatch(/Bearer/);
    });

    it('should test Basic authentication', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const result = await CredentialValidator.testConnection(
        'twilio',
        IntegrationAuthType.BASIC_AUTH,
        { accountSid: 'AC123', authToken: 'token123' }
      );

      expect(result.success).toBe(true);
      const calls = (global.fetch as any).mock.calls;
      expect(calls[0][1].headers.Authorization).toMatch(/Basic/);
    });

    it('should handle timeout errors', async () => {
      vi.spyOn(global, 'fetch').mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            setTimeout(() => reject(new Error('AbortError')), 100);
          })
      );

      // Mock abort error
      const abortError = new Error('Request timeout');
      abortError.name = 'AbortError';
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(abortError);

      const result = await CredentialValidator.testConnection(
        'stripe',
        IntegrationAuthType.BEARER_TOKEN,
        { secretKey: 'test' }
      );

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/timeout|Timeout/i);
    });

    it('should handle HTTP error status codes', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      );

      const result = await CredentialValidator.testConnection(
        'slack',
        IntegrationAuthType.BEARER_TOKEN,
        { accessToken: 'invalid' }
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('HTTP_401');
    });

    it('should return request details on failure', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 403 })
      );

      const result = await CredentialValidator.testConnection(
        'stripe',
        IntegrationAuthType.BEARER_TOKEN,
        { secretKey: 'test' }
      );

      expect(result.details).toBeDefined();
      expect(result.details?.receivedStatus).toBe(403);
    });

    it('should interpolate URL variables', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await CredentialValidator.testConnection(
        'twilio',
        IntegrationAuthType.BASIC_AUTH,
        { accountSid: 'AC123456789', authToken: 'test' }
      );

      const calls = (global.fetch as any).mock.calls;
      expect(calls[0][0]).toContain('AC123456789');
    });
  });

  describe('validateWebhookSecret', () => {
    it('should validate strong webhook secrets', () => {
      expect(
        CredentialValidator.validateWebhookSecret(
          'AbCdEf1234567890GhIjKlMnOpQrStUv'
        )
      ).toBe(true);
    });

    it('should reject short secrets', () => {
      expect(CredentialValidator.validateWebhookSecret('short')).toBe(false);
    });

    it('should reject empty secrets', () => {
      expect(CredentialValidator.validateWebhookSecret('')).toBe(false);
    });

    it('should require mixed case or numbers', () => {
      expect(CredentialValidator.validateWebhookSecret('aaaaaaaaaaaaaaaa')).toBe(false);
    });
  });

  describe('Provider-specific validation', () => {
    it('should validate Shopify credentials with shop domain', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await CredentialValidator.testConnection(
        'shopify',
        IntegrationAuthType.BEARER_TOKEN,
        {
          shopDomain: 'myshop.myshopify.com',
          accessToken: 'test_token',
        }
      );

      const calls = (global.fetch as any).mock.calls;
      expect(calls[0][0]).toContain('myshop.myshopify.com');
    });

    it('should validate DocuSign with account ID', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await CredentialValidator.testConnection(
        'docusign',
        IntegrationAuthType.BEARER_TOKEN,
        {
          accessToken: 'test_token',
          accountId: '12345',
        }
      );

      const calls = (global.fetch as any).mock.calls;
      expect(calls[0][0]).toContain('12345');
    });

    it('should validate Salesforce with instance URL', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await CredentialValidator.testConnection(
        'salesforce',
        IntegrationAuthType.BEARER_TOKEN,
        {
          accessToken: 'test_token',
          instanceUrl: 'https://na1.salesforce.com',
        }
      );

      const calls = (global.fetch as any).mock.calls;
      expect(calls[0][0]).toContain('na1.salesforce.com');
    });

    it('should validate Samsara with bearer token', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await CredentialValidator.testConnection(
        'samsara',
        IntegrationAuthType.BEARER_TOKEN,
        { accessToken: 'test_token' }
      );

      const calls = (global.fetch as any).mock.calls;
      expect(calls[0][1].headers.Authorization).toBe('Bearer test_token');
    });
  });

  describe('testCredentials helper', () => {
    it('should test credentials using helper function', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const result = await testCredentials('stripe', {
        secretKey: 'sk_test_123',
      });

      expect(result.success).toBe(true);
    });

    it('should handle unknown provider in helper', async () => {
      const result = await testCredentials('unknown', { apiKey: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/not found/i);
    });
  });

  describe('Error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      const result = await CredentialValidator.testConnection(
        'stripe',
        IntegrationAuthType.BEARER_TOKEN,
        { secretKey: 'test' }
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('REQUEST_FAILED');
    });

    it('should include latency in error results', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const result = await CredentialValidator.testConnection(
        'stripe',
        IntegrationAuthType.BEARER_TOKEN,
        { secretKey: 'test' }
      );

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should distinguish between auth and request errors', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 401 })
      );

      const result = await CredentialValidator.testConnection(
        'stripe',
        IntegrationAuthType.BEARER_TOKEN,
        { secretKey: 'invalid' }
      );

      expect(result.errorCode).toMatch(/HTTP/);
      expect(result.success).toBe(false);
    });
  });

  describe('Multiple credential types', () => {
    it('should handle API_KEY auth type', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      // Use valhalla (no custom headers) so buildAuthHeaders applies API_KEY logic
      await CredentialValidator.testConnection(
        'valhalla',
        IntegrationAuthType.API_KEY,
        { apiKey: 'test_key', baseUrl: 'https://test.example.com' }
      );

      const calls = (global.fetch as any).mock.calls;
      expect(calls[0][1].headers['X-API-Key']).toBe('test_key');
    });

    it('should handle OAUTH2 auth type', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await CredentialValidator.testConnection(
        'slack',
        IntegrationAuthType.OAUTH2,
        { accessToken: 'xoxb-test' }
      );

      const calls = (global.fetch as any).mock.calls;
      expect(calls[0][1].headers.Authorization).toMatch(/Bearer/);
    });

    it('should handle WEBHOOK_SECRET auth type', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      // Use valhalla (no custom headers) so buildAuthHeaders applies WEBHOOK_SECRET logic
      await CredentialValidator.testConnection(
        'valhalla',
        IntegrationAuthType.WEBHOOK_SECRET,
        { webhookSecret: 'whsec_test', baseUrl: 'https://test.example.com' }
      );

      const calls = (global.fetch as any).mock.calls;
      expect(calls[0][1].headers['X-Webhook-Secret']).toBe('whsec_test');
    });
  });

  describe('Performance', () => {
    it('should complete validation within timeout', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const start = Date.now();
      await CredentialValidator.validateCredentials('stripe', {
        secretKey: 'test',
      });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10000); // Less than timeout
    });

    it('should measure latency accurately', async () => {
      vi.spyOn(global, 'fetch').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve(
                  new Response(JSON.stringify({}), { status: 200 })
                ),
              100
            );
          })
      );

      const result = await CredentialValidator.testConnection(
        'stripe',
        IntegrationAuthType.BEARER_TOKEN,
        { secretKey: 'test' }
      );

      expect(result.latencyMs).toBeGreaterThanOrEqual(90); // Allow 10ms variance
    });
  });
});
