/**
 * Delivery Map Types
 *
 * Type definitions for delivery tracking components.
 */

export type DriverStatus = "available" | "en-route" | "delivering" | "offline";
export type DeliveryStatus = "pending" | "en-route" | "delivering" | "completed" | "cancelled";

export interface Location {
  latitude: number;
  longitude: number;
}

export interface Driver {
  id: string;
  name: string;
  photo: string;
  status: DriverStatus;
  location: Location;
  speed: number; // km/h
  phone: string;
  currentDeliveryId: string | null;
  eta: Date | null;
}

export interface Delivery {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  driverId: string | null;
  status: DeliveryStatus;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLocation: Location;
  dropoffLocation: Location;
  eta: Date | null;
  progress: number; // 0-100%
  createdAt: Date;
}

export interface DeliveryMapProps {
  drivers: Driver[];
  deliveries: Delivery[];
  selectedDriverId: string | null;
  selectedDeliveryId: string | null;
  onDriverSelect: (driverId: string) => void;
  onDeliverySelect: (deliveryId: string) => void;
}

export interface DriverPopoverProps {
  driver: Driver;
  delivery: Delivery | null;
  position: { x: number; y: number };
  onClose: () => void;
  onReassign?: (driverId: string) => void;
  onMessage?: (driverId: string) => void;
}

export interface MapControlsProps {
  onLayerChange: (layer: "street" | "satellite" | "terrain") => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFullscreen: () => void;
  onCenterAll: () => void;
  onCenterSelected: (driverId: string | null) => void;
  currentLayer: "street" | "satellite" | "terrain";
}

export interface DeliverySidebarProps {
  deliveries: Delivery[];
  selectedDeliveryId: string | null;
  onSelectDelivery: (deliveryId: string) => void;
}

export interface GeoJSONDriverFeature {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    status: DriverStatus;
    speed: number;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
}

export interface GeoJSONDeliveryFeature {
  type: "Feature";
  properties: {
    id: string;
    type: "pickup" | "dropoff" | "completed";
    orderId: string;
    customerName: string;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
}

export interface GeoJSONRouteFeature {
  type: "Feature";
  properties: {
    deliveryId: string;
    type: "planned" | "completed";
  };
  geometry: {
    type: "LineString";
    coordinates: Array<[number, number]>; // [lng, lat][]
  };
}

export interface MapTrackingEvent {
  type: "position_update" | "status_change" | "delivery_update";
  driverId: string;
  data: Partial<Driver>;
}
