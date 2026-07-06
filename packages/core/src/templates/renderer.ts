/**
 * Template Rendering Engine
 *
 * Supports:
 * - Variable interpolation: {{variableName}}, {{nested.path}}
 * - Conditional blocks: {{#if condition}}...{{/if}}
 * - Loop support: {{#each array}}...{{/each}}
 * - HTML escaping (default), raw HTML with {{{rawHtml}}}
 * - Built-in helpers: {{formatCurrency}}, {{formatDate}}, {{uppercase}}
 */

export interface TemplateVariable {
  name: string;
  description?: string;
  required?: boolean;
}

export interface RenderResult {
  html: string;
  text: string;
  errors: string[];
}

// HTML escaping
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// Get nested value from object
function getNestedValue(obj: Record<string, any>, path: string): unknown {
  const keys = path.split(".");
  let value: any = obj;
  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  return value;
}

// Check if value is truthy for conditionals
function isTruthy(value: unknown): boolean {
  if (value === false || value === null || value === undefined) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "string") {
    return value.length > 0;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return !!value;
}

// Built-in helpers
function formatCurrency(amount: number, currency: string = "USD"): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  });
  return formatter.format(amount);
}

function formatDate(date: string | Date, locale: string = "en-US"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    return "[Invalid Date]";
  }
  return d.toLocaleDateString(locale);
}

function formatDatetime(date: string | Date, locale: string = "en-US"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    return "[Invalid Date]";
  }
  return d.toLocaleString(locale);
}

function uppercase(text: string): string {
  return String(text).toUpperCase();
}

function lowercase(text: string): string {
  return String(text).toLowerCase();
}

function capitalize(text: string): string {
  const str = String(text);
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Parse and render template
export function renderTemplate(
  template: string,
  variables: Record<string, unknown> = {},
): RenderResult {
  const errors: string[] = [];
  let html = template;
  const usedVariables = new Set<string>();

  // Helper function to apply helpers
  function applyHelper(name: string, value: unknown): string {
    switch (name) {
      case "formatCurrency":
        return formatCurrency(Number(value));
      case "formatDate":
        return formatDate(value as string | Date);
      case "formatDatetime":
        return formatDatetime(value as string | Date);
      case "uppercase":
        return uppercase(String(value));
      case "lowercase":
        return lowercase(String(value));
      case "capitalize":
        return capitalize(String(value));
      default:
        return String(value);
    }
  }

  // Process conditional blocks: {{#if condition}}...{{/if}}
  html = html.replace(
    /\{\{#if\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (match, varPath, content) => {
      const value = getNestedValue(variables, varPath);
      usedVariables.add(varPath);
      if (isTruthy(value)) {
        return content;
      }
      return "";
    },
  );

  // Process conditional inverse: {{#unless condition}}...{{/unless}}
  html = html.replace(
    /\{\{#unless\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
    (match, varPath, content) => {
      const value = getNestedValue(variables, varPath);
      usedVariables.add(varPath);
      if (!isTruthy(value)) {
        return content;
      }
      return "";
    },
  );

  // Process loops: {{#each arrayVar}}...{{/each}}
  html = html.replace(
    /\{\{#each\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (match, varPath, content) => {
      const value = getNestedValue(variables, varPath);
      usedVariables.add(varPath);

      if (!Array.isArray(value)) {
        return "";
      }

      return value
        .map((item, index) => {
          let itemContent = content;
          // Replace {{this}} with item value
          itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
          // Replace {{this.property}} with item.property
          if (typeof item === "object" && item !== null) {
            Object.entries(item).forEach(([key, val]) => {
              const regex = new RegExp(`\\{\\{this\\.${key}\\}\\}`, "g");
              itemContent = itemContent.replace(regex, String(val));
            });
          }
          // Replace {{@index}} and {{@first}} and {{@last}}
          itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));
          itemContent = itemContent.replace(
            /\{\{@first\}\}/g,
            index === 0 ? "true" : "",
          );
          itemContent = itemContent.replace(
            /\{\{@last\}\}/g,
            index === value.length - 1 ? "true" : "",
          );
          return itemContent;
        })
        .join("");
    },
  );

  // Process raw HTML (triple braces): {{{rawHtml}}}
  html = html.replace(/\{\{\{(\w+(?:\.\w+)*)\}\}\}/g, (match, varPath) => {
    const value = getNestedValue(variables, varPath);
    usedVariables.add(varPath);

    if (value === undefined) {
      errors.push(`Undefined variable: ${varPath}`);
      return "";
    }

    return String(value);
  });

  // Process helpers with pipes: {{formatCurrency amount}}
  html = html.replace(
    /\{\{(\w+)\s+(\w+(?:\.\w+)*)\}\}/g,
    (match, helperName, varPath) => {
      const value = getNestedValue(variables, varPath);
      usedVariables.add(varPath);

      if (value === undefined) {
        errors.push(`Undefined variable: ${varPath}`);
        return "";
      }

      return applyHelper(helperName, value);
    },
  );

  // Process simple variables: {{variableName}}
  html = html.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, varPath) => {
    const value = getNestedValue(variables, varPath);
    usedVariables.add(varPath);

    if (value === undefined) {
      errors.push(`Undefined variable: ${varPath}`);
      return "";
    }

    if (typeof value === "object") {
      return escapeHtml(JSON.stringify(value));
    }

    return escapeHtml(String(value));
  });

  // Create text version (no HTML tags)
  const text = html.replace(/<[^>]*>/g, "");

  return {
    html,
    text,
    errors,
  };
}

/**
 * Extract variables used in a template
 * Returns both required and optional variables
 */
export function extractTemplateVariables(template: string): TemplateVariable[] {
  const variables = new Map<string, TemplateVariable>();

  // Find all variable references
  const varRegex = /\{\{\{?#?(?:if|unless|each)?\s*(\w+(?:\.\w+)*)/g;
  let match;

  while ((match = varRegex.exec(template)) !== null) {
    const varPath = match[1];
    if (!variables.has(varPath)) {
      variables.set(varPath, {
        name: varPath,
        required: true, // Conservative: assume all are required
      });
    }
  }

  // Check if variables are in optional blocks
  const optionalIfRegex = /\{\{#if\s+(\w+(?:\.\w+)*)\}\}[\s\S]*?\{\{\/if\}\}/g;
  while ((match = optionalIfRegex.exec(template)) !== null) {
    const varPath = match[1];
    if (variables.has(varPath)) {
      variables.get(varPath)!.required = false;
    }
  }

  return Array.from(variables.values());
}

/**
 * Validate that all required variables are provided
 * Returns validation errors if any required variables are missing
 */
export function validateTemplateVariables(
  template: string,
  variables: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  const required = extractTemplateVariables(template).filter((v) => v.required);

  for (const variable of required) {
    if (!(variable.name in variables)) {
      errors.push(`Required variable missing: ${variable.name}`);
    }
  }

  return errors;
}
