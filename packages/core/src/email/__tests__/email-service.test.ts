import { describe, it, expect, vi, beforeEach } from 'vitest';

interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<void>;
}

interface TemplateData {
  [key: string]: any;
}

interface EmailConfig {
  provider: 'console' | 'smtp' | 'aws';
  defaultFrom?: string;
}

class ConsoleEmailProvider implements EmailProvider {
  async send(to: string, subject: string, body: string): Promise<void> {
    console.log(`[EMAIL] To: ${to}\nSubject: ${subject}\nBody: ${body}`);
  }
}

class EmailValidator {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

class TemplateRenderer {
  render(template: string, data: TemplateData): string {
    let result = template;
    Object.entries(data).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    });
    return result;
  }
}

interface RateLimitConfig {
  maxEmails: number;
  timeWindowMs: number;
}

class EmailService {
  private provider: EmailProvider;
  private templateRenderer: TemplateRenderer;
  private config: EmailConfig;
  private sentEmails: number[] = [];
  private rateLimitConfig: RateLimitConfig;

  constructor(config: EmailConfig, rateLimitConfig?: RateLimitConfig) {
    this.config = config;
    this.provider = new ConsoleEmailProvider();
    this.templateRenderer = new TemplateRenderer();
    this.rateLimitConfig = rateLimitConfig || {
      maxEmails: 100,
      timeWindowMs: 60000,
    };
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    if (!EmailValidator.isValidEmail(to)) {
      throw new Error(`Invalid email address: ${to}`);
    }

    await this.provider.send(to, subject, body);
  }

  async sendTemplate(
    to: string,
    subject: string,
    templateBody: string,
    data: TemplateData
  ): Promise<void> {
    if (!EmailValidator.isValidEmail(to)) {
      throw new Error(`Invalid email address: ${to}`);
    }

    const renderedSubject = this.templateRenderer.render(subject, data);
    const renderedBody = this.templateRenderer.render(templateBody, data);

    await this.provider.send(to, renderedSubject, renderedBody);
  }

  async sendBulk(
    recipients: string[],
    subject: string,
    body: string
  ): Promise<{ sent: number; failed: number; errors: string[] }> {
    const results = { sent: 0, failed: 0, errors: [] as string[] };

    for (const recipient of recipients) {
      // Check rate limit
      const now = Date.now();
      this.sentEmails = this.sentEmails.filter(
        (timestamp) => now - timestamp < this.rateLimitConfig.timeWindowMs
      );

      if (
        this.sentEmails.length >= this.rateLimitConfig.maxEmails
      ) {
        results.errors.push(`Rate limit exceeded for ${recipient}`);
        results.failed++;
        continue;
      }

      try {
        if (!EmailValidator.isValidEmail(recipient)) {
          throw new Error(`Invalid email: ${recipient}`);
        }
        await this.provider.send(recipient, subject, body);
        results.sent++;
        this.sentEmails.push(now);
      } catch (error) {
        results.failed++;
        results.errors.push(
          `Failed to send to ${recipient}: ${(error as Error).message}`
        );
      }
    }

    return results;
  }

  setProvider(provider: EmailProvider): void {
    this.provider = provider;
  }
}

