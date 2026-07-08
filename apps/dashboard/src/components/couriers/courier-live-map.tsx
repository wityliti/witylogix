"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { DriverPosition, LocationInfo } from "@witylogix/core/integrations/couriers";

interface Courier {
  id: string;
  name: string;
  partner: "onfleet" | "stuart" | "uber";
  status: "idle" | "en-route" | "delivering" | "returning";
  location: DriverPosition;
  currentDeliveryId?: string;
  rating: number;
}

interface Delivery {
  id: string;
  orderId: string;
  status: string;
  pickup: LocationInfo;
  dropoff: LocationInfo;
  courierId?: string;
}

interface CourierLiveMapProps {
  couriers: Courier[];
  deliveries: Delivery[];
  selectedDeliveryId?: string;
}

interface MapPoint {
  x: number;
  y: number;
}

interface CanvasCoordinates {
  width: number;
  height: number;
  centerLat: number;
  centerLon: number;
  zoom: number;
  pixelsPerDegree: number;
}

export function CourierLiveMap({
  couriers,
  deliveries,
  selectedDeliveryId,
}: CourierLiveMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(12);
  const [center, setCenter] = useState({ lat: 40.7505, lon: -73.9868 });
  const [hoveredCourierId, setHoveredCourierId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Calculate map coordinates
  const getMapCoordinates = useCallback((): CanvasCoordinates => {
    if (!canvasRef.current) {
      return {
        width: 800,
        height: 600,
        centerLat: center.lat,
        centerLon: center.lon,
        zoom,
        pixelsPerDegree: Math.pow(2, zoom) * 256 / 360,
      };
    }

    const canvas = canvasRef.current;
    const pixelsPerDegree = Math.pow(2, zoom) * 256 / 360;

    return {
      width: canvas.width,
      height: canvas.height,
      centerLat: center.lat,
      centerLon: center.lon,
      zoom,
      pixelsPerDegree,
    };
  }, [zoom, center]);

  // Convert lat/lon to canvas coordinates
  const latLonToCanvas = useCallback(
    (lat: number, lon: number): MapPoint => {
      const coords = getMapCoordinates();
      const x = coords.width / 2 + (lon - coords.centerLon) * coords.pixelsPerDegree;
      const y = coords.height / 2 - (lat - coords.centerLat) * coords.pixelsPerDegree;
      return { x, y };
    },
    [getMapCoordinates]
  );

  // Draw the map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.fillStyle = "rgb(17, 24, 39)";
    ctx.fillRect(0, 0, rect.width, rect.height);

    const coords = getMapCoordinates();

    // Draw grid background
    ctx.strokeStyle = "rgb(55, 65, 81)";
    ctx.lineWidth = 0.5;
    const gridSize = 0.1; // degrees
    const startLon = coords.centerLon - coords.width / 2 / coords.pixelsPerDegree;
    const endLon = coords.centerLon + coords.width / 2 / coords.pixelsPerDegree;
    const startLat = coords.centerLat - coords.height / 2 / coords.pixelsPerDegree;
    const endLat = coords.centerLat + coords.height / 2 / coords.pixelsPerDegree;

    for (let lon = Math.floor(startLon * 10) / 10; lon <= endLon; lon += gridSize) {
      const point = latLonToCanvas(coords.centerLat, lon);
      ctx.beginPath();
      ctx.moveTo(point.x, 0);
      ctx.lineTo(point.x, rect.height);
      ctx.stroke();
    }

    for (let lat = Math.floor(startLat * 10) / 10; lat <= endLat; lat += gridSize) {
      const point = latLonToCanvas(lat, coords.centerLon);
      ctx.beginPath();
      ctx.moveTo(0, point.y);
      ctx.lineTo(rect.width, point.y);
      ctx.stroke();
    }

    // Draw delivery points
    deliveries.forEach((delivery) => {
      // Pickup point
      const pickupPoint = latLonToCanvas(delivery.pickup.latitude, delivery.pickup.longitude);
      ctx.fillStyle = delivery.status === "pending" ? "rgb(59, 130, 246)" : "rgb(107, 114, 128)";
      ctx.beginPath();
      ctx.arc(pickupPoint.x, pickupPoint.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgb(17, 24, 39)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Dropoff point
      const dropoffPoint = latLonToCanvas(delivery.dropoff.latitude, delivery.dropoff.longitude);
      ctx.fillStyle = delivery.status === "delivered" ? "rgb(107, 114, 128)" : "rgb(34, 197, 94)";
      ctx.beginPath();
      ctx.arc(dropoffPoint.x, dropoffPoint.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgb(17, 24, 39)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw route line if in transit or delivered
      if (delivery.status === "in_transit" || delivery.status === "delivered") {
        ctx.strokeStyle = delivery.status === "in_transit" ? "rgba(245, 158, 11, 0.5)" : "rgba(107, 114, 128, 0.3)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(pickupPoint.x, pickupPoint.y);
        ctx.lineTo(dropoffPoint.x, dropoffPoint.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Draw couriers
    couriers.forEach((courier) => {
      const point = latLonToCanvas(courier.location.latitude, courier.location.longitude);

      // Courier circle
      const baseRadius = 10;
      const isHovered = hoveredCourierId === courier.id;
      const isSelected = deliveries.find((d) => d.courierId === courier.id)?.id === selectedDeliveryId;
      const radius = isHovered || isSelected ? baseRadius + 2 : baseRadius;

      // Color based on status
      let color = "rgb(107, 114, 128)";
      switch (courier.status) {
        case "idle":
          color = "rgb(107, 114, 128)";
          break;
        case "en-route":
          color = "rgb(59, 130, 246)";
          break;
        case "delivering":
          color = "rgb(245, 158, 11)";
          break;
        case "returning":
          color = "rgb(139, 92, 246)";
          break;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Highlight if hovered or selected
      if (isHovered || isSelected) {
        ctx.strokeStyle = "rgb(34, 197, 94)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.strokeStyle = "rgb(17, 24, 39)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw direction arrow — heading not yet in DriverPosition; default to north (0)
      const angle = 0;
      const arrowLength = 8;
      const arrowX = point.x + Math.cos(angle) * arrowLength;
      const arrowY = point.y + Math.sin(angle) * arrowLength;

      if (courier.status === "en-route" || courier.status === "delivering") {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(arrowX, arrowY);
        ctx.stroke();

        // Draw arrowhead
        const headlen = 3;
        const angle1 = angle + Math.PI / 6;
        const angle2 = angle - Math.PI / 6;
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - headlen * Math.cos(angle1), arrowY - headlen * Math.sin(angle1));
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - headlen * Math.cos(angle2), arrowY - headlen * Math.sin(angle2));
        ctx.stroke();
      }
    });

    // Draw scale
    ctx.fillStyle = "rgb(209, 213, 219)";
    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Zoom: ${zoom}`, 10, rect.height - 10);
  }, [couriers, deliveries, zoom, center, latLonToCanvas, hoveredCourierId, selectedDeliveryId]);

  // Handle canvas mouse move for tooltip
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePos({ x, y });

      // Check if hovering over a courier
      let foundCourier: Courier | null = null;
      for (const courier of couriers) {
        const point = latLonToCanvas(courier.location.latitude, courier.location.longitude);
        const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
        if (distance < 15) {
          foundCourier = courier;
          break;
        }
      }

      setHoveredCourierId(foundCourier?.id || null);
    },
    [couriers, latLonToCanvas]
  );

  // Handle zoom
  const handleZoom = useCallback((direction: "in" | "out") => {
    setZoom((prev) => {
      const newZoom = direction === "in" ? Math.min(prev + 1, 18) : Math.max(prev - 1, 8);
      return newZoom;
    });
  }, []);

  // Handle fullscreen
  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const hoveredCourier = couriers.find((c) => c.id === hoveredCourierId);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-wl-bg-root rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={() => setHoveredCourierId(null)}
        className="w-full h-full cursor-pointer"
      />

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleZoom("in")}
          className="w-10 h-10 p-0 flex items-center justify-center"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleZoom("out")}
          className="w-10 h-10 p-0 flex items-center justify-center"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleFullscreen}
          className="w-10 h-10 p-0 flex items-center justify-center"
          title="Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Tooltip */}
      {hoveredCourier && (
        <div
          ref={tooltipRef}
          className="absolute bg-wl-bg-surface border border-wl-border-default rounded-lg p-3 pointer-events-none z-10"
          style={{
            left: `${mousePos.x + 10}px`,
            top: `${mousePos.y + 10}px`,
          }}
        >
          <div className="space-y-1">
            <p className="font-semibold text-wl-text-primary text-sm">{hoveredCourier.name}</p>
            <p className="text-xs text-wl-text-secondary capitalize">{hoveredCourier.partner}</p>
            <div className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "inline-block w-2 h-2 rounded-full",
                  hoveredCourier.status === "idle" && "bg-wl-bg-overlay",
                  hoveredCourier.status === "en-route" && "bg-blue-500",
                  hoveredCourier.status === "delivering" && "bg-amber-500",
                  hoveredCourier.status === "returning" && "bg-purple-500"
                )}
              />
              <span className="capitalize text-wl-text-secondary">{hoveredCourier.status.replace("-", " ")}</span>
            </div>
            {hoveredCourier.currentDeliveryId && (
              <p className="text-xs text-wl-text-secondary">
                Current: {deliveries.find((d) => d.id === hoveredCourier.currentDeliveryId)?.orderId}
              </p>
            )}
            <div className="pt-1 border-t border-wl-border-subtle flex items-center gap-1">
              <span className="text-xs font-medium text-wl-text-secondary">Rating:</span>
              <span className="text-xs text-wl-warning-400">★ {hoveredCourier.rating.toFixed(1)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-wl-bg-surface/80 border border-wl-border-default rounded-lg p-3 backdrop-blur-sm">
        <div className="space-y-2 text-xs">
          <div className="font-semibold text-wl-text-primary mb-2">Legend</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-wl-text-secondary">Pickup Point</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-wl-text-secondary">Dropoff Point</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-wl-bg-overlay" />
            <span className="text-wl-text-secondary">Idle Courier</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-wl-text-secondary">Delivering</span>
          </div>
        </div>
      </div>
    </div>
  );
}
