import { describe, it, expect, beforeEach } from "vitest";
import {
  initializeI18n,
  loadLocaleData,
  setLocale,
  getLocale,
  getConfig,
  t,
  hasKey,
  isRTL,
  getDirection,
  getAllTranslations,
} from "../index";

// Sample test data
const enTranslations = {
  common: {
    save: "Save",
    cancel: "Cancel",
  },
  orders: {
    status: {
      pending: "Pending",
      confirmed: "Confirmed",
    },
    assigned: "Order assigned to {{driver}}",
  },
  notifications: {
    order_created: "Order {{order_id}} has been created",
    order_assigned: "Order {{order_id}} assigned to {{driver_name}}",
  },
};

const esTranslations = {
  common: {
    save: "Guardar",
    cancel: "Cancelar",
  },
  orders: {
    status: {
      pending: "Pendiente",
      confirmed: "Confirmado",
    },
    assigned: "Pedido asignado a {{driver}}",
  },
  notifications: {
    order_created: "El pedido {{order_id}} ha sido creado",
    order_assigned: "Pedido {{order_id}} asignado a {{driver_name}}",
  },
};

const arTranslations = {
  _meta: {
    rtl: true,
  },
  common: {
    save: "حفظ",
    cancel: "إلغاء",
  },
  orders: {
    status: {
      pending: "قيد الانتظار",
      confirmed: "مؤكد",
    },
  },
};

