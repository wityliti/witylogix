/**
 * Platform Science API Client Adapter
 * Handles vehicle telemetry, app marketplace integration,
 * ELD data compliance, custom workflow triggers, and driver communication
 */

import type {
  ITelematicsAdapter,
  TelematicsConfig,
  NormalizedVehicle,
  NormalizedPosition,
  NormalizedDiagnostic,
  NormalizedBehaviorEvent,
  NormalizedFuelReading,
  WebhookSubscription,
  SyncOptions,
} from "./types.js";
import { RateLimiter, CircuitBreaker } from "./telematics-adapter.js";

/**
 * Platform Science Vehicle
 */
interface PlatformScienceVehicle {
  id: string;
  name: string;
  vin?: string;
  licensePlate?: string;
  make?: string;
  model?: string;
  year?: number;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  lastUpdate: string;
}

/**
 * Platform Science Telemetry
 */
interface PlatformScienceTelemetry {
  vehicleId: string;
  timestamp: string;
  gps: {
    latitude: number;
    longitude: number;
    altitude?: number;
    speed: number;
    heading?: number;
    accuracy?: number;
  };
  engine?: {
    running: boolean;
    rpms?: number;
    fuelLevel?: number;
    temperature?: number;
    odometer?: number;
  };
  can?: Record<string, unknown>;
}

/**
 * Platform Science App
 */
interface PlatformScienceApp {
  appId: string;
  name: string;
  version: string;
  category: string;
  status: "AVAILABLE" | "INSTALLED" | "DISABLED";
  permissions: string[];
}

/**
 * Platform Science Driver Workflow
 */
interface PlatformScienceWorkflow {
  workflowId: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "FAILED";
  triggers: Array<{
    type: string;
    condition: string;
  }>;
  actions: Array<{
    type: string;
    target: string;
    parameters: Record<string, unknown>;
  }>;
}

/**
 * Platform Science ELD Log
 */
interface PlatformScienceELDLog {
  logId: string;
  driverId: string;
  status: "OFF_DUTY" | "SLEEPER_BERTH" | "DRIVING" | "ON_DUTY_NOT_DRIVING";
  startTime: string;
  endTime?: string;
  duration: number;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  violations?: Array<{
    type: string;
    severity: string;
    timestamp: string;
  }>;
}

/**
 * Platform Science Driver Communication
 */
interface PlatformScienceMessage {
  messageId: string;
  driverId: string;
  fromId?: string;
  content: string;
  type: "TEXT" | "AUDIO" | "VIDEO" | "DOCUMENT";
  sentAt: string;
  readAt?: string;
  attachments?: Array<{
    url: string;
    mimeType: string;
  }>;
}

/**
 * Platform Science Workflow Trigger
 */
interface PlatformScienceWorkflowTrigger {
  type:
    | "GEOFENCE_ENTRY"
    | "GEOFENCE_EXIT"
    | "HARSH_EVENT"
    | "FATIGUE_ALERT"
    | "ENGINE_FAULT";
  condition: Record<string, unknown>;
}

/**
 * Platform Science API Client
 */
export class PlatformScienceClient implements ITelematicsAdapter {
  private baseUrl = "https://api.platformscience.com/api/v1";
  private clientId: string;
  private clientSecret: string;
  private accessToken: string;
  private accessTokenExpiresAt: number = 0;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private logger: any;

