export declare class LocationService {
    private socket;
    private locationSubscription;
    private driverId;
    private isTracking;
    startTracking(driverId: string): Promise<void>;
    private initializeSocket;
    private handleLocationUpdate;
    stopTracking(): Promise<void>;
    isCurrentlyTracking(): boolean;
}
export declare const locationService: LocationService;
//# sourceMappingURL=location.d.ts.map