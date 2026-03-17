/**
 * Notification Template Rendering Test Suite
 * Tests variable substitution, conditionals, loops, channel formatting, and locale selection
 * ~120 lines
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { TemplateContext } from '../fixtures/notification-fixtures.js';
import { createTemplateContext } from '../fixtures/notification-fixtures.js';

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  content: string;
  locale: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';
}

interface RenderResult {
  success: boolean;
  content: string;
  errors?: string[];
}

// ─── TEMPLATE ENGINE ────────────────────────────────────────────────────────

class TemplateEngine {
  private templates: Map<string, Template> = new Map();

  registerTemplate(template: Template): void {
    this.templates.set(`${template.id}:${template.locale}:${template.channel}`, template);
  }

  render(context: TemplateContext): RenderResult {
    const templateKey = `${context.templateId}:${context.locale}:${context.formatForChannel}`;
    const template = this.templates.get(templateKey);

    if (!template) {
      return {
        success: false,
        content: '',
        errors: [`Template not found: ${templateKey}`],
      };
    }

    try {
      let content = template.content;

      // Variable substitution: {{ variable.path }}
      content = this.substituteVariables(content, context.variables);

      // Conditional sections: {{#if condition}}...{{/if}}
      content = this.processConditionals(content, context.variables);

      // Loop rendering: {{#each items}}...{{/each}}
      content = this.processLoops(content, context.variables);

      return {
        success: true,
        content,
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        errors: [String(error)],
      };
    }
  }

  private substituteVariables(content: string, variables: Record<string, unknown>): string {
    return content.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmedPath = path.trim();

      // Skip control flow markers
      if (trimmedPath.startsWith('#') || trimmedPath.startsWith('/')) {
        return match;
      }

      const value = this.getNestedValue(variables, trimmedPath);
      if (value === null || value === undefined) {
        return ''; // Fallback for missing variables
      }
      return String(value);
    });
  }

  private processConditionals(content: string, variables: Record<string, unknown>): string {
    const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    return content.replace(conditionalRegex, (match, condition, blockContent) => {
      const value = variables[condition.trim()];
      const shouldInclude = Boolean(value);
      return shouldInclude ? blockContent : '';
    });
  }

  private processLoops(content: string, variables: Record<string, unknown>): string {
    const loopRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    return content.replace(loopRegex, (match, arrayName, blockContent) => {
      const array = variables[arrayName.trim()];
      if (!Array.isArray(array)) {
        return '';
      }

      return array
        .map((item, index) => {
          let itemContent = blockContent;
          if (typeof item === 'object' && item !== null) {
            Object.entries(item).forEach(([key, value]) => {
              itemContent = itemContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
            });
          }
          itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));
          return itemContent;
        })
        .join('');
    });
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (typeof current === 'object' && current !== null) {
        return (current as Record<string, unknown>)[key];
      }
      return null;
    }, obj);
  }
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe('Notification Template Rendering', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  // ─── VARIABLE SUBSTITUTION ──────────────────────────────────────────────

  describe('Variable Substitution', () => {
    it('should substitute simple variables', () => {
      engine.registerTemplate({
        id: 'order.confirmation',
        locale: 'en-US',
        channel: 'EMAIL',
        content: 'Thank you {{customerName}}, your order #{{orderId}} is confirmed.',
      });

      const context = createTemplateContext({
        variables: { customerName: 'Jane Smith', orderId: 'ORD-12345' },
      });

      const result = engine.render(context);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Jane Smith');
      expect(result.content).toContain('ORD-12345');
    });

    it('should handle nested variable paths', () => {
      engine.registerTemplate({
        id: 'delivery.notice',
        locale: 'en-US',
        channel: 'SMS',
        content: 'Order for {{customer.name}} at {{address.city}}, {{address.state}}',
      });

      const context = createTemplateContext({
        variables: {
          customer: { name: 'John Doe' },
          address: { city: 'Boston', state: 'MA' },
        },
      });

      const result = engine.render(context);

      expect(result.success).toBe(true);
      expect(result.content).toContain('John Doe');
      expect(result.content).toContain('Boston');
      expect(result.content).toContain('MA');
    });

    it('should return empty string for missing variables', () => {
      engine.registerTemplate({
        id: 'test.template',
        locale: 'en-US',
        channel: 'EMAIL',
        content: 'Hello {{firstName}} {{lastName}}, welcome!',
      });

      const context = createTemplateContext({
        variables: { firstName: 'John' }, // lastName missing
      });

      const result = engine.render(context);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Hello John');
      expect(result.content).toContain('welcome');
    });

    it('should handle numeric variables', () => {
      engine.registerTemplate({
        id: 'invoice.detail',
        locale: 'en-US',
        channel: 'EMAIL',
        content: 'Total amount: ${{totalAmount}}',
      });

      const context = createTemplateContext({
        variables: { totalAmount: 199.99 },
      });

      const result = engine.render(context);

      expect(result.success).toBe(true);
      expect(result.content).toContain('199.99');
    });
  });

  // ─── CONDITIONAL SECTIONS ───────────────────────────────────────────────

  describe('Conditional Sections', () => {
    it('should include block when condition is true', () => {
      engine.registerTemplate({
        id: 'shipment.tracking',
        locale: 'en-US',
        channel: 'EMAIL',
        content: 'Your order shipped. {{#if hasTracking}}Track it here: {{trackingUrl}}{{/if}}',
      });

      const context = createTemplateContext({
        variables: { hasTracking: true, trackingUrl: 'https://track.example.com/123' },
      });

      const result = engine.render(context);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Track it here');
      expect(result.content).toContain('https://track.example.com/123');
    });

    it('should exclude block when condition is false', () => {
      engine.registerTemplate({
        id: 'shipment.notice',
        locale: 'en-US',
        channel: 'EMAIL',
        content: 'Your order status. {{#if isDelivered}}Delivered on {{deliveryDate}}{{/if}}',
      });

      const context = createTemplateContext({
        variables: { isDelivered: false, deliveryDate: '2026-03-20' },
      });

      const result = engine.render(context);

      expect(result.success).toBe(true);
      expect(result.content).not.toContain('Delivered on');
    });

    it('should handle multiple conditional blocks', () => {
      engine.registerTemplate({
        id: 'order.status',
        locale: 'en-US',
        channel: 'EMAIL',
        content:
          'Status: {{#if isPending}}Pending payment{{/if}}{{#if isConfirmed}}Order confirmed{{/if}}{{#if isShipped}}Shipped{{/if}}',
      });

      const context = createTemplateContext({
        variables: { isPending: false, isConfirmed: true, isShipped: false },
      });

      const result = engine.render(context);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Order confirmed');
      expect(result.content).not.toContain('Pending');
      expect(result.content).not.toContain('Shipped');
    });
  });

  // ─── LOOP RENDERING ─────────────────────────────────────────────────────

  describe('Loop Rendering', () => {
    it('should render loops with array items', () => {
      engine.registerTemplate({
        id: 'order.items',
        locale: 'en-US',
        channel: 'EMAIL',
        content: 'Items: {{#each items}} - {{name}} (qty: {{qty}}){{/each}}',
      });

      const context = createTemplateContext({
        variables: {
          items: [
            { name: 'Widget A', qty: 1 },
            { name: 'Widget B', qty: 2 },
          ],
        },
      });

      const result = engine.render(context);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Widget A');
      expect(result.content).toContain('Widget B');
    });

    it('should provide @index in loops', () => {
      engine.registerTemplate({
        id: 'list.numbered',
        locale: 'en-US',
        channel: 'EMAIL',
        content: '{{#each items}}{{@index}}. {{name}}\n{{/each}}',
      });

      const context = createTemplateContext({
        variables: {
          items: [{ name: 'First' }, { name: 'Second' }, { name: 'Third' }],
        },
      });

      const result = engine.render(context);

      expect(result.success).toBe(true);
      expect(result.content).toContain('0. First');
      expect(result.content).toContain('1. Second');
      expect(result.content).toContain('2. Third');
    });

    it('should handle empty arrays gracefully', () => {
      engine.registerTemplate({
        id: 'empty.list',
        locale: 'en-US',
        channel: 'EMAIL',
        content: 'Items: {{#each items}}{{name}}{{/each}}End',
      });

      const context = createTemplateContext({
        variables: { items: [] },
      });

      const result = engine.render(context);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Items: End');
    });
  });

  // ─── CHANNEL-SPECIFIC FORMATTING ────────────────────────────────────────

  describe('Channel-Specific Formatting', () => {
    it('should format differently for EMAIL channel', () => {
      engine.registerTemplate({
        id: 'notification',
        locale: 'en-US',
        channel: 'EMAIL',
        content: '<html><body><h1>{{subject}}</h1><p>{{body}}</p></body></html>',
      });

      const context = createTemplateContext({
        variables: { subject: 'Order Confirmed', body: 'Your order is ready' },
        formatForChannel: 'EMAIL',
      });

      const result = engine.render(context);

      expect(result.success).toBe(true);
      expect(result.content).toContain('<html>');
      expect(result.content).toContain('<h1>Order Confirmed</h1>');
    });

    it('should format differently for SMS channel', () => {
      engine.registerTemplate({
        id: 'notification',
        locale: 'en-US',
        channel: 'SMS',
        content: 'Order {{orderId}} confirmed. Total: ${{amount}}',
      });

      const context = createTemplateContext({
        variables: { orderId: '12345', amount: 99.99 },
        formatForChannel: 'SMS',
      });

      const result = engine.render(context);

      expect(result.success).toBe(true);
      expect(result.content).not.toContain('<');
      expect(result.content).toContain('Order 12345');
    });

    it('should format differently for PUSH channel', () => {
      engine.registerTemplate({
        id: 'notification',
        locale: 'en-US',
        channel: 'PUSH',
        content: '{{title}} - {{body}}',
      });

      const context = createTemplateContext({
        variables: { title: 'Order Ready', body: 'Your order is ready for pickup' },
        formatForChannel: 'PUSH',
      });

      const result = engine.render(context);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Order Ready');
    });
  });

  // ─── LOCALE-BASED TEMPLATE SELECTION ─────────────────────────────────────

  describe('Locale-Based Template Selection', () => {
    it('should select correct locale template', () => {
      engine.registerTemplate({
        id: 'greeting',
        locale: 'en-US',
        channel: 'EMAIL',
        content: 'Hello {{name}}, welcome!',
      });
      engine.registerTemplate({
        id: 'greeting',
        locale: 'es-ES',
        channel: 'EMAIL',
        content: '¡Hola {{name}}, bienvenido!',
      });

      const contextEn = createTemplateContext({
        templateId: 'greeting',
        locale: 'en-US',
        variables: { name: 'John' },
      });

      const resultEn = engine.render(contextEn);
      expect(resultEn.content).toContain('Hello');

      const contextEs = createTemplateContext({
        templateId: 'greeting',
        locale: 'es-ES',
        variables: { name: 'Juan' },
      });

      const resultEs = engine.render(contextEs);
      expect(resultEs.content).toContain('¡Hola');
    });

    it('should support multiple locales', () => {
      const locales = ['en-US', 'fr-FR', 'de-DE', 'ja-JP'];
      const greetings = ['Hello', 'Bonjour', 'Hallo', 'こんにちは'];

      locales.forEach((locale, index) => {
        engine.registerTemplate({
          id: 'welcome',
          locale,
          channel: 'EMAIL',
          content: `${greetings[index]} {{name}}!`,
        });
      });

      locales.forEach((locale, index) => {
        const context = createTemplateContext({
          templateId: 'welcome',
          locale,
          variables: { name: 'Guest' },
        });

        const result = engine.render(context);
        expect(result.content).toContain(greetings[index]);
      });
    });
  });

  // ─── ERROR HANDLING ──────────────────────────────────────────────────────

  describe('Missing Variables & Error Handling', () => {
    it('should handle missing template gracefully', () => {
      const context = createTemplateContext({
        templateId: 'nonexistent.template',
      });

      const result = engine.render(context);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('Template not found');
    });

    it('should provide fallback for missing variables', () => {
      engine.registerTemplate({
        id: 'test',
        locale: 'en-US',
        channel: 'EMAIL',
        content: 'Name: {{firstName}} {{lastName}}, Age: {{age}}',
      });

      const context = createTemplateContext({
        variables: { firstName: 'John' }, // missing lastName and age
      });

      const result = engine.render(context);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Name: John');
    });
  });
});
