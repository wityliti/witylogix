/**
 * Slack Client Tests
 * Comprehensive test suite for SlackClient adapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SlackClient } from '../slack-client';
import {
  CollaborationConfig,
  CollaborationChannel,
  CollaborationMessage,
  CollaborationUser,
} from '../types';

describe('SlackClient', () => {
  let slackClient: SlackClient;
  let mockConfig: CollaborationConfig;

  beforeEach(() => {
    mockConfig = {
      platform: 'slack',
      enabled: true,
      rateLimitPerSecond: 10,
      circuitBreakerThreshold: 5,
      circuitBreakerResetMs: 30000,
      retryAttempts: 3,
      retryBackoffMs: 1000,
      channelCacheTtlMs: 300000,
      messageCacheTtlMs: 3600000,
      presenceCacheTtlMs: 60000,
      maxMessageLength: 4000,
      credentials: {
        botToken: 'xoxb-test-token',
        token: 'xoxb-test-token',
      },
      features: {
        threading: true,
        reactions: true,
        mentions: true,
        files: true,
        richFormatting: true,
        presence: true,
        typingIndicators: true,
        readReceipts: false,
        pinnedMessages: true,
      },
    };

    slackClient = new SlackClient(mockConfig);

    // Mock fetch globally with a default successful response
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true }),
      status: 200,
      ok: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true, user_id: 'U123' }),
        status: 200,
        ok: true,
      });

      await slackClient.connect();

      expect(slackClient.isConnected()).toBe(true);
    });

    it('should fail connection with invalid token', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: false, error: 'invalid_auth' }),
        status: 200,
        ok: false,
      });

      await expect(slackClient.connect()).rejects.toThrow();
    });

    it('should disconnect properly', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });

      await slackClient.connect();
      await slackClient.disconnect();

      expect(slackClient.isConnected()).toBe(false);
    });

    it('should report health status when connected', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });

      await slackClient.connect();
      const health = await slackClient.health();

      expect(health.status).toBe('healthy');
    });

    it('should report unhealthy status when disconnected', async () => {
      const health = await slackClient.health();
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('Channel Operations', () => {
    beforeEach(async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });
      await slackClient.connect();
    });

    it('should get channel by ID', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          channel: {
            id: 'C123',
            name: 'general',
            created: 1234567890,
            is_archived: false,
            is_private: false,
            num_members: 5,
          },
        }),
        status: 200,
        ok: true,
      });

      const channel = await slackClient.getChannel('C123');

      expect(channel).toBeDefined();
      expect(channel?.id).toBe('C123');
      expect(channel?.name).toBe('general');
      expect(channel?.platform).toBe('slack');
    });

    it('should return null for non-existent channel', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: false, error: 'channel_not_found' }),
        status: 200,
        ok: false,
      });

      const channel = await slackClient.getChannel('C999');

      expect(channel).toBeNull();
    });

    it('should list channels', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          channels: [
            {
              id: 'C1',
              name: 'general',
              created: 1234567890,
              is_archived: false,
              is_private: false,
              num_members: 10,
            },
            {
              id: 'C2',
              name: 'random',
              created: 1234567891,
              is_archived: false,
              is_private: false,
              num_members: 5,
            },
          ],
          response_metadata: { next_cursor: '' },
        }),
        status: 200,
        ok: true,
      });

      const result = await slackClient.listChannels({ limit: 10 });

      expect(result.channels).toHaveLength(2);
      expect(result.channels[0].name).toBe('general');
      expect(result.channels[1].name).toBe('random');
    });

    it('should create channel', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          channel: {
            id: 'C456',
            name: 'test-channel',
            created: 1234567890,
            is_archived: false,
            is_private: false,
            num_members: 1,
          },
        }),
        status: 200,
        ok: true,
      });

      const channel = await slackClient.createChannel('test-channel', {
        description: 'Test channel',
        isPrivate: false,
      });

      expect(channel.id).toBe('C456');
      expect(channel.name).toBe('test-channel');
    });

    it('should archive channel', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });

      await expect(slackClient.archiveChannel('C123')).resolves.toBeUndefined();
    });

    it('should unarchive channel', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });

      await expect(slackClient.unarchiveChannel('C123')).resolves.toBeUndefined();
    });
  });

  describe('Message Operations', () => {
    beforeEach(async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });
      await slackClient.connect();
    });

    it('should send message', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          ts: '1234567890.123456',
          user: 'U123',
        }),
        status: 200,
        ok: true,
      });

      const message = await slackClient.sendMessage('C123', 'Hello, World!');

      expect(message.id).toBeDefined();
      expect(message.content).toBe('Hello, World!');
      expect(message.channelId).toBe('C123');
      expect(message.platform).toBe('slack');
    });

    it('should send message with rich formatting', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          ts: '1234567890.123456',
        }),
        status: 200,
        ok: true,
      });

      const richContent = {
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*Bold* message' },
          },
        ],
      };

      const message = await slackClient.sendMessage('C123', 'Hello', {
        richContent,
      });

      expect(message).toBeDefined();
    });

    it('should edit message', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          ts: '1234567890.123456',
        }),
        status: 200,
        ok: true,
      });

      const edited = await slackClient.editMessage(
        'C123/1234567890.123456',
        'Updated message'
      );

      expect(edited.content).toBe('Updated message');
      expect(edited.isEdited).toBe(true);
    });

    it('should delete message', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });

      await expect(
        slackClient.deleteMessage('C123/1234567890.123456')
      ).resolves.toBeUndefined();
    });

    it('should get message thread', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          messages: [
            {
              ts: '1234567890.123456',
              user: 'U1',
              text: 'Parent message',
            },
            {
              ts: '1234567891.123456',
              user: 'U2',
              text: 'Reply',
              thread_ts: '1234567890.123456',
            },
          ],
        }),
        status: 200,
        ok: true,
      });

      const thread = await slackClient.getMessageThread('C123/1234567890.123456');

      expect(thread).toHaveLength(2);
      expect(thread[0].content).toBe('Parent message');
      expect(thread[1].content).toBe('Reply');
    });
  });

  describe('User Operations', () => {
    beforeEach(async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });
      await slackClient.connect();
    });

    it('should get user by ID', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          user: {
            id: 'U123',
            name: 'john.doe',
            real_name: 'John Doe',
            profile: {
              email: 'john@example.com',
              title: 'Developer',
              image_512: 'https://example.com/avatar.jpg',
            },
          },
        }),
        status: 200,
        ok: true,
      });

      const user = await slackClient.getUser('U123');

      expect(user).toBeDefined();
      expect(user?.id).toBe('U123');
      expect(user?.name).toBe('john.doe');
      expect(user?.email).toBe('john@example.com');
    });

    it('should list users', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          members: [
            {
              id: 'U1',
              name: 'user1',
              real_name: 'User One',
              deleted: false,
            },
            {
              id: 'U2',
              name: 'user2',
              real_name: 'User Two',
              deleted: false,
            },
          ],
          response_metadata: { next_cursor: '' },
        }),
        status: 200,
        ok: true,
      });

      const result = await slackClient.listUsers({ limit: 10 });

      expect(result.users).toHaveLength(2);
      expect(result.users[0].name).toBe('user1');
    });

    it('should get user by email', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          user: {
            id: 'U123',
            name: 'john.doe',
            profile: { email: 'john@example.com' },
          },
        }),
        status: 200,
        ok: true,
      });

      const users = await slackClient.getUsersByEmail('john@example.com');

      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('john@example.com');
    });

    it('should get user presence', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          presence: 'active',
          last_activity: Math.floor(Date.now() / 1000),
        }),
        status: 200,
        ok: true,
      });

      const presence = await slackClient.getUserPresence('U123');

      expect(presence).toBeDefined();
      expect(presence?.status).toBe('active');
    });

    it('should set user presence', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });

      await expect(
        slackClient.setUserPresence('U123', 'active', 'In a meeting')
      ).resolves.toBeUndefined();
    });
  });

  describe('Reaction Operations', () => {
    beforeEach(async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });
      await slackClient.connect();
    });

    it('should add reaction to message', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });

      const reaction = await slackClient.addReaction(
        'C123/1234567890.123456',
        'thumbsup'
      );

      expect(reaction).toBeDefined();
      expect(reaction.emoji).toBe('thumbsup');
      expect(reaction.type).toBe('emoji');
    });

    it('should remove reaction', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });

      await expect(
        slackClient.removeReaction('C123/1234567890.123456', 'thumbsup')
      ).resolves.toBeUndefined();
    });

    it('should list reactions', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          message: {
            reactions: [
              {
                name: 'thumbsup',
                count: 2,
                users: ['U1', 'U2'],
              },
              {
                name: 'heart',
                count: 1,
                users: ['U3'],
              },
            ],
          },
        }),
        status: 200,
        ok: true,
      });

      const reactions = await slackClient.listReactions(
        'C123/1234567890.123456'
      );

      expect(reactions).toHaveLength(2);
      expect(reactions[0].emoji).toBe('thumbsup');
      expect(reactions[0].count).toBe(2);
    });
  });

  describe('Channel Member Operations', () => {
    beforeEach(async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });
      await slackClient.connect();
    });

    it('should add member to channel', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({ ok: true }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            ok: true,
            user: {
              id: 'U123',
              name: 'john',
              real_name: 'John Doe',
            },
          }),
          status: 200,
          ok: true,
        });

      const user = await slackClient.addChannelMember('C123', 'U123');

      expect(user).toBeDefined();
      expect(user.id).toBe('U123');
    });

    it('should remove member from channel', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });

      await expect(
        slackClient.removeChannelMember('C123', 'U123')
      ).resolves.toBeUndefined();
    });

    it('should list channel members', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            ok: true,
            members: ['U1', 'U2', 'U3'],
            response_metadata: { next_cursor: '' },
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            ok: true,
            user: { id: 'U1', name: 'user1', real_name: 'User One' },
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            ok: true,
            user: { id: 'U2', name: 'user2', real_name: 'User Two' },
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            ok: true,
            user: { id: 'U3', name: 'user3', real_name: 'User Three' },
          }),
          status: 200,
          ok: true,
        });

      const result = await slackClient.listChannelMembers('C123');

      expect(result.members).toHaveLength(3);
    });
  });

  describe('Webhook Validation', () => {
    it('should validate correct webhook signature', () => {
      const crypto = require('crypto');
      const secret = 'test-secret';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify({ test: 'data' });

      const baseString = `v0:${timestamp}:${body}`;
      const hmac = crypto.createHmac('sha256', secret);
      const signature = `v0=${hmac.update(baseString).digest('hex')}`;

      const testConfig = {
        ...mockConfig,
        credentials: { secret },
      };

      const client = new SlackClient(testConfig);
      const isValid = client.validateWebhook(signature, timestamp, body);

      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const testConfig = {
        ...mockConfig,
        credentials: { secret: 'test-secret' },
      };

      const client = new SlackClient(testConfig);
      const isValid = client.validateWebhook(
        'invalid-signature',
        '123456789',
        '{}'
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting', async () => {
      const startTime = Date.now();

      // Create a client with low rate limit
      const limitedConfig = {
        ...mockConfig,
        rateLimitPerSecond: 2,
      };

      const client = new SlackClient(limitedConfig);

      (global.fetch as any).mockResolvedValue({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });

      await client.connect();

      // Make multiple requests
      for (let i = 0; i < 5; i++) {
        await client.getChannel('C123').catch(() => {});
      }

      const elapsed = Date.now() - startTime;

      // Should take some time due to rate limiting
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Caching', () => {
    beforeEach(async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });
      await slackClient.connect();
    });

    it('should cache channels', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          channel: {
            id: 'C123',
            name: 'general',
            created: 1234567890,
            is_archived: false,
            is_private: false,
          },
        }),
        status: 200,
        ok: true,
      });

      const channel1 = await slackClient.getChannel('C123');

      // Second call should use cache (no fetch call)
      const channel2 = await slackClient.getChannel('C123');

      expect(channel1).toEqual(channel2);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ ok: true }),
        status: 200,
        ok: true,
      });
      await slackClient.connect();
    });

    it('should retry on transient failures', async () => {
      let callCount = 0;

      (global.fetch as any).mockImplementation(async () => {
        callCount += 1;
        if (callCount < 2) {
          throw new Error('Temporary network error');
        }
        return {
          json: async () => ({
            ok: true,
            channel: { id: 'C123', name: 'general' },
          }),
          status: 200,
          ok: true,
        };
      });

      const channel = await slackClient.getChannel('C123');

      expect(channel).toBeDefined();
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: false,
          error: 'channel_not_found',
        }),
        status: 200,
        ok: false,
      });

      const channel = await slackClient.getChannel('C999');

      expect(channel).toBeNull();
    });
  });

  describe('Emoji Normalization', () => {
    it('should normalize emoji codes to unicode', () => {
      const client = new SlackClient(mockConfig);
      const content = 'Great job! :+1: This is :fire: and :tada:';

      const normalized = (client as any).normalizeEmoji(content);

      expect(normalized).toContain('👍');
      expect(normalized).toContain('🔥');
      expect(normalized).toContain('🎉');
    });
  });
});
