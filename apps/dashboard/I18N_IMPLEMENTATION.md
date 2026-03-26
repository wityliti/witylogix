# Internationalization (i18n) Implementation Guide

## Overview

This guide documents the complete i18n framework for the Witylogix Next.js 15 dashboard using `next-intl`. The framework supports 3 locales (English, Spanish, French) with timezone-aware formatting and RTL-ready architecture.

## Architecture

### File Structure

```
apps/dashboard/
├── src/
│   ├── i18n/
│   │   ├── config.ts              # Locale configuration & metadata
│   │   ├── namespaces.ts          # Translation namespaces
│   │   ├── request.ts             # next-intl request config
│   │   ├── navigation.ts           # Localized navigation helpers
│   │   ├── formatting.ts           # Format utilities (currency, date, etc.)
│   │   ├── rtl-support.ts          # RTL preparation utilities
│   │   └── extract-keys.ts         # Translation key extraction script
│   ├── middleware.ts               # Locale detection & routing middleware
│   └── components/i18n/
│       ├── language-switcher.tsx  # Language selection component
│       └── locale-provider.tsx     # Client-side i18n provider
├── messages/
│   ├── en.json                    # English translations (450+ keys)
│   ├── es.json                    # Spanish translations
│   └── fr.json                    # French translations
└── next.config.ts                 # (requires i18n plugin)
```

## Core Components

### 1. Configuration (`src/i18n/config.ts`)

Manages supported locales and their metadata:

```typescript
import { getLocaleFromRequest } from '@/i18n/config';

// Detect locale from request
const locale = getLocaleFromRequest(cookieLocale, acceptLanguage);

// Get locale metadata
const metadata = localeMetadata['en'];
// → { name, nativeName, flag, direction, dateFormat, timeFormat, currencyCode, timezones }

// Check RTL support
const isRtl = isRTL('ar');
```

**Supported Locales:**
- `en` - English (US, 12h time, MM/dd/yyyy, USD)
- `es` - Spanish (Spain, 24h time, dd/MM/yyyy, EUR)
- `fr` - French (France, 24h time, dd/MM/yyyy, EUR)

### 2. Request Configuration (`src/i18n/request.ts`)

Handles message loading and locale resolution:

```typescript
// Automatically called by next-intl in server contexts
// Loads messages dynamically based on detected locale
// Validates locale and falls back to default if needed
```

### 3. Navigation (`src/i18n/navigation.ts`)

Provides type-safe localized navigation:

```typescript
import { Link, redirect, usePathname, useRouter } from '@/i18n/navigation';

// Server-side links (automatically includes locale)
<Link href="/orders">{t('orders.title')}</Link>

// Client-side routing
const router = useRouter();
router.push('/orders/123');

// Get current pathname without locale
const pathname = usePathname(); // '/orders', not '/en/orders'
```

### 4. Middleware (`src/middleware.ts`)

Handles locale detection and routing:

- Detects locale from: cookie → Accept-Language header → default
- Sets locale cookie for 1 year persistence
- Protects routes requiring authentication
- Prevents authenticated users from accessing login pages

### 5. Formatting Utilities (`src/i18n/formatting.ts`)

Locale-aware formatting functions:

```typescript
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatDistance,
  formatWeight,
  formatDuration,
  getTimeAgoLabel,
} from '@/i18n/formatting';

// Currency formatting
formatCurrency(1234.56, 'USD', 'en') // "$1,234.56"
formatCurrency(1234.56, 'EUR', 'es') // "1.234,56 €"

// Date formatting
formatDate(new Date(), 'relative', 'en') // "2 hours ago"
formatDate(new Date(), 'absolute', 'en') // "March 16, 2026, 10:30 AM"

// Numbers
formatNumber(1234567.89, 'en') // "1,234,567.89"
formatNumber(1234567.89, 'fr') // "1 234 567,89"

// Distance (km/miles based on locale)
formatDistance(5000, 'en')  // "3.11 mi"
formatDistance(5000, 'es')  // "5 km"

// Weight (lbs/kg based on locale)
formatWeight(2000, 'en')  // "4.41 lbs"
formatWeight(2000, 'es')  // "2 kg"

// Duration
formatDuration(3661, 'en')  // "1h 1min"
formatDuration(3661, 'fr')  // "1h 1min"

// Time ago labels
getTimeAgoLabel(new Date(Date.now() - 5*60000), 'en') // "5m ago"
```

