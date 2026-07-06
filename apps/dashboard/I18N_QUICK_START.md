# i18n Quick Start Guide

Get the internationalization framework running in 5 minutes.

## Step 1: Install Dependencies

```bash
cd apps/dashboard

# Install next-intl and date utilities
pnpm add next-intl date-fns
pnpm add -D @types/date-fns glob
```

## Step 2: Update next.config.ts

Add the next-intl plugin at the top of your `next.config.ts`:

```typescript
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl({
  // ... your existing config
});
```

## Step 3: Update Root Layout

Replace `src/app/layout.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { getMessages, getLocale } from 'next-intl/server';
import { LocaleProvider } from '@/components/i18n/locale-provider';
import type { Metadata } from 'next';

const supportedLocales = ['en', 'es', 'fr'];

export const metadata: Metadata = {
  title: 'Witylogix Dashboard',
  description: 'Delivery logistics command center',
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function RootLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="wl-noise">
        <LocaleProvider locale={locale} messages={messages}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
```

## Step 4: Wrap Existing Content

If you have existing content, wrap it:

```typescript
'use client';

import { useTranslations } from 'next-intl';

export function Dashboard() {
  const t = useTranslations('dashboard');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('welcome')}</p>
    </div>
  );
}
```

## Step 5: Add Language Switcher (Optional)

Add to your header or sidebar:

```typescript
'use client';

import { useLocale } from 'next-intl';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';

export function Header() {
  const locale = useLocale();

  return (
    <header>
      <h1>Dashboard</h1>
      <LanguageSwitcher currentLocale={locale as 'en' | 'es' | 'fr'} />
    </header>
  );
}
```

## Common Patterns

### Getting Translations

```typescript
// In any component (server or client)
import { useTranslations } from "next-intl";

const t = useTranslations("orders");
t("title"); // "Orders"
t("list.columns.id"); // "Order ID"
```

### Using Dates

```typescript
import { formatDate, getTimeAgoLabel } from "@/i18n/formatting";
import { useLocale } from "next-intl";

const locale = useLocale() as any;

// Relative date
formatDate(new Date(), "relative", locale); // "just now"

// Absolute date
formatDate(new Date(), "absolute", locale); // "March 16, 2026, 10:30 AM"

// Time ago
getTimeAgoLabel(new Date(), locale); // "just now"
```

### Using Currency

```typescript
import { formatCurrency } from "@/i18n/formatting";
import { useLocale } from "next-intl";

const locale = useLocale() as any;

formatCurrency(1234.56, "USD", locale); // "$1,234.56" (en)
// "1.234,56 $" (es)
```

### Using Numbers

```typescript
import { formatNumber } from "@/i18n/formatting";
import { useLocale } from "next-intl";

const locale = useLocale() as any;

formatNumber(1234567.89, locale); // "1,234,567.89" (en)
// "1.234.567,89" (es)
```

### Routing

```typescript
import { Link, useRouter } from '@/i18n/navigation';

// Links automatically include locale
<Link href="/orders">{t('orders.title')}</Link>

// Router also handles locale
const router = useRouter();
router.push('/orders/123'); // Preserves current locale
```

## Testing

### Verify Setup

```bash
# From apps/dashboard
npm run dev

# Visit http://localhost:3003/en
# Visit http://localhost:3003/es
# Visit http://localhost:3003/fr
```

### Check Translations

```bash
# Extract and validate translation keys
node -e "require('./src/i18n/extract-keys.ts').generateReport()"

# Check console output for:
# - Total keys found
# - Missing translations per locale
# - Files using translations
```

## Locales

| Locale | Language | Region        | Flag |
| ------ | -------- | ------------- | ---- |
| `en`   | English  | United States | 🇺🇸   |
| `es`   | Spanish  | Spain         | 🇪🇸   |
| `fr`   | French   | France        | 🇫🇷   |

## Key Paths

All translations are in `messages/` folder:

- `messages/en.json` - English
- `messages/es.json` - Spanish
- `messages/fr.json` - French

Structure:

```
{
  "common": { ... },
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

## Next Steps

1. Replace hardcoded text with `t()` calls
2. Use formatting utilities for dates/currency/numbers
3. Add language switcher to header
4. Test locale switching and persistence
5. Run extraction report to find gaps
6. Add any missing translations

## Troubleshooting

**Messages not showing?**

- Verify `next.config.ts` has the plugin
- Check layout has `LocaleProvider`
- Run `pnpm install` again

**Locale not changing?**

- Open DevTools → Application → Cookies
- Check `NEXT_LOCALE` cookie is being set
- Verify middleware.ts exists

**Build failing?**

- Check for import errors in i18n files
- Verify `request.ts` file path in next.config
- Run `pnpm run build` to see full error

## Resources

- Full documentation: `/I18N_IMPLEMENTATION.md`
- Configuration: `/src/i18n/config.ts`
- Translations: `/messages/*.json`
- Components: `/src/components/i18n/`

## Support

All framework files are fully typed with TypeScript and documented with JSDoc comments.

Check `/src/i18n/` for comprehensive implementation examples.
