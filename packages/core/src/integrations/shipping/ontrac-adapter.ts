/**
 * OnTrac REST API v3 Adapter
 *
 * Regional last-mile carrier for Western US:
 * CA, OR, WA, AZ, CO, ID, NV, UT
 *
 * Self-hosters configure via env vars: ONTRAC_ACCOUNT, ONTRAC_PASSWORD
 *
 * Authentication: Basic Auth (account number + password)
 * Base URL: https://www.ontrac.com/restapi/v3
 * Rate Limit: 60 req/min (conservative)
 */

import { ShippingAdapter } from "./shipping-adapter.js";
import type {
  ShippingConfig,
  ShipmentRequest,
  ShipmentRate,
  ShipmentLabel,
  TrackingResult,
  TrackingEvent,
  AddressValidationResult,
  ShippingAddress,
} from "./types.js";

// ─── OnTrac API Response Types ──────────────────────────────────

interface OnTracRateResponse {
  ServiceCode: string;
  ServiceDesc: string;
  ShipDate: string;
  DeliveryDate: string;
  Charges: number; // in dollars
  FuelSurcharge: number;
  TransitDays: number;
  Zone: string;
  CommitTime?: string;
  Error?: string;
}

interface OnTracShipmentRequest {
  Shipment: {
    Shipper: string;
    ShipDate: string;
    ServiceCode: string;
    Residential: boolean;
    SaturdayDel: boolean;
    Declared: number;
    COD: number;
    CODType: string;
    Weight: number;
    BillTo: string;
    Instructions: string;
    Reference1: string;
    Reference2: string;
    Sender: OnTracContact;
    Recipient: OnTracContact;
    Packages: Array<{
      Length: number;
      Width: number;
      Height: number;
      Weight: number;
    }>;
    SignatureRequired: string; // "N","A","D","I"
  };
}

interface OnTracContact {
  Name: string;
  Addr1: string;
  Addr2?: string;
  City: string;
  State: string;
  Zip: string;
  Phone?: string;
  Email?: string;
}

interface OnTracShipmentResponse {
  Shipment: {
    ID: string;
    Tracking: string;
    ShipDate: string;
    ServiceCode: string;
    Label: string; // base64 PDF
    Charges: number;
    Error?: string;
  };
}

interface OnTracTrackingEvent {
  Status: string;
  Description: string;
  City: string;
  State: string;
  Zip: string;
  Date: string; // MM/DD/YYYY HH:MM:SS AM/PM
  StatusCode: string;
}

interface OnTracTrackingResponse {
  Shipments: Array<{
    Tracking: string;
    Status: string;
    Description: string;
    ServiceCode: string;
    Delivered: boolean;
    Residential: boolean;
    ScheduledDelivery: string;
    Events: OnTracTrackingEvent[];
    Error?: string;
  }>;
}

// ─── Service Code Map ────────────────────────────────────────────

/** OnTrac service codes → ServiceLevel */
const ONTRAC_SERVICE_MAP: Record<string, string> = {
  S: "OVERNIGHT",   // Sunrise (next day early AM)
  G: "GROUND",      // Ground
  C: "OVERNIGHT",   // C10 Next Day by 10 AM
  H: "OVERNIGHT",   // H2 Next Day by noon
  L: "GROUND",      // OnTrac Ground (alias)
};

const ONTRAC_TRANSIT_DAYS: Record<string, number> = {
  S: 1,
  C: 1,
  H: 1,
  G: 2,
  L: 2,
};

// ─── OnTrac Adapter ──────────────────────────────────────────────

export interface OnTracConfig extends ShippingConfig {
  account: string;
  password: string;
  isSandbox?: boolean;
}

/**
 * OnTrac REST API v3 adapter.
 * Western US last-mile (CA, OR, WA, AZ, CO, ID, NV, UT).
 */
export class OnTracAdapter extends ShippingAdapter {
  private readonly baseUrl: string;
  private readonly basicAuth: string;
  private readonly account: string;

  constructor(config: OnTracConfig) {
    super(config, 1); // 1 rps conservative
    this.account = config.account;
    this.basicAuth = Buffer.from(`${config.account}:${config.password}`).toString("base64");
    // OnTrac does not have a formal sandbox; use production only
    this.baseUrl = "https://www.ontrac.com/restapi/v3";
  }

