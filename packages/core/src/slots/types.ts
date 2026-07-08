/**
 * @witylogix/core/slots — Slot Engine & Capacity Management
 * Comprehensive types for slot availability, capacity, rates, and deadlines
 */

// ─── SLOTS & AVAILABILITY ───────────────────────────────────────

export interface Slot {
  id: string;
  locationId: string;
  date: Date;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  maxCapacity: number;
  currentBookings: number;
  price: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlotAvailability {
  id: string;
  locationId: string;
  date: Date;
  startTime: string;
  endTime: string;
  available: number;
  total: number;
  isFull: boolean;
  price: number;
  zone?: Zone;
}

export interface SlotConfig {
  locationId: string;
  defaultCapacity: number;
  pricePerSlot: number;
  enableDynamicPricing: boolean;
}

export interface TimeWindow {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

// ─── ZONES & RATES ──────────────────────────────────────────────

export interface Zone {
  id: string;
  name: string;
  zipcodes: string[];
  baseRate: number;
  perKmRate: number;
  perMileRate?: number;
  freeThreshold: number;
  isActive: boolean;
}

export type RateMethod =
  | "flat"
  | "per_km"
  | "per_mile"
  | "weight_based"
  | "cart_value_tiers";

export interface ZoneRate {
  zoneId: string;
  zoneName: string;
  baseRate: number;
  perKmRate: number;
  perMileRate?: number;
  weightRates?: WeightTier[];
  cartValueTiers?: CartValueTier[];
  freeThreshold: number;
  minimumCharge: number;
}

export interface WeightTier {
  minWeight: number;
  maxWeight: number;
  ratePerUnit: number;
}

export interface CartValueTier {
  minValue: number;
  maxValue?: number;
  rate: number;
  rateName: string;
}

export interface DistanceRate {
  distance: number;
  distanceUnit: "km" | "miles";
  rate: number;
  baseFeeApplied: boolean;
}

export interface RateBreakdown {
  baseFee: number;
  distanceFee: number;
  weightFee: number;
  cartValueFee: number;
  discounts: number;
  subtotal: number;
  tax?: number;
  total: number;
  currency: string;
  breakdown: {
    label: string;
    amount: number;
    method: RateMethod;
  }[];
}

// ─── CAPACITY ───────────────────────────────────────────────────

export interface CapacityConfig {
  locationId: string;
  date: Date;
  maxOrders: number;
  currentOrders: number;
  isBlackedOut: boolean;
  blackoutReason?: string;
}

export interface CapacityReport {
  locationId: string;
  date: Date;
  totalCapacity: number;
  currentUsage: number;
  percentUtilized: number;
  availableSlots: number;
  status: "available" | "high_demand" | "at_capacity" | "closed";
  peakHours?: TimeWindow[];
  recommendations?: string[];
}

export interface ReservationResult {
  success: boolean;
  slotId: string;
  orderId: string;
  expiresAt: Date;
  message?: string;
  error?: string;
}

// ─── BLACKOUT DATES ─────────────────────────────────────────────

export interface BlackoutDate {
  id: string;
  locationId: string;
  date: Date;
  reason: string;
  isRecurring: boolean;
  dayOfWeek?: number; // 0-6: Sun-Sat
  createdAt: Date;
  updatedAt: Date;
}

// ─── DEADLINES & CUT-OFFS ───────────────────────────────────────

export interface DeadlineConfig {
  locationId: string;
  prepTimeMinutes: number;
  cutoffTime: string; // HH:mm
  cutoffHours: number;
}

export interface OrderDeadline {
  orderId: string;
  deliveryDate: Date;
  slotId: string;
  deadline: Date;
  cutoffHours: number;
  prepTime: number;
  isPastDeadline: boolean;
}

// ─── LOCATION CONFIG ────────────────────────────────────────────

export interface LocationConfig {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isActive: boolean;
  capacity: SlotConfig;
  deadlineConfig: DeadlineConfig;
  operatingHours?: OperatingHours;
}

export interface OperatingHours {
  monday?: TimeWindow;
  tuesday?: TimeWindow;
  wednesday?: TimeWindow;
  thursday?: TimeWindow;
  friday?: TimeWindow;
  saturday?: TimeWindow;
  sunday?: TimeWindow;
}

// ─── SLOT RESERVATION ───────────────────────────────────────────

export interface SlotReservation {
  id: string;
  slotId: string;
  orderId: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── DEMAND-BASED ADJUSTMENT ────────────────────────────────────

export interface CapacityAdjustmentRequest {
  locationId: string;
  date: Date;
  demandFactor: number; // 0.5 = 50% reduction, 1.5 = 50% increase
  reason: string;
}

export interface CapacityAdjustmentResult {
  locationId: string;
  date: Date;
  previousCapacity: number;
  newCapacity: number;
  adjustmentFactor: number;
  appliedAt: Date;
}

// ─── BATCH OPERATIONS ───────────────────────────────────────────

export interface BatchSlotCreationRequest {
  locationId: string;
  startDate: Date;
  endDate: Date;
  slots: SlotDefinition[];
}

export interface SlotDefinition {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  daysOfWeek: number[]; // 0-6
  capacity: number;
  price: number;
  isRecurring: boolean;
}

// ─── STATS & ANALYTICS ──────────────────────────────────────────

export interface SlotStatistics {
  locationId: string;
  date: Date;
  totalSlotsCreated: number;
  totalReservations: number;
  avgCapacityUtilization: number;
  peakSlot?: SlotAvailability;
  lowestSlot?: SlotAvailability;
}

// ─── ERRORS ─────────────────────────────────────────────────────

export class SlotEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "SlotEngineError";
  }
}

export class SlotNotFoundError extends SlotEngineError {
  constructor(slotId: string) {
    super(`Slot ${slotId} not found`, "SLOT_NOT_FOUND", 404);
  }
}

export class SlotFullError extends SlotEngineError {
  constructor(slotId: string) {
    super(`Slot ${slotId} is at full capacity`, "SLOT_FULL", 409);
  }
}

export class InvalidSlotDateError extends SlotEngineError {
  constructor(message: string) {
    super(message, "INVALID_SLOT_DATE", 400);
  }
}

export class CapacityExceededError extends SlotEngineError {
  constructor(locationId: string, date: Date) {
    super(
      `Daily capacity exceeded for ${locationId} on ${date.toISOString()}`,
      "CAPACITY_EXCEEDED",
      409,
    );
  }
}

export class BlackoutDateError extends SlotEngineError {
  constructor(locationId: string, date: Date, reason: string) {
    super(
      `Location ${locationId} is blacked out on ${date.toISOString()}: ${reason}`,
      "BLACKOUT_DATE",
      400,
    );
  }
}

export class DeadlinePastError extends SlotEngineError {
  constructor(deadline: Date) {
    super(
      `Order deadline has passed (${deadline.toISOString()})`,
      "DEADLINE_PAST",
      400,
    );
  }
}
