# i18n Framework - File Reference Guide

Complete index of all i18n files with descriptions and key functions.

## Core Configuration Files

### `src/i18n/config.ts` (116 lines)

**Purpose**: Locale configuration, metadata, and detection logic.

**Key Exports**:
- `LocaleKey` - Type union: 'en' | 'es' | 'fr'
- `defaultLocale` - 'en'
- `supportedLocales` - ['en', 'es', 'fr']
- `localeMetadata` - Metadata for each locale (name, flag, timezone, currency, etc.)
- `getLocaleFromRequest(cookieLocale, acceptLanguage)` - Detect locale from request
- `getLocaleFormatting(locale)` - Get formatting options for locale
- `isRTL(locale)` - Check if locale is RTL
- `getAllLocales()` - Get all locales with metadata

**Usage**:
```typescript
import { getLocaleFromRequest, localeMetadata, supportedLocales } from '@/i18n/config';

const locale = getLocaleFromRequest(cookie, header);
const { name, flag, timeFormat } = localeMetadata['en'];
```

---

### `src/i18n/namespaces.ts` (21 lines)

**Purpose**: Translation namespace definitions.

**Key Exports**:
- `defaultNS` - 'common'
- `namespaces` - Array of namespace names
- `Namespace` - Type for namespace names
- `resources` - Translation resources (for static typing)

**Namespaces**:
- common
- auth
- onboarding
- dashboard
- orders
- drivers
- deliveries
- settings
- integrations

---

### `src/i18n/request.ts` (47 lines)

**Purpose**: next-intl request configuration for message loading.

**Key Exports**:
- Default export: `getRequestConfig()` - Returns locale, messages, timeZone

**How it works**:
- Called automatically by next-intl in server contexts
- Detects locale from headers/cookies
- Validates locale against supported list
- Dynamically imports messages JSON
- Falls back to default locale if error

---

### `src/i18n/navigation.ts` (35 lines)

**Purpose**: Type-safe localized navigation helpers.

**Key Exports**:
- `Link` - Localized link component (auto-includes locale)
- `redirect` - Localized redirect function
- `usePathname` - Hook for pathname without locale
- `useRouter` - Hook for router that preserves locale
- `useTransitionRouter` - Hook for router with transitions

**Usage**:
```typescript
import { Link, useRouter, usePathname } from '@/i18n/navigation';

<Link href="/orders">Orders</Link>
const router = useRouter();
router.push('/orders/123'); // Automatically includes locale
const pathname = usePathname(); // Returns '/orders', not '/en/orders'
```

---

## Utilities

### `src/i18n/formatting.ts` (189 lines)

**Purpose**: Locale-aware formatting utilities.

**Key Exports**:
- `formatCurrency(amount, currency?, locale?)` - Format currency
- `formatDate(date, style, locale?)` - Format date (relative/absolute/short)
- `formatNumber(num, locale?)` - Format number with separators
- `formatDistance(meters, locale?)` - Format distance (km/miles)
- `formatWeight(grams, locale?)` - Format weight (kg/lbs)
- `formatDuration(seconds, locale?)` - Format duration (human-readable)
- `getTimeAgoLabel(date, locale?)` - Get relative time label

**Examples**:
```typescript
import { formatCurrency, formatDate, formatDistance } from '@/i18n/formatting';

formatCurrency(1234.56, 'USD', 'en')  // "$1,234.56"
formatCurrency(1234.56, 'EUR', 'es')  // "1.234,56 €"

formatDate(new Date(), 'relative', 'en')  // "2 hours ago"
formatDate(new Date(), 'absolute', 'en')  // "March 16, 2026, 10:30 AM"

formatDistance(5000, 'en')  // "3.11 mi"
formatDistance(5000, 'es')  // "5 km"

formatWeight(2000, 'en')   // "4.41 lbs"
formatWeight(2000, 'es')   // "2 kg"

getTimeAgoLabel(new Date(Date.now() - 5*60000), 'en')  // "5m ago"
```

---

### `src/i18n/rtl-support.ts` (161 lines)

**Purpose**: RTL (right-to-left) preparation utilities.

