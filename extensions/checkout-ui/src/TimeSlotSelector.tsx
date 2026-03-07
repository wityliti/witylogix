// @ts-nocheck
import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { TimeSlot } from './types';
import { groupSlotsByTime } from './api';
import { componentStyles, colors, spacing } from './styles';

interface TimeSlotSelectorProps {
  date: string;
  slots: TimeSlot[];
  selectedSlotId: string | null;
  onSlotSelect: (slot: TimeSlot) => void;
  loading?: boolean;
  error?: string;
}

/**
 * TimeSlotSelector component
 * Displays available time slots grouped by time of day (morning/afternoon/evening)
 * Shows capacity indicators and allows selection via radio-style buttons
 */
export function TimeSlotSelector({
  date,
  slots,
  selectedSlotId,
  onSlotSelect,
  loading = false,
  error
}: TimeSlotSelectorProps) {
  const [groupedSlots, setGroupedSlots] = useState<Record<string, TimeSlot[]>>({});

  useEffect(() => {
    const grouped = groupSlotsByTime(slots);
    setGroupedSlots(grouped);
  }, [slots]);

  const timeGroupLabels: Record<string, string> = {
    morning: '🌅 Morning',
    afternoon: '☀️ Afternoon',
    evening: '🌆 Evening'
  };

  const timeGroupOrder = ['morning', 'afternoon', 'evening'];

  return (
    <div style={{
      marginTop: spacing.lg,
      marginBottom: spacing.lg
    }}>
      <label style={componentStyles.label as any}>
        Select a time slot
      </label>

      {error && (
        <div style={componentStyles.errorMessage as any}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{
          padding: spacing.lg,
          textAlign: 'center',
          color: colors.neutral500
        }}>
          <span style={componentStyles.loadingSpinner as any} />
          <span style={{ marginLeft: spacing.md }}>Loading time slots...</span>
        </div>
      ) : slots.length === 0 ? (
        <div style={{
          padding: spacing.lg,
          textAlign: 'center',
          color: colors.neutral500,
          backgroundColor: colors.neutral200,
          borderRadius: '6px'
        }}>
          No time slots available for this date
        </div>
      ) : (
        timeGroupOrder.map((group) => {
          const groupSlots = groupedSlots[group];
          if (!groupSlots || groupSlots.length === 0) return null;

          return (
            <div key={group} style={{ marginBottom: spacing.lg }}>
              <h4 style={{
                fontSize: '12px',
                fontWeight: 600,
                color: colors.neutral600,
                textTransform: 'uppercase',
                marginBottom: spacing.md,
                marginTop: group === 'morning' ? 0 : spacing.lg
              }}>
                {timeGroupLabels[group]}
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {groupSlots.map((slot) => (
                  <label
                    key={slot.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: spacing.md,
                      marginBottom: 0,
                      borderRadius: '6px',
                      border: selectedSlotId === slot.id
                        ? `2px solid ${colors.primary}`
                        : `1px solid ${colors.neutral300}`,
                      backgroundColor: selectedSlotId === slot.id
                        ? colors.primaryLight
                        : colors.neutral100,
                      cursor: slot.available ? 'pointer' : 'not-allowed',
                      opacity: slot.available ? 1 : 0.5,
                      transition: 'all 0.2s ease'
                    } as any}
                  >
                    <input
                      type="radio"
                      name="timeSlot"
                      value={slot.id}
                      checked={selectedSlotId === slot.id}
                      onChange={() => slot.available && onSlotSelect(slot)}
                      disabled={!slot.available}
                      style={{
                        marginRight: spacing.md,
                        accentColor: colors.primary,
                        cursor: slot.available ? 'pointer' : 'not-allowed'
                      }}
                      aria-label={`${slot.label} - ${slot.slotsRemaining} slots remaining`}
                    />

                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: 500,
                        fontSize: '14px',
                        color: colors.neutral900
                      }}>
                        {slot.label}
                      </div>
                      {!slot.available && (
                        <div style={{
                          fontSize: '12px',
                          color: colors.warning,
                          marginTop: '2px'
                        }}>
                          Fully booked
                        </div>
                      )}
                    </div>

                    {slot.available && (
                      <div style={{
                        marginLeft: spacing.md,
                        padding: `${spacing.xs} ${spacing.sm}`,
                        backgroundColor: slot.slotsRemaining > 2
                          ? colors.success
                          : slot.slotsRemaining > 0
                          ? colors.warning
                          : 'transparent',
                        color: colors.neutral100,
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '4px',
                        minWidth: '80px',
                        textAlign: 'center'
                      }}>
                        {slot.slotsRemaining} {slot.slotsRemaining === 1 ? 'slot' : 'slots'}
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>
          );
        })
      )}

      {slots.length > 0 && !loading && (
        <div style={{
          marginTop: spacing.md,
          padding: spacing.sm,
          backgroundColor: colors.neutral200,
          borderRadius: '4px',
          fontSize: '12px',
          color: colors.neutral600
        }}>
          <span style={{ fontWeight: 500 }}>Delivery fee: </span>
          ${((slots[0]?.price || 0) / 100).toFixed(2)}
        </div>
      )}
    </div>
  );
}
