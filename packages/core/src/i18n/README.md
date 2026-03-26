# i18n (Internationalization) Module

A lightweight, zero-dependency internationalization utility for the Witylogix dashboard. Provides simple key-based translations with parameter interpolation, nested key support, and fallback to English.

## Features

- **Simple API**: One main function `t()` for all translation needs
- **Nested Keys**: Support for dot notation (e.g., `'orders.status.pending'`)
- **Parameter Interpolation**: Replace placeholders with dynamic values
- **Fallback Support**: Gracefully falls back to English if translation missing
- **RTL Support**: Built-in detection for right-to-left languages (Arabic)
- **No Dependencies**: Pure TypeScript, no external libraries
- **Type Safe**: Full TypeScript support with exported types
- **Extensible**: Easy to add new locales or extend functionality

## Supported Locales

- **en** - English
- **es** - Spanish
- **fr** - French
- **ar** - Arabic (with RTL support)

## Basic Usage

### Initialization

```typescript
import { initializeI18n, loadLocaleData, setLocale } from '@witylogix/core/i18n';
import enTranslations from './i18n/locales/en.json';
import esTranslations from './i18n/locales/es.json';

// Initialize i18n with configuration
initializeI18n({
  defaultLocale: 'en',
  fallbackLocale: 'en',
  supportedLocales: ['en', 'es', 'fr', 'ar'],
});

// Load translations
loadLocaleData('en', enTranslations);
loadLocaleData('es', esTranslations);
// ... load other locales
```

### Simple Translations

```typescript
import { t } from '@witylogix/core/i18n';

// Get a simple translation
const saveButtonText = t('common.save'); // "Save"
const cancelButtonText = t('common.cancel'); // "Cancel"
```

### Nested Keys

The system supports nested translation objects using dot notation:

```typescript
// Translates to "Pending", "Confirmed", "Assigned", etc.
const orderStatus = t('orders.status.pending');
const driverStatus = t('drivers.status.online');
```

### Parameter Interpolation

Translations can include parameters using `{{paramName}}` syntax:

```typescript
// English: "Order assigned to {{driver}}"
// Spanish: "Pedido asignado a {{driver}}"
const message = t('orders.assigned', { driver: 'John' }); // "Order assigned to John"

// Multiple parameters
const notification = t('notifications.order_created', { order_id: '12345' });
// "Order 12345 has been created"

// Numeric parameters are converted to strings
const msg = t('notifications.order_created', { order_id: 12345 });
// "Order 12345 has been created"
```

### Locale Management

```typescript
import { setLocale, getLocale, isRTL, getDirection } from '@witylogix/core/i18n';

// Change the active locale
setLocale('es'); // Spanish

// Get current locale
const current = getLocale(); // 'es'

// Check if current locale is RTL
if (isRTL()) {
  // Apply RTL styles
}

// Get direction string (useful for HTML dir attribute)
const dir = getDirection(); // 'rtl' or 'ltr'
document.documentElement.dir = dir;
```

## Advanced Usage

### Check if Key Exists

```typescript
import { hasKey } from '@witylogix/core/i18n';

if (hasKey('orders.status.pending')) {
  // Key exists
}
```

### Get All Translations

```typescript
import { getAllTranslations } from '@witylogix/core/i18n';

const currentTranslations = getAllTranslations();
```

### Dynamic Locale Loading

For code splitting, you can load locales dynamically:

```typescript
import { dynamicLoadLocale } from '@witylogix/core/i18n';

// Load locale on demand
await dynamicLoadLocale('es', () => import('./locales/es.json'));

// Now use the loaded locale
setLocale('es');
const text = t('common.save'); // Spanish translation
```

## React Integration Example

### Hook for Translations

```typescript
import { useState, useCallback } from 'react';
import { t, setLocale, getLocale, isRTL } from '@witylogix/core/i18n';

export function useTranslation() {
  const [locale, setCurrentLocale] = useState(getLocale());

  const changeLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    setCurrentLocale(newLocale);
    document.documentElement.dir = isRTL() ? 'rtl' : 'ltr';
  }, []);

  return {
    t,
    locale,
    setLocale: changeLocale,
    isRTL,
  };
}
```

### Usage in Components

