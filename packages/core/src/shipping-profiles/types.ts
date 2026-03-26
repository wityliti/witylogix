/**
 * Shipping Profiles Type Definitions
 * Core types for the shipping profile system including rates, zones, calendar rules,
 * and delivery methods. Designed for extensibility and complex rate calculations.
 */

// ─── RATE TYPES ────────────────────────────────────────────────────────────

/**
 * Base rate type that supports multiple calculation methods
 */
export type RateType = 'flat' | 'weight_based' | 'price_based' | 'distance_based' | 'tiered';

/**
 * Represents a single shipping rate with its calculation method and rules
 */
export interface ShippingRate {
  id: string;
  shippingProfileId: string;
  rateType: RateType;

  // Flat rate (simple fixed price)
  flatRate?: number;

  // Weight-based tiers
  weightTiers?: WeightTier[];

  // Price-based tiers (free shipping above threshold)
  priceTiers?: PriceTier[];

  // Distance-based rates
  distanceTiers?: DistanceTier[];

  // Tiered rates (e.g., 0-5kg, 5-10kg, 10+kg)
  tieredRates?: TieredRate[];

  // Common constraints
  minimumRate?: number;
  maximumRate?: number;
  freeShippingThreshold?: number;

  // Surcharges applied to this rate
  surcharges?: RateSurcharge[];

  // Metadata for extensibility
  metadata?: Record<string, unknown>;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Weight-based rate tier
 */
export interface WeightTier {
  maxWeight: number; // kg
  rate: number;
}

/**
 * Price-based tier for conditional free shipping or discounts
 */
export interface PriceTier {
  orderAmount: number; // minimum order amount in base currency
  rate: number;
  freeShipping?: boolean;
}

/**
 * Distance-based rate calculation
 */
export interface DistanceTier {
  maxDistance: number; // km
  baseRate: number;
  perKmRate: number;
}

/**
 * Tiered rate structure for bucketed pricing
 */
export interface TieredRate {
  minWeight: number;
  maxWeight: number;
  rate: number;
}

/**
 * Surcharge applied to rates (fuel, remote area, etc)
 */
export interface RateSurcharge {
  type: 'fuel' | 'remote_area' | 'residential' | 'oversize' | 'insurance' | 'custom';
  amount?: number;
  percentage?: number;
  condition?: SurchargeCondition;
  isActive: boolean;
}

/**
 * Condition for applying a surcharge
 */
export interface SurchargeCondition {
  type: 'weight_above' | 'distance_above' | 'zone' | 'address_type' | 'custom';
  value?: unknown;
  metadata?: Record<string, unknown>;
}

// ─── ZONE TYPES ────────────────────────────────────────────────────────────

/**
 * A geographic zone for delivery rate calculation
 */
export interface ShippingZone {
  id: string;
  shippingProfileId: string;
  name: string;

  // Zone boundary (GeoJSON polygon when PostGIS available)
  boundary?: {
    type: 'Polygon';
    coordinates: number[][][]; // [[[lng, lat], ...]]
  };

  // Postal codes or areas included in this zone
  postalCodes?: string[];
  cities?: string[];
  states?: string[];
  countries?: string[];

  // Zone rates
  rates: ZoneRate[];

  // Zone-specific settings
  priority: number; // higher priority zones are checked first
  isActive: boolean;
  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rate within a specific zone
 */
export interface ZoneRate {
  id: string;
  zoneId: string;
  rateType: RateType;
  baseRate?: number;
  perKmRate?: number;
  weightTiers?: WeightTier[];
  minOrder?: number;
  freeAbove?: number;
  isActive: boolean;
}

// ─── CALENDAR TYPES ────────────────────────────────────────────────────────

/**
 * Calendar profile for managing delivery availability
 */
export interface CalendarProfile {
  id: string;
  shippingProfileId: string;
  name: string;

  // Operating schedule
  operatingHours: OperatingHours;

  // Blackout dates when service is unavailable
  blackoutDates: BlackoutDate[];

  // Cutoff rules for order placement
  cutoffRules: CutoffRule[];

  // Preparation/processing time before dispatch
  prepTime: PrepTime;

  // Available delivery time slots
  timeSlots: DeliveryTimeSlot[];

  isActive: boolean;
  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Operating hours for a location or service
 */
export interface OperatingHours {
  timezone: string; // e.g., 'America/New_York'

  // Daily hours: 0=Sunday, 1=Monday, ..., 6=Saturday
  byDayOfWeek: {
    [day in 0 | 1 | 2 | 3 | 4 | 5 | 6]?: TimeWindow;
  };

  // Holidays override
  holidays?: HolidaySchedule[];
}

/**
 * A time window (e.g., 09:00 - 17:00)
 */
export interface TimeWindow {
  open: string; // "HH:MM" format
  close: string; // "HH:MM" format
}

/**
 * Holiday or special operating hours
 */
export interface HolidaySchedule {
  date: Date;
  name: string;
  hours?: TimeWindow; // null = closed
  isClosed?: boolean;
}

/**
 * Blackout date when service is unavailable
 */
export interface BlackoutDate {
  startDate: Date;
  endDate: Date;
  reason: string;
  affectedZones?: string[]; // zone IDs, null = all zones
  partialDay?: boolean; // if true, only part of day is unavailable
}

/**
 * Calendar rule for conditional cutoffs
 */
export interface CalendarRule {
  type: 'blackout' | 'special_hours' | 'capacity_override' | 'surge_pricing';
  effectiveFrom: Date;
  effectiveTo?: Date;

  // For operating day rules
  daysOfWeek?: number[]; // 0-6
  hours?: TimeWindow;

