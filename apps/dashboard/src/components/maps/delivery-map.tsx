"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

// Conditional Mapbox GL JS import
// Note: mapbox-gl must be installed via: npm install mapbox-gl
// Add to package.json if not present
let mapboxgl: any;
let MapMouseEvent: any;

try {
  const mapboxModule = require("mapbox-gl");
  mapboxgl = mapboxModule.default || mapboxModule;
  MapMouseEvent = mapboxModule.MapMouseEvent;
} catch (err) {
  console.warn(
    "Mapbox GL JS not installed. Install with: npm install mapbox-gl"
  );
}
import { DriverPopover } from "./driver-popover";
import { MapControls } from "./map-controls";
import { MapLegend } from "./map-legend";
import type { DeliveryMapProps, Driver, Delivery } from "./delivery-types";

// Placeholder token - replace with actual token in production
const MAPBOX_TOKEN = "MAPBOX_TOKEN_PLACEHOLDER";

/**
 * DeliveryMap Component
 *
 * Core map component using Mapbox GL JS for real-time delivery tracking.
 * Features:
 * - Driver markers colored by status
 * - Delivery point markers (pickup/dropoff/completed)
 * - Animated route polylines
 * - Click handlers for markers
 * - Clustering at low zoom levels
 * - Auto-center on active delivery area
 */
