/**
 * Template Engine — Tests
 */

import { describe, it, expect } from "vitest";
import { TemplateEngine } from "../template-engine.js";
import { TemplateVariables } from "../types.js";

describe("TemplateEngine", () => {
  describe("renderTemplate", () => {
    it("should render email template with variables", () => {
      const variables: TemplateVariables = {
        customerName: "John Doe",
        orderId: "ORD123",
        deliveryAddress: "123 Main St",
      };

      const template = TemplateEngine.renderTemplate(
        "order_confirmed",
        variables,
        "email",
      );

      expect(template.subject).toContain("Order Confirmed");
      expect(template.html).toContain("John Doe");
      expect(template.text).toContain("John Doe");
      expect(template.html).not.toContain("{{");
    });

    it("should render SMS template with variables", () => {
      const variables: TemplateVariables = {
        deliveryDate: "2026-03-12",
        timeWindow: "3:00pm-5:00pm",
        trackingUrl: "https://track.witylogix.com/abc123",
      };

      const template = TemplateEngine.renderTemplate(
        "delivery_scheduled",
        variables,
        "sms",
      );

      expect(template.text).toContain("2026-03-12");
      expect(template.text).toContain("3:00pm-5:00pm");
      expect(template.text).toContain("https://track.witylogix.com");
    });

    it("should render WhatsApp template", () => {
      const variables: TemplateVariables = {
        customerName: "Jane Doe",
        driverName: "Bob Driver",
        timeWindow: "2:00pm-4:00pm",
      };

      const template = TemplateEngine.renderTemplate(
        "out_for_delivery",
        variables,
        "whatsapp",
      );

      expect(template.templateId).toBe("out_for_delivery");
      expect(template.templateParams).toBeDefined();
      expect(template.templateParams?.length).toBeGreaterThan(0);
    });

    it("should render push template", () => {
      const variables: TemplateVariables = {
        customerName: "Mike User",
        deliveryDate: "2026-03-15",
      };

      const template = TemplateEngine.renderTemplate(
        "delivered",
        variables,
        "push",
      );

      expect(template.title).toContain("Delivered");
      expect(template.body).toBeDefined();
    });

    it("should handle missing variables gracefully", () => {
      const variables: TemplateVariables = {
        customerName: "John Doe",
        // Missing other variables
      };

      const template = TemplateEngine.renderTemplate(
        "delivery_scheduled",
        variables,
        "email",
      );

      expect(template.subject).toBeDefined();
      expect(template.html).toContain("John Doe");
      expect(template.html).not.toContain("{{");
    });

    it("should escape and remove uninterpolated placeholders", () => {
      const variables: TemplateVariables = {
        deliveryDate: "2026-03-15",
        // Missing timeWindow, trackingUrl
      };

      const template = TemplateEngine.renderTemplate(
        "delivery_scheduled",
        variables,
        "sms",
      );

      expect(template.text).toContain("2026-03-15");
      expect(template.text).not.toContain("{{");
    });
  });

  describe("Event Types", () => {
    const eventTypes = [
      "order_confirmed",
      "delivery_scheduled",
      "out_for_delivery",
      "delivery_arriving",
      "delivered",
      "delivery_failed",
      "rescheduled",
    ] as const;

    eventTypes.forEach((eventType) => {
      describe(`${eventType}`, () => {
        it(`should have valid templates for all channels`, () => {
          const variables: TemplateVariables = {
            customerName: "Test Customer",
            orderId: "ORD123",
            deliveryDate: "2026-03-15",
            timeWindow: "2:00pm-4:00pm",
            driverName: "John Driver",
            deliveryAddress: "123 Test St",
            trackingUrl: "https://track.example.com/123",
          };

          const channels = ["email", "sms", "whatsapp", "push"] as const;

          channels.forEach((channel) => {
            const template = TemplateEngine.renderTemplate(
              eventType,
              variables,
              channel,
            );

            expect(template).toBeDefined();

            if (channel === "email") {
              expect(template.subject).toBeDefined();
              expect(template.html).toBeDefined();
              expect(template.text).toBeDefined();
            } else if (channel === "sms") {
              expect(template.text).toBeDefined();
            } else if (channel === "whatsapp") {
              expect(template.templateId).toBeDefined();
            } else if (channel === "push") {
              expect(template.title).toBeDefined();
              expect(template.body).toBeDefined();
            }
          });
        });
      });
    });
  });

  describe("Variable Interpolation", () => {
    it("should handle multiple variable interpolations", () => {
      const variables: TemplateVariables = {
        customerName: "Alice",
        driverName: "Bob",
        timeWindow: "10:00am-12:00pm",
      };

      const template = TemplateEngine.renderTemplate(
        "out_for_delivery",
        variables,
        "email",
      );

      expect(template.html).toContain("Alice");
      expect(template.html).toContain("Bob");
      expect(template.html).toContain("10:00am-12:00pm");
    });

    it("should handle special characters in variables", () => {
      const variables: TemplateVariables = {
        customerName: "John & Jane's Place",
        deliveryAddress: "456 Oak St. #101 (Unit B)",
        driverName: "O'Brien",
      };

      const template = TemplateEngine.renderTemplate(
        "delivery_arriving",
        variables,
        "email",
      );

      expect(template.html).toContain("John & Jane's Place");
      expect(template.html).toContain("456 Oak St");
    });

    it("should handle unicode characters", () => {
      const variables: TemplateVariables = {
        customerName: "José García",
        deliveryAddress: "Calle Principal, España",
      };

      const template = TemplateEngine.renderTemplate(
        "order_confirmed",
        variables,
        "email",
      );

      expect(template.html).toContain("José García");
      expect(template.html).toContain("España");
    });
  });

  describe("WhatsApp Template Parameters", () => {
    it("should extract parameters in correct order", () => {
      const variables: TemplateVariables = {
        customerName: "John",
        deliveryDate: "2026-03-20",
        timeWindow: "1:00pm-3:00pm",
        deliveryAddress: "789 Main",
      };

      const template = TemplateEngine.renderTemplate(
        "delivery_scheduled",
        variables,
        "whatsapp",
      );

      expect(template.templateParams).toBeDefined();
      expect(template.templateParams?.length).toBeGreaterThan(0);
      // Parameters should be in order: customerName, deliveryDate, timeWindow, deliveryAddress
      if (template.templateParams) {
        expect(template.templateParams[0]).toBe("John");
      }
    });

    it("should filter out empty parameters", () => {
      const variables: TemplateVariables = {
        customerName: "Jane",
        // Missing other parameters
      };

      const template = TemplateEngine.renderTemplate(
        "rescheduled",
        variables,
        "whatsapp",
      );

      expect(template.templateParams).toBeDefined();
      // Should only contain non-empty values
      if (template.templateParams) {
        expect(template.templateParams.every((p) => p.length > 0)).toBe(true);
      }
    });
  });

  describe("getTemplate", () => {
    it("should retrieve template definition", () => {
      const template = TemplateEngine.getTemplate("order_confirmed");

      expect(template).toBeDefined();
      expect(template.email).toBeDefined();
      expect(template.sms).toBeDefined();
      expect(template.whatsapp).toBeDefined();
      expect(template.push).toBeDefined();
    });

    it("should throw for unknown event type", () => {
      expect(() => {
        TemplateEngine.getTemplate("unknown_event" as any);
      }).toThrow();
    });
  });

  describe("listEventTypes", () => {
    it("should list all available event types", () => {
      const eventTypes = TemplateEngine.listEventTypes();

      expect(eventTypes.length).toBeGreaterThan(0);
      expect(eventTypes).toContain("order_confirmed");
      expect(eventTypes).toContain("delivery_scheduled");
      expect(eventTypes).toContain("delivered");
    });
  });
});
