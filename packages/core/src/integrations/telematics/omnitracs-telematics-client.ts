/**
 * Omnitracs API Client Adapter
 * Handles fleet intelligence, critical event video, driver workflow,
 * dispatch integration, and ELD/HOS data access
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
 * Omnitracs Vehicle Response
 */
interface OmnitrocsVehicle {
  vehicleId: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  licensePlate?: string;
  status: "ACTIVE" | "INACTIVE";
  lastUpdate: string;
}

/**
 * Omnitracs Vehicle Position (Breadcrumb)
 */
interface OmnitracsBreadcrumb {
  vehicleId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading?: number;
  accuracy?: number;
}

/**
 * Omnitracs Critical Event
 */
interface OmnitracsCriticalEvent {
  eventId: string;
  vehicleId: string;
  eventType:
    | "HARSH_ACCELERATION"
    | "HARSH_BRAKING"
    | "HARSH_TURN"
    | "COLLISION"
    | "ROLLOVER";
  severity: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  speed: number;
  videoUrl?: string;
  driverFacingVideoUrl?: string;
  roadFacingVideoUrl?: string;
}

/**
 * Omnitracs Driver Status
 */
interface OmnitrocsDriverStatus {
  driverId: string;
  vehicleId?: string;
  status: "OFF_DUTY" | "SLEEPER_BERTH" | "DRIVING" | "ON_DUTY_NOT_DRIVING";
  statusChangeTime: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  hoursOfService: {
    offDuty: number;
    sleeperBerth: number;
    driving: number;
    onDutyNotDriving: number;
    totalAvailableHours: number;
  };
}

/**
 * Omnitracs Form
 */
interface OmnitrocsForm {
  formId: string;
  driverId: string;
  formType: string;
  submittedAt: string;
  data: Record<string, unknown>;
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";
}

/**
 * Omnitracs Message
 */
interface OmnitrocsMessage {
  messageId: string;
  driverId: string;
  content: string;
  type: "TEXT" | "VOICE" | "ALERT";
  sentAt: string;
  readAt?: string;
}

/**
 * Omnitracs Dispatch Order
 */
interface OmnitrocsDispatchOrder {
  orderId: string;
  driverId?: string;
  vehicleId?: string;
  pickupLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  dropoffLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  status: "NEW" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  completedAt?: string;
}

/**
 * Omnitracs API Client
 */
export class OmnitrocsClient implements ITelematicsAdapter {
  private baseUrl = "https://api.omnitracs.com/v1";
  private clientId: string;
  private clientSecret: string;
  private accessToken: string;
  private accessTokenExpiresAt: number = 0;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private logger: any;

