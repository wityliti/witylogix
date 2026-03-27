/**
 * ShipmentStatusBadge — Consistent status badge for shipment statuses.
 *
 * Maps shipment status values to Polaris Badge tones.
 * Used in shipment tables, shipment detail pages, and delivery tracking.
 */

import { Badge } from "@shopify/polaris";
import type { BadgeProps } from "@shopify/polaris";

interface ShipmentStatusBadgeProps {
  status: string;
  size?: "small" | "medium";
}

const STATUS_CONFIG: Record<string, { label: string; tone?: BadgeProps["tone"] }> = {
  PENDING: { label: "Pending", tone: "attention" },
  PROCESSING: { label: "Processing", tone: "info" },
  LABEL_CREATED: { label: "Label Created", tone: "info" },
  PICKED_UP: { label: "Picked Up", tone: "info" },
  IN_TRANSIT: { label: "In Transit", tone: "info" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "success" },
  ATTEMPTED: { label: "Attempted", tone: "warning" },
  FAILED: { label: "Failed", tone: "critical" },
  RETURNED: { label: "Returned", tone: "warning" },
  CANCELLED: { label: "Cancelled" },
};

export function ShipmentStatusBadge({
  status,
  size = "medium",
}: ShipmentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status };

  return (
    <Badge size={size} tone={config.tone}>
      {config.label}
    </Badge>
  );
}