**Key Exports**:
- `getDirection(locale)` - Get 'ltr' or 'rtl'
- `isLocaleRTL(locale)` - Check if locale is RTL
- `rtlSpacing(locale, config)` - RTL-aware spacing object
- `rtlClasses(locale, config)` - RTL-aware class names
- `rtlAlign(locale, alignment)` - Get left/right for alignment
- `rtlTransform(locale, distance)` - Get RTL-aware transform
- `getLogicalProperties(locale)` - Get CSS logical property helpers

**Usage**:
```typescript
import { getDirection, getLogicalProperties } from '@/i18n/rtl-support';

const dir = getDirection('en'); // 'ltr'
const props = getLogicalProperties('en');

<div style={props.marginStart('16px')}>Start-aligned margin</div>
<div style={props.textStart()}>Start-aligned text</div>
```

---

### `src/i18n/extract-keys.ts` (138 lines)

**Purpose**: Translation key extraction and validation script.

**Key Exports**:
- `extractKeysFromFiles()` - Scan files and extract translation keys
- `generateReport()` - Generate and save extraction report

**Usage**:
```bash
# From apps/dashboard
node -e "require('./src/i18n/extract-keys.ts').generateReport()"

# Output:
# - Total keys found
# - Keys by file
# - Missing translations per locale
# - i18n-extraction-report.json
```

---

## Middleware

### `src/middleware.ts` (97 lines)

**Purpose**: Locale detection, routing, and authentication.

**Key Features**:
- Locale detection (cookie → Accept-Language → default)
- Locale persistence to cookie (1 year)
- Protected route authentication check
- Public route handling
- Automatic redirects for unauthorized access

**Protected Routes**:
- /orders, /drivers, /deliveries
- /settings, /integrations, /admin
- /profile, /analytics, /support

**Public Routes**:
- /auth/login, /auth/register, /auth/forgot-password

**Config**:
- `localeCookie: 'NEXT_LOCALE'`
- `localePrefix: 'as-needed'` (no prefix for default locale)

---

## Components

### `src/components/i18n/language-switcher.tsx` (132 lines)

**Purpose**: Language selection UI component.

**Props**:
```typescript
interface LanguageSwitcherProps {
  currentLocale: LocaleKey;
  className?: string;
  variant?: 'dropdown' | 'inline';
}
```

**Features**:
- Flag emoji indicators
- Smooth locale switching (no full page reload)
- Cookie persistence
- Accessible (ARIA labels, keyboard nav)
- Dropdown and inline variants

**Usage**:
```typescript
import { useLocale } from 'next-intl';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';

const locale = useLocale();
<LanguageSwitcher currentLocale={locale as any} />
```

---

### `src/components/i18n/locale-provider.tsx` (35 lines)

**Purpose**: Client-side i18n provider wrapper.

**Props**:
```typescript
interface LocaleProviderProps {
  children: ReactNode;
  locale: string;
  messages: Record<string, any>;
  timeZone?: string;
  defaultNS?: string;
}
```

**Usage**:
```typescript
import { LocaleProvider } from '@/components/i18n/locale-provider';

<LocaleProvider locale="en" messages={messages} timeZone="UTC">
  <YourApp />
</LocaleProvider>
```

---

## Translation Files

### `messages/en.json` (450 lines)

**Structure**:
```json
{
  "common": {
    "navigation": { ... },
    "actions": { ... },
    "status": { ... },
    "time": { ... },
    "errors": { ... },
    "success": { ... }
  },
  "auth": { ... },
  "onboarding": { ... },
  "dashboard": { ... },
  "orders": { ... },
  "drivers": { ... },
  "deliveries": { ... },
  "settings": { ... },
  "integrations": { ... }
}
```

**Key Categories**:
- Navigation (10 keys)
- Actions (20 keys)
- Status (12 keys)
- Time (12 keys)
- Errors (10 keys)
- Success (10 keys)

---

### `messages/es.json` (450 lines)

Complete Spanish translations with professional quality (not machine-translated).

**Language Settings**:
- Format: dd/MM/yyyy
- Time: 24h
- Currency: EUR
- Timezone: Europe/Madrid

---

### `messages/fr.json` (450 lines)

Complete French translations with professional quality (not machine-translated).

**Language Settings**:
- Format: dd/MM/yyyy
- Time: 24h
- Currency: EUR
- Timezone: Europe/Paris

