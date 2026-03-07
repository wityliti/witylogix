"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";

interface Stop {
  id: string;
  orderId: string;
  address: string;
  timeWindow: { start: string; end: string };
  priority: "low" | "medium" | "high";
}

interface RouteFormData {
  name: string;
  date: string;
  driverId: string;
  vehicleId: string;
  stops: Stop[];
}

const mockDrivers = [
  { id: "D001", name: "John Martinez" },
  { id: "D002", name: "Sarah Chen" },
  { id: "D003", name: "Marcus Johnson" },
  { id: "D004", name: "Elena Rodriguez" },
];

const mockVehicles = [
  { id: "V001", name: "Van-01", capacity: "1000kg" },
  { id: "V002", name: "Truck-02", capacity: "5000kg" },
  { id: "V003", name: "Van-03", capacity: "1200kg" },
];

const mockAvailableOrders = [
  {
    id: "ORD-2024-007",
    address: "111 Market St, Shopping District",
    timeWindow: { start: "15:00", end: "17:00" },
    priority: "medium" as const,
  },
  {
    id: "ORD-2024-008",
    address: "222 Park Ave, Riverside",
    timeWindow: { start: "15:30", end: "17:30" },
    priority: "low" as const,
  },
  {
    id: "ORD-2024-009",
    address: "333 Harbor Rd, Port Area",
    timeWindow: { start: "14:00", end: "16:00" },
    priority: "high" as const,
  },
];

const initialRoute: RouteFormData = {
  name: "Downtown Delivery Route A",
  date: "2024-03-06",
  driverId: "D001",
  vehicleId: "V001",
  stops: [
    {
      id: "stop_1",
      orderId: "ORD-2024-001",
      address: "123 Main St, Downtown",
      timeWindow: { start: "09:00", end: "11:00" },
      priority: "high",
    },
    {
      id: "stop_2",
      orderId: "ORD-2024-002",
      address: "456 Oak Ave, Midtown",
      timeWindow: { start: "10:00", end: "12:00" },
      priority: "medium",
    },
    {
      id: "stop_3",
      orderId: "ORD-2024-003",
      address: "789 Elm Rd, North District",
      timeWindow: { start: "11:00", end: "13:00" },
      priority: "low",
    },
    {
      id: "stop_4",
      orderId: "ORD-2024-004",
      address: "321 Pine St, Uptown",
      timeWindow: { start: "13:00", end: "15:00" },
      priority: "medium",
    },
  ],
};

