/**
 * Driver Detail — Full driver view with performance metrics, activity timeline, and actions.
 *
 * Layout:
 *   Left column (60%): Profile, vehicle info, zones, performance metrics
 *   Right column (40%): Today's route, recent deliveries, activity timeline
 *
 * Actions:
 *   - Edit driver (admin panel link)
 *   - Assign route (modal)
 *   - Deactivate driver (status update)
 *   - Message driver (external link)
 *
 * Data loaded server-side. Mock data used in loaders.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { createApiClient, type SingleResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  hireDate: string;
  status: "ACTIVE" | "INACTIVE" | "ON_DELIVERY" | "ON_BREAK";
  avatar: string | null;
  vehicle: {
    type: string;
    plate: string | null;
    model: string | null;
  };
  zones: Array<{
    id: string;
    name: string;
  }>;
  performance: {
    rating: number;
    onTimePercentage: number;
    totalDeliveries: number;
    avgDeliveryTime: number;
  };
}

interface RouteStop {
  id: string;
  address: string;
  customerName: string;
  timeWindow: string;
  status: "PENDING" | "COMPLETED" | "SKIPPED" | "FAILED";
  deliveryType: string;
}

interface Delivery {
  id: string;
  shipmentId: string;
  deliveryDate: string;
  location: string;
  status: string;
  duration: number;
}

interface Activity {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface DriverPageData {
  driver: Driver;
  todayRoute: RouteStop[];
  recentDeliveries: Delivery[];
  timeline: Activity[];
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  // Mock data for driver detail page
  const mockDriver: Driver = {
    id: params.id!,
    name: "Marcus Johnson",
    email: "marcus.johnson@delivery.com",
    phone: "+1 (555) 123-4567",
    hireDate: "2022-03-15",
    status: "ON_DELIVERY",
    avatar: null,
    vehicle: {
      type: "Van",
      plate: "DLV-2847",
      model: "Ford Transit 2023",
    },
    zones: [
      { id: "z1", name: "Downtown Core" },
      { id: "z2", name: "Midtown East" },
    ],
    performance: {
      rating: 4.8,
      onTimePercentage: 96,
      totalDeliveries: 1247,
      avgDeliveryTime: 8.5,
    },
  };

  const mockTodayRoute: RouteStop[] = [
    {
      id: "rs1",
      address: "123 Main St, Downtown",
      customerName: "Acme Corp",
      timeWindow: "09:00 - 10:00",
      status: "COMPLETED",
      deliveryType: "Delivery",
    },
    {
      id: "rs2",
      address: "456 Oak Ave, Midtown",
      customerName: "Tech Solutions Inc",
      timeWindow: "10:15 - 11:00",
      status: "COMPLETED",
      deliveryType: "Delivery",
    },
    {
      id: "rs3",
      address: "789 Maple Dr, Downtown",
      customerName: "Creative Agency Ltd",
      timeWindow: "11:30 - 12:30",
      status: "PENDING",
      deliveryType: "Delivery",
    },
    {
      id: "rs4",
      address: "321 Pine Ln, Midtown",
      customerName: "Marketing Solutions",
      timeWindow: "13:00 - 14:00",
      status: "PENDING",
      deliveryType: "Delivery",
    },
  ];

  const mockRecentDeliveries: Delivery[] = [
    {
      id: "d1",
      shipmentId: "SH-001",
      deliveryDate: "2024-03-05",
      location: "123 Main St",
      status: "DELIVERED",
      duration: 9,
    },
    {
      id: "d2",
      shipmentId: "SH-002",
      deliveryDate: "2024-03-05",
      location: "456 Oak Ave",
      status: "DELIVERED",
      duration: 7,
    },
    {
      id: "d3",
      shipmentId: "SH-003",
      deliveryDate: "2024-03-04",
      location: "789 Maple Dr",
      status: "DELIVERED",
      duration: 10,
    },
    {
      id: "d4",
      shipmentId: "SH-004",
      deliveryDate: "2024-03-04",
      location: "321 Pine Ln",
      status: "DELIVERED",
      duration: 8,
    },
    {
      id: "d5",
      shipmentId: "SH-005",
      deliveryDate: "2024-03-04",
      location: "654 Cedar St",
      status: "DELIVERED",
      duration: 6,
    },
  ];

  const mockTimeline: Activity[] = [
    {
      id: "a1",
      type: "route_started",
      message: "Started today's route",
      timestamp: "2024-03-06T08:00:00Z",
    },
    {
      id: "a2",
      type: "stop_completed",
      message: "Completed stop 1 at 123 Main St",
      timestamp: "2024-03-06T09:45:00Z",
    },
    {
      id: "a3",
      type: "stop_completed",
      message: "Completed stop 2 at 456 Oak Ave",
      timestamp: "2024-03-06T10:50:00Z",
    },
    {
      id: "a4",
      type: "on_break",
      message: "On break",
      timestamp: "2024-03-06T11:15:00Z",
    },
  ];

  return {
    driver: mockDriver,
    todayRoute: mockTodayRoute,
    recentDeliveries: mockRecentDeliveries,
    timeline: mockTimeline,
  };
}

// ─── Component ─────────────────────────────────────────────

export default function DriverDetailPage() {
  const { driver, todayRoute, recentDeliveries, timeline } = useLoaderData<DriverPageData>();
  const initials = driver.name.split(" ").map((n) => n[0]).join("").toUpperCase();

  const statusColors: Record<string, string> = {
    ACTIVE: "#2d7d2d",
    INACTIVE: "#6d7175",
    ON_DELIVERY: "#005bd3",
    ON_BREAK: "#f5a623",
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/drivers" style={backLinkStyle}>
            &larr;
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ ...avatarStyle, backgroundColor: statusColors[driver.status] }}>
              {initials}
            </div>
            <div>
              <h1 style={headingStyle}>{driver.name}</h1>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                <span style={{ ...badgeStyle, backgroundColor: statusColors[driver.status] }}>
                  {driver.status.replace(/_/g, " ")}
                </span>
                <span style={subtextStyle}>
                  Hired {new Date(driver.hireDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={columnsStyle}>
        {/* Left Column */}
        <div style={leftColStyle}>
          {/* Contact Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Contact Information</h3>
            <div style={fieldRowStyle}>
              <div style={fieldStyle}>
                <span style={labelStyle}>Email</span>
                <a href={`mailto:${driver.email}`} style={linkStyle}>
                  {driver.email}
                </a>
              </div>
              <div style={fieldStyle}>
                <span style={labelStyle}>Phone</span>
                <a href={`tel:${driver.phone}`} style={linkStyle}>
                  {driver.phone}
                </a>
              </div>
              <div style={fieldStyle}>
                <span style={labelStyle}>Hire Date</span>
                <span style={valueStyle}>
                  {new Date(driver.hireDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Vehicle Card */}
          {driver.vehicle && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Vehicle Information</h3>
              <div style={fieldRowStyle}>
                <div style={fieldStyle}>
                  <span style={labelStyle}>Type</span>
                  <span style={valueStyle}>{driver.vehicle.type}</span>
                </div>
                <div style={fieldStyle}>
                  <span style={labelStyle}>Plate</span>
                  <span style={valueStyle}>{driver.vehicle.plate ?? "—"}</span>
                </div>
                <div style={fieldStyle}>
                  <span style={labelStyle}>Model</span>
                  <span style={valueStyle}>{driver.vehicle.model ?? "—"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Assigned Zones Card */}
          {driver.zones.length > 0 && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Assigned Zones</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {driver.zones.map((zone) => (
                  <Link
                    key={zone.id}
                    to={`/zones/${zone.id}`}
                    style={{ ...tagStyle, color: "var(--p-color-text-primary, #005bd3)", textDecoration: "none" }}
                  >
                    {zone.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Performance Metrics Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Performance Metrics</h3>
            <div style={metricsGridStyle}>
              <div style={metricBoxStyle}>
                <div style={metricValueStyle}>{driver.performance.rating.toFixed(1)}</div>
                <div style={metricLabelStyle}>Rating</div>
              </div>
              <div style={metricBoxStyle}>
                <div style={metricValueStyle}>{driver.performance.onTimePercentage}%</div>
                <div style={metricLabelStyle}>On-Time</div>
              </div>
              <div style={metricBoxStyle}>
                <div style={metricValueStyle}>{driver.performance.totalDeliveries}</div>
                <div style={metricLabelStyle}>Total Deliveries</div>
              </div>
              <div style={metricBoxStyle}>
                <div style={metricValueStyle}>{driver.performance.avgDeliveryTime}m</div>
                <div style={metricLabelStyle}>Avg. Time</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={rightColStyle}>
          {/* Actions Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a href="#" style={primaryButtonStyle}>
                Edit Driver
              </a>
              <button style={secondaryButtonStyle}>
                Assign Route
              </button>
              <button style={secondaryButtonStyle}>
                Message
              </button>
              {driver.status === "ACTIVE" && (
                <button style={dangerButtonStyle}>
                  Deactivate
                </button>
              )}
            </div>
          </div>

          {/* Today's Route Card */}
          {todayRoute.length > 0 && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Today's Route</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {todayRoute.map((stop, idx) => (
                  <div key={stop.id} style={stopCardStyle}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--p-color-text-subdued, #6d7175)" }}>
                          Stop {idx + 1}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>
                          {stop.customerName}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--p-color-text-subdued, #6d7175)", marginTop: 2 }}>
                          {stop.address}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--p-color-text-subdued, #6d7175)", marginTop: 2 }}>
                          {stop.timeWindow}
                        </div>
                      </div>
                      <span
                        style={{
                          ...smallBadgeStyle,
                          backgroundColor:
                            stop.status === "COMPLETED"
                              ? "#2d7d2d"
                              : stop.status === "PENDING"
                              ? "#f5a623"
                              : "#d72c0d",
                        }}
                      >
                        {stop.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Deliveries Card */}
          {recentDeliveries.length > 0 && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Recent Deliveries</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>Shipment</th>
                    <th style={tableHeaderStyle}>Date</th>
                    <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDeliveries.slice(0, 5).map((delivery) => (
                    <tr key={delivery.id} style={{ borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)" }}>
                      <td style={tableCellStyle}>
                        <Link to={`/shipments/${delivery.shipmentId}`} style={linkStyle}>
                          {delivery.shipmentId}
                        </Link>
                      </td>
                      <td style={tableCellStyle}>
                        {new Date(delivery.deliveryDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: "center" }}>{delivery.duration}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Activity Timeline Card */}
          {timeline.length > 0 && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Activity</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {timeline.map((event, idx) => (
                  <div key={event.id} style={{ display: "flex", gap: 8 }}>
                    <div style={{ position: "relative" }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
                          borderRadius: "50%",
                          marginTop: 5,
                        }}
                      />
                      {idx < timeline.length - 1 && (
                        <div
                          style={{
                            position: "absolute",
                            left: 3,
                            top: 16,
                            width: 2,
                            height: 40,
                            backgroundColor: "var(--p-color-border-subdued, #e1e3e5)",
                          }}
                        />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "var(--p-color-text, #202223)" }}>
                        {event.message}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--p-color-text-subdued, #6d7175)", marginTop: 2 }}>
                        {new Date(event.timestamp).toLocaleTimeString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

const avatarStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "white",
  fontSize: 18,
  fontWeight: 600,
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 12px",
  fontSize: 12,
  fontWeight: 500,
  color: "white",
  borderRadius: 12,
};

const smallBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  fontSize: 11,
  fontWeight: 500,
  color: "white",
  borderRadius: 6,
};

const columnsStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" };
const leftColStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 16 };
const rightColStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 16 };

const cardStyle: React.CSSProperties = {
  padding: 20,
  backgroundColor: "var(--p-color-bg-surface, white)",
  borderRadius: 12,
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  boxShadow: "var(--p-shadow-sm, 0 1px 0 rgba(0,0,0,.05))",
};

const cardTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 600, margin: "0 0 12px", color: "var(--p-color-text, #202223)" };

const fieldRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 };
const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "var(--p-color-text-subdued, #6d7175)", textTransform: "uppercase", letterSpacing: "0.5px" };
const valueStyle: React.CSSProperties = { fontSize: 14, color: "var(--p-color-text, #202223)" };

const linkStyle: React.CSSProperties = { color: "var(--p-color-text-primary, #005bd3)", textDecoration: "none", fontWeight: 500 };

const tagStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 500,
  backgroundColor: "var(--p-color-bg-surface-hover, #f1f2f3)",
  borderRadius: 12,
  color: "var(--p-color-text-subdued, #6d7175)",
};

const metricsGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 };
const metricBoxStyle: React.CSSProperties = {
  padding: 12,
  backgroundColor: "var(--p-color-bg-surface-hover, #f1f2f3)",
  borderRadius: 8,
  textAlign: "center",
};
const metricValueStyle: React.CSSProperties = { fontSize: 18, fontWeight: 600, color: "var(--p-color-text, #202223)" };
const metricLabelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: "var(--p-color-text-subdued, #6d7175)", marginTop: 4 };

const stopCardStyle: React.CSSProperties = {
  padding: 12,
  backgroundColor: "var(--p-color-bg-surface-hover, #f1f2f3)",
  borderRadius: 8,
  fontSize: 13,
};

const primaryButtonStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "8px 16px",
  fontSize: 14,
  fontWeight: 500,
  color: "white",
  backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  textDecoration: "none",
  textAlign: "center" as const,
};

const secondaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 16px",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--p-color-text, #303030)",
  backgroundColor: "white",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 8,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 16px",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--p-color-text-critical, #d72c0d)",
  backgroundColor: "white",
  border: "1px solid var(--p-color-border-critical, #d72c0d)",
  borderRadius: 8,
  cursor: "pointer",
};

const tableHeaderStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 0",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--p-color-text-subdued, #6d7175)",
  borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)",
};

const tableCellStyle: React.CSSProperties = { padding: "8px 0", verticalAlign: "top" };
