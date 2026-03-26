/**
 * WebhookEventPicker Component
 *
 * Reusable multi-select component for choosing webhook events.
 * Groups events by domain (Orders, Fulfillments, etc.) with select-all per group.
 *
 * Usage:
 * ```tsx
 * const [selected, setSelected] = useState<string[]>(['orders/create']);
 * <WebhookEventPicker selected={selected} onChange={setSelected} />
 * ```
 */

import { useState, useCallback } from "react";
import { Card, Text, Checkbox, Box } from "@shopify/polaris";

// ─── Types ────────────────────────────────────────────────

export interface WebhookEvent {
  id: string;
  name: string;
  description: string;
  domain: "Orders" | "Fulfillment" | "Driver" | "Billing" | "Workflow";
}

interface EventGroup {
  domain: WebhookEvent["domain"];
  events: WebhookEvent[];
}

// ─── Constants ─────────────────────────────────────────────

const ALL_WEBHOOK_EVENTS: WebhookEvent[] = [
  // Orders
  {
    id: "orders/create",
    name: "Order Created",
    description: "When a new order is placed in Shopify",
    domain: "Orders",
  },
  {
    id: "orders/updated",
    name: "Order Updated",
    description: "When an existing order is modified",
    domain: "Orders",
  },
  {
    id: "orders/cancelled",
    name: "Order Cancelled",
    description: "When an order is cancelled",
    domain: "Orders",
  },
  {
    id: "orders/deleted",
    name: "Order Deleted",
    description: "When an order is permanently deleted",
    domain: "Orders",
  },

  // Fulfillment
  {
    id: "orders/fulfilled",
    name: "Order Fulfilled",
    description: "When all items in an order are fulfilled",
    domain: "Fulfillment",
  },
  {
    id: "fulfillments/create",
    name: "Fulfillment Created",
    description: "When a fulfillment is created for an order",
    domain: "Fulfillment",
  },
  {
    id: "fulfillments/update",
    name: "Fulfillment Updated",
    description: "When a fulfillment status is updated",
    domain: "Fulfillment",
  },

  // Driver (hypothetical future events)
  {
    id: "driver/assigned",
    name: "Driver Assigned",
    description: "When a driver is assigned to a delivery",
    domain: "Driver",
  },
  {
    id: "driver/location_updated",
    name: "Driver Location Updated",
    description: "When driver location changes during delivery",
    domain: "Driver",
  },

  // Billing
  {
    id: "billing/charge_created",
    name: "Charge Created",
    description: "When a charge is created for a service",
    domain: "Billing",
  },
  {
    id: "billing/charge_refunded",
    name: "Charge Refunded",
    description: "When a charge is refunded",
    domain: "Billing",
  },

  // Workflow
  {
    id: "workflow/started",
    name: "Workflow Started",
    description: "When a workflow execution begins",
    domain: "Workflow",
  },
  {
    id: "workflow/completed",
    name: "Workflow Completed",
    description: "When a workflow execution finishes successfully",
    domain: "Workflow",
  },
  {
    id: "workflow/failed",
    name: "Workflow Failed",
    description: "When a workflow execution fails",
    domain: "Workflow",
  },
];

// ─── Component ─────────────────────────────────────────────

interface WebhookEventPickerProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export function WebhookEventPicker({
  selected,
  onChange,
  disabled = false,
}: WebhookEventPickerProps) {
  // Group events by domain
  const groups = groupEventsByDomain(ALL_WEBHOOK_EVENTS);

  // Track expanded/collapsed groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groups.map((g) => g.domain))
  );

  // Toggle group expansion
  const toggleGroup = useCallback((domain: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  }, []);

  // Handle event selection
  const handleEventChange = useCallback(
    (eventId: string, checked: boolean) => {
      if (checked) {
        onChange([...selected, eventId]);
      } else {
        onChange(selected.filter((id) => id !== eventId));
      }
    },
    [selected, onChange]
  );

  // Handle group select-all
  const handleGroupSelectAll = useCallback(
    (domain: string, checked: boolean) => {
      const group = groups.find((g) => g.domain === domain);
      if (!group) return;

      const groupEventIds = group.events.map((e) => e.id);

      if (checked) {
        // Add all events in group that aren't already selected
        const newSelected = [
          ...new Set([...selected, ...groupEventIds]),
        ];
        onChange(newSelected);
      } else {
        // Remove all events in group
        onChange(
          selected.filter((id) => !groupEventIds.includes(id))
        );
      }
    },
    [groups, selected, onChange]
  );

  return (
    <div>
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.domain);
        const groupEventIds = group.events.map((e) => e.id);
        const selectedInGroup = selected.filter((id) =>
          groupEventIds.includes(id)
        );
        const isAllSelected =
          selectedInGroup.length === group.events.length;
        const isPartiallySelected =
          selectedInGroup.length > 0 &&
          selectedInGroup.length < group.events.length;

        return (
          <Card key={group.domain} padding="400">
            {/* Group Header with Select All */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: isExpanded ? 16 : 0,
                cursor: "pointer",
              }}
              onClick={() => toggleGroup(group.domain)}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flex: 1,
                }}
              >
                <Checkbox
                  label=""
                  checked={
                    isPartiallySelected ? "indeterminate" : isAllSelected
                  }
                  onChange={(checked) =>
                    handleGroupSelectAll(group.domain, checked as boolean)
                  }
                  disabled={disabled}
                  onClick={(e) => e.stopPropagation()}
                />
                <div>
                  <Text as="span" variant="headingMd">
                    {group.domain}
                  </Text>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--p-color-text-subdued)",
                      marginTop: 4,
                    }}
                  >
                    {selectedInGroup.length} of {group.events.length} selected
                  </div>
                </div>
              </div>

              {/* Expand/Collapse Arrow */}
              <div
                style={{
                  transform: isExpanded
                    ? "rotate(0deg)"
                    : "rotate(-90deg)",
                  transition: "transform 0.2s",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg
                  viewBox="0 0 20 20"
                  width="20"
                  height="20"
                  style={{ fill: "currentColor" }}
                >
                  <path d="M7 8l3 3 3-3" stroke="currentColor" fill="none" />
                </svg>
              </div>
            </div>

            {/* Group Events */}
            {isExpanded && (
              <div style={{ marginTop: 12, paddingLeft: 32 }}>
                {group.events.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      marginBottom: 12,
                      paddingBottom: 12,
                      borderBottom:
                        "1px solid var(--p-color-border-subdued)",
                    }}
                  >
                    <Checkbox
                      label={event.name}
                      helpText={event.description}
                      checked={selected.includes(event.id)}
                      onChange={(checked) =>
                        handleEventChange(event.id, checked as boolean)
                      }
                      disabled={disabled}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─── Helper Functions ──────────────────────────────────────

function groupEventsByDomain(events: WebhookEvent[]): EventGroup[] {
  const domains: WebhookEvent["domain"][] = [
    "Orders",
    "Fulfillment",
    "Driver",
    "Billing",
    "Workflow",
  ];

  return domains
    .map((domain) => ({
      domain,
      events: events.filter((e) => e.domain === domain),
    }))
    .filter((group) => group.events.length > 0);
}
