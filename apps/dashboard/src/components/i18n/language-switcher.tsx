"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { getAllLocales, LocaleKey } from "@/i18n/config";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  currentLocale: LocaleKey;
  className?: string;
  variant?: "dropdown" | "inline";
}

/**
 * Language switcher component
 * Provides locale selection with flag icons
 * Persists selection to cookie and updates without page reload
 */
export function LanguageSwitcher({
  currentLocale,
  className,
  variant = "dropdown",
}: LanguageSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const locales = getAllLocales();

  const handleLocaleChange = (newLocale: LocaleKey) => {
    if (newLocale === currentLocale) return;

    startTransition(async () => {
      // Set cookie for persistence
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

      // Refresh current page with new locale
      router.refresh();
    });
  };

  if (variant === "inline") {
    return (
      <div className={cn("flex gap-2", className)}>
        {locales.map(({ locale, metadata }) => (
          <button
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            disabled={isPending}
            className={cn(
              "px-3 py-1 rounded-md text-sm transition-all",
              currentLocale === locale
                ? "bg-wl-primary text-white"
                : "bg-wl-bg-secondary text-wl-text-secondary hover:bg-wl-bg-tertiary",
            )}
            title={metadata.nativeName}
            aria-label={`Switch to ${metadata.name}`}
          >
            <span className="mr-1">{metadata.flag}</span>
            {locale.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  // Dropdown variant (default)
  return (
    <div className={cn("relative inline-block", className)}>
      <div className="group">
        <button
          disabled={isPending}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg",
            "bg-wl-bg-secondary text-wl-text-primary",
            "hover:bg-wl-bg-tertiary transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
          aria-haspopup="menu"
          aria-expanded="false"
        >
          <span className="text-lg">
            {locales.find((l) => l.locale === currentLocale)?.metadata.flag}
          </span>
          <span className="text-sm font-medium">
            {currentLocale.toUpperCase()}
          </span>
        </button>

        {/* Dropdown menu */}
        <div
          className={cn(
            "absolute right-0 mt-2 w-48 rounded-lg",
            "bg-wl-bg-secondary border border-wl-border",
            "shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible",
            "transition-all duration-200 z-50",
          )}
          role="menu"
        >
          {locales.map(({ locale, metadata }) => (
            <button
              key={locale}
              onClick={() => handleLocaleChange(locale)}
              disabled={isPending || currentLocale === locale}
              className={cn(
                "w-full text-left px-4 py-2.5 transition-colors",
                "flex items-center gap-3 text-sm",
                currentLocale === locale
                  ? "bg-wl-primary/10 text-wl-primary font-medium"
                  : "text-wl-text-primary hover:bg-wl-bg-tertiary",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "first:rounded-t-lg last:rounded-b-lg",
              )}
              role="menuitem"
              title={metadata.nativeName}
              aria-label={`Switch to ${metadata.name}`}
            >
              <span className="text-lg">{metadata.flag}</span>
              <div className="flex-1">
                <div className="font-medium">{metadata.nativeName}</div>
                <div className="text-xs text-wl-text-secondary">
                  {metadata.name}
                </div>
              </div>
              {currentLocale === locale && (
                <span className="ml-auto text-wl-primary">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
