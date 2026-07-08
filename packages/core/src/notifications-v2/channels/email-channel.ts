/**
 * Email Channel — Send emails via Nodemailer/SES
 */

import { EmailResult } from "../types.js";

/**
 * Email send parameters
 */
export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  path: string;
  contentType?: string;
}

/**
 * Email Channel — handles email sending
 */
export class EmailChannel {
  private from: string;
  private nodeMailerInstance?: any;

  constructor(from: string = "noreply@witylogix.com", nodeMailer?: any) {
    this.from = from;
    this.nodeMailerInstance = nodeMailer;
  }

  /**
   * Send an email
   */
  async sendEmail(params: EmailParams): Promise<EmailResult> {
    try {
      // Validate input
      if (!params.to) {
        return {
          accepted: false,
          error: "Email recipient (to) is required",
        };
      }

      if (!params.subject) {
        return {
          accepted: false,
          error: "Email subject is required",
        };
      }

      if (!params.html && !params.text) {
        return {
          accepted: false,
          error: "Email content (html or text) is required",
        };
      }

      // Build email content
      const emailContent = {
        from: params.from || this.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text || this.stripHtml(params.html),
        replyTo: params.replyTo,
        attachments: params.attachments || [],
      };

      // For now, log instead of sending (mock implementation)
      console.log("Email channel - sending email:", {
        to: params.to,
        subject: params.subject,
        hasAttachments: (params.attachments || []).length > 0,
      });

      // In production, use nodemailer or SES:
      // const info = await this.nodeMailerInstance.sendMail(emailContent);
      // return {
      //   accepted: true,
      //   messageId: info.messageId,
      // };

      // Mock response for now
      const mockMessageId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return {
        accepted: true,
        messageId: mockMessageId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        accepted: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulk(emailsList: EmailParams[]): Promise<EmailResult[]> {
    const results: EmailResult[] = [];

    for (const email of emailsList) {
      const result = await this.sendEmail(email);
      results.push(result);

      // Add small delay between sends to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  /**
   * Build branded email template
   */
  static buildBrandedTemplate(
    title: string,
    content: string,
    footerText: string = "Witylogix - Last Mile Delivery Platform",
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; background: #f9fafb; }
          .header { background: #1f2937; padding: 24px; text-align: center; }
          .logo { font-size: 24px; font-weight: bold; color: #fff; }
          .content { padding: 32px; background: #fff; }
          .footer { padding: 24px; background: #f3f4f6; text-align: center; font-size: 12px; color: #6b7280; }
          h2 { color: #1f2937; margin-top: 0; }
          a { color: #3b82f6; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Witylogix</div>
          </div>
          <div class="content">
            <h2>${title}</h2>
            ${content}
          </div>
          <div class="footer">
            <p>${footerText}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
