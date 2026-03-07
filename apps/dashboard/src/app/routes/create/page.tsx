"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";

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
  optimizationMode: "shortest_distance" | "time_windows" | "priority_first";
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

const mockOrders = [
  {
    id: "ORD-2024-001",
    address: "123 Main St, Downtown",
    timeWindow: { start: "09:00", end: "11:00" },
    priority: "high" as const,
  },
  {
    id: "ORD-2024-002",
    address: "456 Oak Ave, Midtown",
    timeWindow: { start: "10:00", end: "12:00" },
    priority: "medium" as const,
  },
  {
    id: "ORD-2024-003",
    address: "789 Elm Rd, North District",
    timeWindow: { start: "11:00", end: "13:00" },
    priority: "low" as const,
  },
  {
    id: "ORD-2024-004",
    address: "321 Pine St, Uptown",
    timeWindow: { start: "13:00", end: "15:00" },
    priority: "medium" as const,
  },
  {
    id: "ORD-2024-005",
    address: "654 Maple Dr, East Side",
    timeWindow: { start: "14:00", end: "16:00" },
    priority: "low" as const,
  },
  {
    id: "ORD-2024-006",
    address: "987 Cedar Ln, West Side",
    timeWindow: { start: "09:30", end: "11:30" },
    priority: "high" as const,
  },
];