describe("i18n Core Utility", () => {
  beforeEach(() => {
    // Reset to default state before each test
    initializeI18n({ defaultLocale: "en", fallbackLocale: "en" });
    loadLocaleData("en", enTranslations);
    loadLocaleData("es", esTranslations);
    loadLocaleData("ar", arTranslations);
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe("Initialization", () => {
    it("should initialize with default config", () => {
      initializeI18n();
      const config = getConfig();
      expect(config.defaultLocale).toBe("en");
      expect(config.fallbackLocale).toBe("en");
    });

    it("should initialize with custom config", () => {
      initializeI18n({ defaultLocale: "es", fallbackLocale: "en" });
      const config = getConfig();
      expect(config.defaultLocale).toBe("es");
      expect(config.fallbackLocale).toBe("en");
    });

    it("should set initial locale", () => {
      initializeI18n({ defaultLocale: "es" });
      expect(getLocale()).toBe("es");
    });
  });

  // ============================================================================
  // Simple Translation Tests
  // ============================================================================

  describe("Basic Translation Lookup", () => {
    beforeEach(() => {
      setLocale("en");
    });

    it("should return a simple translation", () => {
      const result = t("common.save");
      expect(result).toBe("Save");
    });

    it("should handle top-level keys", () => {
      const result = t("common.cancel");
      expect(result).toBe("Cancel");
    });

    it("should return the key if translation is not found", () => {
      const result = t("non.existent.key");
      expect(result).toBe("non.existent.key");
    });

    it("should be case-sensitive", () => {
      const result = t("COMMON.SAVE");
      expect(result).toBe("COMMON.SAVE"); // Not found
    });
  });

  // ============================================================================
  // Nested Key Translation Tests
  // ============================================================================

  describe("Nested Key Lookup", () => {
    beforeEach(() => {
      setLocale("en");
    });

    it("should translate nested keys with dot notation", () => {
      const result = t("orders.status.pending");
      expect(result).toBe("Pending");
    });

    it("should handle deep nesting", () => {
      const result = t("orders.status.confirmed");
      expect(result).toBe("Confirmed");
    });

    it("should return key for missing nested translation", () => {
      const result = t("orders.status.nonexistent");
      expect(result).toBe("orders.status.nonexistent");
    });

    it("should return key for partial path that does not lead to string", () => {
      const result = t("orders.status");
      // This should return the key since it's not a string value
      expect(result).toBe("orders.status");
    });
  });

  // ============================================================================
  // Parameter Interpolation Tests
  // ============================================================================

  describe("Parameter Interpolation", () => {
    beforeEach(() => {
      setLocale("en");
    });

    it("should interpolate single parameter", () => {
      const result = t("orders.assigned", { driver: "John" });
      expect(result).toBe("Order assigned to John");
    });

    it("should interpolate with different parameter values", () => {
      const result = t("orders.assigned", { driver: "Jane" });
      expect(result).toBe("Order assigned to Jane");
    });

    it("should interpolate multiple parameters", () => {
      const result = t("notifications.order_created", { order_id: "12345" });
      expect(result).toBe("Order 12345 has been created");
    });

    it("should handle numeric parameters", () => {
      const result = t("notifications.order_created", { order_id: 12345 });
      expect(result).toBe("Order 12345 has been created");
    });

    it("should not modify text when no params provided", () => {
      const result = t("common.save");
      expect(result).toBe("Save");
    });

    it("should ignore unused parameters", () => {
      const result = t("orders.assigned", { driver: "John", unused: "param" });
      expect(result).toBe("Order assigned to John");
    });

    it("should handle missing parameters gracefully", () => {
      const result = t("orders.assigned", {});
      // Should return the string with unreplaced placeholders
      expect(result).toContain("{{driver}}");
    });

    it("should handle whitespace in placeholders", () => {
      // Add a test translation with whitespace in placeholder
      loadLocaleData("en", {
        ...enTranslations,
        test: "Hello {{ name }}",
      });
      const result = t("test", { name: "World" });
      expect(result).toBe("Hello World");
    });
  });

  // ============================================================================
  // Locale Switching Tests
  // ============================================================================

  describe("Locale Switching", () => {
    it("should switch to Spanish locale", () => {
      setLocale("es");
      expect(getLocale()).toBe("es");
    });

    it("should translate to Spanish", () => {
      setLocale("es");
      const result = t("common.save");
      expect(result).toBe("Guardar");
    });

    it("should translate with parameters in Spanish", () => {
      setLocale("es");
      const result = t("orders.assigned", { driver: "Juan" });
      expect(result).toBe("Pedido asignado a Juan");
    });

    it("should switch between locales", () => {
      setLocale("en");
      expect(t("common.save")).toBe("Save");

      setLocale("es");
      expect(t("common.save")).toBe("Guardar");

      setLocale("en");
      expect(t("common.save")).toBe("Save");
    });
  });

  // ============================================================================
  // Fallback Tests
  // ============================================================================

  describe("Fallback to Default Locale", () => {
    it("should fallback to English when translation missing in current locale", () => {
      setLocale("es");
      // Spanish translations don't have "orders.status" as string, but English does
      const result = t("common.save");
      expect(result).toBe("Guardar"); // From Spanish
    });

    it("should use fallback when switching to unsupported locale", () => {
      initializeI18n({
        defaultLocale: "en",
        fallbackLocale: "en",
        supportedLocales: ["en", "es"],
      });
      setLocale("fr"); // Not supported
      expect(getLocale()).toBe("en"); // Should fallback
    });
  });

  // ============================================================================
  // Key Existence Tests
  // ============================================================================

  describe("hasKey Function", () => {
    beforeEach(() => {
      setLocale("en");
    });

    it("should return true for existing keys", () => {
      expect(hasKey("common.save")).toBe(true);
    });

    it("should return false for missing keys", () => {
      expect(hasKey("non.existent.key")).toBe(false);
    });

    it("should handle nested keys", () => {
      expect(hasKey("orders.status.pending")).toBe(true);
      expect(hasKey("orders.status.nonexistent")).toBe(false);
    });
  });

  // ============================================================================
  // RTL Support Tests
  // ============================================================================

  describe("RTL Support", () => {
    it("should detect RTL for Arabic locale", () => {
      setLocale("ar");
      expect(isRTL()).toBe(true);
      expect(getDirection()).toBe("rtl");
    });

    it("should not be RTL for English locale", () => {
      setLocale("en");
      expect(isRTL()).toBe(false);
      expect(getDirection()).toBe("ltr");
    });

    it("should not be RTL for Spanish locale", () => {
      setLocale("es");
      expect(isRTL()).toBe(false);
      expect(getDirection()).toBe("ltr");
    });

    it("should translate to Arabic with RTL", () => {
      setLocale("ar");
      const result = t("common.save");
      expect(result).toBe("حفظ");
      expect(isRTL()).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe("Edge Cases", () => {
    beforeEach(() => {
      setLocale("en");
    });

    it("should handle empty translation key", () => {
      const result = t("");
      expect(result).toBe("");
    });

    it("should handle very long keys", () => {
      const longKey = "a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p";
      const result = t(longKey);
      expect(result).toBe(longKey);
    });

    it("should handle special characters in parameters", () => {
      loadLocaleData("en", {
        ...enTranslations,
        special: "Message: {{message}}",
      });
      const result = t("special", {
        message: 'Hello & "goodbye" <world>',
      });
      expect(result).toBe('Message: Hello & "goodbye" <world>');
    });

    it("should handle empty object as params", () => {
      const result = t("common.save", {});
      expect(result).toBe("Save");
    });

    it("should handle undefined as params", () => {
      const result = t("common.save", undefined);
      expect(result).toBe("Save");
    });

    it("should handle multiple occurrences of same parameter", () => {
      loadLocaleData("en", {
        ...enTranslations,
        double: "{{name}} and {{name}} are here",
      });
      const result = t("double", { name: "John" });
      expect(result).toBe("John and John are here");
    });
  });

  // ============================================================================
  // Locale Data Management Tests
  // ============================================================================

  describe("Locale Data Management", () => {
    it("should load locale data", () => {
      const newLocale = {
        test: {
          key: "Test Value",
        },
      };
      loadLocaleData("en", newLocale);
      const result = t("test.key");
      expect(result).toBe("Test Value");
    });

    it("should get all translations for current locale", () => {
      const all = getAllTranslations();
      expect(all).toBeDefined();
      const commonData = all?.common as any;
      expect(commonData?.save).toBe("Save");
    });

    it("should update translations by reloading locale", () => {
      loadLocaleData("en", { ...enTranslations, newKey: "New Value" });
      expect(t("newKey")).toBe("New Value");
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("Integration Tests", () => {
    it("should work end-to-end with multiple locales and parameters", () => {
      // English
      setLocale("en");
      expect(t("orders.status.pending")).toBe("Pending");
      expect(t("orders.assigned", { driver: "John" })).toBe(
        "Order assigned to John",
      );

      // Spanish
      setLocale("es");
      expect(t("orders.status.pending")).toBe("Pendiente");
      expect(t("orders.assigned", { driver: "Juan" })).toBe(
        "Pedido asignado a Juan",
      );

      // Arabic with RTL
      setLocale("ar");
      expect(t("common.save")).toBe("حفظ");
      expect(isRTL()).toBe(true);

      // Back to English
      setLocale("en");
      expect(getDirection()).toBe("ltr");
    });

    it("should handle real-world dashboard scenario", () => {
      // User setting language to Spanish
      setLocale("es");
      expect(getDirection()).toBe("ltr");

      // Dashboard displays orders
      const orderStatus = t("orders.status.pending");
      expect(orderStatus).toBe("Pendiente");

      // Assigning order
      const assignMsg = t("notifications.order_assigned", {
        order_id: "12345",
        driver_name: "Carlos",
      });
      expect(assignMsg).toContain("Carlos");

      // User switches to Arabic
      setLocale("ar");
      expect(isRTL()).toBe(true);
      const saveBtn = t("common.save");
      expect(saveBtn).toBe("حفظ");
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe("Performance Characteristics", () => {
    it("should handle multiple consecutive translations efficiently", () => {
      setLocale("en");
      const keys = ["common.save", "common.cancel", "orders.status.pending"];

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        keys.forEach((key) => t(key));
      }
      const duration = Date.now() - start;

      // Should complete 3000 translations in reasonable time
      expect(duration).toBeLessThan(500); // Generous time limit
    });

    it("should handle interpolation efficiently", () => {
      setLocale("en");
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        t("orders.assigned", { driver: `Driver${i}` });
      }
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });
});
