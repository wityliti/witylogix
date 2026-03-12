/**
 * Shippo API Client
 *
 * Implements IShippingAdapter for Shippo integration.
 * Authentication: API token (Authorization: ShippoToken {token})
 * API Base: https://api.goshippo.com/v1
 * Rate Limit: 10 requests per second
 *
 * Shippo-specific features:
 * - Multi-carrier rate shopping (USPS, UPS, FedEx, DHL, etc.)
 * - Batch label creation for efficiency
 * - Address validation and standardization
 * - Returns and refunds management
 * - Customs declarations for international
 * - Real-time tracking with carrier webhooks
 * - Carbon offset options
 */

import { createHmac } from "crypto";
import type {
  IShippingAdapter,
  ShippingConfig,
  ShipmentRequest,
  ShipmentRate,
  ShipmentLabel,
  TrackingResult,
  TrackingEvent,
  AddressValidationResult,
  ShippingAddress,
  LabelFormat,
  ShippingWebhookEvent,
} from "./types.js";

// ─── Shippo API Types ───────────────────────────────────────

interface ShippoAddress {
  object_id: string;
  name: string;
  company: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
  is_residential: boolean;
  validation_results?: {
    is_valid: boolean;
    messages: Array<{ text: string; code: string }>;
  };
}

interface ShippoParcel {
  object_id: string;
  weight: string;
  width: string;
  height: string;
  length: string;
  distance_unit: string;
  weight_unit: string;
  template: string;
}

interface ShippoRate {
  object_id: string;
  shipment: string;
  carrier_account: string;
  carrier: string;
  servicelevel: {
    name: string;
    token: string;
  };
  rate: string;
  currency: string;
  list_rate: string;
  list_currency: string;
  provider: string;
  estimated_days: number;
  arrives_by: string;
  duration_terms: string;
  messages: string[];
  test: boolean;
}

interface ShippoTransaction {
  object_id: string;
  rate: string;
  tracking_number: string;
  tracking_status: {
    status: string;
    status_date: string;
    status_details: string;
  };
  label_download: {
    pdf: string;
    png: string;
    zpl: string;
  };
  commercial_invoice_url: string;
  test: boolean;
}

interface ShippoShipment {
  object_id: string;
  status: string;
  address_from: ShippoAddress;
  address_to: ShippoAddress;
  parcels: ShippoParcel[];
  shipment_date: string;
  extra: Record<string, unknown>;
  metadata: string;
}

interface ShippoTrack {
  carrier: string;
  tracking_number: string;
  address_from?: ShippoAddress;
  address_to?: ShippoAddress;
  eta: string;
  servicelevel: {
    name: string;
    token: string;
  };
  status: string;
  tracking_history: Array<{
    status: string;
    status_date: string;
    status_details: string;
    location: {
      city: string;
      state: string;
      zip: string;
      country: string;
    };
  }>;
  test: boolean;
}

// ─── Shippo Client ──────────────────────────────────────────

export class ShippoClient implements IShippingAdapter {
  private baseUrl: string;
  private apiToken: string;

  constructor(config: ShippingConfig) {
    this.baseUrl = config.baseUrl || "https://api.goshippo.com/v1";
    this.apiToken = config.apiKey || "";

    if (!this.apiToken) {
      throw new Error("Shippo API token is required");
    }
  }

  /**
   * Create a shipment and get rates.
   */
  async createShipment(request: ShipmentRequest): Promise<ShipmentRate[]> {
    // Create shipment
    const shipment = await this.makeRequest<ShippoShipment>(
      "POST",
      "/shipments",
      {
        address_from: this.normalizeAddress(request.fromAddress),
        address_to: this.normalizeAddress(request.toAddress),
        parcels: request.parcels.map((p) => ({
          weight: (p.weight.value * (p.weight.unit === "lb" ? 0.453592 : 1)).toString(),
          width: (p.dimensions?.width || 0).toString(),
          height: (p.dimensions?.height || 0).toString(),
          length: (p.dimensions?.length || 0).toString(),
          distance_unit: "cm",
          weight_unit: "kg",
        })),
        metadata: request.metadata ? JSON.stringify(request.metadata) : undefined,
      }
    );

    // Get rates for this shipment
    const rates = await this.makeRequest<{ results: ShippoRate[] }>(
      "GET",
      `/shipments/${shipment.object_id}/rates`
    );

    return rates.results.map((r) => ({
      id: r.object_id,
      carrier: r.carrier,
      service: r.servicelevel.name,
      rate: parseFloat(r.rate),
      currency: r.currency,
      estimatedDays: r.estimated_days,
      estimatedDelivery: r.arrives_by ? new Date(r.arrives_by) : undefined,
      metadata: { shipment_id: shipment.object_id },
    }));
  }

  /**
   * Purchase a shipment label.
   */
  async purchaseLabel(
    rateId: string,
    format: LabelFormat = "PDF"
  ): Promise<ShipmentLabel> {
    const transaction = await this.makeRequest<ShippoTransaction>(
      "POST",
      "/transactions",
      {
        rate: rateId,
        label_file_type: this.mapLabelFormat(format),
      }
    );

    if (!transaction.label_download) {
      throw new Error("Failed to generate label");
    }

    const labelUrl = this.getLabelUrl(transaction, format);

    return {
      id: transaction.object_id,
      trackingNumber: transaction.tracking_number,
      carrier: "shippo", // Will be overridden by specific carrier
      label: labelUrl,
      labelFormat: format,
      createdAt: new Date(),
    };
  }