```typescript
function OrdersPage() {
  const { t, locale, setLocale } = useTranslation();

  return (
    <div>
      <h1>{t('navigation.orders')}</h1>

      <table>
        <thead>
          <tr>
            <th>{t('orders.table.order_id')}</th>
            <th>{t('orders.table.customer')}</th>
            <th>{t('orders.table.status')}</th>
          </tr>
        </thead>
      </table>

      <button onClick={() => setLocale('es')}>Español</button>
      <button onClick={() => setLocale('en')}>English</button>
    </div>
  );
}
```

### RTL Support in Components

```typescript
function Dashboard() {
  const { t, isRTL } = useTranslation();

  return (
    <div dir={isRTL() ? 'rtl' : 'ltr'}>
      <h1>{t('navigation.dashboard')}</h1>
      {/* RTL styles will be applied automatically via CSS */}
    </div>
  );
}
```

## Translation File Structure

Translations are organized hierarchically by feature:

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel"
  },
  "orders": {
    "title": "Orders",
    "status": {
      "pending": "Pending",
      "confirmed": "Confirmed"
    },
    "assigned": "Order assigned to {{driver}}"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "orders": "Orders"
  },
  "errors": {
    "not_found": "Resource not found",
    "validation_failed": "Validation failed"
  }
}
```

## Adding New Locales

1. Create a new JSON file in `locales/` directory
2. Use English file as template
3. Load the locale in your app initialization:

```typescript
import arTranslations from './i18n/locales/ar.json';

loadLocaleData('ar', arTranslations);

// If locale is RTL, add metadata
if (arTranslations._meta?.rtl) {
  document.documentElement.dir = 'rtl';
}
```

## Key Naming Conventions

- Use lowercase with dot notation for nested keys
- Use underscores for multi-word keys: `order_id`, `pick_up_location`
- Group related keys by feature (orders, drivers, zones, etc.)
- Use descriptive names that indicate content: `status`, `actions`, `table`

## Fallback Behavior

1. **First attempt**: Look for key in current locale
2. **Fallback**: If not found, try fallback locale (usually English)
3. **Missing key**: If not found anywhere, return the key itself and log a warning

## Performance Considerations

- Translations are cached in memory after initial load
- Nested key lookups are O(depth) where depth is typically 2-3 levels
- Parameter interpolation uses simple string replacement
- No external dependencies means minimal bundle size (~4KB gzipped)

## Testing

Run the comprehensive test suite:

```bash
npm test packages/core/src/i18n/__tests__/i18n.test.ts
```

The test suite covers:
- Basic translation lookup
- Nested key resolution
- Parameter interpolation
- Locale switching
- RTL detection
- Fallback behavior
- Edge cases
- Performance characteristics

## TypeScript Types

```typescript
// Available exported types
export type Locale = 'en' | 'es' | 'fr' | 'ar';

export interface I18nConfig {
  defaultLocale: Locale;
  fallbackLocale: Locale;
  supportedLocales: Locale[];
}

export interface LocaleData {
  [key: string]: string | Record<string, any>;
}
```

## Troubleshooting

### Missing Translation Key

If you see warnings like "Translation key not found: some.key":

1. Check that the key exists in your locale JSON files
2. Verify the key path matches the nested structure
3. Check for typos or case sensitivity issues

### Parameter Not Being Replaced

- Ensure parameter names match the placeholders: `t('key', { name: 'value' })`
- Check placeholder format: must be `{{paramName}}` (double braces)
- Spaces are allowed: `{{ param }}` works too

### Wrong Locale Being Used

1. Call `setLocale()` after loading translations
2. Verify the locale is in `supportedLocales`
3. Check that the locale data was loaded via `loadLocaleData()`

## Future Enhancements

Possible additions without adding dependencies:

- Locale auto-detection from browser
- Plural form handling
- Date/time formatting helpers
- Number formatting helpers
- Namespace support for code-splitting
- Hot reload during development
- Translation management UI

## Related Files

- **Core utility**: `packages/core/src/i18n/index.ts`
- **English translations**: `packages/core/src/i18n/locales/en.json`
- **Spanish translations**: `packages/core/src/i18n/locales/es.json`
- **French translations**: `packages/core/src/i18n/locales/fr.json`
- **Arabic translations**: `packages/core/src/i18n/locales/ar.json`
- **Tests**: `packages/core/src/i18n/__tests__/i18n.test.ts`

## License

Part of Witylogix Platform - Proprietary
