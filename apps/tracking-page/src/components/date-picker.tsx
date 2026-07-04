"use client";

import { useState, useMemo } from "react";

interface DatePickerProps {
  availableDates: string[];
  blockedDates: string[];
  selectedDate?: string;
  onDateSelect: (date: string) => void;
  theme?: "light" | "dark";
}

interface CalendarDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isAvailable: boolean;
  isBlocked: boolean;
  isSelected: boolean;
}

export function DatePicker({
  availableDates,
  blockedDates,
  selectedDate,
  onDateSelect,
  theme = "light",
}: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const isDarkTheme = theme === "dark";
  const bgColor = isDarkTheme
    ? "var(--wl-widget-bg-dark, #1a1a1a)"
    : "var(--wl-widget-bg, #ffffff)";
  const textColor = isDarkTheme
    ? "var(--wl-widget-text-dark, #ffffff)"
    : "var(--wl-widget-text, #1f2937)";
  const borderColor = isDarkTheme
    ? "var(--wl-widget-border-dark, #333333)"
    : "var(--wl-widget-border, #e5e7eb)";
  const primaryColor = "var(--wl-widget-primary, #6C63FF)";
  const secondaryColor = isDarkTheme ? "#2d2d2d" : "#f3f4f6";
  const disabledColor = isDarkTheme ? "#444444" : "#d1d5db";
  const successColor = "var(--wl-widget-success, #008060)";

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: CalendarDay[] = [];

    // Previous month's days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const date = new Date(year, month - 1, day);
      const dateString = date.toISOString().split("T")[0];
      days.push({
        date,
        dateString,
        isCurrentMonth: false,
        isAvailable: false,
        isBlocked: false,
        isSelected: false,
      });
    }

    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = date.toISOString().split("T")[0];
      const isAvailable = availableDates.includes(dateString);
      const isBlocked = blockedDates.includes(dateString);
      const isSelected = selectedDate === dateString;

      days.push({
        date,
        dateString,
        isCurrentMonth: true,
        isAvailable,
        isBlocked,
        isSelected,
      });
    }

    // Next month's days
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      const dateString = date.toISOString().split("T")[0];
      days.push({
        date,
        dateString,
        isCurrentMonth: false,
        isAvailable: false,
        isBlocked: false,
        isSelected: false,
      });
    }

    return days;
  }, [currentMonth, availableDates, blockedDates, selectedDate]);

  const goToPreviousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1),
    );
  };

  const goToNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
    );
  };

  const monthYear = currentMonth.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const today = new Date().toISOString().split("T")[0];

  return (
    <div
      style={{
        backgroundColor: bgColor,
        borderRadius: "12px",
        padding: "24px",
        border: `1px solid ${borderColor}`,
        maxWidth: "400px",
        margin: "0 auto",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: "600",
            color: textColor,
          }}
        >
          Select Delivery Date
        </h2>
      </div>

      {/* Month/Year Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <button
          onClick={goToPreviousMonth}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "8px 12px",
            borderRadius: "6px",
            color: primaryColor,
            fontSize: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = secondaryColor;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = "transparent";
          }}
          aria-label="Previous month"
        >
          ←
        </button>
        <div
          style={{
            fontSize: "16px",
            fontWeight: "600",
            color: textColor,
            minWidth: "150px",
            textAlign: "center",
          }}
        >
          {monthYear}
        </div>
        <button
          onClick={goToNextMonth}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "8px 12px",
            borderRadius: "6px",
            color: primaryColor,
            fontSize: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = secondaryColor;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = "transparent";
          }}
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {/* Day names */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          marginBottom: "8px",
        }}
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            style={{
              textAlign: "center",
              fontSize: "12px",
              fontWeight: "600",
              color: isDarkTheme ? "#999999" : "#6b7280",
              padding: "8px 0",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          marginBottom: "20px",
        }}
      >
        {calendarDays.map((day) => {
          const isPast = day.dateString < today && day.isCurrentMonth;
          const shouldDisable =
            !day.isCurrentMonth || isPast || day.isBlocked || !day.isAvailable;
          const isClickable = !shouldDisable;

          return (
            <button
              key={day.dateString}
              onClick={() => isClickable && onDateSelect(day.dateString)}
              style={{
                padding: "8px",
                borderRadius: "8px",
                border: day.isSelected
                  ? `2px solid ${primaryColor}`
                  : `1px solid ${borderColor}`,
                backgroundColor: day.isSelected
                  ? primaryColor
                  : day.isAvailable && day.isCurrentMonth && !isPast
                    ? secondaryColor
                    : disabledColor,
                color: day.isSelected
                  ? "#ffffff"
                  : day.isCurrentMonth && !isPast && day.isAvailable
                    ? textColor
                    : isDarkTheme
                      ? "#666666"
                      : "#9ca3af",
                cursor: isClickable ? "pointer" : "not-allowed",
                fontSize: "14px",
                fontWeight: day.isSelected ? "600" : "500",
                aspectRatio: "1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
                opacity: shouldDisable ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (isClickable) {
                  (e.target as HTMLElement).style.backgroundColor =
                    primaryColor;
                  (e.target as HTMLElement).style.color = "#ffffff";
                  (e.target as HTMLElement).style.transform = "scale(1.05)";
                }
              }}
              onMouseLeave={(e) => {
                if (isClickable) {
                  (e.target as HTMLElement).style.backgroundColor =
                    day.isSelected ? primaryColor : secondaryColor;
                  (e.target as HTMLElement).style.color = day.isSelected
                    ? "#ffffff"
                    : textColor;
                  (e.target as HTMLElement).style.transform = "scale(1)";
                }
              }}
              disabled={shouldDisable}
              aria-label={`${day.date.toDateString()}${day.isBlocked ? " (blocked)" : day.isAvailable ? " (available)" : ""}`}
              aria-pressed={day.isSelected}
            >
              {day.date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          paddingTop: "16px",
          borderTop: `1px solid ${borderColor}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "4px",
              backgroundColor: secondaryColor,
            }}
          />
          <span style={{ fontSize: "13px", color: textColor }}>Available</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "4px",
              backgroundColor: disabledColor,
            }}
          />
          <span
            style={{
              fontSize: "13px",
              color: isDarkTheme ? "#999999" : "#6b7280",
            }}
          >
            Unavailable/Past
          </span>
        </div>
      </div>

      {/* Timezone Info */}
      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          backgroundColor: secondaryColor,
          borderRadius: "8px",
          fontSize: "12px",
          color: isDarkTheme ? "#cccccc" : "#6b7280",
        }}
      >
        <strong>Timezone:</strong>{" "}
        {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </div>

      {/* Selected date display */}
      {selectedDate && (
        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            backgroundColor: successColor,
            color: "#ffffff",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          ✓ Selected:{" "}
          {new Date(selectedDate).toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      )}
    </div>
  );
}
