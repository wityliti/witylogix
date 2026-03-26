/**
 * SendGrid Email Provider Tests
 * Comprehensive test suite for SendGrid email notification provider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SendGridEmailProvider } from '../sendgrid';
import {
  RateLimitError,
  InvalidRecipientError,
  AuthenticationError,
  ProviderError,
} from '../types';

describe('SendGridEmailProvider', () => {
  let provider: SendGridEmailProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    provider = new SendGridEmailProvider({
      apiKey: 'test-api-key-12345',
      fromEmail: 'noreply@example.com',
      fromName: 'Test App',
    });
  });

  describe('send()', () => {
    it('should send email successfully with 202 response', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 202,
        ok: true,
        headers: new Map([['X-Message-Id', 'test-message-id-12345']]),
        json: vi.fn().mockResolvedValueOnce({}),
      });

      const result = await provider.send({
        to: 'user@example.com',
        subject: 'Test Email',
        body: '<p>This is a test email</p>',
        textBody: 'This is a test email',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id-12345');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key-12345',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should verify request payload structure matches SendGrid API spec', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 202,
        ok: true,
        headers: new Map([['X-Message-Id', 'msg-123']]),
        json: vi.fn(),
      });

      await provider.send({
        to: 'user@example.com',
        subject: 'Test',
        body: '<p>Body</p>',
        textBody: 'Body',
        from: 'sender@example.com',
        replyTo: 'reply@example.com',
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      // Verify payload structure
      expect(body).toHaveProperty('personalizations');
      expect(body.personalizations[0]).toHaveProperty('to');
      expect(body.personalizations[0].to[0]).toEqual({ email: 'user@example.com' });
      expect(body.personalizations[0].subject).toBe('Test');
      expect(body).toHaveProperty('from');
      expect(body.from).toEqual({ email: 'sender@example.com', name: 'Test App' });
      expect(body.replyTo).toEqual({ email: 'reply@example.com' });
      expect(body).toHaveProperty('content');
      expect(body.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'text/plain', value: 'Body' }),
          expect.objectContaining({ type: 'text/html', value: '<p>Body</p>' }),
        ])
      );
    });

    it('should handle authentication error (401 response)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({}),
      });

      const result = await provider.send({
        to: 'user@example.com',
        subject: 'Test',
        body: 'Test body',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid API key or authentication failed');
    });

    it('should throw AuthenticationError when API key is missing', async () => {
      const providerNoKey = new SendGridEmailProvider({
        apiKey: '',
        fromEmail: 'noreply@example.com',
      });

      const result = await providerNoKey.send({
        to: 'user@example.com',
        subject: 'Test',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing API key');
    });

    it('should handle rate limit error (429 response with Retry-After)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 429,
        ok: false,
        headers: new Map([['Retry-After', '60']]),
        json: vi.fn(),
      });

      const result = await provider.send({
        to: 'user@example.com',
        subject: 'Test',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('should handle invalid recipient error (400 response)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          errors: [{ message: 'Invalid email address' }],
        }),
      });

      const result = await provider.send({
        to: 'invalid-email',
        subject: 'Test',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email address format');
    });

    it('should reject invalid email format before sending', async () => {
      const result = await provider.send({
        to: 'not-an-email',
        subject: 'Test',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should support CC/BCC through customArgs metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 202,
        ok: true,
        headers: new Map([['X-Message-Id', 'msg-123']]),
        json: vi.fn(),
      });

      await provider.send({
        to: 'user@example.com',
        subject: 'Test',
        body: 'Body',
        metadata: { cc: 'cc@example.com', bcc: 'bcc@example.com' },
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.customArgs).toEqual({
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
      });
    });

    it('should support template ID sending', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 202,
        ok: true,
        headers: new Map([['X-Message-Id', 'msg-123']]),
        json: vi.fn(),
      });

      await provider.send({
        to: 'user@example.com',
        templateId: 'd-template123',
        variables: { name: 'John', resetLink: 'https://example.com/reset' },
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should include attachments in payload', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 202,
        ok: true,
        headers: new Map([['X-Message-Id', 'msg-123']]),
        json: vi.fn(),
      });

      await provider.send({
        to: 'user@example.com',
        subject: 'Test with attachment',
        body: 'Body',
        attachments: [
          {
            filename: 'document.pdf',
            content: 'base64encodedcontent',
            contentType: 'application/pdf',
          },
        ],
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.attachments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            filename: 'document.pdf',
            content: 'base64encodedcontent',
            type: 'application/pdf',
            disposition: 'attachment',
          }),
        ])
      );
    });

    it('should handle other API errors (5xx)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 500,
        ok: false,
        statusText: 'Internal Server Error',
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({}),
      });

      const result = await provider.send({
        to: 'user@example.com',
        subject: 'Test',
        body: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('SendGrid API error');
    });
  });

  describe('validateConfig()', () => {
    it('should validate correct configuration with GET /v3/scopes', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn(),
      });

      const result = await provider.validateConfig({
        apiKey: 'valid-api-key',
        fromEmail: 'valid@example.com',
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/scopes',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-api-key',
          }),
        })
      );
    });

    it('should reject missing API key', async () => {
      const result = await provider.validateConfig({
        apiKey: '',
        fromEmail: 'valid@example.com',
      });

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject missing fromEmail', async () => {
      const result = await provider.validateConfig({
        apiKey: 'valid-key',
        fromEmail: '',
      });

      expect(result).toBe(false);
    });

    it('should reject invalid email format', async () => {
      const result = await provider.validateConfig({
        apiKey: 'valid-key',
        fromEmail: 'not-an-email',
      });

      expect(result).toBe(false);
    });

    it('should handle validation API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
        ok: false,
      });

      const result = await provider.validateConfig({
        apiKey: 'invalid-key',
        fromEmail: 'valid@example.com',
      });

      expect(result).toBe(false);
    });

    it('should handle network errors during validation', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.validateConfig({
        apiKey: 'valid-key',
        fromEmail: 'valid@example.com',
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
      expect(status.latency).toBeGreaterThanOrEqual(0);
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
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one call due to caching
    });

    it('should handle health check API error', async () => {
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

    it('should include quotaRemaining as undefined for SendGrid', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn(),
      });

      const status = await provider.getStatus();

      expect(status.quotaRemaining).toBeUndefined();
    });
  });

  describe('channel and name properties', () => {
    it('should have correct channel type', () => {
      expect(provider.channel).toBe('EMAIL');
    });

    it('should have correct provider name', () => {
      expect(provider.name).toBe('SendGrid');
    });
  });
});
