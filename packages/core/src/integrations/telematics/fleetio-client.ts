/**
 * Fleetio REST API v2 Adapter
 * Fleet maintenance & asset management platform
 * Supports: vehicles, service entries, fuel entries, inspections, parts, contacts, work orders, meters, assignments, expenses, webhooks
 */

import type {
  TelematicsConfig,
  NormalizedVehicle,
  NormalizedPosition,
  NormalizedDiagnostic,
  NormalizedBehaviorEvent,
  NormalizedFuelReading,
  WebhookSubscription,
} from "./types.js";
import { TelematicsAdapter } from "./telematics-adapter.js";
import { TelematicsNormalizer } from "./telematics-normalizer.js";

/**
 * Fleetio API Error
 */
class FleetioAPIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "FleetioAPIError";
  }
}

/**
 * Fleetio Vehicle
 */
interface FleetioVehicle {
  id: string;
  name: string;
  vin: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  groupId?: string;
  status: string;
  customFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fleetio Service Entry
 */
interface FleetioServiceEntry {
  id: string;
  vehicleId: string;
  serviceDate: string;
  odometer: number;
  notes: string;
  cost: number;
  laborCost: number;
  partsCost: number;
  technicianId?: string;
  parts: Array<{
    id: string;
    name: string;
    quantity: number;
    unitCost: number;
  }>;
  status: string;
}

/**
 * Fleetio Fuel Entry
 */
interface FleetioFuelEntry {
  id: string;
  vehicleId: string;
  entryDate: string;
  odometer: number;
  quantity: number;
  unit: string; // gallons, liters
  costPerUnit: number;
  totalCost: number;
  vendor: string;
  fuelType: string;
  milesSinceLastEntry?: number;
  mpg?: number;
  notes?: string;
}

/**
 * Fleetio Inspection
 */
interface FleetioInspection {
  id: string;
  vehicleId: string;
  inspectionFormId: string;
  completedAt: string;
  driverId?: string;
  status: string; // pass, fail, conditional
  items: Array<{
    id: string;
    name: string;
    status: string;
    notes?: string;
    photoUrl?: string;
  }>;
  photos?: string[];
  notes?: string;
}

/**
 * Fleetio Part
 */
interface FleetioPartItem {
  id: string;
  name: string;
  partNumber: string;
  category: string;
  vendorId?: string;
  quantity: number;
  reorderPoint: number;
  unitCost: number;
  leadDays?: number;
  createdAt: string;
}

/**
 * Fleetio Contact
 */
interface FleetioContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: string; // driver, vendor, mechanic
  organization?: string;
  address?: string;
  createdAt: string;
}

/**
 * Fleetio Work Order
 */
interface FleetioWorkOrder {
  id: string;
  vehicleId: string;
  title: string;
  description: string;
  priority: string; // low, medium, high
  status: string; // open, assigned, in_progress, completed
  assignedTo?: string;
  dueDate?: string;
  estimatedCost?: number;
  actualCost?: number;
  createdAt: string;
  completedAt?: string;
}

/**
 * Fleetio Meter Entry
 */
interface FleetioMeterEntry {
  id: string;
  vehicleId: string;
  meterType: string; // odometer, engine_hours, service_hours
  reading: number;
  entryDate: string;
  notes?: string;
}

/**
 * Fleetio Vehicle Assignment
 */
interface FleetioVehicleAssignment {
  id: string;
  vehicleId: string;
  driverId: string;
  startDate: string;
  endDate?: string;
  status: string;
}

/**
 * Fleetio Expense Entry
 */
interface FleetioExpenseEntry {
  id: string;
  vehicleId: string;
  expenseType: string; // toll, parking, registration, insurance
  amount: number;
  currency: string;
  date: string;
  notes?: string;
  receiptUrl?: string;
}

/**
 * Fleetio Webhook
 */
interface FleetioWebhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

/**
 * Fleetio Credentials
 */
