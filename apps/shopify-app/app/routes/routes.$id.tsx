/**
 * Route Detail — Full route view with stops, timeline, and optimization actions.
 *
 * Layout:
 *   Left column (60%): Route header, stats, stops list, timeline
 *   Right column (40%): Map placeholder, actions, summary
 *
 * Actions:
 *   - Optimize route (re-sequence stops)
 *   - Reassign driver
 *   - Export route
 *
 * Data loaded server-side. Mock data used in loaders.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { createApiClient, type SingleResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Route {
  id: string;
  name: string;
  status: "PLANNED" | "ACTIVE" | "COMPLETED" | "FAILED";
  driver: {
    id: string;
    name: string;
    phone: string;
  } | null;
  date: string;
  vehicle: string;
  totalStops: number;
  completedStops: number;
  totalDistance: number;
  estimatedDuration: number;
}

interface Stop {
  id: string;
  stopNumber: number;
  address: string;
  customerName: string;
  timeWindow: string;
  status: "PENDING" | "COMPLETED" | "SKIPPED" | "FAILED";
  deliveryType: string;
  lat: number;
  lng: number;
}

interface RouteEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface RoutePageData {
  route: Route;
  stops: Stop[];
  timeline: RouteEvent[];
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  // Mock data for route detail page
  const mockRoute: Route = {
    id: params.id!,
    name: "Route DT-2024-03-06-001",
    status: "ACTIVE",
    driver: {
      id: "drv1",
      name: "Marcus Johnson",
      phone: "+1 (555) 123-4567",
    },
    date: "2024-03-06",
    vehicle: "Van (DLV-2847)",
    totalStops: 12,
    completedStops: 4,
    totalDistance: 28.5,
    estimatedDuration: 240,
  };

  const mockStops: Stop[] = [
    {
      id: "s1",
      stopNumber: 1,
      address: "123 Main St, Downtown",
      customerName: "Acme Corp",
      timeWindow: "09:00 - 10:00",
      status: "COMPLETED",
      deliveryType: "Delivery",
      lat: 40.7128,
      lng: -74.006,
    },
    {
      id: "s2",
      stopNumber: 2,
      address: "456 Oak Ave, Midtown",
      customerName: "Tech Solutions Inc",
      timeWindow: "10:15 - 11:00",
      status: "COMPLETED",
      deliveryType: "Delivery",
      lat: 40.7505,
      lng: -73.9972,
    },
    {
      id: "s3",
      stopNumber: 3,
      address: "789 Maple Dr, Downtown",
      customerName: "Creative Agency Ltd",
      timeWindow: "11:30 - 12:30",
      status: "COMPLETED",
      deliveryType: "Delivery",
      lat: 40.7489,
      lng: -73.9680,
    },
    {
      id: "s4",
      stopNumber: 4,
      address: "321 Pine Ln, Midtown",
      customerName: "Marketing Solutions",
      timeWindow: "13:00 - 14:00",
      status: "PENDING",
      deliveryType: "Delivery",
      lat: 40.7614,
      lng: -73.9776,
    },
    {
      id: "s5",
      stopNumber: 5,
      address: "654 Cedar St, Downtown",
      customerName: "Digital Studio",
      timeWindow: "14:15 - 15:00",
      status: "PENDING",
      deliveryType: "Delivery",
      lat: 40.7549,
      lng: -73.9840,
    },
    {
      id: "s6",
      stopNumber: 6,
      address: "987 Elm Ave, Uptown",
      customerName: "Finance Corp",
      timeWindow: "15:30 - 16:30",
      status: "PENDING",
      deliveryType: "Delivery",
      lat: 40.7282,
      lng: -73.7949,
    },
  ];

  const mockTimeline: RouteEvent[] = [
    {
      id: "e1",
      type: "route_started",
      message: "Route started",
      timestamp: "2024-03-06T08:00:00Z",
    },
    {
      id: "e2",
      type: "arrived_at_stop",
      message: "Arrived at stop 1 (123 Main St)",
      timestamp: "2024-03-06T08:50:00Z",
    },
    {
      id: "e3",
      type: "stop_completed",
      message: "Completed delivery at stop 1",
      timestamp: "2024-03-06T09:45:00Z",
    },
    {
      id: "e4",
      type: "arrived_at_stop",
      message: "Arrived at stop 2 (456 Oak Ave)",
      timestamp: "2024-03-06T10:10:00Z",
    },
    {
      id: "e5",
      type: "stop_completed",
      message: "Completed delivery at stop 2",
      timestamp: "2024-03-06T10:50:00Z",
    },
  ];

  return {
    route: mockRoute,
    stops: mockStops,
    timeline: mockTimeline,
  };
}

// ─── Component ─────────────────────────────────────────────

export default function RouteDetailPage() {
  const { route, stops, timeline } = useLoaderData<RoutePageData>();
  const pendingStops = stops.filter((s) => s.status === "PENDING").length;

  const statusColors: Record<string, string> = {
    PLANNED: "#f5a623",
    ACTIVE: "#005bd3",
    COMPLETED: "#2d7d2d",
    FAILED: "#d72c0d",
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/routes" style={backLinkStyle}>
            &larr;
          </Link>
          <div>
            <h1 style={headingStyle}>{route.name}</h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <span style={{ ...badgeStyle, backgroundColor: statusColors[route.status] }}>
                {route.status}
              </span>
              <span style={subtextStyle}>
                {new Date(route.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={statsRowStyle}>
        <div style={statBoxStyle}>
          <div style={statLabelStyle}>Total Stops</div>
          <div style={statValueStyle}>{route.totalStops}</div>
        </div>
        <div style={statBoxStyle}>
          <div style={statLabelStyle}>Completed</div>
          <div style={statValueStyle}>{route.completedStops}/{route.totalStops}</div>
        </div>
        <div style={statBoxStyle}>
          <div style={statLabelStyle}>Distance</div>
          <div style={statValueStyle}>{route.totalDistance} km</div>
        </div>
        <div style={statBoxStyle}>
          <div style={statLabelStyle}>Est. Duration</div>
          <div style={statValueStyle}>{Math.floor(route.estimatedDuration / 60)}h {route.estimatedDuration % 60}m</div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={columnsStyle}>
        {/* Left Column */}
        <div style={leftColStyle}>
          {/* Driver Card */}
          {route.driver && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Assigned Driver</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    backgroundColor: statusColors[route.status],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {route.driver.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <Link to={`/drivers/${route.driver.id}`} style={linkStyle}>
                    {route.driver.name}
                  </Link>
                  <div style={subtextStyle}>{route.driver.phone}</div>
                </div>
              </div>
            </div>
          )}

          {/* Vehicle Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Vehicle</h3>
            <div style={valueStyle}>{route.vehicle}</div>
          </div>

          {/* Stops List Card */}
          {stops.length > 0 && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Route Stops ({stops.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stops.map((stop) => (
                  <div key={stop.id} style={stopCardStyle}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--p-color-text-subdued, #6d7175)" }}>
                          Stop {stop.stopNumber}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>
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
                              : stop.status === "SKIPPED"
                              ? "#6d7175"
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
        </div>

        {/* Right Column */}
        <div style={rightColStyle}>
          {/* Actions Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button style={primaryButtonStyle}>
                Optimize Route
              </button>
              <button style={secondaryButtonStyle}>
                Reassign Driver
              </button>
              <button style={secondaryButtonStyle}>
                Export Route
              </button>
            </div>
          </div>

          {/* Map Placeholder Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Route Visualization</h3>
            <div style={mapPlaceholderStyle}>
              <div style={{ color: "var(--p-color-text-subdued, #6d7175)", fontSize: 14 }}>
                Map: {route.totalStops} stops route for {route.date}
              </div>
              <div style={{ fontSize: 12, color: "var(--p-color-text-subdued, #6d7175)", marginTop: 8 }}>
                {pendingStops} stops remaining
              </div>
            </div>
          </div>

          {/* Route Summary Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Summary</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={labelStyle}>Progress</span>
                <span style={valueStyle}>
                  {Math.round((route.completedStops / route.totalStops) * 100)}%
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: 8,
                  backgroundColor: "var(--p-color-bg-surface-hover, #f1f2f3)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(route.completedStops / route.totalStops) * 100}%`,
                    backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
                  }}
                />
              </div>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={labelStyle}>Completed</span>
                  <span style={{ ...valueStyle, color: "#2d7d2d" }}>{route.completedStops}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={labelStyle}>Remaining</span>
                  <span style={{ ...valueStyle, color: "#f5a623" }}>{pendingStops}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Card */}
          {timeline.length > 0 && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Timeline</h3>
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

const statsRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 12,
  marginBottom: 20,
};

const statBoxStyle: React.CSSProperties = {
  padding: 12,
  backgroundColor: "var(--p-color-bg-surface, white)",
  borderRadius: 8,
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  textAlign: "center",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: "var(--p-color-text-subdued, #6d7175)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  marginTop: 4,
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

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "var(--p-color-text-subdued, #6d7175)", textTransform: "uppercase", letterSpacing: "0.5px" };
const valueStyle: React.CSSProperties = { fontSize: 14, color: "var(--p-color-text, #202223)" };

const linkStyle: React.CSSProperties = { color: "var(--p-color-text-primary, #005bd3)", textDecoration: "none", fontWeight: 500 };

const stopCardStyle: React.CSSProperties = {
  padding: 12,
  backgroundColor: "var(--p-color-bg-surface-hover, #f1f2f3)",
  borderRadius: 8,
  fontSize: 13,
};

const mapPlaceholderStyle: React.CSSProperties = {
  width: "100%",
  height: 200,
  backgroundColor: "var(--p-color-bg-surface-hover, #f1f2f3)",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  border: "1px dashed var(--p-color-border-subdued, #e1e3e5)",
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
