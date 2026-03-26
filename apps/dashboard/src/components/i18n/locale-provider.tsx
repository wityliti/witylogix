'use client';

import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';

interface LocaleProviderProps {
  children: ReactNode;
  locale: string;
  messages: Record<string, any>;
  timeZone?: string;
  defaultNS?: string;
}

/**
 * Client-side i18n provider wrapper
 * Wraps NextIntlClientProvider for client components
 * Forwards message subsets and locale context
 */
export function LocaleProvider({
  children,
  locale,
  messages,
  timeZone = 'UTC',
  defaultNS = 'common',
}: LocaleProviderProps) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={timeZone}
    >
      {children}
    </NextIntlClientProvider>
  );
}