interface FleetioCredentials {
  accessToken: string;
  accountToken: string;
}

/**
 * Fleetio REST API v2 Client
 */
export class FleetioClient extends TelematicsAdapter {
  private accessToken: string;
  private accountToken: string;
  private baseUrl = "https://api.fleetio.com/v1";
  private normalizer: TelematicsNormalizer;

  constructor(config: TelematicsConfig) {
    super(config);
    const credentials = config.credentials as FleetioCredentials;
    this.accessToken = credentials.accessToken;
    this.accountToken = credentials.accountToken;
    this.normalizer = new TelematicsNormalizer("samsara");
  }

  /**
   * Authenticate with Fleetio
   */
  async authenticate(): Promise<void> {
    try {
      await this.retryWithBackoff(async () => {
        const response = await this.fetchWithTimeout(
          `${this.baseUrl}/vehicles?limit=1`,
          {
            method: "GET",
            headers: this.buildHeaders(),
          },
        );

        if (!response.ok) {
          const error = await this.parseErrorResponse(response);
          throw new FleetioAPIError(
            response.status,
            error.code,
            error.message,
            response.status === 429,
          );
        }
      });
    } catch (error) {
      throw new Error(
        `Fleetio authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get all vehicles
   * GET /vehicles
   */
  async getVehicles(): Promise<NormalizedVehicle[]> {
    const cacheKey = "fleetio:vehicles";
    const cached = this.cache.get(cacheKey) as NormalizedVehicle[] | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const vehicles: FleetioVehicle[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const url = new URL(`${this.baseUrl}/vehicles`);
        url.searchParams.append("page", page.toString());
        url.searchParams.append("limit", "100");

        const response = await this.fetchWithTimeout(url.toString(), {
          method: "GET",
          headers: this.buildHeaders(),
        });

        if (!response.ok) {
          const error = await this.parseErrorResponse(response);
          throw new FleetioAPIError(
            response.status,
            error.code,
            error.message,
            response.status === 429,
          );
        }

        const data = (await response.json()) as {
          data: FleetioVehicle[];
          meta: { nextPage?: number };
        };

        if (!data.data || data.data.length === 0) {
          hasMore = false;
        } else {
          vehicles.push(...data.data);
          hasMore = !!data.meta?.nextPage;
          page++;
        }
      }

      const normalized = vehicles.map((v) => this.normalizeVehicle(v));
      this.cache.set(cacheKey, normalized, 300000);
      return normalized;
    });
  }

  /**
   * Get vehicle position (from latest service/fuel entries)
   * GET /vehicles/{id}/service_entries (proxy for location history)
   */
  async getVehiclePosition(vehicleId: string): Promise<NormalizedPosition> {
    // Fleetio doesn't provide real-time position, return synthetic
    const cacheKey = `fleetio:position:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as NormalizedPosition | undefined;
    if (cached) return cached;

    throw new Error(
      "Fleetio does not provide real-time position tracking. Use Samsara or Geotab for telematics.",
    );
  }

  /**
   * Get vehicle diagnostics from service history
   * GET /vehicles/{id}/service_entries
   */
  async getVehicleDiagnostics(vehicleId: string): Promise<NormalizedDiagnostic> {
    const cacheKey = `fleetio:diagnostics:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as NormalizedDiagnostic | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const url = new URL(`${this.baseUrl}/vehicles/${vehicleId}/service_entries`);
      url.searchParams.append("limit", "1");

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FleetioAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { data: FleetioServiceEntry[] };
      const entry = data.data?.[0];

      const normalized: NormalizedDiagnostic = {
        externalVehicleId: vehicleId,
        engineRunning: false,
        faultCodes: [],
        odometer: entry ? { value: entry.odometer, unit: "miles" } : undefined,
        timestamp: new Date(entry?.serviceDate || new Date()),
      };

      this.cache.set(cacheKey, normalized, 120000);
      return normalized;
    });
  }

  /**
   * Get driver behavior events - Fleetio doesn't track this
   */
  async getDriverBehaviorEvents(
    driverId: string,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<NormalizedBehaviorEvent[]> {
    return [];
  }

  /**
   * Get fuel level from latest fuel entry
   * GET /vehicles/{id}/fuel_entries
   */
  async getFuelLevel(vehicleId: string): Promise<NormalizedFuelReading> {
    const cacheKey = `fleetio:fuel:${vehicleId}`;
    const cached = this.cache.get(cacheKey) as NormalizedFuelReading | undefined;
    if (cached) return cached;

    return this.retryWithBackoff(async () => {
      const url = new URL(`${this.baseUrl}/vehicles/${vehicleId}/fuel_entries`);
      url.searchParams.append("limit", "1");

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FleetioAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { data: FleetioFuelEntry[] };
      const entry = data.data?.[0];

      if (!entry) {
        throw new Error(`No fuel data available for vehicle ${vehicleId}`);
      }

      const normalized: NormalizedFuelReading = {
        externalVehicleId: vehicleId,
        fuelLevel: entry.quantity,
        fuelUnit: entry.unit as "gallons" | "liters",
        timestamp: new Date(entry.entryDate),
      };

      this.cache.set(cacheKey, normalized, 120000);
      return normalized;
    });
  }

  /**
   * Subscribe to events via webhook
   * POST /webhooks
   */
  async subscribeToEvents(
    webhookUrl: string,
    eventTypes: string[],
  ): Promise<WebhookSubscription> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/webhooks`, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({
          url: webhookUrl,
          events: eventTypes,
        }),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FleetioAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { data: FleetioWebhook };
      const webhook = data.data;

      return {
        webhookId: webhook.id,
        url: webhook.url,
        events: webhook.events,
        createdAt: new Date(webhook.createdAt),
      };
    });
  }