### 6. RTL Support (`src/i18n/rtl-support.ts`)

Preparation for right-to-left languages (Arabic, Hebrew):

```typescript
import { getDirection, rtlClasses, getLogicalProperties } from '@/i18n/rtl-support';

// Check direction
const dir = getDirection('en'); // 'ltr'

// RTL-aware spacing
const props = getLogicalProperties('en');
<div style={props.marginStart('16px')}>Start margin</div>
<div style={props.marginEnd('16px')}>End margin</div>

// Text alignment
<div style={props.textStart()}>Left-aligned</div>
<div style={props.textEnd()}>Right-aligned</div>

// Flex alignment
<div style={props.flexStartAlign()}>Flex start</div>
```

### 7. Components

#### Language Switcher (`src/components/i18n/language-switcher.tsx`)

```typescript
import { LanguageSwitcher } from '@/components/i18n/language-switcher';

// Dropdown variant (default)
<LanguageSwitcher currentLocale="en" />

// Inline variant
<LanguageSwitcher currentLocale="en" variant="inline" />
```

Features:
- Flag emoji indicators
- Smooth locale switching without full page reload
- Persists selection to cookie
- Accessible (ARIA labels, keyboard navigation)

#### Locale Provider (`src/components/i18n/locale-provider.tsx`)

```typescript
import { LocaleProvider } from '@/components/i18n/locale-provider';

// Wrap client components
<LocaleProvider locale="en" messages={messages} timeZone="UTC">
  <ClientComponent />
</LocaleProvider>
```

### 8. Translation Key Extraction (`src/i18n/extract-keys.ts`)

Script to find and validate translation keys:

```bash
# Run from apps/dashboard
node -e "require('./src/i18n/extract-keys.ts').generateReport()"

# Output:
# - Total unique keys found: XXX
# - Keys by file (with file paths)
# - Missing translations per locale
# - JSON report: i18n-extraction-report.json
```

## Translation Structure

### File Organization

All translations in `apps/dashboard/messages/`:

**en.json** (450 lines)
- `common`: Navigation, actions, status, time, errors, success
- `auth`: Login, register, forgot password, MFA
- `onboarding`: 8-step wizard translations
- `dashboard`: Sidebar, stats, charts
- `orders`: List, detail, status, actions
- `drivers`: List, detail, status, actions
- `deliveries`: Status, timeline, proof
- `settings`: Tabs, forms, notifications
- `integrations`: Categories, status, setup

**es.json** / **fr.json**: Complete professional translations

### Using Translations in Components

**Server Components:**
```typescript
import { useTranslations } from 'next-intl';

export default function Page() {
  const t = useTranslations('orders');

  return <h1>{t('title')}</h1>; // "Orders" / "Pedidos" / "Commandes"
}
```

**Client Components:**
```typescript
'use client';

import { useTranslations } from 'next-intl';

export function OrderCard() {
  const t = useTranslations('orders.detail');

  return (
    <div>
      <label>{t('id')}</label>
      <label>{t('customer')}</label>
    </div>
  );
}
```

**Nested Keys:**
```typescript
const t = useTranslations();

// Access nested: common.actions.save
t('common.actions.save')
t.rich('common.actions.save') // With markup support

// With default namespace
const t = useTranslations('common');
t('actions.save')
```

## Integration Checklist

### 1. Install Dependencies

```bash
pnpm add next-intl
pnpm add -D @types/date-fns date-fns glob
```

### 2. Update next.config.ts

```typescript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin(
  './src/i18n/request.ts'
);

export default withNextIntl({
  // ... rest of config
});
```

### 3. Update Layout

```typescript
// apps/dashboard/src/app/layout.tsx
import { notFound } from 'next/navigation';
import { getMessages } from 'next-intl/server';
import { LocaleProvider } from '@/components/i18n/locale-provider';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function RootLayout({ children, params }: Props) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale} messages={messages}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
```

### 4. Add Language Switcher to Header/Sidebar

```typescript
import { useLocale } from 'next-intl';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';

export function Header() {
  const locale = useLocale();

  return (
    <header>
      {/* ... other content ... */}
      <LanguageSwitcher currentLocale={locale as any} />
    </header>
  );
}
```

