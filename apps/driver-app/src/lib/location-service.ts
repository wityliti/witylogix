/**
 * LocationService - Manages GPS tracking and location data
 */

export interface LocationCoordinate {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp: number;
}

export interface GeofenceArea {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface TrackingStats {
  distanceTraveledKm: number;
  locationsRecorded: number;
  batteryUsagePercent: number;
  trackingDurationMinutes: number;
  averageSpeedKmh: number;
}

const STORAGE_KEY = 'witylogix_locations';
const MAX_STORED_LOCATIONS = 1000;
const EARTH_RADIUS_KM = 6371;

export class LocationService {
  private watchId: number | null = null;
  private locations: LocationCoordinate[] = [];
  private isTracking: boolean = false;
  private trackingStartTime: number = 0;
  private trackingInterval: number = 10000; // 10 seconds default
  private listeners: Set<(location: LocationCoordinate) => void> = new Set();

  constructor() {
    this.loadLocationsFromStorage();
  }

  /**
   * Start GPS tracking
   */
  async startTracking(intervalMs: number = 10000): Promise<void> {
    if (this.isTracking) {
      console.warn('Tracking already in progress');
      return;
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      console.error('Geolocation not available');
      return;
    }

    this.isTracking = true;
    this.trackingStartTime = Date.now();
    this.trackingInterval = intervalMs;

    try {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => this.handleLocationUpdate(position),
        (error) => this.handleLocationError(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } catch (error) {
      console.error('Error starting tracking:', error);
      this.isTracking = false;
    }
  }

  /**
   * Stop GPS tracking
   */
  stopTracking(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
  }

  /**
   * Get current position once
   */
  async getCurrentPosition(): Promise<LocationCoordinate | null> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = this.convertGeolocationPosition(position);
          resolve(location);
        },
        (error) => {
          console.error('Error getting current position:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
        }
      );
    });
  }

  /**
   * Handle location update
   */
  private handleLocationUpdate(position: GeolocationPosition): void {
    const location = this.convertGeolocationPosition(position);
    this.locations.push(location);

    // Trim old locations
    if (this.locations.length > MAX_STORED_LOCATIONS) {
      this.locations.shift();
    }

    this.saveLocationsToStorage();
    this.notifyListeners(location);
  }

  /**
   * Handle location error
   */
  private handleLocationError(error: GeolocationPositionError): void {
    console.error('Geolocation error:', error.code, error.message);
  }

  /**
   * Convert Geolocation position to LocationCoordinate
   */
  private convertGeolocationPosition(position: GeolocationPosition): LocationCoordinate {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude || undefined,
      speed: position.coords.speed || undefined,
      heading: position.coords.heading || undefined,
      timestamp: position.timestamp,
    };
  }

  /**
   * Batch upload locations to server
   */
  async batchUploadLocations(positions: LocationCoordinate[]): Promise<boolean> {
    try {
      const response = await fetch('/api/locations/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          locations: positions,
          uploadedAt: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Error uploading locations:', error);
      return false;
    }
  }

  /**
   * Handle offline locations
   */
  async handleOfflineLocations(): Promise<void> {
    if (this.locations.length === 0) {
      return;
    }

    // Try to upload stored locations
    const success = await this.batchUploadLocations(this.locations);
    if (success) {
      this.locations = [];
      this.saveLocationsToStorage();
    }
  }

  /**
   * Calculate distance traveled using Haversine formula
   */
  calculateDistanceTraveled(positions?: LocationCoordinate[]): number {
    const coords = positions || this.locations;
    if (coords.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < coords.length; i++) {
      totalDistance += this.haversineDistance(coords[i - 1], coords[i]);
    }

    return totalDistance;
  }

  /**
   * Haversine formula to calculate distance between two points
   */
  private haversineDistance(coord1: LocationCoordinate, coord2: LocationCoordinate): number {
    const lat1 = this.degreesToRadians(coord1.latitude);
    const lat2 = this.degreesToRadians(coord2.latitude);
    const deltaLat = this.degreesToRadians(coord2.latitude - coord1.latitude);
    const deltaLon = this.degreesToRadians(coord2.longitude - coord1.longitude);

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
  }

  /**
   * Convert degrees to radians
   */
  private degreesToRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Check if location is within geofence
   */
  isInGeofence(latitude: number, longitude: number, fence: GeofenceArea): boolean {
    const distance = this.haversineDistance(
      { latitude, longitude, accuracy: 0, timestamp: Date.now() },
      {
        latitude: fence.latitude,
        longitude: fence.longitude,
        accuracy: 0,
        timestamp: Date.now(),
      }
    );

    return distance * 1000 <= fence.radiusMeters; // Convert km to meters
  }

  /**
   * Get tracking statistics
   */
  getTrackingStats(): TrackingStats {
    const distanceTraveledKm = this.calculateDistanceTraveled();
    const locationsRecorded = this.locations.length;
    const trackingDurationMinutes = this.isTracking
      ? (Date.now() - this.trackingStartTime) / 60000
      : 0;

    let averageSpeedKmh = 0;
    if (trackingDurationMinutes > 0) {
      averageSpeedKmh = distanceTraveledKm / (trackingDurationMinutes / 60);
    }

    // Estimate battery usage (rough estimate)
    const batteryUsagePercent = Math.min(100, trackingDurationMinutes * 0.5);

    return {
      distanceTraveledKm: Math.round(distanceTraveledKm * 100) / 100,
      locationsRecorded,
      batteryUsagePercent: Math.round(batteryUsagePercent * 10) / 10,
      trackingDurationMinutes: Math.round(trackingDurationMinutes),
      averageSpeedKmh: Math.round(averageSpeedKmh * 100) / 100,
    };
  }

  /**
   * Get all stored locations
   */
  getStoredLocations(): LocationCoordinate[] {
    return [...this.locations];
  }

  /**
   * Clear stored locations
   */
  clearLocations(): void {
    this.locations = [];
    this.saveLocationsToStorage();
  }

  /**
   * Subscribe to location updates
   */
  subscribe(listener: (location: LocationCoordinate) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify listeners of location update
   */
  private notifyListeners(location: LocationCoordinate): void {
    this.listeners.forEach((listener) => listener(location));
  }

  /**
   * Save locations to storage
   */
  private saveLocationsToStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.locations));
    } catch (error) {
      console.error('Failed to save locations to storage:', error);
    }
  }

  /**
   * Load locations from storage
   */
  private loadLocationsFromStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.locations = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load locations from storage:', error);
    }
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Check if tracking is active
   */
  isTrackingActive(): boolean {
    return this.isTracking;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopTracking();
    this.listeners.clear();
  }
}

// Singleton instance
export const locationService = new LocationService();