describe('EmailService', () => {
  let emailService: EmailService;
  let mockProvider: EmailProvider;

  beforeEach(() => {
    emailService = new EmailService({ provider: 'console' });
    mockProvider = {
      send: vi.fn(),
    };
    emailService.setProvider(mockProvider);
  });

  describe('ConsoleEmailProvider', () => {
    it('should log email to console', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const provider = new ConsoleEmailProvider();

      await provider.send('test@example.com', 'Test Subject', 'Test Body');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('test@example.com');
      expect(logCall).toContain('Test Subject');
      expect(logCall).toContain('Test Body');

      consoleLogSpy.mockRestore();
    });

    it('should include email address in log output', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const provider = new ConsoleEmailProvider();

      await provider.send('user@domain.com', 'Subject', 'Body');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('user@domain.com')
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('EmailValidator', () => {
    it('should validate correct email addresses', () => {
      expect(EmailValidator.isValidEmail('test@example.com')).toBe(true);
      expect(EmailValidator.isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(EmailValidator.isValidEmail('a@b.c')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(EmailValidator.isValidEmail('invalid')).toBe(false);
      expect(EmailValidator.isValidEmail('invalid@')).toBe(false);
      expect(EmailValidator.isValidEmail('@example.com')).toBe(false);
      expect(EmailValidator.isValidEmail('user@domain')).toBe(false);
      expect(EmailValidator.isValidEmail('user @example.com')).toBe(false);
    });

    it('should reject empty email', () => {
      expect(EmailValidator.isValidEmail('')).toBe(false);
    });
  });

  describe('send()', () => {
    it('should send email with correct parameters', async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      await emailService.send('user@example.com', 'Subject', 'Body');

      expect(mockSend).toHaveBeenCalledWith(
        'user@example.com',
        'Subject',
        'Body'
      );
    });

    it('should throw error for invalid email address', async () => {
      await expect(
        emailService.send('invalid-email', 'Subject', 'Body')
      ).rejects.toThrow('Invalid email address');
    });

    it('should handle multiple recipients separately', async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      await emailService.send('user1@example.com', 'Subject', 'Body');
      await emailService.send('user2@example.com', 'Subject', 'Body');

      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendTemplate()', () => {
    it('should render template and send email', async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const template = 'Hello {{name}}, welcome to {{company}}!';
      const data = { name: 'John', company: 'Witylogix' };

      await emailService.sendTemplate(
        'john@example.com',
        'Welcome {{name}}',
        template,
        data
      );

      expect(mockSend).toHaveBeenCalledWith(
        'john@example.com',
        'Welcome John',
        'Hello John, welcome to Witylogix!'
      );
    });

    it('should render subject with variables', async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      await emailService.sendTemplate(
        'user@example.com',
        'Order {{orderId}} Status',
        'Body',
        { orderId: '12345' }
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.anything(),
        'Order 12345 Status',
        expect.anything()
      );
    });

    it('should throw error for invalid email in sendTemplate', async () => {
      await expect(
        emailService.sendTemplate(
          'invalid-email',
          'Subject',
          'Body',
          { name: 'John' }
        )
      ).rejects.toThrow('Invalid email address');
    });

    it('should handle multiple template variables', async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const template = 'Hi {{firstName}} {{lastName}}, order {{id}} is {{status}}';
      const data = {
        firstName: 'Jane',
        lastName: 'Doe',
        id: 'ORD123',
        status: 'shipped',
      };

      await emailService.sendTemplate(
        'jane@example.com',
        'Order Update',
        template,
        data
      );

      expect(mockSend).toHaveBeenCalledWith(
        'jane@example.com',
        'Order Update',
        'Hi Jane Doe, order ORD123 is shipped'
      );
    });
  });

  describe('sendBulk()', () => {
    it('should send emails to multiple recipients', async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const recipients = [
        'user1@example.com',
        'user2@example.com',
        'user3@example.com',
      ];
      const result = await emailService.sendBulk(
        recipients,
        'Subject',
        'Body'
      );

      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('should track failed emails with invalid addresses', async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const recipients = ['valid@example.com', 'invalid-email', 'another@valid.com'];
      const result = await emailService.sendBulk(
        recipients,
        'Subject',
        'Body'
      );

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
    });

    it('should respect rate limiting', async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const rateLimitedService = new EmailService(
        { provider: 'console' },
        { maxEmails: 2, timeWindowMs: 60000 }
      );
      rateLimitedService.setProvider(mockProvider);

      const recipients = [
        'user1@example.com',
        'user2@example.com',
        'user3@example.com',
      ];
      const result = await rateLimitedService.sendBulk(
        recipients,
        'Subject',
        'Body'
      );

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain('Rate limit exceeded');
    });

    it('should return empty errors array on success', async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const result = await emailService.sendBulk(
        ['user@example.com'],
        'Subject',
        'Body'
      );

      expect(result.errors).toEqual([]);
    });

    it('should handle empty recipient list', async () => {
      const result = await emailService.sendBulk([], 'Subject', 'Body');

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should continue sending after errors', async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const recipients = [
        'valid1@example.com',
        'invalid',
        'valid2@example.com',
      ];
      const result = await emailService.sendBulk(
        recipients,
        'Subject',
        'Body'
      );

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle provider errors gracefully', async () => {
      mockProvider.send = vi.fn().mockRejectedValue(
        new Error('Provider connection failed')
      );

      await expect(
        emailService.send('user@example.com', 'Subject', 'Body')
      ).rejects.toThrow('Provider connection failed');
    });

    it('should include error message in bulk send results', async () => {
      mockProvider.send = vi
        .fn()
        .mockRejectedValueOnce(new Error('SMTP error'));

      const result = await emailService.sendBulk(
        ['user@example.com'],
        'Subject',
        'Body'
      );

      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain('SMTP error');
    });

    it('should not stop on individual email failures in bulk send', async () => {
      let callCount = 0;
      mockProvider.send = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Network timeout');
        }
      });

      const result = await emailService.sendBulk(
        ['user1@example.com', 'user2@example.com', 'user3@example.com'],
        'Subject',
        'Body'
      );

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe('Integration', () => {
    it('should send templated bulk emails', async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const recipients = ['john@example.com', 'jane@example.com'];
      const template = 'Hello {{name}}';
      const subject = 'Welcome {{name}}';

      for (const recipient of recipients) {
        const nameMap: { [key: string]: string } = {
          'john@example.com': 'John',
          'jane@example.com': 'Jane',
        };
        await emailService.sendTemplate(
          recipient,
          subject,
          template,
          { name: nameMap[recipient] }
        );
      }

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockSend).toHaveBeenCalledWith(
        'john@example.com',
        'Welcome John',
        'Hello John'
      );
    });
  });
});
