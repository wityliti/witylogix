import { useEffect, useRef } from "react";
import L from "leaflet";
import type { DeliveryAddress, DriverLocation } from "../types";

interface TrackingMapProps {
  /** Delivery address — used as a label for the destination marker.
   *  When the API provides geocoded coordinates in future these will be used directly. */
  deliveryLocation: DeliveryAddress;
  /** Driver lat/lng from either the initial response or a socket update. Null when unavailable. */
  driverLocation: DriverLocation | null;
}

function makeDeliveryIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:34px;height:34px;background:#005bd3;border:3px solid white;border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-size:16px;
      box-shadow:0 3px 10px rgba(0,91,211,0.35);">📦</div>`,
    iconSize: [34, 34],
    className: "delivery-marker",
  });
}

function makeDriverIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:38px;height:38px;background:#005bd3;border:3px solid white;border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-size:18px;
      box-shadow:0 3px 12px rgba(0,91,211,0.45);">🚗</div>`,
    iconSize: [38, 38],
    className: "driver-marker",
  });
}

function addressLabel(addr: DeliveryAddress): string {
  return [addr.line1, addr.city].filter(Boolean).join(", ");
}

export function TrackingMap({
  deliveryLocation,
  driverLocation,
}: TrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{
    driver?: L.Marker;
    delivery?: L.Marker;
  }>({});
  // Remember the last driver position so we don't geocode delivery twice
  const lastDriverPos = useRef<{ lat: number; lng: number } | null>(null);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current).setView([20, 0], 2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers whenever driver location changes
  useEffect(() => {
    if (!mapRef.current) return;

    if (!driverLocation) return;

    const driverLatLng: [number, number] = [
      driverLocation.latitude,
      driverLocation.longitude,
    ];
    const isSameDriver =
      lastDriverPos.current?.lat === driverLocation.latitude &&
      lastDriverPos.current?.lng === driverLocation.longitude;

    if (!isSameDriver) {
      lastDriverPos.current = {
        lat: driverLocation.latitude,
        lng: driverLocation.longitude,
      };

      if (markersRef.current.driver) {
        markersRef.current.driver.setLatLng(driverLatLng);
      } else {
        markersRef.current.driver = L.marker(driverLatLng, {
          icon: makeDriverIcon(),
        })
          .addTo(mapRef.current)
          .bindPopup("Driver location");
      }
    }

    // Place delivery marker near driver if no geocode available — use a slight offset
    // so both pins are visible. When real coords land, replace this with them.
    if (!markersRef.current.delivery) {
      const approxDelivery: [number, number] = [
        driverLocation.latitude + 0.01,
        driverLocation.longitude + 0.01,
      ];
      markersRef.current.delivery = L.marker(approxDelivery, {
        icon: makeDeliveryIcon(),
      })
        .addTo(mapRef.current)
        .bindPopup(`Delivery: ${addressLabel(deliveryLocation)}`);
    }

    // Fit bounds to show both markers
    const layers: L.Layer[] = Object.values(markersRef.current).filter(Boolean);
    if (layers.length > 0) {
      const group = new L.FeatureGroup(layers);
      mapRef.current.fitBounds(group.getBounds(), {
        padding: [60, 60],
        maxZoom: 16,
      });
    }
  }, [driverLocation, deliveryLocation]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", minHeight: "300px" }}
    />
  );
}
