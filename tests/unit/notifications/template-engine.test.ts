/**
 * Template Engine Unit Tests
 *
 * Test coverage:
 * - Handlebars compilation with variable substitution
 * - Conditional blocks and loops
 * - Channel-specific formatting (SMS, Email, Push, etc)
 * - Template registry CRUD and versioning
 * - Template validation
 * - Localization support
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  HandlebarsCompiler,
  ChannelFormatter,
  TemplateRegistry,
  TemplateValidator,
  TemplateLocalizer,
  TemplatePreview,
} from "../../../packages/core/src/notifications/template-engine.js";
import type { NotificationTemplate } from "../../../packages/core/src/notifications/notification-types.js";
import { NotificationChannel } from "../../../packages/core/src/notifications/notification-types.js";

// ─── HANDLEBARS COMPILER TESTS ──────────────────────────────────────────

describe("HandlebarsCompiler", () => {
  it("should substitute simple variables", () => {
    const template = "Hello {{name}}, your order {{orderId}} is ready.";
    const variables = { name: "Alice", orderId: "12345" };
    const result = HandlebarsCompiler.compile(template, variables);
    expect(result).toBe("Hello Alice, your order 12345 is ready.");
  });

  it("should handle missing variables as empty string", () => {
    const template = "Hello {{name}}, your order {{orderId}} is ready.";
    const variables = { name: "Alice" };
    const result = HandlebarsCompiler.compile(template, variables);
    expect(result).toBe("Hello Alice, your order  is ready.");
  });

  it("should process conditionals with truthy values", () => {
    const template = "{{#if premium}}Premium member{{/if}}";
    const variables = { premium: true };
    const result = HandlebarsCompiler.compile(template, variables);
    expect(result).toBe("Premium member");
  });

  it("should skip conditionals with falsy values", () => {
    const template =
      "{{#if premium}}Premium member{{else}}Standard member{{/if}}";
    const variables = { premium: false };
    const result = HandlebarsCompiler.compile(template, variables);
    expect(result).toBe("");
  });

  it("should process loops over arrays", () => {
    const template = "Items:{{#each items}} - {{.}}{{/each}}";
    const variables = { items: ["Apple", "Banana", "Orange"] };
    const result = HandlebarsCompiler.compile(template, variables);
    expect(result).toContain("Apple");
    expect(result).toContain("Banana");
    expect(result).toContain("Orange");
  });

  it("should provide @index in loops", () => {
    const template = "{{#each items}}{{@index}}: {{.}}\n{{/each}}";
    const variables = { items: ["A", "B", "C"] };
    const result = HandlebarsCompiler.compile(template, variables);
    expect(result).toContain("0: A");
    expect(result).toContain("1: B");
    expect(result).toContain("2: C");
  });

  it("should provide @first flag in loops", () => {
    const template =
      "{{#each items}}{{#if @first}}FIRST: {{/if}}{{.}} {{/each}}";
    const variables = { items: ["A", "B", "C"] };
    const result = HandlebarsCompiler.compile(template, variables);
    expect(result).toContain("FIRST: A");
    expect(result).not.toContain("FIRST: B");
  });

  it("should provide @last flag in loops", () => {
    const template =
      "{{#each items}}{{.}}{{#if @last}} (LAST){{/if}} {{/each}}";
    const variables = { items: ["A", "B", "C"] };
    const result = HandlebarsCompiler.compile(template, variables);
    expect(result).toContain("C (LAST)");
    expect(result).not.toContain("B (LAST)");
  });

  it("should handle nested properties with dot notation", () => {
    const template = "Hello {{user.name}}, from {{user.city}}";
    const variables = { user: { name: "Bob", city: "NYC" } };
    const result = HandlebarsCompiler.compile(template, variables);
    expect(result).toBe("Hello Bob, from NYC");
  });

  it("should apply uppercase filter", () => {
    const template = "{{name | uppercase}}";
    const variables = { name: "alice" };
    const result = HandlebarsCompiler.compile(template, variables);
    expect(result).toBe("ALICE");
  });

  it("should apply lowercase filter", () => {
    const template = "{{name | lowercase}}";
    const variables = { name: "ALICE" };
    const result = HandlebarsCompiler.compile(template, variables);
    expect(result).toBe("alice");
  });

  it("should apply capitalize filter", () => {
    const template = "{{greeting | capitalize}}";
    const variables = { greeting: "hello world" };
    const result = HandlebarsCompiler.compile(template, variables);
    expect(result).toBe("Hello world");
  });

  it("should handle numbers and booleans", () => {
    const template = "Count: {{count}}, Active: {{active}}";
    const variables = { count: 42, active: true };
    const result = HandlebarsCompiler.compile(template, variables);
    expect(result).toBe("Count: 42, Active: true");
  });

  it("should serialize objects to JSON", () => {
    const template = "Data: {{data}}";
    const variables = { data: { key: "value" } };
    const result = HandlebarsCompiler.compile(template, variables);
    expect(result).toContain("key");
    expect(result).toContain("value");
  });
});

// ─── CHANNEL FORMATTER TESTS ────────────────────────────────────────────

describe("ChannelFormatter", () => {
  it("should truncate SMS to 160 characters", () => {
    const content = "A".repeat(200);
    const result = ChannelFormatter.format(content, NotificationChannel.SMS);
    expect(result.length).toBeLessThanOrEqual(160);
  });

  it("should wrap email content in HTML", () => {
    const content = "Hello World";
    const result = ChannelFormatter.format(content, NotificationChannel.EMAIL);
    expect(result).toContain("<html");
    expect(result).toContain("</html>");
    expect(result).toContain("Hello World");
  });

  it("should keep existing HTML in email unchanged", () => {
    const content = "<html><body>Test</body></html>";
    const result = ChannelFormatter.format(content, NotificationChannel.EMAIL);
    expect(result).toBe(content);
  });

  it("should strip HTML from push notifications", () => {
    const content = "<b>Bold</b> text";
    const result = ChannelFormatter.format(content, NotificationChannel.PUSH);
    expect(result).toBe("Bold text");
    expect(result).not.toContain("<b>");
  });

  it("should strip HTML from WhatsApp messages", () => {
    const content = "<em>Italic</em> message";
    const result = ChannelFormatter.format(
      content,
      NotificationChannel.WHATSAPP,
    );
    expect(result).toBe("Italic message");
  });

  it("should convert HTML to Slack Markdown", () => {
    const content = "<b>Bold</b> and <i>italic</i>";
    const result = ChannelFormatter.format(content, NotificationChannel.SLACK);
    expect(result).toContain("*Bold*");
    expect(result).toContain("_italic_");
  });

  it("should convert links to Slack format", () => {
    const content = '<a href="https://example.com">Click here</a>';
    const result = ChannelFormatter.format(content, NotificationChannel.SLACK);
    expect(result).toContain("<https://example.com|Click here>");
  });
});

// ─── TEMPLATE REGISTRY TESTS ────────────────────────────────────────────

describe("TemplateRegistry", () => {
  let registry: TemplateRegistry;

  beforeEach(() => {
    registry = new TemplateRegistry();
  });

  it("should create a template", async () => {
    const template: NotificationTemplate = {
      id: "t1",
      tenantId: "tenant1",
      name: "Order Confirmation",
      category: "ORDER",
      defaultLocale: "en",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          subject: "Order {{orderId}} confirmed",
          body: "Thank you for your order",
        },
      ],
      requiredVariables: ["orderId"],
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await registry.createTemplate(template);

    const retrieved = await registry.getTemplate("t1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe("Order Confirmation");
  });

  it("should track multiple versions", async () => {
    const template1: NotificationTemplate = {
      id: "t1",
      tenantId: "tenant1",
      name: "Template",
      category: "ORDER",
      defaultLocale: "en",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "Version 1",
        },
      ],
      requiredVariables: [],
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const template2: NotificationTemplate = {
      ...template1,
      version: 2,
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "Version 2",
        },
      ],
    };

    await registry.createTemplate(template1);
    await registry.createTemplate(template2);

    const versions = await registry.listTemplateVersions("t1");
    expect(versions.length).toBe(2);
  });

  it("should mark older versions as inactive", async () => {
    const template1: NotificationTemplate = {
      id: "t1",
      tenantId: "tenant1",
      name: "Template",
      category: "ORDER",
      defaultLocale: "en",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "V1",
        },
      ],
      requiredVariables: [],
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const template2: NotificationTemplate = {
      ...template1,
      version: 2,
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "V2",
        },
      ],
    };

    await registry.createTemplate(template1);
    await registry.createTemplate(template2);

    const retrieved = await registry.getTemplate("t1");
    expect(retrieved?.version).toBe(2);
  });

  it("should get specific template version", async () => {
    const template1: NotificationTemplate = {
      id: "t1",
      tenantId: "tenant1",
      name: "Template",
      category: "ORDER",
      defaultLocale: "en",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "V1",
        },
      ],
      requiredVariables: [],
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const template2: NotificationTemplate = {
      ...template1,
      version: 2,
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "V2",
        },
      ],
    };

    await registry.createTemplate(template1);
    await registry.createTemplate(template2);

    const v1 = await registry.getTemplateVersion("t1", 1);
    const v2 = await registry.getTemplateVersion("t1", 2);

    expect(v1?.channels[0].body).toBe("V1");
    expect(v2?.channels[0].body).toBe("V2");
  });

  it("should deactivate all template versions", async () => {
    const template: NotificationTemplate = {
      id: "t1",
      tenantId: "tenant1",
      name: "Template",
      category: "ORDER",
      defaultLocale: "en",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "Content",
        },
      ],
      requiredVariables: [],
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await registry.createTemplate(template);
    await registry.deactivateTemplate("t1");

    const retrieved = await registry.getTemplate("t1");
    expect(retrieved).toBeNull();
  });

  it("should delete template", async () => {
    const template: NotificationTemplate = {
      id: "t1",
      tenantId: "tenant1",
      name: "Template",
      category: "ORDER",
      defaultLocale: "en",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "Content",
        },
      ],
      requiredVariables: [],
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await registry.createTemplate(template);
    await registry.deleteTemplate("t1");

    const retrieved = await registry.getTemplate("t1");
    expect(retrieved).toBeNull();
  });
});

// ─── TEMPLATE VALIDATOR TESTS ───────────────────────────────────────────

describe("TemplateValidator", () => {
  it("should validate valid template", () => {
    const template: NotificationTemplate = {
      id: "t1",
      tenantId: "tenant1",
      name: "Valid",
      category: "ORDER",
      defaultLocale: "en",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "Content",
        },
      ],
      requiredVariables: [],
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const errors = TemplateValidator.validateTemplate(template);
    expect(errors).toHaveLength(0);
  });

  it("should reject template without id", () => {
    const template: any = {
      tenantId: "tenant1",
      name: "Invalid",
      category: "ORDER",
      defaultLocale: "en",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "Content",
        },
      ],
      requiredVariables: [],
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const errors = TemplateValidator.validateTemplate(template);
    expect(errors.some((e) => e.includes("id"))).toBe(true);
  });

  it("should reject SMS with >160 chars", () => {
    const template: NotificationTemplate = {
      id: "t1",
      tenantId: "tenant1",
      name: "SMS Template",
      category: "ORDER",
      defaultLocale: "en",
      channels: [
        {
          channel: NotificationChannel.SMS,
          body: "A".repeat(200),
        },
      ],
      requiredVariables: [],
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const errors = TemplateValidator.validateTemplate(template);
    expect(errors.some((e) => e.includes("160"))).toBe(true);
  });

  it("should validate required variables", () => {
    const template: NotificationTemplate = {
      id: "t1",
      tenantId: "tenant1",
      name: "Template",
      category: "ORDER",
      defaultLocale: "en",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "Order {{orderId}}",
        },
      ],
      requiredVariables: ["orderId", "customerName"],
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const errors = TemplateValidator.validateVariables(template, {
      orderId: "123",
    });
    expect(errors).toContain("Missing required variable: customerName");
  });

  it("should validate template syntax", () => {
    const template: NotificationTemplate = {
      id: "t1",
      tenantId: "tenant1",
      name: "Template",
      category: "ORDER",
      defaultLocale: "en",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "{{#if test}}Unclosed conditional",
        },
      ],
      requiredVariables: [],
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const errors = TemplateValidator.validateSyntax(template);
    expect(errors.some((e) => e.includes("if"))).toBe(true);
  });
});

// ─── TEMPLATE LOCALIZER TESTS ───────────────────────────────────────────

describe("TemplateLocalizer", () => {
  let localizer: TemplateLocalizer;

  beforeEach(() => {
    localizer = new TemplateLocalizer();
  });

  it("should register locale variant", async () => {
    const enTemplate: NotificationTemplate = {
      id: "t1",
      tenantId: "tenant1",
      name: "Template",
      category: "ORDER",
      defaultLocale: "en",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "Hello",
        },
      ],
      requiredVariables: [],
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const esTemplate: NotificationTemplate = {
      ...enTemplate,
      defaultLocale: "es",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "Hola",
        },
      ],
    };

    await localizer.registerLocale("t1", "en", enTemplate);
    await localizer.registerLocale("t1", "es", esTemplate);

    const locales = await localizer.getAvailableLocales("t1");
    expect(locales).toContain("en");
    expect(locales).toContain("es");
  });

  it("should get localized template", async () => {
    const enTemplate: NotificationTemplate = {
      id: "t1",
      tenantId: "tenant1",
      name: "Template",
      category: "ORDER",
      defaultLocale: "en",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "Hello",
        },
      ],
      requiredVariables: [],
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const esTemplate: NotificationTemplate = {
      ...enTemplate,
      defaultLocale: "es",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "Hola",
        },
      ],
    };

    await localizer.registerLocale("t1", "en", enTemplate);
    await localizer.registerLocale("t1", "es", esTemplate);

    const retrieved = await localizer.getLocalizedTemplate(
      "t1",
      "es",
      enTemplate,
    );
    expect(retrieved.channels[0].body).toBe("Hola");
  });

  it("should fallback to default locale", async () => {
    const enTemplate: NotificationTemplate = {
      id: "t1",
      tenantId: "tenant1",
      name: "Template",
      category: "ORDER",
      defaultLocale: "en",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "Hello",
        },
      ],
      requiredVariables: [],
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const frTemplate: NotificationTemplate = {
      ...enTemplate,
      defaultLocale: "fr",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "Bonjour",
        },
      ],
    };

    await localizer.registerLocale("t1", "fr", frTemplate);

    // Request for Spanish (not registered) should fallback
    const retrieved = await localizer.getLocalizedTemplate(
      "t1",
      "es",
      enTemplate,
    );
    expect(retrieved.channels[0].body).toBe("Hello");
  });
});

// ─── TEMPLATE PREVIEW TESTS ─────────────────────────────────────────────

describe("TemplatePreview", () => {
  it("should generate preview for all channels", () => {
    const template: NotificationTemplate = {
      id: "t1",
      tenantId: "tenant1",
      name: "Template",
      category: "ORDER",
      defaultLocale: "en",
      channels: [
        {
          channel: NotificationChannel.EMAIL,
          body: "Order {{orderId}} confirmed",
        },
        {
          channel: NotificationChannel.SMS,
          body: "Order {{orderId}} ready",
        },
      ],
      requiredVariables: ["orderId"],
      version: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const preview = TemplatePreview.generatePreview(template, {
      orderId: "12345",
    });

    expect(preview[NotificationChannel.EMAIL]).toContain("12345");
    expect(preview[NotificationChannel.SMS]).toContain("12345");
  });
});