  async validateConfig(): Promise<void> {
    const cfg = this.config as OnTracConfig;
    if (!cfg.account || !cfg.password) {
      throw new Error(
        "OnTrac adapter requires account and password (ONTRAC_ACCOUNT, ONTRAC_PASSWORD)"
      );
    }
    // Validate by fetching a rate quote for a known Western US ZIP pair
    await this.getRates({
      shipmentId: "config-validate",
      from: { name: "Test", street1: "123 Test St", city: "Los Angeles", state: "CA", zip: "90001", country: "US" },
      to: { name: "Test", street1: "456 Test Ave", city: "San Francisco", state: "CA", zip: "94102", country: "US" },
      weight: { value: 1, unit: "lb" },
    });
  }

  async getRates(request: ShipmentRequest): Promise<ShipmentRate[]> {
    const weight = this.UnitConverter.normalizeWeight(request.weight);
    const weightLb = this.UnitConverter.kgToLb(weight.value);

    const params = new URLSearchParams({
      acct: this.account,
      zip: request.from.zip,
      dzip: request.to.zip,
      weight: String(Math.ceil(weightLb)),
      residential: "true",
      service: "ALL",
    });

    if (request.dimensions) {
      params.set("length", String(Math.ceil(this.UnitConverter.cmToIn(request.dimensions.length))));
      params.set("width", String(Math.ceil(this.UnitConverter.cmToIn(request.dimensions.width))));
      params.set("height", String(Math.ceil(this.UnitConverter.cmToIn(request.dimensions.height))));
    }

    const data = await this.request<{ Rates: OnTracRateResponse[] }>(
      "GET",
      `${this.baseUrl}/rates?${params.toString()}`,
      { headers: this.authHeaders() }
    );

    return (data.Rates ?? [])
      .filter((r) => !r.Error)
      .map((r) => ({
        rateId: r.ServiceCode,
        carrier: "ONTRAC" as const,
        service: (ONTRAC_SERVICE_MAP[r.ServiceCode] ?? "GROUND") as ShipmentRate["service"],
        price: Math.round((r.Charges + r.FuelSurcharge) * 100), // dollars → cents
        currency: "USD",
        estimatedDays: r.TransitDays || ONTRAC_TRANSIT_DAYS[r.ServiceCode] || 2,
        insurable: true,
        rawResponse: r,
      }));
  }

  async createShipment(
    request: ShipmentRequest,
    rateId: string
  ): Promise<ShipmentLabel> {
    const from = this.AddressNormalizer.normalize(request.from);
    const to = this.AddressNormalizer.normalize(request.to);
    const weight = this.UnitConverter.normalizeWeight(request.weight);
    const weightLb = Math.ceil(this.UnitConverter.kgToLb(weight.value));

    const payload: OnTracShipmentRequest = {
      Shipment: {
        Shipper: this.account,
        ShipDate: new Date().toISOString().split("T")[0],
        ServiceCode: rateId,
        Residential: true,
        SaturdayDel: false,
        Declared: 0,
        COD: 0,
        CODType: "N",
        Weight: weightLb,
        BillTo: this.account,
        Instructions: to.instructions ?? "",
        Reference1: request.shipmentId,
        Reference2: "",
        SignatureRequired: request.signatureRequired ? "D" : "N",
        Sender: {
          Name: from.name,
          Addr1: from.street1,
          Addr2: from.street2,
          City: from.city,
          State: from.state,
          Zip: from.zip,
          Phone: from.phone,
          Email: from.email,
        },
        Recipient: {
          Name: to.name,
          Addr1: to.street1,
          Addr2: to.street2,
          City: to.city,
          State: to.state,
          Zip: to.zip,
          Phone: to.phone,
          Email: to.email,
        },
        Packages: [
          {
            Weight: weightLb,
            Length: request.dimensions
              ? Math.ceil(this.UnitConverter.cmToIn(request.dimensions.length))
              : 12,
            Width: request.dimensions
              ? Math.ceil(this.UnitConverter.cmToIn(request.dimensions.width))
              : 12,
            Height: request.dimensions
              ? Math.ceil(this.UnitConverter.cmToIn(request.dimensions.height))
              : 12,
          },
        ],
      },
    };

    const data = await this.request<OnTracShipmentResponse>(
      "POST",
      `${this.baseUrl}/shipments`,
      { headers: { ...this.authHeaders(), "Content-Type": "application/json" }, body: payload }
    );

    const s = data.Shipment;
    if (s.Error) throw new Error(`OnTrac shipment creation failed: ${s.Error}`);

    const labelBytes = s.Label ? Buffer.from(s.Label, "base64") : undefined;

    return {
      labelId: s.ID,
      trackingNumber: s.Tracking,
      carrier: "ONTRAC",
      service: (ONTRAC_SERVICE_MAP[rateId] ?? "GROUND") as ShipmentLabel["service"],
      labelUrl: "",
      format: "PDF",
      labelBytes,
      rateId,
      createdAt: new Date(),
      rawResponse: data,
    };
  }

