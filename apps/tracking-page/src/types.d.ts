export interface Location {
    latitude: number;
    longitude: number;
    timestamp: number;
}
export interface Driver {
    id: string;
    name: string;
    phone: string;
    vehicle: {
        type: string;
        licensePlate: string;
    };
}
export interface Order {
    id: string;
    status: OrderStatus;
    pickupLocation: {
        latitude: number;
        longitude: number;
        address: string;
    };
    deliveryLocation: {
        latitude: number;
        longitude: number;
        address: string;
    };
    eta: number;
    createdAt: number;
    completedAt?: number;
}
export interface TrackingData {
    order: Order;
    driver: Driver;
    currentLocation: Location;
    route: Location[];
    statusHistory: StatusEvent[];
}
export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'ASSIGNED' | 'PICKED_UP' | 'OUT_FOR_DELIVERY' | 'ARRIVED' | 'DELIVERED';
export interface StatusEvent {
    status: OrderStatus;
    timestamp: number;
}
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
//# sourceMappingURL=types.d.ts.map