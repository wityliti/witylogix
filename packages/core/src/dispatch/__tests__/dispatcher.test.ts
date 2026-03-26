import { describe, it, expect, vi, beforeEach } from 'vitest';

type Channel = 'email' | 'sms' | 'push' | 'whatsapp';

interface DispatchMessage {
  to: string;
  subject?: string;
  body: string;
  channel: Channel;
}

interface DispatchResult {
  success: boolean;
  channel: Channel;
  error?: string;
}

interface MultiChannelResult {
  results: DispatchResult[];
  allSuccessful: boolean;
  failedChannels: Channel[];
}

interface ChannelProvider {
  send(message: DispatchMessage): Promise<void>;
}

class MockEmailProvider implements ChannelProvider {
  async send(message: DispatchMessage): Promise<void> {
    if (!message.to || !message.subject || !message.body) {
      throw new Error('Missing required email fields');
    }
  }
}

class MockSmsProvider implements ChannelProvider {
  async send(message: DispatchMessage): Promise<void> {
    if (!message.to || !message.body) {
      throw new Error('Missing required SMS fields');
    }
    if (message.body.length > 160) {
      throw new Error('SMS message too long');
    }
  }
}

class MockPushProvider implements ChannelProvider {
  async send(message: DispatchMessage): Promise<void> {
    if (!message.to || !message.body) {
      throw new Error('Missing required push notification fields');
    }
  }
}

class Dispatcher {
  private providers: Map<Channel, ChannelProvider>;
  private fallbackChain: Channel[];

  constructor() {
    this.providers = new Map();
    this.fallbackChain = ['email', 'sms', 'push', 'whatsapp'];
  }

  registerProvider(channel: Channel, provider: ChannelProvider): void {
    this.providers.set(channel, provider);
  }

  setFallbackChain(chain: Channel[]): void {
    this.fallbackChain = chain;
  }

  async dispatch(message: DispatchMessage): Promise<DispatchResult> {
    const provider = this.providers.get(message.channel);

    if (!provider) {
      return {
        success: false,
        channel: message.channel,
        error: `No provider registered for channel: ${message.channel}`,
      };
    }

    try {
      await provider.send(message);
      return {
        success: true,
        channel: message.channel,
      };
    } catch (error) {
      return {
        success: false,
        channel: message.channel,
        error: (error as Error).message,
      };
    }
  }

  async dispatchWithFallback(
    message: DispatchMessage
  ): Promise<DispatchResult> {
    const channelIndex = this.fallbackChain.indexOf(message.channel);

    if (channelIndex === -1) {
      return this.dispatch(message);
    }

    const chainsToTry = this.fallbackChain.slice(channelIndex);

    for (const channel of chainsToTry) {
      const result = await this.dispatch({
        ...message,
        channel,
      });

      if (result.success) {
        return result;
      }
    }

    return {
      success: false,
      channel: message.channel,
      error: 'All channels in fallback chain failed',
    };
  }

  async dispatchMultiChannel(
    message: DispatchMessage,
    channels: Channel[]
  ): Promise<MultiChannelResult> {
    const results: DispatchResult[] = [];
    const failedChannels: Channel[] = [];

    for (const channel of channels) {
      const result = await this.dispatch({
        ...message,
        channel,
      });

      results.push(result);

      if (!result.success) {
        failedChannels.push(channel);
      }
    }

    return {
      results,
      allSuccessful: failedChannels.length === 0,
      failedChannels,
    };
  }
}

