/**
 * WhatsApp Cloud API Client
 * Handles all WhatsApp messaging operations using Meta Cloud API
 */

import {
  WhatsAppConfig,
  WhatsAppMessage,
  WhatsAppMedia,
  WhatsAppInteractive,
  WhatsAppTemplate,
  WhatsAppApiResponse,
  MessageStatus,
  MessageStatusEvent,
} from './types';

/**
 * WhatsApp client for sending messages via Meta Cloud API
 */
export class WhatsAppClient {
  private config: WhatsAppConfig;
  private readonly apiVersion = 'v18.0';

  constructor(config: WhatsAppConfig) {
    this.validateConfig(config);
    this.config = config;
  }

  /**
   * Validate configuration on initialization
   */
  private validateConfig(config: WhatsAppConfig): void {
    if (!config.apiUrl) throw new Error('apiUrl is required');
    if (!config.accessToken) throw new Error('accessToken is required');
    if (!config.phoneNumberId) throw new Error('phoneNumberId is required');
    if (!config.businessAccountId) throw new Error('businessAccountId is required');
  }

  /**
   * Build API endpoint URL
   */
  private getEndpoint(path: string): string {
    const baseUrl = this.config.apiUrl.replace(/\/$/, '');
    return `${baseUrl}/${this.apiVersion}/${path}`;
  }

  /**
   * Build authorization header
   */
  private getAuthHeader(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make API request to WhatsApp Cloud API
   */
  private async request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, unknown>
  ): Promise<WhatsAppApiResponse> {
    const url = this.getEndpoint(path);
    const options: RequestInit = {
      method,
      headers: this.getAuthHeader(),
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = (await response.json()) as WhatsAppApiResponse;

    if (!response.ok) {
      throw new Error(
        `WhatsApp API Error: ${data.error?.message || response.statusText}`
      );
    }

    return data;
  }

  /**
   * Send a text message
   * @param to - Recipient phone number with country code (e.g., +1234567890)
   * @param text - Message text content
   * @returns Promise with message ID
   */
  async sendTextMessage(to: string, text: string): Promise<string> {
    if (!to || !text) {
      throw new Error('to and text are required');
    }

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      },
    };

    const response = await this.request(
      'POST',
      `${this.config.phoneNumberId}/messages`,
      body
    );

    if (!response.messages?.[0]?.id) {
      throw new Error('Failed to send text message: No message ID returned');
    }

