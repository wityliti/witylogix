"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { FleetMapProps, VehiclePosition } from "./types";
import { VehicleStatusBadge } from "./vehicle-status-badge";

/**
 * Vehicle Tracker Map Component
 * Canvas-based real-time vehicle position map with direction arrows
 * Shows vehicle markers with status colors and click popups
 */
export function VehicleTrackerMap({
  vehicles,
  onVehicleClick,
  center = { lat: 0, lng: 0 },
  zoom = 4,
  height = 500,
  autoRefresh = true,
  refreshInterval = 5000,
  selectedVehicleId,
  className,
}: FleetMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height });
  const [mapCenter, setMapCenter] = useState(center);
  const [mapZoom, setMapZoom] = useState(zoom);
  const [selectedVehicle, setSelectedVehicle] = useState<VehiclePosition | null>(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const animationRef = useRef<number | null>(null);

  // Update canvas size on container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      const { width } = container.getBoundingClientRect();
      setCanvasSize({ width: Math.max(width, 400), height });
    });

    resizeObserver.observe(container);
    setCanvasSize({ width: container.clientWidth, height });

    return () => resizeObserver.disconnect();
  }, [height]);

  // Convert lat/lng to canvas coordinates
  const latLngToCanvasCoords = useCallback(
    (lat: number, lng: number): { x: number; y: number } => {
      const latRange = 5;
      const lngRange = 8;

      const normalizedX = (lng - mapCenter.lng + lngRange / 2) / lngRange;
      const normalizedY = (mapCenter.lat - lat + latRange / 2) / latRange;

      return {
        x: normalizedX * canvasSize.width,
        y: normalizedY * canvasSize.height,
      };
    },
    [mapCenter, canvasSize]
  );

  // Get vehicle color based on status
  const getVehicleColor = (status: string): string => {
    switch (status) {
      case "moving":
        return "#10b981"; // green
      case "idle":
        return "#f59e0b"; // yellow
      case "stopped":
        return "#ef4444"; // red
      case "offline":
        return "#6b7280"; // gray
      case "maintenance":
        return "#0ea5e9"; // blue
      default:
        return "#6b7280";
    }
  };

  // Draw map on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // Clear canvas
    ctx.fillStyle = "rgba(15, 23, 42, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "rgba(75, 85, 99, 0.3)";
    ctx.lineWidth = 1;
    const gridSpacing = 50;

    for (let x = 0; x < canvas.width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y < canvas.height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw center crosshair
    ctx.strokeStyle = "rgba(96, 165, 250, 0.2)";
    ctx.lineWidth = 1;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 20, centerY);
    ctx.lineTo(centerX + 20, centerY);
    ctx.moveTo(centerX, centerY - 20);
    ctx.lineTo(centerX, centerY + 20);
    ctx.stroke();

    // Draw vehicles
    vehicles.forEach((vehicle) => {
      const { x, y } = latLngToCanvasCoords(vehicle.latitude, vehicle.longitude);

      if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) return;

      // Draw vehicle circle
      const isSelected = vehicle.id === selectedVehicleId || vehicle.id === selectedVehicle?.id;
      const radius = isSelected ? 12 : 8;
      const color = getVehicleColor(vehicle.status);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw selection highlight
      if (isSelected) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw direction arrow
      if (vehicle.status === "moving" && vehicle.heading !== undefined) {
        const arrowLength = 15;
        const headingRad = (vehicle.heading * Math.PI) / 180;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
          x + arrowLength * Math.cos(headingRad),
          y + arrowLength * Math.sin(headingRad)
        );
        ctx.stroke();

        // Arrow head
        const arrowHeadSize = 5;
        const angle1 = headingRad + (135 * Math.PI) / 180;
        const angle2 = headingRad - (135 * Math.PI) / 180;

        ctx.beginPath();
        ctx.moveTo(
          x + arrowLength * Math.cos(headingRad),
          y + arrowLength * Math.sin(headingRad)
        );
        ctx.lineTo(
          x + arrowLength * Math.cos(headingRad) + arrowHeadSize * Math.cos(angle1),
          y + arrowLength * Math.sin(headingRad) + arrowHeadSize * Math.sin(angle1)
        );
        ctx.moveTo(
          x + arrowLength * Math.cos(headingRad),
          y + arrowLength * Math.sin(headingRad)
        );
        ctx.lineTo(
          x + arrowLength * Math.cos(headingRad) + arrowHeadSize * Math.cos(angle2),
          y + arrowLength * Math.sin(headingRad) + arrowHeadSize * Math.sin(angle2)
        );
        ctx.stroke();
      }

      // Draw vehicle label
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(vehicle.name, x, y + 25);

      // Draw speed if moving
      if (vehicle.status === "moving" && vehicle.speed > 0) {
        ctx.fillStyle = "rgba(16, 185, 129, 0.8)";
        ctx.font = "10px sans-serif";
        ctx.fillText(`${Math.round(vehicle.speed)} km/h`, x, y + 37);
      }
    });

    // Draw zoom info
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Zoom: ${mapZoom}x`, 10, 20);
    ctx.fillText(`Vehicles: ${vehicles.length}`, 10, 35);
  }, [vehicles, canvasSize, mapCenter, mapZoom, selectedVehicleId, selectedVehicle, latLngToCanvasCoords]);

  // Handle canvas click for vehicle selection
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check which vehicle was clicked
    let clicked = false;
    for (const vehicle of vehicles) {
      const { x: vx, y: vy } = latLngToCanvasCoords(vehicle.latitude, vehicle.longitude);
      const distance = Math.sqrt((x - vx) ** 2 + (y - vy) ** 2);

      if (distance < 15) {
        setSelectedVehicle(vehicle);
        setPopupPos({ x, y });
        onVehicleClick?.(vehicle);
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      setSelectedVehicle(null);
    }
  };

  // Zoom controls
  const handleZoom = (direction: "in" | "out") => {
    setMapZoom((prev) => {
      const newZoom = direction === "in" ? prev + 1 : Math.max(1, prev - 1);
      return Math.min(Math.max(newZoom, 1), 12);
    });
  };

  // Center on selected vehicle
  const handleCenterOnVehicle = () => {
    if (selectedVehicle) {
      setMapCenter({ lat: selectedVehicle.latitude, lng: selectedVehicle.longitude });
    }
  };

  // Auto-refresh indicator
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setRefreshing(true);
      setTimeout(() => setRefreshing(false), 200);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  return (
    <div ref={containerRef} className={cn("relative bg-wl-bg-surface rounded-lg overflow-hidden", className)}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{ height, display: "block", width: "100%", cursor: "crosshair" }}
        className="bg-gradient-to-b from-wl-bg-elevated to-wl-bg-surface"
      />

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <button
          onClick={() => handleZoom("in")}
          className="w-9 h-9 rounded-md bg-wl-bg-elevated border border-wl-border-default hover:bg-wl-bg-overlay transition-colors flex items-center justify-center text-wl-text-secondary hover:text-wl-text-primary text-sm font-bold"
        >
          +
        </button>
        <button
          onClick={() => handleZoom("out")}
          className="w-9 h-9 rounded-md bg-wl-bg-elevated border border-wl-border-default hover:bg-wl-bg-overlay transition-colors flex items-center justify-center text-wl-text-secondary hover:text-wl-text-primary text-sm font-bold"
        >
          −
        </button>
      </div>

      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <div className="absolute top-4 left-4 flex items-center gap-2 text-xs text-wl-text-secondary z-10">
          <div
            className={cn(
              "w-2 h-2 rounded-full bg-wl-success-400 transition-all",
              refreshing && "scale-150"
            )}
          />
          <span>Live</span>
        </div>
      )}

      {/* Vehicle popup */}
      {selectedVehicle && (
        <div
          className="absolute bg-wl-bg-elevated border border-wl-border-default rounded-lg shadow-lg p-3 z-20 min-w-max"
          style={{
            left: `${Math.min(popupPos.x, canvasSize.width - 250)}px`,
            top: `${Math.min(popupPos.y, canvasSize.height - 200)}px`,
          }}
        >
          <div className="flex justify-between items-start gap-3 mb-2">
            <div>
              <p className="font-semibold text-wl-text-primary text-sm">{selectedVehicle.name}</p>
              {selectedVehicle.driver && (
                <p className="text-xs text-wl-text-secondary">{selectedVehicle.driver}</p>
              )}
            </div>
            <button
              onClick={() => setSelectedVehicle(null)}
              className="text-wl-text-secondary hover:text-wl-text-primary transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex justify-between gap-2 text-xs">
              <span className="text-wl-text-secondary">Speed:</span>
              <span className="text-wl-text-primary font-medium">
                {selectedVehicle.speed} km/h
              </span>
            </div>
            <div className="flex justify-between gap-2 text-xs">
              <span className="text-wl-text-secondary">Heading:</span>
              <span className="text-wl-text-primary font-medium">
                {selectedVehicle.heading}°
              </span>
            </div>
            {selectedVehicle.fuelLevel !== undefined && (
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-wl-text-secondary">Fuel:</span>
                <span className="text-wl-text-primary font-medium">
                  {selectedVehicle.fuelLevel}%
                </span>
              </div>
            )}
            {selectedVehicle.temperature !== undefined && (
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-wl-text-secondary">Temp:</span>
                <span className="text-wl-text-primary font-medium">
                  {selectedVehicle.temperature}°C
                </span>
              </div>
            )}
            <div className="flex justify-between gap-2 text-xs">
              <span className="text-wl-text-secondary">Last Update:</span>
              <span className="text-wl-text-primary font-medium">
                {new Date(selectedVehicle.lastUpdate).toLocaleTimeString()}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <VehicleStatusBadge status={selectedVehicle.status} className="flex-1" />
            <button
              onClick={handleCenterOnVehicle}
              className="px-2 py-1 rounded text-xs bg-wl-primary-500/20 text-wl-primary-400 border border-wl-primary-500/30 hover:bg-wl-primary-500/30 transition-colors"
            >
              Center
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {vehicles.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-wl-text-secondary">
          <svg
            className="w-16 h-16 mb-3 opacity-30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <p className="text-sm">No vehicles to display</p>
        </div>
      )}
    </div>
  );
}
