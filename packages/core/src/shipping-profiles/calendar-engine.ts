/**
 * Shipping Calendar Engine
 * Manages availability, time slots, blackout dates, operating hours,
 * cutoff rules, and preparation time calculations
 */

import {
  CalendarProfile,
  DeliveryTimeSlot,
  BlackoutDate,
  OperatingHours,
  TimeWindow,
  CalendarRule,
  CutoffRule,
  PrepTime,
} from "./types";

// ─── TIME UTILITIES ───────────────────────────────────────────────────────

/**
 * Parse time string in HH:MM format to minutes since midnight
 */
export function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to HH:MM format
 */
export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Get day of week (0-6, where 0 is Sunday)
 */
export function getDayOfWeek(date: Date, timezone?: string): number {
  if (timezone) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
    });
    const weekdayName = formatter.format(date);
    const dayIndex = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return dayIndex.indexOf(weekdayName);
  }

  return date.getUTCDay();
}

/**
 * Get current time in minutes since midnight for a timezone
 */
export function getCurrentTimeInZone(timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const time = formatter.format(new Date());
  return parseTime(time);
}

/**
 * Add minutes to a date, respecting timezone
 */
export function addMinutesInTimezone(
  date: Date,
  minutes: number,
  timezone: string,
): Date {
  // Simple approach: convert to timezone, add minutes, convert back
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  // Parse the formatted date
  const dateMap = new Map(parts.map((p) => [p.type, p.value]));

  // Create new date with added minutes
  const newDate = new Date(
    parseInt(dateMap.get("year")!, 10),
    parseInt(dateMap.get("month")!, 10) - 1,
    parseInt(dateMap.get("day")!, 10),
    parseInt(dateMap.get("hour")!, 10),
    parseInt(dateMap.get("minute")!, 10) + minutes,
    parseInt(dateMap.get("second")!, 10),
  );

  return newDate;
}

/**
 * Check if two dates are the same day in a timezone
 */
export function isSameDay(date1: Date, date2: Date, timezone: string): boolean {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date1) === formatter.format(date2);
}

/**
 * Check if a date is midnight in a timezone
 */
export function isMidnightInTimezone(date: Date, timezone: string): boolean {
  const currentMinutes = getCurrentTimeInZone(timezone);
  // Within 1 minute of midnight
  return currentMinutes < 1;
}

// ─── BLACKOUT DATE LOGIC ──────────────────────────────────────────────────

/**
 * Check if a date is blacked out
 */
export function isDateBlackedOut(
  date: Date,
  blackoutDates: BlackoutDate[],
  timezone?: string,
): boolean {
  if (!blackoutDates || blackoutDates.length === 0) {
    return false;
  }

  const dateStr = date.toISOString().split("T")[0];
  for (const blackout of blackoutDates) {
    const startStr = blackout.startDate.toISOString().split("T")[0];
    const endStr = blackout.endDate.toISOString().split("T")[0];
    if (dateStr >= startStr && dateStr <= endStr) {
      return true;
    }
  }

  return false;
}

/**
 * Get next available date (skip blackout dates)
 */
export function getNextAvailableDate(
  startDate: Date,
  blackoutDates: BlackoutDate[],
  maxDaysAhead: number = 30,
): Date | undefined {
  let current = new Date(startDate);

  for (let i = 0; i < maxDaysAhead; i++) {
    if (!isDateBlackedOut(current, blackoutDates)) {
      return current;
    }
    current.setDate(current.getDate() + 1);
  }

  return undefined;
}

// ─── OPERATING HOURS LOGIC ────────────────────────────────────────────────

/**
 * Check if current time is within operating hours
 */
export function isCurrentlyOpen(
  operatingHours: OperatingHours,
  referenceDate?: Date,
): boolean {
  const date = referenceDate || new Date();
  const dayOfWeek = getDayOfWeek(date, operatingHours.timezone);

  return isTimeWithinOperatingHours(
    date,
    operatingHours,
    operatingHours.timezone,
  );
}

