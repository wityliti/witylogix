/**
 * Template renderer for email templates
 * Implements Handlebars-like syntax without external dependencies
 */

import type { TemplateVariables } from "./types.js";

/**
 * HTML escape function
 */
function htmlEscape(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Get nested value from variables object
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, part) => {
    if (current == null) return undefined;
    return current[part];
  }, obj);
}

/**
 * Check if a value is truthy for conditionals
 */
function isTruthy(value: any): boolean {
  if (value === false || value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.length > 0;
  return Boolean(value);
}

/**
 * Format date using simple formatting
 */
function formatDate(
  date: Date | string,
  format: string = "MM/DD/YYYY",
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return format
    .replace("YYYY", year.toString())
    .replace("MM", month)
    .replace("DD", day)
    .replace("HH", hours)
    .replace("mm", minutes);
}

/**
 * Format currency value
 */
function formatCurrency(
  amount: number | string,
  currency: string = "USD",
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "";

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  });
  return formatter.format(num);
}

/**
 * Transform text to uppercase
 */
function uppercase(text: string | number): string {
  return String(text).toUpperCase();
}

/**
 * Transform text to lowercase
 */
function lowercase(text: string | number): string {
  return String(text).toLowerCase();
}

/**
 * Capitalize first letter
 */
function capitalize(text: string | number): string {
  const str = String(text);
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Render template with variables and built-in helpers
 * Supports:
 * - {{variable}} - with HTML escaping
 * - {{{raw}}} - without escaping
 * - {{#if condition}}...{{/if}}
 * - {{#each array}}...{{/each}}
 * - {{formatDate date}} - format dates
 * - {{formatCurrency amount}} - format currency
 * - {{uppercase text}} - uppercase
 * - {{lowercase text}} - lowercase
 * - {{capitalize text}} - capitalize
 */
export function renderTemplate(
  template: string,
  variables: TemplateVariables = {},
): string {
  let result = template;

  // Process raw (unescaped) variables first: {{{variable}}}
  result = result.replace(/\{\{\{(.+?)\}\}\}/g, (match, expression) => {
    const trimmed = expression.trim();
    const value = getNestedValue(variables, trimmed);
    return value != null ? String(value) : "";
  });

  // Process conditionals: {{#if condition}}...{{/if}}
  result = processConditionals(result, variables);

  // Process loops: {{#each array}}...{{/each}}
  result = processLoops(result, variables);

  // Process built-in helpers and regular variables: {{variable}}
  result = result.replace(/\{\{(.+?)\}\}/g, (match, expression) => {
    const trimmed = expression.trim();

    // Check for formatDate helper
    if (trimmed.startsWith("formatDate ")) {
      const arg = trimmed.substring("formatDate ".length);
      const value = getNestedValue(variables, arg);
      if (value) return formatDate(value);
      return "";
    }

    // Check for formatCurrency helper
    if (trimmed.startsWith("formatCurrency ")) {
      const arg = trimmed.substring("formatCurrency ".length);
      const value = getNestedValue(variables, arg);
      if (value) return formatCurrency(value);
      return "";
    }

    // Check for uppercase helper
    if (trimmed.startsWith("uppercase ")) {
      const arg = trimmed.substring("uppercase ".length);
      const value = getNestedValue(variables, arg);
      if (value) return uppercase(value);
      return "";
    }

    // Check for lowercase helper
    if (trimmed.startsWith("lowercase ")) {
      const arg = trimmed.substring("lowercase ".length);
      const value = getNestedValue(variables, arg);
      if (value) return lowercase(value);
      return "";
    }

    // Check for capitalize helper
    if (trimmed.startsWith("capitalize ")) {
      const arg = trimmed.substring("capitalize ".length);
      const value = getNestedValue(variables, arg);
      if (value) return capitalize(value);
      return "";
    }

    // Regular variable
    const value = getNestedValue(variables, trimmed);
    if (value == null) return "";
    return htmlEscape(String(value));
  });

  return result;
}

/**
 * Process conditional blocks: {{#if condition}}...{{/if}}
 */
function processConditionals(
  template: string,
  variables: TemplateVariables,
): string {
  let result = template;
  const ifRegex = /\{\{#if\s+(.+?)\}\}(.*?)\{\{\/if\}\}/gs;

  let match;
  while ((match = ifRegex.exec(result)) !== null) {
    const condition = match[1].trim();
    const content = match[2];
    const value = getNestedValue(variables, condition);

    if (isTruthy(value)) {
      result =
        result.substring(0, match.index) +
        content +
        result.substring(ifRegex.lastIndex);
      ifRegex.lastIndex = match.index;
    } else {
      result =
        result.substring(0, match.index) + result.substring(ifRegex.lastIndex);
      ifRegex.lastIndex = match.index;
    }
  }

  return result;
}

/**
 * Find the matching {{/each}} for a {{#each ...}} block, handling nesting.
 * Returns the index of the start of the matching {{/each}} tag.
 */
function findMatchingEachEnd(template: string, startAfter: number): number {
  let depth = 1;
  let i = startAfter;
  while (i < template.length && depth > 0) {
    const eachOpen = template.indexOf("{{#each ", i);
    const eachClose = template.indexOf("{{/each}}", i);

    if (eachClose === -1) return -1; // no matching close

    if (eachOpen !== -1 && eachOpen < eachClose) {
      depth++;
      i = eachOpen + 8; // skip past '{{#each '
    } else {
      depth--;
      if (depth === 0) return eachClose;
      i = eachClose + 9; // skip past '{{/each}}'
    }
  }
  return -1;
}

/**
 * Process loop blocks: {{#each array}}...{{/each}}
 * Provides @index, @first, @last helpers
 * Handles nested each blocks correctly
 */
function processLoops(template: string, variables: TemplateVariables): string {
  let result = template;
  const openRegex = /\{\{#each\s+(.+?)\}\}/g;

  let match;
  while ((match = openRegex.exec(result)) !== null) {
    const arrayPath = match[1].trim();
    const openEnd = match.index + match[0].length;
    const closeStart = findMatchingEachEnd(result, openEnd);

    if (closeStart === -1) break;

    const content = result.substring(openEnd, closeStart);
    const closeEnd = closeStart + 9; // length of '{{/each}}'
    const array = getNestedValue(variables, arrayPath);

    let rendered = "";

    if (Array.isArray(array)) {
      rendered = array
        .map((item, index) => {
          const itemVariables: TemplateVariables = {
            ...variables,
            this: item,
            [arrayPath.split(".").pop() || "item"]: item,
            "@index": index,
            "@first": index === 0,
            "@last": index === array.length - 1,
          };
          return renderTemplate(content, itemVariables);
        })
        .join("");
    }

    result =
      result.substring(0, match.index) + rendered + result.substring(closeEnd);
    openRegex.lastIndex = match.index;
  }

  return result;
}
