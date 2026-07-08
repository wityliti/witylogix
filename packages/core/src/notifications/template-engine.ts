/**
 * Notification Template Engine
 *
 * Responsibilities:
 * - Handlebars template compilation and rendering
 * - Channel-specific content formatting
 * - Template registry and versioning
 * - i18n localization support
 * - Template validation
 */

import type {
  NotificationTemplate,
  ChannelTemplate,
  NotificationChannel,
} from "./notification-types.js";

// ─── HANDLEBARS PARSER ───────────────────────────────────────────────────

/**
 * Minimal Handlebars-like compiler
 * Supports:
 * - {{variable}} substitution
 * - {{#if variable}} conditional blocks
 * - {{#each items}} loops (for arrays)
 * - Simple filters: {{variable | uppercase}}
 */
export class HandlebarsCompiler {
  /**
   * Compile and render template with variables
   * @param template Template string with Handlebars syntax
   * @param variables Variable context for substitution
   * @returns Rendered string
   */
  static compile(template: string, variables: Record<string, unknown>): string {
    let result = template;

    // Step 1: Process conditionals {{#if variable}} ... {{/if}}
    result = this.processConditionals(result, variables);

    // Step 2: Process loops {{#each items}} ... {{/each}}
    result = this.processLoops(result, variables);

    // Step 3: Process variable substitutions {{variable}}
    result = this.processVariables(result, variables);

    return result;
  }

