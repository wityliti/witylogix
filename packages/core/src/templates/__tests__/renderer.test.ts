/**
 * Template Rendering Engine Tests
 *
 * Comprehensive tests for the Handlebars-like template engine covering:
 * - Variable interpolation
 * - Nested property access
 * - HTML escaping and raw HTML output
 * - Conditionals (if/unless)
 * - Loops (each)
 * - Built-in helpers
 * - Error handling
 * - XSS prevention
 */

import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  extractTemplateVariables,
  validateTemplateVariables,
} from '../renderer';

// ─── Simple Variable Interpolation Tests ─────────────────

describe('renderTemplate - Simple Variables', () => {
  it('replaces simple variable', () => {
    const result = renderTemplate('Hello {{name}}', { name: 'John' });
    expect(result.html).toBe('Hello John');
    expect(result.errors).toEqual([]);
  });

  it('handles multiple variables', () => {
    const result = renderTemplate(
      'Hello {{firstName}} {{lastName}}',
      { firstName: 'John', lastName: 'Doe' }
    );
    expect(result.html).toBe('Hello John Doe');
  });

  it('handles numbers', () => {
    const result = renderTemplate('Count: {{count}}', { count: 42 });
    expect(result.html).toBe('Count: 42');
  });

  it('handles booleans', () => {
    const result = renderTemplate('Active: {{isActive}}', { isActive: true });
    expect(result.html).toBe('Active: true');
  });

  it('handles null/undefined gracefully', () => {
    const result = renderTemplate('Name: {{name}}', { name: null });
    expect(result.html).toBe('Name: null');
  });

  it('empty template returns empty output', () => {
    const result = renderTemplate('');
    expect(result.html).toBe('');
    expect(result.errors).toEqual([]);
  });

  it('template with only text passes through', () => {
    const result = renderTemplate('Just plain text here');
    expect(result.html).toBe('Just plain text here');
  });
});

// ─── Nested Property Access Tests ───────────────────────

describe('renderTemplate - Nested Properties', () => {
  it('accesses nested object properties', () => {
    const result = renderTemplate('Order: {{order.id}}', {
      order: { id: '123', total: 99.99 },
    });
    expect(result.html).toBe('Order: 123');
  });

  it('accesses deeply nested properties', () => {
    const result = renderTemplate('{{order.customer.name}}', {
      order: {
        customer: {
          name: 'Jane Smith',
        },
      },
    });
    expect(result.html).toBe('Jane Smith');
  });

  it('accesses multiple nested paths', () => {
    const result = renderTemplate(
      '{{order.customer.name}} - {{order.total}}',
      {
        order: {
          customer: { name: 'Jane', email: 'jane@example.com' },
          total: 49.99,
        },
      }
    );
    expect(result.html).toBe('Jane - 49.99');
  });

  it('returns undefined for missing intermediate properties', () => {
    const result = renderTemplate('{{order.customer.name}}', {
      order: {},
    });
    expect(result.html).toBe('');
    expect(result.errors).toContain('Undefined variable: order.customer.name');
  });

  it('handles null intermediate properties', () => {
    const result = renderTemplate('{{order.customer.name}}', {
      order: { customer: null },
    });
    expect(result.html).toBe('');
    expect(result.errors).toContain('Undefined variable: order.customer.name');
  });
});

// ─── HTML Escaping Tests ────────────────────────────────

