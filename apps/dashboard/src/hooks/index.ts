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
} from "./use-realtime";

export {
  useMapTracking,
  type UseMapTrackingConfig,
  type UseMapTrackingReturn,
} from "./use-map-tracking";

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

// Integration management hooks
export {
  useIntegrationStatus,
  type IntegrationConnection,
  type UseIntegrationStatusConfig,
  type UseIntegrationStatusReturn,
} from "./use-integration-status";

// Financial data hooks
export {
  useInvoices,
  useFinancialMetrics,
  type ReconciliationMatch,
  type FinancialMetrics,
} from "./use-financial-data";

// Notification management hooks
export {
  useNotifications,
  useNotificationPreferences,
  useDeliveryLog,
  type Notification,
  type NotificationPreference,
  type NotificationPreferences,
  type DeliveryLogEntry,
  type NotificationChannel,
  type NotificationCategory,
  type NotificationStatus,
  type DeliveryStatus,
  type DigestFrequency,
} from "./use-notifications";

// Team collaboration hooks
export {
  useCollaboration,
  type Channel,
  type DirectMessage,
  type Message,
  type TypingUser,
  type User,
  type UseCollaborationConfig,
  type UseCollaborationReturn,
} from "./use-collaboration";
