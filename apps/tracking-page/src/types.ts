// ─── Public Tracking API Response Types ─────────────────────────────────────
// Matches GET /tracking/token/:trackingToken response shape.
// Driver phone / license plate are intentionally absent — not exposed by public API (PII).

export interface Location {
  latitude: number;
  longitude: number;
  timestamp?: number;
}

export interface DriverInfo {
  name: string;
  vehicleType: string;
}

export interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number | null;
  updatedAt?: string | null;
}

export interface DeliveryAddress {
  line1: string;
  city: string;
  province?: string;
  postalCode?: string;
}

export interface TimeSlotInfo {
  name: string;
  startTime: string;
  endTime: string;
}

export interface ProofOfDelivery {
  photoUrls?: string[];
  recipientName?: string;
  deliveredAt?: string;
}

export interface ShopBranding {
  primaryColor?: string;
  logoUrl?: string;
}

export interface TimelineStep {
  status: string;
  label: string;
  completed: boolean;
  current: boolean;
}

// Shape returned by the API in `response.data`
export interface TrackingResponse {
  orderNumber: string | null;
  status: OrderStatus;
  customerName: string | null;
  deliveryAddress: DeliveryAddress;
  deliveryDate: string | null;
  estimatedArrival: string | null;
  actualDelivery: string | null;
  timeSlot: TimeSlotInfo | null;
  driver: DriverInfo | null;
  driverLocation: DriverLocation | null;
  proofOfDelivery: ProofOfDelivery | null;
  shop: {
    name: string;
    branding: ShopBranding;
  };
  timeline: TimelineStep[];
}

// Internal app state after fetching
export interface TrackingData {
  trackingToken: string;
  response: TrackingResponse;
  // Real-time overlays from socket
  liveDriverLocation?: DriverLocation | null;
}

export interface AIEtaData {
  estimatedArrival: string;
  confidenceLow: string;
  confidenceHigh: string;
  isAIPredicted: boolean;
  lastUpdated: string;
}

// Socket event payloads
export interface LocationUpdate {
  orderId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface StatusUpdate {
  orderId: string;
  status: OrderStatus;
  timestamp: number;
}

export interface ETAUpdate {
  orderId: string;
  eta: number;
}

export type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "ASSIGNED"
  | "PICKED_UP"
  | "OUT_FOR_DELIVERY"
  | "ARRIVED"
  | "DELIVERED"
  | "FAILED"
  | "RETURNED"
  | "CANCELLED";
