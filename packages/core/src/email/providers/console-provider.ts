/**
 * Console email provider for development
 * Logs emails to console instead of sending
 */

import type { EmailProvider, EmailMessage, EmailResult, EmailProviderType } from '../types.js';
import { EmailStatus } from '../types.js';

/**
 * Console-based email provider for development/testing
 * Logs emails to console with formatted output
 */
export class ConsoleEmailProvider implements EmailProvider {
  private provider: EmailProviderType = 'console';

  async send(message: EmailMessage): Promise<EmailResult> {
    const messageId = this.generateMessageId();
    const timestamp = new Date();

    console.log(
      '\n' +
        '═══════════════════════════════════════════════════════════════\n' +
        '                    EMAIL MESSAGE (CONSOLE)\n' +
        '═══════════════════════════════════════════════════════════════',
    );

    console.log(`ID: ${messageId}`);
    console.log(`From: ${message.from}`);
    console.log(`To: ${Array.isArray(message.to) ? message.to.join(', ') : message.to}`);

    if (message.cc) {
      console.log(`CC: ${Array.isArray(message.cc) ? message.cc.join(', ') : message.cc}`);
    }

    if (message.bcc) {
      console.log(`BCC: ${Array.isArray(message.bcc) ? message.bcc.join(', ') : message.bcc}`);
    }

    if (message.replyTo) {
      console.log(`Reply-To: ${message.replyTo}`);
    }

    console.log(`Subject: ${message.subject}`);
    console.log(`───────────────────────────────────────────────────────────────`);

    if (message.text) {
      console.log('TEXT:\n', message.text);
    }

    if (message.html) {
      console.log('HTML:\n', message.html);
    }

    if (message.attachments && message.attachments.length > 0) {
      console.log('\nAttachments:');
      message.attachments.forEach((att) => {
        const size = typeof att.content === 'string' ? att.content.length : att.content.length;
        console.log(`  - ${att.filename} (${att.contentType || 'application/octet-stream'}, ${size} bytes)`);
      });
    }

    if (message.metadata) {
      console.log('\nMetadata:', JSON.stringify(message.metadata, null, 2));
    }

    console.log(
      '═══════════════════════════════════════════════════════════════\n',
    );

    return {
      id: messageId,
      status: EmailStatus.SENT,
      provider: this.provider,
      timestamp,
    };
  }

  isConfigured(): boolean {
    return true;
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `console-${timestamp}-${random}`;
  }
}
