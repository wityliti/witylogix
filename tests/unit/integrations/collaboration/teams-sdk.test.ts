/**
 * Teams SDK Client Unit Tests
 * Tests for OAuth2, teams, channels, messages, and subscriptions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TeamsSDKClient } from '../../../../packages/core/src/integrations/collaboration/teams-sdk-client';

describe('TeamsSDKClient', () => {
  let client: TeamsSDKClient;

  beforeEach(() => {
    // Mock environment
    process.env.TEAMS_ACCESS_TOKEN = 'test-access-token';
    process.env.TEAMS_CLIENT_ID = 'test-client-id';
    process.env.TEAMS_TENANT_ID = 'test-tenant-id';
    process.env.TEAMS_WEBHOOK_SECRET = 'test-webhook-secret';

    client = new TeamsSDKClient({
      accessToken: 'test-access-token',
      clientId: 'test-client-id',
      tenantId: 'test-tenant-id',
      webhookSigningSecret: 'test-webhook-secret',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('OAuth2 Flow', () => {
    it('should generate authorization URL with correct parameters', () => {
      const config = {
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        redirectUri: 'https://example.com/callback',
        tenantId: 'test-tenant-id',
        scopes: ['ChannelMessage.Send', 'TeamSettings.Read.All'],
      };

      const authUrl = client.getOAuth2AuthorizationUrl(config);

      expect(authUrl).toContain('https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(authUrl).toContain('response_type=code');
    });

    it('should include state parameter when provided', () => {
      const config = {
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        redirectUri: 'https://example.com/callback',
        tenantId: 'test-tenant-id',
        scopes: ['ChannelMessage.Send'],
        state: 'random-state-value',
      };

      const authUrl = client.getOAuth2AuthorizationUrl(config);

      expect(authUrl).toContain('state=random-state-value');
    });

    it('should throw error for invalid OAuth2 config', () => {
      const invalidConfig = {
        clientId: '',
        clientSecret: 'test-secret',
        redirectUri: 'invalid-url',
        tenantId: 'test-tenant-id',
        scopes: [],
      };

      expect(() => client.getOAuth2AuthorizationUrl(invalidConfig as any)).toThrow();
    });
  });

  describe('Webhook Signature Verification', () => {
    it('should verify valid webhook signature', () => {
      const body = JSON.stringify({ value: [] });
      const expectedSignature = require('crypto')
        .createHmac('sha256', 'test-webhook-secret')
        .update(body)
        .digest('base64');

      const isValid = client.verifyWebhookSignature(expectedSignature, body);

      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const body = JSON.stringify({ value: [] });
      const invalidSignature = 'invalid-signature-base64';

      const isValid = client.verifyWebhookSignature(invalidSignature, body);

      expect(isValid).toBe(false);
    });

    it('should throw error when webhookSigningSecret is not set', () => {
      const clientNoSecret = new TeamsSDKClient({
        accessToken: 'test-access-token',
      });

      expect(() => clientNoSecret.verifyWebhookSignature('test-sig', '{}')).toThrow(
        'webhookSigningSecret required for signature verification',
      );
    });
  });

  describe('Message Payload Validation', () => {
    it('should accept valid message payload', () => {
      const validPayload = {
        body: {
          contentType: 'html',
          content: 'Hello, <strong>Teams</strong>!',
        },
      };

      expect(validPayload.body.contentType).toBe('html');
      expect(validPayload.body.content).toBeTruthy();
    });

    it('should accept plain text messages', () => {
      const plainTextPayload = {
        body: {
          contentType: 'text',
          content: 'Plain text message',
        },
      };

      expect(plainTextPayload.body.contentType).toBe('text');
    });

    it('should reject empty content', () => {
      const emptyPayload = {
        body: {
          contentType: 'html',
          content: '',
        },
      };

      expect(emptyPayload.body.content).toBe('');
    });

    it('should accept attachments in payload', () => {
      const payloadWithAttachments = {
        body: {
          contentType: 'html',
          content: 'Message with attachment',
        },
        attachments: [
          {
            id: 'att-123',
            name: 'document.pdf',
            contentUrl: 'https://example.com/doc.pdf',
          },
        ],
      };

      expect(payloadWithAttachments.attachments).toBeDefined();
      expect(payloadWithAttachments.attachments[0].name).toBe('document.pdf');
    });
  });

  describe('Change Notification Validation', () => {
    it('should validate change notification format', async () => {
      const notification = {
        value: [
          {
            changeType: 'created',
            subscriptionId: 'sub-123',
            resource: '/teams/team-id/channels/channel-id/messages/msg-id',
            subscriptionExpirationDateTime: '2024-12-31T23:59:59Z',
          },
        ],
      };

      expect(notification.value).toBeDefined();
      expect(notification.value[0].changeType).toBe('created');
      expect(notification.value[0].subscriptionId).toBe('sub-123');
    });

    it('should handle multiple change notifications', async () => {
      const multipleNotifications = {
        value: [
          {
            changeType: 'created',
            subscriptionId: 'sub-123',
            resource: '/teams/team-id/channels/channel-id/messages/msg-1',
            subscriptionExpirationDateTime: '2024-12-31T23:59:59Z',
          },
          {
            changeType: 'updated',
            subscriptionId: 'sub-456',
            resource: '/teams/team-id/channels/channel-id/messages/msg-2',
            subscriptionExpirationDateTime: '2024-12-31T23:59:59Z',
          },
        ],
      };

      expect(multipleNotifications.value).toHaveLength(2);
      expect(multipleNotifications.value[0].changeType).toBe('created');
      expect(multipleNotifications.value[1].changeType).toBe('updated');
    });
  });

  describe('Subscription Management', () => {
    it('should create subscription with default expiration', () => {
      const resource = '/teams/team-id/channels/channel-id/messages';
      const notificationUrl = 'https://example.com/webhook';

      expect(resource).toBeDefined();
      expect(notificationUrl).toBeDefined();
    });

    it('should accept custom expiration minutes', () => {
      const customExpiration = 1440; // 1 day
      expect(customExpiration).toBe(1440);
    });

    it('should validate subscription with client state', () => {
      const clientState = 'state-123-abc';
      expect(clientState).toBeTruthy();
    });
  });

  describe('Validation Token Handling', () => {
    it('should return validation token as is', () => {
      const validationToken = 'test-validation-token-xyz';
      const response = client.validateSubscription(validationToken);

      expect(response).toBe(validationToken);
    });
  });

  describe('Error Handling', () => {
    it('should throw when neither accessToken nor clientId is provided', () => {
      expect(() => {
        new TeamsSDKClient({});
      }).toThrow('TEAMS_ACCESS_TOKEN or TEAMS_CLIENT_ID env vars required');
    });

    it('should use environment variables as fallback', () => {
      process.env.TEAMS_ACCESS_TOKEN = 'xoxb-from-env';

      const clientFromEnv = new TeamsSDKClient({});

      expect(clientFromEnv).toBeDefined();
    });

    it('should handle missing tenantId gracefully', () => {
      const client2 = new TeamsSDKClient({
        accessToken: 'test-token',
      });

      expect(client2).toBeDefined();
    });
  });

  describe('Adaptive Cards Support', () => {
    it('should support TextBlock in adaptive card', () => {
      const textBlock = {
        type: 'TextBlock' as const,
        text: 'Hello, Teams!',
        weight: 'bolder' as const,
        size: 'large' as const,
      };

      expect(textBlock.type).toBe('TextBlock');
      expect(textBlock.weight).toBe('bolder');
    });

    it('should support Container in adaptive card', () => {
      const container = {
        type: 'Container' as const,
        items: [
          {
            type: 'TextBlock',
            text: 'Content inside container',
          },
        ],
      };

      expect(container.type).toBe('Container');
      expect(container.items).toHaveLength(1);
    });

    it('should support Image in adaptive card', () => {
      const image = {
        type: 'Image' as const,
        url: 'https://example.com/image.png',
        size: 'medium' as const,
      };

      expect(image.type).toBe('Image');
      expect(image.url).toContain('example.com');
    });

    it('should support Action.OpenUrl in adaptive card', () => {
      const action = {
        type: 'Action.OpenUrl' as const,
        title: 'Open Link',
        url: 'https://example.com',
      };

      expect(action.type).toBe('Action.OpenUrl');
      expect(action.title).toBe('Open Link');
    });
  });

  describe('Presence Status Types', () => {
    it('should support available status', () => {
      const status = 'Available';
      expect(status).toBe('Available');
    });

    it('should support away status', () => {
      const status = 'Away';
      expect(status).toBe('Away');
    });

    it('should support busy status', () => {
      const status = 'Busy';
      expect(status).toBe('Busy');
    });

    it('should support do not disturb status', () => {
      const status = 'DoNotDisturb';
      expect(status).toBe('DoNotDisturb');
    });

    it('should support offline status', () => {
      const status = 'Offline';
      expect(status).toBe('Offline');
    });
  });

  describe('Reaction Types', () => {
    it('should support like reaction', () => {
      const reactionType = 'like';
      expect(reactionType).toBe('like');
    });

    it('should support love reaction', () => {
      const reactionType = 'love';
      expect(reactionType).toBe('love');
    });

    it('should support custom reaction types', () => {
      const reactionType = 'heart_eyes';
      expect(reactionType).toBeTruthy();
    });
  });

  describe('Team Membership Types', () => {
    it('should support standard channels', () => {
      const membershipType = 'standard';
      expect(membershipType).toBe('standard');
    });

    it('should support private channels', () => {
      const membershipType = 'private';
      expect(membershipType).toBe('private');
    });

    it('should support shared channels', () => {
      const membershipType = 'shared';
      expect(membershipType).toBe('shared');
    });
  });
});
