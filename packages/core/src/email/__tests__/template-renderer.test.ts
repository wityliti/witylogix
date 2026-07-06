import { describe, it, expect, beforeEach } from "vitest";

interface RenderContext {
  [key: string]: any;
}

interface ParsedTemplate {
  type: "text" | "variable" | "conditional" | "each" | "helper";
  value?: string;
  condition?: string;
  iterableKey?: string;
  helperName?: string;
  children?: ParsedTemplate[];
}

class TemplateRenderer {
  private helpers: {
    [key: string]: (value: any) => string;
  };

  constructor() {
    this.helpers = {
      formatDate: (date: any) => {
        if (!date) return "";
        return new Date(date).toLocaleDateString();
      },
      formatCurrency: (amount: any) => {
        if (!amount) return "";
        return `$${parseFloat(amount).toFixed(2)}`;
      },
      uppercase: (value: any) => {
        if (!value) return "";
        return String(value).toUpperCase();
      },
    };
  }

  render(template: string, context: RenderContext): string {
    return this.renderNode(template, context);
  }

  private renderNode(template: string, context: RenderContext): string {
    let result = "";
    let i = 0;

    while (i < template.length) {
      // Handle raw unescaped variables {{{variable}}}
      if (template.substring(i, i + 3) === "{{{") {
        const endIndex = template.indexOf("}}}", i + 3);
        if (endIndex !== -1) {
          const varName = template.substring(i + 3, endIndex).trim();
          const value = this.getNestedValue(context, varName);
          result += value !== undefined ? String(value) : "";
          i = endIndex + 3;
          continue;
        }
      }

      // Handle conditionals {{#if condition}}...{{/if}}
      if (template.substring(i, i + 5) === "{{#if") {
        const match = template
          .substring(i)
          .match(/^\{\{#if\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/if\}\}/);
        if (match) {
          const [fullMatch, condition, content] = match;
          const condValue = this.getNestedValue(context, condition);
          if (this.isTruthy(condValue)) {
            result += this.renderNode(content, context);
          }
          i += fullMatch.length;
          continue;
        }
      }

      // Handle each loops {{#each items}}...{{/each}}
      if (template.substring(i, i + 7) === "{{#each") {
        const headerMatch = template
          .substring(i)
          .match(/^\{\{#each\s+(\w+(?:\.\w+)*)\}\}/);
        if (headerMatch) {
          const iterableKey = headerMatch[1];
          const contentStart = i + headerMatch[0].length;
          const contentEnd = this.findMatchingEachEnd(template, contentStart);
          if (contentEnd !== -1) {
            const content = template.substring(contentStart, contentEnd);
            const iterable = this.getNestedValue(context, iterableKey);
            if (Array.isArray(iterable)) {
              iterable.forEach((item) => {
                result += this.renderNode(content, { ...context, this: item });
              });
            }
            i = contentEnd + 9; // skip past '{{/each}}'
            continue;
          }
        }
      }

      // Handle helper functions {{helperName variable}}
      const helperMatch = template
        .substring(i)
        .match(/^\{\{(\w+)\s+(\w+(?:\.\w+)*)\}\}/);
      if (helperMatch) {
        const [fullMatch, helperName, varName] = helperMatch;
        if (this.helpers[helperName]) {
          const value = this.getNestedValue(context, varName);
          result += this.helpers[helperName](value);
          i += fullMatch.length;
          continue;
        }
      }

      // Handle regular variables {{variable}}
      if (template.substring(i, i + 2) === "{{") {
        const endIndex = template.indexOf("}}", i + 2);
        if (endIndex !== -1) {
          const varName = template.substring(i + 2, endIndex).trim();
          const value = this.getNestedValue(context, varName);
          const escaped =
            value !== undefined ? this.escapeHtml(String(value)) : "";
          result += escaped;
          i = endIndex + 2;
          continue;
        }
      }

      result += template[i];
      i++;
    }

    return result;
  }

  private findMatchingEachEnd(template: string, startAfter: number): number {
    let depth = 1;
    let i = startAfter;
    while (i < template.length && depth > 0) {
      const eachOpen = template.indexOf("{{#each ", i);
      const eachClose = template.indexOf("{{/each}}", i);

      if (eachClose === -1) return -1;

      if (eachOpen !== -1 && eachOpen < eachClose) {
        depth++;
        i = eachOpen + 8;
      } else {
        depth--;
        if (depth === 0) return eachClose;
        i = eachClose + 9;
      }
    }
    return -1;
  }

  private getNestedValue(context: RenderContext, path: string): any {
    const parts = path.split(".");
    let current = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  private isTruthy(value: any): boolean {
    return !!value;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}

describe("TemplateRenderer", () => {
  let renderer: TemplateRenderer;

  beforeEach(() => {
    renderer = new TemplateRenderer();
  });

  describe("Variable Substitution", () => {
    it("should replace simple variables with values", () => {
      const template = "Hello {{name}}!";
      const context = { name: "John" };
      expect(renderer.render(template, context)).toBe("Hello John!");
    });

    it("should replace multiple variables in one template", () => {
      const template = "{{firstName}} {{lastName}} is {{age}} years old";
      const context = { firstName: "John", lastName: "Doe", age: 30 };
      expect(renderer.render(template, context)).toBe(
        "John Doe is 30 years old",
      );
    });

    it("should return empty string for missing variables", () => {
      const template = "Hello {{name}}!";
      const context = {};
      expect(renderer.render(template, context)).toBe("Hello !");
    });

    it("should handle numeric values", () => {
      const template = "Count: {{count}}";
      const context = { count: 42 };
      expect(renderer.render(template, context)).toBe("Count: 42");
    });

    it("should handle boolean values", () => {
      const template = "Active: {{active}}";
      const context = { active: true };
      expect(renderer.render(template, context)).toBe("Active: true");
    });

    it("should handle whitespace around variable names", () => {
      const template = "Hello {{ name }}!";
      const context = { name: "John" };
      expect(renderer.render(template, context)).toBe("Hello John!");
    });
  });

  describe("Nested Variables", () => {
    it("should resolve nested object properties", () => {
      const template = "Order ID: {{order.id}}";
      const context = { order: { id: "ORD123" } };
      expect(renderer.render(template, context)).toBe("Order ID: ORD123");
    });

    it("should resolve deeply nested properties", () => {
      const template = "Customer: {{order.customer.name}}";
      const context = {
        order: { customer: { name: "Jane Doe" } },
      };
      expect(renderer.render(template, context)).toBe("Customer: Jane Doe");
    });

    it("should return empty string for missing nested properties", () => {
      const template = "Customer: {{order.customer.name}}";
      const context = { order: {} };
      expect(renderer.render(template, context)).toBe("Customer: ");
    });

    it("should handle deeply missing paths gracefully", () => {
      const template = "Value: {{a.b.c.d.e}}";
      const context = { a: { b: null } };
      expect(renderer.render(template, context)).toBe("Value: ");
    });
  });

  describe("Conditional Blocks", () => {
    it("should render content when condition is true", () => {
      const template = "{{#if paid}}Order is paid{{/if}}";
      const context = { paid: true };
      expect(renderer.render(template, context)).toBe("Order is paid");
    });

    it("should not render content when condition is false", () => {
      const template = "{{#if paid}}Order is paid{{/if}}";
      const context = { paid: false };
      expect(renderer.render(template, context)).toBe("");
    });

    it("should handle multiple conditionals", () => {
      const template =
        "{{#if premium}}Premium Member{{/if}} {{#if active}}Active{{/if}}";
      const context = { premium: true, active: true };
      expect(renderer.render(template, context)).toBe("Premium Member Active");
    });

    it("should treat falsy values as false in conditionals", () => {
      const template = "{{#if value}}Has value{{/if}}";
      expect(renderer.render(template, { value: 0 })).toBe("");
      expect(renderer.render(template, { value: "" })).toBe("");
      expect(renderer.render(template, { value: null })).toBe("");
      expect(renderer.render(template, { value: undefined })).toBe("");
    });

    it("should allow variables within conditional blocks", () => {
      const template =
        "{{#if premium}}Welcome {{name}}, premium member!{{/if}}";
      const context = { premium: true, name: "John" };
      expect(renderer.render(template, context)).toBe(
        "Welcome John, premium member!",
      );
    });
  });

  describe("Each Loops", () => {
    it("should iterate over array items", () => {
      const template = "{{#each items}}{{this}} {{/each}}";
      const context = { items: ["apple", "banana", "cherry"] };
      expect(renderer.render(template, context)).toBe("apple banana cherry ");
    });

    it("should handle each with object properties", () => {
      const template = "{{#each items}}{{this.name}}: {{this.price}} {{/each}}";
      const context = {
        items: [
          { name: "Item1", price: "10" },
          { name: "Item2", price: "20" },
        ],
      };
      expect(renderer.render(template, context)).toBe("Item1: 10 Item2: 20 ");
    });

    it("should handle nested each loops", () => {
      const template =
        "{{#each orders}}Order {{this.id}}: {{#each this.items}}{{this}} {{/each}}| {{/each}}";
      const context = {
        orders: [
          { id: "1", items: ["a", "b"] },
          { id: "2", items: ["c"] },
        ],
      };
      expect(renderer.render(template, context)).toBe(
        "Order 1: a b | Order 2: c | ",
      );
    });

    it("should not render content for empty arrays", () => {
      const template = "{{#each items}}{{this}}{{/each}}Empty";
      const context = { items: [] };
      expect(renderer.render(template, context)).toBe("Empty");
    });

    it("should handle each with single item", () => {
      const template = "{{#each items}}Item: {{this}}{{/each}}";
      const context = { items: ["only"] };
      expect(renderer.render(template, context)).toBe("Item: only");
    });
  });

  describe("Built-in Helpers", () => {
    it("should format dates with formatDate helper", () => {
      const template = "Date: {{formatDate createdAt}}";
      const context = { createdAt: "2026-03-06" };
      expect(renderer.render(template, context)).toContain("3/6/2026");
    });

    it("should format currency with formatCurrency helper", () => {
      const template = "Total: {{formatCurrency amount}}";
      const context = { amount: 99.5 };
      expect(renderer.render(template, context)).toBe("Total: $99.50");
    });

    it("should uppercase text with uppercase helper", () => {
      const template = "Status: {{uppercase status}}";
      const context = { status: "active" };
      expect(renderer.render(template, context)).toBe("Status: ACTIVE");
    });

    it("should handle missing values in helpers", () => {
      const template = "Price: {{formatCurrency price}}";
      const context = {};
      expect(renderer.render(template, context)).toBe("Price: ");
    });

    it("should chain helpers with other content", () => {
      const template =
        "Your order of {{formatCurrency total}} on {{formatDate date}}";
      const context = { total: 150.75, date: "2026-03-06" };
      const result = renderer.render(template, context);
      expect(result).toContain("$150.75");
      expect(result).toContain("3/6/2026");
    });
  });

  describe("HTML Escaping", () => {
    it("should escape HTML special characters in variables", () => {
      const template = "Content: {{content}}";
      const context = { content: '<script>alert("xss")</script>' };
      expect(renderer.render(template, context)).toBe(
        "Content: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
      );
    });

    it("should escape ampersands", () => {
      const template = "{{text}}";
      const context = { text: "A & B" };
      expect(renderer.render(template, context)).toBe("A &amp; B");
    });

    it("should escape quotes", () => {
      const template = "{{text}}";
      const context = { text: 'He said "hello"' };
      expect(renderer.render(template, context)).toBe(
        "He said &quot;hello&quot;",
      );
    });

    it("should escape single quotes", () => {
      const template = "{{text}}";
      const context = { text: "It's fine" };
      expect(renderer.render(template, context)).toBe("It&#039;s fine");
    });

    it("should render unescaped content with triple braces", () => {
      const template = "HTML: {{{html}}}";
      const context = { html: "<b>bold</b>" };
      expect(renderer.render(template, context)).toBe("HTML: <b>bold</b>");
    });

    it("should handle mixed escaped and unescaped content", () => {
      const template = "Safe: {{safe}} Unsafe: {{{unsafe}}}";
      const context = {
        safe: "<div>",
        unsafe: "<div>",
      };
      expect(renderer.render(template, context)).toBe(
        "Safe: &lt;div&gt; Unsafe: <div>",
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle templates with no variables", () => {
      const template = "Plain text template";
      const context = {};
      expect(renderer.render(template, context)).toBe("Plain text template");
    });

    it("should handle empty template", () => {
      const template = "";
      const context = { name: "John" };
      expect(renderer.render(template, context)).toBe("");
    });

    it("should handle context with extra unused properties", () => {
      const template = "Name: {{name}}";
      const context = { name: "John", unused: "value", another: "unused" };
      expect(renderer.render(template, context)).toBe("Name: John");
    });

    it("should handle malformed braces gracefully", () => {
      const template = "Test {{ not closed";
      const context = {};
      expect(renderer.render(template, context)).toBe("Test {{ not closed");
    });

    it("should handle consecutive variables", () => {
      const template = "{{first}}{{second}}{{third}}";
      const context = { first: "a", second: "b", third: "c" };
      expect(renderer.render(template, context)).toBe("abc");
    });

    it("should handle very long templates", () => {
      let template = "";
      const context: any = {};
      for (let i = 0; i < 100; i++) {
        template += `Item {{item${i}}} `;
        context[`item${i}`] = `value${i}`;
      }
      const result = renderer.render(template, context);
      expect(result).toContain("Item value0");
      expect(result).toContain("Item value99");
    });

    it("should handle special characters in context values", () => {
      const template = "Message: {{message}}";
      const context = { message: "日本語テキスト" };
      expect(renderer.render(template, context)).toBe(
        "Message: 日本語テキスト",
      );
    });
  });
});
