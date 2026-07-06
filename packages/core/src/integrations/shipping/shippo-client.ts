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
  CarrierType,
  ServiceLevel,
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
   * Validate API credentials by making a lightweight test request.
   */
  async validateConfig(): Promise<void> {
    await this.makeRequest<{ results: ShippoAddress[] }>(
      "GET",
      "/addresses?results=1",
    );
  }

  /**
   * Get available shipping rates for a shipment.
   */
  async getRates(request: ShipmentRequest): Promise<ShipmentRate[]> {
    const weightKg =
      request.weight.unit === "lb"
        ? request.weight.value * 0.453592
        : request.weight.value;

    const shipment = await this.makeRequest<ShippoShipment>(
      "POST",
      "/shipments",
      {
        address_from: this.normalizeAddress(request.from),
        address_to: this.normalizeAddress(request.to),
        parcels: [
          {
            weight: weightKg.toString(),
            width: (request.dimensions?.width ?? 0).toString(),
            height: (request.dimensions?.height ?? 0).toString(),
            length: (request.dimensions?.length ?? 0).toString(),
            distance_unit: "cm",
            weight_unit: "kg",
          },
        ],
        metadata: request.metadata
          ? JSON.stringify(request.metadata)
          : undefined,
      },
    );

    const ratesResponse = await this.makeRequest<{ results: ShippoRate[] }>(
      "GET",
      `/shipments/${shipment.object_id}/rates`,
    );

    return ratesResponse.results.map(
      (r): ShipmentRate => ({
        rateId: r.object_id,
        carrier: this.mapCarrier(r.carrier),
        service: this.mapService(r.servicelevel.name),
        price: Math.round(parseFloat(r.rate) * 100), // convert to cents
        currency: r.currency,
        estimatedDays: r.estimated_days,
        insurable: true,
        rawResponse: r,
      }),
    );
  }

  /**
   * Create a shipping label by purchasing a rate.
   */
  async createShipment(
    request: ShipmentRequest,
    rateId: string,
  ): Promise<ShipmentLabel> {
    const format: LabelFormat = "PDF";
    const transaction = await this.makeRequest<ShippoTransaction>(
      "POST",
      "/transactions",
      {
        rate: rateId,
        label_file_type: this.mapLabelFormat(format),
      },
    );

    if (!transaction.label_download) {
      throw new Error("Shippo failed to generate label for rate " + rateId);
    }

    return {
      labelId: transaction.object_id,
      trackingNumber: transaction.tracking_number,
      carrier: this.mapCarrier("shippo"),
      service: "STANDARD",
      labelUrl: this.getLabelUrl(transaction, format),
      format,
      rateId,
      createdAt: new Date(),
      rawResponse: transaction,
    };
  }

  /**
   * Retrieve a previously created label by its transaction ID.
   */
  async getLabel(labelId: string): Promise<ShipmentLabel> {
    const transaction = await this.makeRequest<ShippoTransaction>(
      "GET",
      `/transactions/${labelId}`,
    );

    return {
      labelId: transaction.object_id,
      trackingNumber: transaction.tracking_number,
      carrier: this.mapCarrier("shippo"),
      service: "STANDARD",
      labelUrl: this.getLabelUrl(transaction, "PDF"),
      format: "PDF",
      createdAt: new Date(),
      rawResponse: transaction,
    };
  }

  /**
   * Get tracking information for a shipment.
   */
  async track(
    trackingNumber: string,
    carrier?: CarrierType,
  ): Promise<TrackingResult> {
    const carrierCode = carrier?.toLowerCase() ?? "shippo";
    const track = await this.makeRequest<ShippoTrack>(
      "GET",
      `/tracks/${carrierCode}/${trackingNumber}`,
    );

    return {
      trackingNumber,
      carrier: this.mapCarrier(track.carrier),
      status: this.mapTrackingStatus(track.status),
      estimatedDeliveryDate: track.eta ? new Date(track.eta) : undefined,
      events: track.tracking_history.map(
        (e): TrackingEvent => ({
          timestamp: new Date(e.status_date),
          status: this.mapTrackingStatus(e.status),
          message: e.status_details,
          location: e.location
            ? `${e.location.city}, ${e.location.state} ${e.location.zip}`
            : undefined,
          rawResponse: e,
        }),
      ),
      rawResponse: track,
    };
  }

  /**
   * Cancel a shipment/label (refund transaction).
   */
  async cancelShipment(labelId: string): Promise<boolean> {
    try {
      await this.makeRequest("POST", `/refunds`, { transaction: labelId });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate a shipping address.
   */
  async validateAddress(
    address: ShippingAddress,
  ): Promise<AddressValidationResult> {
    const validated = await this.makeRequest<ShippoAddress>(
      "POST",
      "/addresses",
      this.normalizeAddress(address),
    );

    if (!validated.validation_results) {
      return { valid: true, address };
    }

    return {
      valid: validated.validation_results.is_valid,
      address: {
        name: validated.name,
        street1: validated.street1,
        street2: validated.street2 || undefined,
        city: validated.city,
        state: validated.state,
        zip: validated.zip,
        country: validated.country,
        phone: validated.phone || undefined,
        email: validated.email || undefined,
      },
      messages: validated.validation_results.messages?.map((m) => m.text),
    };
  }

  /**
   * Create batch labels for multiple shipments (Shippo extension method).
   */
  async createBatchLabels(
    shipmentRequests: ShipmentRequest[],
    format: LabelFormat = "PDF",
  ): Promise<ShipmentLabel[]> {
    const labels: ShipmentLabel[] = [];

    for (const request of shipmentRequests) {
      try {
        const rates = await this.getRates(request);
        if (rates.length > 0) {
          const label = await this.createShipment(request, rates[0].rateId);
          labels.push(label);
        }
      } catch (error) {
        // Log and continue — batch should not abort on a single failure
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Shippo] Failed to create batch label: ${msg}`);
      }
    }

    return labels;
  }

  /**
   * Handle a Shippo webhook event (extension method — not part of IShippingAdapter).
   */
  async handleWebhook(
    payload: ShippingWebhookEvent,
    signature?: string,
  ): Promise<void> {
    if (
      signature &&
      !this.verifyWebhookSignature(JSON.stringify(payload), signature)
    ) {
      throw new Error("Invalid Shippo webhook signature");
    }

    // Route by eventType (ShippingWebhookEvent.eventType is the canonical field)
    switch (payload.eventType) {
      case "track_updated":
        console.log(
          `[Shippo] Tracking update for resource: ${payload.resourceId}`,
        );
        break;
      case "shipment_created":
        console.log(`[Shippo] Shipment created: ${payload.resourceId}`);
        break;
      case "transaction_created":
        console.log(
          `[Shippo] Label created: ${payload.trackingNumber ?? payload.resourceId}`,
        );
        break;
      default:
        console.log(
          `[Shippo] Unhandled webhook event type: ${payload.eventType}`,
        );
    }
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest<{ object_id: string }>(
        "GET",
        "/addresses?limit=1",
      );
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
    body?: unknown,
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
        `Shippo API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
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
    format: LabelFormat,
  ): string {
    const formatKey =
      format.toLowerCase() as keyof typeof transaction.label_download;
    return (
      transaction.label_download[formatKey] || transaction.label_download.pdf
    );
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
    return map[status] ?? "unknown";
  }

  /**
   * Map a carrier name string to the CarrierType union.
   * Falls back to "USPS" when the carrier is unrecognised.
   */
  private mapCarrier(carrier: string): CarrierType {
    const map: Record<string, CarrierType> = {
      fedex: "FEDEX",
      ups: "UPS",
      usps: "USPS",
      dhl: "DHL",
      dhl_express: "DHL",
      ontrac: "ONTRAC",
      shippo: "USPS", // Shippo rates come from underlying carriers; default to USPS
    };
    return map[carrier.toLowerCase()] ?? "USPS";
  }

  /**
   * Map a Shippo service-level name to the ServiceLevel union.
   */
  private mapService(name: string): ServiceLevel {
    const lower = name.toLowerCase();
    if (lower.includes("overnight") || lower.includes("next_day"))
      return "OVERNIGHT";
    if (lower.includes("express") || lower.includes("2_day")) return "EXPRESS";
    if (lower.includes("priority")) return "PRIORITY";
    if (lower.includes("economy")) return "ECONOMY";
    if (lower.includes("international")) return "INTERNATIONAL";
    if (lower.includes("ground")) return "GROUND";
    return "STANDARD";
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
