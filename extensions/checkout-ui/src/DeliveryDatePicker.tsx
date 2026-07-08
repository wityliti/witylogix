// @ts-nocheck
import { h } from "preact";
import { useState, useEffect } from "preact/hooks";
import { DeliveryDate, TimeSlot, CartItem, ErrorState } from "./types";
import {
  fetchDeliveryDates,
  fetchTimeSlots,
  saveDeliverySelection,
  formatDateLabel,
} from "./api";
import { TimeSlotSelector } from "./TimeSlotSelector";
import { componentStyles, colors, spacing } from "./styles";

interface DeliveryDatePickerProps {
  shopId: string;
  cartItems?: CartItem[];
  blackoutDates?: string[]; // ISO dates that can't be selected
  minimumLeadTime?: number; // Minutes before current time to allow booking
  onSelectionChange?: (selection: {
    date: string;
    slotId: string;
    timeLabel: string;
    deliveryFee: number;
  }) => void;
}

/**
 * DeliveryDatePicker component
 * Main component for selecting delivery date and time slot
 * Shows calendar-style date picker and time slot selector
 * Handles loading, error states, and saving selections
 */
export function DeliveryDatePicker({
  shopId,
  cartItems = [],
  blackoutDates = [],
  minimumLeadTime = 240, // Default: 4 hours
  onSelectionChange,
}: DeliveryDatePickerProps) {
  const [dates, setDates] = useState<DeliveryDate[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch available dates on mount
  useEffect(() => {
    const loadDates = async () => {
      setLoadingDates(true);
      setError(null);

      try {
        const availableDates = await fetchDeliveryDates(shopId, cartItems);
        setDates(availableDates);

        // Auto-select the first available date
        const firstAvailable = availableDates.find((d) => d.available);
        if (firstAvailable) {
          setSelectedDate(firstAvailable.date);
        }
      } catch (err) {
        setError({
          type: "fetch",
          message: "Failed to load delivery dates. Please refresh the page.",
          retry: loadDates,
        });
      } finally {
        setLoadingDates(false);
      }
    };

    loadDates();
  }, [shopId, cartItems]);

  // Fetch time slots when date changes
  useEffect(() => {
    if (!selectedDate) return;

    const loadSlots = async () => {
      setLoadingSlots(true);
      setSlots([]);
      setSelectedSlot(null);
      setError(null);

      try {
        const availableSlots = await fetchTimeSlots(shopId, selectedDate);
        setSlots(availableSlots);

        // Auto-select the first available slot
        const firstAvailable = availableSlots.find((s) => s.available);
        if (firstAvailable) {
          setSelectedSlot(firstAvailable);
          onSelectionChange?.({
            date: selectedDate,
            slotId: firstAvailable.id,
            timeLabel: firstAvailable.label,
            deliveryFee: firstAvailable.price,
          });
        }
      } catch (err) {
        setError({
          type: "fetch",
          message: "Failed to load time slots. Please try again.",
          retry: () => {
            loadSlots();
          },
        });
      } finally {
        setLoadingSlots(false);
      }
    };

    loadSlots();
  }, [selectedDate, shopId]);

  // Check if date is blackout or before minimum lead time
  const isDateSelectable = (dateStr: string): boolean => {
    // Check blackout dates
    if (blackoutDates.includes(dateStr)) {
      return false;
    }

    // Check minimum lead time for today
    const today = new Date();
    const selectedDate = new Date(dateStr);
    const isSameDay =
      today.getFullYear() === selectedDate.getFullYear() &&
      today.getMonth() === selectedDate.getMonth() &&
      today.getDate() === selectedDate.getDate();

    if (isSameDay) {
      const timeUntilMidnight = new Date(today);
      timeUntilMidnight.setHours(24, 0, 0, 0);
      const minutesUntilMidnight =
        (timeUntilMidnight.getTime() - today.getTime()) / (1000 * 60);
      return minutesUntilMidnight >= minimumLeadTime;
    }

    return selectedDate > today;
  };

  // Handle date selection
  const handleDateSelect = (date: DeliveryDate) => {
    if (date.available && isDateSelectable(date.date)) {
      setSelectedDate(date.date);
    }
  };

  // Format date with locale support
  const formatDateWithLocale = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat(
        Intl.DateTimeFormat().resolvedOptions().locale,
        { weekday: "short", month: "short", day: "numeric" },
      ).format(date);
    } catch {
      return formatDateLabel(dateStr);
    }
  };

  // Get capacity level for a date
  const getCapacityLevel = (
    date: DeliveryDate,
  ): "available" | "limited" | "full" => {
    if (!date.available) return "full";
    if (date.slotCount <= 2) return "limited";
    return "available";
  };

  // Handle time slot selection
  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    if (selectedDate) {
      onSelectionChange?.({
        date: selectedDate,
        slotId: slot.id,
        timeLabel: slot.label,
        deliveryFee: slot.price,
      });

      // Auto-save to checkout attributes
      saveDeliverySelection(shopId, {
        date: selectedDate,
        slotId: slot.id,
        timeLabel: slot.label,
        deliveryFee: slot.price,
      }).catch((err) => {
        console.error("Failed to save selection:", err);
      });
    }
  };

  return (
    <div
      style={{
        ...(componentStyles.container as any),
        padding: spacing.lg,
        borderRadius: "8px",
      }}
    >
      {/* Header */}
      <h2
        style={{
          ...(componentStyles.sectionTitle as any),
          marginTop: 0,
          marginBottom: spacing.md,
          fontSize: "18px",
        }}
      >
        Delivery Details
      </h2>

      {/* Error message */}
      {error && (
        <div
          style={{
            ...(componentStyles.errorMessage as any),
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{error.message}</span>
          {error.retry && (
            <button
              onClick={error.retry}
              style={{
                background: "none",
                border: "none",
                color: colors.warning,
                textDecoration: "underline",
                cursor: "pointer",
                fontWeight: 500,
              }}
              aria-label="Retry loading delivery options"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Dates Section */}
      <div style={{ marginBottom: spacing.lg }}>
        <label style={componentStyles.label as any}>
          Select a delivery date
        </label>

        {loadingDates ? (
          <div
            style={{
              padding: spacing.lg,
              textAlign: "center",
              color: colors.neutral500,
            }}
          >
            <span style={componentStyles.loadingSpinner as any} />
            <span style={{ marginLeft: spacing.md }}>
              Loading available dates...
            </span>
          </div>
        ) : dates.length === 0 ? (
          <div
            style={{
              padding: spacing.lg,
              backgroundColor: "#fef3f2",
              color: colors.warning,
              borderRadius: "6px",
              border: `1px solid ${colors.warning}`,
            }}
          >
            No delivery dates available in your area.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: spacing.sm,
            }}
          >
            {dates.map((date) => {
              const isSelectable = isDateSelectable(date.date);
              const isBlackedOut = blackoutDates.includes(date.date);
              const capacityLevel = getCapacityLevel(date);

              return (
                <button
                  key={date.date}
                  onClick={() => handleDateSelect(date)}
                  disabled={!isSelectable || !date.available}
                  onKeyDown={(e) => {
                    // Keyboard navigation support
                    if (e.key === "Enter" || e.key === " ") {
                      handleDateSelect(date);
                    }
                  }}
                  style={{
                    ...(componentStyles.dateButton as any),
                    backgroundColor:
                      selectedDate === date.date
                        ? colors.primary
                        : !isSelectable
                          ? colors.disabled
                          : date.available
                            ? colors.neutral100
                            : colors.disabled,
                    borderColor:
                      selectedDate === date.date
                        ? colors.primary
                        : date.available && isSelectable
                          ? colors.neutral300
                          : colors.neutral300,
                    color:
                      selectedDate === date.date
                        ? colors.neutral100
                        : colors.neutral900,
                    fontWeight: selectedDate === date.date ? 600 : 400,
                    cursor:
                      isSelectable && date.available
                        ? "pointer"
                        : "not-allowed",
                    opacity: isSelectable && date.available ? 1 : 0.6,
                    transition: "all 0.2s ease",
                    position: "relative",
                  }}
                  aria-label={`${formatDateWithLocale(date.date)} - ${date.slotCount} slots - ${
                    isBlackedOut
                      ? "Blackout date"
                      : !isSelectable
                        ? "Not available yet"
                        : capacityLevel === "limited"
                          ? "Limited capacity"
                          : "Available"
                  }`}
                  aria-pressed={selectedDate === date.date}
                  aria-disabled={!isSelectable || !date.available}
                >
                  <div style={{ fontWeight: 600 }}>
                    {formatDateWithLocale(date.date)}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      marginTop: "4px",
                      opacity: 0.8,
                    }}
                  >
                    {isBlackedOut ? (
                      <span style={{ color: colors.warning }}>Holiday</span>
                    ) : capacityLevel === "limited" ? (
                      <span style={{ color: colors.warning }}>Limited</span>
                    ) : (
                      `${date.slotCount} ${date.slotCount === 1 ? "slot" : "slots"}`
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Time Slot Section */}
      {selectedDate && !loadingDates && (
        <TimeSlotSelector
          date={selectedDate}
          slots={slots}
          selectedSlotId={selectedSlot?.id || null}
          onSlotSelect={handleSlotSelect}
          loading={loadingSlots}
          error={error?.type === "fetch" ? error.message : undefined}
        />
      )}

      {/* Summary */}
      {selectedDate && selectedSlot && !loadingDates && !loadingSlots && (
        <div
          style={{
            marginTop: spacing.lg,
            padding: spacing.md,
            backgroundColor: colors.neutral200,
            borderRadius: "6px",
            borderLeft: `4px solid ${colors.success}`,
          }}
        >
          <div
            style={{
              fontWeight: 600,
              color: colors.success,
              marginBottom: spacing.xs,
            }}
          >
            Delivery Confirmed
          </div>
          <div
            style={{
              fontSize: "13px",
              color: colors.neutral700,
              lineHeight: "1.5",
            }}
          >
            <div>
              <strong>Date:</strong> {formatDateLabel(selectedDate)}
            </div>
            <div>
              <strong>Time:</strong> {selectedSlot.label}
            </div>
            <div>
              <strong>Fee:</strong> ${(selectedSlot.price / 100).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Capacity legend */}
      <div
        style={{
          marginTop: spacing.lg,
          padding: spacing.md,
          backgroundColor: colors.neutral200,
          borderRadius: "6px",
          fontSize: "12px",
        }}
      >
        <div style={{ marginBottom: spacing.sm, fontWeight: 500 }}>
          Availability Legend:
        </div>
        <div style={{ marginBottom: spacing.xs }}>
          <span style={{ color: colors.success }}>Available</span> - Plenty of
          slots
        </div>
        <div style={{ marginBottom: spacing.xs }}>
          <span style={{ color: colors.warning }}>Limited</span> - 2 or fewer
          slots remaining
        </div>
        <div>
          <span style={{ color: colors.warning }}>Holiday</span> - Blackout date
        </div>
      </div>

      {/* Help text */}
      <div
        style={{
          ...(componentStyles.helpText as any),
          marginTop: spacing.lg,
          fontSize: "12px",
          color: colors.neutral500,
        }}
      >
        You can change your delivery date and time at any point before checkout.
        Use arrow keys to navigate dates.
      </div>
    </div>
  );
}
