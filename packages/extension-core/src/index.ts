// @ts-nocheck
/**
 * @witylogix/extension-core
 * 
 * Shared utilities package for Shopify checkout-ui and POS-ui extensions
 * 
 * Exports:
 * - Types for themes, delivery options, API contracts
 * - Theme bridge: CSS custom property reading and observation
 * - App Bridge: Typed wrapper around Shopify App Bridge
 * - Hooks: Preact hooks for common extension patterns
 * 
 * Bundle target: < 20KB (Preact 3KB + utilities < 17KB)
 */

// ─── Types ───────────────────────────────────────────
export type {
  ThemeTokens,
  ColorScale,
  SemanticColorScale,
  ExtensionConfig,
  TimeSlot,
  DeliveryOption,
  DeliveryFilter,
  DiscountResult,
  AddressResult,
  SessionData,
  ExtensionApi,
  ErrorBoundaryProps,
  ExtensionMetadata,
  PostMessageEnvelope,
} from './types.ts';

// ─── Theme Bridge ────────────────────────────────────
export {
  getThemeVar,
  readThemeTokens,
  detectColorScheme,
  observeThemeChanges,
  preloadThemeTokens,
  getCachedOrDefaultThemes,
} from './theme-bridge.ts';

// ─── App Bridge ──────────────────────────────────────
export {
  AppBridgeClient,
  AppBridgeError,
  createAppBridgeClient,
  ErrorBoundary,
  withErrorBoundary,
  withRetry,
} from './app-bridge.ts';

// ─── Hooks ───────────────────────────────────────────
export {
  useTheme,
  useAppBridge,
  useDeliveryOptions,
  useExtensionApi,
  useExtensionMetadata,
  useExtensionConfig,
  useAsync,
  useDebounce,
} from './hooks.ts';