describe('Dispatcher', () => {
  let dispatcher: Dispatcher;
  let emailProvider: ChannelProvider;
  let smsProvider: ChannelProvider;
  let pushProvider: ChannelProvider;

  beforeEach(() => {
    dispatcher = new Dispatcher();
    emailProvider = new MockEmailProvider();
    smsProvider = new MockSmsProvider();
    pushProvider = new MockPushProvider();

    dispatcher.registerProvider('email', emailProvider);
    dispatcher.registerProvider('sms', smsProvider);
    dispatcher.registerProvider('push', pushProvider);
  });

  describe('dispatch', () => {
    it('should dispatch email successfully', async () => {
      const message: DispatchMessage = {
        to: 'user@example.com',
        subject: 'Test',
        body: 'Test message',
        channel: 'email',
      };

      const result = await dispatcher.dispatch(message);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('email');
      expect(result.error).toBeUndefined();
    });

    it('should dispatch SMS successfully', async () => {
      const message: DispatchMessage = {
        to: '+1234567890',
        body: 'Test SMS',
        channel: 'sms',
      };

      const result = await dispatcher.dispatch(message);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('sms');
    });

    it('should dispatch push notification successfully', async () => {
      const message: DispatchMessage = {
        to: 'device-token-123',
        body: 'Test push',
        channel: 'push',
      };

      const result = await dispatcher.dispatch(message);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('push');
    });

    it('should return error for unregistered provider', async () => {
      const message: DispatchMessage = {
        to: 'test',
        body: 'Test',
        channel: 'whatsapp',
      };

      const result = await dispatcher.dispatch(message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No provider registered');
    });

    it('should catch provider errors', async () => {
      const message: DispatchMessage = {
        to: 'user@example.com',
        body: 'Test',
        channel: 'email',
      };

      const result = await dispatcher.dispatch(message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required');
    });

    it('should handle SMS message length validation', async () => {
      const message: DispatchMessage = {
        to: '+1234567890',
        body: 'a'.repeat(200),
        channel: 'sms',
      };

      const result = await dispatcher.dispatch(message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('too long');
    });
  });

  describe('dispatchMultiChannel', () => {
    it('should dispatch to multiple channels', async () => {
      const message: DispatchMessage = {
        to: 'user@example.com',
        subject: 'Notification',
        body: 'Test',
        channel: 'email',
      };

      const result = await dispatcher.dispatchMultiChannel(message, [
        'email',
        'push',
      ]);

      expect(result.results.length).toBe(2);
      expect(result.allSuccessful).toBe(false);
      expect(result.failedChannels.length).toBeGreaterThan(0);
    });

    it('should track all failed channels', async () => {
      const message: DispatchMessage = {
        to: 'test',
        body: 'Test',
        channel: 'email',
      };

      const result = await dispatcher.dispatchMultiChannel(message, [
        'email',
        'sms',
        'push',
      ]);

      expect(result.failedChannels.length).toBeGreaterThan(0);
    });

    it('should mark all successful when all channels succeed', async () => {
      const mockProvider = {
        send: vi.fn().mockResolvedValue(undefined),
      };

      dispatcher.registerProvider('email', mockProvider);
      dispatcher.registerProvider('sms', mockProvider);

      const message: DispatchMessage = {
        to: 'valid',
        subject: 'Test',
        body: 'Test',
        channel: 'email',
      };

      const result = await dispatcher.dispatchMultiChannel(message, [
        'email',
        'sms',
      ]);

      expect(result.allSuccessful).toBe(true);
      expect(result.failedChannels).toEqual([]);
    });

    it('should continue dispatching after single channel failure', async () => {
      const message: DispatchMessage = {
        to: 'test',
        body: 'Test',
        channel: 'email',
      };

      const result = await dispatcher.dispatchMultiChannel(message, [
        'email',
        'sms',
        'push',
      ]);

      expect(result.results.length).toBe(3);
    });

    it('should return results for all requested channels', async () => {
      const mockProvider = {
        send: vi.fn().mockResolvedValue(undefined),
      };

      dispatcher.registerProvider('whatsapp', mockProvider);

      const message: DispatchMessage = {
        to: 'valid',
        body: 'Test',
        channel: 'email',
      };

      const result = await dispatcher.dispatchMultiChannel(message, [
        'email',
        'sms',
        'whatsapp',
      ]);

      expect(result.results.length).toBe(3);
      expect(result.results.every((r) => r.channel)).toBe(true);
    });

    it('should handle empty channel list', async () => {
      const message: DispatchMessage = {
        to: 'test',
        body: 'Test',
        channel: 'email',
      };

      const result = await dispatcher.dispatchMultiChannel(message, []);

      expect(result.results).toEqual([]);
      expect(result.allSuccessful).toBe(true);
      expect(result.failedChannels).toEqual([]);
    });
  });

  describe('dispatchWithFallback', () => {
    it('should try fallback channels on failure', async () => {
      dispatcher.setFallbackChain(['email', 'sms', 'push']);

      const mockSmsProvider = {
        send: vi.fn().mockResolvedValue(undefined),
      };

      dispatcher.registerProvider('sms', mockSmsProvider);

      const message: DispatchMessage = {
        to: 'test@example.com',
        body: 'Test',
        channel: 'email',
      };

      const result = await dispatcher.dispatchWithFallback(message);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('sms');
    });

    it('should succeed on primary channel without fallback', async () => {
      const mockEmailProvider = {
        send: vi.fn().mockResolvedValue(undefined),
      };

      dispatcher.registerProvider('email', mockEmailProvider);

      const message: DispatchMessage = {
        to: 'test',
        subject: 'Test',
        body: 'Test',
        channel: 'email',
      };

      const result = await dispatcher.dispatchWithFallback(message);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('email');
    });

    it('should fail when all fallback channels fail', async () => {
      const message: DispatchMessage = {
        to: 'invalid',
        body: 'invalid',
        channel: 'email',
      };

      const result = await dispatcher.dispatchWithFallback(message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('All channels');
    });

    it('should return first successful fallback channel', async () => {
      dispatcher.setFallbackChain(['email', 'sms', 'push']);

      const mockPushProvider = {
        send: vi.fn().mockResolvedValue(undefined),
      };

      dispatcher.registerProvider('push', mockPushProvider);

      const message: DispatchMessage = {
        to: 'device-token',
        body: 'Test',
        channel: 'email',
      };

      const result = await dispatcher.dispatchWithFallback(message);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('push');
    });

    it('should respect custom fallback chain order', async () => {
      dispatcher.setFallbackChain(['sms', 'email', 'push']);

      const mockSmsProvider = {
        send: vi.fn().mockResolvedValue(undefined),
      };

      dispatcher.registerProvider('sms', mockSmsProvider);

      const message: DispatchMessage = {
        to: '+1234567890',
        body: 'Test',
        channel: 'sms',
      };

      const result = await dispatcher.dispatchWithFallback(message);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('sms');
    });

    it('should handle channel not in fallback chain', async () => {
      dispatcher.setFallbackChain(['email', 'sms']);

      const message: DispatchMessage = {
        to: 'test',
        body: 'Test',
        channel: 'whatsapp',
      };

      const result = await dispatcher.dispatchWithFallback(message);

      expect(result.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle provider that throws error', async () => {
      const errorProvider = {
        send: vi.fn().mockRejectedValue(new Error('Network error')),
      };

      dispatcher.registerProvider('email', errorProvider);

      const message: DispatchMessage = {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test',
        channel: 'email',
      };

      const result = await dispatcher.dispatch(message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should include original error message', async () => {
      const errorProvider = {
        send: vi.fn().mockRejectedValue(new Error('Specific error message')),
      };

      dispatcher.registerProvider('push', errorProvider);

      const message: DispatchMessage = {
        to: 'token',
        body: 'Test',
        channel: 'push',
      };

      const result = await dispatcher.dispatch(message);

      expect(result.error).toBe('Specific error message');
    });
  });

  describe('Integration Tests', () => {
    it('should handle multi-channel dispatch with fallback', async () => {
      const mockEmailProvider = {
        send: vi.fn().mockResolvedValue(undefined),
      };

      dispatcher.registerProvider('email', mockEmailProvider);

      const message: DispatchMessage = {
        to: 'user@example.com',
        subject: 'Test',
        body: 'Test',
        channel: 'email',
      };

      const multiResult = await dispatcher.dispatchMultiChannel(message, [
        'email',
        'sms',
        'push',
      ]);

      expect(multiResult.results).toBeDefined();
      expect(multiResult.results.length).toBeGreaterThan(0);
    });

    it('should dispatch to email first, fallback to SMS', async () => {
      dispatcher.setFallbackChain(['email', 'sms', 'push']);

      const mockSmsProvider = {
        send: vi.fn().mockResolvedValue(undefined),
      };

      dispatcher.registerProvider('sms', mockSmsProvider);

      const message: DispatchMessage = {
        to: '+1234567890',
        body: 'Order notification',
        channel: 'email',
      };

      const result = await dispatcher.dispatchWithFallback(message);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('sms');
    });

    it('should track all channels attempted in fallback', async () => {
      dispatcher.setFallbackChain(['email', 'sms', 'push']);

      const message: DispatchMessage = {
        to: 'test',
        body: 'Test',
        channel: 'email',
      };

      const result = await dispatcher.dispatchWithFallback(message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('All channels');
    });
  });
});
