/**
 * Integration Tests - End-to-End Onboarding Flow
 *
 * Tests complete OAuth and credential setup workflows
 * demonstrating the full onboarding wizard in action.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuthFlowManager } from '../oauth-flow-manager';
import { CredentialValidator } from '../credential-validator';
import { HealthChecker } from '../health-checker';
import { BatchIntegrationManager } from '../batch-integration-manager';
import {
  getSetupConfig,
  getCategorySetups,
  getQuickSetupTemplate,
  getIndustryTemplate,
} from '../index';
import { IntegrationAuthType, HealthStatus } from '../types';

describe('Integration Onboarding - End-to-End Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('OAuth Setup Flow (Slack Example)', () => {
    it('should complete full OAuth flow for Slack', async () => {
      // Step 1: Get setup config
      const config = getSetupConfig('slack');
      expect(config).toBeDefined();
      expect(config?.authType).toBe(IntegrationAuthType.OAUTH2);
      expect(config?.oauthConfig).toBeDefined();

      // Step 2: Initiate OAuth flow
      const initResult = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      expect(initResult.state).toHaveLength(64);
      expect(initResult.authorizationUrl).toContain('slack.com');

      // Step 3: Simulate authorization and callback
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            access_token: 'xoxb-token-123',
            token_type: 'bot',
          }),
          { status: 200 }
        )
      );

      const tokenResult = await OAuthFlowManager.handleOAuthCallback(
        'slack',
        'auth_code_from_slack',
        initResult.state,
        'client_id_123',
        'client_secret_456'
      );

      expect(tokenResult.accessToken).toBe('xoxb-token-123');

      // Step 4: Validate credentials
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            user_id: 'U12345678',
            team_id: 'T12345678',
          }),
          { status: 200 }
        )
      );

      const validationResult = await CredentialValidator.validateCredentials(
        'slack',
        { accessToken: tokenResult.accessToken }
      );

      expect(validationResult.valid).toBe(true);

      // Step 5: Health check
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true }),
          { status: 200 }
        )
      );

      const healthResult = await HealthChecker.checkIntegrationHealth(
        'slack',
        { accessToken: tokenResult.accessToken }
      );

      expect(healthResult.status).toBe(HealthStatus.HEALTHY);
      expect(healthResult.checks.authentication).toBe(true);
    });
  });

  describe('API Key Setup Flow (Stripe Example)', () => {
    it('should complete API key setup for Stripe', async () => {
      // Step 1: Get setup config
      const config = getSetupConfig('stripe');
      expect(config).toBeDefined();
      expect(config?.authType).toBe(IntegrationAuthType.BEARER_TOKEN);
      expect(config?.requiredFields.length).toBeGreaterThan(0);

      // Step 2: Get quick setup template
      const template = getQuickSetupTemplate('stripe');
      expect(template).toBeDefined();
      expect(template?.setupInstructions).toContain('API Key');

      // Step 3: Validate API key
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({}),
          { status: 200 }
        )
      );

      const validationResult = await CredentialValidator.validateCredentials(
        'stripe',
        { secretKey: 'sk_live_abc123' }
      );

      expect(validationResult.valid).toBe(true);

      // Step 4: Test connection
      const connectionResult = await CredentialValidator.testConnection(
        'stripe',
        IntegrationAuthType.BEARER_TOKEN,
        { secretKey: 'sk_live_abc123' }
      );

      expect(connectionResult.success).toBe(true);

      // Step 5: Health check
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const healthResult = await HealthChecker.checkIntegrationHealth(
        'stripe',
        { secretKey: 'sk_live_abc123' }
      );

      expect(healthResult.status).toBe(HealthStatus.HEALTHY);
    });
  });

  describe('E-Commerce Bundle Setup (Industry Template)', () => {
    it('should setup complete e-commerce integration stack', () => {
      // Get industry template
      const template = getIndustryTemplate('e-commerce');
      expect(template).toBeDefined();
      expect(template?.integrations).toContain('shopify');
      expect(template?.integrations).toContain('stripe');
      expect(template?.integrations).toContain('mailgun');

      // Verify each integration has config
      for (const providerId of template!.integrations) {
        const config = getSetupConfig(providerId);
        expect(config).toBeDefined();
        expect(config?.setupInstructions).toBeDefined();
      }

      // Verify default configs are available
      expect(template?.defaultConfig?.shopify).toBeDefined();
      expect(template?.defaultConfig?.stripe).toBeDefined();

      // Verify webhook URLs are suggested
      expect(template?.suggestedWebhooks?.shopify).toContain('/webhooks');
      expect(template?.suggestedWebhooks?.stripe).toContain('/webhooks');
    });
  });

  describe('Batch Integration Setup', () => {
    it('should enable multiple integrations for org', async () => {
      const mockPrisma = {
        integrationConnection: {
          create: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const integrations = [
        {
          providerId: 'slack',
          credentials: { accessToken: 'xoxb-test' },
          config: { notificationsEnabled: true },
        },
        {
          providerId: 'stripe',
          credentials: { secretKey: 'sk_test_123' },
          config: { webhooksEnabled: true },
        },
      ];

      const result = await BatchIntegrationManager.enableIntegrations(
        'org-123',
        integrations,
        mockPrisma
      );

      expect(result.orgId).toBe('org-123');
      expect(result.enabledCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });

    it('should handle mixed success and failure in batch', async () => {
      const mockPrisma = {
        integrationConnection: {
          create: vi
            .fn()
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(new Error('Duplicate')),
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const integrations = [
        { providerId: 'slack', credentials: { accessToken: 'test' } },
        { providerId: 'stripe', credentials: { secretKey: 'test' } },
      ];

      const result = await BatchIntegrationManager.enableIntegrations(
        'org-123',
        integrations,
        mockPrisma
      );

      expect(result.enabledCount + result.failedCount).toBe(2);
      expect(result.results.some((r) => !r.success)).toBe(true);
    });
  });

  describe('Category-Based Setup Discovery', () => {
    it('should discover all routing providers', () => {
      const routingProviders = getCategorySetups('routing');

      expect(routingProviders.length).toBeGreaterThan(0);
      expect(routingProviders.map((c) => c.providerId)).toContain('valhalla');
      expect(routingProviders.map((c) => c.providerId)).toContain('vroom');
      expect(routingProviders.map((c) => c.providerId)).toContain(
        'google-routes-api'
      );
    });

    it('should discover all telematics providers', () => {
      const telematicsProviders = getCategorySetups('telematics');

      expect(telematicsProviders.length).toBeGreaterThan(0);
      expect(telematicsProviders.map((c) => c.providerId)).toContain('samsara');
      expect(telematicsProviders.map((c) => c.providerId)).toContain('geotab');
    });

    it('should discover all e-commerce providers', () => {
      const ecommerceProviders = getCategorySetups('e-commerce');

      expect(ecommerceProviders.length).toBeGreaterThan(0);
      expect(ecommerceProviders.map((c) => c.providerId)).toContain('shopify');
      expect(ecommerceProviders.map((c) => c.providerId)).toContain('stripe');
    });
  });

  describe('Concurrent Health Checks', () => {
    it('should check multiple integrations with rate limiting', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const integrations = [
        { providerId: 'stripe', credentials: { secretKey: 'test1' } },
        { providerId: 'slack', credentials: { accessToken: 'test2' } },
        { providerId: 'shopify', credentials: { shopDomain: 'test', accessToken: 'test3' } },
      ];

      const results = await HealthChecker.checkAllIntegrations(
        'org-123',
        integrations,
        2 // concurrency limit
      );

      expect(results).toHaveLength(3);
      const summary = HealthChecker.getHealthSummary(results);
      expect(summary.totalChecks).toBe(3);
    });
  });

  describe('Provider-Specific Setup Guides', () => {
    it('should provide detailed Shopify setup instructions', () => {
      const config = getSetupConfig('shopify');
      const template = getQuickSetupTemplate('shopify');

      expect(config?.setupInstructions).toContain('OAuth');
      expect(config?.setupInstructions).toContain('scopes');
      expect(template?.setupInstructions).toContain('Webhook');
    });

    it('should provide detailed Salesforce setup instructions', () => {
      const config = getSetupConfig('salesforce');

      expect(config?.setupInstructions).toContain('Connected App');
      expect(config?.setupInstructions).toContain('instance URL');
      expect(config?.authType).toBe(IntegrationAuthType.OAUTH2);
    });

    it('should provide detailed DocuSign setup instructions', () => {
      const config = getSetupConfig('docusign');

      expect(config?.setupInstructions).toContain('Account ID');
      expect(config?.setupInstructions).toContain('Integration Key');
      expect(config?.oauthConfig).toBeDefined();
    });

    it('should provide instructions for API key providers', () => {
      const config = getSetupConfig('mailgun');

      expect(config?.authType).toBe(IntegrationAuthType.BASIC_AUTH);
      expect(config?.setupInstructions).toContain('API Key');
      expect(config?.setupInstructions).toContain('domain');
    });
  });

  describe('Error Recovery and State Management', () => {
    it('should recover from failed OAuth callback', async () => {
      const initResult = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      // Simulate failed callback
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: false, error: 'invalid_code' }),
          { status: 400 }
        )
      );

      // Should throw but state should still be stored
      try {
        await OAuthFlowManager.handleOAuthCallback(
          'slack',
          'bad_code',
          initResult.state,
          'client_id',
          'client_secret'
        );
      } catch (error) {
        // Expected
      }

      // State should be cleared after use
      const state = OAuthFlowManager.getFlowState(initResult.state);
      expect(state).toBeUndefined();
    });

    it('should handle credential validation timeout gracefully', async () => {
      const abortError = new Error('Timeout');
      abortError.name = 'AbortError';

      vi.spyOn(global, 'fetch').mockRejectedValueOnce(abortError);

      const result = await CredentialValidator.validateCredentials(
        'stripe',
        { secretKey: 'test' }
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should maintain health status across multiple checks', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const creds = { secretKey: 'test' };

      const result1 = await HealthChecker.checkIntegrationHealth('stripe', creds);
      const result2 = await HealthChecker.checkIntegrationHealth('stripe', creds, false); // Use cache

      expect(result1.status).toBe(result2.status);
      expect(result1.timestamp.getTime()).toBe(result2.timestamp.getTime()); // Same cache
    });
  });
});
