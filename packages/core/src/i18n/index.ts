/**
 * Lightweight i18n (Internationalization) utility
 * Provides simple key-based translation with parameter interpolation and fallback support
 */

// ============================================================================
// Types
// ============================================================================

export type Locale = "en" | "es" | "fr" | "ar";

export interface TranslationKey {
  key: string;
  params?: Record<string, string | number>;
}

export interface I18nConfig {
  defaultLocale: Locale;
  fallbackLocale: Locale;
  supportedLocales: Locale[];
}

export interface LocaleData {
  [key: string]: string | Record<string, any>;
}

// ============================================================================
// Translation Storage
// ============================================================================

const translations = new Map<Locale, LocaleData>();
const defaultConfig: I18nConfig = {
  defaultLocale: "en",
  fallbackLocale: "en",
  supportedLocales: ["en", "es", "fr", "ar"],
};

let currentConfig = { ...defaultConfig };
let currentLocale: Locale = defaultConfig.defaultLocale;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Flatten nested translation objects into dot-notation keys
 * @example
 * { orders: { status: { pending: 'Pending' } } }
 * becomes { 'orders.status.pending': 'Pending' }
 */
function flattenTranslations(
  obj: LocaleData,
  prefix = "",
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === "string") {
        result[fullKey] = value;
      } else if (value !== null && typeof value === "object") {
        Object.assign(result, flattenTranslations(value, fullKey));
      }
    }
  }

  return result;
}

/**
 * Interpolate parameters into a translation string
 * Replaces {{key}} placeholders with provided values
 * @example
 * interpolate('Hello {{name}}', { name: 'John' }) => 'Hello John'
 */
function interpolate(
  text: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return text;

  let result = text;
  for (const key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      const value = params[key];
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      result = result.replace(regex, String(value));
    }
  }

  return result;
}

/**
 * Get a nested value from an object using dot notation
 * @example getNestedValue({ a: { b: 'value' } }, 'a.b') => 'value'
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split(".");
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

// ============================================================================
// Core i18n Functions
// ============================================================================

/**
 * Initialize i18n with configuration
 */
export function initializeI18n(config: Partial<I18nConfig> = {}): void {
  currentConfig = { ...defaultConfig, ...config };
  currentLocale = currentConfig.defaultLocale;
}

/**
 * Load translations for a specific locale
 * Typically called internally, but can be used to load custom translations
 */
export function loadLocaleData(locale: Locale, data: LocaleData): void {
  translations.set(locale, data);
}

/**
 * Set the current active locale
 */
export function setLocale(locale: Locale): void {
  if (currentConfig.supportedLocales.includes(locale)) {
    currentLocale = locale;
  } else {
    console.warn(
      `Locale '${locale}' is not supported. Falling back to '${currentConfig.fallbackLocale}'`,
    );
    currentLocale = currentConfig.fallbackLocale;
  }
}

/**
 * Get the current active locale
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Get configuration
 */
export function getConfig(): I18nConfig {
  return { ...currentConfig };
}

/**
 * Core translation function
 * Supports nested keys (e.g., 'orders.status.pending')
 * Supports parameter interpolation (e.g., {{name}})
 *
 * @param key - Translation key (supports dot notation for nested keys)
 * @param params - Optional parameters for interpolation
 * @returns Translated string with interpolated parameters, or the key itself if not found
 *
 * @example
 * t('common.save') => 'Save'
 * t('orders.assigned', { driver: 'John' }) => 'Order assigned to John'
 */
export function t(
  key: string,
  params?: Record<string, string | number>,
): string {
  // Try current locale first
  const localeData = translations.get(currentLocale);
  if (localeData) {
    const flatData = flattenTranslations(localeData);
    const translation = flatData[key] || getNestedValue(localeData, key);

    if (translation && typeof translation === "string") {
      return interpolate(translation, params);
    }
  }

  // Fall back to fallback locale if current locale doesn't have translation
  if (currentLocale !== currentConfig.fallbackLocale) {
    const fallbackData = translations.get(currentConfig.fallbackLocale);
    if (fallbackData) {
      const flatData = flattenTranslations(fallbackData);
      const translation = flatData[key] || getNestedValue(fallbackData, key);

      if (translation && typeof translation === "string") {
        return interpolate(translation, params);
      }
    }
  }

  // Return the key itself as fallback
  console.warn(`Translation key not found: ${key}`);
  return key;
}

/**
 * Get all translations for the current locale (useful for debugging)
 */
export function getAllTranslations(): LocaleData | undefined {
  return translations.get(currentLocale);
}

/**
 * Check if a translation key exists
 */
export function hasKey(key: string): boolean {
  const localeData = translations.get(currentLocale);
  if (!localeData) return false;

  const flatData = flattenTranslations(localeData);
  return key in flatData || getNestedValue(localeData, key) !== undefined;
}

/**
 * Check if RTL support is needed (for Arabic, Hebrew, etc.)
 */
export function isRTL(): boolean {
  return currentLocale === "ar";
}

/**
 * Get language direction (ltr or rtl)
 */
export function getDirection(): "ltr" | "rtl" {
  return isRTL() ? "rtl" : "ltr";
}

// ============================================================================
// Dynamic Locale Loading (for runtime loading)
// ============================================================================

/**
 * Dynamically load a locale (useful for code splitting)
 * @example
 * await dynamicLoadLocale('es', () => import('./locales/es.json'))
 */
export async function dynamicLoadLocale(
  locale: Locale,
  loader: () => Promise<{ default: LocaleData }>,
): Promise<void> {
  try {
    const module = await loader();
    loadLocaleData(locale, module.default);
  } catch (error) {
    console.error(`Failed to load locale '${locale}':`, error);
  }
}
