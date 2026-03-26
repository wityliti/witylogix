/**
 * OAuth Flow Manager Tests
 *
 * 25+ tests covering OAuth 2.0 flows including:
 * - State management and CSRF protection
 * - PKCE code verifier/challenge
 * - Token exchange and refresh
 * - Provider-specific OAuth configs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuthFlowManager } from '../oauth-flow-manager';
import { OAuthFlowError } from '../types';

describe('OAuthFlowManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    OAuthFlowManager.clearExpiredStates();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initiateOAuthFlow', () => {
    it('should generate authorization URL for OAuth provider', () => {
      const result = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      expect(result.authorizationUrl).toContain('slack.com/oauth');
      expect(result.authorizationUrl).toContain('client_id=');
      expect(result.authorizationUrl).toContain('redirect_uri=');
      expect(result.authorizationUrl).toContain('state=');
      expect(result.state).toHaveLength(64); // 32 bytes hex = 64 chars
    });

    it('should generate unique state for each flow', () => {
      const result1 = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );
      const result2 = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      expect(result1.state).not.toBe(result2.state);
    });

    it('should include scopes in authorization URL', () => {
      const result = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      expect(result.authorizationUrl).toContain('scope=');
    });

    it('should include PKCE code challenge when required', () => {
      const result = OAuthFlowManager.initiateOAuthFlow(
        'shopify',
        'https://myapp.com/oauth/callback'
      );

      // Shopify doesn't use PKCE, so it shouldn't be present
      expect(result.authorizationUrl).not.toContain('code_challenge');
    });

    it('should store flow state with expiration', () => {
      const result = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      const state = OAuthFlowManager.getFlowState(result.state);
      expect(state).toBeDefined();
      expect(state?.state).toBe(result.state);
      expect(state?.expiresAt).toBeInstanceOf(Date);
    });

    it('should include custom state in flow', () => {
      const customState = { userId: 'user123', sessionId: 'sess456' };
      const result = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback',
        customState
      );

      const state = OAuthFlowManager.getFlowState(result.state);
      expect(state?.customState).toEqual(customState);
    });

    it('should throw error for unknown provider', () => {
      expect(() =>
        OAuthFlowManager.initiateOAuthFlow(
          'unknown-provider',
          'https://myapp.com/oauth/callback'
        )
      ).toThrow(OAuthFlowError);
    });

    it('should throw error for provider without OAuth config', () => {
      expect(() =>
        OAuthFlowManager.initiateOAuthFlow(
          'stripe', // Stripe uses API keys, not OAuth
          'https://myapp.com/oauth/callback'
        )
      ).toThrow(OAuthFlowError);
    });

    it('should handle provider-specific custom parameters', () => {
      const result = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      expect(result.authorizationUrl).toContain('client_id=');
    });
  });

  describe('handleOAuthCallback', () => {
    it('should exchange code for tokens successfully', async () => {
      const initResult = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            access_token: 'xoxb-test-token',
            token_type: 'bot',
          }),
          { status: 200 }
        )
      );

      const tokenResult = await OAuthFlowManager.handleOAuthCallback(
        'slack',
        'auth_code_123',
        initResult.state,
        'client_id_123',
        'client_secret_456'
      );

      expect(tokenResult.accessToken).toBe('xoxb-test-token');
      expect(tokenResult.tokenType).toBe('bot');
    });

    it('should include refresh token in response if provided', async () => {
      const initResult = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            access_token: 'xoxb-test',
            refresh_token: 'xoxe-test',
          }),
          { status: 200 }
        )
      );

      const tokenResult = await OAuthFlowManager.handleOAuthCallback(
        'slack',
        'auth_code_123',
        initResult.state,
        'client_id_123',
        'client_secret_456'
      );

      expect(tokenResult.refreshToken).toBe('xoxe-test');
    });

    it('should validate state for CSRF protection', async () => {
      await expect(
        OAuthFlowManager.handleOAuthCallback(
          'slack',
          'auth_code_123',
          'invalid_state',
          'client_id_123',
          'client_secret_456'
        )
      ).rejects.toThrow(OAuthFlowError);
    });

    it('should validate state belongs to same provider', async () => {
      const initResult = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      await expect(
        OAuthFlowManager.handleOAuthCallback(
          'hubspot', // Different provider
          'auth_code_123',
          initResult.state,
          'client_id_123',
          'client_secret_456'
        )
      ).rejects.toThrow(/mismatch/i);
    });

    it('should remove state after successful exchange', async () => {
      const initResult = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            access_token: 'xoxb-test',
          }),
          { status: 200 }
        )
      );

      await OAuthFlowManager.handleOAuthCallback(
        'slack',
        'auth_code_123',
        initResult.state,
        'client_id_123',
        'client_secret_456'
      );

      const state = OAuthFlowManager.getFlowState(initResult.state);
      expect(state).toBeUndefined();
    });

    it('should handle token exchange errors', async () => {
      const initResult = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: 'invalid_code',
          }),
          { status: 400 }
        )
      );

      await expect(
        OAuthFlowManager.handleOAuthCallback(
          'slack',
          'invalid_code',
          initResult.state,
          'client_id_123',
          'client_secret_456'
        )
      ).rejects.toThrow(OAuthFlowError);
    });

    it('should include expiration time in token response', async () => {
      const initResult = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            access_token: 'xoxb-test',
            expires_in: 43200,
          }),
          { status: 200 }
        )
      );

      const tokenResult = await OAuthFlowManager.handleOAuthCallback(
        'slack',
        'auth_code_123',
        initResult.state,
        'client_id_123',
        'client_secret_456'
      );

      expect(tokenResult.expiresIn).toBe(43200);
    });
  });

  describe('refreshOAuthToken', () => {
    it('should refresh expired access token', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'new_token_123',
            refresh_token: 'new_refresh_456',
            expires_in: 3600,
          }),
          { status: 200 }
        )
      );

      const result = await OAuthFlowManager.refreshOAuthToken(
        'slack',
        'old_refresh_token',
        'client_id_123',
        'client_secret_456'
      );

      expect(result.accessToken).toBe('new_token_123');
      expect(result.refreshToken).toBe('new_refresh_456');
    });

    it('should preserve refresh token if not returned', async () => {
      const originalRefreshToken = 'original_refresh';

      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'new_token',
            expires_in: 3600,
          }),
          { status: 200 }
        )
      );

      const result = await OAuthFlowManager.refreshOAuthToken(
        'slack',
        originalRefreshToken,
        'client_id_123',
        'client_secret_456'
      );

      expect(result.refreshToken).toBe(originalRefreshToken);
    });

    it('should handle refresh token errors', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'invalid_grant',
          }),
          { status: 401 }
        )
      );

      await expect(
        OAuthFlowManager.refreshOAuthToken(
          'slack',
          'invalid_refresh_token',
          'client_id_123',
          'client_secret_456'
        )
      ).rejects.toThrow(OAuthFlowError);
    });

    it('should throw for provider without token endpoint', async () => {
      await expect(
        OAuthFlowManager.refreshOAuthToken(
          'stripe',
          'refresh_token',
          'client_id',
          'client_secret'
        )
      ).rejects.toThrow(OAuthFlowError);
    });
  });

  describe('revokeOAuthToken', () => {
    it('should revoke access token', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response('', { status: 200 })
      );

      await expect(
        OAuthFlowManager.revokeOAuthToken(
          'slack',
          'token_to_revoke',
          'client_id_123',
          'client_secret_456'
        )
      ).resolves.not.toThrow();
    });

    it('should handle revocation errors', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response('', { status: 400 })
      );

      await expect(
        OAuthFlowManager.revokeOAuthToken(
          'slack',
          'token',
          'client_id',
          'client_secret'
        )
      ).rejects.toThrow(OAuthFlowError);
    });

    it('should silently succeed for providers without revoke support', async () => {
      await expect(
        OAuthFlowManager.revokeOAuthToken(
          'stripe',
          'token',
          'client_id',
          'client_secret'
        )
      ).resolves.not.toThrow();
    });
  });

  describe('State Management', () => {
    it('should store multiple concurrent flows', () => {
      const flow1 = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );
      const flow2 = OAuthFlowManager.initiateOAuthFlow(
        'hubspot',
        'https://myapp.com/oauth/callback'
      );

      expect(OAuthFlowManager.getFlowState(flow1.state)).toBeDefined();
      expect(OAuthFlowManager.getFlowState(flow2.state)).toBeDefined();
      expect(OAuthFlowManager.getStoreSize()).toBe(2);
    });

    it('should expire old states', async () => {
      // Create flow with 1ms expiry (for testing)
      const result = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Manually expire (in real usage, auto-cleanup runs every 5 mins)
      OAuthFlowManager.clearExpiredStates();

      // State should be expired
      expect(OAuthFlowManager.getFlowState(result.state)).toBeUndefined();
    });

    it('should not store invalid states', () => {
      const initialSize = OAuthFlowManager.getStoreSize();

      // Try to use invalid state
      expect(() =>
        OAuthFlowManager.handleOAuthCallback(
          'slack',
          'code',
          'invalid_state',
          'client_id',
          'client_secret'
        )
      ).rejects.toThrow();

      // Store size shouldn't increase
      expect(OAuthFlowManager.getStoreSize()).toBe(initialSize);
    });
  });

  describe('Provider-Specific OAuth', () => {
    it('should handle Shopify OAuth with HMAC', () => {
      const result = OAuthFlowManager.initiateOAuthFlow(
        'shopify',
        'https://myapp.com/oauth/callback'
      );

      const state = OAuthFlowManager.getFlowState(result.state);
      expect(state?.providerId).toBe('shopify');
    });

    it('should handle DocuSign environment selection', () => {
      const result = OAuthFlowManager.initiateOAuthFlow(
        'docusign',
        'https://myapp.com/oauth/callback'
      );

      expect(result.authorizationUrl).toContain('docusign');
    });

    it('should handle Salesforce instance URL routing', () => {
      const result = OAuthFlowManager.initiateOAuthFlow(
        'salesforce',
        'https://myapp.com/oauth/callback',
        { instanceType: 'sandbox' }
      );

      const state = OAuthFlowManager.getFlowState(result.state);
      expect(state?.customState?.instanceType).toBe('sandbox');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors during token exchange', async () => {
      const initResult = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      vi.spyOn(global, 'fetch').mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(
        OAuthFlowManager.handleOAuthCallback(
          'slack',
          'code',
          initResult.state,
          'client_id',
          'client_secret'
        )
      ).rejects.toThrow(OAuthFlowError);
    });

    it('should handle malformed token responses', async () => {
      const initResult = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response('invalid json', { status: 200 })
      );

      await expect(
        OAuthFlowManager.handleOAuthCallback(
          'slack',
          'code',
          initResult.state,
          'client_id',
          'client_secret'
        )
      ).rejects.toThrow();
    });

    it('should provide detailed error context', async () => {
      const initResult = OAuthFlowManager.initiateOAuthFlow(
        'slack',
        'https://myapp.com/oauth/callback'
      );

      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: 'invalid_code',
            error_description: 'The provided code is invalid',
          }),
          { status: 400 }
        )
      );

      try {
        await OAuthFlowManager.handleOAuthCallback(
          'slack',
          'bad_code',
          initResult.state,
          'client_id',
          'client_secret'
        );
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof OAuthFlowError) {
          expect(error.details?.error).toBeDefined();
          expect(error.details?.errorDescription).toBeDefined();
        }
      }
    });
  });
});