## Best Practices

### 1. Translation Keys

- Use dot notation: `orders.list.title`
- Use descriptive names: `errors.notFound` not `err.404`
- Group by feature/domain
- Keep keys consistent across locales

### 2. Format Function Usage

```typescript
// Always use formatting utilities for consistency
formatCurrency(amount, undefined, locale)  // Uses locale-specific currency
formatDate(date, 'relative', locale)        // Relative dates
formatDistance(meters, locale)              // Unit conversion
```

### 3. Timezone Awareness

```typescript
// Pass timezone to operations
const formatted = new Intl.DateTimeFormat(locale, {
  timeZone: 'America/New_York',
}).format(date);

// Use getLocaleFormatting() for metadata
const { timezone } = getLocaleFormatting(locale);
```

### 4. Client vs Server

```typescript
// Server: Heavy lifting
const t = useTranslations();
const formatted = formatDate(date, 'relative', locale);
const rendered = `${formatted} - ${t('common.loading')}`;

// Pass to client
<ClientComponent text={rendered} />

// Client: Only interactive changes
'use client';
const [value, setValue] = useState(rendered);
```

### 5. SEO

```typescript
// app/[locale]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const t = getTranslations({ locale: params.locale, namespace: 'orders' });

  return {
    title: t('title'),
    description: t('list.description'),
    alternates: {
      languages: {
        'en': '/en/orders',
        'es': '/es/orders',
        'fr': '/fr/orders',
      },
    },
  };
}
```

## Testing

### Extract Translation Keys

```bash
cd apps/dashboard
node -e "require('./src/i18n/extract-keys.ts').generateReport()"
```

This will:
1. Scan all .tsx/.ts files
2. Find useTranslations() and t() calls
3. Report missing keys per locale
4. Generate i18n-extraction-report.json

### Manual Testing

```typescript
// Test locale detection
import { getLocaleFromRequest } from '@/i18n/config';

getLocaleFromRequest(undefined, 'es-ES,es;q=0.9,en;q=0.8') // → 'es'
getLocaleFromRequest('fr', 'en') // → 'fr' (cookie takes priority)
getLocaleFromRequest(undefined, 'de') // → 'en' (default)
```

## Troubleshooting

### Messages not loading

- Verify JSON file paths in `request.ts`
- Check locale validation in `config.ts`
- Ensure middleware is active (check logs)

### Locale not persisting

- Check cookie settings in middleware
- Verify `NEXT_LOCALE` cookie in browser DevTools
- Check SameSite and Secure flags

### Formatting issues

- Use `formatCurrency()` for all numbers with units
- Use `formatDate()` with correct style parameter
- Check locale code matches Intl.DateTimeFormat spec

### RTL not applied

- Use `getDirection()` from config
- Apply to `<html dir={dir}>`
- Use `getLogicalProperties()` for spacing
- Test with Arabic locale setup

## Migration Guide

If updating from non-i18n version:

1. **Wrap layout with LocaleProvider**
2. **Replace all hardcoded text with t() calls**
3. **Update navigation links to use i18n/navigation exports**
4. **Replace date/currency formatting with utilities**
5. **Test locale switching**
6. **Run key extraction to find gaps**

## Files Created

- `/src/i18n/config.ts` (116 lines)
- `/src/i18n/namespaces.ts` (21 lines)
- `/src/i18n/request.ts` (47 lines)
- `/src/i18n/navigation.ts` (35 lines)
- `/src/i18n/formatting.ts` (189 lines)
- `/src/i18n/rtl-support.ts` (161 lines)
- `/src/i18n/extract-keys.ts` (138 lines)
- `/src/middleware.ts` (97 lines)
- `/src/components/i18n/language-switcher.tsx` (132 lines)
- `/src/components/i18n/locale-provider.tsx` (35 lines)
- `/messages/en.json` (450 lines)
- `/messages/es.json` (450 lines)
- `/messages/fr.json` (450 lines)

**Total: 2,321 lines of production-ready code**

## References

- [next-intl Documentation](https://next-intl-docs.vercel.app)
- [MDN Intl API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)
- [date-fns](https://date-fns.org)
- [Witylogix Dashboard Repo](../README.md)
