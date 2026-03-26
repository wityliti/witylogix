/**
 * @witylogix/types — Shared TypeScript types across all apps
 * JIT package: consuming apps transpile directly from src/
 */
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
    total_price: string;
    description?: string;
    currency: string;
    min_delivery_date?: string;
    max_delivery_date?: string;
}
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
    driverLocation: {
        lat: number;
        lng: number;
    } | null;
    estimatedArrival: string | null;
    routeGeometry: [number, number][] | null;
    destination: {
        lat: number;
        lng: number;
    };
}
export interface OptimizationRequest {
    depot: {
        lat: number;
        lng: number;
        address: string;
    };
    stops: OptimizationStop[];
    vehicles: OptimizationVehicle[];
    options?: {
        timeLimit?: number;
        returnToDepot?: boolean;
    };
}
export interface OptimizationStop {
    id: string;
    lat: number;
    lng: number;
    demandUnits?: number;
    timeWindowStart?: string;
    timeWindowEnd?: string;
    serviceDuration?: number;
}
export interface OptimizationVehicle {
    id: string;
    capacity: number;
    startLocation?: {
        lat: number;
        lng: number;
    };
    endLocation?: {
        lat: number;
        lng: number;
    };
}
export interface OptimizationResult {
    routes: OptimizedRoute[];
    unassigned: string[];
    totalDistance: number;
    totalDuration: number;
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
export interface NotificationPayload {
    shopId: string;
    orderId: string;
    eventType: string;
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
    recipient: string;
    templateData: Record<string, unknown>;
}
//# sourceMappingURL=index.d.ts.map