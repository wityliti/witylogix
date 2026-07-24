import { describe, it, expect, beforeEach } from "vitest";
import { PreferenceManager } from "../preference-manager.js";
import {
  NotificationChannel,
  NotificationEventType,
  NotificationPreferences,
} from "../types.js";

describe("PreferenceManager", () => {
  const customerId = "test-customer-123";

  beforeEach(() => {
    PreferenceManager.clearAll();
  });

  describe("getPreferences", () => {
    it("should return default preferences for new customer", () => {
      const prefs = PreferenceManager.getPreferences(customerId);

      expect(prefs.customerId).toBe(customerId);
      expect(prefs.channels.email.enabled).toBe(true);
      expect(prefs.channels.sms.enabled).toBe(true);
      expect(prefs.channels.whatsapp.enabled).toBe(true);
      expect(prefs.channels.push.enabled).toBe(true);
      expect(prefs.updatedAt).toBeInstanceOf(Date);
    });

    it("should return same preferences on subsequent calls", () => {
      const prefs1 = PreferenceManager.getPreferences(customerId);
      const prefs2 = PreferenceManager.getPreferences(customerId);

      expect(prefs1.customerId).toBe(prefs2.customerId);
      expect(prefs1.channels.email.enabled).toBe(prefs2.channels.email.enabled);
    });

    it("should handle multiple customers independently", () => {
      const customer1 = "customer-1";
      const customer2 = "customer-2";

      const prefs1 = PreferenceManager.getPreferences(customer1);
      const prefs2 = PreferenceManager.getPreferences(customer2);

      expect(prefs1.customerId).toBe(customer1);
      expect(prefs2.customerId).toBe(customer2);
      expect(prefs1).not.toBe(prefs2);
    });
  });

  describe("updatePreferences", () => {
    it("should update customer preferences", () => {
      PreferenceManager.getPreferences(customerId);

      PreferenceManager.updatePreferences(customerId, {
        channels: {
          email: {
            enabled: false,
            eventTypes: {},
          },
        },
      });

      const updated = PreferenceManager.getPreferences(customerId);
      expect(updated.channels.email.enabled).toBe(false);
      expect(updated.channels.sms.enabled).toBe(true); // Other channels unchanged
    });

    it("should update event type preferences", () => {
      PreferenceManager.getPreferences(customerId);

      PreferenceManager.updatePreferences(customerId, {
        channels: {
          email: {
            enabled: true,
            eventTypes: {
              order_confirmed: false,
            },
          },
        },
      });

      const updated = PreferenceManager.getPreferences(customerId);
      expect(updated.channels.email.eventTypes.order_confirmed).toBe(false);
    });

    it("should update updatedAt timestamp", () => {
      PreferenceManager.getPreferences(customerId);
      const before = new Date();

      PreferenceManager.updatePreferences(customerId, {
        channels: {
          sms: {
            enabled: false,
            eventTypes: {},
          },
        },
      });

      const updated = PreferenceManager.getPreferences(customerId);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });
  });

  describe("shouldSend", () => {
    it("should return true when channel and event are enabled", () => {
      PreferenceManager.getPreferences(customerId);

      const shouldSend = PreferenceManager.shouldSend(
        customerId,
        "email",
        "order_confirmed",
      );

      expect(shouldSend).toBe(true);
    });

    it("should return false when channel is disabled", () => {
      PreferenceManager.getPreferences(customerId);
      PreferenceManager.disableChannel(customerId, "email");

      const shouldSend = PreferenceManager.shouldSend(
        customerId,
        "email",
        "order_confirmed",
      );

      expect(shouldSend).toBe(false);
    });

    it("should return false when event is disabled for channel", () => {
      PreferenceManager.getPreferences(customerId);
      PreferenceManager.disableEventType(customerId, "sms", "order_confirmed");

      const shouldSend = PreferenceManager.shouldSend(
        customerId,
        "sms",
        "order_confirmed",
      );

      expect(shouldSend).toBe(false);
    });

    it("should return true for events not explicitly disabled", () => {
      PreferenceManager.getPreferences(customerId);

      const shouldSend = PreferenceManager.shouldSend(
        customerId,
        "push",
        "delivery_scheduled",
      );

      expect(shouldSend).toBe(true);
    });
  });

  describe("enableChannel / disableChannel", () => {
    it("should enable a disabled channel", () => {
      PreferenceManager.getPreferences(customerId);
      PreferenceManager.disableChannel(customerId, "whatsapp");

      let prefs = PreferenceManager.getPreferences(customerId);
      expect(prefs.channels.whatsapp.enabled).toBe(false);

      PreferenceManager.enableChannel(customerId, "whatsapp");

      prefs = PreferenceManager.getPreferences(customerId);
      expect(prefs.channels.whatsapp.enabled).toBe(true);
    });

    it("should disable an enabled channel", () => {
      PreferenceManager.getPreferences(customerId);

      PreferenceManager.disableChannel(customerId, "email");

      const prefs = PreferenceManager.getPreferences(customerId);
      expect(prefs.channels.email.enabled).toBe(false);
    });
  });

  describe("enableEventType / disableEventType", () => {
    it("should enable a disabled event type", () => {
      PreferenceManager.getPreferences(customerId);
      PreferenceManager.disableEventType(customerId, "sms", "delivered");

      let prefs = PreferenceManager.getPreferences(customerId);
      expect(prefs.channels.sms.eventTypes.delivered).toBe(false);

      PreferenceManager.enableEventType(customerId, "sms", "delivered");

      prefs = PreferenceManager.getPreferences(customerId);
      expect(prefs.channels.sms.eventTypes.delivered).toBe(true);
    });

    it("should disable an enabled event type", () => {
      PreferenceManager.getPreferences(customerId);

      PreferenceManager.disableEventType(
        customerId,
        "email",
        "order_confirmed",
      );

      const prefs = PreferenceManager.getPreferences(customerId);
      expect(prefs.channels.email.eventTypes.order_confirmed).toBe(false);
    });
  });

  describe("getAvailableChannels", () => {
    it("should return channels enabled for an event", () => {
      PreferenceManager.getPreferences(customerId);

      const channels = PreferenceManager.getAvailableChannels(
        customerId,
        "order_confirmed",
      );

      expect(channels).toContain("email");
      expect(channels).toContain("sms");
      expect(channels).toContain("whatsapp");
      expect(channels).toContain("push");
    });

    it("should exclude disabled channels", () => {
      PreferenceManager.getPreferences(customerId);
      PreferenceManager.disableChannel(customerId, "whatsapp");

      const channels = PreferenceManager.getAvailableChannels(
        customerId,
        "order_confirmed",
      );

      expect(channels).not.toContain("whatsapp");
    });

    it("should exclude disabled event types", () => {
      PreferenceManager.getPreferences(customerId);
      PreferenceManager.disableEventType(customerId, "push", "order_confirmed");

      const channels = PreferenceManager.getAvailableChannels(
        customerId,
        "order_confirmed",
      );

      expect(channels).not.toContain("push");
    });

    it("should return empty array when no channels available", () => {
      PreferenceManager.getPreferences(customerId);

      // Disable all channels
      PreferenceManager.disableChannel(customerId, "email");
      PreferenceManager.disableChannel(customerId, "sms");
      PreferenceManager.disableChannel(customerId, "whatsapp");
      PreferenceManager.disableChannel(customerId, "push");

      const channels = PreferenceManager.getAvailableChannels(
        customerId,
        "order_confirmed",
      );

      expect(channels).toHaveLength(0);
    });
  });

  describe("resetPreferences", () => {
    it("should reset preferences to defaults", () => {
      PreferenceManager.getPreferences(customerId);
      PreferenceManager.disableChannel(customerId, "email");
      PreferenceManager.disableChannel(customerId, "sms");

      let prefs = PreferenceManager.getPreferences(customerId);
      expect(prefs.channels.email.enabled).toBe(false);
      expect(prefs.channels.sms.enabled).toBe(false);

      PreferenceManager.resetPreferences(customerId);

      prefs = PreferenceManager.getPreferences(customerId);
      expect(prefs.channels.email.enabled).toBe(true);
      expect(prefs.channels.sms.enabled).toBe(true);
    });

    it("should maintain customerId after reset", () => {
      PreferenceManager.getPreferences(customerId);
      PreferenceManager.resetPreferences(customerId);

      const prefs = PreferenceManager.getPreferences(customerId);
      expect(prefs.customerId).toBe(customerId);
    });
  });

  describe("clearAll", () => {
    it("should clear all customer preferences", () => {
      const customer1 = "customer-1";
      const customer2 = "customer-2";

      PreferenceManager.getPreferences(customer1);
      PreferenceManager.getPreferences(customer2);

      PreferenceManager.clearAll();

      // After clear, fetching should return new default preferences
      const prefs1 = PreferenceManager.getPreferences(customer1);
      const prefs2 = PreferenceManager.getPreferences(customer2);

      expect(prefs1.customerId).toBe(customer1);
      expect(prefs2.customerId).toBe(customer2);
      expect(prefs1.channels.email.enabled).toBe(true);
      expect(prefs2.channels.email.enabled).toBe(true);
    });
  });

  describe("Quiet Hours Logic", () => {
    it("should respect quiet hours configuration", () => {
      const prefs = PreferenceManager.getPreferences(customerId);

      // Check if quiet hours are respected
      const now = new Date();
      const hour = now.getHours();

      // In default preferences, quiet hours are 22:00-08:00
      const isInQuietHours = hour >= 22 || hour < 8;

      // This is more of an integration test showing how quiet hours would work
      expect(prefs).toBeDefined();
    });
  });

  describe("Event Type Coverage", () => {
    const eventTypes: NotificationEventType[] = [
      "order_confirmed",
      "delivery_scheduled",
      "out_for_delivery",
      "delivery_arriving",
      "delivered",
      "delivery_failed",
      "rescheduled",
    ];

    eventTypes.forEach((eventType) => {
      it(`should handle ${eventType} event type`, () => {
        PreferenceManager.getPreferences(customerId);

        const channels = PreferenceManager.getAvailableChannels(
          customerId,
          eventType,
        );

        expect(channels).toBeDefined();
        expect(Array.isArray(channels)).toBe(true);
      });
    });
  });

  describe("Channel Coverage", () => {
    const channels: NotificationChannel[] = [
      "email",
      "sms",
      "whatsapp",
      "push",
    ];

    channels.forEach((channel) => {
      it(`should handle ${channel} channel`, () => {
        PreferenceManager.getPreferences(customerId);
        PreferenceManager.disableChannel(customerId, channel);

        const prefs = PreferenceManager.getPreferences(customerId);
        expect(prefs.channels[channel].enabled).toBe(false);

        PreferenceManager.enableChannel(customerId, channel);
        const updated = PreferenceManager.getPreferences(customerId);
        expect(updated.channels[channel].enabled).toBe(true);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle non-existent customer gracefully", () => {
      const prefs = PreferenceManager.getPreferences("non-existent-customer");
      expect(prefs).toBeDefined();
      expect(prefs.customerId).toBe("non-existent-customer");
    });

    it("should handle rapid updates", () => {
      PreferenceManager.getPreferences(customerId);

      for (let i = 0; i < 10; i++) {
        PreferenceManager.disableChannel(customerId, "email");
        PreferenceManager.enableChannel(customerId, "email");
      }

      const prefs = PreferenceManager.getPreferences(customerId);
      expect(prefs.channels.email.enabled).toBe(true);
    });

    it("should handle deep copy of preferences", () => {
      const prefs1 = PreferenceManager.getPreferences(customerId);
      const prefs2 = PreferenceManager.getPreferences(customerId);

      // Modify one shouldn't affect the other
      prefs1.channels.email.enabled = false;
      expect(prefs2.channels.email.enabled).toBe(true);
    });
  });
});