export default function CreateRoutePage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<RouteFormData>({
    name: "",
    date: "",
    driverId: "",
    vehicleId: "",
    stops: [],
    optimizationMode: "shortest_distance",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [draggedStop, setDraggedStop] = useState<number | null>(null);

  const filteredOrders = mockOrders.filter(
    (order) =>
      !formData.stops.some((stop) => stop.orderId === order.id) &&
      (order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddStop = (order: (typeof mockOrders)[0]) => {
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
  };

  const handleRemoveStop = (stopId: string) => {
    setFormData((prev) => ({
      ...prev,
      stops: prev.stops.filter((stop) => stop.id !== stopId),
    }));
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
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

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

  const estimatedDistance = formData.stops.length * 3.5;
  const estimatedDuration = formData.stops.length * 15 + 30;

  const canProceed =
    step === 1
      ? formData.name && formData.date && formData.driverId && formData.vehicleId
      : step === 2
        ? formData.stops.length > 0
        : true;

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

  const stepsContainerStyle: React.CSSProperties = {
    display: "flex",
    gap: "12px",
    marginBottom: "32px",
    maxWidth: "900px",
  };

  const stepStyle = (isActive: boolean, isCompleted: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "12px 16px",
    borderRadius: "8px",
    backgroundColor: isActive
      ? "var(--wl-primary)"
      : isCompleted
        ? "var(--wl-surface)"
        : "var(--wl-surface)",
    border: `1px solid ${isActive ? "var(--wl-primary)" : "var(--wl-border)"}`,
    color: isActive ? "white" : "var(--wl-muted)",
    textAlign: "center",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
  });

  const contentStyle: React.CSSProperties = {
    maxWidth: "900px",
    marginBottom: "32px",
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
    transition: "border-color 0.2s ease",
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  };

  const searchStyle: React.CSSProperties = {
    ...inputStyle,
    marginBottom: "16px",
  };

  const orderListStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "12px",
    marginBottom: "24px",
  };

  const orderCardStyle: React.CSSProperties = {
    padding: "16px",
    borderRadius: "8px",
    backgroundColor: "var(--wl-surface)",
    border: "1px solid var(--wl-border)",
    cursor: "pointer",
    transition: "all 0.2s ease",
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
    marginBottom: "24px",
    position: "relative",
    overflow: "hidden",
  };

  const stopListStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "16px",
  };

  const stopItemStyle = (isDragging: boolean): React.CSSProperties => ({
    padding: "12px 16px",
    borderRadius: "6px",
    backgroundColor: isDragging ? "var(--wl-primary)" : "var(--wl-surface)",
    border: `1px solid ${isDragging ? "var(--wl-primary)" : "var(--wl-border)"}`,
    display: "flex",
    alignItems: "center",
    gap: "12px",
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
  };

  const statsBarStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    margin: "24px 0",
  };

  const statCardStyle: React.CSSProperties = {
    padding: "16px",
    borderRadius: "8px",
    backgroundColor: "var(--wl-surface)",
    border: "1px solid var(--wl-border)",
    textAlign: "center",
  };

  const statValueStyle: React.CSSProperties = {
    color: "var(--wl-primary)",
    fontSize: "24px",
    fontWeight: "700",
    marginBottom: "4px",
  };

  const statLabelStyle: React.CSSProperties = {
    color: "var(--wl-muted)",
    fontSize: "12px",
  };

  const optionsGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
  };

  const optionButtonStyle = (isSelected: boolean): React.CSSProperties => ({
    padding: "16px",
    borderRadius: "8px",
    backgroundColor: isSelected ? "var(--wl-primary)" : "var(--wl-surface)",
    border: `1px solid ${isSelected ? "var(--wl-primary)" : "var(--wl-border)"}`,
    color: isSelected ? "white" : "var(--wl-text)",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    transition: "all 0.2s ease",
    textAlign: "center",
  });

  const actionBarStyle: React.CSSProperties = {
    display: "flex",
    gap: "12px",
    maxWidth: "900px",
    justifyContent: "space-between",
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Create New Route</h1>
        <p style={subtitleStyle}>Set up a new delivery route with multiple stops</p>
      </div>

      <div style={stepsContainerStyle}>
        {["Route Basics", "Add Stops", "Map Preview", "Optimization"].map((name, idx) => (
          <div
            key={idx}
            style={stepStyle(step === idx + 1, step > idx + 1)}
            onClick={() => step > idx + 1 && setStep(idx + 1)}
          >
            {name}
          </div>
        ))}
      </div>

      <Card style={{ maxWidth: "900px", marginBottom: "24px" }}>
        <CardHeader>
          <CardTitle>
            Step {step}:{" "}
            {step === 1
              ? "Route Basics"
              : step === 2
                ? "Add Stops"
                : step === 3
                  ? "Map Preview"
                  : "Optimization"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div style={contentStyle}>
              <div style={gridStyle}>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>Route Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Downtown Delivery Route A"
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
              <div style={gridStyle}>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>Assign Driver</label>
                  <select
                    name="driverId"
                    value={formData.driverId}
                    onChange={handleInputChange}
                    style={inputStyle}
                  >
                    <option value="">Select a driver</option>
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
                    <option value="">Select a vehicle</option>
                    {mockVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.name} ({vehicle.capacity})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={contentStyle}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Search & Add Orders</label>
                <input
                  type="text"
                  placeholder="Search by order ID or address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={searchStyle}
                />
              </div>

              {filteredOrders.length > 0 && (
                <>
                  <h3 style={{ color: "var(--wl-text)", fontSize: "14px", fontWeight: "600", marginBottom: "12px" }}>
                    Available Orders ({filteredOrders.length})
                  </h3>
                  <div style={orderListStyle}>
                    {filteredOrders.map((order) => (
                      <div
                        key={order.id}
                        style={orderCardStyle}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = "var(--wl-primary)";
                          (e.currentTarget as HTMLElement).style.backgroundColor = "var(--wl-surface)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = "var(--wl-border)";
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "start",
                            marginBottom: "8px",
                          }}
                        >
                          <span style={{ color: "var(--wl-text)", fontWeight: "600", fontSize: "13px" }}>
                            {order.id}
                          </span>
                          <Badge>{order.priority.toUpperCase()}</Badge>
                        </div>
                        <p style={{ color: "var(--wl-muted)", fontSize: "12px", marginBottom: "8px" }}>
                          {order.address}
                        </p>
                        <p style={{ color: "var(--wl-muted)", fontSize: "12px", marginBottom: "12px" }}>
                          {order.timeWindow.start} - {order.timeWindow.end}
                        </p>
                        <Button
                          onClick={() => handleAddStop(order)}
                          variant="primary"
                          size="sm"
                          style={{ width: "100%" }}
                        >
                          Add to Route
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {formData.stops.length > 0 && (
                <>
                  <h3
                    style={{
                      color: "var(--wl-text)",
                      fontSize: "14px",
                      fontWeight: "600",
                      marginTop: "32px",
                      marginBottom: "12px",
                    }}
                  >
                    Route Stops ({formData.stops.length})
                  </h3>
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
                          <span>::::</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: "var(--wl-text)", fontSize: "13px", fontWeight: "600" }}>
                            {stop.orderId}
                          </div>
                          <div style={{ color: "var(--wl-muted)", fontSize: "12px" }}>{stop.address}</div>
                          <div style={{ color: "var(--wl-muted)", fontSize: "12px", marginTop: "4px" }}>
                            {stop.timeWindow.start} - {stop.timeWindow.end}
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
                    <div style={statCardStyle}>
                      <div style={statValueStyle}>850kg</div>
                      <div style={statLabelStyle}>Est. Capacity</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div style={contentStyle}>
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

                  {formData.stops.length > 1 && (
                    <polyline
                      points={formData.stops
                        .map((_, idx) => {
                          const x = 50 + (idx / (formData.stops.length - 1)) * 700;
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

                  {formData.stops.map((stop, idx) => {
                    const x = 50 + (idx / Math.max(formData.stops.length - 1, 1)) * 700;
                    const y = 150 + Math.sin(idx * 0.5) * 50;
                    return (
                      <g key={stop.id}>
                        <circle
                          cx={x}
                          cy={y}
                          r="12"
                          fill={getPriorityColor(stop.priority)}
                          opacity="0.8"
                        />
                        <text
                          x={x}
                          y={y}
                          textAnchor="middle"
                          dy="0.3em"
                          fontSize="10"
                          fontWeight="bold"
                          fill="white"
                        >
                          {idx + 1}
                        </text>
                      </g>
                    );
                  })}
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
                  Map Preview - {formData.stops.length} stops
                </div>
              </div>

              <div>
                <h3 style={{ color: "var(--wl-text)", fontSize: "14px", fontWeight: "600", marginBottom: "12px" }}>
                  Stop Details
                </h3>
                <div style={stopListStyle}>
                  {formData.stops.map((stop, idx) => (
                    <div
                      key={stop.id}
                      style={{
                        padding: "12px 16px",
                        borderRadius: "6px",
                        backgroundColor: "var(--wl-surface)",
                        border: "1px solid var(--wl-border)",
                        display: "grid",
                        gridTemplateColumns: "30px 1fr auto",
                        gap: "12px",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "4px",
                          backgroundColor: getPriorityColor(stop.priority),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div style={{ color: "var(--wl-text)", fontSize: "13px", fontWeight: "600" }}>
                          {stop.orderId}
                        </div>
                        <div style={{ color: "var(--wl-muted)", fontSize: "12px", marginTop: "2px" }}>
                          {stop.address}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Badge>{stop.priority.toUpperCase()}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={contentStyle}>
              <h3 style={{ color: "var(--wl-text)", fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>
                Route Optimization Strategy
              </h3>
              <div style={optionsGridStyle}>
                {[
                  {
                    id: "shortest_distance",
                    name: "Shortest Distance",
                    desc: "Minimize travel distance",
                  },
                  {
                    id: "time_windows",
                    name: "Time Windows",
                    desc: "Respect delivery windows",
                  },
                  {
                    id: "priority_first",
                    name: "Priority First",
                    desc: "High-priority deliveries first",
                  },
                ].map((option) => (
                  <div
                    key={option.id}
                    style={optionButtonStyle(formData.optimizationMode === (option.id as any))}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        optimizationMode: option.id as any,
                      }))
                    }
                  >
                    <div style={{ fontWeight: "600", marginBottom: "4px" }}>{option.name}</div>
                    <div style={{ fontSize: "12px", opacity: "0.8" }}>{option.desc}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: "24px",
                  padding: "16px",
                  borderRadius: "8px",
                  backgroundColor: "var(--wl-surface)",
                  border: "1px solid var(--wl-border)",
                }}
              >
                <h4 style={{ color: "var(--wl-text)", fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>
                  Summary
                </h4>
                <div style={{ color: "var(--wl-muted)", fontSize: "13px", lineHeight: "1.6" }}>
                  <p>
                    <strong>Route:</strong> {formData.name}
                  </p>
                  <p>
                    <strong>Driver:</strong> {mockDrivers.find((d) => d.id === formData.driverId)?.name || "Not assigned"}
                  </p>
                  <p>
                    <strong>Vehicle:</strong> {mockVehicles.find((v) => v.id === formData.vehicleId)?.name || "Not assigned"}
                  </p>
                  <p>
                    <strong>Date:</strong> {formData.date || "Not set"}
                  </p>
                  <p>
                    <strong>Stops:</strong> {formData.stops.length}
                  </p>
                  <p>
                    <strong>Est. Distance:</strong> {estimatedDistance.toFixed(1)}km
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div style={actionBarStyle}>
        <div style={{ display: "flex", gap: "12px" }}>
          {step > 1 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {step === 4 ? (
            <>
              <Button variant="secondary">Save as Draft</Button>
              <Button variant="primary">Dispatch Route</Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => setStep(4)}
              >
                Skip to Optimization
              </Button>
              <Button
                variant="primary"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed}
              >
                Next
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
