/**
 * Notification Preference Tests
 * Tests customer preference CRUD, unsubscribe flow, quiet hours,
 * channel management, and marketing consent
 */

import { describe, it, expect, beforeEach } from "vitest";

interface NotificationPreference {
  customerId: string;
  email: string;
  channels: {
    email: boolean;
    sms: boolean;
    push: boolean;
    whatsapp: boolean;
  };
  preferences: {
    orderConfirmation: boolean;
    orderUpdates: boolean;
    delivery: boolean;
    promotions: boolean;
    newsletters: boolean;
  };
  quietHours?: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string;
  };
  marketingConsent: {
    agreed: boolean;
    agreedAt?: Date;
    version: number;
  };
  unsubscribed: boolean;
  unsubscribedAt?: Date;
  unsubscribeReason?: string;
}

/**
 * Mock Notification Preference Service
 */
class NotificationPreferenceService {
  private preferences = new Map<string, NotificationPreference>();

  createPreference(customerId: string, email: string): NotificationPreference {
    const preference: NotificationPreference = {
      customerId,
      email,
      channels: {
        email: true,
        sms: false,
        push: false,
        whatsapp: false,
      },
      preferences: {
        orderConfirmation: true,
        orderUpdates: true,
        delivery: true,
        promotions: true,
        newsletters: true,
      },
      marketingConsent: {
        agreed: true,
        agreedAt: new Date(),
        version: 1,
      },
      unsubscribed: false,
    };

    this.preferences.set(customerId, preference);
    return preference;
  }

  getPreference(customerId: string): NotificationPreference | undefined {
    return this.preferences.get(customerId);
  }

  updateChannels(
    customerId: string,
    channels: Partial<NotificationPreference["channels"]>,
  ): NotificationPreference {
    const pref = this.getPreference(customerId);
    if (!pref) throw new Error("Preference not found");

    Object.assign(pref.channels, channels);
    return pref;
  }

  updateNotificationTypes(
    customerId: string,
    preferences: Partial<NotificationPreference["preferences"]>,
  ): NotificationPreference {
    const pref = this.getPreference(customerId);
    if (!pref) throw new Error("Preference not found");

    Object.assign(pref.preferences, preferences);
    return pref;
  }

  setQuietHours(
    customerId: string,
    enabled: boolean,
    startTime?: string,
    endTime?: string,
  ): NotificationPreference {
    const pref = this.getPreference(customerId);
    if (!pref) throw new Error("Preference not found");

    if (enabled && (!startTime || !endTime)) {
      throw new Error("Start and end time required for quiet hours");
    }

    if (!pref.quietHours) {
      pref.quietHours = {
        enabled: false,
        startTime: "22:00",
        endTime: "08:00",
      };
    }

    pref.quietHours.enabled = enabled;
    if (startTime) pref.quietHours.startTime = startTime;
    if (endTime) pref.quietHours.endTime = endTime;

    return pref;
  }

  isInQuietHours(customerId: string, currentTime: Date): boolean {
    const pref = this.getPreference(customerId);
    if (!pref || !pref.quietHours || !pref.quietHours.enabled) return false;

    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const currentTimeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

    const [startHour, startMin] = pref.quietHours.startTime
      .split(":")
      .map(Number);
    const [endHour, endMin] = pref.quietHours.endTime.split(":").map(Number);

    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;
    const currentTotal = hours * 60 + minutes;

    if (startTotal <= endTotal) {
      return currentTotal >= startTotal && currentTotal < endTotal;
    } else {
      // Quiet hours span midnight
      return currentTotal >= startTotal || currentTotal < endTotal;
    }
  }

  unsubscribe(customerId: string, reason?: string): NotificationPreference {
    const pref = this.getPreference(customerId);
    if (!pref) throw new Error("Preference not found");

    pref.unsubscribed = true;
    pref.unsubscribedAt = new Date();
    pref.unsubscribeReason = reason;
    pref.preferences = {
      orderConfirmation: false,
      orderUpdates: false,
      delivery: false,
      promotions: false,
      newsletters: false,
    };

    return pref;
  }

  resubscribe(customerId: string): NotificationPreference {
    const pref = this.getPreference(customerId);
    if (!pref) throw new Error("Preference not found");

    pref.unsubscribed = false;
    pref.unsubscribedAt = undefined;
    pref.unsubscribeReason = undefined;
    pref.preferences = {
      orderConfirmation: true,
      orderUpdates: true,
      delivery: true,
      promotions: true,
      newsletters: true,
    };

    return pref;
  }