  /**
   * Initialize Platform Science API Client
   * @param config - Telematics configuration with OAuth2 credentials
   */
  constructor(config: TelematicsConfig) {
    const credentials = config.credentials as any;
    if (!credentials?.clientId || !credentials?.clientSecret) {
      throw new Error(
        "Platform Science API requires clientId and clientSecret",
      );
    }

    this.clientId = credentials.clientId;
    this.clientSecret = credentials.clientSecret;
    this.accessToken = "";

    this.rateLimiter = new RateLimiter(config.rateLimit ?? 10);
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
    });

    this.logger = console;
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) {
      return this.accessToken;
    }

    await this.refreshAccessToken();
    return this.accessToken;
  }

  /**
   * Refresh OAuth2 access token
   */
  private async refreshAccessToken(): Promise<void> {
    const url = "https://api.platformscience.com/oauth/token";

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to refresh Platform Science token: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as any;
    this.accessToken = data.access_token;
    this.accessTokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000;
  }

  /**
   * Make authenticated request to Platform Science API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.waitIfNeeded();

      const accessToken = await this.getAccessToken();
      const url = `${this.baseUrl}${path}`;

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(
          `Platform Science API error: ${response.status} ${response.statusText}`,
        );
      }

      return (await response.json()) as T;
    });
  }

  /**
   * Get all vehicles
   */
  async getVehicles(options?: SyncOptions): Promise<NormalizedVehicle[]> {
    try {
      const response = await this.request<{
        vehicles: PlatformScienceVehicle[];
      }>("GET", "/vehicles");

      return response.vehicles.map((vehicle) => this.normalizeVehicle(vehicle));
    } catch (error) {
      this.logger.error("Failed to get vehicles from Platform Science", error);
      return [];
    }
  }

  /**
   * Get vehicle by ID
   */
  async getVehicleById(vehicleId: string): Promise<NormalizedVehicle> {
    const response = await this.request<PlatformScienceVehicle>(
      "GET",
      `/vehicles/${vehicleId}`,
    );

    return this.normalizeVehicle(response);
  }

  /**
   * Get vehicle telemetry
   */
  async getPositions(options?: SyncOptions): Promise<NormalizedPosition[]> {
    try {
      const response = await this.request<{
        telemetry: PlatformScienceTelemetry[];
      }>("GET", "/telemetry");

      return response.telemetry.map((telem) => this.normalizeTelemetry(telem));
    } catch (error) {
      this.logger.error("Failed to get telemetry from Platform Science", error);
      return [];
    }
  }

  /**
   * Get telemetry by vehicle ID
   */
  async getPositionByVehicleId(vehicleId: string): Promise<NormalizedPosition> {
    const response = await this.request<PlatformScienceTelemetry>(
      "GET",
      `/vehicles/${vehicleId}/telemetry`,
    );

    return this.normalizeTelemetry(response);
  }

  /**
   * Get diagnostics
   */
  async getDiagnostics(options?: SyncOptions): Promise<NormalizedDiagnostic[]> {
    try {
      const response = await this.request<{
        diagnostics: Array<{
          vehicleId: string;
          faultCodes: Array<{ code: string; description: string }>;
          timestamp: string;
        }>;
      }>("GET", "/diagnostics");

      return response.diagnostics.map((diag) => ({
        externalVehicleId: diag.vehicleId,
        engineRunning: false,
        faultCodes: diag.faultCodes.map((fc) => ({
          code: fc.code,
          description: fc.description,
          severity: "warning" as const,
        })),
        timestamp: new Date(diag.timestamp),
      }));
    } catch (error) {
      this.logger.error(
        "Failed to get diagnostics from Platform Science",
        error,
      );
      return [];
    }
  }

  /**
   * Get diagnostics by vehicle ID
   */
  async getDiagnosticsByVehicleId(
    vehicleId: string,
  ): Promise<NormalizedDiagnostic> {
    const response = await this.request<{
      faultCodes: Array<{ code: string; description: string }>;
      timestamp: string;
    }>("GET", `/vehicles/${vehicleId}/diagnostics`);

    return {
      externalVehicleId: vehicleId,
      engineRunning: false,
      faultCodes: response.faultCodes.map((fc) => ({
        code: fc.code,
        description: fc.description,
        severity: "warning" as const,
      })),
      timestamp: new Date(response.timestamp),
    };
  }

  /**
   * Get behavior events
   */
  async getBehaviorEvents(
    options?: SyncOptions,
  ): Promise<NormalizedBehaviorEvent[]> {
    // Platform Science integrates events through workflows
    return [];
  }

  /**
   * Get fuel readings
   */
  async getFuelReadings(
    options?: SyncOptions,
  ): Promise<NormalizedFuelReading[]> {
    // Fuel data available through telemetry
    try {
      const positions = await this.getPositions(options);
      return positions.map((pos) => ({
        externalVehicleId: pos.externalVehicleId,
        fuelLevel: 0,
        fuelUnit: "gallons" as const,
        timestamp: pos.timestamp,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get fuel reading by vehicle ID
   */
  async getFuelReadingByVehicleId(
    vehicleId: string,
  ): Promise<NormalizedFuelReading> {
    return {
      externalVehicleId: vehicleId,
      fuelLevel: 0,
      fuelUnit: "gallons",
      timestamp: new Date(),
    };
  }

  /**
   * Get available marketplace apps
   */
  async getMarketplaceApps(): Promise<PlatformScienceApp[]> {
    try {
      const response = await this.request<{
        apps: PlatformScienceApp[];
      }>("GET", "/apps/marketplace");

      return response.apps;
    } catch (error) {
      this.logger.error("Failed to get marketplace apps", error);
      return [];
    }
  }

  /**
   * Install app
   */
  async installApp(appId: string): Promise<PlatformScienceApp> {
    const response = await this.request<PlatformScienceApp>(
      "POST",
      `/apps/${appId}/install`,
      {},
    );

    return response;
  }

  /**
   * Get ELD logs
   */
  async getELDLogs(driverId?: string): Promise<PlatformScienceELDLog[]> {
    try {
      const path = driverId ? `/drivers/${driverId}/eld-logs` : "/eld-logs";
      const response = await this.request<{
        logs: PlatformScienceELDLog[];
      }>("GET", path);

      return response.logs;
    } catch (error) {
      this.logger.error("Failed to get ELD logs", error);
      return [];
    }
  }

  /**
   * Create custom workflow
   */
  async createWorkflow(
    workflow: Omit<PlatformScienceWorkflow, "workflowId">,
  ): Promise<PlatformScienceWorkflow> {
    const response = await this.request<PlatformScienceWorkflow>(
      "POST",
      "/workflows",
      workflow,
    );

    return response;
  }

  /**
   * Get workflows
   */
  async getWorkflows(): Promise<PlatformScienceWorkflow[]> {
    try {
      const response = await this.request<{
        workflows: PlatformScienceWorkflow[];
      }>("GET", "/workflows");

      return response.workflows;
    } catch (error) {
      this.logger.error("Failed to get workflows", error);
      return [];
    }
  }

  /**
   * Trigger custom workflow
   */
  async triggerWorkflow(
    workflowId: string,
    trigger: PlatformScienceWorkflowTrigger,
  ): Promise<Record<string, unknown>> {
    const response = await this.request<Record<string, unknown>>(
      "POST",
      `/workflows/${workflowId}/trigger`,
      trigger,
    );

    return response;
  }

  /**
   * Send message to driver
   */
  async sendMessageToDriver(
    driverId: string,
    message: string,
  ): Promise<PlatformScienceMessage> {
    const response = await this.request<PlatformScienceMessage>(
      "POST",
      `/drivers/${driverId}/messages`,
      { content: message, type: "TEXT" },
    );

    return response;
  }

  /**
   * Get driver messages
   */
  async getDriverMessages(driverId: string): Promise<PlatformScienceMessage[]> {
    try {
      const response = await this.request<{
        messages: PlatformScienceMessage[];
      }>("GET", `/drivers/${driverId}/messages`);

      return response.messages;
    } catch (error) {
      this.logger.error(`Failed to get driver messages for ${driverId}`, error);
      return [];
    }
  }

  /**
   * Subscribe to webhook events
   */
  async subscribeWebhook(subscription: WebhookSubscription): Promise<string> {
    const response = await this.request<{
      subscriptionId: string;
    }>("POST", "/webhooks", subscription);

    return response.subscriptionId;
  }

  /**
   * Unsubscribe from webhook
   */
  async unsubscribeWebhook(subscriptionId: string): Promise<void> {
    await this.request<void>("DELETE", `/webhooks/${subscriptionId}`);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  // ITelematicsAdapter interface implementation

  async authenticate(): Promise<void> {
    await this.healthCheck();
  }

  async getVehiclePosition(vehicleId: string): Promise<NormalizedPosition> {
    return this.getPositionByVehicleId(vehicleId);
  }

  async getVehicleDiagnostics(
    vehicleId: string,
  ): Promise<NormalizedDiagnostic> {
    return this.getDiagnosticsByVehicleId(vehicleId);
  }

  async getDriverBehaviorEvents(
    driverId: string,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<NormalizedBehaviorEvent[]> {
    return this.getBehaviorEvents({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
  }

  async getFuelLevel(vehicleId: string): Promise<NormalizedFuelReading> {
    return this.getFuelReadingByVehicleId(vehicleId);
  }

  async subscribeToEvents(
    webhookUrl: string,
    eventTypes: string[],
  ): Promise<WebhookSubscription> {
    await this.subscribeWebhook({
      webhookId: "",
      url: webhookUrl,
      events: eventTypes,
      createdAt: new Date(),
    });
    return {
      webhookId: `platformscience-${Date.now()}`,
      url: webhookUrl,
      events: eventTypes,
      createdAt: new Date(),
    };
  }

  async unsubscribeFromEvents(webhookId: string): Promise<void> {
    return this.unsubscribeWebhook(webhookId);
  }

  /**
   * Validate connection
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.getVehicles({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize Platform Science vehicle
   */
  private normalizeVehicle(vehicle: PlatformScienceVehicle): NormalizedVehicle {
    return {
      externalVehicleId: vehicle.id,
      name: vehicle.name,
      vin: vehicle.vin,
      licensePlate: vehicle.licensePlate,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      status:
        vehicle.status === "ACTIVE"
          ? "ACTIVE"
          : vehicle.status === "INACTIVE"
            ? "INACTIVE"
            : "DELETED",
    };
  }

  /**
   * Normalize Platform Science telemetry to position
   */
  private normalizeTelemetry(
    telem: PlatformScienceTelemetry,
  ): NormalizedPosition {
    return {
      externalVehicleId: telem.vehicleId,
      latitude: telem.gps.latitude,
      longitude: telem.gps.longitude,
      altitude: telem.gps.altitude,
      speed: {
        value: telem.gps.speed,
        unit: "mph",
      },
      heading: telem.gps.heading,
      accuracy: telem.gps.accuracy,
      timestamp: new Date(telem.timestamp),
    };
  }
}
