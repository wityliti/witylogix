"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";

interface Stop {
  id: string;
  orderId: string;
  address: string;
  timeWindow: { start: string; end: string };
  priority: "low" | "medium" | "high";
  status: "PENDING" | "ARRIVED" | "COMPLETED" | "FAILED";
  eta: string;
  actualTime?: string;
  completedAt?: string;
}

interface Route {
  id: string;
  name: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  driver: { id: string; name: string; phone: string };
  vehicle: { id: string; name: string; capacity: string };
  date: string;
  stops: Stop[];
  startTime?: string;
  endTime?: string;
  currentLocation: { lat: number; lng: number };
}

const mockRoute: Route = {
  id: "ROUTE-2024-045",
  name: "Downtown Delivery Route A",
  status: "IN_PROGRESS",
  driver: { id: "D001", name: "John Martinez", phone: "+1-555-0142" },
  vehicle: { id: "V001", name: "Van-01", capacity: "1000kg" },
  date: "2024-03-06",
  startTime: "09:15",
  currentLocation: { lat: 40.7128, lng: -74.006 },
  stops: [
    {
      id: "stop_1",
      orderId: "ORD-2024-001",
      address: "123 Main St, Downtown",
      timeWindow: { start: "09:00", end: "11:00" },
      priority: "high",
      status: "COMPLETED",
      eta: "09:25",
      actualTime: "09:23",
      completedAt: "09:28",
    },
    {
      id: "stop_2",
      orderId: "ORD-2024-002",
      address: "456 Oak Ave, Midtown",
      timeWindow: { start: "10:00", end: "12:00" },
      priority: "medium",
      status: "COMPLETED",
      eta: "10:15",
      actualTime: "10:12",
      completedAt: "10:18",
    },
    {
      id: "stop_3",
      orderId: "ORD-2024-003",
      address: "789 Elm Rd, North District",
      timeWindow: { start: "11:00", end: "13:00" },
      priority: "low",
      status: "ARRIVED",
      eta: "10:58",
      actualTime: "10:56",
    },
    {
      id: "stop_4",
      orderId: "ORD-2024-004",
      address: "321 Pine St, Uptown",
      timeWindow: { start: "13:00", end: "15:00" },
      priority: "medium",
      status: "PENDING",
      eta: "11:45",
    },
    {
      id: "stop_5",
      orderId: "ORD-2024-005",
      address: "654 Maple Dr, East Side",
      timeWindow: { start: "14:00", end: "16:00" },
      priority: "low",
      status: "PENDING",
      eta: "12:30",
    },
    {
      id: "stop_6",
      orderId: "ORD-2024-006",
      address: "987 Cedar Ln, West Side",
      timeWindow: { start: "09:30", end: "11:30" },
      priority: "high",
      status: "FAILED",
      eta: "09:40",
    },
  ],
};

