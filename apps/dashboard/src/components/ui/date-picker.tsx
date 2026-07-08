"use client";

import {
  forwardRef,
  useRef,
  useEffect,
  useState,
  type InputHTMLAttributes,
} from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatePickerProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> {
  value?: Date | null;
  /** Alias for value (react-datepicker compatible) */
  selected?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  format?: string;
  className?: string;
}

const DatePicker = forwardRef<HTMLDivElement, DatePickerProps>(
  (
    {
      value,
      selected,
      onChange,
      placeholder = "Select date",
      minDate,
      maxDate,
      disabled = false,
      format = "MMM dd, yyyy",
      className,
      ...props
    },
    ref,
  ) => {
    const effectiveValue = selected ?? value;
    const [isOpen, setIsOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date(2024, 0, 1)); // Start month for calendar
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Format date for display
    const formatDate = (date: Date | null | undefined): string => {
      if (!date) return "";
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
    };

    // Check if date is disabled
    const isDateDisabled = (date: Date): boolean => {
      if (minDate && date < minDate) return true;
      if (maxDate && date > maxDate) return true;
      return false;
    };

    // Check if date is today
    const isToday = (date: Date): boolean => {
      const today = new Date();
      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    };

    // Check if date matches selected
    const isSelected = (date: Date): boolean => {
      if (!effectiveValue) return false;
      return (
        date.getDate() === effectiveValue.getDate() &&
        date.getMonth() === effectiveValue.getMonth() &&
        date.getFullYear() === effectiveValue.getFullYear()
      );
    };

    // Get calendar days for current month
    const getDaysInMonth = (date: Date): number[] => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const days: number[] = [];

      // Add empty slots for days before month starts
      for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(0);
      }

      // Add days of the month
      for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
      }

      return days;
    };

    // Handle date click
    const handleDateClick = (day: number) => {
      if (day === 0) return;
      const selectedDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day,
      );
      if (!isDateDisabled(selectedDate)) {
        onChange(selectedDate);
        setIsOpen(false);
      }
    };

    // Handle month navigation
    const handlePrevMonth = () => {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() - 1),
      );
    };

    const handleNextMonth = () => {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1),
      );
    };

    // Close on click outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
      }
    }, [isOpen]);

    // Handle keyboard
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape" && isOpen) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener("keydown", handleKeyDown);
        return () => {
          document.removeEventListener("keydown", handleKeyDown);
        };
      }
    }, [isOpen]);

    const days = getDaysInMonth(currentDate);
    const monthYear = currentDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    return (
      <div
        ref={containerRef}
        className={cn("relative w-full", className)}
        {...(ref && { ref })}
      >
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={formatDate(effectiveValue)}
            placeholder={placeholder}
            readOnly
            disabled={disabled}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={cn(
              "w-full font-sans bg-wl-bg-surface text-wl-text-primary",
              "border rounded-md outline-none",
              "px-4 py-2 text-sm pr-10",
              "transition-all duration-fast ease-default",
              isOpen
                ? "border-wl-primary-500"
                : "border-wl-border-default hover:border-wl-border-default",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              "cursor-pointer",
              className,
            )}
            {...props}
          />
          <CalendarDays className="absolute right-3 w-4 h-4 text-wl-text-secondary pointer-events-none" />
        </div>

        {isOpen && (
          <div className="absolute top-full mt-2 left-0 z-50 bg-wl-bg-elevated border border-wl-border-default rounded-lg p-4 shadow-lg min-w-80">
            {/* Month/Year Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePrevMonth}
                className="p-1 hover:bg-wl-bg-surface rounded-md transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4 text-wl-text-secondary" />
              </button>
              <h3 className="text-sm font-semibold text-wl-text-primary">
                {monthYear}
              </h3>
              <button
                onClick={handleNextMonth}
                className="p-1 hover:bg-wl-bg-surface rounded-md transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4 text-wl-text-secondary" />
              </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
                <div
                  key={day}
                  className="text-xs font-semibold text-wl-text-secondary text-center py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Day Grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => (
                <button
                  key={index}
                  onClick={() => handleDateClick(day)}
                  disabled={
                    day === 0 ||
                    isDateDisabled(
                      new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth(),
                        day,
                      ),
                    )
                  }
                  className={cn(
                    "w-full aspect-square rounded-md text-sm font-medium",
                    "transition-all duration-fast ease-default",
                    "flex items-center justify-center",
                    day === 0 && "invisible",
                    day !== 0 &&
                      !isDateDisabled(
                        new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth(),
                          day,
                        ),
                      ) &&
                      "hover:bg-wl-bg-surface cursor-pointer",
                    isSelected(
                      new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth(),
                        day,
                      ),
                    ) && "bg-wl-primary-500 text-wl-text-inverse font-semibold",
                    isToday(
                      new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth(),
                        day,
                      ),
                    ) &&
                      !isSelected(
                        new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth(),
                          day,
                        ),
                      ) &&
                      "border border-wl-primary-500 text-wl-primary-500",
                    isDateDisabled(
                      new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth(),
                        day,
                      ),
                    ) && "text-wl-text-tertiary opacity-50 cursor-not-allowed",
                    day !== 0 &&
                      !isDateDisabled(
                        new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth(),
                          day,
                        ),
                      ) &&
                      !isSelected(
                        new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth(),
                          day,
                        ),
                      ) &&
                      !isToday(
                        new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth(),
                          day,
                        ),
                      ) &&
                      "text-wl-text-primary",
                  )}
                >
                  {day || ""}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
);

DatePicker.displayName = "DatePicker";

export { DatePicker };
