/**
 * WhatsApp Channel — Send WhatsApp messages via Meta Business API
 */

import { WhatsAppResult } from "../types.js";

/**
 * WhatsApp send parameters
 */
export interface WhatsAppParams {
  to: string;
  templateName: string;
  templateParams?: string[];
  mediaUrls?: {
    mapUrl?: string;
    driverPhotoUrl?: string;
  };
}

/**
 * WhatsApp message types
 */
export type WhatsAppTemplateType =
  | "order_confirmation"
  | "out_for_delivery"
  | "delivered"
  | "rescheduled"
  | "delivery_scheduled"
  | "delivery_arriving"
  | "delivery_failed";

/**
 * Template to template ID mapping for Meta approved templates
 */
const TEMPLATE_MAP: Record<WhatsAppTemplateType, string> = {
  order_confirmation: "order_confirmation_1",
  delivery_scheduled: "delivery_scheduled_1",
  out_for_delivery: "out_for_delivery_1",
  delivery_arriving: "delivery_arriving_1",
  delivered: "delivered_1",
  delivery_failed: "delivery_failed_1",
  rescheduled: "rescheduled_1",
};

/**
 * WhatsApp Channel — handles WhatsApp message sending
 */
export class WhatsAppChannel {
  private phoneNumberId: string;
  private accessToken: string;
  private metaClient?: any;
  private businessAccountId?: string;

  constructor(phoneNumberId: string, accessToken: string, metaClient?: any) {
    this.phoneNumberId = phoneNumberId;
    this.accessToken = accessToken;
    this.metaClient = metaClient;
  }

  /**
   * Send a WhatsApp message
   */
  async sendWhatsApp(params: WhatsAppParams): Promise<WhatsAppResult> {
    try {
      // Validate input
      if (!params.to) {
        return {
          accepted: false,
          error: "Phone number (to) is required",
        };
      }

      if (!params.templateName) {
        return {
          accepted: false,
          error: "Template name is required",
        };
      }

      // Validate template
      const templateId = TEMPLATE_MAP[params.templateName as WhatsAppTemplateType];
      if (!templateId) {
        return {
          accepted: false,
          error: `Unknown template: ${params.templateName}`,
        };
      }

      // Validate and format phone number
      const formattedPhone = this.formatPhoneNumber(params.to);
      if (!formattedPhone) {
        return {
          accepted: false,
          error: "Invalid phone number format",
        };
      }

      // For now, log instead of sending (mock implementation)
      console.log("WhatsApp channel - sending message:", {
        to: formattedPhone,
        template: params.templateName,
        paramsCount: params.templateParams?.length || 0,
        hasMedia: Boolean(params.mediaUrls),
      });

      // In production, use Meta Cloud API:
      // const response = await fetch(
      //   `https://graph.instagram.com/v18.0/${this.phoneNumberId}/messages`,
      //   {
      //     method: "POST",
      //     headers: {
      //       Authorization: `Bearer ${this.accessToken}`,
      //       "Content-Type": "application/json",
      //     },
      //     body: JSON.stringify(this.buildMessagePayload(formattedPhone, templateId, params)),
      //   }
      // );
      // const data = await response.json();
      // return {
      //   accepted: response.ok,
      //   messageId: data.messages?.[0]?.id,
      //   error: data.error?.message,
      // };

      // Mock response
      const mockMessageId = `wa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return {
        accepted: true,
        messageId: mockMessageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        accepted: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Build Meta Cloud API message payload
   */
  private buildMessagePayload(
    to: string,
    templateId: string,
    params: WhatsAppParams
  ): Record<string, any> {
    const payload: Record<string, any> = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: params.templateName,
        language: {
          code: "en_US",
        },
      },
    };

    // Add template parameters if provided
    if (params.templateParams && params.templateParams.length > 0) {
      payload.template.components = [
        {
          type: "body",
          parameters: params.templateParams.map((param) => ({
            type: "text",
            text: param,
          })),
        },
      ];

      // Add media if provided
      if (params.mediaUrls) {
        const mediaComponent: any = {
          type: "header",
          parameters: [],
        };

        if (params.mediaUrls.mapUrl) {
          mediaComponent.parameters.push({
            type: "document",
            document: {
              link: params.mediaUrls.mapUrl,
            },
          });
        }

        if (params.mediaUrls.driverPhotoUrl) {
          mediaComponent.parameters.push({
            type: "image",
            image: {
              link: params.mediaUrls.driverPhotoUrl,
            },
          });
        }

        if (mediaComponent.parameters.length > 0) {
          payload.template.components.unshift(mediaComponent);
        }
      }
    }

    return payload;
  }

  /**
   * Format phone number to WhatsApp format (11-15 digits, no special chars)
   */
  private formatPhoneNumber(phone: string): string | null {
    const cleaned = phone.replace(/\D/g, "");

    // Basic validation
    if (cleaned.length < 11 || cleaned.length > 15) {
      return null;
    }

    return cleaned;
  }

  /**
   * Check if phone number is WhatsApp-enabled
   * (In production, would call WhatsApp API to check)
   */
  async isPhoneNumberRegistered(phoneNumber: string): Promise<boolean> {
    try {
      const formatted = this.formatPhoneNumber(phoneNumber);
      if (!formatted) {
        return false;
      }

      // In production, call Meta API:
      // const response = await fetch(
      //   `https://graph.instagram.com/v18.0/${this.phoneNumberId}/contacts`,
      //   {
      //     method: "POST",
      //     headers: {
      //       Authorization: `Bearer ${this.accessToken}`,
      //       "Content-Type": "application/json",
      //     },
      //     body: JSON.stringify({ blocking: "wait", contacts: [formatted] }),
      //   }
      // );
      // const data = await response.json();
      // return data.contacts?.[0]?.wa_id === formatted;

      // Mock: always return true for testing
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send bulk WhatsApp messages
   */
  async sendBulk(messagesList: WhatsAppParams[]): Promise<WhatsAppResult[]> {
    const results: WhatsAppResult[] = [];

    for (const msg of messagesList) {
      const result = await this.sendWhatsApp(msg);
      results.push(result);

      // Add delay between sends
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Get available templates
   */
  static getAvailableTemplates(): WhatsAppTemplateType[] {
    return Object.keys(TEMPLATE_MAP) as WhatsAppTemplateType[];
  }

  /**
   * Get template ID for a template name
   */
  static getTemplateId(templateName: string): string | undefined {
    return TEMPLATE_MAP[templateName as WhatsAppTemplateType];
  }
}
