/**
 * Time Slot Selector Component
 * Grid-based time slot selection for WooCommerce checkout
 */

import { useMemo } from "@wordpress/element";
import type { SlotAvailability } from "../api/witylogix-api";

interface TimeSlotsProps {
  date: string;
  slots: SlotAvailability[];
  selectedSlotId?: string;
  onSlotSelect: (slot: SlotAvailability) => void;
  isLoading?: boolean;
}

/**
 * Group slots by time period
 */
function groupSlotsByTimeGroup(
  slots: SlotAvailability[],
): Record<string, SlotAvailability[]> {
  return slots.reduce(
    (acc, slot) => {
      if (!acc[slot.timeGroup]) {
        acc[slot.timeGroup] = [];
      }
      acc[slot.timeGroup].push(slot);
      return acc;
    },
    {} as Record<string, SlotAvailability[]>,
  );
}

/**
 * Get display order for time groups
 */
function getTimeGroupOrder(group: string): number {
  const order: Record<string, number> = {
    morning: 1,
    afternoon: 2,
    evening: 3,
  };
  return order[group] || 999;
}

/**
 * Get display label for time group
 */
function getTimeGroupLabel(group: string): string {
  const labels: Record<string, string> = {
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
  };
  return labels[group] || group;
}

/**
 * Time Slots Component
 */
export function TimeSlots({
  date,
  slots,
  selectedSlotId,
  onSlotSelect,
  isLoading = false,
}: TimeSlotsProps) {
  // Filter slots for selected date
  const dateSlots = useMemo(() => {
    return slots.filter((slot) => slot.date === date);
  }, [date, slots]);

  // Group and sort slots
  const groupedSlots = useMemo(() => {
    const grouped = groupSlotsByTimeGroup(dateSlots);
    const sorted = Object.entries(grouped).sort(
      ([groupA], [groupB]) =>
        getTimeGroupOrder(groupA) - getTimeGroupOrder(groupB),
    );
    return Object.fromEntries(sorted);
  }, [dateSlots]);

  if (dateSlots.length === 0) {
    return (
      <div className="witylogix-time-slots witylogix-time-slots--empty">
        <p className="time-slots-empty-message">
          No available slots for this date
        </p>
      </div>
    );
  }

  return (
    <div className="witylogix-time-slots">
      {Object.entries(groupedSlots).map(([timeGroup, groupSlots]) => (
        <div key={timeGroup} className="time-slots-group">
          <h4 className="time-slots-group-title">
            {getTimeGroupLabel(timeGroup)}
          </h4>

          <div className="time-slots-grid">
            {groupSlots.map((slot) => (
              <button
                key={slot.id}
                onClick={() => onSlotSelect(slot)}
                className={`
                  time-slot-card
                  ${!slot.available ? "time-slot-card--disabled" : ""}
                  ${selectedSlotId === slot.id ? "time-slot-card--selected" : ""}
                `}
                disabled={!slot.available || isLoading}
                aria-label={`${slot.label}, ${slot.capacity - slot.reserved} spots available`}
                aria-pressed={selectedSlotId === slot.id}
              >
                <div className="time-slot-time">
                  <span className="time-slot-start">{slot.startTime}</span>
                  <span className="time-slot-separator">–</span>
                  <span className="time-slot-end">{slot.endTime}</span>
                </div>

                <div className="time-slot-label">{slot.label}</div>

                <div className="time-slot-capacity">
                  <div className="capacity-bar">
                    <div
                      className="capacity-used"
                      style={{
                        width: `${(slot.reserved / slot.capacity) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="capacity-text">
                    {slot.capacity - slot.reserved} of {slot.capacity}
                  </span>
                </div>

                {slot.price > 0 && (
                  <div className="time-slot-price">
                    +${(slot.price / 100).toFixed(2)}
                  </div>
                )}

                {!slot.available && (
                  <div className="time-slot-badge-unavailable">Full</div>
                )}

                {selectedSlotId === slot.id && (
                  <div className="time-slot-badge-selected">✓</div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
