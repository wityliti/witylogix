import { getRequestConfig } from "next-intl/server";
import {
  defaultLocale,
  getLocaleFromRequest,
  supportedLocales,
} from "./config";
import { defaultNS } from "./namespaces";

/**
 * Unified request-based configuration
 * This handles message loading and locale resolution for both pages and middleware
 */
export default getRequestConfig(async () => {
  // For Next.js 15, we need to get the locale from headers
  // This is called automatically in middleware context
  let locale = defaultLocale;

  // In a server component or API route context, headers would be available
  // For now, we use the default locale and it gets overridden by middleware
  try {
    const { headers } = await import("next/headers");
    const headersList = await headers();
    const localeFromCookie =
      headersList.get("x-locale") ||
      (typeof document !== "undefined"
        ? document.cookie
            .split("; ")
            .find((row) => row.startsWith("NEXT_LOCALE="))
            ?.split("=")[1]
        : undefined);
    const acceptLanguage = headersList.get("accept-language");

    locale =
      getLocaleFromRequest(localeFromCookie, acceptLanguage || undefined) ||
      defaultLocale;
  } catch {
    // Fallback to default locale
    locale = defaultLocale;
  }

  // Validate locale
  if (!supportedLocales.includes(locale as any)) {
    locale = defaultLocale;
  }

  // Load messages dynamically based on locale
  const messages = await import(`../../messages/${locale}.json`).catch(
    () => import(`../../messages/${defaultLocale}.json`),
  );

  return {
    locale,
    messages: messages.default,
    defaultNS,
    timeZone: "UTC",
  };
});