  /**
   * Process conditional blocks
   */
  private static processConditionals(
    template: string,
    variables: Record<string, unknown>,
  ): string {
    const conditionalRegex = /{{#if\s+(\w+)\s*}}([\s\S]*?){{\/if}}/g;
    return template.replace(conditionalRegex, (_match, varName, content) => {
      const value = this.getNestedValue(variables, varName);
      return this.isTruthy(value) ? content : "";
    });
  }

  /**
   * Process loop blocks
   */
  private static processLoops(
    template: string,
    variables: Record<string, unknown>,
  ): string {
    const loopRegex = /{{#each\s+(\w+)\s*}}([\s\S]*?){{\/each}}/g;
    return template.replace(loopRegex, (_match, varName, content) => {
      const items = this.getNestedValue(variables, varName);
      if (!Array.isArray(items)) {
        return "";
      }

      return items
        .map((item, index) => {
          const itemVars = {
            ...variables,
            ".": item, // Current item as "."
            "@index": index, // Index as "@index"
            "@first": index === 0, // "@first" for first item
            "@last": index === items.length - 1, // "@last" for last item
          };

          // Recursively process inner content
          return this.processVariables(content, itemVars);
        })
        .join("");
    });
  }

  /**
   * Process variable substitutions
   */
  private static processVariables(
    template: string,
    variables: Record<string, unknown>,
  ): string {
    const variableRegex = /{{(\w+(?:\.\w+)*)\s*(?:\|\s*(\w+))?\s*}}/g;
    return template.replace(variableRegex, (_match, path, filter) => {
      let value = this.getNestedValue(variables, path);

      // Apply filter if specified
      if (filter) {
        value = this.applyFilter(value, filter);
      }

      return this.valueToString(value);
    });
  }

  /**
   * Get nested value from object using dot notation
   * Example: getNestedValue({user: {name: "Alice"}}, "user.name") → "Alice"
   */
  private static getNestedValue(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split(".");
    let current: any = obj;

    for (const part of parts) {
      if (current == null) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Apply simple filters
   */
  private static applyFilter(value: unknown, filter: string): unknown {
    const str = this.valueToString(value);

    switch (filter.toLowerCase()) {
      case "uppercase":
      case "upper":
        return str.toUpperCase();
      case "lowercase":
      case "lower":
        return str.toLowerCase();
      case "capitalize":
        return str.charAt(0).toUpperCase() + str.slice(1);
      case "trim":
        return str.trim();
      default:
        return value;
    }
  }

  /**
   * Check if value is truthy
   */
  private static isTruthy(value: unknown): boolean {
    return Boolean(value) && value !== "false" && value !== "0";
  }

  /**
   * Convert value to string safely
   */
  private static valueToString(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}

// ─── CHANNEL FORMATTER ───────────────────────────────────────────────────

/**
 * Formats notification content per channel
 * - EMAIL: HTML with headers, footers
 * - SMS: Plain text, max 160 chars
 * - PUSH: Rich card format
 * - WHATSAPP: Plain text, media support
 * - IN_APP: Rich HTML/Markdown
 * - SLACK: Markdown format
 */
export class ChannelFormatter {
  /**
   * Format content for specific channel
   */
  static format(
    content: string,
    channel: NotificationChannel,
    options?: { maxLength?: number; includeFooter?: boolean },
  ): string {
    const maxLength = options?.maxLength || this.getMaxLength(channel);

    switch (channel) {
      case "SMS":
        // Truncate to max length
        return content.substring(0, maxLength);

      case "EMAIL":
        // Wrap in HTML tags if not already HTML
        if (!content.includes("<html") && !content.includes("<body")) {
          return this.wrapEmailHTML(content);
        }
        return content;

      case "PUSH":
        // Remove HTML tags, keep plain text
        return this.stripHTML(content);

      case "WHATSAPP":
        // Remove HTML tags, convert to plain text
        return this.stripHTML(content);

      case "IN_APP":
        // Keep as-is (can be HTML or Markdown)
        return content;

      case "SLACK":
        // Convert to Slack Markdown
        return this.toSlackMarkdown(content);

      default:
        return content;
    }
  }

  /**
   * Get maximum content length per channel
   */
  private static getMaxLength(channel: NotificationChannel): number {
    switch (channel) {
      case "SMS":
        return 160; // SMS character limit
      case "PUSH":
        return 240; // Push notification title+body limit
      case "WHATSAPP":
        return 4096; // WhatsApp message limit
      default:
        return 65536; // Generous default
    }
  }

  /**
   * Wrap plain text in HTML email template
   */
  private static wrapEmailHTML(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .footer { color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    ${content.replace(/\n/g, "<br>")}
    <div class="footer">
      <p>This is an automated message. Please do not reply directly.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Strip HTML tags from content
   */
  private static stripHTML(content: string): string {
    return content.replace(/<[^>]*>/g, "").trim();
  }

  /**
   * Convert HTML to Slack Markdown
   */
  private static toSlackMarkdown(content: string): string {
    let result = content;

    // Convert HTML bold to Slack bold
    result = result.replace(/<b>(.*?)<\/b>/g, "*$1*");
    result = result.replace(/<strong>(.*?)<\/strong>/g, "*$1*");

    // Convert HTML italic to Slack italic
    result = result.replace(/<i>(.*?)<\/i>/g, "_$1_");
    result = result.replace(/<em>(.*?)<\/em>/g, "_$1_");

    // Convert HTML links to Slack links
    result = result.replace(/<a href="(.*?)">(.*?)<\/a>/g, "<$1|$2>");

    // Strip remaining HTML tags
    result = result.replace(/<[^>]*>/g, "");

    return result.trim();
  }
}

// ─── TEMPLATE REGISTRY ──────────────────────────────────────────────────

/**
 * In-memory template registry with CRUD operations and versioning
 */
export class TemplateRegistry {
  private templates: Map<string, NotificationTemplate[]> = new Map(); // templateId → versions

  /**
   * Create or update a template
   */
  async createTemplate(template: NotificationTemplate): Promise<void> {
    const key = template.id;
    const existing = this.templates.get(key) || [];

    // Set version if not provided
    if (!template.version) {
      template.version = existing.length + 1;
    }

    // Mark older versions as inactive
    existing.forEach((t) => (t.isActive = false));

    // Add new version
    existing.push(template);
    this.templates.set(key, existing);
  }

  /**
   * Get active template by ID
   */
  async getTemplate(
    templateId: string,
    locale?: string,
  ): Promise<NotificationTemplate | null> {
    const versions = this.templates.get(templateId);
    if (!versions) {
      return null;
    }

    // Find active version
    const active = versions.find((t) => t.isActive);
    if (!active) {
      return null;
    }

    // Check for locale variant
    if (locale && active.locales?.[locale]) {
      return active.locales[locale];
    }

    return active;
  }

  /**
   * Get specific template version
   */
  async getTemplateVersion(
    templateId: string,
    version: number,
  ): Promise<NotificationTemplate | null> {
    const versions = this.templates.get(templateId);
    return versions?.find((t) => t.version === version) || null;
  }

  /**
   * List all template versions
   */
  async listTemplateVersions(
    templateId: string,
  ): Promise<NotificationTemplate[]> {
    return this.templates.get(templateId) || [];
  }

  /**
   * Deactivate a template
   */
  async deactivateTemplate(templateId: string): Promise<void> {
    const versions = this.templates.get(templateId);
    if (versions) {
      versions.forEach((t) => (t.isActive = false));
    }
  }

  /**
   * Delete a template entirely
   */
  async deleteTemplate(templateId: string): Promise<void> {
    this.templates.delete(templateId);
  }
}

// ─── TEMPLATE VALIDATOR ──────────────────────────────────────────────────

/**
 * Validates templates and rendering
 */
export class TemplateValidator {
  /**
   * Validate template has all required metadata
   */
  static validateTemplate(template: NotificationTemplate): string[] {
    const errors: string[] = [];

    if (!template.id) {
      errors.push("Template must have an id");
    }

    if (!template.name) {
      errors.push("Template must have a name");
    }

    if (template.channels.length === 0) {
      errors.push("Template must define at least one channel variant");
    }

    template.channels.forEach((channel, index) => {
      if (!channel.body) {
        errors.push(`Channel ${channel.channel} variant ${index} missing body`);
      }

      // Validate SMS body length
      if (channel.channel === "SMS" && channel.body.length > 160) {
        errors.push(
          `SMS body for channel variant ${index} exceeds 160 characters`,
        );
      }

      // Validate PUSH body length
      if (channel.channel === "PUSH" && channel.body.length > 240) {
        errors.push(
          `Push body for channel variant ${index} exceeds 240 characters`,
        );
      }
    });

    return errors;
  }

  /**
   * Validate all required variables are provided
   */
  static validateVariables(
    template: NotificationTemplate,
    variables: Record<string, unknown>,
  ): string[] {
    const errors: string[] = [];
    const providedKeys = Object.keys(variables);

    for (const required of template.requiredVariables) {
      if (!providedKeys.includes(required)) {
        errors.push(`Missing required variable: ${required}`);
      }
    }

    return errors;
  }

  /**
   * Validate template can be rendered (check syntax)
   */
  static validateSyntax(template: NotificationTemplate): string[] {
    const errors: string[] = [];

    template.channels.forEach((channel, index) => {
      const syntaxErrors = this.validateHandlebarsSyntax(channel.body);
      syntaxErrors.forEach((err) => {
        errors.push(`Channel ${channel.channel} variant ${index}: ${err}`);
      });

      if (channel.htmlBody) {
        const htmlErrors = this.validateHandlebarsSyntax(channel.htmlBody);
        htmlErrors.forEach((err) => {
          errors.push(
            `Channel ${channel.channel} HTML variant ${index}: ${err}`,
          );
        });
      }
    });

    return errors;
  }

  /**
   * Validate Handlebars template syntax
   */
  private static validateHandlebarsSyntax(template: string): string[] {
    const errors: string[] = [];

    // Check for unclosed conditionals
    const ifCount = (template.match(/{{#if/g) || []).length;
    const ifCloseCount = (template.match(/{{\/if}}/g) || []).length;
    if (ifCount !== ifCloseCount) {
      errors.push(`Mismatched {{#if}} and {{/if}} tags`);
    }

    // Check for unclosed loops
    const eachCount = (template.match(/{{#each/g) || []).length;
    const eachCloseCount = (template.match(/{{\/each}}/g) || []).length;
    if (eachCount !== eachCloseCount) {
      errors.push(`Mismatched {{#each}} and {{/each}} tags`);
    }

    return errors;
  }
}

// ─── LOCALIZATION SUPPORT ───────────────────────────────────────────────

/**
 * Handle template localization
 */
export class TemplateLocalizer {
  private locales: Map<string, Map<string, NotificationTemplate>> = new Map();

  /**
   * Register a locale variant of a template
   */
  async registerLocale(
    templateId: string,
    locale: string,
    template: NotificationTemplate,
  ): Promise<void> {
    if (!this.locales.has(templateId)) {
      this.locales.set(templateId, new Map());
    }
    const templates = this.locales.get(templateId)!;
    templates.set(locale, template);
  }

  /**
   * Get template for locale, with fallback to default
   */
  async getLocalizedTemplate(
    templateId: string,
    locale: string,
    defaultTemplate: NotificationTemplate,
  ): Promise<NotificationTemplate> {
    const localeMap = this.locales.get(templateId);
    if (!localeMap) {
      return defaultTemplate;
    }

    // Try exact locale match
    if (localeMap.has(locale)) {
      return localeMap.get(locale)!;
    }

    // Try language prefix (e.g., "en" for "en-US")
    const languagePrefix = locale.split("-")[0];
    if (localeMap.has(languagePrefix)) {
      return localeMap.get(languagePrefix)!;
    }

    // Fall back to default
    return defaultTemplate;
  }

  /**
   * Get all registered locales for a template
   */
  async getAvailableLocales(templateId: string): Promise<string[]> {
    return Array.from(this.locales.get(templateId)?.keys() || []);
  }
}

// ─── TEMPLATE PREVIEW ───────────────────────────────────────────────────

/**
 * Generate preview of rendered template
 */
export class TemplatePreview {
  /**
   * Generate preview with sample variables
   */
  static generatePreview(
    template: NotificationTemplate,
    sampleVariables: Record<string, unknown>,
  ): Record<string, string> {
    const preview: Record<string, string> = {};

    template.channels.forEach((channel) => {
      const rendered = HandlebarsCompiler.compile(
        channel.body,
        sampleVariables,
      );
      const formatted = ChannelFormatter.format(rendered, channel.channel);
      preview[channel.channel] = formatted;
    });

    return preview;
  }
}