  // For surcharge/override
  surcharge?: number;
  maxCapacity?: number;

  priority: number;
  isActive: boolean;
}

/**
 * Cutoff rule for order placement
 */
export interface CutoffRule {
  // Must order at least X minutes before slot start
  minutesBeforeSlot: number;

  // Apply only on certain days
  daysOfWeek?: number[]; // 0-6

  // Time window when this cutoff applies
  timeWindow?: TimeWindow;

  // Message shown to customer
  message?: string;
}

/**
 * Preparation time before dispatch
 */
export interface PrepTime {
  baseMinutes: number;

  // Additional prep time based on conditions
  conditionalMinutes?: {
    condition: 'weekend' | 'holiday' | 'high_volume' | 'custom';
    additionalMinutes: number;
  }[];
}

/**
 * Available delivery time slot
 */
export interface DeliveryTimeSlot {
  id: string;
  name: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  daysOfWeek: number[]; // 0-6
  maxCapacity: number;
  currentUtilization: number;
  cutoffMinutes: number;
  surcharge: number;
  isAvailable: boolean;
}

// ─── LOCATION ATTACHMENT TYPES ─────────────────────────────────────────────

/**
 * Link between shipping profile and fulfillment location
 */
export interface LocationAttachment {
  id: string;
  shippingProfileId: string;
  locationId: string;

  // Location details (denormalized for quick access)
  locationName: string;
  postalCode: string;
  city: string;
  state?: string;
  country: string;
  coordinates?: {
    lat: number;
    lng: number;
  };

  // This location's default shipping method
  defaultDeliveryMethod: DeliveryMethod;

  // Operating hours override (null = use location default)
  operatingHoursOverride?: OperatingHours;

  // Prep time override (null = use profile default)
  prepTimeOverride?: number; // minutes

  // Priority for zone matching (higher = checked first)
  priority: number;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── DELIVERY METHOD TYPES ─────────────────────────────────────────────────

/**
 * Type of delivery method
 */
export type DeliveryMethod = 'local' | 'standard' | 'express' | 'pickup';

/**
 * Delivery method configuration
 */
export interface DeliveryMethodConfig {
  type: DeliveryMethod;

  // Estimated delivery time
  estimatedDaysMin: number;
  estimatedDaysMax: number;

  // Cost parameters
  baseCost: number;
  perKgCost?: number;
  perKmCost?: number;

  // Constraints
  maxWeight?: number;
  maxDistance?: number;
  minOrderAmount?: number;

  // Features
  guaranteedDelivery: boolean;
  trackingIncluded: boolean;
  insuranceAvailable: boolean;

  isActive: boolean;
}

// ─── SHIPPING PROFILE TYPES ────────────────────────────────────────────────

/**
 * Complete shipping profile combining all components
 */
export interface ShippingProfile {
  id: string;
  shopId: string;
  name: string;
  description?: string;

  // Delivery method this profile handles
  deliveryMethod: DeliveryMethod;

  // Profile status
  isDefault: boolean;
  isActive: boolean;

  // Rate configuration
  rateType: RateType;
  rates: ShippingRate[];
  zones: ShippingZone[];

  // Calendar and availability
  calendarProfiles: CalendarProfile[];
  calendarRules: CalendarRule[];

  // Location bindings
  locations: LocationAttachment[];

  // Processing time (hours)
  processingTimeHours: number;

  // Free shipping threshold (null = none)
  freeShippingThreshold?: number;
  minOrderAmount?: number;

  // Dynamic metadata for extensions
  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

// ─── VALIDATION AND CALCULATION TYPES ──────────────────────────────────────

/**
 * Result of rate calculation for a shipment
 */
export interface CalculatedShippingRate {
  shippingProfileId: string;
  deliveryMethod: DeliveryMethod;

  baseRate: number;
  surcharges: SurchargeDetail[];
  discount?: DiscountDetail;

  totalRate: number;
  currency: string;

  estimatedDeliveryDays: {
    min: number;
    max: number;
  };

  zone?: ShippingZone;
  timeSlot?: DeliveryTimeSlot;

  // Metadata about the calculation
  calculationDetails?: {
    rateType: RateType;
    appliedRules: string[];
    conditions: Record<string, unknown>;
  };
}

/**
 * Surcharge detail in calculation
 */
export interface SurchargeDetail {
  type: string;
  description: string;
  amount: number;
  percentage?: number;
}

/**
 * Discount detail in calculation
 */
export interface DiscountDetail {
  type: string;
  description: string;
  amount: number;
  percentage?: number;
}

/**
 * Validation result for profile completeness
 */
export interface ProfileValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  context?: Record<string, unknown>;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
}

/**
 * Rate calculation request
 */
export interface RateCalculationRequest {
  shippingProfileId: string;

  // Shipment details
  weight?: number; // kg
  weightUnit?: 'g' | 'kg' | 'oz' | 'lb';
  orderAmount?: number;
  distance?: number; // km

  // Delivery address
  recipientAddress: {
    postalCode: string;
    city: string;
    state?: string;
    country: string;
    isResidential?: boolean;
  };

  // Fulfillment location
  originLocationId?: string;

  // Desired delivery time
  desiredDeliveryDate?: Date;

  // Additional options
  options?: {
    insurance?: boolean;
    trackingRequired?: boolean;
    signatureRequired?: boolean;
  };

  // Currency for conversion
  currency?: string;
}

/**
 * Options for profile operations
 */
export interface ProfileCalculationOptions {
  timezone?: string;
  applySurcharges?: boolean;
  includeUnavailable?: boolean;
  forceCalculation?: boolean;
}
