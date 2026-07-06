import * as Location from "expo-location";
import { io, Socket } from "socket.io-client";
import { api } from "./api";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export class LocationService {
  private socket: Socket | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private driverId: string | null = null;
  private isTracking = false;

  async startTracking(driverId: string): Promise<void> {
    if (this.isTracking) return;

    this.driverId = driverId;
    this.isTracking = true;

    try {
      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Location permission denied");
      }

      // Start foreground location updates
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Or every 10 meters
        },
        (location) => {
          this.handleLocationUpdate(location);
        },
      );

      // Request background location permissions
      const backgroundStatus =
        await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus.status === "granted") {
        // Background tracking enabled
        console.log("Background location tracking enabled");
      }

      // Initialize Socket.io connection for real-time updates
      this.initializeSocket();
    } catch (error) {
      console.error("Failed to start location tracking:", error);
      this.isTracking = false;
      throw error;
    }
  }

  private initializeSocket(): void {
    if (!this.driverId) return;

    this.socket = io(API_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    this.socket.on("connect", () => {
      console.log("Socket connected");
      this.socket?.emit("driver:tracking", { driverId: this.driverId });
    });

    this.socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    this.socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  }

  private async handleLocationUpdate(
    location: Location.LocationObject,
  ): Promise<void> {
    const update: LocationUpdate = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: Date.now(),
    };

    try {
      // Send via API
      await api.patch(`/api/v4/drivers/${this.driverId}/location`, update);

      // Send via Socket.io if connected
      if (this.socket?.connected) {
        this.socket.emit("driver:location-update", update);
      }
    } catch (error) {
      console.error("Failed to send location update:", error);
    }
  }

  async stopTracking(): Promise<void> {
    if (!this.isTracking) return;

    this.isTracking = false;

    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }
}

export const locationService = new LocationService();
