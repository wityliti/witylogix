/**
 * @witylogix/checkout-widget
 * Embeddable checkout date/time picker widget for delivery date/time slot selection
 *
 * Usage:
 * import { CheckoutWidget } from '@witylogix/checkout-widget';
 *
 * const config = {
 *   apiBaseUrl: 'https://api.example.com',
 *   deliveryMethods: [...],
 *   onComplete: (selection) => console.log(selection),
 * };
 *
 * <CheckoutWidget {...config} />
 */

// Components
export { CheckoutWidget } from "./components/checkout-widget";
export { DatePicker } from "./components/date-picker";
export { TimeSlotGrid } from "./components/time-slot-grid";
export { ZoneRateDisplay } from "./components/zone-rate-display";
export { AddressInput } from "./components/address-input";
export { DeliveryOptions } from "./components/delivery-options";

// Hooks
export {
  useSlotAvailability,
  useBatchSlotAvailability,
} from "./hooks/use-slot-availability";
export { useZoneRates, useBatchZoneRates } from "./hooks/use-zone-rates";
export {
  useAddressValidation,
  useAddressAutocomplete,
} from "./hooks/use-address-validation";

// Types
export type {
  DeliveryMethod,
  TimeSlot,
  SlotAvailability,
  ZoneRate,
  AddressValidation,
  CheckoutSelection,
  WidgetConfig,
  BlackoutDate,
  CapacityInfo,
  PrepTimeConfig,
  PickupLocation,
  Address,
  AddressValidationRequest,
  AvailabilityRequest,
  RateRequest,
  ValidationError,
  ApiErrorResponse,
  StepComponentProps,
} from "./types";
export { DeliveryMethodType } from "./types";

// Utils
export {
  formatDateDisplay,
  formatDateISO,
  formatTimeDisplay,
  formatTimeRangeDisplay,
  formatDateTimeDisplay,
  isDateBlackouted,
  getBlackoutDatesInMonth,
  isValidSelectableDate,
  parseDate,
  getAvailableSlotsText,
  getRelativeDayName,
  daysUntil,
  getMonthDateRange,
  getDatesInMonth,
  isAfterCutoff,
  formatTimeForApi,
  createTime,
  getStartOfDay,
  getEndOfDay,
  isDateInRange,
} from "./utils/date-utils";

export {
  calculateDeliveryCost,
  calculateTotalCost,
  getFreeDeliveryMessage,
  getCostBreakdown,
  formatPrice,
  qualifiesForFreeDelivery,
  getSavingsMessage,
  calculateDistanceRate,
  isValidRate,
} from "./utils/rate-calculator";

export type { CostBreakdown } from "./utils/rate-calculator";