/**
 * Check if a specific time is within operating hours
 */
export function isTimeWithinOperatingHours(
  date: Date,
  operatingHours: OperatingHours,
  timezone: string,
): boolean {
  const dayOfWeek = getDayOfWeek(date, timezone);
  const timeWindow =
    operatingHours.byDayOfWeek[dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6];

  if (!timeWindow) {
    return false; // No hours defined for this day
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const currentMinutes = parseTime(formatter.format(date));
  const openMinutes = parseTime(timeWindow.open);
  const closeMinutes = parseTime(timeWindow.close);

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

/**
 * Get operating hours for a specific day of week
 */
export function getOperatingHoursForDay(
  dayOfWeek: number,
  operatingHours: OperatingHours,
): TimeWindow | undefined {
  return operatingHours.byDayOfWeek[dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6];
}

/**
 * Check if a date is a holiday
 */
export function isHoliday(date: Date, operatingHours: OperatingHours): boolean {
  if (!operatingHours.holidays) return false;

  const dateStr = date.toISOString().split("T")[0];
  const holidayStr = date.toISOString().split("T")[0];

  return operatingHours.holidays.some(
    (h) => h.date.toISOString().split("T")[0] === dateStr,
  );
}

/**
 * Get holiday info if applicable
 */
export function getHolidayInfo(
  date: Date,
  operatingHours: OperatingHours,
): (typeof operatingHours.holidays)[0] | undefined {
  if (!operatingHours.holidays) return undefined;

  const dateStr = date.toISOString().split("T")[0];
  return operatingHours.holidays.find(
    (h) => h.date.toISOString().split("T")[0] === dateStr,
  );
}

// ─── CUTOFF LOGIC ─────────────────────────────────────────────────────────

/**
 * Check if cutoff time has passed for a time slot
 */
export function isCutoffPassed(
  slotStartTime: string,
  cutoffMinutes: number,
  timezone: string,
  referenceDate?: Date,
): boolean {
  const now = referenceDate || new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const currentMinutes = parseTime(formatter.format(now));
  const slotMinutes = parseTime(slotStartTime);
  const cutoffAtMinutes = slotMinutes - cutoffMinutes;

  return currentMinutes >= cutoffAtMinutes;
}

/**
 * Get minutes until cutoff for a time slot
 */
export function getMinutesUntilCutoff(
  slotStartTime: string,
  cutoffMinutes: number,
  timezone: string,
  referenceDate?: Date,
): number {
  const now = referenceDate || new Date();
  const currentMinutes = getCurrentTimeInZone(timezone);
  const slotMinutes = parseTime(slotStartTime);
  const cutoffAtMinutes = slotMinutes - cutoffMinutes;

  const minutesLeft = cutoffAtMinutes - currentMinutes;
  return Math.max(0, minutesLeft);
}

/**
 * Check if a cutoff rule applies to current time
 */
export function appliesCutoffRule(
  rule: CutoffRule,
  dayOfWeek: number,
  currentMinutes: number,
): boolean {
  // Check if rule applies to this day
  if (rule.daysOfWeek && !rule.daysOfWeek.includes(dayOfWeek)) {
    return false;
  }

  // Check if rule applies to current time window
  if (rule.timeWindow) {
    const openMinutes = parseTime(rule.timeWindow.open);
    const closeMinutes = parseTime(rule.timeWindow.close);

    if (currentMinutes < openMinutes || currentMinutes >= closeMinutes) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate cutoff time for an order
 */
export function calculateCutoffTime(
  baseSlotTime: string,
  cutoffRules: CutoffRule[],
  dayOfWeek: number,
  timezone: string,
  referenceDate?: Date,
): Date {
  const now = referenceDate || new Date();
  const currentMinutes = getCurrentTimeInZone(timezone);
  const slotMinutes = parseTime(baseSlotTime);

  // Find applicable rule
  let cutoffMinutes = 120; // default
  for (const rule of cutoffRules) {
    if (appliesCutoffRule(rule, dayOfWeek, currentMinutes)) {
      cutoffMinutes = rule.minutesBeforeSlot;
      break;
    }
  }

  // Calculate cutoff time
  return addMinutesInTimezone(now, slotMinutes - cutoffMinutes, timezone);
}

// ─── PREP TIME LOGIC ──────────────────────────────────────────────────────

/**
 * Calculate total preparation time including conditions
 */
export function calculateTotalPrepTime(
  baseTime: PrepTime,
  date: Date,
  timezone: string,
): number {
  let totalMinutes = baseTime.baseMinutes;

  if (!baseTime.conditionalMinutes) return totalMinutes;

  const dayOfWeek = getDayOfWeek(date, timezone);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Apply conditional time
  for (const conditional of baseTime.conditionalMinutes) {
    switch (conditional.condition) {
      case "weekend":
        if (isWeekend) {
          totalMinutes += conditional.additionalMinutes;
        }
        break;
      case "holiday":
        // Would need holiday list to properly implement
        break;
      case "high_volume":
        // Would need volume tracking to properly implement
        break;
    }
  }

  return totalMinutes;
}

/**
 * Calculate earliest possible delivery date
 */
export function calculateEarliestDeliveryDate(
  orderDate: Date,
  prepTime: PrepTime,
  estimatedDays: { min: number; max: number },
  operatingHours: OperatingHours,
  blackoutDates: BlackoutDate[],
  timezone: string,
): Date {
  // Start from order date
  let date = new Date(orderDate);

  // Add prep time
  const totalPrepMinutes = calculateTotalPrepTime(prepTime, date, timezone);
  date = addMinutesInTimezone(date, totalPrepMinutes, timezone);

  // Add minimum delivery days
  date.setDate(date.getDate() + estimatedDays.min);

  // Skip blackout dates
  while (isDateBlackedOut(date, blackoutDates, timezone)) {
    date.setDate(date.getDate() + 1);
  }

  // Make sure it's on an operating day
  while (!isTimeWithinOperatingHours(date, operatingHours, timezone)) {
    date.setDate(date.getDate() + 1);
  }

  return date;
}

// ─── TIME SLOT LOGIC ──────────────────────────────────────────────────────

/**
 * Get available time slots for a date
 */
export function getAvailableTimeSlots(
  slots: DeliveryTimeSlot[],
  date: Date,
  timezone: string,
): DeliveryTimeSlot[] {
  const dayOfWeek = getDayOfWeek(date, timezone);

  return slots.filter((slot) => {
    // Check if slot operates on this day
    if (!slot.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }

    // Check if slot is available (capacity, active, etc)
    if (!slot.isAvailable) {
      return false;
    }

    // Check if slot has capacity
    if (slot.currentUtilization >= slot.maxCapacity) {
      return false;
    }

    return true;
  });
}

/**
 * Get next available time slot across multiple dates
 */
export function getNextAvailableSlot(
  slots: DeliveryTimeSlot[],
  startDate: Date,
  blackoutDates: BlackoutDate[],
  timezone: string,
  maxDaysAhead: number = 14,
): { slot: DeliveryTimeSlot; date: Date } | undefined {
  let current = new Date(startDate);

  for (let i = 0; i < maxDaysAhead; i++) {
    // Skip blackout dates
    if (isDateBlackedOut(current, blackoutDates, timezone)) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Get available slots for this date
    const availableSlots = getAvailableTimeSlots(slots, current, timezone);

    if (availableSlots.length > 0) {
      // Return earliest slot
      const sorted = availableSlots.sort((a, b) => {
        const aTime = parseTime(a.startTime);
        const bTime = parseTime(b.startTime);
        return aTime - bTime;
      });

      return {
        slot: sorted[0],
        date: current,
      };
    }

    current.setDate(current.getDate() + 1);
  }

  return undefined;
}

/**
 * Calculate time slot utilization percentage
 */
export function calculateSlotUtilization(slot: DeliveryTimeSlot): number {
  if (slot.maxCapacity === 0) return 100;
  return (slot.currentUtilization / slot.maxCapacity) * 100;
}

// ─── CALENDAR RULE LOGIC ──────────────────────────────────────────────────

/**
 * Get applicable calendar rules for a date
 */
export function getApplicableCalendarRules(
  rules: CalendarRule[],
  date: Date,
  timezone: string,
): CalendarRule[] {
  const dayOfWeek = getDayOfWeek(date, timezone);

  return rules.filter((rule) => {
    // Check if rule is active
    if (!rule.isActive) return false;

    // Check effective date range
    if (rule.effectiveFrom && date < rule.effectiveFrom) return false;
    if (rule.effectiveTo && date > rule.effectiveTo) return false;

    // Check day of week if specified
    if (rule.daysOfWeek && !rule.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }

    return true;
  });
}

/**
 * Get highest priority applicable rule
 */
export function getHighestPriorityRule(
  rules: CalendarRule[],
  date: Date,
  timezone: string,
): CalendarRule | undefined {
  const applicable = getApplicableCalendarRules(rules, date, timezone);

  if (applicable.length === 0) return undefined;

  return applicable.reduce((prev, current) =>
    current.priority > prev.priority ? current : prev,
  );
}

// ─── COMPREHENSIVE AVAILABILITY CHECK ──────────────────────────────────────

/**
 * Check complete availability for a delivery date and time slot
 */
export function isDeliveryAvailable(
  profile: CalendarProfile,
  date: Date,
  timeSlot?: DeliveryTimeSlot,
): { available: boolean; reason?: string } {
  const timezone = profile.operatingHours.timezone;

  // Check if date is blacked out
  if (isDateBlackedOut(date, profile.blackoutDates, timezone)) {
    return {
      available: false,
      reason: "Date is blacked out",
    };
  }

  // Check operating hours
  if (!isTimeWithinOperatingHours(date, profile.operatingHours, timezone)) {
    return {
      available: false,
      reason: "Outside operating hours",
    };
  }

  // Check specific time slot if provided
  if (timeSlot) {
    const dayOfWeek = getDayOfWeek(date, timezone);

    if (!timeSlot.daysOfWeek.includes(dayOfWeek)) {
      return {
        available: false,
        reason: "Time slot not available on this day",
      };
    }

    if (!timeSlot.isAvailable) {
      return {
        available: false,
        reason: "Time slot is not available",
      };
    }

    if (timeSlot.currentUtilization >= timeSlot.maxCapacity) {
      return {
        available: false,
        reason: "Time slot is at capacity",
      };
    }

    if (isCutoffPassed(timeSlot.startTime, timeSlot.cutoffMinutes, timezone)) {
      return {
        available: false,
        reason: `Cutoff for this slot has passed (${timeSlot.cutoffMinutes} minutes before slot)`,
      };
    }
  }

  return { available: true };
}

/**
 * Get all available dates and slots within a range
 */
export function getAvailabilityCalendar(
  profile: CalendarProfile,
  startDate: Date,
  endDate: Date,
  timezone: string,
): Array<{
  date: Date;
  available: boolean;
  slots: DeliveryTimeSlot[];
}> {
  const calendar = [];
  let current = new Date(startDate);

  while (current <= endDate) {
    const dayInfo = isDeliveryAvailable(profile, current);

    const slots = dayInfo.available
      ? getAvailableTimeSlots(profile.timeSlots, current, timezone)
      : [];

    calendar.push({
      date: new Date(current),
      available: dayInfo.available,
      slots,
    });

    current.setDate(current.getDate() + 1);
  }

  return calendar;
}
