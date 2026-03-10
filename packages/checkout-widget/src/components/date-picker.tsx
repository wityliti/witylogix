/**
 * DatePicker Component
 * Calendar-based date picker with availability indicators
 */

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, getDaysInMonth, getDay, addMonths, subMonths } from 'date-fns';
import { isValidSelectableDate, isDateBlackouted, getBlackoutDatesInMonth, getAvailableSlotsText, formatDateDisplay } from '../utils/date-utils';
import type { BlackoutDate, CapacityInfo } from '../types';
import clsx from 'clsx';

interface DatePickerProps {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  blackoutDates?: BlackoutDate[];
  availableDates?: Map<string, CapacityInfo>;
  minDate?: Date;
  maxDate?: Date;
  isLoading?: boolean;
  compact?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DatePicker: React.FC<DatePickerProps> = ({
  selectedDate,
  onDateSelect,
  blackoutDates = [],
  availableDates = new Map(),
  minDate,
  maxDate,
  isLoading = false,
  compact = false,
}) => {
  const [displayMonth, setDisplayMonth] = useState(selectedDate ? new Date(selectedDate) : new Date());

  const daysInMonth = getDaysInMonth(displayMonth);
  const firstDayOfMonth = getDay(new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1));
  const blackoutMap = getBlackoutDatesInMonth(displayMonth.getFullYear(), displayMonth.getMonth() + 1, blackoutDates);

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];

    // Add empty slots for days before month starts
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }

    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  }, [firstDayOfMonth, daysInMonth]);

  const handlePrevMonth = () => {
    setDisplayMonth(subMonths(displayMonth, 1));
  };

  const handleNextMonth = () => {
    setDisplayMonth(addMonths(displayMonth, 1));
  };

  const handleDateClick = (day: number) => {
    const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day);
    if (isValidSelectableDate(date, blackoutDates, minDate, maxDate)) {
      onDateSelect(date);
    }
  };

  const renderDateCell = (day: number | null) => {
    if (day === null) {
      return <div className="wl-p-2 wl-h-16" key={`empty-${Math.random()}`} />;
    }

    const date = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day);
    const dateStr = format(date, 'yyyy-MM-dd');
    const isSelected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === dateStr;
    const isValid = isValidSelectableDate(date, blackoutDates, minDate, maxDate);
    const blackout = blackoutMap.get(day);
    const capacity = availableDates.get(dateStr);

    return (
      <button
        key={`date-${day}`}
        onClick={() => handleDateClick(day)}
        disabled={!isValid || isLoading}
        className={clsx(
          'wl-p-2 wl-h-16 wl-flex wl-flex-col wl-items-center wl-justify-center wl-rounded wl-text-sm wl-font-medium wl-relative wl-border-2',
          'wl-transition-colors wl-duration-200',
          {
            'wl-border-wl-accent wl-bg-wl-accent/10 wl-text-wl-accent': isSelected,
            'wl-border-transparent wl-hover:bg-wl-accent/5 wl-text-wl-foreground wl-cursor-pointer': isValid && !isSelected,
            'wl-border-transparent wl-bg-wl-muted wl-text-wl-muted-foreground wl-cursor-not-allowed wl-opacity-50': !isValid,
          }
        )}
        aria-label={`${formatDateDisplay(date)}${capacity ? `, ${getAvailableSlotsText(capacity.available, capacity.total)}` : ''}`}
        aria-disabled={!isValid}
      >
        <span>{day}</span>

        {/* Availability indicator */}
        {isValid && capacity && capacity.available > 0 && (
          <div className="wl-absolute wl-bottom-1 wl-w-2 wl-h-2 wl-rounded-full wl-bg-wl-success" />
        )}

        {/* Fully booked indicator */}
        {isValid && capacity && capacity.available === 0 && (
          <div className="wl-absolute wl-bottom-1 wl-w-2 wl-h-2 wl-rounded-full wl-bg-wl-muted" />
        )}

        {/* Blackout indicator */}
        {blackout && (
          <div className="wl-absolute wl-inset-0 wl-border-t-2 wl-border-wl-destructive wl-rounded wl-opacity-50" />
        )}
      </button>
    );
  };

  return (
    <div className={clsx('wl-w-full', { 'wl-max-w-sm': compact })}>
      {/* Header */}
      <div className="wl-flex wl-items-center wl-justify-between wl-mb-4 wl-px-2">
        <button
          onClick={handlePrevMonth}
          disabled={isLoading}
          className="wl-p-1 wl-hover:bg-wl-accent/10 wl-rounded wl-transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="wl-w-5 wl-h-5" />
        </button>

        <h2 className="wl-text-lg wl-font-semibold">
          {format(displayMonth, 'MMMM yyyy')}
        </h2>

        <button
          onClick={handleNextMonth}
          disabled={isLoading}
          className="wl-p-1 wl-hover:bg-wl-accent/10 wl-rounded wl-transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="wl-w-5 wl-h-5" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="wl-grid wl-grid-cols-7 wl-gap-0 wl-mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="wl-text-center wl-text-sm wl-font-semibold wl-text-wl-muted-foreground wl-py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="wl-grid wl-grid-cols-7 wl-gap-1 wl-bg-wl-muted/30 wl-p-2 wl-rounded-lg">
        {calendarDays.map((day, index) => (
          <React.Fragment key={`cell-${index}`}>
            {renderDateCell(day)}
          </React.Fragment>
        ))}
      </div>

      {/* Legend */}
      <div className="wl-mt-4 wl-space-y-2 wl-text-xs wl-text-wl-muted-foreground">
        <div className="wl-flex wl-items-center wl-gap-2">
          <div className="wl-w-2 wl-h-2 wl-rounded-full wl-bg-wl-success" />
          <span>Available</span>
        </div>
        <div className="wl-flex wl-items-center wl-gap-2">
          <div className="wl-w-2 wl-h-2 wl-rounded-full wl-bg-wl-muted" />
          <span>Fully booked</span>
        </div>
        <div className="wl-flex wl-items-center wl-gap-2">
          <div className="wl-w-2.5 wl-h-2.5 wl-border-t-2 wl-border-wl-destructive" />
          <span>Blackout date</span>
        </div>
      </div>
    </div>
  );
};
