/**
 * Shipment Detail — Full shipment view with status timeline, delivery info, and actions.
 *
 * Layout:
 *   Left column (60%): Shipment details, customer info, driver info, activity log
 *   Right column (40%): Status timeline, delivery proof, actions
 *
 * Actions:
 *   - Update Status (dropdown)
 *   - Assign Driver (dropdown)
 *   - Print Label
 *   - Cancel Shipment
 *
 * Data loaded server-side. Status updates via action (form submission).
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, Link, useNavigation, redirect } from "react-router";
import { ShipmentStatusBadge } from "~/components/ShipmentStatusBadge";
import { StatusTimeline } from "~/components/StatusTimeline";
import { createApiClient, type SingleResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface ShipmentDetail {
  id: string;
  trackingNumber: string;
  status: string;
  carrier: string | null;
  deliveryMethod: string | null;
  weight: number | null;
  dimensions: { length: number; width: number; height: number } | null;
  originAddress: {
    name: string;
    email: string | null;
    phone: string | null;
    line1: string;
    line2: string | null;
    city: string;
    province: string | null;
    postalCode: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
  };
  destinationAddress: {
    name: string;
    email: string | null;
    phone: string | null;
    line1: string;
    line2: string | null;
    city: string;
    province: string | null;
    postalCode: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
  };
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  driver: { id: string; name: string; phone: string; vehicleType: string; vehiclePlate: string | null } | null;
  deliveryProof: { photos: string[]; signatureUrl: string | null; notes: string | null } | null;
  eta: string | null;
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

interface ShipmentPageData {
  shipment: ShipmentDetail;
  timeline: TimelineEvent[];
  availableDrivers: { id: string; name: string; phone: string; activeShipments: number }[];
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["LABEL_CREATED", "CANCELLED"],
  LABEL_CREATED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "FAILED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "FAILED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "ATTEMPTED", "FAILED"],
  ATTEMPTED: ["OUT_FOR_DELIVERY", "FAILED"],
  FAILED: ["IN_TRANSIT", "RETURNED"],
  RETURNED: [],
  DELIVERED: [],
  CANCELLED: [],
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  const [shipmentRes, timelineRes, driversRes] = await Promise.allSettled([
    api.get<SingleResponse<ShipmentDetail>>(`/api/v4/shipments/${params.id}`),
    api.get<SingleResponse<TimelineEvent[]>>(`/api/v4/shipments/${params.id}/timeline`),
    api.get<SingleResponse<{ id: string; name: string; phone: string; activeShipments: number }[]>>(
      "/api/v4/drivers",
      { status: "AVAILABLE", limit: 50 },
    ),
  ]);

  if (shipmentRes.status === "rejected") {
    throw new Response("Shipment not found", { status: 404 });
  }

  return {
    shipment: shipmentRes.value.data,
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
    await api.patch(`/api/v4/shipments/${params.id}/status`, {
      status,
      notes: notes || undefined,
    });
  }

  if (intent === "assign-driver") {
    const driverId = formData.get("driverId") as string;
    await api.patch(`/api/v4/shipments/${params.id}`, { driverId });
  }

  if (intent === "print-label") {
    await api.post(`/api/v4/shipments/${params.id}/print-label`, {});
  }

  if (intent === "cancel") {
    await api.patch(`/api/v4/shipments/${params.id}/status`, {
      status: "CANCELLED",
      notes: "Cancelled by admin",
    });
  }

  return redirect(`/shipments/${params.id}`);
}

// ─── Component ─────────────────────────────────────────────

export default function ShipmentDetailPage() {
  const { shipment, timeline, availableDrivers } = useLoaderData<ShipmentPageData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const nextStatuses = STATUS_TRANSITIONS[shipment.status] ?? [];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/shipments" style={backLinkStyle}>
            &larr;
          </Link>
          <div>
            <h1 style={headingStyle}>
              {shipment.trackingNumber}
            </h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <ShipmentStatusBadge status={shipment.status} />
              <span style={subtextStyle}>
                Created {new Date(shipment.createdAt).toLocaleDateString("en-US", {
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
          {/* Shipment Details Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Shipment Details</h3>
            <div style={fieldRowStyle}>
              <div style={fieldStyle}>
                <span style={labelStyle}>Carrier</span>
                <span style={valueStyle}>{shipment.carrier ?? "—"}</span>
              </div>
              <div style={fieldStyle}>
                <span style={labelStyle}>Delivery Method</span>
                <span style={valueStyle}>{shipment.deliveryMethod ? shipment.deliveryMethod.replace(/_/g, " ") : "—"}</span>
              </div>
              <div style={fieldStyle}>
                <span style={labelStyle}>ETA</span>
                <span style={valueStyle}>
                  {shipment.eta
                    ? new Date(shipment.eta).toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })
                    : "Not available"}
                </span>
              </div>
            </div>
            <div style={{ ...fieldRowStyle, marginTop: 12 }}>
              <div style={fieldStyle}>
                <span style={labelStyle}>Weight</span>
                <span style={valueStyle}>
                  {shipment.weight != null ? `${shipment.weight}g` : "—"}
                </span>
              </div>
              {shipment.dimensions && (
                <>
                  <div style={fieldStyle}>
                    <span style={labelStyle}>Dimensions</span>
                    <span style={valueStyle}>
                      {shipment.dimensions.length} × {shipment.dimensions.width} × {shipment.dimensions.height} cm
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Origin Address Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Origin Address</h3>
            <div style={addressBlockStyle}>
              <div style={{ fontWeight: 500 }}>{shipment.originAddress.name}</div>
              {shipment.originAddress.line1 && <div>{shipment.originAddress.line1}</div>}
              {shipment.originAddress.line2 && <div>{shipment.originAddress.line2}</div>}
              <div>
                {[shipment.originAddress.city, shipment.originAddress.province, shipment.originAddress.postalCode]
                  .filter(Boolean)
                  .join(", ")}
              </div>
              {shipment.originAddress.country && <div>{shipment.originAddress.country}</div>}
              {shipment.originAddress.phone && (
                <div style={subtextStyle}>{shipment.originAddress.phone}</div>
              )}
              {shipment.originAddress.email && (
                <div style={subtextStyle}>{shipment.originAddress.email}</div>
              )}
            </div>
            {shipment.originAddress.latitude && shipment.originAddress.longitude && (
              <div style={{ ...subtextStyle, marginTop: 8 }}>
                GPS: {shipment.originAddress.latitude.toFixed(6)}, {shipment.originAddress.longitude.toFixed(6)}
              </div>
            )}
          </div>

          {/* Destination Address Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Destination Address</h3>
            <div style={addressBlockStyle}>
              <div style={{ fontWeight: 500 }}>{shipment.destinationAddress.name}</div>
              {shipment.destinationAddress.line1 && <div>{shipment.destinationAddress.line1}</div>}
              {shipment.destinationAddress.line2 && <div>{shipment.destinationAddress.line2}</div>}
              <div>
                {[shipment.destinationAddress.city, shipment.destinationAddress.province, shipment.destinationAddress.postalCode]
                  .filter(Boolean)
                  .join(", ")}
              </div>
              {shipment.destinationAddress.country && <div>{shipment.destinationAddress.country}</div>}
              {shipment.destinationAddress.phone && (
                <div style={subtextStyle}>{shipment.destinationAddress.phone}</div>
              )}
              {shipment.destinationAddress.email && (
                <div style={subtextStyle}>{shipment.destinationAddress.email}</div>
              )}
            </div>
            {shipment.destinationAddress.latitude && shipment.destinationAddress.longitude && (
              <div style={{ ...subtextStyle, marginTop: 8 }}>
                GPS: {shipment.destinationAddress.latitude.toFixed(6)}, {shipment.destinationAddress.longitude.toFixed(6)}
              </div>
            )}
          </div>

          {/* Customer Info Card */}
          {shipment.customerName && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Customer Info</h3>
              <div style={fieldRowStyle}>
                <div style={fieldStyle}>
                  <span style={labelStyle}>Name</span>
                  <span style={valueStyle}>{shipment.customerName}</span>
                </div>
                {shipment.customerEmail && (
                  <div style={fieldStyle}>
                    <span style={labelStyle}>Email</span>
                    <span style={valueStyle}>{shipment.customerEmail}</span>
                  </div>
                )}
                {shipment.customerPhone && (
                  <div style={fieldStyle}>
                    <span style={labelStyle}>Phone</span>
                    <span style={valueStyle}>{shipment.customerPhone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Driver Info Card */}
          {shipment.driver && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Driver Info</h3>
              <div style={fieldRowStyle}>
                <div style={fieldStyle}>
                  <span style={labelStyle}>Name</span>
                  <span style={valueStyle}>
                    <Link to={`/drivers/${shipment.driver.id}`} style={linkStyle}>
                      {shipment.driver.name}
                    </Link>
                  </span>
                </div>
                <div style={fieldStyle}>
                  <span style={labelStyle}>Phone</span>
                  <span style={valueStyle}>{shipment.driver.phone}</span>
                </div>
                <div style={fieldStyle}>
                  <span style={labelStyle}>Vehicle</span>
                  <span style={valueStyle}>
                    {shipment.driver.vehicleType}
                    {shipment.driver.vehiclePlate && ` (${shipment.driver.vehiclePlate})`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Proof Card */}
          {shipment.deliveryProof && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Proof of Delivery</h3>
              {shipment.deliveryProof.signatureUrl && (
                <div style={{ marginBottom: 12 }}>
                  <span style={labelStyle}>Signature</span>
                  <img
                    src={shipment.deliveryProof.signatureUrl}
                    alt="Signature"
                    style={{ maxWidth: 300, border: "1px solid var(--p-color-border-subdued, #e1e3e5)", borderRadius: 8, marginTop: 4 }}
                  />
                </div>
              )}
              {shipment.deliveryProof.photos.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <span style={labelStyle}>Photos</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    {shipment.deliveryProof.photos.map((url, i) => (
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
              {shipment.deliveryProof.notes && (
                <div>
                  <span style={labelStyle}>Delivery Notes</span>
                  <p style={{ margin: "4px 0 0", fontSize: 14 }}>{shipment.deliveryProof.notes}</p>
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
            <Form method="post" style={{ marginBottom: 16 }}>
              <input type="hidden" name="intent" value="assign-driver" />
              <div style={{ marginBottom: 8 }}>
                <label style={labelStyle}>
                  {shipment.driver ? "Reassign Driver" : "Assign Driver"}
                </label>
                <select name="driverId" style={selectStyle} defaultValue={shipment.driver?.id ?? ""}>
                  <option value="" disabled>Select a driver...</option>
                  {availableDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.activeShipments} active)
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={isSubmitting} style={secondaryButtonStyle}>
                {isSubmitting ? "Assigning..." : shipment.driver ? "Reassign" : "Assign Driver"}
              </button>
            </Form>

            {/* Print Label */}
            <Form method="post" style={{ marginBottom: 16 }}>
              <input type="hidden" name="intent" value="print-label" />
              <button type="submit" disabled={isSubmitting} style={secondaryButtonStyle}>
                {isSubmitting ? "Printing..." : "Print Label"}
              </button>
            </Form>

            {/* Cancel */}
            {STATUS_TRANSITIONS[shipment.status]?.includes("CANCELLED") && (
              <Form method="post" style={{ marginTop: 16, borderTop: "1px solid var(--p-color-border-subdued, #e1e3e5)", paddingTop: 16 }}>
                <input type="hidden" name="intent" value="cancel" />
                <button type="submit" disabled={isSubmitting} style={dangerButtonStyle}>
                  Cancel Shipment
                </button>
              </Form>
            )}
          </div>

          {/* Timeline */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Status Timeline</h3>
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
const linkStyle: React.CSSProperties = { color: "var(--p-color-text-primary, #005bd3)", textDecoration: "none", fontWeight: 500 };

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
  marginBottom: 0,
};
const dangerButtonStyle: React.CSSProperties = {
  width: "100%", padding: "8px 16px", fontSize: 14, fontWeight: 500,
  color: "var(--p-color-text-critical, #d72c0d)", backgroundColor: "white",
  border: "1px solid var(--p-color-border-critical, #d72c0d)", borderRadius: 8, cursor: "pointer",
};
