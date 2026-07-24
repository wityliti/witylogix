/**
 * Accessibility Library Index
 * Central export point for all a11y utilities
 */

// Focus Management
export {
  getFocusableElements,
  isFocusable,
  focusFirst,
  focusLast,
  moveFocus,
  trapFocus,
  restoreFocus,
  useFocusTrap,
} from "./focus-manager";

// Keyboard Navigation
export {
  useKeyboardNavigation,
  useRovingTabIndex,
  useEscapeClose,
  useTypeAhead,
  KeyboardShortcutManager,
  useKeyboardShortcut,
} from "./keyboard-navigation";

// Screen Reader Announcements
export {
  LiveRegion,
  announce,
  announceRouteChange,
  announceAction,
  announceError,
  useAnnounce,
  AnnouncerProvider,
  useAnnouncerContext,
} from "./announcer";

// ARIA Helpers
export {
  generateId,
  useAriaExpanded,
  useAriaSelected,
  useAriaDescribedBy,
  useAriaLabelledBy,
  useAriaLive,
  buildAriaAttributes,
  getAriaAttribute,
  setAriaAttribute,
  useAriaBinding,
  type AriaAttributes,
} from "./aria-helpers";

// Color Contrast
export {
  parseColor,
  getRelativeLuminance,
  calculateContrastRatio,
  meetsAA,
  meetsAAA,
  suggestAccessibleColor,
  analyzeContrast,
  type RGB,
} from "./color-contrast";

// Reduced Motion
export {
  useReducedMotion,
  MotionSafe,
  getAnimationDuration,
  getTransitionClass,
  getAnimationStyle,
  createMotionMediaQuery,
} from "./reduced-motion";
