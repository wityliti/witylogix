/**
 * Email service - unified email handling
 * Supports multiple providers: SendGrid, SMTP, Console
 */

import type {
  EmailConfig,
  EmailMessage,
  EmailResult,
  EmailProvider,
  EmailTemplate,
  EmailBulkResult,
  TemplateVariables,
} from "./types.js";
import { EmailStatus } from "./types.js";
import { ConsoleEmailProvider } from "./providers/console-provider.js";
import { SmtpEmailProvider } from "./providers/smtp-provider.js";
import { renderTemplate } from "./template-renderer.js";

export type {
  EmailConfig,
  EmailMessage,
  EmailResult,
  EmailTemplate,
  EmailBulkResult,
  TemplateVariables,
};
export {
  EmailStatus,
  type EmailProvider,
  type EmailAttachment,
} from "./types.js";
export { ConsoleEmailProvider } from "./providers/console-provider.js";
export {
  SmtpEmailProvider,
  type SmtpTransport,
} from "./providers/smtp-provider.js";
export { renderTemplate } from "./template-renderer.js";

/**
 * Email service for sending emails through configured provider
 */
export class EmailService {
  private config: EmailConfig;
  private provider: EmailProvider;
  private templates: Map<string, EmailTemplate> = new Map();
  private rateLimitDelay: number;

  constructor(config: EmailConfig, rateLimitDelayMs: number = 100) {
    this.config = config;
    this.rateLimitDelay = rateLimitDelayMs;
    this.provider = this.initializeProvider();
  }

  /**
   * Initialize the configured email provider
   */
  private initializeProvider(): EmailProvider {
    switch (this.config.provider) {
      case "console":
        return new ConsoleEmailProvider();

      case "smtp":
        return new SmtpEmailProvider(this.config);

      case "sendgrid":
        throw new Error(
          "SendGrid provider not yet implemented. Use console or smtp provider for now.",
        );

      default:
        throw new Error(`Unknown email provider: ${this.config.provider}`);
    }
  }

  /**
   * Send a single email message
   */
  async send(message: EmailMessage): Promise<EmailResult> {
    // Use configured from if not provided
    const finalMessage: EmailMessage = {
      ...message,
      from: message.from || this.config.from,
    };

    return this.provider.send(finalMessage);
  }

  /**
   * Send an email from a template
   */
  async sendTemplate(
    templateId: string,
    to: string | string[],
    variables: TemplateVariables = {},
  ): Promise<EmailResult> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const subject = renderTemplate(template.subject, variables);
    const html = renderTemplate(template.htmlTemplate, variables);
    const text = template.textTemplate
      ? renderTemplate(template.textTemplate, variables)
      : undefined;

    return this.send({
      to,
      from: this.config.from,
      subject,
      html,
      text,
      metadata: {
        templateId,
      },
    });
  }

  /**
   * Send multiple emails with rate limiting
   */
  async sendBulk(messages: EmailMessage[]): Promise<EmailBulkResult> {
    const results: EmailResult[] = [];
    const failedMessages: Array<{ message: EmailMessage; error: string }> = [];

    for (const message of messages) {
      try {
        const result = await this.send(message);
        results.push(result);

        // Rate limiting
        await this.sleep(this.rateLimitDelay);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        failedMessages.push({ message, error: errorMessage });
      }
    }

    return {
      totalCount: messages.length,
      successCount: results.filter((r) => r.status === EmailStatus.SENT).length,
      failureCount: failedMessages.length,
      results,
      failedMessages,
    };
  }

  /**
   * Register an email template
   */
  registerTemplate(template: EmailTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get a registered template
   */
  getTemplate(templateId: string): EmailTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get all registered templates
   */
  getAllTemplates(): EmailTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Clean up resources
   */
  async disconnect(): Promise<void> {
    if (this.provider.disconnect) {
      await this.provider.disconnect();
    }
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
