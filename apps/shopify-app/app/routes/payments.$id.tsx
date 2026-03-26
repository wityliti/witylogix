/**
 * Payment Detail — Payment transaction detail page with status management.
 *
 * Features:
 *   - Payment info card: full ID, type, method, amount, currency, status with timeline
 *   - Status transition buttons (based on valid transitions)
 *   - Related shipment link (if shipmentId exists)
 *   - Provider transaction reference
 *   - Metadata display (JSON pretty-printed)
 *   - Refund button (only for COMPLETED payments)
 *   - Back to payments link
 *
 * Loader fetches single payment with relations from API.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, Form, useActionData } from "react-router";
import { useState } from "react";
import { createApiClient } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface PaymentStatusEvent {
  status: string;
  timestamp: string;
}

interface Payment {
  id: string;
  type: "CHARGE" | "COD_COLLECTION" | "REFUND" | "ADJUSTMENT";
  method: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED";
  providerTransactionId: string | null;
  shipmentId: string | null;
  customerId: string | null;
  metadata: Record<string, unknown> | null;
  statusHistory: PaymentStatusEvent[];
  createdAt: string;
  updatedAt: string;
}

interface PaymentDetailData {
  payment: Payment;
}
// ─── Loader ────────────────────────────────────────────────

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const client = createApiClient(admin.graphql);

  const paymentId = params.id;
  if (!paymentId) {
    throw new Error("Payment ID not found");
  }

  try {
    const response = await client.get<{ data: PaymentDetailData }>(
      `/api/v4/payments/${paymentId}`
    );

    return response;
  } catch (error) {
    console.error("Failed to fetch payment:", error);
    throw new Error("Payment not found");
  }
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return null;
  }

  const { admin } = await authenticate.admin(request);
  const client = createApiClient(admin.graphql);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const paymentId = params.id;

  if (!paymentId) {
    return { success: false, error: "Payment ID not found" };
  }

  if (intent === "update-status") {
    const newStatus = formData.get("newStatus");
    try {
      await client.patch(`/api/v4/payments/${paymentId}`, {
        status: newStatus,
      });
      return { success: true, message: "Payment status updated" };
    } catch (error) {
      return { success: false, error: "Failed to update payment status" };
    }
  }

  if (intent === "refund") {
    try {
      await client.post(`/api/v4/payments/${paymentId}/refund`, {});
      return { success: true, message: "Refund initiated" };
    } catch (error) {
      return { success: false, error: "Failed to initiate refund" };
    }
  }

  return null;
}

// ─── Component ─────────────────────────────────────────────

export default function PaymentDetail() {
  const { payment } = useLoaderData<PaymentDetailData>();
  const actionData = useActionData();
  const [isRefunding, setIsRefunding] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "var(--p-color-bg-fill-success, #22c55e)";
      case "PROCESSING":
        return "var(--p-color-bg-fill-info, #3b82f6)";
      case "PENDING":
        return "var(--p-color-bg-fill-warning, #f59e0b)";
      case "FAILED":
        return "var(--p-color-bg-fill-critical, #ef4444)";
      case "REFUNDED":
        return "#8c9196";
      default:
        return "#8c9196";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "CHARGE":
        return "#3b82f6";
      case "COD_COLLECTION":
        return "#10b981";
      case "REFUND":
        return "#ef4444";
      case "ADJUSTMENT":
        return "#f59e0b";
      default:
        return "#8c9196";
    }
  };

  const getValidTransitions = (currentStatus: string): string[] => {
    const transitions: Record<string, string[]> = {
      PENDING: ["PROCESSING", "FAILED"],
      PROCESSING: ["COMPLETED", "FAILED"],
      COMPLETED: [],
      FAILED: [],
      REFUNDED: [],
    };
    return transitions[currentStatus] || [];
  };

  const validTransitions = getValidTransitions(payment.status);

  return (
    <div style={containerStyle}>
      {/* Header with Back Link */}
      <div style={headerStyle}>
        <div>
          <Link to="/payments" style={backLinkStyle}>
            ← Back to Payments
          </Link>
          <h1 style={pageHeadingStyle}>Payment Details</h1>
        </div>
      </div>

      {/* Action Feedback */}
      {actionData?.success && (
        <div style={successBannerStyle}>
          {actionData.message}
        </div>
      )}
      {actionData?.error && (
        <div style={errorBannerStyle}>
          {actionData.error}
        </div>
      )}

      {/* Payment Info Card */}
      <div style={cardStyle}>
        <h2 style={cardHeadingStyle}>Payment Information</h2>
        <div style={infoGridStyle}>
          <div style={infoPairStyle}>
            <span style={infoLabelStyle}>Payment ID</span>
            <code style={infoCodeStyle}>{payment.id}</code>
          </div>
          <div style={infoPairStyle}>
            <span style={infoLabelStyle}>Type</span>
            <span
              style={{
                display: "inline-block",
                padding: "4px 12px",
                backgroundColor: getTypeColor(payment.type),
                color: "white",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 500,
                width: "fit-content",
              }}
            >
              {payment.type === "COD_COLLECTION" ? "COD" : payment.type}
            </span>
          </div>
          <div style={infoPairStyle}>
            <span style={infoLabelStyle}>Method</span>
            <span style={infoValueStyle}>{payment.method}</span>
          </div>
          <div style={infoPairStyle}>
            <span style={infoLabelStyle}>Amount</span>
            <span style={infoValueStyle}>
              {payment.currency} {payment.amount.toFixed(2)}
            </span>
          </div>
          <div style={infoPairStyle}>
            <span style={infoLabelStyle}>Status</span>
            <span
              style={{
                display: "inline-block",
                padding: "6px 14px",
                backgroundColor: getStatusColor(payment.status),
                color: "white",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {payment.status}
            </span>
          </div>
          <div style={infoPairStyle}>
            <span style={infoLabelStyle}>Provider Transaction ID</span>
            <code style={infoCodeStyle}>
              {payment.providerTransactionId || "—"}
            </code>
          </div>
          <div style={infoPairStyle}>
            <span style={infoLabelStyle}>Created</span>
            <span style={infoValueStyle}>
              {new Date(payment.createdAt).toLocaleString()}
            </span>
          </div>
          <div style={infoPairStyle}>
            <span style={infoLabelStyle}>Updated</span>
            <span style={infoValueStyle}>
              {new Date(payment.updatedAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Status Transitions */}
        {validTransitions.length > 0 && (
          <div style={actionRowStyle}>
            <span style={infoLabelStyle}>Update Status:</span>
            <div style={{ display: "flex", gap: 8 }}>
              {validTransitions.map((status) => (
                <Form key={status} method="post" style={{ display: "inline" }}>
                  <input type="hidden" name="intent" value="update-status" />
                  <input type="hidden" name="newStatus" value={status} />
                  <button type="submit" style={actionButtonStyle}>
                    Mark as {status}
                  </button>
                </Form>
              ))}
            </div>
          </div>
        )}

        {/* Refund Button */}
        {payment.status === "COMPLETED" && (
          <div style={actionRowStyle}>
            <Form method="post">
              <input type="hidden" name="intent" value="refund" />
              <button
                type="submit"
                disabled={isRefunding}
                onClick={() => setIsRefunding(true)}
                style={{
                  ...refundButtonStyle,
                  opacity: isRefunding ? 0.6 : 1,
                  cursor: isRefunding ? "not-allowed" : "pointer",
                }}
              >
                {isRefunding ? "Processing..." : "Refund Payment"}
              </button>
            </Form>
          </div>
        )}
      </div>

      {/* Related Shipment Link */}
      {payment.shipmentId && (
        <div style={cardStyle}>
          <h2 style={cardHeadingStyle}>Related Shipment</h2>
          <p>
            <Link to={`/shipments/${payment.shipmentId}`} style={linkStyle}>
              View Shipment {payment.shipmentId}
            </Link>
          </p>
        </div>
      )}

      {/* Status History */}
      {payment.statusHistory && payment.statusHistory.length > 0 && (
        <div style={cardStyle}>
          <h2 style={cardHeadingStyle}>Status History</h2>
          <div style={timelineStyle}>
            {payment.statusHistory.map((event, index) => (
              <div key={index} style={timelineEventStyle}>
                <div style={timelineBulletStyle} />
                <div>
                  <div style={timelineStatusStyle}>{event.status}</div>
                  <div style={timelineDateStyle}>
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      {payment.metadata && Object.keys(payment.metadata).length > 0 && (
        <div style={cardStyle}>
          <h2 style={cardHeadingStyle}>Metadata</h2>
          <pre style={metadataStyle}>
            {JSON.stringify(payment.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  padding: "32px",
  backgroundColor: "var(--p-color-bg, #ffffff)",
  maxWidth: 1000,
  margin: "0 auto",
};

const headerStyle: React.CSSProperties = {
  marginBottom: "32px",
};

const backLinkStyle: React.CSSProperties = {
  color: "var(--p-color-text-primary, #005bd3)",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 500,
  marginBottom: 8,
  display: "block",
};

const pageHeadingStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: "var(--p-color-text, #202223)",
  margin: 0,
};

const successBannerStyle: React.CSSProperties = {
  padding: "12px 16px",
  backgroundColor: "var(--p-color-bg-fill-success, #22c55e)",
  color: "white",
  borderRadius: "var(--p-border-radius-200, 8px)",
  marginBottom: "24px",
  fontSize: 14,
};

const errorBannerStyle: React.CSSProperties = {
  padding: "12px 16px",
  backgroundColor: "var(--p-color-bg-fill-critical, #ef4444)",
  color: "white",
  borderRadius: "var(--p-border-radius-200, 8px)",
  marginBottom: "24px",
  fontSize: 14,
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface, #ffffff)",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  padding: "24px",
  marginBottom: "24px",
};

const cardHeadingStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  margin: "0 0 16px",
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "16px",
};

const infoPairStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--p-color-text-subdued, #6d7175)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: 4,
};

const infoValueStyle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--p-color-text, #202223)",
  fontWeight: 500,
};

const infoCodeStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: "monospace",
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  padding: "6px 10px",
  borderRadius: 4,
  color: "var(--p-color-text-subdued, #6d7175)",
  wordBreak: "break-all",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  paddingTop: "16px",
  borderTop: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  marginTop: "16px",
};

const actionButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  color: "white",
  backgroundColor: "var(--p-color-bg-fill-info, #3b82f6)",
  border: "none",
  borderRadius: "var(--p-border-radius-200, 8px)",
  cursor: "pointer",
};

const refundButtonStyle: React.CSSProperties = {
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 600,
  color: "white",
  backgroundColor: "var(--p-color-bg-fill-critical, #ef4444)",
  border: "none",
  borderRadius: "var(--p-border-radius-200, 8px)",
  cursor: "pointer",
};

const timelineStyle: React.CSSProperties = {
  position: "relative",
  paddingLeft: "30px",
};

const timelineEventStyle: React.CSSProperties = {
  position: "relative",
  marginBottom: "16px",
  display: "flex",
  gap: "12px",
};

const timelineBulletStyle: React.CSSProperties = {
  position: "absolute",
  left: "-26px",
  top: "4px",
  width: "12px",
  height: "12px",
  borderRadius: "50%",
  backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
  border: "3px solid white",
};

const timelineStatusStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
};

const timelineDateStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--p-color-text-subdued, #6d7175)",
  marginTop: 2,
};

const metadataStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  padding: "16px",
  borderRadius: "var(--p-border-radius-200, 8px)",
  fontSize: 12,
  fontFamily: "monospace",
  overflow: "auto",
  color: "var(--p-color-text, #202223)",
};

const linkStyle: React.CSSProperties = {
  color: "var(--p-color-text-primary, #005bd3)",
  textDecoration: "none",
  fontWeight: 600,
};
