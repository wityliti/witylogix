/**
 * One Step GPS API Client
 * Real-time tracking, geofences, alerts, driver scorecards, fuel monitoring
 * API key authentication
 */

import type { NormalizedVehicle, NormalizedPosition, NormalizedBehaviorEvent } from './types.js';

/**
 * One Step GPS API Client
 */
export class OneStepGPSClient {
  private apiKey: string;
  private apiUrl: string = 'https://api.onestepgps.com/v1';

  /**
   * Initialize One Step GPS client
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Missing One Step GPS API key');
    }
    this.apiKey = apiKey;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request('GET', '/assets?limit=1');
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
      throw new Error(`One Step GPS API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all assets (vehicles)
   */
  async getVehicles(): Promise<NormalizedVehicle[]> {
    const response = await this.request('GET', '/assets');
    return (response.assets || []).map((asset: any) => ({
      externalVehicleId: asset.id,
      name: asset.name,
      vin: asset.vin,
      licensePlate: asset.plate,
      make: asset.make,
      model: asset.model,
      year: asset.year,
      status: asset.status === 'active' ? 'ACTIVE' : 'INACTIVE',
      odometer: asset.odometer
        ? { value: asset.odometer, unit: 'miles' as const }
        : undefined,
    }));
  }

  /**
   * Get current vehicle position
   */
  async getVehiclePosition(vehicleId: string): Promise<NormalizedPosition> {
    const response = await this.request('GET', `/assets/${vehicleId}/location`);
    return {
      externalVehicleId: vehicleId,
      latitude: response.lat,
      longitude: response.lng,
      altitude: response.altitude,
      speed: response.speed_mph
        ? { value: response.speed_mph, unit: 'mph' as const }
        : undefined,
      heading: response.heading,
      accuracy: response.accuracy,
      timestamp: new Date(response.timestamp),
    };
  }

  /**
   * Get historical positions (playback)
   */
  async getPlayback(
    vehicleId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<NormalizedPosition[]> {
    const queryParams = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });

    const response = await this.request('GET', `/assets/${vehicleId}/playback?${queryParams}`);
    return (response.positions || []).map((pos: any) => ({
      externalVehicleId: vehicleId,
      latitude: pos.lat,
      longitude: pos.lng,
      speed: pos.speed_mph
        ? { value: pos.speed_mph, unit: 'mph' as const }
        : undefined,
      heading: pos.heading,
      timestamp: new Date(pos.timestamp),
    }));
  }

  /**
   * Create geofence
   */
  async createGeofence(name: string, polygon: Array<[number, number]>): Promise<any> {
    const data = {
      name,
      vertices: polygon.map(([lat, lng]) => ({ lat, lng })),
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
   * Create alert rule
   */
  async createAlert(name: string, condition: string): Promise<any> {
    const data = { name, condition };
    const response = await this.request('POST', '/alerts', data);
    return response;
  }

  /**
   * Get driver scorecard
   */
  async getDriverScorecard(driverId: string, period: string = 'month'): Promise<any> {
    const queryParams = new URLSearchParams({ period });
    const response = await this.request('GET', `/drivers/${driverId}/scorecard?${queryParams}`);
    return {
      driverId,
      safetyScore: response.safety_score,
      efficiencyScore: response.efficiency_score,
      complianceScore: response.compliance_score,
      incidents: response.incidents || [],
      period,
    };
  }

  /**
   * Get fuel monitoring data
   */
  async getFuelLevel(vehicleId: string): Promise<any> {
    const response = await this.request('GET', `/assets/${vehicleId}/fuel`);
    return {
      externalVehicleId: vehicleId,
      fuelLevel: response.level_percent,
      fuelUnit: response.unit || 'gallons',
      fuelCapacity: response.capacity,
      timestamp: new Date(response.timestamp),
    };
  }

  /**
   * Get fuel consumption report
   */
  async getFuelConsumption(
    vehicleId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const queryParams = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });
    const response = await this.request('GET', `/assets/${vehicleId}/fuel-consumption?${queryParams}`);
    return {
      vehicleId,
      totalFuelUsed: response.total_fuel,
      averageMpg: response.avg_mpg,
      idlingTime: response.idling_minutes,
      period: { start: startDate, end: endDate },
    };
  }

  /**
   * Get safety events
   */
  async getSafetyEvents(
    vehicleId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<NormalizedBehaviorEvent[]> {
    const queryParams = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });

    const response = await this.request('GET', `/assets/${vehicleId}/safety-events?${queryParams}`);
    return (response.events || []).map((event: any) => ({
      externalEventId: event.id,
      externalVehicleId: vehicleId,
      externalDriverId: event.driver_id,
      eventType: event.type,
      severity: event.severity || 'warning',
      latitude: event.lat,
      longitude: event.lng,
      speed: event.speed_mph
        ? { value: event.speed_mph, unit: 'mph' as const }
        : undefined,
      speedLimit: event.speed_limit_mph
        ? { value: event.speed_limit_mph, unit: 'mph' as const }
        : undefined,
      timestamp: new Date(event.timestamp),
      description: event.description,
    }));
  }
}
