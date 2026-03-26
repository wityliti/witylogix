/**
 * ShipmentStatusBadge — Consistent status badge for shipment statuses.
 *
 * Maps shipment status values to Polaris-compatible color tokens.
 * Used in shipment tables, shipment detail pages, and delivery tracking.
 */

interface ShipmentStatusBadgeProps {
  status: string;
  size?: "small" | "medium";
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bgColor: string; textColor: string }
> = {
  PENDING: {
    label: "Pending",
    bgColor: "#fff8e5",
    textColor: "#7a4c00",
  },
  PROCESSING: {
    label: "Processing",
    bgColor: "#e8f0fe",
    textColor: "#1a3a6e",
  },
  LABEL_CREATED: {
    label: "Label Created",
    bgColor: "#e1f3f6",
    textColor: "#004a5c",
  },
  PICKED_UP: {
    label: "Picked Up",
    bgColor: "#e0f0ff",
    textColor: "#003b73",
  },
  IN_TRANSIT: {
    label: "In Transit",
    bgColor: "#ede8ff",
    textColor: "#3d2e66",
  },
  OUT_FOR_DELIVERY: {
    label: "Out for Delivery",
    bgColor: "#e8f0fe",
    textColor: "#1a3a6e",
  },
  DELIVERED: {
    label: "Delivered",
    bgColor: "#ccf1e2",
    textColor: "#005c35",
  },
  ATTEMPTED: {
    label: "Attempted",
    bgColor: "#ffe5cc",
    textColor: "#8b4513",
  },
  FAILED: {
    label: "Failed",
    bgColor: "#fce5e5",
    textColor: "#8c0000",
  },
  RETURNED: {
    label: "Returned",
    bgColor: "#f5f0ff",
    textColor: "#4b2d8e",
  },
  CANCELLED: {
    label: "Cancelled",
    bgColor: "#f1f2f3",
    textColor: "#6d7175",
  },
};

export function ShipmentStatusBadge({
  status,
  size = "medium",
}: ShipmentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    bgColor: "#f1f2f3",
    textColor: "#6d7175",
  };

  const padding = size === "small" ? "2px 8px" : "4px 12px";
  const fontSize = size === "small" ? 11 : 12;

  return (
    <span
      style={{
        display: "inline-block",
        padding,
        fontSize,
        fontWeight: 600,
        lineHeight: 1.4,
        borderRadius: 20,
        backgroundColor: config.bgColor,
        color: config.textColor,
        whiteSpace: "nowrap",
      }}
    >
      {config.label}
    </span>
  );
}
