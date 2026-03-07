/**
 * Shipping Profiles Module
 * Core exports for the shipping profile system including the main manager class
 * and all supporting utilities for rate calculation, calendar management, and validation
 */

// ─── TYPE EXPORTS ──────────────────────────────────────────────────────────

export type {
  RateType,
  ShippingRate,
  WeightTier,
  PriceTier,
  DistanceTier,
  TieredRate,
  RateSurcharge,
  SurchargeCondition,
  ShippingZone,
  ZoneRate,
  CalendarProfile,
  OperatingHours,
  TimeWindow,
  HolidaySchedule,
  BlackoutDate,
  CalendarRule,
  CutoffRule,
  PrepTime,
  DeliveryTimeSlot,
  LocationAttachment,
  DeliveryMethod,
  DeliveryMethodConfig,
  ShippingProfile,
  CalculatedShippingRate,
  SurchargeDetail,
  DiscountDetail,
  ProfileValidationResult,
  ValidationError,
  ValidationWarning,
  RateCalculationRequest,
  ProfileCalculationOptions,
} from './types';

// ─── RATE CALCULATOR EXPORTS ──────────────────────────────────────────────

export {
  convertWeightToKg,
  convertCurrency,
  findMatchingZone,
  calculateBaseRate,
  calculateWeightBasedRate,
  calculatePriceBasedRate,
  calculateDistanceBasedRate,
  calculateTieredRate,
  applySurcharges,
  applyFreeShippingThreshold,
  calculateRate,
  calculateRatesBatch,
  selectBestLocation,
} from './rate-calculator';

// ─── CALENDAR ENGINE EXPORTS ──────────────────────────────────────────────

export {
  parseTime,
  formatTime,
  getDayOfWeek,
  getCurrentTimeInZone,
  addMinutesInTimezone,
  isSameDay,
  isMidnightInTimezone,
  isDateBlackedOut,
  getNextAvailableDate,
  isCurrentlyOpen,
  isTimeWithinOperatingHours,
  getOperatingHoursForDay,
  isHoliday,
  getHolidayInfo,
  isCutoffPassed,
  getMinutesUntilCutoff,
  appliesCutoffRule,
  calculateCutoffTime,
  calculateTotalPrepTime,
  calculateEarliestDeliveryDate,
  getAvailableTimeSlots,
  getNextAvailableSlot,
  calculateSlotUtilization,
  getApplicableCalendarRules,
  getHighestPriorityRule,
  isDeliveryAvailable,
  getAvailabilityCalendar,
} from './calendar-engine';

// ─── VALIDATOR EXPORTS ────────────────────────────────────────────────────

export {
  validateProfileCompleteness,
  validateRates,
  validateZoneCoverage,
  detectZoneOverlaps,
  validateCalendarProfiles,
  detectCalendarRuleConflicts,
  validateLocationAttachments,
  validateShippingProfile,
} from './validator';

// ─── MANAGER CLASS ────────────────────────────────────────────────────────

import {
  ShippingProfile,
  RateCalculationRequest,
  CalculatedShippingRate,
  ProfileValidationResult,
  ProfileCalculationOptions,
  DeliveryTimeSlot,
} from './types';
import { calculateRate, calculateRatesBatch, selectBestLocation } from './rate-calculator';
import {
  getAvailableTimeSlots,
  getNextAvailableSlot,
  isDeliveryAvailable,
  getAvailabilityCalendar,
  calculateEarliestDeliveryDate,
} from './calendar-engine';
import { validateShippingProfile } from './validator';

/**
 * ShippingProfileManager - Main entry point for the shipping profile system
 * Orchestrates rate calculation, calendar management, and validation
 */
export class ShippingProfileManager {
  private profile: ShippingProfile;
  private exchangeRates?: Record<string, number>;
  private timezone: string;

  /**
   * Create a new shipping profile manager instance
   */
  constructor(profile: ShippingProfile, options?: ProfileCalculationOptions) {
    this.profile = profile;
    this.timezone = options?.timezone || 'UTC';

    if (!profile.calendarProfiles?.[0]) {
      throw new Error('Profile must have at least one calendar profile');
    }
  }

  /**
   * Set exchange rates for currency conversion
   */
  setExchangeRates(rates: Record<string, number>): void {
    this.exchangeRates = rates;
  }

  /**
   * Get the shipping profile
   */
  getProfile(): ShippingProfile {
    return this.profile;
  }

  /**
   * Update the shipping profile
   */
  updateProfile(updates: Partial<ShippingProfile>): void {
    this.profile = { ...this.profile, ...updates };
  }

