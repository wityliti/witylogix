import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * WhatsApp Client Tests
 * Tests message types, error handling, webhook verification, and API calls
 */

type MessageType = 'text' | 'template' | 'media' | 'interactive';
type MediaType = 'image' | 'video' | 'audio' | 'document';

interface TextMessage {
  type: 'text';
  to: string;
  text: {
    preview_url?: boolean;
    body: string;
  };
}

interface TemplateMessage {
  type: 'template';
  to: string;
  template: {
    name: string;
    language: {
      code: string;
    };
    parameters?: {
      body: Array<{ type: string; text: string }>;
      header?: Array<{ type: string; [key: string]: any }>;
      footer?: Array<{ type: string; text: string }>;
    };
  };
}

interface MediaMessage {
  type: 'media';
  to: string;
  [key: string]: any;
  image?: { link: string; caption?: string };
  video?: { link: string; caption?: string };
  audio?: { link: string };
  document?: { link: string; filename?: string };
}

interface InteractiveMessage {
  type: 'interactive';
  to: string;
  interactive: {
    type: 'button' | 'list';
    body: {
      text: string;
    };
    action: {
      buttons?: Array<{ type: string; reply: { id: string; title: string } }>;
      button?: string;
      sections?: Array<{
        title: string;
        rows: Array<{ id: string; title: string; description?: string }>;
      }>;
    };
  };
}

type WhatsAppMessage = TextMessage | TemplateMessage | MediaMessage | InteractiveMessage;

interface WebhookEvent {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messages?: Array<any>;
        statuses?: Array<any>;
      };
    }>;
  }>;
}

class WhatsAppClient {
  private apiUrl = 'https://graph.instagram.com/v18.0';
  private phoneNumberId: string;
  private businessAccountId: string;
  private accessToken: string;
  private webhookVerifyToken: string;

  constructor(
    phoneNumberId: string,
    businessAccountId: string,
    accessToken: string,
    webhookVerifyToken: string
  ) {
    this.phoneNumberId = phoneNumberId;
    this.businessAccountId = businessAccountId;
    this.accessToken = accessToken;
    this.webhookVerifyToken = webhookVerifyToken;
  }

