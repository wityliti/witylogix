/**
 * Order Detail — Full order view with status timeline and driver assignment.
 *
 * Layout:
 *   Left column (60%): Customer info, line items, delivery details
 *   Right column (40%): Status timeline, driver assignment, actions
 *
 * Actions:
 *   - Assign/reassign driver (modal with driver search)
 *   - Update status (dropdown)
 *   - Cancel order
 *   - View on Shopify (external link)
 *   - Print label
 *
 * Data loaded server-side. Status updates via action (form submission).
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, Link, useNavigation, redirect } from "react-router";
import { OrderStatusBadge } from "~/components/OrderStatusBadge";
import { StatusTimeline } from "~/components/StatusTimeline";
import { createApiClient, type SingleResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface OrderDetail {
  id: string;
  shopifyOrderId: string;
  shopifyOrderNumber: string | null;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  deliveryDate: string | null;
  timeSlot: { id: string; label: string; startTime: string; endTime: string } | null;
  totalPrice: number | null;
  totalWeight: number | null;
  itemCount: number;
  lineItems: Record<string, unknown>[];
  notes: string | null;
  tags: string[];
  driver: { id: string; name: string; phone: string } | null;
  zone: { id: string; name: string } | null;
  route: { id: string; name: string } | null;
  proofOfDelivery: { photos: string[]; signatureUrl: string | null; notes: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

interface TimelineEvent {
  id: string;
  status: string;
  message: string;
  actor?: string;
  timestamp: string;
}

interface OrderPageData {
  order: OrderDetail;
  timeline: TimelineEvent[];
  availableDrivers: { id: string; name: string; phone: string; activeOrders: number }[];
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["ARRIVED", "FAILED"],
  ARRIVED: ["DELIVERED", "FAILED"],
  FAILED: ["RETURNED", "ASSIGNED"],
  RETURNED: [],
  DELIVERED: [],
  CANCELLED: [],
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  const [orderRes, timelineRes, driversRes] = await Promise.allSettled([
    api.get<SingleResponse<OrderDetail>>(`/api/v4/orders/${params.id}`),
    api.get<SingleResponse<TimelineEvent[]>>(`/api/v4/orders/${params.id}/timeline`),
    api.get<SingleResponse<{ id: string; name: string; phone: string; activeOrders: number }[]>>(
      "/api/v4/drivers",
      { status: "AVAILABLE", limit: 50 },
    ),
  ]);

  if (orderRes.status === "rejected") {
    throw new Response("Order not found", { status: 404 });
  }

  return {
    order: orderRes.value.data,
    timeline: timelineRes.status === "fulfilled" ? timelineRes.value.data : [],
    availableDrivers: driversRes.status === "fulfilled" ? driversRes.value.data : [],
  };
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request, params }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-status") {
    const status = formData.get("status") as string;
    const notes = formData.get("notes") as string | null;
    await api.patch(`/api/v4/orders/${params.id}/status`, {
      status,
      notes: notes || undefined,
    });
  }

  if (intent === "assign-driver") {
    const driverId = formData.get("driverId") as string;
    await api.patch(`/api/v4/orders/${params.id}`, { driverId });
  }

  if (intent === "cancel") {
    await api.patch(`/api/v4/orders/${params.id}/status`, {
      status: "CANCELLED",
      notes: "Cancelled by admin",
    });
  }

  return redirect(`/orders/${params.id}`);
}

// ─── Component ─────────────────────────────────────────────

export default function OrderDetailPage() {
  const { order, timeline, availableDrivers } = useLoaderData<OrderPageData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const nextStatuses = STATUS_TRANSITIONS[order.status] ?? [];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/orders" style={backLinkStyle}>
            &larr;
          </Link>
          <div>
            <h1 style={headingStyle}>
              Order {order.shopifyOrderNumber ? `#${order.shopifyOrderNumber}` : order.id.slice(0, 8)}
            </h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <OrderStatusBadge status={order.status} />
              <span style={subtextStyle}>
                Created {new Date(order.createdAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={columnsStyle}>
        {/* Left Column */}
        <div style={leftColStyle}>
          {/* Customer Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Customer</h3>
            <div style={fieldRowStyle}>
              <div style={fieldStyle}>
                <span style={labelStyle}>Name</span>
                <span style={valueStyle}>{order.customerName ?? "—"}</span>
              </div>
              <div style={fieldStyle}>
                <span style={labelStyle}>Email</span>
                <span style={valueStyle}>{order.customerEmail ?? "—"}</span>
              </div>
              <div style={fieldStyle}>
                <span style={labelStyle}>Phone</span>
                <span style={valueStyle}>{order.customerPhone ?? "—"}</span>
              </div>
            </div>
          </div>

          {/* Delivery Address Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Delivery Address</h3>
            <div style={addressBlockStyle}>
              {order.addressLine1 && <div>{order.addressLine1}</div>}
              {order.addressLine2 && <div>{order.addressLine2}</div>}
              <div>
                {[order.city, order.province, order.postalCode].filter(Boolean).join(", ")}
              </div>
              {order.country && <div>{order.country}</div>}
            </div>
            {order.latitude && order.longitude && (
              <div style={{ ...subtextStyle, marginTop: 8 }}>
                GPS: {order.latitude.toFixed(6)}, {order.longitude.toFixed(6)}
              </div>
            )}
          </div>

          {/* Delivery Details Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Delivery Details</h3>
            <div style={fieldRowStyle}>
              <div style={fieldStyle}>
                <span style={labelStyle}>Delivery Date</span>
                <span style={valueStyle}>
                  {order.deliveryDate
                    ? new Date(order.deliveryDate).toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric",
                      })
                    : "Not scheduled"}
                </span>
              </div>
              <div style={fieldStyle}>
                <span style={labelStyle}>Time Slot</span>
                <span style={valueStyle}>{order.timeSlot?.label ?? "Any time"}</span>
              </div>
              <div style={fieldStyle}>
                <span style={labelStyle}>Zone</span>
                <span style={valueStyle}>{order.zone?.name ?? "Unzoned"}</span>
              </div>
            </div>
            <div style={{ ...fieldRowStyle, marginTop: 12 }}>
              <div style={fieldStyle}>
                <span style={labelStyle}>Items</span>
                <span style={valueStyle}>{order.itemCount}</span>
              </div>
              <div style={fieldStyle}>
                <span style={labelStyle}>Total</span>
                <span style={valueStyle}>
                  {order.totalPrice != null ? `$${order.totalPrice.toFixed(2)}` : "—"}
                </span>
              </div>
              <div style={fieldStyle}>
                <span style={labelStyle}>Weight</span>
                <span style={valueStyle}>
                  {order.totalWeight != null ? `${order.totalWeight}g` : "—"}
                </span>
              </div>
            </div>
            {order.notes && (
              <div style={{ marginTop: 12 }}>
                <span style={labelStyle}>Notes</span>
                <p style={{ margin: "4px 0 0", fontSize: 14 }}>{order.notes}</p>
              </div>
            )}
            {order.tags.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {order.tags.map((tag) => (
                  <span key={tag} style={tagStyle}>{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Line Items */}
          {order.lineItems.length > 0 && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Line Items</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={itemThStyle}>Item</th>
                    <th style={{ ...itemThStyle, textAlign: "center" }}>Qty</th>
                    <th style={{ ...itemThStyle, textAlign: "right" }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lineItems.map((item, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)" }}>
                      <td style={itemTdStyle}>{String(item.name ?? item.sku ?? `Item ${i + 1}`)}</td>
                      <td style={{ ...itemTdStyle, textAlign: "center" }}>{String(item.quantity ?? 1)}</td>
                      <td style={{ ...itemTdStyle, textAlign: "right" }}>
                        {item.price != null ? `$${Number(item.price).toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Proof of Delivery */}
          {order.proofOfDelivery && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Proof of Delivery</h3>
              {order.proofOfDelivery.signatureUrl && (
                <div style={{ marginBottom: 12 }}>
                  <span style={labelStyle}>Signature</span>
                  <img
                    src={order.proofOfDelivery.signatureUrl}
                    alt="Customer signature"
                    style={{ maxWidth: 300, border: "1px solid var(--p-color-border-subdued, #e1e3e5)", borderRadius: 8, marginTop: 4 }}
                  />
                </div>
              )}
              {order.proofOfDelivery.photos.length > 0 && (
                <div>
                  <span style={labelStyle}>Photos</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    {order.proofOfDelivery.photos.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Delivery photo ${i + 1}`}
                        style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, border: "1px solid var(--p-color-border-subdued, #e1e3e5)" }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {order.proofOfDelivery.notes && (
                <div style={{ marginTop: 12 }}>
                  <span style={labelStyle}>Delivery Notes</span>
                  <p style={{ margin: "4px 0 0", fontSize: 14 }}>{order.proofOfDelivery.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div style={rightColStyle}>
          {/* Actions Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Actions</h3>

            {/* Status Update */}
            {nextStatuses.length > 0 && (
              <Form method="post" style={{ marginBottom: 16 }}>
                <input type="hidden" name="intent" value="update-status" />
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>Update Status</label>
                  <select name="status" style={selectStyle}>
                    {nextStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  name="notes"
                  placeholder="Add a note (optional)"
                  style={{ ...inputStyle, marginBottom: 8 }}
                />
                <button type="submit" disabled={isSubmitting} style={primaryButtonStyle}>
                  {isSubmitting ? "Updating..." : "Update Status"}
                </button>
              </Form>
            )}

            {/* Driver Assignment */}
            <Form method="post">
              <input type="hidden" name="intent" value="assign-driver" />
              <div style={{ marginBottom: 8 }}>
                <label style={labelStyle}>
                  {order.driver ? "Reassign Driver" : "Assign Driver"}
                </label>
                <select name="driverId" style={selectStyle} defaultValue={order.driver?.id ?? ""}>
                  <option value="" disabled>Select a driver...</option>
                  {availableDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.activeOrders} active)
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={isSubmitting} style={secondaryButtonStyle}>
                {isSubmitting ? "Assigning..." : order.driver ? "Reassign" : "Assign Driver"}
              </button>
            </Form>

            {/* Cancel */}
            {STATUS_TRANSITIONS[order.status]?.includes("CANCELLED") && (
              <Form method="post" style={{ marginTop: 16, borderTop: "1px solid var(--p-color-border-subdued, #e1e3e5)", paddingTop: 16 }}>
                <input type="hidden" name="intent" value="cancel" />
                <button type="submit" disabled={isSubmitting} style={dangerButtonStyle}>
                  Cancel Order
                </button>
              </Form>
            )}
          </div>

          {/* Current Driver Card */}
          {order.driver && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Assigned Driver</h3>
              <div style={{ fontSize: 14 }}>
                <Link to={`/drivers/${order.driver.id}`} style={{ color: "var(--p-color-text-primary, #005bd3)", textDecoration: "none", fontWeight: 500 }}>
                  {order.driver.name}
                </Link>
                <div style={subtextStyle}>{order.driver.phone}</div>
              </div>
            </div>
          )}

          {/* Route Card */}
          {order.route && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Route</h3>
              <Link to={`/routes/${order.route.id}`} style={{ color: "var(--p-color-text-primary, #005bd3)", textDecoration: "none", fontWeight: 500, fontSize: 14 }}>
                {order.route.name}
              </Link>
            </div>
          )}

          {/* Timeline */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Timeline</h3>
            <StatusTimeline events={timeline} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────

const headerStyle: React.CSSProperties = { padding: "24px 0 16px" };
const headingStyle: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: "var(--p-color-text, #202223)", margin: 0 };
const subtextStyle: React.CSSProperties = { fontSize: 13, color: "var(--p-color-text-subdued, #6d7175)" };
const backLinkStyle: React.CSSProperties = { fontSize: 20, color: "var(--p-color-text-subdued, #6d7175)", textDecoration: "none", padding: 4 };

const columnsStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" };
const leftColStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 16 };
const rightColStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 16 };

const cardStyle: React.CSSProperties = {
  padding: 20, backgroundColor: "var(--p-color-bg-surface, white)", borderRadius: 12,
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)", boxShadow: "var(--p-shadow-sm, 0 1px 0 rgba(0,0,0,.05))",
};
const cardTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 600, margin: "0 0 12px", color: "var(--p-color-text, #202223)" };

const fieldRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 };
const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "var(--p-color-text-subdued, #6d7175)", textTransform: "uppercase", letterSpacing: "0.5px" };
const valueStyle: React.CSSProperties = { fontSize: 14, color: "var(--p-color-text, #202223)" };
const addressBlockStyle: React.CSSProperties = { fontSize: 14, lineHeight: 1.6, color: "var(--p-color-text, #202223)" };

const tagStyle: React.CSSProperties = {
  display: "inline-block", padding: "2px 8px", fontSize: 11, fontWeight: 500,
  backgroundColor: "var(--p-color-bg-surface-hover, #f1f2f3)", borderRadius: 12,
  color: "var(--p-color-text-subdued, #6d7175)",
};

const itemThStyle: React.CSSProperties = {
  textAlign: "left", padding: "8px 0", fontSize: 12, fontWeight: 600,
  color: "var(--p-color-text-subdued, #6d7175)", borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)",
};
const itemTdStyle: React.CSSProperties = { padding: "8px 0", verticalAlign: "top" };

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", fontSize: 14,
  border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 8, backgroundColor: "white",
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", fontSize: 14,
  border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 8, boxSizing: "border-box",
};

const primaryButtonStyle: React.CSSProperties = {
  width: "100%", padding: "8px 16px", fontSize: 14, fontWeight: 500,
  color: "white", backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
  border: "none", borderRadius: 8, cursor: "pointer",
};
const secondaryButtonStyle: React.CSSProperties = {
  width: "100%", padding: "8px 16px", fontSize: 14, fontWeight: 500,
  color: "var(--p-color-text, #303030)", backgroundColor: "white",
  border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 8, cursor: "pointer",
};
const dangerButtonStyle: React.CSSProperties = {
  width: "100%", padding: "8px 16px", fontSize: 14, fontWeight: 500,
  color: "var(--p-color-text-critical, #d72c0d)", backgroundColor: "white",
  border: "1px solid var(--p-color-border-critical, #d72c0d)", borderRadius: 8, cursor: "pointer",
};
