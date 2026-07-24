"use client";
/**
 * ShipmentDetailMap — shows origin (hub marker), destination (pin marker),
 * and optionally the live driver location.  Auto-fits bounds to all visible
 * points.
 *
 * Always dynamically imported (ssr: false) from the parent.
 */

import { useRef } from "react";
import { WLMap } from "@/components/map/wl-map";
import { HubLayer } from "@/components/map/hub-layer";
import { ShipmentMarkerLayer } from "@/components/map/shipment-marker-layer";
import { DriverLocationLayer } from "@/components/map/driver-location-layer";
import { RouteLineLayer } from "@/components/map/route-line-layer";
import { useWLMap } from "@/components/map/wl-map-context";
import { fitBounds } from "@/components/map/use-fit-bounds";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GeoPoint {
  lat: number;
  lng: number;
}

interface DriverPoint extends GeoPoint {
  heading?: number | null;
  driverName?: string;
}

export interface ShipmentDetailMapProps {
  destination: GeoPoint | null;
  origin: GeoPoint | null;
  driverLocation: DriverPoint | null;
}

// ── Bounds auto-fitter ────────────────────────────────────────────────────────

interface BoundsFitterProps {
  coords: GeoPoint[];
}

function BoundsFitter({ coords }: BoundsFitterProps) {
  const map = useWLMap();
  const fitted = useRef(false);

  if (!fitted.current && coords.length > 0) {
    fitted.current = true;
    const run = () => fitBounds(map, coords, 80);
    if (map.isStyleLoaded()) run();
    else map.on("load", run);
  }

  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ShipmentDetailMap({
  destination,
  origin,
  driverLocation,
}: ShipmentDetailMapProps) {
  // Collect all non-null coords for auto-fit
  const coords: GeoPoint[] = [destination, origin, driverLocation].filter(
    (c): c is GeoPoint => c != null,
  );

  // Default centre
  const defaultCenter: [number, number] =
    coords.length > 0
      ? [
          coords.reduce((s, c) => s + c.lng, 0) / coords.length,
          coords.reduce((s, c) => s + c.lat, 0) / coords.length,
        ]
      : [55.2708, 25.2048];

  const originHubs = origin
    ? [
        {
          id: "origin",
          name: "Origin",
          lng: origin.lng,
          lat: origin.lat,
          type: "warehouse" as const,
        },
      ]
    : [];

  const destinationMarkers = destination
    ? [
        {
          id: "destination",
          lng: destination.lng,
          lat: destination.lat,
          status: "DELIVERED" as const,
          label: "Delivery",
        },
      ]
    : [];

  return (
    <WLMap center={defaultCenter} zoom={12} className="h-full w-full">
      <BoundsFitter coords={coords} />

      {/* Dashed route line between origin and destination */}
      {origin && destination && (
        <RouteLineLayer origin={origin} destination={destination} />
      )}

      {/* Origin hub marker (warehouse/store) */}
      {originHubs.length > 0 && <HubLayer hubs={originHubs} />}

      {/* Destination delivery marker */}
      {destinationMarkers.length > 0 && (
        <ShipmentMarkerLayer
          markers={destinationMarkers}
          selectedId="destination"
        />
      )}

      {/* Live driver location */}
      {driverLocation && (
        <DriverLocationLayer
          latitude={driverLocation.lat}
          longitude={driverLocation.lng}
          heading={driverLocation.heading}
          driverName={driverLocation.driverName}
        />
      )}
    </WLMap>
  );
}
