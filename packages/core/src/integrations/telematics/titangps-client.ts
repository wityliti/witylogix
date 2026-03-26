/**
 * Titan GPS API Client
 * Vehicle/asset tracking, geofences, alerts, dashcam integration, utilization reports
 * API key authentication
 */

import type { NormalizedVehicle, NormalizedPosition } from './types.js';

/**
 * Titan GPS API Client
 */
export class TitanGPSClient {
  private apiKey: string;
  private apiUrl: string = 'https://api.tithangps.com/v1';

  /**
   * Initialize Titan GPS client
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Missing Titan GPS API key');
    }
    this.apiKey = apiKey;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request('GET', '/units?limit=1');
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
      throw new Error(`Titan GPS API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all units (vehicles/assets)
   */
  async getVehicles(): Promise<NormalizedVehicle[]> {
    const response = await this.request('GET', '/units');
    return (response.units || []).map((unit: any) => ({
      externalVehicleId: unit.id,
      name: unit.name,
      vin: unit.vin,
      licensePlate: unit.plate,
      make: unit.make,
      model: unit.model,
      year: unit.year,
      status: unit.status === 'online' ? 'ACTIVE' : 'INACTIVE',
      odometer: unit.odometer
        ? { value: unit.odometer, unit: 'miles' as const }
        : undefined,
    }));
  }

  /**
   * Get unit location
   */
  async getVehiclePosition(vehicleId: string): Promise<NormalizedPosition> {
    const response = await this.request('GET', `/units/${vehicleId}/location`);
    return {
      externalVehicleId: vehicleId,
      latitude: response.latitude,
      longitude: response.longitude,
      altitude: response.altitude,
      speed: response.speed_mph
        ? { value: response.speed_mph, unit: 'mph' as const }
        : undefined,
      heading: response.bearing,
      accuracy: response.accuracy,
      timestamp: new Date(response.timestamp),
    };
  }

  /**
   * Get historical track
   */
  async getTrack(
    vehicleId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<NormalizedPosition[]> {
    const queryParams = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });

    const response = await this.request('GET', `/units/${vehicleId}/track?${queryParams}`);
    return (response.track || []).map((point: any) => ({
      externalVehicleId: vehicleId,
      latitude: point.latitude,
      longitude: point.longitude,
      speed: point.speed_mph
        ? { value: point.speed_mph, unit: 'mph' as const }
        : undefined,
      heading: point.bearing,
      timestamp: new Date(point.timestamp),
    }));
  }

  /**
   * Create geofence
   */
  async createGeofence(name: string, polygon: Array<[number, number]>): Promise<any> {
    const data = {
      name,
      polygon: polygon.map(([lat, lng]) => ({ lat, lng })),
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
   * Update geofence
   */
  async updateGeofence(geofenceId: string, data: any): Promise<any> {
    const response = await this.request('PUT', `/geofences/${geofenceId}`, data);
    return response;
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
    type: string,
    config: Record<string, unknown>,
  ): Promise<any> {
    const data = { name, type, config };
    const response = await this.request('POST', '/alerts', data);
    return response;
  }

  /**
   * Get dashcam footage
   */
  async getDashcamFootage(vehicleId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const queryParams = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });

    const response = await this.request('GET', `/units/${vehicleId}/dashcam/footage?${queryParams}`);
    return response.footage || [];
  }

  /**
   * Get dashcam events (accidents, harsh driving)
   */
  async getDashcamEvents(vehicleId: string): Promise<any[]> {
    const response = await this.request('GET', `/units/${vehicleId}/dashcam/events`);
    return response.events || [];
  }

  /**
   * Get fleet utilization report
   */
  async getUtilizationReport(startDate: Date, endDate: Date): Promise<any> {
    const queryParams = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });

    const response = await this.request('GET', `/reports/utilization?${queryParams}`);
    return {
      period: { start: startDate, end: endDate },
      totalUnits: response.total_units,
      activeUnits: response.active_units,
      utilizationRate: response.utilization_rate,
      totalMiles: response.total_miles,
      averageDailyMiles: response.avg_daily_miles,
      idlingTime: response.idling_hours,
      drivingTime: response.driving_hours,
    };
  }

  /**
   * Get maintenance alerts
   */
  async getMaintenanceAlerts(vehicleId?: string): Promise<any[]> {
    const endpoint = vehicleId ? `/units/${vehicleId}/maintenance-alerts` : '/maintenance-alerts';
    const response = await this.request('GET', endpoint);
    return response.alerts || [];
  }

  /**
   * Get fuel report
   */
  async getFuelReport(
    vehicleId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const queryParams = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });

    const response = await this.request('GET', `/units/${vehicleId}/fuel-report?${queryParams}`);
    return {
      vehicleId,
      totalFuelConsumed: response.total_fuel_consumed,
      fuelCost: response.fuel_cost,
      averageMpg: response.avg_mpg,
      fuelGradeVariation: response.fuel_grade_variation,
      period: { start: startDate, end: endDate },
    };
  }

  /**
   * Get driver HOS (Hours of Service) compliance
   */
  async getHOSCompliance(driverId: string, startDate: Date, endDate: Date): Promise<any> {
    const queryParams = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });

    const response = await this.request('GET', `/drivers/${driverId}/hos-compliance?${queryParams}`);
    return {
      driverId,
      compliant: response.compliant,
      violations: response.violations || [],
      onDutyHours: response.on_duty_hours,
      drivingHours: response.driving_hours,
      offDutyHours: response.off_duty_hours,
      sleepHours: response.sleep_hours,
    };
  }
}
