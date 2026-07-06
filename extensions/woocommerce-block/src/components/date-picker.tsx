/**
 * Delivery Date Picker Component
 * Calendar-based date selection for WooCommerce checkout
 */

import { useState, useEffect, useMemo } from "@wordpress/element";
import type { SlotAvailability } from "../api/witylogix-api";

interface DatePickerProps {
  onDateSelect: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  disabledDates?: string[];
  slots?: SlotAvailability[];
  isLoading?: boolean;
}

/**
 * Get all dates between start and end
 */
function getDatesBetween(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Parse YYYY-MM-DD string to Date
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get availability status for a date
 */
function getAvailabilityStatus(
  date: string,
  slots?: SlotAvailability[],
): "available" | "limited" | "unavailable" {
  if (!slots || slots.length === 0) {
    return "unavailable";
  }

  const dateSlots = slots.filter((slot) => slot.date === date);

  if (dateSlots.length === 0) {
    return "unavailable";
  }

  const availableSlots = dateSlots.filter((slot) => slot.available);

  if (availableSlots.length === 0) {
    return "unavailable";
  }

  if (availableSlots.length < dateSlots.length) {
    return "limited";
  }

  return "available";
}

/**
 * Date Picker Component
 */
export function DatePicker({
  onDateSelect,
  minDate,
  maxDate,
  disabledDates = [],
  slots = [],
  isLoading = false,
}: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Calculate date range
  const start = minDate ? parseDate(minDate) : new Date();
  const end = maxDate
    ? parseDate(maxDate)
    : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

  // Get calendar dates
  const calendarDates = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);

    // Get days from previous month to fill first week
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // Get days from next month to fill last week
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    return getDatesBetween(startDate, endDate);
  }, [currentMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1),
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
    );
  };

  const handleDateClick = (date: Date) => {
    const dateStr = formatDate(date);

    // Check if date is within range and not disabled
    if (date < start || date > end) {
      return;
    }

    if (disabledDates.includes(dateStr)) {
      return;
    }

    const status = getAvailabilityStatus(dateStr, slots);
    if (status === "unavailable") {
      return;
    }

    setSelectedDate(dateStr);
    onDateSelect(dateStr);
  };

  const monthName = currentMonth.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="witylogix-date-picker">
      {/* Header */}
      <div className="date-picker-header">
        <button
          onClick={handlePrevMonth}
          className="date-picker-nav-btn"
          aria-label="Previous month"
          disabled={isLoading}
        >
          ←
        </button>
        <h3 className="date-picker-month-label">{monthName}</h3>
        <button
          onClick={handleNextMonth}
          className="date-picker-nav-btn"
          aria-label="Next month"
          disabled={isLoading}
        >
          →
        </button>
      </div>

      {/* Weekday headers */}
      <div className="date-picker-weekdays">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="date-picker-weekday">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="date-picker-grid">
        {calendarDates.map((date) => {
          const dateStr = formatDate(date);
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
          const isInRange = date >= start && date <= end;
          const isDisabled = disabledDates.includes(dateStr) || !isInRange;
          const availability = getAvailabilityStatus(dateStr, slots);
          const isSelected = selectedDate === dateStr;

          return (
            <button
              key={dateStr}
              onClick={() => handleDateClick(date)}
              className={`
                date-picker-day
                ${!isCurrentMonth ? "date-picker-day--other-month" : ""}
                ${isDisabled ? "date-picker-day--disabled" : ""}
                ${isSelected ? "date-picker-day--selected" : ""}
                date-picker-day--${availability}
              `}
              disabled={isDisabled || isLoading}
              aria-label={date.toDateString()}
              aria-pressed={isSelected}
            >
              <span className="date-picker-day-number">{date.getDate()}</span>
              {availability !== "unavailable" && (
                <span
                  className="date-picker-day-indicator"
                  title={availability}
                >
                  {availability === "available" && "●"}
                  {availability === "limited" && "◐"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="date-picker-legend">
        <div className="legend-item">
          <span className="legend-indicator available">●</span>
          <span className="legend-label">Available</span>
        </div>
        <div className="legend-item">
          <span className="legend-indicator limited">◐</span>
          <span className="legend-label">Limited availability</span>
        </div>
      </div>
    </div>
  );
}