  updateMarketingConsent(
    customerId: string,
    agreed: boolean,
  ): NotificationPreference {
    const pref = this.getPreference(customerId);
    if (!pref) throw new Error("Preference not found");

    pref.marketingConsent = {
      agreed,
      agreedAt: agreed ? new Date() : pref.marketingConsent.agreedAt,
      version: pref.marketingConsent.version + 1,
    };

    if (!agreed) {
      pref.preferences.promotions = false;
      pref.preferences.newsletters = false;
    }

    return pref;
  }

  canSend(
    customerId: string,
    notificationType: keyof NotificationPreference["preferences"],
    channel: keyof NotificationPreference["channels"],
    currentTime: Date,
  ): boolean {
    const pref = this.getPreference(customerId);
    if (!pref || pref.unsubscribed) return false;
    if (!pref.channels[channel]) return false;
    if (!pref.preferences[notificationType]) return false;
    if (this.isInQuietHours(customerId, currentTime)) return false;

    return true;
  }

  deletePreference(customerId: string): boolean {
    return this.preferences.delete(customerId);
  }
}

describe("NotificationPreferenceService", () => {
  let service: NotificationPreferenceService;

  beforeEach(() => {
    service = new NotificationPreferenceService();
  });

  describe("CRUD Operations", () => {
    it("should create preference for customer", () => {
      const pref = service.createPreference("cust_123", "john@example.com");

      expect(pref.customerId).toBe("cust_123");
      expect(pref.email).toBe("john@example.com");
      expect(pref.unsubscribed).toBe(false);
      expect(pref.marketingConsent.agreed).toBe(true);
    });

    it("should retrieve preference", () => {
      service.createPreference("cust_123", "john@example.com");

      const pref = service.getPreference("cust_123");

      expect(pref).toBeDefined();
      expect(pref?.email).toBe("john@example.com");
    });

    it("should return undefined for non-existent preference", () => {
      const pref = service.getPreference("nonexistent");

      expect(pref).toBeUndefined();
    });

    it("should delete preference", () => {
      service.createPreference("cust_123", "john@example.com");

      const deleted = service.deletePreference("cust_123");

      expect(deleted).toBe(true);
      expect(service.getPreference("cust_123")).toBeUndefined();
    });

    it("should return false when deleting non-existent preference", () => {
      const deleted = service.deletePreference("nonexistent");

      expect(deleted).toBe(false);
    });

    it("should set default enabled channels", () => {
      const pref = service.createPreference("cust_123", "john@example.com");

      expect(pref.channels.email).toBe(true);
      expect(pref.channels.sms).toBe(false);
      expect(pref.channels.push).toBe(false);
      expect(pref.channels.whatsapp).toBe(false);
    });
  });

  describe("Channel Management", () => {
    beforeEach(() => {
      service.createPreference("cust_123", "john@example.com");
    });

    it("should enable SMS channel", () => {
      const updated = service.updateChannels("cust_123", { sms: true });

      expect(updated.channels.sms).toBe(true);
      expect(updated.channels.email).toBe(true);
    });

    it("should disable email channel", () => {
      const updated = service.updateChannels("cust_123", { email: false });

      expect(updated.channels.email).toBe(false);
    });

    it("should enable multiple channels", () => {
      const updated = service.updateChannels("cust_123", {
        sms: true,
        push: true,
        whatsapp: true,
      });

      expect(updated.channels.sms).toBe(true);
      expect(updated.channels.push).toBe(true);
      expect(updated.channels.whatsapp).toBe(true);
      expect(updated.channels.email).toBe(true);
    });

    it("should preserve other channels when updating", () => {
      service.updateChannels("cust_123", { sms: true, push: true });

      const updated = service.updateChannels("cust_123", { whatsapp: true });

      expect(updated.channels.sms).toBe(true);
      expect(updated.channels.push).toBe(true);
      expect(updated.channels.whatsapp).toBe(true);
    });
  });

  describe("Notification Type Preferences", () => {
    beforeEach(() => {
      service.createPreference("cust_123", "john@example.com");
    });

    it("should disable order updates", () => {
      const updated = service.updateNotificationTypes("cust_123", {
        orderUpdates: false,
      });

      expect(updated.preferences.orderUpdates).toBe(false);
      expect(updated.preferences.orderConfirmation).toBe(true);
    });

    it("should disable promotional emails", () => {
      const updated = service.updateNotificationTypes("cust_123", {
        promotions: false,
      });

      expect(updated.preferences.promotions).toBe(false);
    });

    it("should disable newsletters", () => {
      const updated = service.updateNotificationTypes("cust_123", {
        newsletters: false,
      });

      expect(updated.preferences.newsletters).toBe(false);
    });

    it("should allow selective disabling", () => {
      service.updateNotificationTypes("cust_123", {
        promotions: false,
        newsletters: false,
      });

      const pref = service.getPreference("cust_123")!;

      expect(pref.preferences.promotions).toBe(false);
      expect(pref.preferences.newsletters).toBe(false);
      expect(pref.preferences.delivery).toBe(true);
    });
  });

  describe("Quiet Hours", () => {
    beforeEach(() => {
      service.createPreference("cust_123", "john@example.com");
    });

    it("should enable quiet hours", () => {
      const updated = service.setQuietHours("cust_123", true, "22:00", "08:00");

      expect(updated.quietHours?.enabled).toBe(true);
      expect(updated.quietHours?.startTime).toBe("22:00");
      expect(updated.quietHours?.endTime).toBe("08:00");
    });

    it("should require start and end time for quiet hours", () => {
      expect(() =>
        service.setQuietHours("cust_123", true, undefined, "08:00"),
      ).toThrow();

      expect(() =>
        service.setQuietHours("cust_123", true, "22:00", undefined),
      ).toThrow();
    });

    it("should detect time in quiet hours", () => {
      service.setQuietHours("cust_123", true, "22:00", "08:00");

      const late = new Date();
      late.setHours(23, 30); // 11:30 PM

      const early = new Date();
      early.setHours(7, 30); // 7:30 AM

      const daytime = new Date();
      daytime.setHours(14, 0); // 2:00 PM

      expect(service.isInQuietHours("cust_123", late)).toBe(true);
      expect(service.isInQuietHours("cust_123", early)).toBe(true);
      expect(service.isInQuietHours("cust_123", daytime)).toBe(false);
    });

    it("should handle quiet hours spanning midnight", () => {
      service.setQuietHours("cust_123", true, "20:00", "06:00");

      const midnight = new Date();
      midnight.setHours(0, 0);

      const afterMidnight = new Date();
      afterMidnight.setHours(5, 0);

      const beforeQuiet = new Date();
      beforeQuiet.setHours(19, 0);

      expect(service.isInQuietHours("cust_123", midnight)).toBe(true);
      expect(service.isInQuietHours("cust_123", afterMidnight)).toBe(true);
      expect(service.isInQuietHours("cust_123", beforeQuiet)).toBe(false);
    });

    it("should disable quiet hours", () => {
      service.setQuietHours("cust_123", true, "22:00", "08:00");
      const updated = service.setQuietHours("cust_123", false);

      const time = new Date();
      time.setHours(23, 0);

      expect(updated.quietHours?.enabled).toBe(false);
      expect(service.isInQuietHours("cust_123", time)).toBe(false);
    });
  });

  describe("Unsubscribe Flow", () => {
    beforeEach(() => {
      service.createPreference("cust_123", "john@example.com");
    });

    it("should unsubscribe customer", () => {
      const unsubscribed = service.unsubscribe("cust_123");

      expect(unsubscribed.unsubscribed).toBe(true);
      expect(unsubscribed.unsubscribedAt).toBeDefined();
    });

    it("should record unsubscribe reason", () => {
      const unsubscribed = service.unsubscribe("cust_123", "Too many emails");

      expect(unsubscribed.unsubscribeReason).toBe("Too many emails");
    });

    it("should disable all preferences on unsubscribe", () => {
      service.unsubscribe("cust_123");

      const pref = service.getPreference("cust_123")!;

      expect(pref.preferences.orderConfirmation).toBe(false);
      expect(pref.preferences.orderUpdates).toBe(false);
      expect(pref.preferences.delivery).toBe(false);
      expect(pref.preferences.promotions).toBe(false);
      expect(pref.preferences.newsletters).toBe(false);
    });

    it("should resubscribe customer", () => {
      service.unsubscribe("cust_123");
      const resubscribed = service.resubscribe("cust_123");

      expect(resubscribed.unsubscribed).toBe(false);
      expect(resubscribed.unsubscribedAt).toBeUndefined();
      expect(resubscribed.preferences.orderConfirmation).toBe(true);
    });

    it("should clear unsubscribe reason on resubscribe", () => {
      service.unsubscribe("cust_123", "Spam");
      const resubscribed = service.resubscribe("cust_123");

      expect(resubscribed.unsubscribeReason).toBeUndefined();
    });
  });

  describe("Marketing Consent", () => {
    beforeEach(() => {
      service.createPreference("cust_123", "john@example.com");
    });

    it("should track marketing consent agreement", () => {
      const pref = service.getPreference("cust_123")!;

      expect(pref.marketingConsent.agreed).toBe(true);
      expect(pref.marketingConsent.agreedAt).toBeDefined();
    });

    it("should revoke marketing consent", () => {
      const updated = service.updateMarketingConsent("cust_123", false);

      expect(updated.marketingConsent.agreed).toBe(false);
      expect(updated.preferences.promotions).toBe(false);
      expect(updated.preferences.newsletters).toBe(false);
    });

    it("should grant marketing consent", () => {
      service.updateMarketingConsent("cust_123", false);
      const updated = service.updateMarketingConsent("cust_123", true);

      expect(updated.marketingConsent.agreed).toBe(true);
    });

    it("should track consent version", () => {
      const initial = service.getPreference("cust_123")!;
      expect(initial.marketingConsent.version).toBe(1);

      service.updateMarketingConsent("cust_123", false);
      const updated = service.getPreference("cust_123")!;

      expect(updated.marketingConsent.version).toBe(2);
    });

    it("should disable promotion emails when consent withdrawn", () => {
      service.updateMarketingConsent("cust_123", false);

      const pref = service.getPreference("cust_123")!;

      expect(pref.preferences.promotions).toBe(false);
      expect(pref.preferences.newsletters).toBe(false);
    });
  });

  describe("Notification Delivery Rules", () => {
    beforeEach(() => {
      service.createPreference("cust_123", "john@example.com");
    });

    it("should allow order confirmation emails", () => {
      const time = new Date();
      time.setHours(14, 0);

      const can = service.canSend(
        "cust_123",
        "orderConfirmation",
        "email",
        time,
      );

      expect(can).toBe(true);
    });

    it("should prevent sending to disabled channel", () => {
      const time = new Date();

      const can = service.canSend("cust_123", "delivery", "sms", time);

      expect(can).toBe(false);
    });

    it("should prevent sending disabled notification type", () => {
      service.updateNotificationTypes("cust_123", {
        promotions: false,
      });

      const time = new Date();

      const can = service.canSend("cust_123", "promotions", "email", time);

      expect(can).toBe(false);
    });

    it("should prevent sending during quiet hours", () => {
      service.setQuietHours("cust_123", true, "22:00", "08:00");

      const night = new Date();
      night.setHours(23, 0);

      const can = service.canSend("cust_123", "orderUpdates", "email", night);

      expect(can).toBe(false);
    });

    it("should prevent sending to unsubscribed customer", () => {
      service.unsubscribe("cust_123");

      const time = new Date();

      const can = service.canSend("cust_123", "orderUpdates", "email", time);

      expect(can).toBe(false);
    });

    it("should respect multiple conditions", () => {
      service.updateChannels("cust_123", { email: true });
      service.setQuietHours("cust_123", true, "22:00", "08:00");

      const day = new Date();
      day.setHours(14, 0);

      const night = new Date();
      night.setHours(23, 0);

      expect(service.canSend("cust_123", "delivery", "email", day)).toBe(true);
      expect(service.canSend("cust_123", "delivery", "email", night)).toBe(
        false,
      );
    });
  });

  describe("Multiple Customers", () => {
    it("should manage preferences for multiple customers independently", () => {
      service.createPreference("cust_1", "customer1@example.com");
      service.createPreference("cust_2", "customer2@example.com");

      service.updateChannels("cust_1", { sms: true });
      service.updateChannels("cust_2", { push: true });

      const pref1 = service.getPreference("cust_1")!;
      const pref2 = service.getPreference("cust_2")!;

      expect(pref1.channels.sms).toBe(true);
      expect(pref1.channels.push).toBe(false);
      expect(pref2.channels.sms).toBe(false);
      expect(pref2.channels.push).toBe(true);
    });

    it("should handle bulk preference updates", () => {
      const customers = Array.from({ length: 100 }, (_, i) =>
        service.createPreference(`cust_${i}`, `customer${i}@example.com`),
      );

      expect(customers).toHaveLength(100);
      expect(service.getPreference("cust_50")).toBeDefined();
    });
  });
});