  /**
   * Calculate shipping rate for a request
   * @param request Rate calculation request
   * @returns Calculated shipping rate with all components
   * @throws Error if rate cannot be calculated (no matching zone, etc)
   */
  async calculateRate(request: RateCalculationRequest): Promise<CalculatedShippingRate> {
    return calculateRate(this.profile, request, this.exchangeRates);
  }

  /**
   * Calculate multiple rates in batch
   * @param requests Array of rate calculation requests
   * @returns Array of calculated rates
   */
  async calculateRatesBatch(
    requests: RateCalculationRequest[]
  ): Promise<CalculatedShippingRate[]> {
    return calculateRatesBatch(this.profile, requests, this.exchangeRates);
  }

  /**
   * Get available time slots for a specific date
   * @param date Date to check availability for
   * @returns Array of available time slots
   */
  getAvailableTimeSlots(date: Date): DeliveryTimeSlot[] {
    const calendar = this.profile.calendarProfiles[0];
    if (!calendar) {
      return [];
    }

    return getAvailableTimeSlots(calendar.timeSlots, date, this.timezone);
  }

  /**
   * Get next available delivery slot
   * @param startDate Date to start searching from
   * @param maxDaysAhead Maximum days to look ahead (default: 14)
   * @returns Next available slot and date, or undefined if none found
   */
  getNextAvailableSlot(startDate: Date, maxDaysAhead?: number) {
    const calendar = this.profile.calendarProfiles[0];
    if (!calendar) {
      return undefined;
    }

    return getNextAvailableSlot(
      calendar.timeSlots,
      startDate,
      calendar.blackoutDates,
      this.timezone,
      maxDaysAhead
    );
  }

  /**
   * Check if delivery is available on a specific date/time
   * @param date Date to check
   * @param timeSlot Optional specific time slot to check
   * @returns Availability status with reason if unavailable
   */
  isDeliveryAvailable(date: Date, timeSlot?: DeliveryTimeSlot) {
    const calendar = this.profile.calendarProfiles[0];
    if (!calendar) {
      return { available: false, reason: 'No calendar profile configured' };
    }

    return isDeliveryAvailable(calendar, date, timeSlot);
  }

  /**
   * Get availability calendar for a date range
   * @param startDate Range start
   * @param endDate Range end
   * @returns Calendar with availability info and slots for each day
   */
  getAvailabilityCalendar(startDate: Date, endDate: Date) {
    const calendar = this.profile.calendarProfiles[0];
    if (!calendar) {
      return [];
    }

    return getAvailabilityCalendar(calendar, startDate, endDate, this.timezone);
  }

  /**
   * Calculate earliest possible delivery date
   * @param orderDate Date order was placed
   * @returns Earliest date when delivery is possible
   */
  calculateEarliestDeliveryDate(orderDate: Date): Date {
    const calendar = this.profile.calendarProfiles[0];
    if (!calendar) {
      return orderDate;
    }

    const methodConfig = {
      min: 1,
      max: 5,
    };

    return calculateEarliestDeliveryDate(
      orderDate,
      calendar.prepTime,
      methodConfig,
      calendar.operatingHours,
      calendar.blackoutDates,
      this.timezone
    );
  }

  /**
   * Select best fulfillment location for an address
   * @param address Delivery address
   * @returns Best matching location attachment
   */
  selectBestLocation(address: {
    postalCode: string;
    city: string;
    state?: string;
    country: string;
  }) {
    return selectBestLocation(this.profile.locations, address);
  }

  /**
   * Validate the entire shipping profile
   * @returns Validation result with errors and warnings
   */
  validate(): ProfileValidationResult {
    return validateShippingProfile(this.profile);
  }

  /**
   * Check if profile is valid (no critical errors)
   * @returns true if profile passes validation
   */
  isValid(): boolean {
    return this.validate().isValid;
  }

  /**
   * Get validation errors (if any)
   * @returns Array of validation errors
   */
  getValidationErrors() {
    return this.validate().errors;
  }

  /**
   * Get validation warnings (if any)
   * @returns Array of validation warnings
   */
  getValidationWarnings() {
    return this.validate().warnings;
  }

  /**
   * Create a copy of this manager with updated profile
   * Useful for testing different configurations
   */
  clone(profileUpdates?: Partial<ShippingProfile>): ShippingProfileManager {
    const clonedProfile = {
      ...this.profile,
      ...profileUpdates,
    };

    const cloned = new ShippingProfileManager(clonedProfile, { timezone: this.timezone });
    if (this.exchangeRates) {
      cloned.setExchangeRates(this.exchangeRates);
    }

    return cloned;
  }
}

/**
 * Create a new shipping profile manager
 */
export function createShippingProfileManager(
  profile: ShippingProfile,
  options?: ProfileCalculationOptions
): ShippingProfileManager {
  return new ShippingProfileManager(profile, options);
}
