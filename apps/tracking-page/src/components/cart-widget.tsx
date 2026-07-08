"use client";

import { useState } from "react";
import { DatePicker } from "./date-picker";
import { TimeSlotSelector, type TimeSlot } from "./time-slot-selector";
import { RateCalculator, type ShippingRate } from "./rate-calculator";

interface CartWidgetProps {
  availableDates?: string[];
  blockedDates?: string[];
  timeSlots?: TimeSlot[];
  shippingRates?: ShippingRate[];
  currency?: string;
  theme?: "light" | "dark";
  onComplete?: (config: CartWidgetConfig) => void;
}

export interface CartWidgetConfig {
  selectedDate: string;
  selectedSlot: string;
  selectedRate: string;
  totalPrice: number;
}

type Step = "date" | "time" | "rate" | "complete";

export function CartWidget({
  availableDates,
  blockedDates,
  timeSlots,
  shippingRates,
  currency = "USD",
  theme = "light",
  onComplete,
}: CartWidgetProps) {
  const [currentStep, setCurrentStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [selectedRate, setSelectedRate] = useState<string>("");
  const [totalPrice, setTotalPrice] = useState<number>(0);

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
  const successColor = "var(--wl-widget-success, #008060)";
  const lightPrimary = isDarkTheme ? "#3d3d5c" : "#f0eaff";

  // Fallback demo values used when the embedder does not supply prop data
  const resolvedAvailableDates = availableDates || [
    new Date(Date.now() + 86400000).toISOString().split("T")[0],
    new Date(Date.now() + 172800000).toISOString().split("T")[0],
    new Date(Date.now() + 259200000).toISOString().split("T")[0],
    new Date(Date.now() + 345600000).toISOString().split("T")[0],
    new Date(Date.now() + 432000000).toISOString().split("T")[0],
  ];

  const resolvedBlockedDates = blockedDates || [];

  const resolvedTimeSlots: TimeSlot[] = timeSlots || [
    {
      id: "morning",
      start: "08:00",
      end: "12:00",
      available: 8,
      capacity: 10,
      isExpress: true,
    },
    {
      id: "afternoon",
      start: "12:00",
      end: "16:00",
      available: 5,
      capacity: 10,
      isExpress: false,
    },
    {
      id: "evening",
      start: "16:00",
      end: "20:00",
      available: 12,
      capacity: 15,
      isExpress: false,
    },
  ];

  const resolvedShippingRates: ShippingRate[] = shippingRates || [
    {
      id: "economy",
      name: "Economy",
      description: "Standard delivery",
      basePrice: 5.99,
      pricePerKg: 0.5,
      deliveryDays: 5,
      guaranteedDelivery: false,
      features: ["Tracking", "Insurance"],
    },
    {
      id: "standard",
      name: "Standard",
      description: "Reliable & affordable",
      basePrice: 9.99,
      pricePerKg: 0.8,
      deliveryDays: 3,
      guaranteedDelivery: true,
      features: ["Tracking", "Insurance", "Signature"],
    },
    {
      id: "express",
      name: "Express",
      description: "Fastest delivery",
      basePrice: 19.99,
      pricePerKg: 1.2,
      deliveryDays: 1,
      guaranteedDelivery: true,
      features: ["Tracking", "Insurance", "Signature", "Priority"],
    },
  ];

  const steps: { id: Step; label: string; icon: string }[] = [
    { id: "date", label: "Date", icon: "📅" },
    { id: "time", label: "Time", icon: "🕐" },
    { id: "rate", label: "Shipping", icon: "🚚" },
    { id: "complete", label: "Confirm", icon: "✓" },
  ];

  const canProceedToTime = !!selectedDate;
  const canProceedToRate = !!selectedDate && !!selectedSlot;
  const canProceedToComplete =
    !!selectedDate && !!selectedSlot && !!selectedRate;

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setCurrentStep("time");
  };

  const handleSlotSelect = (slotId: string) => {
    setSelectedSlot(slotId);
    setCurrentStep("rate");
  };

  const handleRateSelect = (rateId: string, price: number) => {
    setSelectedRate(rateId);
    setTotalPrice(price);
    setCurrentStep("complete");
  };

  const handleComplete = () => {
    if (onComplete && canProceedToComplete) {
      onComplete({
        selectedDate,
        selectedSlot,
        selectedRate,
        totalPrice,
      });
    }
  };

  const getStepStatus = (stepId: Step): "pending" | "active" | "completed" => {
    const stepOrder = steps.map((s) => s.id);
    const currentStepIndex = stepOrder.indexOf(currentStep);
    const thisStepIndex = stepOrder.indexOf(stepId);

    if (thisStepIndex < currentStepIndex) return "completed";
    if (thisStepIndex === currentStepIndex) return "active";
    return "pending";
  };

  return (
    <div
      style={{
        backgroundColor: bgColor,
        borderRadius: "16px",
        overflow: "hidden",
        border: `1px solid ${borderColor}`,
        maxWidth: "100%",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Progress Indicator */}
      <div
        style={{
          backgroundColor: secondaryColor,
          padding: "24px",
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          {steps.map((step, index) => {
            const status = getStepStatus(step.id);
            const isCompleted = status === "completed";
            const isActive = status === "active";

            return (
              <div
                key={step.id}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {/* Step circle */}
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor:
                      isCompleted || isActive ? primaryColor : secondaryColor,
                    color: isCompleted || isActive ? "#ffffff" : textColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    fontWeight: "600",
                    border: isActive ? `2px solid ${primaryColor}` : "none",
                    boxShadow: isActive
                      ? `0 0 0 4px ${primaryColor}30`
                      : "none",
                    transition: "all 0.3s ease",
                  }}
                >
                  {isCompleted ? "✓" : step.icon}
                </div>

                {/* Step label */}
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "500",
                    color: isActive
                      ? primaryColor
                      : isDarkTheme
                        ? "#999999"
                        : "#6b7280",
                    textAlign: "center",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {step.label}
                </span>

                {/* Connecting line */}
                {index < steps.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      width: "100%",
                      height: "2px",
                      backgroundColor: isCompleted ? primaryColor : borderColor,
                      top: "20px",
                      left: "50%",
                      zIndex: -1,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: "100%",
            height: "4px",
            borderRadius: "2px",
            backgroundColor: secondaryColor,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${(steps.findIndex((s) => s.id === currentStep) / (steps.length - 1)) * 100}%`,
              backgroundColor: primaryColor,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* Content Area */}
      <div
        style={{
          padding: "32px 24px",
          minHeight: "400px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* Step: Date */}
        {currentStep === "date" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <DatePicker
              availableDates={resolvedAvailableDates}
              blockedDates={resolvedBlockedDates}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              theme={theme}
            />
          </div>
        )}

        {/* Step: Time */}
        {currentStep === "time" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <TimeSlotSelector
              slots={resolvedTimeSlots}
              selectedSlot={selectedSlot}
              onSlotSelect={handleSlotSelect}
              theme={theme}
            />
          </div>
        )}

        {/* Step: Rate */}
        {currentStep === "rate" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <RateCalculator
              rates={resolvedShippingRates}
              onRateSelect={handleRateSelect}
              currency={currency}
              theme={theme}
            />
          </div>
        )}

        {/* Step: Complete */}
        {currentStep === "complete" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              {/* Success Icon */}
              <div
                style={{
                  fontSize: "64px",
                  marginBottom: "20px",
                  animation: "scaleIn 0.4s ease",
                }}
              >
                ✓
              </div>

              <h2
                style={{
                  margin: "0 0 12px 0",
                  fontSize: "24px",
                  fontWeight: "700",
                  color: successColor,
                }}
              >
                Order Confirmed
              </h2>

              <p
                style={{
                  margin: "0 0 32px 0",
                  fontSize: "14px",
                  color: isDarkTheme ? "#999999" : "#6b7280",
                }}
              >
                Your delivery details have been set
              </p>

              {/* Order Summary */}
              <div
                style={{
                  backgroundColor: lightPrimary,
                  borderRadius: "10px",
                  padding: "20px",
                  marginBottom: "24px",
                  textAlign: "left",
                  border: `1px solid ${primaryColor}30`,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: primaryColor,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      📅 Delivery Date
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "16px",
                        fontWeight: "600",
                        color: textColor,
                      }}
                    >
                      {new Date(selectedDate).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  <div>
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: primaryColor,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      🕐 Time Window
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "16px",
                        fontWeight: "600",
                        color: textColor,
                      }}
                    >
                      {
                        resolvedTimeSlots.find((s) => s.id === selectedSlot)
                          ?.start
                      }{" "}
                      –{" "}
                      {
                        resolvedTimeSlots.find((s) => s.id === selectedSlot)
                          ?.end
                      }
                    </p>
                  </div>

                  <div>
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: primaryColor,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      🚚 Shipping Method
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "16px",
                        fontWeight: "600",
                        color: textColor,
                      }}
                    >
                      {
                        resolvedShippingRates.find((r) => r.id === selectedRate)
                          ?.name
                      }
                    </p>
                  </div>

                  <div>
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: primaryColor,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      💵 Total Cost
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "16px",
                        fontWeight: "700",
                        color: primaryColor,
                      }}
                    >
                      ${totalPrice.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "center",
                }}
              >
                <button
                  onClick={() => {
                    setCurrentStep("date");
                    setSelectedDate("");
                    setSelectedSlot("");
                    setSelectedRate("");
                  }}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "8px",
                    border: `1px solid ${primaryColor}`,
                    backgroundColor: "transparent",
                    color: primaryColor,
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.backgroundColor =
                      lightPrimary;
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.backgroundColor =
                      "transparent";
                  }}
                >
                  Edit Selection
                </button>

                <button
                  onClick={handleComplete}
                  style={{
                    padding: "12px 32px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: successColor,
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.opacity = "0.9";
                    (e.target as HTMLElement).style.transform =
                      "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.opacity = "1";
                    (e.target as HTMLElement).style.transform = "translateY(0)";
                  }}
                >
                  Complete Order
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons (for steps before completion) */}
      {currentStep !== "complete" && (
        <div
          style={{
            padding: "16px 24px",
            borderTop: `1px solid ${borderColor}`,
            backgroundColor: secondaryColor,
            display: "flex",
            gap: "12px",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => {
              const stepOrder = steps.map((s) => s.id);
              const currentIndex = stepOrder.indexOf(currentStep);
              if (currentIndex > 0) {
                setCurrentStep(stepOrder[currentIndex - 1] as Step);
              }
            }}
            disabled={currentStep === "date"}
            style={{
              padding: "10px 20px",
              borderRadius: "6px",
              border: `1px solid ${borderColor}`,
              backgroundColor: "transparent",
              color: textColor,
              fontSize: "14px",
              fontWeight: "500",
              cursor: currentStep === "date" ? "not-allowed" : "pointer",
              opacity: currentStep === "date" ? 0.5 : 1,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (currentStep !== "date") {
                (e.target as HTMLElement).style.backgroundColor = bgColor;
              }
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = "transparent";
            }}
          >
            ← Back
          </button>

          <button
            onClick={() => {
              const stepOrder = steps.map((s) => s.id);
              const currentIndex = stepOrder.indexOf(currentStep);
              if (
                currentIndex < stepOrder.length - 1 &&
                ((currentStep === "date" && canProceedToTime) ||
                  (currentStep === "time" && canProceedToRate) ||
                  (currentStep === "rate" && canProceedToComplete))
              ) {
                setCurrentStep(stepOrder[currentIndex + 1] as Step);
              }
            }}
            disabled={
              (currentStep === "date" && !canProceedToTime) ||
              (currentStep === "time" && !canProceedToRate) ||
              (currentStep === "rate" && !canProceedToComplete)
            }
            style={{
              padding: "10px 20px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: primaryColor,
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: "500",
              cursor:
                (currentStep === "date" && !canProceedToTime) ||
                (currentStep === "time" && !canProceedToRate) ||
                (currentStep === "rate" && !canProceedToComplete)
                  ? "not-allowed"
                  : "pointer",
              opacity:
                (currentStep === "date" && !canProceedToTime) ||
                (currentStep === "time" && !canProceedToRate) ||
                (currentStep === "rate" && !canProceedToComplete)
                  ? 0.5
                  : 1,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              const isDisabled =
                (currentStep === "date" && !canProceedToTime) ||
                (currentStep === "time" && !canProceedToRate) ||
                (currentStep === "rate" && !canProceedToComplete);
              if (!isDisabled) {
                (e.target as HTMLElement).style.opacity = "0.9";
                (e.target as HTMLElement).style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.opacity = "1";
              (e.target as HTMLElement).style.transform = "translateY(0)";
            }}
          >
            Next →
          </button>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
