import { createNavigation } from 'next-intl/navigation';
import { supportedLocales, defaultLocale } from './config';

/**
 * Localized navigation helpers for Next.js
 * Provides type-safe Link, redirect, usePathname, and useRouter
 */
export const { Link, redirect, usePathname, useRouter, useTransitionRouter } =
  createNavigation({
    locales: supportedLocales,
    defaultLocale,
    localePrefix: 'as-needed',
    pathnames: {
      '/': '/',
      '/orders': '/orders',
      '/orders/[id]': '/orders/[id]',
      '/drivers': '/drivers',
      '/drivers/[id]': '/drivers/[id]',
      '/deliveries': '/deliveries',
      '/deliveries/[id]': '/deliveries/[id]',
      '/settings': '/settings',
      '/settings/[tab]': '/settings/[tab]',
      '/integrations': '/integrations',
      '/integrations/[id]': '/integrations/[id]',
      '/admin': '/admin',
      '/admin/[section]': '/admin/[section]',
      '/onboarding': '/onboarding',
      '/onboarding/[step]': '/onboarding/[step]',
      '/profile': '/profile',
      '/analytics': '/analytics',
      '/support': '/support',
    },
  });

export type Locale = (typeof supportedLocales)[number];
