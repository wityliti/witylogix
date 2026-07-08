# ADR-011: Extension Architecture for Preact Checkout-UI and POS-UI Extensions

**Status:** Proposed
**Date:** 2026-03-07
**Deciders:** Arjun (CTO)
**Supersedes:** None
**Relates to:** ADR-010 (Event Bus Architecture), ADR-009 (Medusa-Inspired Architecture), ADR-008 (Auth Provider Abstraction)

---

## Executive Summary

Witylogix is implementing **Preact-based extensions** for Shopify checkout-ui and POS-ui, with **< 64KB bundled size** and **CSS custom property theming**. This decision enables:

1. **Minimal bundle footprint** — Preact (3KB) vs React (42KB); aggressive tree-shaking via Vite
2. **Design system cohesion** — `--wl-*` CSS custom properties bridge theme tokens from dashboard to extensions
3. **Shopify compliance** — App Bridge for checkout actions, postMessage for POS cross-origin communication
4. **Developer velocity** — Shared `@witylogix/extension-core` package with typed hooks, theme utilities, and app bridge wrappers
5. **Isolation and safety** — Sandboxed iframe execution with explicit message passing
6. **Runtime performance** — No virtual DOM overhead for simple UI updates; reactive theme updates via CSS custom properties

**Key Architecture:**

- `@witylogix/extension-core` package (< 20KB) providing theme bridge, app bridge wrappers, and Preact hooks
- Vite-based build with aggressive code splitting and dynamic imports
- Theme token detection (dark/light) with localStorage persistence
- Typed App Bridge actions: `applyDiscount`, `updateShippingAddress`, `requestSession`
- Checkout extensions use App Bridge; POS extensions use postMessage to parent frame

---

## Context

### Why Extensions? The Shopify Ecosystem

Shopify's checkout and POS extensibility model requires **lightweight, sandbox-safe** UI components:

**Checkout Extensions:**

- Inject custom fields into post-purchase experience
- Deliver order data via Shopify's App Bridge (100% reliable, queued)
- Bundle must be < 64KB (Shopify hard limit)
- Executed in sandboxed iframe with restricted DOM access

**POS Extensions:**

- Overlay UI on Square/Shopify POS system
- Communicate via `window.postMessage()` to parent frame
- No direct DOM manipulation (POS owns the tree)
- Must not block POS UI thread

### Legacy Pain Points

Currently, Witylogix has **empty extension stubs** at `extensions/checkout-ui/` and `extensions/pos-ui/`. Developers lack:

- Shared utilities for common patterns (theme reading, app bridge communication)
- Type safety for extension APIs
- Build optimization strategy to meet 64KB limit
- Testing harness for extension behavior

### Design System Continuity

Witylogix dashboard uses **CSS custom properties** (tokens.css):

```css
--wl-primary-500: #f5a623; /* Amber logistics warmth */
--wl-danger-500: #ef4444; /* Error red */
--wl-space-4: 1rem; /* 16px spacing */
--wl-text-primary: #f0f0f5; /* Dark theme text */
```

Extensions must **consume the same tokens**, ensuring:

- Visual consistency across dashboard, checkout, POS
- Single source of truth for design updates
- Theme switching (dark/light) affects all surfaces atomically

### Shopify App Bridge Reality

Shopify's App Bridge (`@shopify/app-bridge`) provides:

- **Reliable messaging** to checkout iframe (messages are queued if not ready)
- **Action types** for domain operations: `ApplyDiscount`, `UpdateShippingAddress`, `RequestSession`
- **Error handling** via Promise-based API
- **No direct access** to Shopify's internal state machine

---

## Architecture Decision

### Why Preact + Vite + CSS Custom Properties?

**Stack Comparison:**

| Criteria          | React    | Preact    | Vanilla JS        | Solid.js |
| ----------------- | -------- | --------- | ----------------- | -------- |
| Bundle size       | ~42KB    | 3KB       | 0KB               | ~8KB     |
| Tree-shaking      | Moderate | Excellent | N/A               | Good     |
| Dev velocity      | ★★★★★    | ★★★★★     | ★★                | ★★★      |
| Type safety       | ★★★★★    | ★★★★★     | ★★                | ★★★★     |
| Ecosystem         | ★★★★★    | ★★★       | ★★                | ★★★      |
| Deployment < 64KB | Hard     | Easy      | Easy (if complex) | Easy     |

