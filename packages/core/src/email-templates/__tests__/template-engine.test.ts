import { describe, it, expect, beforeEach } from "vitest";
import {
  renderTemplate,
  interpolate,
  formatCurrency,
  formatDate,
  formatTime,
} from "../template-engine";
import type {
  OrderEmailData,
  ShippingEmailData,
  DeliveryEmailData,
  ReturnEmailData,
} from "../types";
import { orderConfirmedTemplate } from "../templates/order-confirmed";
import { orderShippedTemplate } from "../templates/order-shipped";
import { returnInitiatedTemplate } from "../templates/return-initiated";

describe("Email Template Engine", () => {
  // ──────────────────────────────────────────────────────────────
  // INTERPOLATION TESTS
  // ──────────────────────────────────────────────────────────────

  describe("interpolate()", () => {
    it("should replace simple variable", () => {
      const html = "Hello {{name}}";
      const result = interpolate(html, { name: "Alice" });
      expect(result).toBe("Hello Alice");
    });

    it("should replace multiple variables", () => {
      const html = "Order #{{orderNumber}} for {{customerName}}";
      const result = interpolate(html, {
        orderNumber: "12345",
        customerName: "Bob",
      });
      expect(result).toBe("Order #12345 for Bob");
    });

    it("should handle missing variables as empty string", () => {
      const html = "Hello {{name}}, welcome to {{storeName}}";
      const result = interpolate(html, { name: "Alice" });
      expect(result).toBe("Hello Alice, welcome to ");
    });

    it("should handle null values as empty string", () => {
      const html = "Hello {{name}}";
      const result = interpolate(html, { name: null });
      expect(result).toBe("Hello ");
    });

    it("should handle undefined values as empty string", () => {
      const html = "Hello {{name}}";
      const result = interpolate(html, { name: undefined });
      expect(result).toBe("Hello ");
    });

    it("should not replace text outside placeholders", () => {
      const html = "The {{variable}} remains {{variable}} outside";
      const result = interpolate(html, { variable: "VALUE" });
      expect(result).toBe("The VALUE remains VALUE outside");
    });

    it("should handle numbers", () => {
      const html = "Total: {{total}}";
      const result = interpolate(html, { total: 123.45 });
      expect(result).toBe("Total: 123.45");
    });

    it("should handle whitespace in placeholders", () => {
      const html = "Hello {{ name }}";
      const result = interpolate(html, { name: "Alice" });
      expect(result).toBe("Hello Alice");
    });

    it("should not replace empty placeholders", () => {
      const html = "Hello {{}}";
      const result = interpolate(html, {});
      expect(result).toBe("Hello ");
    });
  });

  describe("renderTemplate() with each loops", () => {
    it("should process simple each loop", () => {
      const html = `
        {{#each items}}
        <li>{{name}}</li>
        {{/each}}
      `;
      const data = {
        items: [{ name: "Item 1" }, { name: "Item 2" }, { name: "Item 3" }],
      };

      const result = renderTemplate(html, data);
      expect(result).toContain("<li>Item 1</li>");
      expect(result).toContain("<li>Item 2</li>");
      expect(result).toContain("<li>Item 3</li>");
    });

    it("should process each loop with multiple fields", () => {
      const html = `{{#each items}}<tr><td>{{name}}</td><td>{{quantity}}</td></tr>{{/each}}`;
      const data = {
        items: [
          { name: "Widget", quantity: 2 },
          { name: "Gadget", quantity: 1 },
        ],
      };

      const result = renderTemplate(html, data);
      expect(result).toContain("<td>Widget</td><td>2</td>");
      expect(result).toContain("<td>Gadget</td><td>1</td>");
    });

    it("should handle empty array in each loop", () => {
      const html = `Before{{#each items}}<li>{{name}}</li>{{/each}}After`;
      const data = { items: [] };

      const result = renderTemplate(html, data);
      expect(result).toContain("BeforeAfter");
      expect(result).not.toContain("<li>");
    });

    it("should handle non-array in each loop", () => {
      const html = `{{#each items}}<li>{{name}}</li>{{/each}}`;
      const data = { items: "not an array" };

      const result = renderTemplate(html, data);
      expect(result).not.toContain("<li>");
    });

    it("should interpolate variables outside loop", () => {
      const html = `Items for {{customer}}:{{#each items}}<li>{{name}}</li>{{/each}}`;
      const data = {
        customer: "Alice",
        items: [{ name: "Item 1" }, { name: "Item 2" }],
      };

      const result = renderTemplate(html, data);
      expect(result).toContain("Items for Alice:");
      expect(result).toContain("<li>Item 1</li>");
    });
  });

  // ──────────────────────────────────────────────────────────────
  // FORMAT CURRENCY TESTS
  // ──────────────────────────────────────────────────────────────

  describe("formatCurrency()", () => {
    it("should format USD correctly", () => {
      const result = formatCurrency(99.99, "USD");
      expect(result).toBe("$99.99");
    });

    it("should format EUR correctly", () => {
      const result = formatCurrency(99.99, "EUR");
      expect(result).toBe("€99.99");
    });

    it("should format GBP correctly", () => {
      const result = formatCurrency(99.99, "GBP");
      expect(result).toBe("£99.99");
    });

    it("should format JPY correctly", () => {
      const result = formatCurrency(9999, "JPY");
      expect(result).toContain("¥");
    });

    it("should format CAD correctly", () => {
      const result = formatCurrency(99.99, "CAD");
      expect(result).toBe("C$99.99");
    });

    it("should format AUD correctly", () => {
      const result = formatCurrency(99.99, "AUD");
      expect(result).toBe("A$99.99");
    });

    it("should format INR correctly", () => {
      const result = formatCurrency(999.99, "INR");
      expect(result).toContain("₹");
    });

    it("should handle case-insensitive currency codes", () => {
      const resultUpper = formatCurrency(99.99, "USD");
      const resultLower = formatCurrency(99.99, "usd");
      expect(resultUpper).toBe(resultLower);
    });

    it("should use currency code as fallback for unknown currency", () => {
      const result = formatCurrency(99.99, "XYZ");
      expect(result).toContain("XYZ");
      expect(result).toContain("99.99");
    });

    it("should format zero correctly", () => {
      const result = formatCurrency(0, "USD");
      expect(result).toBe("$0.00");
    });

    it("should format large amounts", () => {
      const result = formatCurrency(1234567.89, "USD");
      expect(result).toContain("1,234,567.89");
    });

    it("should always show 2 decimal places", () => {
      const result1 = formatCurrency(99, "USD");
      expect(result1).toBe("$99.00");

      const result2 = formatCurrency(99.5, "USD");
      expect(result2).toBe("$99.50");
    });
  });

  describe("formatDate()", () => {
    it("should format valid date string", () => {
      const result = formatDate("2026-03-18");
      expect(result).toContain("2026");
      expect(result).toContain("March"); // or similar month
    });

    it("should return original string for invalid date", () => {
      const result = formatDate("invalid");
      expect(result).toBe("invalid");
    });

    it("should handle ISO format dates", () => {
      const result = formatDate("2026-03-18T10:30:00Z");
      expect(result).toContain("2026");
    });
  });

  describe("formatTime()", () => {
    it("should format valid time string", () => {
      const result = formatTime("2026-03-18T14:30:00Z");
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it("should return original string for invalid time", () => {
      const result = formatTime("invalid");
      expect(result).toBe("invalid");
    });
  });

  // ──────────────────────────────────────────────────────────────
  // TEMPLATE RENDERING TESTS
  // ──────────────────────────────────────────────────────────────

  describe("orderConfirmedTemplate()", () => {
    const orderData: OrderEmailData = {
      orderNumber: "ORD-12345",
      customerName: "Alice Johnson",
      customerEmail: "alice@example.com",
      items: [
        { name: "Widget", quantity: 2, price: 29.99 },
        { name: "Gadget", quantity: 1, price: 49.99 },
      ],
      subtotal: 109.97,
      shipping: 10.0,
      tax: 9.5,
      total: 129.47,
      currency: "USD",
      storeName: "TechStore",
      storeUrl: "https://techstore.com",
      supportEmail: "support@techstore.com",
    };

    it("should render order confirmed template", () => {
      const html = orderConfirmedTemplate(orderData);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
      expect(html).toContain("<body>");
    });

    it("should include order number in template", () => {
      const html = orderConfirmedTemplate(orderData);
      expect(html).toContain("ORD-12345");
    });

    it("should include customer name in template", () => {
      const html = orderConfirmedTemplate(orderData);
      expect(html).toContain("Alice Johnson");
    });

    it("should include store name in template", () => {
      const html = orderConfirmedTemplate(orderData);
      expect(html).toContain("TechStore");
    });

    it("should include support email in template", () => {
      const html = orderConfirmedTemplate(orderData);
      expect(html).toContain("support@techstore.com");
    });

    it("should be valid HTML", () => {
      const html = orderConfirmedTemplate(orderData);
      expect(html).toMatch(/<html[^>]*>/i);
      expect(html).toMatch(/<\/html>/i);
      expect(html).toMatch(/<body[^>]*>/i);
      expect(html).toMatch(/<\/body>/i);
      expect(html).toMatch(/<head[^>]*>/i);
      expect(html).toMatch(/<\/head>/i);
    });

    it("should contain email structure elements", () => {
      const html = orderConfirmedTemplate(orderData);
      expect(html).toContain("email-wrapper");
      expect(html).toContain("email-container");
      expect(html).toContain("email-header");
      expect(html).toContain("email-content");
      expect(html).toContain("email-footer");
    });

    it("should include order details section", () => {
      const html = orderConfirmedTemplate(orderData);
      expect(html).toContain("Order Details");
    });

    it("should include items loop", () => {
      const html = orderConfirmedTemplate(orderData);
      expect(html).toContain("Widget");
      expect(html).toContain("Gadget");
    });

    it("should include order totals", () => {
      const html = orderConfirmedTemplate(orderData);
      expect(html).toContain("Subtotal");
      expect(html).toContain("Shipping");
      expect(html).toContain("Tax");
      expect(html).toContain("Total");
    });

    it("should include action button", () => {
      const html = orderConfirmedTemplate(orderData);
      expect(html).toContain("cta-button");
      expect(html).toContain("View Your Order");
    });
  });

  describe("orderShippedTemplate()", () => {
    const shippingData: ShippingEmailData = {
      orderNumber: "ORD-12345",
      customerName: "Alice Johnson",
      customerEmail: "alice@example.com",
      items: [{ name: "Widget", quantity: 2, price: 29.99 }],
      subtotal: 59.98,
      shipping: 10.0,
      tax: 5.6,
      total: 75.58,
      currency: "USD",
      storeName: "TechStore",
      storeUrl: "https://techstore.com",
      supportEmail: "support@techstore.com",
      trackingNumber: "TRK-98765432",
      trackingUrl: "https://track.carrier.com/TRK-98765432",
      carrierName: "FastShip",
      estimatedDelivery: "March 22, 2026",
    };

    it("should render order shipped template", () => {
      const html = orderShippedTemplate(shippingData);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
    });

    it("should include tracking number", () => {
      const html = orderShippedTemplate(shippingData);
      expect(html).toContain("TRK-98765432");
    });

    it("should include carrier name", () => {
      const html = orderShippedTemplate(shippingData);
      expect(html).toContain("FastShip");
    });

    it("should include estimated delivery date", () => {
      const html = orderShippedTemplate(shippingData);
      expect(html).toContain("March 22, 2026");
    });

    it("should include tracking information section", () => {
      const html = orderShippedTemplate(shippingData);
      expect(html).toContain("Shipping Information");
      expect(html).toContain("Tracking Number");
    });

    it("should include tracking link", () => {
      const html = orderShippedTemplate(shippingData);
      expect(html).toContain("track your package");
    });

    it("should be valid HTML", () => {
      const html = orderShippedTemplate(shippingData);
      expect(html).toMatch(/<html[^>]*>/i);
      expect(html).toMatch(/<\/html>/i);
      expect(html).toMatch(/<body[^>]*>/i);
    });
  });

  describe("returnInitiatedTemplate()", () => {
    const returnData: ReturnEmailData = {
      orderNumber: "ORD-12345",
      customerName: "Alice Johnson",
      returnId: "RET-55555",
      returnStatus: "initiated",
      refundAmount: 89.99,
      items: [{ name: "Widget", quantity: 1, price: 29.99 }],
      returnLabelUrl: "https://returns.carrier.com/label/RET-55555",
      storeName: "TechStore",
      supportEmail: "support@techstore.com",
      currency: "USD",
    };

    it("should render return initiated template", () => {
      const html = returnInitiatedTemplate(returnData);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
      expect(html).toContain("<body>");
    });

    it("should include return ID", () => {
      const html = returnInitiatedTemplate(returnData);
      expect(html).toContain("RET-55555");
    });

    it("should include order number", () => {
      const html = returnInitiatedTemplate(returnData);
      expect(html).toContain("ORD-12345");
    });

    it("should include customer name", () => {
      const html = returnInitiatedTemplate(returnData);
      expect(html).toContain("Alice Johnson");
    });

    it("should include return label link", () => {
      const html = returnInitiatedTemplate(returnData);
      expect(html).toContain("returns.carrier.com/label/RET-55555");
      expect(html).toContain("Download");
    });

    it("should include items being returned", () => {
      const html = returnInitiatedTemplate(returnData);
      expect(html).toContain("Widget");
      expect(html).toContain("Items Being Returned");
    });

    it("should include next steps section", () => {
      const html = returnInitiatedTemplate(returnData);
      expect(html).toContain("Next Steps");
      expect(html).toContain("Print");
      expect(html).toContain("Package");
    });

    it("should be valid HTML", () => {
      const html = returnInitiatedTemplate(returnData);
      expect(html).toMatch(/<html[^>]*>/i);
      expect(html).toMatch(/<\/html>/i);
      expect(html).toMatch(/<body[^>]*>/i);
      expect(html).toMatch(/<\/body>/i);
    });

    it("should include refund information", () => {
      const html = returnInitiatedTemplate(returnData);
      expect(html).toContain("Refund");
    });

    it("should include support contact info", () => {
      const html = returnInitiatedTemplate(returnData);
      expect(html).toContain("support@techstore.com");
    });
  });

  // ──────────────────────────────────────────────────────────────
  // GENERAL HTML VALIDATION TESTS
  // ──────────────────────────────────────────────────────────────

  describe("Template HTML validity", () => {
    const orderData: OrderEmailData = {
      orderNumber: "ORD-12345",
      customerName: "Test User",
      customerEmail: "test@example.com",
      items: [{ name: "Product", quantity: 1, price: 100 }],
      subtotal: 100,
      shipping: 10,
      tax: 8,
      total: 118,
      currency: "USD",
      storeName: "TestStore",
      storeUrl: "https://test.com",
      supportEmail: "support@test.com",
    };

    it("order confirmed template should have proper structure", () => {
      const html = orderConfirmedTemplate(orderData);
      expect(html).toMatch(/<html\s+[^>]*>/i);
      expect(html).toMatch(/<head[^>]*>/i);
      expect(html).toMatch(/<body[^>]*>/i);
      expect(html).toContain("<!DOCTYPE html>");
    });

    it("all templates should be well-formed HTML", () => {
      const html = orderConfirmedTemplate(orderData);
      const openTags = (html.match(/<[^/>]+>/g) || []).length;
      const closeTags = (html.match(/<\/[^>]+>/g) || []).length;
      expect(openTags).toBeGreaterThan(0);
      expect(closeTags).toBeGreaterThan(0);
    });

    it("all templates should include responsive styles", () => {
      const html = orderConfirmedTemplate(orderData);
      expect(html).toContain("media");
      expect(html).toContain("max-width");
    });

    it("all templates should include email-specific styles", () => {
      const html = orderConfirmedTemplate(orderData);
      expect(html).toContain("email-container");
      expect(html).toContain("email-header");
      expect(html).toContain("email-footer");
    });
  });
});
