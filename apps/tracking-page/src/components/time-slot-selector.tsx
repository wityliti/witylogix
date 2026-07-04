"use client";

import { useState } from "react";

export interface TimeSlot {
  id: string;
  start: string; // HH:mm format
  end: string; // HH:mm format
  available: number;
  capacity: number;
  isExpress?: boolean;
}

interface TimeSlotSelectorProps {
  slots: TimeSlot[];
  selectedSlot?: string;
  onSlotSelect: (slotId: string) => void;
  theme?: "light" | "dark";
}

export function TimeSlotSelector({
  slots,
  selectedSlot,
  onSlotSelect,
  theme = "light",
}: TimeSlotSelectorProps) {
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

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
  const warningTextColor = isDarkTheme ? "#FFD700" : "#856404";
  const successColor = "var(--wl-widget-success, #008060)";

  const getCapacityPercentage = (slot: TimeSlot) => {
    return Math.round((slot.available / slot.capacity) * 100);
  };

  const getCapacityLabel = (slot: TimeSlot) => {
    const percentage = getCapacityPercentage(slot);
    if (percentage > 50) return "Plenty available";
    if (percentage > 20) return "Limited spots";
    return "Almost full";
  };

  const getCapacityColor = (slot: TimeSlot) => {
    const percentage = getCapacityPercentage(slot);
    if (percentage > 50) return successColor;
    if (percentage > 20) return warningTextColor;
    return "#dc2626";
  };

  return (
    <div
      style={{
        backgroundColor: bgColor,
        borderRadius: "12px",
        padding: "24px",
        border: `1px solid ${borderColor}`,
        maxWidth: "500px",
        margin: "0 auto",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: "600",
            color: textColor,
            marginBottom: "8px",
          }}
        >
          Select Delivery Time
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            color: isDarkTheme ? "#999999" : "#6b7280",
          }}
        >
          Choose your preferred time window
        </p>
      </div>

      {/* Slots list */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        {slots.length === 0 ? (
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              color: isDarkTheme ? "#999999" : "#6b7280",
              fontSize: "14px",
            }}
          >
            No time slots available for this date
          </div>
        ) : (
          slots.map((slot) => {
            const isSelected = selectedSlot === slot.id;
            const isFull = slot.available === 0;
            const isHovered = hoveredSlot === slot.id;

            return (
              <button
                key={slot.id}
                onClick={() => !isFull && onSlotSelect(slot.id)}
                style={{
                  background: "none",
                  border: isSelected
                    ? `2px solid ${primaryColor}`
                    : `1px solid ${borderColor}`,
                  borderRadius: "10px",
                  padding: "16px",
                  cursor: isFull ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  backgroundColor: isSelected
                    ? `${primaryColor}10`
                    : isHovered && !isFull
                      ? secondaryColor
                      : bgColor,
                  transform:
                    !isFull && isHovered ? "translateY(-2px)" : "translateY(0)",
                  boxShadow:
                    !isFull && isHovered
                      ? `0 4px 12px ${primaryColor}20`
                      : isSelected
                        ? `0 0 0 3px ${primaryColor}30`
                        : "none",
                }}
                onMouseEnter={() => setHoveredSlot(slot.id)}
                onMouseLeave={() => setHoveredSlot(null)}
                disabled={isFull}
                aria-label={`Time slot ${slot.start} to ${slot.end}${slot.isExpress ? ", Express" : ""}`}
                aria-pressed={isSelected}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      🕐
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: "600",
                          color: isSelected ? primaryColor : textColor,
                          margin: 0,
                        }}
                      >
                        {slot.start} – {slot.end}
                      </div>
                      <p
                        style={{
                          margin: "4px 0 0 0",
                          fontSize: "13px",
                          color: isDarkTheme ? "#999999" : "#6b7280",
                        }}
                      >
                        {slot.available} of {slot.capacity} slots
                      </p>
                    </div>
                  </div>

                  {/* Badge area */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      alignItems: "flex-end",
                    }}
                  >
                    {slot.isExpress && (
                      <div
                        style={{
                          backgroundColor: primaryColor,
                          color: "#ffffff",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "600",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        ⚡ Express
                      </div>
                    )}
                    {isSelected && (
                      <div
                        style={{
                          backgroundColor: successColor,
                          color: "#ffffff",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "600",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        ✓ Selected
                      </div>
                    )}
                  </div>
                </div>

                {/* Capacity bar */}
                <div
                  style={{
                    width: "100%",
                    height: "6px",
                    borderRadius: "3px",
                    backgroundColor: isDarkTheme ? "#444444" : "#e5e7eb",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${getCapacityPercentage(slot)}%`,
                      backgroundColor: getCapacityColor(slot),
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                {/* Capacity label */}
                <p
                  style={{
                    margin: "8px 0 0 0",
                    fontSize: "12px",
                    color: getCapacityColor(slot),
                    fontWeight: "500",
                  }}
                >
                  {isFull ? "❌ Fully booked" : getCapacityLabel(slot)}
                </p>
              </button>
            );
          })
        )}
      </div>

      {/* Confirmation message */}
      {selectedSlot && (
        <div
          style={{
            padding: "16px",
            backgroundColor: `${successColor}15`,
            border: `1px solid ${successColor}30`,
            borderRadius: "8px",
            color: successColor,
            fontSize: "14px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "18px" }}>✓</span>
          <span>
            Time slot confirmed:{" "}
            <strong>{slots.find((s) => s.id === selectedSlot)?.start}</strong>
          </span>
        </div>
      )}

      {/* Info box */}
      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          backgroundColor: secondaryColor,
          borderRadius: "8px",
          fontSize: "12px",
          color: isDarkTheme ? "#cccccc" : "#6b7280",
          lineHeight: "1.6",
        }}
      >
        <strong style={{ color: textColor }}>ℹ️ Tip:</strong> Express slots
        guarantee same-day delivery with priority handling
      </div>
    </div>
  );
}