**Decision Rationale:**

1. **Preact** — We accept JSX's developer velocity (prevents bugs, cleaner syntax). Preact is 1:1 API compatible with React hooks. 3KB footprint leaves 61KB for application code.

2. **Vite** — Modern bundler with excellent tree-shaking. Vite's `?import=meta.glob` pattern enables dynamic imports of extension features without adding dead code. Example: POS extensions load only needed features.

3. **CSS Custom Properties** — No CSS-in-JS runtime (adds 15KB+). Custom properties are:
   - Cascading (parent iframe sets tokens; child reads them)
   - Responsive (can be updated via media queries)
   - Reactive (CSS changes flow to DOM immediately)
   - Themeable (dark/light via `:root` recompilation)

### Architecture Diagram: Extension Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     WITYLOGIX DASHBOARD                      │
│                    (Next.js, Full Theme)                      │
│                                                               │
│  <html>                                                       │
│    <head>                                                     │
│      <style> :root { --wl-primary-500: #f5a623; ... } </style>│
│    </head>                                                    │
│    <body>                                                     │
└─────────────────────────────────────────────────────────────┘
    │
    │ Shopify Checkout Post-Purchase (iframe sandbox)
    │
┌─────────────────────────────────────────────────────────────┐
│             CHECKOUT EXTENSION (Preact)                      │
│        Bundled: 45KB (Preact 3KB + app code 42KB)            │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ ThemeBridge reads --wl-* from <html> computed style │    │
│  │ (via getComputedStyle on parent frame)              │    │
│  │ Provides useTheme() → { colors, spacing, fonts }    │    │
│  └──────────────────────────────────────────────────────┘    │
│                          │                                    │
│  ┌──────────────────────┴──────────────────────────────┐     │
│  │  Preact Component Layer                             │     │
│  │                                                      │     │
│  │  <CheckoutForm useTheme={useTheme()} />             │     │
│  │    └─ Button                                        │     │
│  │    └─ TextInput                                     │     │
│  │    └─ DeliveryOptions (useDeliveryOptions())        │     │
│  └──────────────────────────────────────────────────────┘     │
│                          │                                    │
│  ┌──────────────────────┴──────────────────────────────┐     │
│  │  App Bridge Integration (useAppBridge())            │     │
│  │                                                      │     │
│  │  onClick={ applyDiscount('SUMMER2024', 10) }        │     │
│  │    └─ App Bridge receives action                    │     │
│  │    └─ Shopify processes, returns result             │     │
│  │    └─ Extension receives Promise resolution         │     │
│  └──────────────────────────────────────────────────────┘     │
│                          │                                    │
│               ┌──────────┴──────────┐                         │
│               │                     │                         │
│      (Success callback)    (Error boundary)                   │
└─────────────────────────────────────────────────────────────┘
    │
    └─ App Bridge messaging (queued, reliable)
       │
       └─ Witylogix backend service
          (handles discount validation, etc.)
```

### POS Extension Execution (postMessage)

```
┌─────────────────────────────────────────────────────────────┐
│                    SHOPIFY / SQUARE POS                      │
│                   (Owns main DOM tree)                       │
│                                                               │
│  <html>                                                       │
│    <head>                                                     │
│      <style> :root { --wl-primary-500: #f5a623; ... } </style>│
│    </head>                                                    │
│    <body>                                                     │
│      <div id="wl-pos-extension"></div> ← Extension mounts    │
│      <script>                                                 │
│        window.addEventListener('message', (e) => {           │
│          if (e.source === posExtensionIframe) { ... }        │
│        });                                                    │
│      </script>                                                │
│    </body>                                                    │
└─────────────────────────────────────────────────────────────┘
    │
    │ postMessage API (cross-origin safe)
    │
┌─────────────────────────────────────────────────────────────┐
│            POS EXTENSION (Preact, < 50KB)                    │
│                                                               │
│  mount(() => {                                               │
│    const bridge = useExtensionApi();                         │
│    bridge.register('getOrderSummary', () => {...});          │
│    bridge.invoke('parent:showDeliveryOptions', {...});       │
│  })                                                          │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  postMessage → parent                                │    │
│  │  { type: 'wl:pos-action', action: 'getOrderSummary' }│    │
│  └──────────────────────────────────────────────────────┘    │
│           │                                                   │
│           └─ Parent processes, postMessage ← response         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Package Structure: @witylogix/extension-core

```
packages/extension-core/
  ├── src/
  │   ├── index.ts                    # Barrel exports
  │   ├── types.ts                    # DeliveryOption, TimeSlot, ExtensionConfig, ThemeTokens
  │   ├── theme-bridge.ts             # readThemeTokens(), observeThemeChanges()
  │   ├── app-bridge.ts               # AppBridgeClient, applyDiscount(), etc.
  │   └── hooks.ts                    # useTheme(), useAppBridge(), useDeliveryOptions(), useExtensionApi()
  ├── package.json                    # @witylogix/extension-core, type: module
  └── tsconfig.json                   # Extends ../../tsconfig.json, outDir: dist
```

**File Sizes (target):**

- `types.ts` — 100 lines / ~2KB
- `theme-bridge.ts` — 150 lines / ~4KB
- `app-bridge.ts` — 200 lines / ~6KB
- `hooks.ts` — 150 lines / ~4KB
- **Total** — ~16KB (with TS compilation overhead)

### Build Strategy: Vite Configuration

**Extension (Checkout) Vite Config:**

```typescript
export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: "src/index.tsx",
      formats: ["es"],
      fileName: "checkout-extension",
    },
    minify: "terser",
    terserOptions: {
      compress: { pure_funcs: ["console.log", "console.debug"] },
    },
    rollupOptions: {
      external: [],
      output: {
        assetFileNames: "assets/[name].[hash][extname]",
      },
    },
  },
});
```

**Code-Splitting Strategy:**

```typescript
// themes.ts — loaded dynamically only if needed
import { defineAsyncComponent } from "preact/async";

const POSSpecificUI = defineAsyncComponent(
  () => import("./features/pos-specific"),
);

// Theme module loaded on-demand based on query param
const theme = new URL(window.location).searchParams.get("theme");
if (theme === "pos") {
  const mod = await import("./themes/pos-specific.css");
}
```

---

## Implementation Details

### 1. Theme Bridge (`theme-bridge.ts`)

**Responsibility:** Map dashboard CSS custom properties (`--wl-*`) to JavaScript objects and observe changes.

**Key functions:**

```typescript
export async function readThemeTokens(): Promise<ThemeTokens>;
// Read --wl-* from parent frame's computed style
// Parse colors, spacing, typography into objects
// Detect dark/light mode from prefers-color-scheme

export function observeThemeChanges(
  callback: (tokens: ThemeTokens) => void,
): () => void;
// Watch for CSS custom property changes
// Use CSS.supports('@supports') for media query changes
// Return unsubscribe function

export function getThemeVar(name: string, fallback?: string): string;
// Get single CSS custom property value
// e.g., getThemeVar('--wl-primary-500') → '#f5a623'

export function detectColorScheme(): "light" | "dark";
// Check prefers-color-scheme
// Fall back to manual detection via --wl-bg-root luminance
```

### 2. App Bridge (`app-bridge.ts`)

**Responsibility:** Typed wrapper around Shopify App Bridge with error boundaries.

**Key functions:**

```typescript
export class AppBridgeClient {
  async applyDiscount(code: string, value: number): Promise<DiscountResult>
  async updateShippingAddress(addr: Address): Promise<AddressResult>
  async requestSession(): Promise<SessionData>
}

export function createAppBridgeClient(config: ExtensionConfig): AppBridgeClient
  // Initialize Shopify App Bridge
  // Set up message queue (for pre-mount scenarios)
  // Return typed client

export class ErrorBoundary extends Component
  // Catch errors in extension subtree
  // Log to Witylogix error tracking (via postMessage)
  // Render fallback UI
```

### 3. Hooks (`hooks.ts`)

**Responsibility:** Preact hooks for common extension patterns.

```typescript
export function useTheme(): ThemeTokens;
// useEffect → readThemeTokens()
// Subscribe to changes via observeThemeChanges()
// Return theme object, re-render on change

export function useAppBridge(): AppBridgeClient;
// useMemo → createAppBridgeClient()
// Inject config from window.__EXTENSION_CONFIG__
// Cache client across component tree

export function useDeliveryOptions(filters?: DeliveryFilter): {
  options: DeliveryOption[];
  selected: DeliveryOption | null;
  select: (opt: DeliveryOption) => void;
  isLoading: boolean;
  error?: Error;
};
// Fetch delivery options from backend via App Bridge
// Implement local caching + invalidation
// Return state tuple with loading/error states

export function useExtensionApi(): ExtensionApi;
// For POS extensions
// Enable typed postMessage communication with parent
// Return { invoke, register, subscribe } API
```

### 4. Types (`types.ts`)

```typescript
export interface ThemeTokens {
  colors: {
    primary: { 50: string; 100: string; ... 900: string };
    neutral: { 50: string; ... };
    success: { 400: string; 500: string; 600: string };
    danger: { ... };
    warning: { ... };
    info: { ... };
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
      inverse: string;
    };
    border: {
      subtle: string;
      default: string;
      strong: string;
      focus: string;
    };
  };
  spacing: {
    0: string; 1: string; 2: string; 3: string; 4: string;
    5: string; 6: string; 8: string; 10: string; 12: string;
  };
  typography: {
    fontSans: string;
    fontMono: string;
    sizes: {
      xs: string; sm: string; base: string; md: string;
      lg: string; xl: string; '2xl': string; '3xl': string;
    };
  };
  radii: { sm: string; md: string; lg: string; full: string };
  colorScheme: 'light' | 'dark';
}

export interface ExtensionConfig {
  shopId: string;
  extensionId: string;
  apiKey: string;
  appBridgeOrigin?: string;
  posExtensionOrigin?: string;
}

export interface DeliveryOption {
  id: string;
  name: string;
  description: string;
  timeSlots: TimeSlot[];
  cost: number;
  currency: string;
  selected: boolean;
}

export interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface DiscountResult {
  success: boolean;
  newTotal?: number;
  error?: string;
}

export interface AddressResult {
  success: boolean;
  error?: string;
}

export interface SessionData {
  customerId?: string;
  guestEmail?: string;
  cartValue: number;
}

export interface ExtensionApi {
  invoke(method: string, args: any): Promise<any>;
  register(method: string, handler: (args: any) => Promise<any>): void;
  subscribe(event: string, handler: (data: any) => void): () => void;
}
```

---

## Checkout Extension Build Output

**Example: `extensions/checkout-ui/dist/checkout-extension.js` (45KB gzipped)**

```
checkout-extension.js
├── Preact runtime (3KB)
├── @witylogix/extension-core (4KB)
│   ├── theme-bridge (1.5KB)
│   ├── app-bridge (2KB)
│   └── hooks (0.5KB)
└── Application code (35KB)
    ├── CheckoutForm component (8KB)
    ├── DeliverySelector (6KB)
    ├── PaymentIntegration (5KB)
    └── Utilities (16KB)
```

**Minified Comparison:**

- With React: ~75KB (fails Shopify limit)
- With Preact: ~45KB (comfortable headroom)

---

## POS Extension Build Output

**Example: `extensions/pos-ui/dist/pos-extension.js` (38KB gzipped)**

```
pos-extension.js
├── Preact runtime (3KB)
├── @witylogix/extension-core (4KB)
└── POS-specific code (31KB)
    ├── OrderOverlay (7KB)
    ├── DeliveryTimePicker (5KB)
    ├── postMessage bridge (2KB)
    └── Utilities (17KB)
```

---

## Communication Patterns

### Checkout Extension (App Bridge)

**Pattern 1: Apply Discount**

```typescript
const bridge = useAppBridge();

const applyCode = async () => {
  try {
    const result = await bridge.applyDiscount("SUMMER2024", 10);
    if (result.success) {
      showNotification("Discount applied!");
      updateUI({ newTotal: result.newTotal });
    } else {
      showError(result.error);
    }
  } catch (err) {
    showError("Network error");
  }
};
```

**App Bridge Flow:**

1. Extension calls `applyDiscount(code, value)`
2. App Bridge serializes action → `{ type: 'ApplyDiscount', payload: { ... } }`
3. Queues message if checkout iframe not ready
4. Shopify receives action, processes via backend webhook
5. Witylogix backend validates discount code
6. Returns `{ success: true, newTotal: 499.99 }`
7. Promise resolves in extension

### POS Extension (postMessage)

**Pattern: Request Order Summary**

```typescript
const api = useExtensionApi();

const getOrderSummary = async () => {
  const summary = await api.invoke("getOrderSummary", {});
  console.log(summary.total);
};
```

**postMessage Flow:**

1. Extension calls `invoke('getOrderSummary', {})`
2. postMessage sent to parent: `{ type: 'wl:invoke', id: '123', method: 'getOrderSummary' }`
3. Parent frame receives, calls registered handler
4. Handler returns data
5. Parent postMessage back: `{ type: 'wl:invoke:result', id: '123', data: {...} }`
6. Promise resolves in extension

---

## Testing Strategy

### Unit Tests (Hooks)

```typescript
describe("useTheme", () => {
  it("should read CSS custom properties from parent frame", async () => {
    // Mock parent frame's computed style
    // Render component with useTheme
    // Assert themeTokens are correct
  });

  it("should observe theme changes and re-render", async () => {
    // Spy on CSS.supports calls
    // Trigger synthetic theme change
    // Assert component re-renders
  });
});
```

### Integration Tests (Extensions)

```typescript
describe("CheckoutExtension", () => {
  it("should apply discount via App Bridge", async () => {
    // Mock Shopify App Bridge
    // Render extension
    // Simulate user clicking "Apply Discount"
    // Assert applyDiscount was called
    // Assert UI updated correctly
  });
});
```

### Bundle Size Tests

```typescript
describe("bundle size", () => {
  it("checkout extension should be < 50KB gzipped", async () => {
    const bytes = await getGzippedSize("dist/checkout-extension.js");
    expect(bytes).toBeLessThan(50 * 1024);
  });
});
```

---

## Alternatives Considered

### 1. React + Tree-Shaking

**Rejected** — Even with aggressive tree-shaking, React's runtime is ~42KB. Combined with bundle overhead, reaches ~65KB, leaving no headroom for application code. Preact provides identical API with 3KB footprint.

### 2. Vanilla JavaScript

**Rejected** — Component lifecycle management becomes manual (setState, DOM diffing). Shopify extensions are complex (forms, validation, async operations). Preact's JSX eliminates bug categories that plague vanilla JS UIs.

### 3. Solid.js

**Evaluated** — Solid.js is ~8KB and has fine-grained reactivity (no virtual DOM). However:

- Smaller ecosystem; fewer Shopify examples
- Steeper learning curve vs React/Preact
- Hooks API differs from React (scoping rules)
- Not worth the complexity for our use case

### 4. Styled-Components / Emotion (CSS-in-JS)

**Rejected** — CSS-in-JS runtimes add 15-20KB. CSS custom properties provide reactivity without runtime cost. Theme updates (dark/light) flow through native CSS cascade.

### 5. Tailwind CSS

**Rejected** — Tailwind's utility class generation bloats bundles. Custom property-based design system is proven at scale (Figma, GitHub). Maintains consistency with dashboard.

---

## Dependencies and Constraints

### Bundle Size Hard Limits

- **Shopify Checkout:** 64KB (non-negotiable Shopify enforcement)
- **Target (Checkout):** 45KB gzipped (33% headroom for future features)
- **Target (POS):** 40KB gzipped (custom limit based on POS responsiveness)

### Runtime Constraints

- **Checkout iframe:** No localStorage (Shopify sandbox restriction); use in-memory caching
- **Checkout DOM:** Can only inject into designated slots; no arbitrary DOM manipulation
- **POS postMessage:** 10ms latency target (don't block POS UI thread); batch updates every 50ms

### Type Safety

- Extensions must use TypeScript strict mode
- All App Bridge actions must be typed
- Theme tokens must match dashboard's definition exactly

---

## Implementation Roadmap

**Phase 1: Extension-Core Package**

- [ ] Implement `types.ts` (TypeScript types)
- [ ] Implement `theme-bridge.ts` (CSS custom property reading)
- [ ] Implement `app-bridge.ts` (Shopify App Bridge wrapper)
- [ ] Implement `hooks.ts` (Preact hooks)
- [ ] Add JSDoc comments for public APIs
- [ ] Publish `@witylogix/extension-core` to npm

**Phase 2: Checkout Extension**

- [ ] Scaffold `extensions/checkout-ui/` with Vite
- [ ] Create CheckoutForm component (Preact)
- [ ] Integrate useTheme() for styling
- [ ] Integrate useAppBridge() for discount application
- [ ] Implement bundle size monitoring
- [ ] Test with Shopify checkout simulator

**Phase 3: POS Extension**

- [ ] Scaffold `extensions/pos-ui/` with Vite
- [ ] Create OrderOverlay component
- [ ] Implement postMessage API bridge
- [ ] Test with Square POS simulator
- [ ] Performance profiling (no UI thread blocks)

**Phase 4: Documentation & Examples**

- [ ] Write extension developer guide
- [ ] Create tutorial: "Build Your First Extension"
- [ ] Add Storybook stories for common components
- [ ] Deploy extension examples to GitHub Pages

---

## Deployment and Monitoring

### Shopify App Installation

```
POST /shopify/apps/extensions/register
{
  "extensionType": "post_purchase",
  "handle": "checkout-ui",
  "apiVersion": "2024-01",
  "requestPath": "https://witylogix.com/extensions/checkout-ui/dist/checkout-extension.js"
}
```

### Extension Version Tracking

Each deployed extension includes version metadata:

```typescript
// Window object available to extension
window.__EXTENSION_METADATA__ = {
  version: "1.2.3",
  deployedAt: "2026-03-07T19:34:00Z",
  commitSha: "abc123def456",
};
```

### Error Tracking

Extension errors are captured and sent to Witylogix monitoring:

```typescript
class ErrorBoundary extends Component {
  componentDidCatch(error) {
    // postMessage to parent for reporting
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "wl:extension-error",
          error: error.message,
          stack: error.stack,
          version: window.__EXTENSION_METADATA__.version,
        },
        "*",
      );
    }
  }
}
```

---

## Security Considerations

### Sandbox Isolation (Checkout)

- Extension runs in `<iframe sandbox="allow-scripts allow-forms">` (Shopify enforced)
- No access to top-level window APIs (localStorage, location)
- App Bridge provides sandboxed communication channel
- No DOM access outside iframe bounds

### postMessage Origin Validation (POS)

```typescript
// Only accept messages from expected origin
window.addEventListener("message", (e) => {
  if (e.origin !== "https://square-pos.com") {
    return; // Ignore
  }
  // Process message
});
```

### API Key Management

- Extension API keys stored in `window.__EXTENSION_CONFIG__` (injected server-side)
- Never hardcode credentials in bundle
- Keys scoped to extension ID + shop ID
- Rotated quarterly; old keys invalidated

---

## Future Enhancements

1. **Micro-Frontend Routing** — Share routing logic between checkout and POS extensions
2. **Shared State Management** — Zustand-based state store < 2KB
3. **Analytics Integration** — Track extension interactions without bloating bundle
4. **A/B Testing Framework** — Toggle features per shop without re-deploying
5. **Progressive Enhancement** — Load advanced features only when available
6. **Cross-Extension Communication** — postMessage bridge between checkout and POS (for unified delivery UX)

---

## Glossary

- **App Bridge** — Shopify's iframe communication protocol for extensions
- **CSS Custom Properties** — `--wl-*` variables; native CSS that can be read/modified at runtime
- **Preact** — Lightweight React alternative (3KB vs 42KB)
- **Tree-shaking** — Bundler optimization that removes unused code (enabled by ES6 `import` statements)
- **Gzipped** — Bundle size after gzip compression (most accurate metric for network transfer)
- **Sandbox** — Browser security model; iframe content cannot access parent window
- **postMessage** — Cross-origin safe API for iframes to communicate with parent window
- **TimeSlot** — Available delivery date/time combination

---

## References

- [Shopify App Bridge Documentation](https://shopify.dev/docs/api/admin-extensions/latest/apis/appbridge)
- [Preact Documentation](https://preactjs.com/)
- [Vite Build Tool](https://vitejs.dev/)
- [CSS Custom Properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- [postMessage API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)

---

## Sign-Off

**Approved by:** Arjun (CTO) — 2026-03-07

This ADR is accepted and ready for implementation in Sprint 3.1.