  async sendTextMessage(to: string, text: string, previewUrl = false): Promise<any> {
    const message: TextMessage = {
      type: 'text',
      to,
      text: {
        body: text,
        ...(previewUrl && { preview_url: true }),
      },
    };
    return this.sendMessage(message);
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode = 'en_US',
    parameters?: any
  ): Promise<any> {
    const message: TemplateMessage = {
      type: 'template',
      to,
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(parameters && { parameters }),
      },
    };
    return this.sendMessage(message);
  }

  async sendMediaMessage(
    to: string,
    mediaType: MediaType,
    mediaUrl: string,
    caption?: string,
    filename?: string
  ): Promise<any> {
    const message: MediaMessage = {
      type: 'media',
      to,
    };

    switch (mediaType) {
      case 'image':
        message.image = { link: mediaUrl, ...(caption && { caption }) };
        break;
      case 'video':
        message.video = { link: mediaUrl, ...(caption && { caption }) };
        break;
      case 'audio':
        message.audio = { link: mediaUrl };
        break;
      case 'document':
        message.document = { link: mediaUrl, ...(filename && { filename }) };
        break;
    }

    return this.sendMessage(message);
  }

  async sendInteractiveMessage(
    to: string,
    type: 'button' | 'list',
    bodyText: string,
    buttons?: Array<{ id: string; title: string }>,
    sections?: Array<{ title: string; rows: Array<{ id: string; title: string }> }>
  ): Promise<any> {
    const message: InteractiveMessage = {
      type: 'interactive',
      to,
      interactive: {
        type,
        body: { text: bodyText },
        action: {},
      },
    };

    if (type === 'button' && buttons) {
      message.interactive.action.buttons = buttons.map((btn) => ({
        type: 'reply',
        reply: { id: btn.id, title: btn.title },
      }));
    } else if (type === 'list' && sections) {
      message.interactive.action.button = 'Menu';
      message.interactive.action.sections = sections;
    }

    return this.sendMessage(message);
  }

  private async sendMessage(message: WhatsAppMessage): Promise<any> {
    const endpoint = `${this.apiUrl}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      ...message,
    };

    try {
      const response = await this.makeRequest('POST', endpoint, payload);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private async makeRequest(method: string, url: string, data?: any): Promise<any> {
    const options: any = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const responseData = await response.json();

    if (!response.ok) {
      throw {
        status: response.status,
        data: responseData,
      };
    }

    return responseData;
  }

  private handleError(error: any): Error {
    if (error.status === 401) {
      return new Error('Unauthorized: Invalid access token');
    } else if (error.status === 429) {
      return new Error('Rate limited: Too many requests');
    } else if (error.status === 400) {
      const message = error.data?.error?.message || 'Bad request';
      return new Error(`Bad request: ${message}`);
    } else if (error.status >= 500) {
      return new Error('Server error: WhatsApp API is unavailable');
    }
    return new Error(`API error: ${error.message}`);
  }

  verifyWebhookSignature(
    signature: string,
    timestamp: string,
    body: string
  ): boolean {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', this.webhookVerifyToken);
    hmac.update(`${timestamp}.${body}`);
    const expectedSignature = hmac.digest('hex');
    return expectedSignature === signature;
  }

  parseWebhookEvent(body: WebhookEvent): any[] {
    const messages: any[] = [];

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.value.messages) {
          messages.push(...change.value.messages);
        }
      }
    }

    return messages;
  }
}

describe('WhatsAppClient', () => {
  let client: WhatsAppClient;

  beforeEach(() => {
    client = new WhatsAppClient(
      'phone123',
      'business456',
      'access_token_xyz',
      'webhook_verify_token'
    );
    global.fetch = vi.fn();
  });

  describe('Text Message', () => {
    it('should send text message', async () => {
      const mockResponse = {
        messages: [{ id: 'msg_123' }],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.sendTextMessage('+1234567890', 'Hello World');
      expect(result).toEqual(mockResponse);
    });

    it('should send text with preview URL', async () => {
      const mockResponse = { messages: [{ id: 'msg_124' }] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.sendTextMessage(
        '+1234567890',
        'Visit https://example.com',
        true
      );
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle text message errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'Invalid phone number' },
        }),
      });

      await expect(client.sendTextMessage('+invalid', 'Test')).rejects.toThrow(
        'Bad request'
      );
    });
  });

  describe('Template Message', () => {
    it('should send template message', async () => {
      const mockResponse = { messages: [{ id: 'msg_125' }] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.sendTemplateMessage(
        '+1234567890',
        'order_confirmation'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should send template with parameters', async () => {
      const mockResponse = { messages: [{ id: 'msg_126' }] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const parameters = {
        body: [
          { type: 'text', text: 'Order 123' },
          { type: 'text', text: '$99.99' },
        ],
      };

      const result = await client.sendTemplateMessage(
        '+1234567890',
        'order_confirmation',
        'en_US',
        parameters
      );
      expect(result).toEqual(mockResponse);
    });

    it('should use default language code', async () => {
      const mockResponse = { messages: [{ id: 'msg_127' }] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await client.sendTemplateMessage('+1234567890', 'welcome_template');
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Media Message', () => {
    it('should send image message', async () => {
      const mockResponse = { messages: [{ id: 'msg_128' }] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.sendMediaMessage(
        '+1234567890',
        'image',
        'https://example.com/image.jpg'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should send image with caption', async () => {
      const mockResponse = { messages: [{ id: 'msg_129' }] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.sendMediaMessage(
        '+1234567890',
        'image',
        'https://example.com/image.jpg',
        'Product Image'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should send video message', async () => {
      const mockResponse = { messages: [{ id: 'msg_130' }] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.sendMediaMessage(
        '+1234567890',
        'video',
        'https://example.com/video.mp4'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should send audio message', async () => {
      const mockResponse = { messages: [{ id: 'msg_131' }] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.sendMediaMessage(
        '+1234567890',
        'audio',
        'https://example.com/audio.mp3'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should send document message with filename', async () => {
      const mockResponse = { messages: [{ id: 'msg_132' }] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.sendMediaMessage(
        '+1234567890',
        'document',
        'https://example.com/invoice.pdf',
        undefined,
        'invoice.pdf'
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Interactive Message', () => {
    it('should send button message', async () => {
      const mockResponse = { messages: [{ id: 'msg_133' }] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const buttons = [
        { id: 'btn_yes', title: 'Yes' },
        { id: 'btn_no', title: 'No' },
      ];

      const result = await client.sendInteractiveMessage(
        '+1234567890',
        'button',
        'Do you confirm your order?',
        buttons
      );
      expect(result).toEqual(mockResponse);
    });

    it('should send list message', async () => {
      const mockResponse = { messages: [{ id: 'msg_134' }] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const sections = [
        {
          title: 'Products',
          rows: [
            { id: 'prod_1', title: 'Product A' },
            { id: 'prod_2', title: 'Product B' },
          ],
        },
      ];

      const result = await client.sendInteractiveMessage(
        '+1234567890',
        'list',
        'Choose a product',
        undefined,
        sections
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 unauthorized error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid token' } }),
      });

      await expect(client.sendTextMessage('+1234567890', 'Test')).rejects.toThrow(
        'Unauthorized'
      );
    });

    it('should handle 429 rate limit error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limited' } }),
      });

      await expect(client.sendTextMessage('+1234567890', 'Test')).rejects.toThrow(
        'Rate limited'
      );
    });

    it('should handle 400 bad request error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid phone number' } }),
      });

      await expect(client.sendTextMessage('+invalid', 'Test')).rejects.toThrow(
        'Bad request'
      );
    });

    it('should handle 500 server error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } }),
      });

      await expect(client.sendTextMessage('+1234567890', 'Test')).rejects.toThrow(
        'Server error'
      );
    });
  });

  describe('Webhook Signature Verification', () => {
    it('should verify valid webhook signature', () => {
      const timestamp = '1234567890';
      const body = '{"object":"whatsapp_business_account"}';
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', 'webhook_verify_token');
      hmac.update(`${timestamp}.${body}`);
      const validSignature = hmac.digest('hex');

      const isValid = client.verifyWebhookSignature(validSignature, timestamp, body);
      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const timestamp = '1234567890';
      const body = '{"object":"whatsapp_business_account"}';
      const invalidSignature = 'invalid_signature';

      const isValid = client.verifyWebhookSignature(invalidSignature, timestamp, body);
      expect(isValid).toBe(false);
    });

    it('should handle signature verification with different data', () => {
      const timestamp = '1234567890';
      const body1 = '{"object":"whatsapp_business_account"}';
      const body2 = '{"object":"other"}';

      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', 'webhook_verify_token');
      hmac.update(`${timestamp}.${body1}`);
      const sig1 = hmac.digest('hex');

      // sig1 should work with body1
      expect(client.verifyWebhookSignature(sig1, timestamp, body1)).toBe(true);
      // sig1 should not work with body2
      expect(client.verifyWebhookSignature(sig1, timestamp, body2)).toBe(false);
    });
  });

  describe('Webhook Event Parsing', () => {
    it('should parse webhook event with messages', () => {
      const event: WebhookEvent = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry_1',
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '+1234567890',
                      id: 'msg_1',
                      text: { body: 'Hello' },
                      type: 'text',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const messages = client.parseWebhookEvent(event);
      expect(messages).toHaveLength(1);
      expect(messages[0].text.body).toBe('Hello');
    });

    it('should handle empty webhook event', () => {
      const event: WebhookEvent = {
        object: 'whatsapp_business_account',
        entry: [],
      };

      const messages = client.parseWebhookEvent(event);
      expect(messages).toHaveLength(0);
    });

    it('should parse webhook with multiple messages', () => {
      const event: WebhookEvent = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry_1',
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '+1234567890',
                      id: 'msg_1',
                      text: { body: 'Hello' },
                      type: 'text',
                    },
                    {
                      from: '+1234567890',
                      id: 'msg_2',
                      text: { body: 'World' },
                      type: 'text',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const messages = client.parseWebhookEvent(event);
      expect(messages).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty phone number', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid phone number' } }),
      });

      await expect(client.sendTextMessage('', 'Test')).rejects.toThrow('Bad request');
    });

    it('should handle very long messages', async () => {
      const longMessage = 'a'.repeat(4096);
      const mockResponse = { messages: [{ id: 'msg_135' }] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.sendTextMessage('+1234567890', longMessage);
      expect(result).toEqual(mockResponse);
    });

    it('should handle special characters in messages', async () => {
      const specialMessage = 'Hello 👋 & goodbye 👋!';
      const mockResponse = { messages: [{ id: 'msg_136' }] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.sendTextMessage('+1234567890', specialMessage);
      expect(result).toEqual(mockResponse);
    });
  });
});
