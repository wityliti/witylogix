/**
 * @witylogix/types — Shared TypeScript types across all apps
 * JIT package: consuming apps transpile directly from src/
 */

// ─── Platform Abstraction Types ──────────────────────────────
// See ADR-014: Platform Source Abstraction

export {
  PlatformSource,
  isPlatformSource,
  getAllPlatforms,
  getPlatformName,
  assertPlatform,
  getPlatformMetadata,
  type ExternalReference,
  type PlatformMetadata,
  type PlatformDiscriminatedReference,
  type PlatformWebhookConfig,
} from "./platform";

// ─── Shopify Types ──────────────────────────────────────────

export interface ShopifyRateRequest {
  rate: {
    origin: ShopifyAddress;
    destination: ShopifyAddress;
    items: ShopifyLineItem[];
    currency: string;
    locale: string;
  };
}

export interface ShopifyAddress {
  country: string;
  postal_code: string;
  province: string;
  city: string;
  name: string | null;
  address1: string;
  address2: string | null;
  address3: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  address_type: string | null;
  company_name: string | null;
}

export interface ShopifyLineItem {
  name: string;
  sku: string;
  quantity: number;
  grams: number;
  price: number;
  vendor: string;
  requires_shipping: boolean;
  taxable: boolean;
  fulfillment_service: string;
  properties: Record<string, string>;
  product_id: number;
  variant_id: number;
}

export interface ShopifyRateResponse {
  rates: ShopifyRate[];
}

export interface ShopifyRate {
  service_name: string;
  service_code: string;
  total_price: string; // in subunits (cents)
  description?: string;
  currency: string;
  min_delivery_date?: string;
  max_delivery_date?: string;
}

// ─── Real-time Tracking Types ───────────────────────────────

export interface DriverLocationUpdate {
  driverId: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  accuracy: number;
  timestamp: number;
}

export interface TrackingState {
  orderId: string;
  status: string;
  driverName: string;
  driverLocation: { lat: number; lng: number } | null;
  estimatedArrival: string | null;
  routeGeometry: [number, number][] | null; // [lng, lat] pairs
  destination: { lat: number; lng: number };
}

// ─── Route Optimization Types ───────────────────────────────

export interface OptimizationRequest {
  depot: { lat: number; lng: number; address: string };
  stops: OptimizationStop[];
  vehicles: OptimizationVehicle[];
  options?: {
    timeLimit?: number; // seconds
    returnToDepot?: boolean;
  };
}

export interface OptimizationStop {
  id: string;
  lat: number;
  lng: number;
  demandUnits?: number;
  timeWindowStart?: string; // ISO datetime
  timeWindowEnd?: string;
  serviceDuration?: number; // seconds
}

export interface OptimizationVehicle {
  id: string;
  capacity: number;
  startLocation?: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
}

export interface OptimizationResult {
  routes: OptimizedRoute[];
  unassigned: string[]; // stop IDs that couldn't be assigned
  totalDistance: number; // meters
  totalDuration: number; // seconds
}

export interface OptimizedRoute {
  vehicleId: string;
  stops: {
    stopId: string;
    sequence: number;
    arrivalTime: string;
    departureTime: string;
    distanceFromPrev: number;
    durationFromPrev: number;
  }[];
  totalDistance: number;
  totalDuration: number;
}

// ─── Notification Types ─────────────────────────────────────

export interface NotificationPayload {
  shopId: string;
  orderId: string;
  eventType: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
  recipient: string;
  templateData: Record<string, unknown>;
}