  /**
   * Unsubscribe from events
   * DELETE /webhooks/{id}
   */
  async unsubscribeFromEvents(webhookId: string): Promise<void> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/webhooks/${webhookId}`,
        {
          method: "DELETE",
          headers: this.buildHeaders(),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FleetioAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.retryWithBackoff(async () => {
        const response = await this.fetchWithTimeout(
          `${this.baseUrl}/vehicles?limit=1`,
          {
            method: "GET",
            headers: this.buildHeaders(),
          },
        );
        return response.ok;
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create service entry
   * POST /vehicles/{id}/service_entries
   */
  async createServiceEntry(
    vehicleId: string,
    entry: Omit<FleetioServiceEntry, "id">,
  ): Promise<FleetioServiceEntry> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/vehicles/${vehicleId}/service_entries`,
        {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify(entry),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FleetioAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { data: FleetioServiceEntry };
      return data.data;
    });
  }

  /**
   * Create fuel entry
   * POST /vehicles/{id}/fuel_entries
   */
  async createFuelEntry(
    vehicleId: string,
    entry: Omit<FleetioFuelEntry, "id">,
  ): Promise<FleetioFuelEntry> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/vehicles/${vehicleId}/fuel_entries`,
        {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify(entry),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FleetioAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { data: FleetioFuelEntry };
      return data.data;
    });
  }

  /**
   * Get inspections
   * GET /vehicles/{id}/inspections
   */
  async getInspections(vehicleId: string): Promise<FleetioInspection[]> {
    return this.retryWithBackoff(async () => {
      const url = new URL(`${this.baseUrl}/vehicles/${vehicleId}/inspections`);
      url.searchParams.append("limit", "50");

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FleetioAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { data: FleetioInspection[] };
      return data.data || [];
    });
  }

  /**
   * Create inspection
   * POST /vehicles/{id}/inspections
   */
  async createInspection(
    vehicleId: string,
    inspection: Omit<FleetioInspection, "id">,
  ): Promise<FleetioInspection> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/vehicles/${vehicleId}/inspections`,
        {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify(inspection),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FleetioAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { data: FleetioInspection };
      return data.data;
    });
  }

  /**
   * Get parts inventory
   * GET /parts
   */
  async getParts(): Promise<FleetioPartItem[]> {
    return this.retryWithBackoff(async () => {
      const url = new URL(`${this.baseUrl}/parts`);
      url.searchParams.append("limit", "100");

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FleetioAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { data: FleetioPartItem[] };
      return data.data || [];
    });
  }

  /**
   * Get contacts
   * GET /contacts
   */
  async getContacts(type?: string): Promise<FleetioContact[]> {
    return this.retryWithBackoff(async () => {
      const url = new URL(`${this.baseUrl}/contacts`);
      if (type) url.searchParams.append("type", type);
      url.searchParams.append("limit", "100");

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FleetioAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { data: FleetioContact[] };
      return data.data || [];
    });
  }

  /**
   * Create work order
   * POST /vehicles/{id}/work_orders
   */
  async createWorkOrder(
    vehicleId: string,
    order: Omit<FleetioWorkOrder, "id">,
  ): Promise<FleetioWorkOrder> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/vehicles/${vehicleId}/work_orders`,
        {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify(order),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FleetioAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { data: FleetioWorkOrder };
      return data.data;
    });
  }

  /**
   * Get meter entries
   * GET /vehicles/{id}/meter_entries
   */
  async getMeterEntries(vehicleId: string): Promise<FleetioMeterEntry[]> {
    return this.retryWithBackoff(async () => {
      const url = new URL(`${this.baseUrl}/vehicles/${vehicleId}/meter_entries`);
      url.searchParams.append("limit", "50");

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FleetioAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { data: FleetioMeterEntry[] };
      return data.data || [];
    });
  }

  /**
   * Get vehicle assignments
   * GET /vehicles/{id}/assignments
   */
  async getAssignments(vehicleId: string): Promise<FleetioVehicleAssignment[]> {
    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/vehicles/${vehicleId}/assignments`,
        {
          method: "GET",
          headers: this.buildHeaders(),
        },
      );

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FleetioAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { data: FleetioVehicleAssignment[] };
      return data.data || [];
    });
  }

  /**
   * Get expense entries
   * GET /vehicles/{id}/expense_entries
   */
  async getExpenseEntries(vehicleId: string): Promise<FleetioExpenseEntry[]> {
    return this.retryWithBackoff(async () => {
      const url = new URL(
        `${this.baseUrl}/vehicles/${vehicleId}/expense_entries`,
      );
      url.searchParams.append("limit", "100");

      const response = await this.fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw new FleetioAPIError(
          response.status,
          error.code,
          error.message,
          response.status === 429,
        );
      }

      const data = (await response.json()) as { data: FleetioExpenseEntry[] };
      return data.data || [];
    });
  }

  /**
   * Build request headers
   */
  protected buildHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Account-Token": this.accountToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Parse error response
   */
  protected async parseErrorResponse(
    response: Response,
  ): Promise<{ code: string; message: string }> {
    try {
      const body = (await response.json()) as {
        error?: string;
        message?: string;
        code?: string;
        errors?: Array<{ detail: string }>;
      };
      return {
        code:
          body.code ||
          body.error ||
          body.errors?.[0]?.detail ||
          "UNKNOWN",
        message: body.message || body.error || response.statusText,
      };
    } catch {
      return {
        code: `HTTP_${response.status}`,
        message: response.statusText,
      };
    }
  }

  /**
   * Normalize Fleetio vehicle
   */
  private normalizeVehicle(vehicle: FleetioVehicle): NormalizedVehicle {
    return {
      externalVehicleId: vehicle.id,
      name: vehicle.name,
      vin: vehicle.vin,
      licensePlate: vehicle.licensePlate,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      status: vehicle.status === "active" ? "ACTIVE" : "INACTIVE",
      odometer: undefined,
    };
  }
}