export default function RouteDetailPage() {
  const [route, setRoute] = useState<Route>(mockRoute);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const completedStops = route.stops.filter((s) => s.status === "COMPLETED").length;
  const totalStops = route.stops.length;
  const onTimeCount = route.stops
    .filter((s) => s.status === "COMPLETED" && s.completedAt && s.actualTime)
    .filter((s) => {
      if (!s.completedAt || !s.timeWindow) return false;
      const completedTime = new Date(`2024-03-06T${s.completedAt}`);
      const windowEnd = new Date(`2024-03-06T${s.timeWindow.end}`);
      return completedTime <= windowEnd;
    }).length;
  const onTimePercent = totalStops > 0 ? Math.round((onTimeCount / completedStops) * 100) : 0;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "#ff6b6b";
      case "medium":
        return "#ffd93d";
      case "low":
        return "#6bcf7f";
      default:
        return "#8888a0";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "#6bcf7f";
      case "ARRIVED":
        return "#4ecdc4";
      case "PENDING":
        return "#8888a0";
      case "FAILED":
        return "#ff6b6b";
      default:
        return "#8888a0";
    }
  };

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    backgroundColor: "var(--wl-bg)",
    padding: "24px",
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: "32px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
  };

  const headerLeftStyle: React.CSSProperties = {
    flex: 1,
  };

  const titleStyle: React.CSSProperties = {
    color: "var(--wl-text)",
    fontSize: "32px",
    fontWeight: "700",
    marginBottom: "8px",
  };

  const metaStyle: React.CSSProperties = {
    display: "flex",
    gap: "16px",
    marginTop: "8px",
    fontSize: "14px",
  };

  const metaItemStyle: React.CSSProperties = {
    color: "var(--wl-muted)",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "24px",
    marginBottom: "24px",
  };

  const mapPlaceholderStyle: React.CSSProperties = {
    width: "100%",
    height: "400px",
    backgroundColor: "var(--wl-surface)",
    borderRadius: "8px",
    border: "1px solid var(--wl-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  };

  const sidebarStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  };

  const statsCardStyle: React.CSSProperties = {
    padding: "16px",
    borderRadius: "8px",
    backgroundColor: "var(--wl-surface)",
    border: "1px solid var(--wl-border)",
  };

  const statsGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  };

  const statItemStyle: React.CSSProperties = {
    padding: "12px",
    borderRadius: "6px",
    backgroundColor: "var(--wl-bg)",
    border: "1px solid var(--wl-border)",
    textAlign: "center",
  };

  const statValueStyle: React.CSSProperties = {
    color: "var(--wl-primary)",
    fontSize: "20px",
    fontWeight: "700",
    marginBottom: "4px",
  };

  const statLabelStyle: React.CSSProperties = {
    color: "var(--wl-muted)",
    fontSize: "11px",
  };

  const driverInfoStyle: React.CSSProperties = {
    padding: "16px",
    borderRadius: "8px",
    backgroundColor: "var(--wl-surface)",
    border: "1px solid var(--wl-border)",
  };

  const driverNameStyle: React.CSSProperties = {
    color: "var(--wl-text)",
    fontSize: "13px",
    fontWeight: "600",
    marginBottom: "8px",
  };

  const driverDetailsStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "12px",
    color: "var(--wl-muted)",
  };

  const stopListStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  };

  const stopItemStyle = (status: string): React.CSSProperties => ({
    padding: "12px 16px",
    borderRadius: "6px",
    backgroundColor: "var(--wl-surface)",
    border: `1px solid ${status === "ARRIVED" ? "var(--wl-primary)" : "var(--wl-border)"}`,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    transition: "all 0.2s ease",
  });

  const statusIndicatorStyle = (status: string): React.CSSProperties => ({
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: getStatusColor(status),
    flexShrink: 0,
  });

  const timelineStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0",
    position: "relative",
    padding: "20px 0",
  };

  const timelineItemStyle = (isLast: boolean): React.CSSProperties => ({
    paddingLeft: "32px",
    paddingBottom: "20px",
    position: "relative",
  });

  const timelineMarkerStyle = (status: string): React.CSSProperties => ({
    position: "absolute",
    left: "0",
    top: "0",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    backgroundColor: getStatusColor(status),
    border: "3px solid var(--wl-bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });

  const timelineLineStyle: React.CSSProperties = {
    position: "absolute",
    left: "8px",
    top: "20px",
    width: "3px",
    height: "calc(100% + 20px)",
    backgroundColor: "var(--wl-border)",
  };

  const actionBarStyle: React.CSSProperties = {
    display: "flex",
    gap: "12px",
    marginTop: "24px",
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={headerLeftStyle}>
          <h1 style={titleStyle}>{route.name}</h1>
          <div style={metaStyle}>
            <div style={metaItemStyle}>
              <Badge>{route.status}</Badge>
              {route.date}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <Button variant="secondary">Edit Route</Button>
          <Button variant="primary">Start Route</Button>
        </div>
      </div>

      <div style={gridStyle}>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Route Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={mapPlaceholderStyle}>
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 800 400"
                  style={{ position: "absolute", top: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6C63FF" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#6C63FF" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>

                  {route.stops.length > 1 && (
                    <polyline
                      points={route.stops
                        .map((_, idx) => {
                          const x = 50 + (idx / (route.stops.length - 1)) * 700;
                          const y = 150 + Math.sin(idx * 0.5) * 50;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                      fill="none"
                      stroke="#6C63FF"
                      strokeWidth="2"
                      opacity="0.5"
                    />
                  )}

                  {route.stops.map((stop, idx) => {
                    const x = 50 + (idx / Math.max(route.stops.length - 1, 1)) * 700;
                    const y = 150 + Math.sin(idx * 0.5) * 50;
                    const statusColor = getStatusColor(stop.status);
                    return (
                      <g key={stop.id}>
                        <circle cx={x} cy={y} r="14" fill={statusColor} opacity="0.9" />
                        <text
                          x={x}
                          y={y}
                          textAnchor="middle"
                          dy="0.3em"
                          fontSize="11"
                          fontWeight="bold"
                          fill="white"
                        >
                          {idx + 1}
                        </text>
                      </g>
                    );
                  })}

                  <circle
                    cx="200"
                    cy="180"
                    r="8"
                    fill="#00d4ff"
                    opacity="0.8"
                    stroke="white"
                    strokeWidth="2"
                  />
                  <text
                    x="200"
                    y="210"
                    textAnchor="middle"
                    fontSize="12"
                    fill="#00d4ff"
                    fontWeight="bold"
                  >
                    Driver
                  </text>
                </svg>
                <div
                  style={{
                    position: "absolute",
                    bottom: "16px",
                    right: "16px",
                    fontSize: "12px",
                    color: "var(--wl-muted)",
                  }}
                >
                  Lat: {route.currentLocation.lat}, Lng: {route.currentLocation.lng}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card style={{ marginTop: "24px" }}>
            <CardHeader>
              <CardTitle>Route Progress Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={timelineStyle}>
                {route.stops.map((stop, idx) => (
                  <div key={stop.id} style={timelineItemStyle(idx === route.stops.length - 1)}>
                    {idx < route.stops.length - 1 && <div style={timelineLineStyle} />}
                    <div style={timelineMarkerStyle(stop.status)} />
                    <div style={{ paddingTop: "4px" }}>
                      <div style={{ color: "var(--wl-text)", fontSize: "13px", fontWeight: "600" }}>
                        {stop.orderId}
                      </div>
                      <div style={{ color: "var(--wl-muted)", fontSize: "12px", marginTop: "2px" }}>
                        {stop.address}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          marginTop: "4px",
                          fontSize: "12px",
                          color: "var(--wl-muted)",
                        }}
                      >
                        <span>ETA: {stop.eta}</span>
                        {stop.actualTime && <span>Arrived: {stop.actualTime}</span>}
                        {stop.completedAt && <span>Completed: {stop.completedAt}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div style={sidebarStyle}>
          <Card>
            <CardHeader>
              <CardTitle>Route Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={statsGridStyle}>
                <div style={statItemStyle}>
                  <div style={statValueStyle}>
                    {completedStops}/{totalStops}
                  </div>
                  <div style={statLabelStyle}>Stops Completed</div>
                </div>
                <div style={statItemStyle}>
                  <div style={statValueStyle}>{onTimePercent}%</div>
                  <div style={statLabelStyle}>On-Time Deliveries</div>
                </div>
                <div style={statItemStyle}>
                  <div style={statValueStyle}>12min</div>
                  <div style={statLabelStyle}>Avg Stop Time</div>
                </div>
                <div style={statItemStyle}>
                  <div style={statValueStyle}>18.5km</div>
                  <div style={statLabelStyle}>Total Distance</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Driver Information</CardTitle>
            </CardHeader>
            <CardContent style={{ padding: 0 }}>
              <div style={driverInfoStyle}>
                <div style={driverNameStyle}>{route.driver.name}</div>
                <div style={driverDetailsStyle}>
                  <div>
                    <strong>Phone:</strong> {route.driver.phone}
                  </div>
                  <div>
                    <strong>Vehicle:</strong> {route.vehicle.name}
                  </div>
                  <div>
                    <strong>Capacity:</strong> {route.vehicle.capacity}
                  </div>
                  {route.startTime && (
                    <div>
                      <strong>Start Time:</strong> {route.startTime}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Button variant="primary" style={{ width: "100%" }}>
                  Resume Route
                </Button>
                <Button variant="secondary" style={{ width: "100%" }}>
                  Pause
                </Button>
                <Button variant="secondary" style={{ width: "100%" }}>
                  Reassign Driver
                </Button>
                <Button variant="secondary" style={{ width: "100%" }}>
                  Complete Route
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card style={{ marginTop: "24px" }}>
        <CardHeader>
          <CardTitle>Stop Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={stopListStyle}>
            {route.stops.map((stop, idx) => (
              <div key={stop.id} style={stopItemStyle(stop.status)}>
                <div style={statusIndicatorStyle(stop.status)} />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                      marginBottom: "4px",
                    }}
                  >
                    <div>
                      <span style={{ color: "var(--wl-text)", fontWeight: "600", fontSize: "13px" }}>
                        {idx + 1}. {stop.orderId}
                      </span>
                      <Badge style={{ marginLeft: "8px" }}>{stop.status}</Badge>
                    </div>
                    <Badge>{stop.priority.toUpperCase()}</Badge>
                  </div>
                  <p style={{ color: "var(--wl-muted)", fontSize: "12px", margin: "4px 0" }}>
                    {stop.address}
                  </p>
                  <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--wl-muted)" }}>
                    <span>Window: {stop.timeWindow.start} - {stop.timeWindow.end}</span>
                    <span>ETA: {stop.eta}</span>
                    {stop.actualTime && <span>Arrived: {stop.actualTime}</span>}
                    {stop.completedAt && <span>Completed: {stop.completedAt}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div style={actionBarStyle}>
        <Button variant="secondary">Back to Routes</Button>
        <div style={{ display: "flex", gap: "12px" }}>
          <Button variant="secondary">Contact Driver</Button>
          <Button variant="primary">Update Status</Button>
        </div>
      </div>
    </div>
  );
}
