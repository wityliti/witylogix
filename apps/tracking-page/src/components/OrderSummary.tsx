import type { TrackingResponse } from "../types";
import { getStatusLabel } from "../lib/utils";

interface OrderSummaryProps {
  response: TrackingResponse;
}

export function OrderSummary({ response }: OrderSummaryProps) {
  const deliveryAddress = [
    response.deliveryAddress.line1,
    response.deliveryAddress.city,
    response.deliveryAddress.province,
    response.deliveryAddress.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "12px",
        padding: "20px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
      }}
    >
      <h2
        style={{
          fontSize: "16px",
          fontWeight: "600",
          color: "#1f2937",
          margin: "0 0 20px 0",
        }}
      >
        Order Details
      </h2>

      {response.orderNumber && (
        <div style={{ marginBottom: "16px" }}>
          <p
            style={{
              fontSize: "12px",
              color: "#6b7280",
              margin: "0 0 4px 0",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Order Number
          </p>
          <p
            style={{
              fontSize: "14px",
              fontWeight: "500",
              color: "#1f2937",
              margin: "0",
              fontFamily: "monospace",
            }}
          >
            {response.orderNumber}
          </p>
        </div>
      )}

      <div style={{ marginBottom: "16px" }}>
        <p
          style={{
            fontSize: "12px",
            color: "#6b7280",
            margin: "0 0 4px 0",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Current Status
        </p>
        <div
          style={{
            display: "inline-block",
            backgroundColor:
              response.status === "DELIVERED" ? "#008060" : "#005bd3",
            color: "white",
            padding: "6px 12px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: "600",
          }}
        >
          {getStatusLabel(response.status)}
        </div>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <p
          style={{
            fontSize: "12px",
            color: "#6b7280",
            margin: "0 0 4px 0",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Delivery Address
        </p>
        <p
          style={{
            fontSize: "14px",
            color: "#1f2937",
            margin: "0",
            lineHeight: "1.5",
          }}
        >
          {deliveryAddress}
        </p>
      </div>

      {response.shop.name && (
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
          <p
            style={{
              fontSize: "12px",
              color: "#6b7280",
              margin: "0 0 4px 0",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Merchant
          </p>
          <p style={{ fontSize: "14px", color: "#1f2937", margin: "0" }}>
            {response.shop.name}
          </p>
        </div>
      )}
    </div>
  );
}
