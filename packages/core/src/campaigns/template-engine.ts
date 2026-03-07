/**
 * Template Engine
 * Simple but powerful template rendering with variable substitution,
 * conditionals, and loops
 */

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  /** Whether the template is valid */
  valid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of found variables */
  variables: string[];
}

/**
 * Template engine for rendering campaign content
 */
export class TemplateEngine {
  /**
   * Render a template with provided variables
   * Supports: {{variable}}, {{#if condition}}...{{/if}}, {{#each array}}...{{/each}}
   * @param template - Template string
   * @param variables - Object with variable values
   * @returns Rendered string
   */
  static renderTemplate(
    template: string,
    variables: Record<string, unknown>
  ): string {
    let result = template;

    // Process each blocks first
    result = TemplateEngine.processLoops(result, variables);

    // Process conditionals
    result = TemplateEngine.processConditionals(result, variables);

    // Process variable substitution
    result = TemplateEngine.processVariables(result, variables);

    // Clean up any remaining unmatched tags
    result = result.replace(/\{\{[^}]*\}\}/g, '');

    return result;
  }

  /**
   * Process {{#each}} loops
   */
  private static processLoops(
    template: string,
    variables: Record<string, unknown>
  ): string {
    const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

    return template.replace(eachRegex, (match, arrayName, content) => {
      const array = variables[arrayName];

      if (!Array.isArray(array)) {
        return '';
      }

      return array
        .map((item) => {
          const itemVars = {
            ...variables,
            [arrayName]: item,
            this: item,
          };

          // Handle item properties
          if (typeof item === 'object' && item !== null) {
            Object.assign(itemVars, item);
          }

          return TemplateEngine.renderTemplate(content, itemVars);
        })
        .join('');
    });
  }

  /**
   * Process {{#if}} conditionals
   */
  private static processConditionals(
    template: string,
    variables: Record<string, unknown>
  ): string {
    const ifRegex = /\{\{#if\s+(.+?)\}\}([\s\S]*?)(\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

    return template.replace(
      ifRegex,
      (match, condition, trueContent, elseMatch, falseContent) => {
        const conditionResult = TemplateEngine.evaluateCondition(
          condition,
          variables
        );

        const content = conditionResult ? trueContent : falseContent || '';
        return TemplateEngine.renderTemplate(content, variables);
      }
    );
  }

  /**
   * Process {{variable}} substitutions
   */
  private static processVariables(
    template: string,
    variables: Record<string, unknown>
  ): string {
    return template.replace(/\{\{([^#/][^}]*?)\}\}/g, (match, variablePath) => {
      const value = TemplateEngine.resolveVariable(variablePath.trim(), variables);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Resolve a variable path (e.g., "user.name", "items[0]")
   */
  private static resolveVariable(
    path: string,
    variables: Record<string, unknown>
  ): unknown {
    const parts = path.split('.');
    let value: unknown = variables;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }

      // Handle array access like items[0]
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayName, index] = arrayMatch;
        value = (value as Record<string, unknown>)[arrayName];
        value = Array.isArray(value) ? value[parseInt(index, 10)] : undefined;
      } else {
        value = (value as Record<string, unknown>)[part];
      }
    }

    return value;
  }

  /**
   * Evaluate a conditional expression
   */
  private static evaluateCondition(
    condition: string,
    variables: Record<string, unknown>
  ): boolean {
    const condition_trimmed = condition.trim();

    // Handle comparison operators
    const comparisonRegex = /^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+?)$/;
    const match = condition_trimmed.match(comparisonRegex);

    if (match) {
      const [, left, operator, right] = match;
      const leftValue = TemplateEngine.resolveVariable(left.trim(), variables);
      const rightValue = TemplateEngine.resolveVariable(right.trim(), variables);

      switch (operator) {
        case '===':
          return leftValue === rightValue;
        case '!==':
          return leftValue !== rightValue;
        case '==':
          return leftValue == rightValue;
        case '!=':
          return leftValue != rightValue;
        case '>=':
          return Number(leftValue) >= Number(rightValue);
        case '<=':
          return Number(leftValue) <= Number(rightValue);
        case '>':
          return Number(leftValue) > Number(rightValue);
        case '<':
          return Number(leftValue) < Number(rightValue);
      }
    }

    // Handle negation
    if (condition_trimmed.startsWith('!')) {
      const innerCondition = condition_trimmed.slice(1).trim();
      return !TemplateEngine.evaluateCondition(innerCondition, variables);
    }

    // Handle simple truthy/falsy
    const value = TemplateEngine.resolveVariable(condition_trimmed, variables);
    return TemplateEngine.isTruthy(value);
  }

  /**
   * Check if value is truthy
   */
  private static isTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  /**
   * Validate a template string
   * @param template - Template string to validate
   * @returns Validation result with errors and found variables
   */
  static validateTemplate(template: string): TemplateValidationResult {
    const errors: string[] = [];
    const variables = new Set<string>();

    // Check for balanced tags
    const ifCount = (template.match(/\{\{#if\s/g) || []).length;
    const ifEndCount = (template.match(/\{\{\/if\}\}/g) || []).length;
    if (ifCount !== ifEndCount) {
      errors.push(`Unmatched {{#if}} tags: ${ifCount} opens, ${ifEndCount} closes`);
    }

    const eachCount = (template.match(/\{\{#each\s/g) || []).length;
    const eachEndCount = (template.match(/\{\{\/each\}\}/g) || []).length;
    if (eachCount !== eachEndCount) {
      errors.push(
        `Unmatched {{#each}} tags: ${eachCount} opens, ${eachEndCount} closes`
      );
    }

    // Extract all variables
    const variableRegex = /\{\{([^#/][^}]*?)\}\}/g;
    let variableMatch;
    while ((variableMatch = variableRegex.exec(template)) !== null) {
      const varPath = variableMatch[1].trim();
      // Extract base variable name (before dots or brackets)
      const baseName = varPath.split(/[.\[]/)[0];
      if (baseName) {
        variables.add(baseName);
      }
    }

    // Check for invalid syntax in conditionals
    const invalidIfRegex = /\{\{#if\s*\}\}/g;
    if (invalidIfRegex.test(template)) {
      errors.push('Found {{#if}} with no condition');
    }

    const invalidEachRegex = /\{\{#each\s*\}\}/g;
    if (invalidEachRegex.test(template)) {
      errors.push('Found {{#each}} with no array name');
    }

    // Check for unclosed variable tags
    const unclosedRegex = /\{\{(?!#|\/)[^}]*$/g;
    if (unclosedRegex.test(template)) {
      errors.push('Found unclosed template tags');
    }

    return {
      valid: errors.length === 0,
      errors,
      variables: Array.from(variables),
    };
  }

  /**
   * Get all variables used in a template
   * @param template - Template string
   * @returns Array of variable names found
   */
  static getTemplateVariables(template: string): string[] {
    const validation = TemplateEngine.validateTemplate(template);
    return validation.variables;
  }

  /**
   * Sanitize user input for safe template use
   * @param input - User input
   * @returns Sanitized string
   */
  static sanitizeInput(input: string): string {
    // Remove potential template injection
    return input
      .replace(/\{\{/g, '')
      .replace(/\}\}/g, '')
      .replace(/{{/g, '')
      .replace(/}}/g, '');
  }

  /**
   * Escape special characters in variables for safe rendering
   * @param value - Value to escape
   * @returns Escaped string
   */
  static escapeHtml(value: unknown): string {
    const str = String(value);
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return str.replace(/[&<>"']/g, (char) => map[char]);
  }

  /**
   * Create a compiled template for performance
   * Useful for templates used repeatedly
   * @param template - Template string
   * @returns Function that takes variables and returns rendered string
   */
  static compileTemplate(
    template: string
  ): (variables: Record<string, unknown>) => string {
    // Validate template first
    const validation = TemplateEngine.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }

    // Return a pre-bound render function
    return (variables: Record<string, unknown>) => {
      return TemplateEngine.renderTemplate(template, variables);
    };
  }
}