    return response.messages[0].id;
  }

  /**
   * Send a template message
   * @param to - Recipient phone number with country code
   * @param templateName - Template name
   * @param parameters - Template variables to fill in template body
   * @param languageCode - Language code (default: 'en')
   * @returns Promise with message ID
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    parameters?: Record<string, string>,
    languageCode?: string
  ): Promise<string> {
    if (!to || !templateName) {
      throw new Error('to and templateName are required');
    }

    const lang = languageCode || 'en';
    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: lang,
        },
      },
    };

    // Add parameters if provided
    if (parameters && Object.keys(parameters).length > 0) {
      const paramValues = Object.values(parameters).map((value) => ({
        type: 'text',
        text: value,
      }));

      (body.template as Record<string, unknown>).components = [
        {
          type: 'body',
          parameters: paramValues,
        },
      ];
    }

    const response = await this.request(
      'POST',
      `${this.config.phoneNumberId}/messages`,
      body
    );

    if (!response.messages?.[0]?.id) {
      throw new Error('Failed to send template message: No message ID returned');
    }

    return response.messages[0].id;
  }

  /**
   * Send a media message (image, video, document, audio)
   * @param to - Recipient phone number with country code
   * @param mediaUrl - URL to the media file
   * @param mediaType - Type of media: image, document, video, audio
   * @param caption - Optional caption for the media
   * @returns Promise with message ID
   */
  async sendMediaMessage(
    to: string,
    mediaUrl: string,
    mediaType: 'image' | 'document' | 'video' | 'audio' = 'image',
    caption?: string
  ): Promise<string> {
    if (!to || !mediaUrl) {
      throw new Error('to and mediaUrl are required');
    }

    const mediaPayload: Record<string, unknown> = {
      link: mediaUrl,
    };

    if (caption && (mediaType === 'image' || mediaType === 'video')) {
      (mediaPayload as Record<string, unknown>).caption = caption;
    }

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: mediaType,
      [mediaType]: mediaPayload,
    };

    const response = await this.request(
      'POST',
      `${this.config.phoneNumberId}/messages`,
      body
    );

    if (!response.messages?.[0]?.id) {
      throw new Error('Failed to send media message: No message ID returned');
    }

    return response.messages[0].id;
  }

  /**
   * Send an interactive message with buttons
   * @param to - Recipient phone number with country code
   * @param body - Message body text
   * @param buttons - Array of buttons with id and title
   * @param header - Optional header text
   * @param footer - Optional footer text
   * @returns Promise with message ID
   */
  async sendInteractiveMessage(
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
    header?: string,
    footer?: string
  ): Promise<string> {
    if (!to || !body || !buttons || buttons.length === 0) {
      throw new Error('to, body, and buttons are required');
    }

    if (buttons.length > 3) {
      throw new Error('Maximum 3 buttons allowed per message');
    }

    const interactive: Record<string, unknown> = {
      type: 'button',
      body: {
        text: body,
      },
      action: {
        buttons: buttons.map((btn) => ({
          type: 'reply',
          reply: {
            id: btn.id,
            title: btn.title,
          },
        })),
      },
    };

    if (header) {
      (interactive as Record<string, unknown>).header = {
        type: 'text',
        text: header,
      };
    }

    if (footer) {
      (interactive as Record<string, unknown>).footer = {
        text: footer,
      };
    }

    const messageBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    };

    const response = await this.request(
      'POST',
      `${this.config.phoneNumberId}/messages`,
      messageBody
    );

    if (!response.messages?.[0]?.id) {
      throw new Error('Failed to send interactive message: No message ID returned');
    }

    return response.messages[0].id;
  }

  /**
   * Send a list message (interactive list)
   * @param to - Recipient phone number with country code
   * @param body - Message body text
   * @param sections - Array of list sections with rows
   * @param header - Optional header text
   * @param footer - Optional footer text
   * @param buttonText - Text for the action button
   * @returns Promise with message ID
   */
  async sendListMessage(
    to: string,
    body: string,
    sections: Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    header?: string,
    footer?: string,
    buttonText: string = 'Select'
  ): Promise<string> {
    if (!to || !body || !sections || sections.length === 0) {
      throw new Error('to, body, and sections are required');
    }

    const interactive: Record<string, unknown> = {
      type: 'list',
      body: {
        text: body,
      },
      action: {
        button: buttonText,
        sections: sections,
      },
    };

    if (header) {
      (interactive as Record<string, unknown>).header = {
        type: 'text',
        text: header,
      };
    }

    if (footer) {
      (interactive as Record<string, unknown>).footer = {
        text: footer,
      };
    }

    const messageBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    };

    const response = await this.request(
      'POST',
      `${this.config.phoneNumberId}/messages`,
      messageBody
    );

    if (!response.messages?.[0]?.id) {
      throw new Error('Failed to send list message: No message ID returned');
    }

    return response.messages[0].id;
  }

  /**
   * Get message status
   * @param messageId - Message ID to check
   * @returns Promise with message status event
   */
  async getMessageStatus(messageId: string): Promise<MessageStatusEvent> {
    if (!messageId) {
      throw new Error('messageId is required');
    }

    // Note: Meta API doesn't provide a direct status lookup endpoint
    // Status is typically received via webhooks
    // This method serves as a placeholder for future implementation
    // or integration with a local message store

    throw new Error(
      'Message status lookup not available. Use webhook for status updates.'
    );
  }

  /**
   * Mark a message as read
   * @param messageId - Message ID to mark as read
   */
  async markAsRead(messageId: string): Promise<void> {
    if (!messageId) {
      throw new Error('messageId is required');
    }

    const body = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };

    await this.request('POST', `${this.config.phoneNumberId}/messages`, body);
  }

  /**
   * Get media URL from media object ID
   * @param mediaId - Media object ID
   * @returns Promise with media URL and metadata
   */
  async getMediaUrl(
    mediaId: string
  ): Promise<{ url: string; mime_type: string }> {
    if (!mediaId) {
      throw new Error('mediaId is required');
    }

    const response = await this.request('GET', mediaId);

    if (!response.error && (response as Record<string, unknown>).url) {
      return {
        url: (response as Record<string, unknown>).url as string,
        mime_type: (response as Record<string, unknown>).mime_type as string,
      };
    }

    throw new Error('Failed to retrieve media URL');
  }

  /**
   * Upload media for reusable use
   * @param mediaPath - Path to media file
   * @param mediaType - Type of media: image, document, video, audio
   * @returns Promise with media ID
   */
  async uploadMedia(
    mediaPath: string,
    mediaType: 'image' | 'document' | 'video' | 'audio'
  ): Promise<string> {
    if (!mediaPath || !mediaType) {
      throw new Error('mediaPath and mediaType are required');
    }

    // This would typically use FormData for file upload
    // Implementation depends on runtime environment
    throw new Error('Media upload requires FormData support');
  }

  /**
   * Get client configuration
   */
  getConfig(): WhatsAppConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<WhatsAppConfig>): void {
    this.config = { ...this.config, ...config };
    this.validateConfig(this.config);
  }
}