  /**
   * Get tracking information.
   */
  async getTracking(
    carrier: string,
    trackingNumber: string
  ): Promise<TrackingResult> {
    const track = await this.makeRequest<ShippoTrack>("GET", `/tracks/${carrier}/${trackingNumber}`);

    return {
      trackingNumber,
      status: this.mapTrackingStatus(track.status),
      carrier,
      events: track.tracking_history.map((e, idx) => ({
        sequence: idx,
        status: this.mapTrackingStatus(e.status),
        timestamp: new Date(e.status_date),
        location: {
          city: e.location.city,
          state: e.location.state,
          zip: e.location.zip,
          country: e.location.country,
        },
        message: e.status_details,
      })),
      estimatedDelivery: track.eta ? new Date(track.eta) : undefined,
      lastUpdate: track.tracking_history[0]
        ? new Date(track.tracking_history[0].status_date)
        : undefined,
    };
  }

  /**
   * Validate address.
   */
  async validateAddress(address: ShippingAddress): Promise<AddressValidationResult> {
    const shippoAddress = this.normalizeAddress(address);

    const validated = await this.makeRequest<ShippoAddress>(
      "POST",
      "/addresses",
      shippoAddress
    );

    if (!validated.validation_results) {
      return {
        valid: true,
        address: address,
      };
    }

    return {
      valid: validated.validation_results.is_valid,
      address: {
        name: validated.name,
        street1: validated.street1,
        street2: validated.street2,
        city: validated.city,
        state: validated.state,
        zip: validated.zip,
        country: validated.country,
        phone: validated.phone,
        email: validated.email,
      },
      errors: validated.validation_results.messages?.map((m) => m.text),
    };
  }

  /**
   * Create batch labels for multiple shipments.
   */
  async createBatchLabels(
    shipmentRequests: ShipmentRequest[],
    format: LabelFormat = "PDF"
  ): Promise<ShipmentLabel[]> {
    const labels: ShipmentLabel[] = [];

    for (const request of shipmentRequests) {
      try {
        const rates = await this.createShipment(request);
        if (rates.length > 0) {
          const label = await this.purchaseLabel(rates[0].id, format);
          labels.push(label);
        }
      } catch (error) {
        console.error(`Failed to create label for shipment:`, error);
      }
    }

    return labels;
  }

  /**
   * Handle webhook event.
   */
  async handleWebhook(
    payload: ShippingWebhookEvent,
    signature?: string
  ): Promise<void> {
    // Verify webhook signature if provided
    if (signature && !this.verifyWebhookSignature(JSON.stringify(payload), signature)) {
      throw new Error("Invalid webhook signature");
    }

    // Process event
    switch (payload.type) {
      case "track_updated":
        console.log(`Tracking update: ${payload.data?.tracking_number}`);
        break;
      case "shipment_created":
        console.log(`Shipment created: ${payload.data?.shipment_id}`);
        break;
      case "transaction_created":
        console.log(`Label created: ${payload.data?.tracking_number}`);
        break;
      default:
        console.log(`Unhandled webhook: ${payload.type}`);
    }
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest<{ object_id: string }>("GET", "/addresses?limit=1");
      return true;
    } catch {
      return false;
    }
  }

  // ─── Private Helper Methods ────────────────────────────

  /**
   * Make HTTP request to Shippo API.
   */
  private async makeRequest<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `ShippoToken ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `Shippo API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Normalize address to Shippo format.
   */
  private normalizeAddress(address: ShippingAddress): Record<string, unknown> {
    return {
      name: address.name,
      street1: address.street1,
      street2: address.street2 || "",
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      phone: address.phone || "",
      email: address.email || "",
      is_residential: false,
    };
  }

  /**
   * Map label format to Shippo format.
   */
  private mapLabelFormat(format: LabelFormat): string {
    const map: Record<LabelFormat, string> = {
      PDF: "PDF",
      PNG: "PNG",
      ZPL: "ZPL",
    };
    return map[format];
  }

  /**
   * Get label download URL for format.
   */
  private getLabelUrl(
    transaction: ShippoTransaction,
    format: LabelFormat
  ): string {
    const formatKey = format.toLowerCase() as keyof typeof transaction.label_download;
    return transaction.label_download[formatKey] || transaction.label_download.pdf;
  }

  /**
   * Map Shippo tracking status to standard format.
   */
  private mapTrackingStatus(status: string): string {
    const map: Record<string, string> = {
      unknown: "unknown",
      pre_transit: "picked_up",
      transit: "in_transit",
      delivery_attempted: "out_for_delivery",
      delivered: "delivered",
      returned: "returned",
      failure: "failed",
      cancelled: "cancelled",
    };
    return map[status] || "unknown";
  }

  /**
   * Verify webhook HMAC signature.
   */
  private verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const hmac = createHmac("sha256", this.apiToken);
      hmac.update(payload);
      const computed = hmac.digest("hex");
      return computed === signature;
    } catch {
      return false;
    }
  }
}
