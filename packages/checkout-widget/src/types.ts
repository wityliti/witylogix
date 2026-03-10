/**
 * Checkout Widget Types
 * Defines all TypeScript interfaces and types for the checkout widget
 */

export enum DeliveryMethodType {
  STANDARD = 'standard',
  EXPRESS = 'express',
  PICKUP = 'pickup',
}

export interface DeliveryMethod {
  id: DeliveryMethodType;
  name: string;
  description: string;
  estimatedTime: string; // e.g., "Next business day"
  estimatedMinutes?: number; // minutes from now
  price: number;
  enabled: boolean;
  icon?: string;
}

export interface CapacityInfo {
  total: number;
  available: number;
  reserved: number;
}

export interface PrepTimeConfig {
  cutoffHour: number;
  cutoffMinute: number;
  deliveryDaysAhead: number; // e.g., 1 for next day
  message: string; // e.g., "Order by 4pm for next-day delivery"
}

export interface BlackoutDate {
  date: Date;
  reason?: string; // e.g., "Holiday", "Maintenance"
  partial?: boolean; // true if some slots available
}

export interface TimeSlot {
  id: string;
  startTime: Date; // Date object with time
  endTime: Date;
  capacity: CapacityInfo;
  price: number;
  prepTime?: PrepTimeConfig;
}

export interface SlotAvailability {
  date: Date;
  slots: TimeSlot[];
  capacity: CapacityInfo;
  isAvailable: boolean;
  blackoutDate?: BlackoutDate;
}

export interface ZoneRate {
  zoneId: string;
  zoneName: string;
  baseRate: number;
  distanceFeePerKm: number;
  weightSurchargePerKg: number;
  freeDeliveryThreshold: number; // order amount above which delivery is free
  currency: string;
  enabled: boolean;
}

export interface AddressValidation {
  valid: boolean;
  address: string;
  zipcode: string;
  latitude: number;
  longitude: number;
  zoneId?: string;
  zoneName?: string;
  message?: string; // e.g., "We deliver to your area!"
}

export interface PickupLocation {
  id: string;
  name: string;
  address: string;
  zipcode: string;
  latitude: number;
  longitude: number;
  phoneNumber?: string;
  hours?: string;
}

export interface CheckoutSelection {
  address: AddressValidation;
  deliveryMethod: DeliveryMethodType;
  selectedDate: Date;
  selectedSlot: TimeSlot;
  zoneRate: ZoneRate;
  pickupLocation?: PickupLocation;
  estimatedDeliveryDate?: Date;
  totalCost: number;
  orderValue: number; // for free delivery calculation
}

export interface WidgetConfig {
  apiBaseUrl: string;
  onSelectionChange?: (selection: Partial<CheckoutSelection>) => void;
  onComplete?: (selection: CheckoutSelection) => void;
  onError?: (error: Error) => void;
  compactMode?: boolean; // reduced UI for embedded contexts
  maxDate?: Date; // max selectable date
  minDate?: Date; // min selectable date (defaults to today)
  defaultDeliveryMethod?: DeliveryMethodType;
  currency?: string;
  locale?: string;
  darkMode?: boolean;
  customVariables?: Record<string, string>; // CSS variables override
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

export interface AvailabilityRequest {
  zoneId: string;
  startDate: string; // ISO 8601
  endDate: string; // ISO 8601
  deliveryMethod: DeliveryMethodType;
}

export interface RateRequest {
  zoneId: string;
  orderValue: number;
  estimatedWeight?: number;
  deliveryMethod: DeliveryMethodType;
}

export interface AddressValidationRequest {
  address: string;
  zipcode: string;
}

export interface Address {
  fullAddress: string;
  street: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface StepComponentProps {
  onNext?: (data?: Partial<CheckoutSelection>) => void;
  onBack?: () => void;
  isLoading?: boolean;
  error?: string;
  selection?: Partial<CheckoutSelection>;
}
