import { defaultNS, resources } from "./namespaces";

export type LocaleKey = "en" | "es" | "fr";

export const defaultLocale: LocaleKey = "en";
export const supportedLocales: LocaleKey[] = ["en", "es", "fr"];

export const localeMetadata: Record<
  LocaleKey,
  {
    name: string;
    nativeName: string;
    flag: string;
    direction: "ltr" | "rtl";
    dateFormat: "MM/dd/yyyy" | "dd/MM/yyyy";
    timeFormat: "12h" | "24h";
    currencyCode: string;
    timezones: string[];
  }
> = {
  en: {
    name: "English",
    nativeName: "English",
    flag: "🇺🇸",
    direction: "ltr",
    dateFormat: "MM/dd/yyyy",
    timeFormat: "12h",
    currencyCode: "USD",
    timezones: ["America/New_York", "America/Los_Angeles"],
  },
  es: {
    name: "Spanish",
    nativeName: "Español",
    flag: "🇪🇸",
    direction: "ltr",
    dateFormat: "dd/MM/yyyy",
    timeFormat: "24h",
    currencyCode: "EUR",
    timezones: ["Europe/Madrid"],
  },
  fr: {
    name: "French",
    nativeName: "Français",
    flag: "🇫🇷",
    direction: "ltr",
    dateFormat: "dd/MM/yyyy",
    timeFormat: "24h",
    currencyCode: "EUR",
    timezones: ["Europe/Paris"],
  },
};

/**
 * Get locale from cookie, Accept-Language header, or default
 * Priority: cookie > Accept-Language > default
 */
export function getLocaleFromRequest(
  cookieLocale?: string,
  acceptLanguage?: string,
): LocaleKey {
  // Check cookie first
  if (cookieLocale && supportedLocales.includes(cookieLocale as LocaleKey)) {
    return cookieLocale as LocaleKey;
  }

  // Check Accept-Language header
  if (acceptLanguage) {
    const preferredLanguages = acceptLanguage
      .split(",")
      .map((lang) => lang.split(";")[0].trim().toLowerCase());

    for (const lang of preferredLanguages) {
      const locale = supportedLocales.find(
        (l) => l === lang || lang.startsWith(l),
      );
      if (locale) {
        return locale;
      }
    }
  }

  // Default
  return defaultLocale;
}

/**
 * Get timezone-aware formatting options for a locale
 */
export function getLocaleFormatting(locale: LocaleKey) {
  const metadata = localeMetadata[locale];
  return {
    locale: locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "fr-FR",
    dateFormat: metadata.dateFormat,
    timeFormat: metadata.timeFormat,
    currencyCode: metadata.currencyCode,
    direction: metadata.direction,
    timezone: metadata.timezones[0] || "UTC",
  };
}

/**
 * Detect if a locale uses RTL writing system
 */
export function isRTL(locale: LocaleKey): boolean {
  return localeMetadata[locale].direction === "rtl";
}

/**
 * Get all available locales with metadata
 */
export function getAllLocales() {
  return supportedLocales.map((locale) => ({
    locale,
    metadata: localeMetadata[locale],
  }));
}