  /**
   * Initialize Omnitracs API Client
   * @param config - Telematics configuration with OAuth2 credentials
   */
  constructor(config: TelematicsConfig) {
    const credentials = config.credentials as any;
    if (!credentials?.clientId || !credentials?.clientSecret) {
      throw new Error("Omnitracs API requires clientId and clientSecret");
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
    const url = "https://auth.omnitracs.com/oauth/token";
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      "base64",
    );

    const body = new URLSearchParams({
      grant_type: "client_credentials",
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to refresh Omnitracs token: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as any;
    this.accessToken = data.access_token;
    this.accessTokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000;
  }

  /**
   * Make authenticated request to Omnitracs API
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
          `Omnitracs API error: ${response.status} ${response.statusText}`,
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
        vehicles: OmnitrocsVehicle[];
      }>("GET", "/vehicles");

      return response.vehicles.map((vehicle) => this.normalizeVehicle(vehicle));
    } catch (error) {
      this.logger.error("Failed to get vehicles from Omnitracs", error);
      return [];
    }
  }

  /**
   * Get vehicle by ID
   */
  async getVehicleById(vehicleId: string): Promise<NormalizedVehicle> {
    const response = await this.request<OmnitrocsVehicle>(
      "GET",
      `/vehicles/${vehicleId}`,
    );

    return this.normalizeVehicle(response);
  }

  /**
   * Get vehicle positions (breadcrumbs)
   */
  async getPositions(options?: SyncOptions): Promise<NormalizedPosition[]> {
    try {
      const response = await this.request<{
        breadcrumbs: OmnitracsBreadcrumb[];
      }>("GET", "/fleet/breadcrumbs");

      return response.breadcrumbs.map((bc) => this.normalizeBreadcrumb(bc));
    } catch (error) {
      this.logger.error("Failed to get positions from Omnitracs", error);
      return [];
    }
  }

  /**
   * Get position by vehicle ID
   */
  async getPositionByVehicleId(vehicleId: string): Promise<NormalizedPosition> {
    const response = await this.request<OmnitracsBreadcrumb>(
      "GET",
      `/vehicles/${vehicleId}/breadcrumb`,
    );

    return this.normalizeBreadcrumb(response);
  }

  /**
   * Get diagnostics
   */
  async getDiagnostics(options?: SyncOptions): Promise<NormalizedDiagnostic[]> {
    // Omnitracs doesn't expose raw diagnostics; critical events serve that purpose
    return [];
  }

  /**
   * Get diagnostics by vehicle ID
   */
  async getDiagnosticsByVehicleId(
    vehicleId: string,
  ): Promise<NormalizedDiagnostic> {
    return {
      externalVehicleId: vehicleId,
      engineRunning: false,
      faultCodes: [],
      timestamp: new Date(),
    };
  }

  /**
   * Get critical events (behavior)
   */
  async getBehaviorEvents(
    options?: SyncOptions,
  ): Promise<NormalizedBehaviorEvent[]> {
    try {
      const response = await this.request<{
        events: OmnitracsCriticalEvent[];
      }>("GET", "/fleet/events");

      return response.events.map((event) => this.normalizeCriticalEvent(event));
    } catch (error) {
      this.logger.error("Failed to get behavior events from Omnitracs", error);
      return [];
    }
  }

  /**
   * Get fuel readings
   */
  async getFuelReadings(
    options?: SyncOptions,
  ): Promise<NormalizedFuelReading[]> {
    // Omnitracs doesn't provide fuel data directly
    return [];
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
   * Get driver status (HOS)
   */
  async getDriverStatus(driverId: string): Promise<OmnitrocsDriverStatus> {
    const response = await this.request<OmnitrocsDriverStatus>(
      "GET",
      `/drivers/${driverId}/status`,
    );

    return response;
  }

  /**
   * Get all driver statuses
   */
  async getDriverStatuses(): Promise<OmnitrocsDriverStatus[]> {
    try {
      const response = await this.request<{
        drivers: OmnitrocsDriverStatus[];
      }>("GET", "/drivers/status");

      return response.drivers;
    } catch (error) {
      this.logger.error("Failed to get driver statuses", error);
      return [];
    }
  }

  /**
   * Submit driver form
   */
  async submitDriverForm(
    form: Omit<OmnitrocsForm, "formId">,
  ): Promise<OmnitrocsForm> {
    const response = await this.request<OmnitrocsForm>(
      "POST",
      "/drivers/forms",
      form,
    );

    return response;
  }

  /**
   * Send message to driver
   */
  async sendMessageToDriver(
    driverId: string,
    message: string,
  ): Promise<OmnitrocsMessage> {
    const response = await this.request<OmnitrocsMessage>(
      "POST",
      `/drivers/${driverId}/messages`,
      { content: message, type: "TEXT" },
    );

    return response;
  }

  /**
   * Get dispatch orders
   */
  async getDispatchOrders(): Promise<OmnitrocsDispatchOrder[]> {
    try {
      const response = await this.request<{
        orders: OmnitrocsDispatchOrder[];
      }>("GET", "/dispatch/orders");

      return response.orders;
    } catch (error) {
      this.logger.error("Failed to get dispatch orders", error);
      return [];
    }
  }

  /**
   * Create dispatch order
   */
  async createDispatchOrder(
    order: Omit<OmnitrocsDispatchOrder, "orderId" | "createdAt">,
  ): Promise<OmnitrocsDispatchOrder> {
    const response = await this.request<OmnitrocsDispatchOrder>(
      "POST",
      "/dispatch/orders",
      order,
    );

    return response;
  }

  /**
   * Assign dispatch order to driver/vehicle
   */
  async assignDispatchOrder(
    orderId: string,
    driverId: string,
    vehicleId: string,
  ): Promise<OmnitrocsDispatchOrder> {
    const response = await this.request<OmnitrocsDispatchOrder>(
      "PUT",
      `/dispatch/orders/${orderId}/assign`,
      { driverId, vehicleId },
    );

    return response;
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
      webhookId: `omnitracs-${Date.now()}`,
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
   * Normalize Omnitracs vehicle
   */
  private normalizeVehicle(vehicle: OmnitrocsVehicle): NormalizedVehicle {
    return {
      externalVehicleId: vehicle.vehicleId,
      name: vehicle.name,
      vin: vehicle.vin,
      licensePlate: vehicle.licensePlate,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      status: vehicle.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
    };
  }

  /**
   * Normalize Omnitracs breadcrumb to position
   */
  private normalizeBreadcrumb(bc: OmnitracsBreadcrumb): NormalizedPosition {
    return {
      externalVehicleId: bc.vehicleId,
      latitude: bc.latitude,
      longitude: bc.longitude,
      speed: { value: bc.speed, unit: "mph" },
      heading: bc.heading,
      accuracy: bc.accuracy,
      timestamp: new Date(bc.timestamp),
    };
  }

  /**
   * Normalize Omnitracs critical event to behavior event
   */
  private normalizeCriticalEvent(
    event: OmnitracsCriticalEvent,
  ): NormalizedBehaviorEvent {
    const eventTypeMap: Record<string, any> = {
      HARSH_ACCELERATION: "rapid_acceleration",
      HARSH_BRAKING: "harsh_braking",
      HARSH_TURN: "harsh_turn",
      COLLISION: "collision",
      ROLLOVER: "rollover",
    };

    return {
      externalEventId: event.eventId,
      externalVehicleId: event.vehicleId,
      eventType: eventTypeMap[event.eventType] || "harsh_acceleration",
      severity: event.severity === "CRITICAL" ? "critical" : "warning",
      latitude: event.latitude,
      longitude: event.longitude,
      speed: { value: event.speed, unit: "mph" },
      timestamp: new Date(event.timestamp),
    };
  }
}
