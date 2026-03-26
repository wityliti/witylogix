/**
 * Template engine for rendering email templates with variable interpolation
 */

export function renderTemplate(html: string, data: Record<string, any>): string {
  let result = html;

  // Process each loops: {{#each items}}...{{/each}}
  result = processEachLoops(result, data);

  // Process variable interpolation: {{variableName}}
  result = interpolate(result, data);

  return result;
}

function processEachLoops(html: string, data: Record<string, any>): string {
  const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

  return html.replace(eachRegex, (match, arrayName, content) => {
    const array = getNestedValue(data, arrayName);

    if (!Array.isArray(array)) {
      return '';
    }

    return array
      .map((item) => {
        const itemData = { ...data, ...item };
        return interpolate(content, itemData);
      })
      .join('');
  });
}

export function interpolate(
  html: string,
  variables: Record<string, any>
): string {
  return html.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = getNestedValue(variables, trimmedKey);

    if (value === undefined || value === null) {
      return '';
    }

    return String(value);
  });
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

export function formatCurrency(amount: number, currency: string): string {
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF',
    CNY: '¥',
    INR: '₹',
    AED: 'د.إ',
  };

  const symbol = currencySymbols[currency.toUpperCase()] || currency;

  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${symbol}${formatter.format(amount)}`;
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatTime(dateString: string): string {
  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}
