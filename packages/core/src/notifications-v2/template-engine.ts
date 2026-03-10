/**
 * Template Engine — Multi-channel notification templates with variable interpolation
 */

import { NotificationEventType, TemplateContent, TemplateVariables } from "./types.js";

/**
 * Template definitions per channel
 */
interface TemplateDefinition {
  email: {
    subject: string;
    html: string;
    text: string;
  };
  sms: {
    text: string;
  };
  whatsapp: {
    templateId: string;
    templateName: string;
  };
  push: {
    title: string;
    body: string;
  };
}

/**
 * Template library
 */
const TEMPLATES: Record<NotificationEventType, TemplateDefinition> = {
  order_confirmed: {
    email: {
      subject: "Order Confirmed - {{orderId}}",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>Order Confirmed</h2>
          <p>Hi {{customerName}},</p>
          <p>Your order has been confirmed and will be processed shortly.</p>
          <p><strong>Order Details:</strong></p>
          <ul>
            <li>Order ID: {{orderId}}</li>
            <li>Delivery Address: {{deliveryAddress}}</li>
          </ul>
          <p>You will receive tracking information shortly.</p>
          <p>Thank you!</p>
        </div>
      `,
      text: "Hi {{customerName}},\n\nYour order {{orderId}} has been confirmed.\n\nDelivery address: {{deliveryAddress}}\n\nThank you!",
    },
    sms: {
      text: "Order confirmed! Your delivery is on the way. Track it: {{trackingUrl}}",
    },
    whatsapp: {
      templateId: "order_confirmation",
      templateName: "order_confirmation",
    },
    push: {
      title: "Order Confirmed",
      body: "Your order {{orderId}} has been confirmed.",
    },
  },

  delivery_scheduled: {
    email: {
      subject: "Delivery Scheduled - {{deliveryDate}}",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>Delivery Scheduled</h2>
          <p>Hi {{customerName}},</p>
          <p>Your delivery is scheduled for {{deliveryDate}} between {{timeWindow}}.</p>
          <p><strong>Delivery Details:</strong></p>
          <ul>
            <li>Address: {{deliveryAddress}}</li>
            <li>Time Window: {{timeWindow}}</li>
          </ul>
          <p><a href="{{trackingUrl}}">Track your delivery</a></p>
        </div>
      `,
      text: "Your delivery is scheduled for {{deliveryDate}} between {{timeWindow}}. Track here: {{trackingUrl}}",
    },
    sms: {
      text: "Your delivery is scheduled for {{deliveryDate}} between {{timeWindow}}. Track: {{trackingUrl}}",
    },
    whatsapp: {
      templateId: "delivery_scheduled",
      templateName: "delivery_scheduled",
    },
    push: {
      title: "Delivery Scheduled",
      body: "Scheduled between {{timeWindow}} on {{deliveryDate}}",
    },
  },

  out_for_delivery: {
    email: {
      subject: "Out for Delivery",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>Out for Delivery</h2>
          <p>Hi {{customerName}},</p>
          <p>Your package is out for delivery today between {{timeWindow}}.</p>
          <p><strong>Driver:</strong> {{driverName}}</p>
          <p><a href="{{trackingUrl}}">Track in real-time</a></p>
        </div>
      `,
      text: "Your package is out for delivery between {{timeWindow}}. Driver: {{driverName}}. Track: {{trackingUrl}}",
    },
    sms: {
      text: "Your package is out for delivery! Driver: {{driverName}}. Track: {{trackingUrl}}",
    },
    whatsapp: {
      templateId: "out_for_delivery",
      templateName: "out_for_delivery",
    },
    push: {
      title: "Out for Delivery",
      body: "Driver {{driverName}} is on the way",
    },
  },

  delivery_arriving: {
    email: {
      subject: "Delivery Arriving Soon",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>Delivery Arriving Soon</h2>
          <p>Hi {{customerName}},</p>
          <p>Your delivery is arriving soon at {{deliveryAddress}}.</p>
          <p>Be ready to receive it!</p>
          <p><a href="{{trackingUrl}}">View tracking</a></p>
        </div>
      `,
      text: "Your delivery is arriving soon at {{deliveryAddress}}. Track: {{trackingUrl}}",
    },
    sms: {
      text: "Your delivery is arriving soon at {{deliveryAddress}}. Track: {{trackingUrl}}",
    },
    whatsapp: {
      templateId: "delivery_arriving",
      templateName: "delivery_arriving",
    },
    push: {
      title: "Arriving Soon",
      body: "Delivery arriving at {{deliveryAddress}}",
    },
  },

  delivered: {
    email: {
      subject: "Delivery Completed",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>Delivery Completed</h2>
          <p>Hi {{customerName}},</p>
          <p>Your delivery has been completed at {{deliveryAddress}}.</p>
          <p>Thank you for your order!</p>
        </div>
      `,
      text: "Your delivery has been completed. Thank you!",
    },
    sms: {
      text: "Your delivery has been completed. Thank you for your order!",
    },
    whatsapp: {
      templateId: "delivered",
      templateName: "delivered",
    },
    push: {
      title: "Delivered",
      body: "Your delivery has been completed",
    },
  },

  delivery_failed: {
    email: {
      subject: "Delivery Failed",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>Delivery Failed</h2>
          <p>Hi {{customerName}},</p>
          <p>Unfortunately, your delivery could not be completed.</p>
          <p>Please contact support for assistance.</p>
        </div>
      `,
      text: "Your delivery could not be completed. Please contact support.",
    },
    sms: {
      text: "Your delivery could not be completed. Please contact support.",
    },
    whatsapp: {
      templateId: "delivery_failed",
      templateName: "delivery_failed",
    },
    push: {
      title: "Delivery Failed",
      body: "Your delivery could not be completed",
    },
  },

  rescheduled: {
    email: {
      subject: "Delivery Rescheduled to {{deliveryDate}}",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>Delivery Rescheduled</h2>
          <p>Hi {{customerName}},</p>
          <p>Your delivery has been rescheduled to {{deliveryDate}} between {{timeWindow}}.</p>
          <p><a href="{{trackingUrl}}">Track your delivery</a></p>
        </div>
      `,
      text: "Your delivery has been rescheduled to {{deliveryDate}} between {{timeWindow}}. Track: {{trackingUrl}}",
    },
    sms: {
      text: "Your delivery has been rescheduled to {{deliveryDate}} between {{timeWindow}}.",
    },
    whatsapp: {
      templateId: "rescheduled",
      templateName: "rescheduled",
    },
    push: {
      title: "Delivery Rescheduled",
      body: "Now scheduled for {{deliveryDate}}",
    },
  },
};

/**
 * Template Engine for rendering notifications
 */
export class TemplateEngine {
  /**
   * Render a template for a specific event and channel
   */
  static renderTemplate(
    eventType: NotificationEventType,
    variables: TemplateVariables,
    channel: "email" | "sms" | "whatsapp" | "push"
  ): TemplateContent {
    const template = TEMPLATES[eventType];
    if (!template) {
      throw new Error(`Unknown event type: ${eventType}`);
    }

    switch (channel) {
      case "email": {
        const emailTemplate = template.email;
        return {
          subject: this.interpolate(emailTemplate.subject, variables),
          html: this.interpolate(emailTemplate.html, variables),
          text: this.interpolate(emailTemplate.text, variables),
        };
      }

      case "sms": {
        const smsTemplate = template.sms;
        return {
          text: this.interpolate(smsTemplate.text, variables),
        };
      }

      case "whatsapp": {
        const waTemplate = template.whatsapp;
        return {
          templateId: waTemplate.templateId,
          templateParams: this.extractTemplateParams(waTemplate.templateName, variables),
        };
      }

      case "push": {
        const pushTemplate = template.push;
        return {
          title: this.interpolate(pushTemplate.title, variables),
          body: this.interpolate(pushTemplate.body, variables),
        };
      }

      default:
        throw new Error(`Unknown channel: ${channel}`);
    }
  }

  /**
   * Interpolate variables in template text
   */
  private static interpolate(text: string, variables: TemplateVariables): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      if (value) {
        const placeholder = `{{${key}}}`;
        result = result.replace(new RegExp(placeholder, "g"), value);
      }
    }
    // Remove any remaining unreplaced placeholders
    result = result.replace(/{{[^}]+}}/g, "");
    return result;
  }

  /**
   * Extract template parameters in order for WhatsApp
   */
  private static extractTemplateParams(
    templateName: string,
    variables: TemplateVariables
  ): string[] {
    // WhatsApp template parameters in standard order based on template
    const paramMap: Record<string, string[]> = {
      order_confirmation: ["customerName", "orderId", "deliveryAddress"],
      delivery_scheduled: ["customerName", "deliveryDate", "timeWindow", "deliveryAddress"],
      out_for_delivery: ["customerName", "timeWindow", "driverName"],
      delivery_arriving: ["customerName", "deliveryAddress"],
      delivered: ["customerName"],
      delivery_failed: ["customerName"],
      rescheduled: ["customerName", "deliveryDate", "timeWindow"],
    };

    const keys = paramMap[templateName] || [];
    return keys
      .map((key) => variables[key] || "")
      .filter((v) => v.length > 0);
  }

  /**
   * Get all available templates for an event type
   */
  static getTemplate(eventType: NotificationEventType): TemplateDefinition {
    const template = TEMPLATES[eventType];
    if (!template) {
      throw new Error(`Unknown event type: ${eventType}`);
    }
    return template;
  }

  /**
   * List all available event types
   */
  static listEventTypes(): NotificationEventType[] {
    return Object.keys(TEMPLATES) as NotificationEventType[];
  }
}
