import {
  formatDistanceToNow,
  formatDate as fnFormatDate,
  differenceInSeconds,
} from "date-fns";
import { enUS, es, fr } from "date-fns/locale";
import { LocaleKey, localeMetadata } from "./config";

const dateLocales = {
  en: enUS,
  es,
  fr,
};

/**
 * Format currency based on locale
 */
export function formatCurrency(
  amount: number,
  currency?: string,
  locale: LocaleKey = "en",
): string {
  const currencyCode = currency || localeMetadata[locale].currencyCode;
  const intlLocale =
    locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "fr-FR";

  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date in relative or absolute style
 */
export function formatDate(
  date: Date | string | number,
  style: "relative" | "absolute" | "short" = "relative",
  locale: LocaleKey = "en",
): string {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  const dateLocale = dateLocales[locale];
  const intlLocale =
    locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "fr-FR";

  if (style === "relative") {
    return formatDistanceToNow(dateObj, {
      addSuffix: true,
      locale: dateLocale,
    });
  }

  if (style === "short") {
    return new Intl.DateTimeFormat(intlLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(dateObj);
  }

  // absolute
  return new Intl.DateTimeFormat(intlLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj);
}

/**
 * Format number with locale-specific separators
 */
export function formatNumber(num: number, locale: LocaleKey = "en"): string {
  const intlLocale =
    locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "fr-FR";

  return new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format distance with locale-aware units (km/miles)
 */
export function formatDistance(
  meters: number,
  locale: LocaleKey = "en",
): string {
  // Use miles for US locales, kilometers for others
  const useMiles = locale === "en";
  const distance = useMiles ? meters * 0.000621371 : meters / 1000;
  const unit = useMiles ? "mi" : "km";

  return `${formatNumber(distance, locale)} ${unit}`;
}

/**
 * Format weight with locale-aware units (lbs/kg)
 */
export function formatWeight(grams: number, locale: LocaleKey = "en"): string {
  // Use pounds for US locales, kilograms for others
  const usePounds = locale === "en";
  const weight = usePounds ? grams * 0.00220462 : grams / 1000;
  const unit = usePounds ? "lbs" : "kg";

  return `${formatNumber(weight, locale)} ${unit}`;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(
  seconds: number,
  locale: LocaleKey = "en",
): string {
  const units = {
    en: {
      day: "d",
      hour: "h",
      minute: "min",
      second: "s",
    },
    es: {
      day: "d",
      hour: "h",
      minute: "min",
      second: "s",
    },
    fr: {
      day: "j",
      hour: "h",
      minute: "min",
      second: "s",
    },
  };

  const unitLabels = units[locale];
  let remaining = Math.floor(seconds);
  const parts: string[] = [];

  const days = Math.floor(remaining / (24 * 3600));
  remaining %= 24 * 3600;

  const hours = Math.floor(remaining / 3600);
  remaining %= 3600;

  const minutes = Math.floor(remaining / 60);
  remaining %= 60;

  if (days > 0) parts.push(`${days}${unitLabels.day}`);
  if (hours > 0) parts.push(`${hours}${unitLabels.hour}`);
  if (minutes > 0) parts.push(`${minutes}${unitLabels.minute}`);
  if (remaining > 0 || parts.length === 0)
    parts.push(`${remaining}${unitLabels.second}`);

  return parts.slice(0, 2).join(" ");
}

/**
 * Get time difference label (e.g., "just now", "2 minutes ago")
 */
export function getTimeAgoLabel(
  date: Date | string | number,
  locale: LocaleKey = "en",
): string {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  const seconds = differenceInSeconds(new Date(), dateObj);

  const messages = {
    en: {
      justNow: "just now",
      minutesAgo: (n: number) => `${n}m ago`,
      hoursAgo: (n: number) => `${n}h ago`,
      daysAgo: (n: number) => `${n}d ago`,
    },
    es: {
      justNow: "hace un momento",
      minutesAgo: (n: number) => `hace ${n}m`,
      hoursAgo: (n: number) => `hace ${n}h`,
      daysAgo: (n: number) => `hace ${n}d`,
    },
    fr: {
      justNow: "à l'instant",
      minutesAgo: (n: number) => `il y a ${n}m`,
      hoursAgo: (n: number) => `il y a ${n}h`,
      daysAgo: (n: number) => `il y a ${n}j`,
    },
  };

  const msgs = messages[locale];

  if (seconds < 60) return msgs.justNow;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return msgs.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return msgs.hoursAgo(hours);
  const days = Math.floor(hours / 24);
  return msgs.daysAgo(days);
}