export function DeliveryMap({
  drivers,
  deliveries,
  selectedDriverId,
  selectedDeliveryId,
  onDriverSelect,
  onDeliverySelect,
}: DeliveryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<"street" | "satellite" | "terrain">(
    "street"
  );
  const [popover, setPopover] = useState<{
    driver: Driver;
    position: { x: number; y: number };
  } | null>(null);

  const driversRef = useRef(drivers);
  const deliveriesRef = useRef(deliveries);

  useEffect(() => {
    driversRef.current = drivers;
  }, [drivers]);

  useEffect(() => {
    deliveriesRef.current = deliveries;
  }, [deliveries]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-74.006, 40.7128],
      zoom: 11,
      pitch: 0,
      bearing: 0,
    });

    map.current.on("load", () => {
      setMapLoaded(true);

      // Add sources
      map.current?.addSource("drivers", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.current?.addSource("deliveries", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.current?.addSource("routes", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      // Add layers
      // Driver clusters
      map.current?.addLayer({
        id: "driver-clusters",
        type: "circle",
        source: "drivers",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#3b82f6",
          "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40],
          "circle-opacity": 0.8,
        },
      });

      // Cluster text
      map.current?.addLayer({
        id: "driver-cluster-count",
        type: "symbol",
        source: "drivers",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count"],
          "text-font": ["DIN Offc Pro Medium"],
          "text-size": 12,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // Individual drivers
      map.current?.addLayer({
        id: "driver-markers",
        type: "circle",
        source: "drivers",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 12,
          "circle-color": [
            "match",
            ["get", "status"],
            "available",
            "#10b981",
            "en-route",
            "#3b82f6",
            "delivering",
            "#f97316",
            "offline",
            "#6b7280",
            "#9ca3af",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.9,
        },
      });

      // Delivery pickup points
      map.current?.addLayer({
        id: "delivery-pickups",
        type: "symbol",
        source: "deliveries",
        filter: ["==", ["get", "type"], "pickup"],
        layout: {
          "icon-image": "delivery-pickup",
          "icon-size": 1.2,
          "icon-allow-overlap": true,
        },
      });

      // Delivery dropoff points
      map.current?.addLayer({
        id: "delivery-dropoffs",
        type: "circle",
        source: "deliveries",
        filter: ["==", ["get", "type"], "dropoff"],
        paint: {
          "circle-radius": 10,
          "circle-color": "#10b981",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.8,
        },
      });

      // Completed deliveries
      map.current?.addLayer({
        id: "delivery-completed",
        type: "symbol",
        source: "deliveries",
        filter: ["==", ["get", "type"], "completed"],
        layout: {
          "icon-image": "delivery-completed",
          "icon-size": 1.2,
          "icon-allow-overlap": true,
        },
      });

      // Planned routes (dashed blue line)
      map.current?.addLayer({
        id: "routes-planned",
        type: "line",
        source: "routes",
        filter: ["==", ["get", "type"], "planned"],
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#3b82f6",
          "line-width": 3,
          "line-dasharray": [2, 2],
          "line-opacity": 0.6,
        },
      });

      // Completed routes (solid blue line)
      map.current?.addLayer({
        id: "routes-completed",
        type: "line",
        source: "routes",
        filter: ["==", ["get", "type"], "completed"],
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#10b981",
          "line-width": 2,
          "line-opacity": 0.8,
        },
      });

      // Click handlers
      map.current?.on("click", "driver-markers", (e: MapMouseEvent) => {
        const feature = e.features?.[0];
        if (feature?.properties) {
          const driverId = feature.properties.id;
          onDriverSelect(driverId);

          // Show popover
          const canvas = map.current?.getCanvas();
          if (canvas) {
            const driver = driversRef.current.find((d) => d.id === driverId);
            if (driver) {
              setPopover({
                driver,
                position: { x: e.originalEvent.clientX, y: e.originalEvent.clientY },
              });
            }
          }
        }
      });

      map.current?.on("click", "delivery-pickups", (e: MapMouseEvent) => {
        const feature = e.features?.[0];
        if (feature?.properties) {
          const deliveryId = feature.properties.id;
          onDeliverySelect(deliveryId);
        }
      });

      map.current?.on("click", "delivery-dropoffs", (e: MapMouseEvent) => {
        const feature = e.features?.[0];
        if (feature?.properties) {
          const deliveryId = feature.properties.id;
          onDeliverySelect(deliveryId);
        }
      });

      // Change cursor on hover
      map.current?.on("mouseenter", "driver-markers", () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "pointer";
        }
      });

      map.current?.on("mouseleave", "driver-markers", () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "";
        }
      });

      map.current?.on("mouseenter", "delivery-dropoffs", () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "pointer";
        }
      });

      map.current?.on("mouseleave", "delivery-dropoffs", () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = "";
        }
      });
    });

    return () => {
      map.current?.remove();
    };
  }, [onDriverSelect, onDeliverySelect]);

  // Update driver markers
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    const features = drivers.map((driver) => ({
      type: "Feature" as const,
      properties: {
        id: driver.id,
        name: driver.name,
        status: driver.status,
        speed: driver.speed,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [driver.location.longitude, driver.location.latitude],
      },
    }));

    const source = map.current.getSource("drivers") as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: "FeatureCollection" as const,
        features: features,
      });
    }
  }, [drivers, mapLoaded]);

  // Update delivery markers
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    const pickups = deliveries
      .filter((d) => d.status !== "completed")
      .map((delivery) => ({
        type: "Feature" as const,
        properties: {
          id: delivery.id,
          type: "pickup",
          orderId: delivery.orderId,
          customerName: delivery.customerName,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [
            delivery.pickupLocation.longitude,
            delivery.pickupLocation.latitude,
          ],
        },
      }));

    const dropoffs = deliveries
      .filter((d) => d.status !== "completed")
      .map((delivery) => ({
        type: "Feature" as const,
        properties: {
          id: delivery.id,
          type: "dropoff",
          orderId: delivery.orderId,
          customerName: delivery.customerName,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [
            delivery.dropoffLocation.longitude,
            delivery.dropoffLocation.latitude,
          ],
        },
      }));

    const completed = deliveries
      .filter((d) => d.status === "completed")
      .map((delivery) => ({
        type: "Feature" as const,
        properties: {
          id: delivery.id,
          type: "completed",
          orderId: delivery.orderId,
          customerName: delivery.customerName,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [
            delivery.dropoffLocation.longitude,
            delivery.dropoffLocation.latitude,
          ],
        },
      }));

    const source = map.current.getSource("deliveries") as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (source) {
      source.setData({
        type: "FeatureCollection" as const,
        features: [...pickups, ...dropoffs, ...completed],
      });
    }
  }, [deliveries, mapLoaded]);

  // Update routes
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    const routeFeatures = deliveries
      .filter((d) => d.driverId)
      .map((delivery) => {
        const routeType = delivery.status === "completed" ? "completed" : "planned";

        return {
          type: "Feature" as const,
          properties: {
            deliveryId: delivery.id,
            type: routeType,
          },
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [
                delivery.pickupLocation.longitude,
                delivery.pickupLocation.latitude,
              ],
              [
                delivery.dropoffLocation.longitude,
                delivery.dropoffLocation.latitude,
              ],
            ],
          },
        };
      });

    const source = map.current.getSource("routes") as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (source) {
      source.setData({
        type: "FeatureCollection" as const,
        features: routeFeatures,
      });
    }
  }, [deliveries, mapLoaded]);

  // Auto-center on selected delivery
  useEffect(() => {
    if (!mapLoaded || !map.current || !selectedDeliveryId) return;

    const delivery = deliveries.find((d) => d.id === selectedDeliveryId);
    if (delivery) {
      const bounds = new mapboxgl.LngLatBounds()
        .extend([
          delivery.pickupLocation.longitude,
          delivery.pickupLocation.latitude,
        ])
        .extend([
          delivery.dropoffLocation.longitude,
          delivery.dropoffLocation.latitude,
        ]);

      map.current.fitBounds(bounds, {
        padding: 100,
        duration: 1000,
      });
    }
  }, [selectedDeliveryId, deliveries, mapLoaded]);

  // Auto-center on selected driver
  useEffect(() => {
    if (!mapLoaded || !map.current || !selectedDriverId) return;

    const driver = drivers.find((d) => d.id === selectedDriverId);
    if (driver) {
      map.current.flyTo({
        center: [driver.location.longitude, driver.location.latitude],
        zoom: 13,
        duration: 1000,
      });
    }
  }, [selectedDriverId, drivers, mapLoaded]);

  const handleLayerChange = useCallback((layer: "street" | "satellite" | "terrain") => {
    if (!map.current) return;

    const styleMap = {
      street: "mapbox://styles/mapbox/dark-v11",
      satellite: "mapbox://styles/mapbox/satellite-streets-v12",
      terrain: "mapbox://styles/mapbox/outdoors-v12",
    };

    map.current.setStyle(styleMap[layer]);
    setCurrentLayer(layer);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (map.current) {
      map.current.zoomTo(map.current.getZoom() + 1, { duration: 500 });
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (map.current) {
      map.current.zoomTo(map.current.getZoom() - 1, { duration: 500 });
    }
  }, []);

  const handleFullscreen = useCallback(() => {
    if (mapContainer.current) {
      mapContainer.current.requestFullscreen?.();
    }
  }, []);

  const handleCenterAll = useCallback(() => {
    if (!map.current || drivers.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    drivers.forEach((driver) => {
      bounds.extend([
        driver.location.longitude,
        driver.location.latitude,
      ]);
    });

    map.current.fitBounds(bounds, { padding: 50, duration: 1000 });
  }, [drivers]);

  const handleCenterSelected = useCallback(() => {
    if (!selectedDriverId) {
      handleCenterAll();
      return;
    }

    const driver = drivers.find((d) => d.id === selectedDriverId);
    if (driver && map.current) {
      map.current.flyTo({
        center: [driver.location.longitude, driver.location.latitude],
        zoom: 13,
        duration: 1000,
      });
    }
  }, [selectedDriverId, drivers, handleCenterAll]);

  const selectedDriver = selectedDriverId
    ? drivers.find((d) => d.id === selectedDriverId)
    : null;
  const selectedDelivery = selectedDeliveryId
    ? deliveries.find((d) => d.id === selectedDeliveryId)
    : null;

  return (
    <div className={cn("relative w-full h-full bg-wl-bg-surface")}>
      {/* Map container */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Map Controls */}
      {mapLoaded && (
        <>
          <div className="absolute bottom-6 left-6 z-10">
            <MapControls
              currentLayer={currentLayer}
              onLayerChange={handleLayerChange}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFullscreen={handleFullscreen}
              onCenterAll={handleCenterAll}
              onCenterSelected={handleCenterSelected}
            />
          </div>

          {/* Map Legend */}
          <div className="absolute top-4 right-4 z-10">
            <MapLegend />
          </div>

          {/* Driver Popover */}
          {popover && selectedDelivery && (
            <DriverPopover
              driver={popover.driver}
              delivery={selectedDelivery}
              position={popover.position}
              onClose={() => setPopover(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
