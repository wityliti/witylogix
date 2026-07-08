// @ts-nocheck

import { h, Fragment } from "preact";
import { useState, useEffect } from "preact/hooks";
import { useTheme, useExtensionApi } from "@witylogix/extension-core/hooks";
import {
  getAvailableDrivers,
  getDeliverySlots,
  assignDelivery,
  formatDateLabel,
  formatTime,
  getZoneIdFromAddress,
} from "./api";
import { createStyles } from "./styles";
import type { POSOrder, POSDriver, DeliverySlot } from "./types";

interface DeliveryAssignmentProps {
  order: POSOrder;
  onAssignmentComplete?: (orderId: string) => void;
}

/**
 * Delivery Assignment Component
 *
 * Displays selected order details and allows:
 * - Selection of available drivers
 * - Selection of delivery date
 * - Selection of delivery time slot
 * - Assignment and label printing
 *
 * Uses postMessage RPC to communicate with POS host for printing
 */
export function DeliveryAssignment({
  order,
  onAssignmentComplete,
}: DeliveryAssignmentProps) {
  const tokens = useTheme();
  const styles = createStyles(tokens);
  const api = useExtensionApi();

  const [drivers, setDrivers] = useState<POSDriver[]>([]);
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<DeliverySlot | null>(null);
  const [zoneId, setZoneId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize: fetch zone ID and available drivers
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get zone from postal code
        const zone = await getZoneIdFromAddress(
          order.deliveryAddress.postalCode,
        );
        setZoneId(zone);

        // Fetch drivers for this zone
        const availableDrivers = await getAvailableDrivers(zone);
        setDrivers(availableDrivers);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to load drivers"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [order]);

  // Fetch time slots when date changes
  useEffect(() => {
    if (!selectedDate || !zoneId) {
      setSlots([]);
      return;
    }

    const fetchSlots = async () => {
      try {
        setError(null);
        const availableSlots = await getDeliverySlots(zoneId, selectedDate);
        setSlots(availableSlots);
        setSelectedSlot(null);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to load time slots"),
        );
        setSlots([]);
      }
    };

    fetchSlots();
  }, [selectedDate, zoneId]);

  // Handle assignment
  const handleAssign = async () => {
    if (!selectedDriverId || !selectedSlot) {
      setError(new Error("Please select a driver and time slot"));
      return;
    }

    try {
      setIsAssigning(true);
      setError(null);

      // Assign delivery
      const assignment = await assignDelivery(
        order.id,
        selectedDriverId,
        selectedSlot.id,
      );

      // Send print request to POS host via postMessage
      try {
        const result = await api.invoke("printDeliveryLabel", {
          orderId: order.id,
          assignmentId: assignment.id,
          driverId: selectedDriverId,
          deliveryDate: selectedDate,
          deliverySlot: selectedSlot.label,
        });
        console.log("[DeliveryAssignment] Print result:", result);
      } catch (printError) {
        console.error("[DeliveryAssignment] Print failed:", printError);
        // Continue anyway - assignment was successful
      }

      setSuccess(true);
      onAssignmentComplete?.(order.id);

      // Reset form after 2 seconds
      setTimeout(() => {
        setSuccess(false);
        setSelectedDriverId("");
        setSelectedDate("");
        setSelectedSlot(null);
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to assign delivery"),
      );
    } finally {
      setIsAssigning(false);
    }
  };

  // Calculate estimated delivery date
  const getEstimatedDelivery = (slot: DeliverySlot) => {
    const date = new Date(slot.date + "T" + slot.endTime);
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get available dates (today + next 7 days)
  const getAvailableDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split("T")[0]);
    }
    return dates;
  };

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

  return h(
    "div",
    { style: styles.section },
    h("h2", { style: styles.sectionTitle }, "Delivery Assignment"),

    // Order summary
    h(
      "div",
      { style: styles.orderSummaryCard },
      h(
        "div",
        null,
        h("p", { style: { ...styles.label, marginBottom: "4px" } }, "Order"),
        h(
          "p",
          { style: { ...styles.orderNumber, marginBottom: "12px" } },
          `Order ${order.orderNumber}`,
        ),
        h(
          "p",
          { style: { ...styles.label, marginBottom: "4px" } },
          "Delivery Address",
        ),
        h(
          "div",
          { style: styles.addressBlock },
          order.deliveryAddress.street1,
          order.deliveryAddress.street2 && h("br", null),
          order.deliveryAddress.street2 && order.deliveryAddress.street2,
          h("br", null),
          `${order.deliveryAddress.city}, ${order.deliveryAddress.state} ${order.deliveryAddress.postalCode}`,
        ),
      ),
    ),

    error &&
      h("div", { style: styles.errorMessage }, `Error: ${error.message}`),

    success &&
      h(
        "div",
        { style: styles.successMessage },
        "Delivery assigned successfully! Label printing requested.",
      ),

    // Driver selection
    h(
      "div",
      { style: styles.formGroup },
      h("label", { style: styles.label }, "Select Driver"),
      h(
        "select",
        {
          value: selectedDriverId,
          onChange: (e) =>
            setSelectedDriverId((e.target as HTMLSelectElement).value),
          style: styles.select,
          disabled: isLoading || isAssigning,
        },
        h("option", { value: "" }, "Choose a driver..."),
        drivers.map((driver) =>
          h(
            "option",
            { key: driver.id, value: driver.id },
            `${driver.name} (${driver.currentOrders} orders, ${driver.status})`,
          ),
        ),
      ),
      selectedDriver &&
        h(
          "p",
          { style: { ...styles.helpText, marginTop: "8px" } },
          selectedDriver.rating &&
            `Rating: ${selectedDriver.rating.toFixed(1)}/5.0`,
        ),
    ),

    // Date selection
    h(
      "div",
      { style: styles.formGroup },
      h("label", { style: styles.label }, "Delivery Date"),
      h(
        "div",
        {
          style: { display: "flex", gap: tokens.spacing[2], flexWrap: "wrap" },
        },
        getAvailableDates().map((date) =>
          h(
            "button",
            {
              key: date,
              onClick: () => setSelectedDate(date),
              style: {
                ...styles.button,
                ...(selectedDate === date
                  ? styles.buttonPrimary
                  : styles.buttonSecondary),
                flex: "0 1 calc(33.333% - 8px)",
                marginBottom: "8px",
              },
              disabled: isLoading || isAssigning,
            },
            formatDateLabel(date),
          ),
        ),
      ),
    ),

    // Time slot selection
    selectedDate &&
      h(
        "div",
        { style: styles.formGroup },
        h("label", { style: styles.label }, "Time Slot"),
        h(
          "div",
          { style: styles.resultsList },
          slots.length > 0
            ? slots.map((slot) =>
                h(
                  "div",
                  {
                    key: slot.id,
                    onClick: () =>
                      setSelectedSlot(
                        selectedSlot?.id === slot.id ? null : slot,
                      ),
                    style: {
                      ...styles.resultItem,
                      cursor: "pointer",
                      backgroundColor:
                        selectedSlot?.id === slot.id
                          ? tokens.colors.primary[600]
                          : tokens.colors.background.surface,
                      color:
                        selectedSlot?.id === slot.id
                          ? tokens.colors.text.inverse
                          : tokens.colors.text.primary,
                    },
                  },
                  h(
                    "div",
                    {
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "4px",
                      },
                    },
                    h(
                      "span",
                      {
                        style: { fontWeight: tokens.typography.weights.medium },
                      },
                      slot.label,
                    ),
                    h("span", null, `${slot.slotsRemaining} slots`),
                  ),
                ),
              )
            : h(
                "div",
                { style: styles.emptyState },
                "No available slots for this date",
              ),
        ),
      ),

    // Estimated delivery time
    selectedSlot &&
      h(
        "div",
        {
          style: {
            ...styles.formGroup,
            padding: tokens.spacing[4],
            backgroundColor: tokens.colors.info.bg,
            borderRadius: tokens.radii.md,
          },
        },
        h(
          "p",
          { style: { ...styles.label, marginBottom: "4px" } },
          "Estimated Delivery",
        ),
        h(
          "p",
          { style: styles.orderNumber },
          getEstimatedDelivery(selectedSlot),
        ),
      ),

    // Assign button
    h(
      "div",
      {
        style: {
          display: "flex",
          gap: tokens.spacing[3],
          marginTop: tokens.spacing[6],
        },
      },
      h(
        "button",
        {
          onClick: handleAssign,
          style: {
            ...styles.button,
            ...styles.buttonPrimary,
            flex: 1,
            fontSize: tokens.typography.sizes.base,
          },
          disabled:
            !selectedDriverId || !selectedSlot || isAssigning || isLoading,
        },
        isAssigning
          ? h(
              Fragment,
              null,
              h("div", {
                style: { ...styles.spinner, marginRight: tokens.spacing[2] },
              }),
              "Assigning...",
            )
          : "Assign & Print Label",
      ),
    ),
  );
}
