/**
 * Twilio SMS Provider Tests
 * Comprehensive test suite for Twilio SMS notification provider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TwilioSMSProvider } from '../twilio';
import {
  RateLimitError,
  InvalidRecipientError,
  AuthenticationError,
  ProviderError,
} from '../types';

describe('TwilioSMSProvider', () => {
  let provider: TwilioSMSProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    provider = new TwilioSMSProvider({
      accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      authToken: 'auth_token_12345',
      fromNumber: '+14155552671',
    });
  });

  describe('send()', () => {
    it('should send SMS successfully with 201 response', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 201,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          sid: 'SM1234567890abcdef1234567890abcde',
        }),
      });

      const result = await provider.send({
        to: '+14155552672',
        body: 'Hello, this is a test SMS message',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SM1234567890abcdef1234567890abcde');
    });

    it('should use URL-encoded form body format', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 201,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({ sid: 'SM123' }),
      });

      await provider.send({
        to: '+14155552672',
        body: 'Test message',
      });

      const call = mockFetch.mock.calls[0];
      const requestOptions = call[1];

      // Verify Content-Type is URL-encoded
      expect(requestOptions.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

      // Verify body is URL-encoded
      const bodyStr = requestOptions.body;
      expect(bodyStr).toContain('To=');
      expect(bodyStr).toContain('From=');
      expect(bodyStr).toContain('Body=');
      expect(bodyStr).toContain(encodeURIComponent('+14155552672'));
    });

    it('should use Basic authentication header format', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 201,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({ sid: 'SM123' }),
      });

      await provider.send({
        to: '+14155552672',
        body: 'Test',
      });

      const call = mockFetch.mock.calls[0];
      const requestOptions = call[1];
      const authHeader = requestOptions.headers['Authorization'];

      expect(authHeader).toMatch(/^Basic /);

      // Decode and verify Basic auth format
      const base64Creds = authHeader.replace('Basic ', '');
      const credentials = Buffer.from(base64Creds, 'base64').toString('utf-8');
      expect(credentials).toBe('ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx:auth_token_12345');
    });

    it('should handle Twilio error code 21211 (invalid phone number)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          error_code: '21211',
        }),
      });

      const result = await provider.send({
        to: '+invalid',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phone number format');
    });

    it('should handle Twilio error code 21612 (unverified phone number)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          error_code: '21612',
        }),
      });

      const result = await provider.send({
        to: '+14155552672',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Phone number is not verified');
    });

    it('should handle rate limit error (429 response)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 429,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({}),
      });

      const result = await provider.send({
        to: '+14155552672',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('should handle Twilio error code 20429 (rate limit)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          error_code: '20429',
        }),
      });

      const result = await provider.send({
        to: '+14155552672',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('should handle authentication error (401 response)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({}),
      });

      const result = await provider.send({
        to: '+14155552672',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
    });

    it('should handle error code 20003 (auth error)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          error_code: '20003',
        }),
      });

      const result = await provider.send({
        to: '+14155552672',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
    });

    it('should reject invalid phone number format', async () => {
      const result = await provider.send({
        to: '14155552672', // Missing +
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject missing API credentials', async () => {
      const providerNoAuth = new TwilioSMSProvider({
        accountSid: '',
        authToken: '',
        fromNumber: '+14155552671',
      });

      const result = await providerNoAuth.send({
        to: '+14155552672',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing credentials');
    });

    it('should reject empty message body', async () => {
      const result = await provider.send({
        to: '+14155552672',
        body: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Message body cannot be empty');
    });

    it('should use textBody when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 201,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({ sid: 'SM123' }),
      });

      await provider.send({
        to: '+14155552672',
        body: '<p>HTML body</p>',
        textBody: 'Plain text body',
      });

      const call = mockFetch.mock.calls[0];
      const bodyStr = call[1].body;

      expect(bodyStr).toContain('Body=Plain+text+body');
    });

    it('should support MMS with MediaUrl', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 201,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({ sid: 'MM123' }),
      });

      await provider.send({
        to: '+14155552672',
        body: 'Check out this image',
        metadata: { mediaUrl: 'https://example.com/image.jpg' },
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle other Twilio error codes', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          error_code: '30001',
        }),
      });

      const result = await provider.send({
        to: '+14155552672',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Twilio error');
    });
  });

  describe('validateConfig()', () => {
    it('should validate correct configuration', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn(),
      });

      const result = await provider.validateConfig({
        accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        authToken: 'auth_token_12345',
        fromNumber: '+14155552671',
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': expect.stringMatching(/^Basic /),
          }),
        })
      );
    });

    it('should reject missing accountSid', async () => {
      const result = await provider.validateConfig({
        accountSid: '',
        authToken: 'token',
        fromNumber: '+14155552671',
      });

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject missing authToken', async () => {
      const result = await provider.validateConfig({
        accountSid: 'AC123',
        authToken: '',
        fromNumber: '+14155552671',
      });

      expect(result).toBe(false);
    });

    it('should reject invalid fromNumber format', async () => {
      const result = await provider.validateConfig({
        accountSid: 'AC123',
        authToken: 'token',
        fromNumber: '14155552671', // Missing +
      });

      expect(result).toBe(false);
    });

    it('should handle validation API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
        ok: false,
      });

      const result = await provider.validateConfig({
        accountSid: 'AC123',
        authToken: 'invalid',
        fromNumber: '+14155552671',
      });

      expect(result).toBe(false);
    });
  });

  describe('getStatus()', () => {
    it('should return healthy status with latency', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn(),
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
        json: vi.fn(),
      });

      const status1 = await provider.getStatus();
      const status2 = await provider.getStatus();

      expect(status1).toEqual(status2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle health check failure', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 500,
        ok: false,
        statusText: 'Internal Server Error',
      });

      const status = await provider.getStatus();

      expect(status.healthy).toBe(false);
      expect(status.lastError).toBeDefined();
    });

    it('should handle network error in health check', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection timeout'));

      const status = await provider.getStatus();

      expect(status.healthy).toBe(false);
      expect(status.lastError).toContain('Connection timeout');
    });
  });

  describe('channel and name properties', () => {
    it('should have correct channel type', () => {
      expect(provider.channel).toBe('SMS');
    });

    it('should have correct provider name', () => {
      expect(provider.name).toBe('Twilio');
    });
  });
});