export default function EditRoutePage() {
  const [formData, setFormData] = useState<RouteFormData>(initialRoute);
  const [draggedStop, setDraggedStop] = useState<number | null>(null);
  const [showAddStop, setShowAddStop] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setHasChanges(true);
  };

  const handleRemoveStop = (stopId: string) => {
    setFormData((prev) => ({
      ...prev,
      stops: prev.stops.filter((stop) => stop.id !== stopId),
    }));
    setHasChanges(true);
  };

  const handleAddStop = (order: (typeof mockAvailableOrders)[0]) => {
    const newStop: Stop = {
      id: `stop_${Date.now()}`,
      orderId: order.id,
      address: order.address,
      timeWindow: order.timeWindow,
      priority: order.priority,
    };
    setFormData((prev) => ({
      ...prev,
      stops: [...prev.stops, newStop],
    }));
    setHasChanges(true);
    setShowAddStop(false);
  };

  const handleDragStart = (index: number) => {
    setDraggedStop(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedStop === null || draggedStop === targetIndex) return;

    const stops = [...formData.stops];
    const [draggedItem] = stops.splice(draggedStop, 1);
    stops.splice(targetIndex, 0, draggedItem);

    setFormData((prev) => ({
      ...prev,
      stops,
    }));
    setDraggedStop(null);
    setHasChanges(true);
  };

  const handleReoptimize = () => {
    setFormData((prev) => ({
      ...prev,
      stops: [...prev.stops].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }),
    }));
    setHasChanges(true);
  };

  const handleCancel = () => {
    setFormData(initialRoute);
    setHasChanges(false);
  };

  const estimatedDistance = formData.stops.length * 3.5;
  const estimatedDuration = formData.stops.length * 15 + 30;

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

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    backgroundColor: "var(--wl-bg)",
    padding: "24px",
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: "32px",
  };

  const titleStyle: React.CSSProperties = {
    color: "var(--wl-text)",
    fontSize: "32px",
    fontWeight: "700",
    marginBottom: "8px",
  };

  const subtitleStyle: React.CSSProperties = {
    color: "var(--wl-muted)",
    fontSize: "14px",
  };

  const contentStyle: React.CSSProperties = {
    maxWidth: "1000px",
    marginBottom: "32px",
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "24px",
  };

  const formGroupStyle: React.CSSProperties = {
    marginBottom: "24px",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    color: "var(--wl-text)",
    fontSize: "14px",
    fontWeight: "600",
    marginBottom: "8px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    backgroundColor: "var(--wl-surface)",
    border: "1px solid var(--wl-border)",
    color: "var(--wl-text)",
    fontSize: "14px",
    fontFamily: "inherit",
  };

  const formColumnsStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  };

  const stopListStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "16px",
  };

  const stopItemStyle = (isDragging: boolean): React.CSSProperties => ({
    padding: "12px 16px",
    borderRadius: "6px",
    backgroundColor: isDragging ? "var(--wl-primary)" : "var(--wl-surface)",
    border: `1px solid ${isDragging ? "var(--wl-primary)" : "var(--wl-border)"}`,
    display: "grid",
    gridTemplateColumns: "24px 1fr auto auto",
    gap: "12px",
    alignItems: "center",
    cursor: "grab",
    transition: "all 0.2s ease",
    opacity: isDragging ? 0.7 : 1,
  });

  const dragHandleStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    color: "var(--wl-muted)",
    fontSize: "12px",
    cursor: "grab",
  };

  const statsBarStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "12px",
    marginBottom: "24px",
  };

  const statCardStyle: React.CSSProperties = {
    padding: "12px 16px",
    borderRadius: "6px",
    backgroundColor: "var(--wl-surface)",
    border: "1px solid var(--wl-border)",
  };

  const statValueStyle: React.CSSProperties = {
    color: "var(--wl-primary)",
    fontSize: "18px",
    fontWeight: "700",
    marginBottom: "2px",
  };

  const statLabelStyle: React.CSSProperties = {
    color: "var(--wl-muted)",
    fontSize: "11px",
  };

  const sidebarStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  };

  const availableOrdersStyle: React.CSSProperties = {
    maxHeight: "400px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  };

  const orderItemStyle: React.CSSProperties = {
    padding: "12px",
    borderRadius: "6px",
    backgroundColor: "var(--wl-bg)",
    border: "1px solid var(--wl-border)",
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontSize: "12px",
  };

  const actionBarStyle: React.CSSProperties = {
    display: "flex",
    gap: "12px",
    maxWidth: "1000px",
    justifyContent: "space-between",
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Edit Route</h1>
        <p style={subtitleStyle}>Modify route details, reorder stops, and optimize delivery sequence</p>
      </div>

      <div style={contentStyle}>
        <div style={gridStyle}>
          <div>
            <Card style={{ marginBottom: "24px" }}>
              <CardHeader>
                <CardTitle>Route Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={formColumnsStyle}>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Route Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      style={inputStyle}
                    />
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Delivery Date</label>
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={formColumnsStyle}>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Assign Driver</label>
                    <select
                      name="driverId"
                      value={formData.driverId}
                      onChange={handleInputChange}
                      style={inputStyle}
                    >
                      {mockDrivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Vehicle</label>
                    <select
                      name="vehicleId"
                      value={formData.vehicleId}
                      onChange={handleInputChange}
                      style={inputStyle}
                    >
                      {mockVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.name} ({vehicle.capacity})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Route Stops</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={statsBarStyle}>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>{formData.stops.length}</div>
                    <div style={statLabelStyle}>Total Stops</div>
                  </div>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>{estimatedDistance.toFixed(1)}km</div>
                    <div style={statLabelStyle}>Est. Distance</div>
                  </div>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>{estimatedDuration}min</div>
                    <div style={statLabelStyle}>Est. Duration</div>
                  </div>
                </div>

                <div style={stopListStyle}>
                  {formData.stops.map((stop, idx) => (
                    <div
                      key={stop.id}
                      style={stopItemStyle(draggedStop === idx)}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(idx)}
                    >
                      <div style={dragHandleStyle}>
                        <span>⋮</span>
                        <span>⋮</span>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "var(--wl-text)", fontSize: "12px", fontWeight: "600", marginBottom: "2px" }}>
                          {idx + 1}. {stop.orderId}
                        </div>
                        <div
                          style={{
                            color: "var(--wl-muted)",
                            fontSize: "11px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {stop.address}
                        </div>
                      </div>
                      <Badge>{stop.priority.toUpperCase()}</Badge>
                      <Button
                        onClick={() => handleRemoveStop(stop.id)}
                        variant="secondary"
                        size="sm"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <Button
                    variant="secondary"
                    onClick={() => setShowAddStop(!showAddStop)}
                    style={{ flex: 1 }}
                  >
                    {showAddStop ? "Hide Available Orders" : "Add Stop"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleReoptimize}
                    style={{ flex: 1 }}
                  >
                    Re-optimize Route
                  </Button>
                </div>

                {showAddStop && (
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "16px",
                      borderRadius: "6px",
                      backgroundColor: "var(--wl-surface)",
                      border: "1px solid var(--wl-border)",
                    }}
                  >
                    <h4 style={{ color: "var(--wl-text)", fontSize: "13px", fontWeight: "600", marginBottom: "12px" }}>
                      Available Orders
                    </h4>
                    <div style={availableOrdersStyle}>
                      {mockAvailableOrders.map((order) => (
                        <div
                          key={order.id}
                          style={orderItemStyle}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--wl-surface)";
                            (e.currentTarget as HTMLElement).style.borderColor = "var(--wl-primary)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--wl-bg)";
                            (e.currentTarget as HTMLElement).style.borderColor = "var(--wl-border)";
                          }}
                          onClick={() => handleAddStop(order)}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "6px",
                            }}
                          >
                            <span style={{ fontWeight: "600", color: "var(--wl-text)" }}>{order.id}</span>
                            <Badge>{order.priority.toUpperCase()}</Badge>
                          </div>
                          <div style={{ color: "var(--wl-muted)", marginBottom: "4px" }}>
                            {order.address}
                          </div>
                          <div style={{ color: "var(--wl-muted)", fontSize: "11px" }}>
                            {order.timeWindow.start} - {order.timeWindow.end}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div style={sidebarStyle}>
            <Card>
              <CardHeader>
                <CardTitle>Current Driver</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "6px",
                    backgroundColor: "var(--wl-surface)",
                    border: "1px solid var(--wl-border)",
                  }}
                >
                  <div style={{ color: "var(--wl-text)", fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>
                    {mockDrivers.find((d) => d.id === formData.driverId)?.name}
                  </div>
                  <div style={{ color: "var(--wl-muted)", fontSize: "12px", lineHeight: "1.6" }}>
                    <div>ID: {formData.driverId}</div>
                    <div style={{ marginTop: "8px" }}>Status: Active</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vehicle Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "6px",
                    backgroundColor: "var(--wl-surface)",
                    border: "1px solid var(--wl-border)",
                  }}
                >
                  <div style={{ color: "var(--wl-text)", fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>
                    {mockVehicles.find((v) => v.id === formData.vehicleId)?.name}
                  </div>
                  <div style={{ color: "var(--wl-muted)", fontSize: "12px", lineHeight: "1.6" }}>
                    <div>
                      Capacity: {mockVehicles.find((v) => v.id === formData.vehicleId)?.capacity}
                    </div>
                    <div style={{ marginTop: "8px" }}>Status: Available</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Route Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "6px",
                    backgroundColor: "var(--wl-surface)",
                    border: "1px solid var(--wl-border)",
                    color: "var(--wl-muted)",
                    fontSize: "12px",
                    lineHeight: "1.8",
                  }}
                >
                  <div>
                    <strong>Name:</strong> {formData.name}
                  </div>
                  <div>
                    <strong>Date:</strong> {formData.date}
                  </div>
                  <div>
                    <strong>Stops:</strong> {formData.stops.length}
                  </div>
                  <div>
                    <strong>Distance:</strong> {estimatedDistance.toFixed(1)}km
                  </div>
                  <div>
                    <strong>Duration:</strong> {estimatedDuration}min
                  </div>
                </div>
              </CardContent>
            </Card>

            {hasChanges && (
              <div
                style={{
                  padding: "12px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(255, 107, 107, 0.1)",
                  border: "1px solid #ff6b6b",
                  color: "#ff6b6b",
                  fontSize: "12px",
                  textAlign: "center",
                }}
              >
                You have unsaved changes
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={actionBarStyle}>
        <Button variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
        <div style={{ display: "flex", gap: "12px" }}>
          <Button variant="secondary">Save as Draft</Button>
          <Button variant="primary" disabled={!hasChanges}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
