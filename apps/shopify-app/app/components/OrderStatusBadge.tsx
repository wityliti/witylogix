/**
 * OrderStatusBadge — Consistent status badge for order statuses.
 *
 * Maps order status values to Polaris Badge tones.
 * Used in order tables, order detail pages, and activity timelines.
 */

import { Badge } from "@shopify/polaris";
import type { BadgeProps } from "@shopify/polaris";

interface OrderStatusBadgeProps {
  status: string;
  size?: "small" | "medium";
}

const STATUS_CONFIG: Record<
  string,
  { label: string; tone?: BadgeProps["tone"] }
> = {
  PENDING: { label: "Pending", tone: "attention" },
  ACCEPTED: { label: "Accepted", tone: "info" },
  ASSIGNED: { label: "Assigned", tone: "info" },
  PICKED_UP: { label: "Picked Up", tone: "info" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", tone: "info" },
  ARRIVED: { label: "Arrived", tone: "success" },
  DELIVERED: { label: "Delivered", tone: "success" },
  FAILED: { label: "Failed", tone: "critical" },
  RETURNED: { label: "Returned", tone: "warning" },
  CANCELLED: { label: "Cancelled" },
};

export function OrderStatusBadge({
  status,
  size = "medium",
}: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status };

  return (
    <Badge size={size} tone={config.tone}>
      {config.label}
    </Badge>
  );
}
