import type { Location } from '../types';
interface TrackingMapProps {
    deliveryLocation: {
        latitude: number;
        longitude: number;
    };
    driverLocation: Location | null;
    route: Location[];
    pickupLocation: {
        latitude: number;
        longitude: number;
    };
}
export declare function TrackingMap({ deliveryLocation, driverLocation, route, pickupLocation, }: TrackingMapProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=TrackingMap.d.ts.map