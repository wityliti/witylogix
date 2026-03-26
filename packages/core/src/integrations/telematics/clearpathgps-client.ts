/**
 * ClearPathGPS API Client
 * Real-time vehicle tracking, trip history, geofence management, engine diagnostics
 * API key authentication
 */

import type { NormalizedVehicle, NormalizedPosition, NormalizedDiagnostic, TelematicsConnection } from './types.js';

interface ClearPathGPSVehicleData {
  id: string;
  name: string;
  vin?: string;
  licenseplate?: string;
  make?: string;
  model?: string;
  year?: number;
  status: string;
  odometer?: {
    miles: number;
  };
}

interface ClearPathGPSLocationData {
  device_id: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed: number;
  heading?: number;
  accuracy?: number;
  timestamp: string;
}

interface ClearPathGPSDiagnosticData {
  device_id: string;
  engine_running: boolean;
  fault_codes?: Array<{
    code: string;
    description: string;
    severity: string;
  }>;
  vin?: string;
  odometer?: number;
  timestamp: string;
}

/**
 * ClearPathGPS API Client
 */
export class ClearPathGPSClient {
  private apiKey: string;
  private apiUrl: string = 'https://api.clearpathgps.com/v2';

  /**
   * Initialize ClearPathGPS client
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Missing ClearPathGPS API key');
    }
    this.apiKey = apiKey;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request('GET', '/devices?limit=1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Make HTTP request
   */
  private async request(method: string, endpoint: string, body?: unknown): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`ClearPathGPS API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all vehicles
   */
  async getVehicles(): Promise<NormalizedVehicle[]> {
    const response = await this.request('GET', '/devices');
    return (response.devices || []).map((device: ClearPathGPSVehicleData) => ({
      externalVehicleId: device.id,
      name: device.name,
      vin: device.vin,
      licensePlate: device.licenseplate,
      make: device.make,
      model: device.model,
      year: device.year,
      status: device.status === 'active' ? 'ACTIVE' : 'INACTIVE',
      odometer: device.odometer
        ? { value: device.odometer.miles, unit: 'miles' as const }
        : undefined,
    }));
  }

  /**
   * Get vehicle position
   */
  async getVehiclePosition(vehicleId: string): Promise<NormalizedPosition> {
    const response = await this.request('GET', `/devices/${vehicleId}/location`);
    return {
      externalVehicleId: response.device_id,
      latitude: response.latitude,
      longitude: response.longitude,
      altitude: response.altitude,
      speed: response.speed
        ? { value: response.speed, unit: 'mph' as const }
        : undefined,
      heading: response.heading,
      accuracy: response.accuracy,
      timestamp: new Date(response.timestamp),
    };
  }

  /**
   * Get vehicle diagnostics
   */
  async getVehicleDiagnostics(vehicleId: string): Promise<NormalizedDiagnostic> {
    const response = await this.request('GET', `/devices/${vehicleId}/diagnostics`);
    return {
      externalVehicleId: response.device_id,
      engineRunning: response.engine_running,
      faultCodes: (response.fault_codes || []).map((fc: any) => ({
        code: fc.code,
        description: fc.description,
        severity: fc.severity || 'warning',
      })),
      vin: response.vin,
      odometer: response.odometer
        ? { value: response.odometer, unit: 'miles' as const }
        : undefined,
      timestamp: new Date(response.timestamp),
    };
  }

  /**
   * Get trip history
   */
  async getTripHistory(
    vehicleId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    const queryParams = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });
    const response = await this.request('GET', `/devices/${vehicleId}/trips?${queryParams}`);
    return response.trips || [];
  }

  /**
   * Create geofence
   */
  async createGeofence(
    name: string,
    polygon: Array<[number, number]>,
  ): Promise<any> {
    const data = {
      name,
      coordinates: polygon.map(([lat, lng]) => ({ latitude: lat, longitude: lng })),
    };
    const response = await this.request('POST', '/geofences', data);
    return response;
  }

  /**
   * List geofences
   */
  async listGeofences(): Promise<any[]> {
    const response = await this.request('GET', '/geofences');
    return response.geofences || [];
  }

  /**
   * Delete geofence
   */
  async deleteGeofence(geofenceId: string): Promise<void> {
    await this.request('DELETE', `/geofences/${geofenceId}`);
  }

  /**
   * Create alert
   */
  async createAlert(
    name: string,
    condition: string,
    notificationMethods: string[],
  ): Promise<any> {
    const data = {
      name,
      condition,
      notificationMethods,
    };
    const response = await this.request('POST', '/alerts', data);
    return response;
  }

  /**
   * List alerts
   */
  async listAlerts(): Promise<any[]> {
    const response = await this.request('GET', '/alerts');
    return response.alerts || [];
  }

  /**
   * Get fuel monitor status
   */
  async getFuelLevel(vehicleId: string): Promise<any> {
    const response = await this.request('GET', `/devices/${vehicleId}/fuel`);
    return {
      externalVehicleId: response.device_id,
      fuelLevel: response.level_percent,
      fuelUnit: 'gallons',
      timestamp: new Date(response.timestamp),
    };
  }
}