---

## Documentation

### `I18N_IMPLEMENTATION.md`

**Sections**:
- Architecture overview
- File structure
- Core components documentation
- Integration checklist
- Best practices
- Testing procedures
- Troubleshooting
- Migration guide

**Use this for**: Complete reference and implementation details.

---

### `I18N_QUICK_START.md`

**Sections**:
- 5-step setup guide
- Common patterns
- Testing instructions
- Locale reference
- Troubleshooting quick fixes

**Use this for**: Getting started quickly.

---

### `I18N_SUMMARY.txt`

**Sections**:
- File inventory
- Key features
- Translation coverage
- Integration steps
- Architecture highlights
- Quality metrics

**Use this for**: Overview and summary.

---

## Usage by File Type

### In Server Components
```typescript
import { useTranslations } from 'next-intl';

export default function Page() {
  const t = useTranslations('orders');
  return <h1>{t('title')}</h1>;
}
```

### In Client Components
```typescript
'use client';
import { useTranslations } from 'next-intl';

export function OrderCard() {
  const t = useTranslations('orders');
  return <div>{t('list.title')}</div>;
}
```

### Formatting
```typescript
import { formatCurrency, formatDate } from '@/i18n/formatting';
import { useLocale } from 'next-intl';

const locale = useLocale() as any;
const price = formatCurrency(99.99, 'USD', locale);
const date = formatDate(new Date(), 'relative', locale);
```

### Navigation
```typescript
import { Link, useRouter } from '@/i18n/navigation';

<Link href="/orders">Go to Orders</Link>
const router = useRouter();
router.push('/orders/123');
```

### Language Switching
```typescript
import { useLocale } from 'next-intl';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';

const locale = useLocale();
<LanguageSwitcher currentLocale={locale as any} />
```

---

## File Dependencies

```
middleware.ts
├── i18n/config.ts

components/i18n/language-switcher.tsx
├── i18n/config.ts
├── i18n/navigation.ts
└── lib/utils.ts

components/i18n/locale-provider.tsx
└── (next-intl/client)

i18n/request.ts
├── i18n/config.ts
└── messages/*.json

i18n/navigation.ts
├── i18n/config.ts
└── (next-intl/navigation)

i18n/formatting.ts
├── i18n/config.ts
├── date-fns
└── (Intl API)

i18n/rtl-support.ts
├── i18n/config.ts
└── lib/utils.ts (cn)

i18n/extract-keys.ts
├── fs
├── path
├── glob
└── (node)
```

---

## Quick Reference

| File | Size | Purpose | Key Exports |
|------|------|---------|------------|
| config.ts | 2.8K | Locale config | getLocaleFromRequest, isRTL, localeMetadata |
| namespaces.ts | 533B | Namespaces | defaultNS, namespaces, resources |
| request.ts | 1.7K | Message loading | getRequestConfig (default) |
| navigation.ts | 1.2K | Routing | Link, redirect, useRouter |
| formatting.ts | 5.1K | Formatting | formatCurrency, formatDate, formatNumber |
| rtl-support.ts | 3.7K | RTL support | getDirection, getLogicalProperties |
| extract-keys.ts | 4.2K | Validation | extractKeysFromFiles, generateReport |
| middleware.ts | 2.8K | Auth & routing | Middleware handler |
| language-switcher.tsx | 4.3K | UI | LanguageSwitcher component |
| locale-provider.tsx | 711B | Provider | LocaleProvider component |

---

## Translation Keys Count

| Namespace | Count |
|-----------|-------|
| common | 122 |
| auth | 30 |
| onboarding | 30 |
| dashboard | 20 |
| orders | 20 |
| drivers | 20 |
| deliveries | 16 |
| settings | 72 |
| integrations | 40 |
| **TOTAL** | **450+** |

---

## Locale Metadata

| Locale | Name | Format | Time | Currency | Timezone |
|--------|------|--------|------|----------|----------|
| en | English | MM/dd/yyyy | 12h | USD | America/New_York |
| es | Spanish | dd/MM/yyyy | 24h | EUR | Europe/Madrid |
| fr | French | dd/MM/yyyy | 24h | EUR | Europe/Paris |

---

End of File Reference Guide