describe('renderTemplate - HTML Escaping', () => {
  it('escapes HTML tags by default', () => {
    const result = renderTemplate('Content: {{html}}', {
      html: '<script>alert("xss")</script>',
    });
    expect(result.html).toBe('Content: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes ampersands', () => {
    const result = renderTemplate('{{text}}', { text: 'A & B' });
    expect(result.html).toBe('A &amp; B');
  });

  it('escapes quotes', () => {
    const result = renderTemplate('{{text}}', { text: 'Say "Hello"' });
    expect(result.html).toBe('Say &quot;Hello&quot;');
  });

  it('escapes single quotes', () => {
    const result = renderTemplate("{{text}}", { text: "It's working" });
    expect(result.html).toBe('It&#039;s working');
  });

  it('escapes all HTML special characters', () => {
    const result = renderTemplate('{{text}}', {
      text: '<div class="test">A & "quoted" text</div>',
    });
    expect(result.html).toContain('&lt;div');
    expect(result.html).toContain('&amp;');
    expect(result.html).toContain('&quot;');
    expect(result.html).toContain('&gt;');
  });

  it('prevents XSS via attribute injection', () => {
    const result = renderTemplate('{{danger}}', {
      danger: '"><script>alert("xss")</script>',
    });
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('prevents XSS via event handler', () => {
    const result = renderTemplate('{{danger}}', {
      danger: '" onload="alert(1)',
    });
    expect(result.html).not.toContain('" onload="');
    expect(result.html).toContain('&quot;');
  });
});

// ─── Raw HTML Tests ────────────────────────────────────

describe('renderTemplate - Raw HTML (Triple Braces)', () => {
  it('outputs raw HTML without escaping', () => {
    const result = renderTemplate('Content: {{{html}}}', {
      html: '<strong>Bold Text</strong>',
    });
    expect(result.html).toBe('Content: <strong>Bold Text</strong>');
  });

  it('raw HTML handles multiple usages', () => {
    const result = renderTemplate('{{{html1}}} and {{{html2}}}', {
      html1: '<em>italic</em>',
      html2: '<b>bold</b>',
    });
    expect(result.html).toBe('<em>italic</em> and <b>bold</b>');
  });

  it('raw HTML undefined variable returns error', () => {
    const result = renderTemplate('Content: {{{missing}}}', {});
    expect(result.errors).toContain('Undefined variable: missing');
    expect(result.html).toBe('Content: ');
  });

  it('raw HTML with XSS is unescaped', () => {
    const result = renderTemplate('{{{danger}}}', {
      danger: '<img src=x onerror=alert(1)>',
    });
    expect(result.html).toBe('<img src=x onerror=alert(1)>');
  });

  it('mixes escaped and raw HTML correctly', () => {
    const result = renderTemplate(
      '<div>{{escaped}} {{{raw}}}</div>',
      {
        escaped: '<script>',
        raw: '<strong>bold</strong>',
      }
    );
    expect(result.html).toBe(
      '<div>&lt;script&gt; <strong>bold</strong></div>'
    );
  });
});

// ─── Conditional Tests ──────────────────────────────────

describe('renderTemplate - Conditionals (if/unless)', () => {
  it('if block shows content when true', () => {
    const result = renderTemplate(
      '{{#if delivered}}Delivered!{{/if}}',
      { delivered: true }
    );
    expect(result.html).toBe('Delivered!');
  });

  it('if block hides content when false', () => {
    const result = renderTemplate(
      '{{#if delivered}}Delivered!{{/if}}',
      { delivered: false }
    );
    expect(result.html).toBe('');
  });

  it('if block hides content when undefined', () => {
    const result = renderTemplate(
      '{{#if delivered}}Delivered!{{/if}}',
      {}
    );
    expect(result.html).toBe('');
  });

  it('unless block shows content when false', () => {
    const result = renderTemplate(
      '{{#unless cancelled}}Active{{/unless}}',
      { cancelled: false }
    );
    expect(result.html).toBe('Active');
  });

  it('unless block hides content when true', () => {
    const result = renderTemplate(
      '{{#unless cancelled}}Active{{/unless}}',
      { cancelled: true }
    );
    expect(result.html).toBe('');
  });

  it('nested conditionals work', () => {
    const result = renderTemplate(
      '{{#if order}}Order: {{order.id}}{{/if}}',
      { order: { id: 'ORD-1', confirmed: true } }
    );
    expect(result.html).toBe('Order: ORD-1');
  });

  it('if treats non-empty strings as truthy', () => {
    const result = renderTemplate(
      '{{#if text}}Content: {{text}}{{/if}}',
      { text: 'hello' }
    );
    expect(result.html).toBe('Content: hello');
  });

  it('if treats empty string as falsy', () => {
    const result = renderTemplate(
      '{{#if text}}Content{{/if}}',
      { text: '' }
    );
    expect(result.html).toBe('');
  });

  it('if treats zero as falsy', () => {
    const result = renderTemplate(
      '{{#if count}}{{count}}{{/if}}',
      { count: 0 }
    );
    expect(result.html).toBe('');
  });

  it('if treats non-empty array as truthy', () => {
    const result = renderTemplate(
      '{{#if items}}Has items{{/if}}',
      { items: [1, 2, 3] }
    );
    expect(result.html).toBe('Has items');
  });

  it('if treats empty array as falsy', () => {
    const result = renderTemplate(
      '{{#if items}}Has items{{/if}}',
      { items: [] }
    );
    expect(result.html).toBe('');
  });
});

// ─── Loop Tests ─────────────────────────────────────────

describe('renderTemplate - Loops (each)', () => {
  it('each repeats content for array items', () => {
    const result = renderTemplate(
      '{{#each names}}{{this}}, {{/each}}',
      { names: ['Alice', 'Bob', 'Charlie'] }
    );
    expect(result.html).toBe('Alice, Bob, Charlie, ');
  });

  it('each with object access', () => {
    const result = renderTemplate(
      '{{#each items}}{{this.name}}={{this.qty}} {{/each}}',
      {
        items: [
          { name: 'Apple', qty: 5 },
          { name: 'Orange', qty: 3 },
        ],
      }
    );
    expect(result.html).toBe('Apple=5 Orange=3 ');
  });

  it('each provides @index', () => {
    const result = renderTemplate(
      '{{#each items}}Item {{@index}}: {{this}} {{/each}}',
      { items: ['A', 'B', 'C'] }
    );
    expect(result.html).toBe('Item 0: A Item 1: B Item 2: C ');
  });

  it('each provides @first', () => {
    const result = renderTemplate(
      '{{#each items}}{{@first}}{{this}} {{/each}}',
      { items: ['A', 'B', 'C'] }
    );
    expect(result.html).toContain('trueA');
    expect(result.html).not.toContain('trueB');
  });

  it('each provides @last', () => {
    const result = renderTemplate(
      '{{#each items}}{{this}}{{@last}} {{/each}}',
      { items: ['A', 'B', 'C'] }
    );
    expect(result.html).toContain('Ctrue');
    expect(result.html).not.toContain('Btrue');
  });

  it('each with empty array returns nothing', () => {
    const result = renderTemplate(
      '{{#each items}}{{this}}{{/each}}',
      { items: [] }
    );
    expect(result.html).toBe('');
  });

  it('each with non-array is ignored', () => {
    const result = renderTemplate(
      '{{#each items}}{{this}}{{/each}}',
      { items: 'not an array' }
    );
    expect(result.html).toBe('');
  });

  it('each with nested objects', () => {
    const result = renderTemplate(
      '{{#each orders}}Order {{this.id}}: {{this.customerName}} {{/each}}',
      {
        orders: [
          { id: '1', customerName: 'John' },
          { id: '2', customerName: 'Jane' },
        ],
      }
    );
    expect(result.html).toBe('Order 1: John Order 2: Jane ');
  });
});

// ─── Helper Function Tests ──────────────────────────────

describe('renderTemplate - Helper Functions', () => {
  it('formatCurrency helper', () => {
    const result = renderTemplate('Price: {{formatCurrency price}}', {
      price: 42.5,
    });
    expect(result.html).toContain('$42.50');
  });

  it('formatDate helper', () => {
    const result = renderTemplate('Date: {{formatDate date}}', {
      date: '2026-03-06T10:30:00Z',
    });
    expect(result.html).toContain('3/6/2026');
  });

  it('formatDatetime helper', () => {
    const result = renderTemplate('DateTime: {{formatDatetime datetime}}', {
      datetime: '2026-03-06T10:30:00Z',
    });
    expect(result.html).toContain('2026');
    expect(result.html).toMatch(/\d{1,2}:\d{2}/);
  });

  it('uppercase helper', () => {
    const result = renderTemplate('Upper: {{uppercase text}}', {
      text: 'hello',
    });
    expect(result.html).toBe('Upper: HELLO');
  });

  it('lowercase helper', () => {
    const result = renderTemplate('Lower: {{lowercase text}}', {
      text: 'HELLO',
    });
    expect(result.html).toBe('Lower: hello');
  });

  it('capitalize helper', () => {
    const result = renderTemplate('Cap: {{capitalize text}}', {
      text: 'hello WORLD',
    });
    expect(result.html).toBe('Cap: Hello world');
  });

  it('formatCurrency with invalid input', () => {
    const result = renderTemplate('Price: {{formatCurrency price}}', {
      price: 'notanumber',
    });
    expect(result.html).toContain('NaN');
  });

  it('formatDate with invalid date', () => {
    const result = renderTemplate('Date: {{formatDate date}}', {
      date: 'invalid-date',
    });
    expect(result.html).toContain('[Invalid Date]');
  });

  it('helpers with undefined variables show error', () => {
    const result = renderTemplate('{{formatCurrency missing}}', {});
    expect(result.errors).toContain('Undefined variable: missing');
  });
});

// ─── Complex Template Tests ─────────────────────────────

describe('renderTemplate - Complex Templates', () => {
  it('order confirmation email template', () => {
    const result = renderTemplate(
      `Hi {{customer.name}},

Your order #{{orderId}} has been confirmed!

Items:
{{#each items}}
- {{this.name}} x {{this.quantity}} @ {{formatCurrency this.price}}
{{/each}}

{{#if express}}
Express shipping selected.
{{/if}}

Total: {{formatCurrency total}}

{{#unless cancelled}}
Thank you for your business!
{{/unless}}`,
      {
        customer: { name: 'Jane Doe' },
        orderId: '12345',
        items: [
          { name: 'Widget', quantity: 2, price: 29.99 },
          { name: 'Gadget', quantity: 1, price: 49.99 },
        ],
        express: true,
        total: 109.97,
        cancelled: false,
      }
    );

    expect(result.html).toContain('Hi Jane Doe');
    expect(result.html).toContain('order #12345');
    expect(result.html).toContain('Express shipping');
    expect(result.html).toContain('Thank you');
  });

  it('shipment status update template', () => {
    const result = renderTemplate(
      `Your shipment {{shipmentId}} is {{status}}.

{{#if outForDelivery}}
It will arrive {{#if deliveryDate}}on {{formatDate deliveryDate}}{{/if}}.
Driver: {{driver.name}} ({{driver.phone}})
{{/if}}

{{#if delivered}}
Delivered on {{formatDate actualDelivery}}.
{{/if}}

{{#if cancelled}}
This shipment has been cancelled.
{{/if}}`,
      {
        shipmentId: 'SHP-ABC123',
        status: 'OUT_FOR_DELIVERY',
        outForDelivery: true,
        deliveryDate: '2026-03-07T14:00:00Z',
        driver: { name: 'John Smith', phone: '+1234567890' },
        delivered: false,
        cancelled: false,
      }
    );

    expect(result.html).toContain('SHP-ABC123');
    expect(result.html).toContain('OUT_FOR_DELIVERY');
    expect(result.html).toContain('John Smith');
    expect(result.html).toContain('+1234567890');
  });

  it('receipt template with single loop', () => {
    const result = renderTemplate(
      `RECEIPT
{{#each items}}
  {{this.sku}} - {{formatCurrency this.price}} x{{this.qty}}
{{/each}}`,
      {
        items: [
          { sku: 'APPLE', price: 1.5, qty: 3 },
          { sku: 'ORANGE', price: 2.0, qty: 2 },
          { sku: 'BANANA', price: 0.99, qty: 1 },
        ],
      }
    );

    expect(result.html).toContain('APPLE');
    expect(result.html).toContain('ORANGE');
    expect(result.html).toContain('BANANA');
  });
});

// ─── Text Extraction Tests ──────────────────────────────

describe('renderTemplate - Text Version', () => {
  it('extracts text without HTML tags', () => {
    const result = renderTemplate(
      'Hello <b>{{name}}</b>!',
      { name: 'John' }
    );
    expect(result.text).toBe('Hello John!');
    expect(result.text).not.toContain('<b>');
  });

  it('text version with complex HTML', () => {
    const result = renderTemplate(
      '<div><p>Dear {{name}},</p><p>Thank you!</p></div>',
      { name: 'Jane' }
    );
    expect(result.text).toBe('Dear Jane,Thank you!');
  });
});

// ─── Extract Template Variables Tests ────────────────────

describe('extractTemplateVariables', () => {
  it('extracts simple variables', () => {
    const vars = extractTemplateVariables('Hello {{name}}, you have {{count}} items');
    expect(vars.map(v => v.name)).toContain('name');
    expect(vars.map(v => v.name)).toContain('count');
  });

  it('extracts nested variables', () => {
    const vars = extractTemplateVariables('Order: {{order.id}} Customer: {{order.customer.name}}');
    expect(vars.map(v => v.name)).toContain('order.id');
    expect(vars.map(v => v.name)).toContain('order.customer.name');
  });

  it('extracts variables from conditionals', () => {
    const vars = extractTemplateVariables('{{#if delivered}}Delivered{{/if}}');
    expect(vars.map(v => v.name)).toContain('delivered');
  });

  it('extracts variables from loops', () => {
    const vars = extractTemplateVariables('{{#each items}}{{this.name}}{{/each}}');
    expect(vars.map(v => v.name)).toContain('items');
  });

  it('marks conditional variables as optional', () => {
    const vars = extractTemplateVariables(
      'Always: {{required}} {{#if optional}}Optional{{/if}}'
    );
    const requiredVar = vars.find(v => v.name === 'required');
    const optionalVar = vars.find(v => v.name === 'optional');

    expect(requiredVar?.required).toBe(true);
    expect(optionalVar?.required).toBe(false);
  });

  it('deduplicates variables', () => {
    const vars = extractTemplateVariables('{{name}} Hello {{name}} again {{name}}');
    const nameVars = vars.filter(v => v.name === 'name');
    expect(nameVars).toHaveLength(1);
  });

  it('extracts variables from helper calls', () => {
    const vars = extractTemplateVariables('{{formatCurrency price}}');
    expect(vars.map(v => v.name)).toContain('formatCurrency');
  });
});

// ─── Validate Template Variables Tests ──────────────────

describe('validateTemplateVariables', () => {
  it('accepts when all required variables provided', () => {
    const errors = validateTemplateVariables(
      'Hello {{name}}',
      { name: 'John' }
    );
    expect(errors).toEqual([]);
  });

  it('reports missing required variables', () => {
    const errors = validateTemplateVariables(
      'Hello {{name}}',
      {}
    );
    expect(errors).toContain('Required variable missing: name');
  });

  it('allows missing optional variables', () => {
    const errors = validateTemplateVariables(
      'Hello {{#if name}}{{name}}{{/if}}',
      {}
    );
    expect(errors).toEqual([]);
  });

  it('reports multiple missing variables', () => {
    const errors = validateTemplateVariables(
      'From: {{sender}} To: {{recipient}}',
      {}
    );
    expect(errors.length).toBe(2);
    expect(errors).toContain('Required variable missing: sender');
    expect(errors).toContain('Required variable missing: recipient');
  });

  it('validates nested variable requirements', () => {
    const errors = validateTemplateVariables(
      'Order: {{order.id}}',
      {}
    );
    expect(errors).toContain('Required variable missing: order.id');
  });

  it('accepts partial data for nested paths', () => {
    const errors = validateTemplateVariables(
      'Order: {{order.id}}',
      { 'order.id': '123' }
    );
    expect(errors).toEqual([]);
  });
});

// ─── Error Handling Tests ───────────────────────────────

describe('renderTemplate - Error Handling', () => {
  it('reports undefined simple variables', () => {
    const result = renderTemplate('Name: {{name}}', {});
    expect(result.errors).toContain('Undefined variable: name');
  });

  it('reports multiple undefined variables', () => {
    const result = renderTemplate(
      '{{firstName}} {{lastName}}',
      {}
    );
    expect(result.errors.length).toBe(2);
  });

  it('reports undefined variables in helpers', () => {
    const result = renderTemplate('{{formatCurrency total}}', {});
    expect(result.errors).toContain('Undefined variable: total');
  });

  it('continues rendering on errors', () => {
    const result = renderTemplate(
      'Start {{missing}} End',
      {}
    );
    expect(result.html).toBe('Start  End');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('does not report errors for undefined optional variables', () => {
    const result = renderTemplate(
      '{{#if optional}}{{optional}}{{/if}}',
      {}
    );
    expect(result.errors).toEqual([]);
  });
});

// ─── XSS Attack Prevention Tests ────────────────────────

describe('renderTemplate - XSS Prevention', () => {
  it('prevents script injection in variables', () => {
    const result = renderTemplate(
      'Content: {{userInput}}',
      { userInput: '<script>alert("xss")</script>' }
    );
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('prevents event handler injection', () => {
    const result = renderTemplate(
      '{{userInput}}',
      { userInput: '" onload="alert(1)' }
    );
    expect(result.html).not.toContain('" onload="');
    expect(result.html).toContain('&quot;');
  });

  it('prevents iframe injection', () => {
    const result = renderTemplate(
      '{{userInput}}',
      { userInput: '<iframe src="evil.com"></iframe>' }
    );
    expect(result.html).not.toContain('<iframe');
    expect(result.html).toContain('&lt;iframe');
  });

  it('prevents SVG injection', () => {
    const result = renderTemplate(
      '{{userInput}}',
      { userInput: '<svg onload=alert(1)>' }
    );
    expect(result.html).not.toContain('<svg');
    expect(result.html).toContain('&lt;svg');
  });

  it('escapes in conditional blocks', () => {
    const result = renderTemplate(
      '{{#if show}}{{content}}{{/if}}',
      { show: true, content: '<script>alert(1)</script>' }
    );
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('renders items in loops', () => {
    const result = renderTemplate(
      '{{#each items}}{{this}} {{/each}}',
      {
        items: ['Alpha', 'Beta', 'Gamma'],
      }
    );
    expect(result.html).toContain('Alpha');
    expect(result.html).toContain('Beta');
    expect(result.html).toContain('Gamma');
  });

  it('raw HTML preserves safety responsibility to template author', () => {
    const result = renderTemplate(
      '{{{userHTML}}}',
      { userHTML: '<img src=x onerror=alert(1)>' }
    );
    expect(result.html).toBe('<img src=x onerror=alert(1)>');
  });
});

// ─── Edge Cases ─────────────────────────────────────────

describe('renderTemplate - Edge Cases', () => {
  it('handles null in nested path', () => {
    const result = renderTemplate(
      '{{order.customer.name}}',
      { order: { customer: null } }
    );
    expect(result.html).toBe('');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles missing intermediate properties', () => {
    const result = renderTemplate(
      '{{order.customer.name}}',
      { order: {} }
    );
    expect(result.html).toBe('');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles objects in variable output', () => {
    const result = renderTemplate(
      'Data: {{data}}',
      { data: { id: '123', name: 'Test' } }
    );
    expect(result.html).toContain('id');
    expect(result.html).toContain('123');
  });

  it('handles arrays in variable output', () => {
    const result = renderTemplate(
      'List: {{items}}',
      { items: ['a', 'b', 'c'] }
    );
    expect(result.html).toContain('a');
    expect(result.html).toContain('b');
  });

  it('handles whitespace preservation', () => {
    const result = renderTemplate(
      'Line 1\nLine 2\n  Indented',
      {}
    );
    expect(result.html).toContain('\n');
    expect(result.html).toContain('  Indented');
  });

  it('handles special regex characters in template', () => {
    const result = renderTemplate(
      'Pattern: (test) [example] {item}',
      {}
    );
    expect(result.html).toBe('Pattern: (test) [example] {item}');
  });

  it('handles multiple consecutive braces', () => {
    const result = renderTemplate(
      'JSON: {{json}}',
      { json: '{"key":"value"}' }
    );
    expect(result.html).toContain('&quot;');
  });
});