  async getLabel(labelId: string): Promise<ShipmentLabel> {
    const data = await this.request<OnTracShipmentResponse>(
      "GET",
      `${this.baseUrl}/shipments/${encodeURIComponent(labelId)}`,
      { headers: this.authHeaders() }
    );

    const s = data.Shipment;
    const labelBytes = s.Label ? Buffer.from(s.Label, "base64") : undefined;

    return {
      labelId: s.ID,
      trackingNumber: s.Tracking,
      carrier: "ONTRAC",
      service: (ONTRAC_SERVICE_MAP[s.ServiceCode] ?? "GROUND") as ShipmentLabel["service"],
      labelUrl: "",
      format: "PDF",
      labelBytes,
      createdAt: new Date(),
      rawResponse: data,
    };
  }

  async track(trackingNumber: string): Promise<TrackingResult> {
    const data = await this.request<OnTracTrackingResponse>(
      "GET",
      `${this.baseUrl}/shipments?track=${encodeURIComponent(trackingNumber)}`,
      { headers: this.authHeaders() }
    );

    const shipment = data.Shipments?.[0];
    if (!shipment) {
      return {
        trackingNumber,
        carrier: "ONTRAC",
        status: "UNKNOWN",
        events: [],
        rawResponse: data,
      };
    }

    const events: TrackingEvent[] = (shipment.Events ?? []).map((e) =>
      this.parseEvent(e)
    );
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      trackingNumber,
      carrier: "ONTRAC",
      status: shipment.Delivered ? "DELIVERED" : this.normalizeStatus(shipment.Status),
      estimatedDeliveryDate: shipment.ScheduledDelivery
        ? new Date(shipment.ScheduledDelivery)
        : undefined,
      deliveryDate: shipment.Delivered && events.length > 0
        ? events[events.length - 1].timestamp
        : undefined,
      events,
      rawResponse: data,
    };
  }

  async cancelShipment(labelId: string): Promise<boolean> {
    try {
      await this.request<unknown>(
        "DELETE",
        `${this.baseUrl}/shipments/${encodeURIComponent(labelId)}`,
        { headers: this.authHeaders() }
      );
      return true;
    } catch {
      return false;
    }
  }

  async validateAddress(address: ShippingAddress): Promise<AddressValidationResult> {
    const normalized = this.AddressNormalizer.normalize(address);
    // OnTrac coverage: Western US states only
    const westernStates = new Set(["CA", "OR", "WA", "AZ", "CO", "ID", "NV", "UT"]);
    if (!westernStates.has(normalized.state)) {
      return {
        valid: false,
        address: normalized,
        messages: [
          `OnTrac only covers Western US states (CA, OR, WA, AZ, CO, ID, NV, UT). State "${normalized.state}" is outside OnTrac service area.`,
        ],
      };
    }
    return { valid: true, address: normalized };
  }

  // ─── Private helpers ─────────────────────────────────────────

  private authHeaders(): Record<string, string> {
    return { Authorization: `Basic ${this.basicAuth}` };
  }

  private parseEvent(e: OnTracTrackingEvent): TrackingEvent {
    const ts = new Date(e.Date);
    return {
      timestamp: isNaN(ts.getTime()) ? new Date() : ts,
      status: this.normalizeStatus(e.Status),
      message: e.Description,
      location: [e.City, e.State, e.Zip].filter(Boolean).join(", ") || undefined,
      code: e.StatusCode,
      rawResponse: e,
    };
  }

  private normalizeStatus(status: string): string {
    const upper = status.toUpperCase();
    if (upper.includes("DELIVERED")) return "DELIVERED";
    if (upper.includes("OUT FOR DEL") || upper === "OD") return "OUT_FOR_DELIVERY";
    if (upper.includes("IN TRANSIT") || upper === "IT") return "IN_TRANSIT";
    if (upper.includes("PICKED UP") || upper === "PU") return "PICKED_UP";
    if (upper.includes("EXCEPTION") || upper === "EX") return "EXCEPTION";
    if (upper.includes("ARRIVAL") || upper === "AR") return "IN_TRANSIT";
    return "UNKNOWN";
  }
}
