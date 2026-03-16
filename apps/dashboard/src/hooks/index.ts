// Responsive breakpoint hooks
export {
  useBreakpoint,
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  usePrefersReducedMotion,
  type Breakpoint,
  BREAKPOINTS,
} from "./use-breakpoint";

// Touch interaction hooks
export {
  useSwipe,
  useLongPress,
  usePinchZoom,
  useTouchDetect,
  type SwipeCallbacks,
} from "./use-touch";

// Form management hooks
export {
  useForm,
  type ValidationMode,
  type RegisteredField,
  type UseFormConfig,
  type FormState,
  type FormInstance,
} from "./use-form";

export {
  useFieldArray,
  type UseFieldArrayConfig,
  type FieldItem,
  type FieldArrayInstance,
} from "./use-field-array";

// Real-time WebSocket hooks
export {
  useRealtime,
  type UseRealtimeConfig,
  type UseRealtimeReturn,
} from "./use-realtime";

export {
  useRealtimeMetrics,
  useAnimatedMetric,
  useFormattedSLA,
  type RealtimeMetrics,
} from "./use-realtime-metrics";

// Table preferences persistence hook
export {
  useTablePreferences,
  type TablePreferences,
} from "./use-table-preferences";
