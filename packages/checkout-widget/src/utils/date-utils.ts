/**
 * Date Utility Functions
 * Handles date formatting, validation, and blackout date checking
 */

import {
  format,
  parseISO,
  isSameDay,
  addDays,
  startOfDay,
  endOfDay,
  isToday,
  isBefore,
  isAfter,
  eachDayOfInterval,
} from "date-fns";
import type { BlackoutDate } from "../types";

/**
 * Format date for display (e.g., "Mon, Mar 11, 2026")
 */
export const formatDateDisplay = (date: Date): string => {
  return format(date, "EEE, MMM d, yyyy");
};

/**
 * Format date for API (ISO 8601)
 */
export const formatDateISO = (date: Date): string => {
  return format(date, "yyyy-MM-dd");
};

/**
 * Format time for display (e.g., "2:30 PM")
 */
export const formatTimeDisplay = (date: Date): string => {
  return format(date, "h:mm a");
};

/**
 * Format time range for display (e.g., "2:00 PM - 3:00 PM")
 */
export const formatTimeRangeDisplay = (
  startTime: Date,
  endTime: Date,
): string => {
  return `${formatTimeDisplay(startTime)} - ${formatTimeDisplay(endTime)}`;
};

/**
 * Format date and time together (e.g., "Mar 11, 2:30 PM")
 */
export const formatDateTimeDisplay = (date: Date, time: Date): string => {
  return `${format(date, "MMM d")}, ${formatTimeDisplay(time)}`;
};

/**
 * Check if a date is blackouted
 */
export const isDateBlackouted = (
  date: Date,
  blackoutDates: BlackoutDate[],
): BlackoutDate | undefined => {
  return blackoutDates.find((bd) => isSameDay(bd.date, date));
};

/**
 * Get all blackout dates in a month
 */
export const getBlackoutDatesInMonth = (
  year: number,
  month: number,
  blackoutDates: BlackoutDate[],
): Map<number, BlackoutDate> => {
  const result = new Map<number, BlackoutDate>();

  blackoutDates.forEach((bd) => {
    if (bd.date.getFullYear() === year && bd.date.getMonth() === month - 1) {
      result.set(bd.date.getDate(), bd);
    }
  });

  return result;
};

/**
 * Check if date is valid for selection (not past, not blackouted)
 */
export const isValidSelectableDate = (
  date: Date,
  blackoutDates: BlackoutDate[] = [],
  minDate?: Date,
  maxDate?: Date,
): boolean => {
  const normalizedDate = startOfDay(date);
  const normalizedMinDate = minDate
    ? startOfDay(minDate)
    : startOfDay(new Date());
  const normalizedMaxDate = maxDate ? endOfDay(maxDate) : null;

  // Check if before minimum date
  if (isBefore(normalizedDate, normalizedMinDate)) {
    return false;
  }

  // Check if after maximum date
  if (normalizedMaxDate && isAfter(normalizedDate, normalizedMaxDate)) {
    return false;
  }

  // Check if blackouted
  if (isDateBlackouted(date, blackoutDates)) {
    return false;
  }

  return true;
};

/**
 * Parse ISO date string to Date
 */
export const parseDate = (dateString: string): Date => {
  try {
    return parseISO(dateString);
  } catch {
    return new Date();
  }
};

/**
 * Get number of available slots text
 */
export const getAvailableSlotsText = (
  available: number,
  total: number,
): string => {
  if (available === 0) return "Fully booked";
  if (available === 1) return "1 slot left";
  if (available <= 3) return `${available} slots left`;
  return `${available} slots available`;
};

/**
 * Get relative day name (e.g., "Today", "Tomorrow", "Monday")
 */
export const getRelativeDayName = (date: Date): string => {
  if (isToday(date)) {
    return "Today";
  }

  const tomorrow = addDays(new Date(), 1);
  if (isSameDay(date, tomorrow)) {
    return "Tomorrow";
  }

  return format(date, "EEEE");
};

/**
 * Calculate days until date
 */
export const daysUntil = (date: Date): number => {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  return Math.floor(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
};

/**
 * Get date range for a month
 */
export const getMonthDateRange = (year: number, month: number) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end };
};

/**
 * Get all dates in a month
 */
export const getDatesInMonth = (year: number, month: number): Date[] => {
  const { start, end } = getMonthDateRange(year, month);
  return eachDayOfInterval({ start, end });
};

/**
 * Check if time is after cutoff time on a given date
 */
export const isAfterCutoff = (
  date: Date,
  currentTime: Date,
  cutoffHour: number,
  cutoffMinute: number = 0,
): boolean => {
  const cutoff = new Date(date);
  cutoff.setHours(cutoffHour, cutoffMinute, 0, 0);
  return isAfter(currentTime, cutoff);
};

/**
 * Format time for API (HH:mm format)
 */
export const formatTimeForApi = (date: Date): string => {
  return format(date, "HH:mm");
};

/**
 * Create time from hour and minute
 */
export const createTime = (
  hour: number,
  minute: number,
  date: Date = new Date(),
): Date => {
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
};

/**
 * Get start of day
 */
export const getStartOfDay = (date: Date): Date => {
  return startOfDay(date);
};

/**
 * Get end of day
 */
export const getEndOfDay = (date: Date): Date => {
  return endOfDay(date);
};

/**
 * Check if date is within range
 */
export const isDateInRange = (
  date: Date,
  startDate: Date,
  endDate: Date,
): boolean => {
  const normalizedDate = startOfDay(date);
  const normalizedStart = startOfDay(startDate);
  const normalizedEnd = endOfDay(endDate);

  return (
    !isBefore(normalizedDate, normalizedStart) &&
    !isAfter(normalizedDate, normalizedEnd)
  );
};
