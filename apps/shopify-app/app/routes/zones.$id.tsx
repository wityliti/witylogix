/**
 * Zone Detail — Full zone view with coverage, capacity, drivers, and timeslots.
 *
 * Layout:
 *   Left column (60%): Zone info, coverage area, capacity, drivers
 *   Right column (40%): Time slots grid, active shipments, actions
 *
 * Actions:
 *   - Edit zone
 *   - Manage drivers
 *   - Adjust capacity
 *
 * Data loaded server-side. Mock data used in loaders.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { createApiClient, type SingleResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Zone {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "CLOSED";
  type: string;
  coverageArea: string;
  boundaryNorth: number;
  boundarySouth: number;
  boundaryEast: number;
  boundaryWest: number;
  maxDeliveriesPerDay: number;
  currentUtilization: number;
}

interface ZoneDriver {
  id: string;
  name: string;
  phone: string;
  status: "ACTIVE" | "INACTIVE" | "ON_DELIVERY";
}

interface TimeSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  capacity: number;
  utilization: number;
}

interface ActiveShipment {
  id: string;
  shipmentId: string;
  customerName: string;
  address: string;
  status: string;
}

interface ZonePageData {
  zone: Zone;
  drivers: ZoneDriver[];
  timeSlots: TimeSlot[];
  activeShipments: ActiveShipment[];
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  // Mock data for zone detail page
  const mockZone: Zone = {
    id: params.id!,
    name: "Downtown Core",
    status: "ACTIVE",
    type: "Urban",
    coverageArea: "Manhattan CBD, bounded by 5th Ave to 8th Ave, Canal St to Central Park South",
    boundaryNorth: 40.7764,
    boundarySouth: 40.7128,
    boundaryEast: -73.9776,
    boundaryWest: -74.0060,
    maxDeliveriesPerDay: 150,
    currentUtilization: 68,
  };

  const mockDrivers: ZoneDriver[] = [
    { id: "d1", name: "Marcus Johnson", phone: "+1 (555) 123-4567", status: "ACTIVE" },
    { id: "d2", name: "Sarah Chen", phone: "+1 (555) 234-5678", status: "ON_DELIVERY" },
    { id: "d3", name: "James Williams", phone: "+1 (555) 345-6789", status: "ACTIVE" },
  ];

  const mockTimeSlots: TimeSlot[] = [
    { id: "t1", day: "Monday", startTime: "09:00", endTime: "12:00", capacity: 50, utilization: 44 },
    { id: "t2", day: "Monday", startTime: "12:00", endTime: "15:00", capacity: 50, utilization: 38 },
    { id: "t3", day: "Monday", startTime: "15:00", endTime: "18:00", capacity: 50, utilization: 32 },
    { id: "t4", day: "Tuesday", startTime: "09:00", endTime: "12:00", capacity: 50, utilization: 48 },
    { id: "t5", day: "Tuesday", startTime: "12:00", endTime: "15:00", capacity: 50, utilization: 42 },
    { id: "t6", day: "Tuesday", startTime: "15:00", endTime: "18:00", capacity: 50, utilization: 35 },
    { id: "t7", day: "Wednesday", startTime: "09:00", endTime: "12:00", capacity: 50, utilization: 46 },
    { id: "t8", day: "Wednesday", startTime: "12:00", endTime: "15:00", capacity: 50, utilization: 40 },
    { id: "t9", day: "Wednesday", startTime: "15:00", endTime: "18:00", capacity: 50, utilization: 28 },
  ];

  const mockActiveShipments: ActiveShipment[] = [
    {
      id: "as1",
      shipmentId: "SH-001",
      customerName: "Acme Corp",
      address: "123 Main St",
      status: "IN_TRANSIT",
    },
    {
      id: "as2",
      shipmentId: "SH-002",
      customerName: "Tech Solutions Inc",
      address: "456 Oak Ave",
      status: "OUT_FOR_DELIVERY",
    },
    {
      id: "as3",
      shipmentId: "SH-003",
      customerName: "Creative Agency Ltd",
      address: "789 Maple Dr",
      status: "OUT_FOR_DELIVERY",
    },
    {
      id: "as4",
      shipmentId: "SH-004",
      customerName: "Marketing Solutions",
      address: "321 Pine Ln",
      status: "IN_TRANSIT",
    },
  ];

  return {
    zone: mockZone,
    drivers: mockDrivers,
    timeSlots: mockTimeSlots,
    activeShipments: mockActiveShipments,
  };
}

// ─── Component ─────────────────────────────────────────────

export default function ZoneDetailPage() {
  const { zone, drivers, timeSlots, activeShipments } = useLoaderData<ZonePageData>();

  const statusColors: Record<string, string> = {
    ACTIVE: "#2d7d2d",
    INACTIVE: "#6d7175",
    CLOSED: "#d72c0d",
  };

  const dayGroups = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/zones" style={backLinkStyle}>
            &larr;
          </Link>
          <div>
            <h1 style={headingStyle}>{zone.name}</h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <span style={{ ...badgeStyle, backgroundColor: statusColors[zone.status] }}>
                {zone.status}
              </span>
              <span style={subtextStyle}>{zone.type}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={columnsStyle}>
        {/* Left Column */}
        <div style={leftColStyle}>
          {/* Coverage Area Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Coverage Area</h3>
            <div style={{ fontSize: 14, color: "var(--p-color-text, #202223)", lineHeight: 1.6 }}>
              {zone.coverageArea}
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--p-color-border-subdued, #e1e3e5)" }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--p-color-text-subdued, #6d7175)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Boundaries
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 8 }}>
                <div>
                  <span style={labelStyle}>North</span>
                  <span style={valueStyle}>{zone.boundaryNorth.toFixed(4)}</span>
                </div>
                <div>
                  <span style={labelStyle}>South</span>
                  <span style={valueStyle}>{zone.boundarySouth.toFixed(4)}</span>
                </div>
                <div>
                  <span style={labelStyle}>East</span>
                  <span style={valueStyle}>{zone.boundaryEast.toFixed(4)}</span>
                </div>
                <div>
                  <span style={labelStyle}>West</span>
                  <span style={valueStyle}>{zone.boundaryWest.toFixed(4)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Capacity Card */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Capacity</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={labelStyle}>Utilization</span>
                  <span style={valueStyle}>{zone.currentUtilization}%</span>
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
                      width: `${zone.currentUtilization}%`,
                      backgroundColor:
                        zone.currentUtilization > 80
                          ? "#d72c0d"
                          : zone.currentUtilization > 60
                          ? "#f5a623"
                          : "#2d7d2d",
                    }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={subtextStyle}>Max per day</span>
                  <span style={valueStyle}>{zone.maxDeliveriesPerDay}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={subtextStyle}>Current</span>
                  <span style={valueStyle}>
                    {Math.round((zone.currentUtilization / 100) * zone.maxDeliveriesPerDay)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Assigned Drivers Card */}
          {drivers.length > 0 && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Assigned Drivers ({drivers.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {drivers.map((driver) => (
                  <div key={driver.id} style={driverCardStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          backgroundColor:
                            driver.status === "ACTIVE"
                              ? "#2d7d2d"
                              : driver.status === "ON_DELIVERY"
                              ? "#005bd3"
                              : "#6d7175",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        {driver.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <Link to={`/drivers/${driver.id}`} style={linkStyle}>
                          {driver.name}
                        </Link>
                        <div style={subtextStyle}>{driver.phone}</div>
                      </div>
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 500,
                        backgroundColor:
                          driver.status === "ACTIVE"
                            ? "#ccf1e2"
                            : driver.status === "ON_DELIVERY"
                            ? "#e8f0fe"
                            : "#f1f2f3",
                        color:
                          driver.status === "ACTIVE"
                            ? "#005c35"
                            : driver.status === "ON_DELIVERY"
                            ? "#1a3a6e"
                            : "#6d7175",
                        borderRadius: 6,
                      }}
                    >
                      {driver.status.replace(/_/g, " ")}
                    </span>
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
              <a href="#" style={primaryButtonStyle}>
                Edit Zone
              </a>
              <button style={secondaryButtonStyle}>
                Manage Drivers
              </button>
              <button style={secondaryButtonStyle}>
                Adjust Capacity
              </button>
            </div>
          </div>

          {/* Time Slots Card */}
          {timeSlots.length > 0 && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Time Slots</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {dayGroups.slice(0, 3).map((day) => {
                  const daySlots = timeSlots.filter((slot) => slot.day === day);
                  return (
                    <div key={day}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--p-color-text, #202223)", marginBottom: 8 }}>
                        {day}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {daySlots.map((slot) => (
                          <div key={slot.id} style={timeSlotStyle}>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>
                              {slot.startTime} – {slot.endTime}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--p-color-text-subdued, #6d7175)",
                                marginTop: 2,
                              }}
                            >
                              {slot.utilization}/{slot.capacity}
                            </div>
                            <div
                              style={{
                                width: "100%",
                                height: 4,
                                backgroundColor: "var(--p-color-bg-surface-hover, #f1f2f3)",
                                borderRadius: 2,
                                marginTop: 4,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${(slot.utilization / slot.capacity) * 100}%`,
                                  backgroundColor:
                                    slot.utilization / slot.capacity > 0.8
                                      ? "#d72c0d"
                                      : slot.utilization / slot.capacity > 0.6
                                      ? "#f5a623"
                                      : "#2d7d2d",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Shipments Card */}
          {activeShipments.length > 0 && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Active Shipments ({activeShipments.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {activeShipments.map((shipment) => (
                  <div key={shipment.id} style={shipmentCardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <Link to={`/shipments/${shipment.shipmentId}`} style={linkStyle}>
                          {shipment.shipmentId}
                        </Link>
                        <div style={{ fontSize: 12, color: "var(--p-color-text, #202223)", marginTop: 2 }}>
                          {shipment.customerName}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--p-color-text-subdued, #6d7175)", marginTop: 2 }}>
                          {shipment.address}
                        </div>
                      </div>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          fontSize: 11,
                          fontWeight: 500,
                          backgroundColor:
                            shipment.status === "OUT_FOR_DELIVERY" ? "#e8f0fe" : "#f1f2f3",
                          color:
                            shipment.status === "OUT_FOR_DELIVERY" ? "#1a3a6e" : "#6d7175",
                          borderRadius: 6,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {shipment.status.replace(/_/g, " ")}
                      </span>
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

const linkStyle: React.CSSProperties = { color: "var(--p-color-text-primary, #005bd3)", textDecoration: "none", fontWeight: 500, fontSize: 13 };

const driverCardStyle: React.CSSProperties = {
  padding: 12,
  backgroundColor: "var(--p-color-bg-surface-hover, #f1f2f3)",
  borderRadius: 8,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const timeSlotStyle: React.CSSProperties = {
  padding: 8,
  backgroundColor: "var(--p-color-bg-surface-hover, #f1f2f3)",
  borderRadius: 6,
};

const shipmentCardStyle: React.CSSProperties = {
  padding: 10,
  backgroundColor: "var(--p-color-bg-surface-hover, #f1f2f3)",
  borderRadius: 8,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 8,
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
