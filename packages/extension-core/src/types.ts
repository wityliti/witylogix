// @ts-nocheck
/**
 * Core types for Witylogix Shopify extensions
 *
 * These types define the contract between:
 * - Extension components (Preact)
 * - Shopify App Bridge (checkout extensions)
 * - postMessage API (POS extensions)
 * - Dashboard theme tokens (--wl-* CSS custom properties)
 */

/**
 * Theme token colors with scale from 50 (light) to 900 (dark)
 */
export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

/**
 * Semantic color scale (used for success, warning, danger, info)
 */
export interface SemanticColorScale {
  400: string;
  500: string;
  600: string;
  bg?: string;
}

/**
 * Complete theme tokens derived from Witylogix design system
 * Maps to --wl-* CSS custom properties from dashboard tokens.css
 */
export interface ThemeTokens {
  /**
   * Color palette: primary, neutral, status colors
   */
  colors: {
    primary: ColorScale;
    neutral: ColorScale;
    success: SemanticColorScale;
    warning: SemanticColorScale;
    danger: SemanticColorScale;
    info: SemanticColorScale;
    /**
     * Text color variants
     */
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
      inverse: string;
    };
    /**
     * Border colors for different emphasis levels
     */
    border: {
      subtle: string;
      default: string;
      strong: string;
      focus: string;
    };
    /**
     * Background layers: root, surface, elevated, overlay, sunken, sidebar
     */
    background: {
      root: string;
      surface: string;
      elevated: string;
      overlay: string;
      sunken: string;
      sidebar: string;
    };
  };

  /**
   * Spacing scale in rem units (0px to 48px)
   * Used for padding, margin, gaps
   */
  spacing: {
    0: string;
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
    6: string;
    8: string;
    10: string;
    12: string;
  };

  /**
   * Typography: fonts, sizes, font weights
   */
  typography: {
    fontSans: string;
    fontMono: string;
    /**
     * Font sizes from 11px (xs) to 30px (3xl)
     */
    sizes: {
      xs: string;
      sm: string;
      base: string;
      md: string;
      lg: string;
      xl: string;
      "2xl": string;
      "3xl": string;
    };
    weights: {
      light: number;
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
  };

  /**
   * Border radii: sm (4px) to full (9999px)
   */
  radii: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };

  /**
   * Current color scheme: 'light' or 'dark'
   * Derived from prefers-color-scheme or manual detection
   */
  colorScheme: "light" | "dark";
}

/**
 * Extension configuration injected by Shopify/parent window
 * Available at window.__EXTENSION_CONFIG__
 */
export interface ExtensionConfig {
  /** Shop ID from Shopify */
  shopId: string;
  /** Unique extension identifier */
  extensionId: string;
  /** API key for backend communication (Shopify-issued) */
  apiKey: string;
  /** Optional: Custom origin for App Bridge (defaults to Shopify checkout) */
  appBridgeOrigin?: string;
  /** Optional: Custom origin for POS postMessage communication */
  posExtensionOrigin?: string;
  /** Optional: Feature flags (e.g., beta features) */
  features?: Record<string, boolean>;
}

/**
 * Delivery time slot: available date and time window
 */
export interface TimeSlot {
  /** Unique identifier for this slot */
  id: string;
  /** ISO 8601 date string (YYYY-MM-DD) */
  date: string;
  /** Start time in 24-hour format (HH:MM) */
  startTime: string;
  /** End time in 24-hour format (HH:MM) */
  endTime: string;
  /** Whether this slot is available for booking */
  available: boolean;
}

/**
 * Delivery option: service level with multiple time slots
 */
export interface DeliveryOption {
  /** Unique identifier */
  id: string;
  /** Display name (e.g., "Express Delivery", "Standard Delivery") */
  name: string;
  /** Longer description for user context */
  description: string;
  /** Available time slots for this delivery option */
  timeSlots: TimeSlot[];
  /** Cost in currency units (e.g., 9.99 USD) */
  cost: number;
  /** ISO 4217 currency code (e.g., "USD", "EUR") */
  currency: string;
  /** Whether user has selected this option */
  selected: boolean;
  /** Optional: Estimated delivery days (e.g., 1-2 for express) */
  estimatedDays?: number;
}

/**
 * Filters for fetching delivery options
 */
export interface DeliveryFilter {
  /** Only show options with cost <= maxCost */
  maxCost?: number;
  /** Only show options with estimated delivery <= maxDays */
  maxDays?: number;
  /** Filter by specific service type */
  serviceType?: string;
}

/**
 * Result from applying a discount code via App Bridge
 */
export interface DiscountResult {
  /** Whether discount was applied successfully */
  success: boolean;
  /** New order total after discount (if successful) */
  newTotal?: number;
  /** Percentage discount applied (e.g., 10 for 10%) */
  discountPercent?: number;
  /** Error message (if unsuccessful) */
  error?: string;
  /** Human-readable error code for UI handling */
  errorCode?: "INVALID_CODE" | "EXPIRED" | "LIMIT_EXCEEDED" | "UNKNOWN";
}

/**
 * Result from updating shipping address via App Bridge
 */
export interface AddressResult {
  /** Whether address update was successful */
  success: boolean;
  /** Error message (if unsuccessful) */
  error?: string;
}

/**
 * Session data from customer's current checkout session
 */
export interface SessionData {
  /** Customer ID if logged in (otherwise undefined for guest) */
  customerId?: string;
  /** Guest email if provided */
  guestEmail?: string;
  /** Current cart value in currency units */
  cartValue: number;
  /** ISO 4217 currency code */
  currency: string;
}

/**
 * API for POS extension communication via postMessage
 * Enables bidirectional RPC-style calls between extension and parent frame
 */
export interface ExtensionApi {
  /**
   * Call a method in the parent frame (POS)
   * Returns promise that resolves when parent sends response
   * @param method - Method name to invoke
   * @param args - Arguments to pass
   * @returns Promise<any> - Result from parent frame
   */
  invoke(method: string, args: unknown): Promise<unknown>;

  /**
   * Register a handler for parent frame to call
   * @param method - Method name to handle
   * @param handler - Async function to process requests
   */
  register(method: string, handler: (args: unknown) => Promise<unknown>): void;

  /**
   * Subscribe to events from parent frame
   * @param event - Event name
   * @param handler - Function to call when event fires
   * @returns Unsubscribe function
   */
  subscribe(event: string, handler: (data: unknown) => void): () => void;
}

/**
 * Error boundary props for catching extension errors
 */
export interface ErrorBoundaryProps {
  children: preact.ComponentChild;
  onError?: (error: Error, errorInfo: string) => void;
  fallback?: preact.ComponentChild;
}

/**
 * Metadata attached to extension by build system
 * Available at window.__EXTENSION_METADATA__
 */
export interface ExtensionMetadata {
  /** Semantic version (e.g., "1.2.3") */
  version: string;
  /** ISO 8601 deployment timestamp */
  deployedAt: string;
  /** Git commit SHA */
  commitSha: string;
  /** Extension type: "checkout" or "pos" */
  type: "checkout" | "pos";
}

/**
 * Message envelope for postMessage communication
 * Used in POS extension <-> parent window communication
 */
export interface PostMessageEnvelope {
  type: string;
  id?: string;
  method?: string;
  data?: unknown;
  error?: string;
  errorCode?: string;
}
