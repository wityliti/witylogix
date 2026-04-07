/**
 * EasyPost API Client
 *
 * Implements IShippingAdapter for EasyPost integration.
 * Authentication: Bearer token (API key as Authorization: Bearer {key})
 * API Base: https://api.easypost.com/v2
 * Rate Limit: 20 requests per second
 *
 * EasyPost-specific features:
 * - Multi-carrier rate shopping and purchasing
 * - Address verification and standardization
 * - Shipping insurance options
 * - Batch label creation
 * - Advanced tracking with carrier webhooks
 * - HMAC webhook signature verification
 */

import { createHmac } from "crypto";
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
  CarrierType,
  ServiceLevel,
  LabelFormat,
  ShippingWebhookEvent,
} from "./types.js";

// ─── EasyPost API Types ──────────────────────────────────────────

interface EasyPostAddress {
  id: string;
  object: string;
  created_at: string;
  updated_at: string;
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
  mode: string;
  residential: boolean;
  message?: string;
}

interface EasyPostParcel {
  id: string;
  object: string;
  created_at: string;
  updated_at: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  predefined_package: string;
}

interface EasyPostRate {
  id: string;
  object: string;
  created_at: string;
  updated_at: string;
  mode: string;
  service: string;
  carrier: string;
  rate: string;
  currency: string;
  list_rate: string;
  list_currency: string;
  delivery_days: number;
  delivery_date: string;
  est_delivery_days: number;
}

interface EasyPostShipment {
  id: string;
  object: string;
  created_at: string;
  updated_at: string;
  mode: string;
  reference: string;
  status: string;
  tracking_code: string;
  carrier: string;
  service: string;
  rate: EasyPostRate;
  rates: EasyPostRate[];
  to_address: EasyPostAddress;
  from_address: EasyPostAddress;
  return_address: EasyPostAddress;
  parcel: EasyPostParcel;
  postage_label: {
    id: string;
    object: string;
    created_at: string;
    updated_at: string;
    type: string;
    url: string;
    filename: string;
    fileformat: string;
    carrier_barcode_ability: string;
  };
  messages: unknown[];
  insurance: unknown;
  forms: unknown[];
  fees: unknown[];
  batch_id: string;
  batch_status: string;
  batch_message: string;
  label_date: string;
  options: Record<string, unknown>;
}

interface EasyPostTracker {
  id: string;
  object: string;
  created_at: string;
  updated_at: string;
  mode: string;
  tracking_code: string;
  status: string;
  status_detail: string;
  carrier: string;
  weight: number;
  est_delivery_date: string;
  signed_by: string;
  carrier_detail: unknown;
  finalized: boolean;
  is_return: boolean;
  public_url: string;
  fees: unknown[];
  checkpoints: EasyPostCheckpoint[];
}

interface EasyPostCheckpoint {
  object: string;
  created_at: string;
  updated_at: string;
  message: string;
  status: string;
  status_detail: string;
  tracking_location: {
    object: string;
    city: string;
    state: string;
    country: string;
    zip: string;
  };
}

interface EasyPostBatch {
  id: string;
  object: string;
  created_at: string;
  updated_at: string;
  mode: string;
  state: string;
  num_shipments: number;
  shipments: EasyPostShipment[];
  label_download: {
    href: string;
  };
  scan_form: unknown;
}

// ─── EasyPost Client ────────────────────────────────────────────

/**
 * EasyPost API Client
 */
export class EasyPostClient extends ShippingAdapter {
  readonly provider = "easypost" as const;

  private baseUrl: string;

  private apiKey: string;

  private authHeader: string;

  constructor(config: ShippingConfig) {
    super(config, 20); // 20 requests per second
    this.baseUrl = config.baseUrl || "https://api.easypost.com/v2";
    this.apiKey = config.apiKey || config.bearerToken || "";
    this.authHeader = `Bearer ${this.apiKey}`;
  }

  async validateConfig(): Promise<void> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error("EasyPost API key is required");
    }

    try {
      // Fetch account info to validate credentials
      const response = await this.request<{ user: { id: string } }>(
        "GET",
        `${this.baseUrl}/user`,
        {
          headers: { Authorization: this.authHeader },
        }
      );

      if (!response.user?.id) {
        throw new Error("Invalid response from EasyPost API");
      }
    } catch (error: unknown) {
      throw new Error(
        `Failed to validate EasyPost credentials: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get shipping rates from EasyPost.
   * Creates a shipment and returns available rates.
   */
  async getRates(request: ShipmentRequest): Promise<ShipmentRate[]> {
    // First, create addresses
    const fromAddress = await this.createOrValidateAddress(request.from);
    const toAddress = await this.createOrValidateAddress(request.to);

    // Create parcel
    const parcel = await this.createParcel(request);

    // Create shipment with addresses
    const shipmentPayload = {
      shipment: {
        to_address: {
          id: toAddress.id,
        },
        from_address: {
          id: fromAddress.id,
        },
        parcel: {
          id: parcel.id,
        },
      },
    };

    const response = await this.request<{ shipment: EasyPostShipment }>(
      "POST",
      `${this.baseUrl}/shipments`,
      {
        headers: { Authorization: this.authHeader },
        body: shipmentPayload,
      }
    );

    return (response.shipment.rates || []).map((rate: EasyPostRate) =>
      this.normalizeRate(rate)
    );
  }

  /**
   * Create a shipment/label in EasyPost.
   */
  async createShipment(
    request: ShipmentRequest,
    rateId: string
  ): Promise<ShipmentLabel> {
    // First, get the rate details
    const fromAddress = await this.createOrValidateAddress(request.from);
    const toAddress = await this.createOrValidateAddress(request.to);
    const parcel = await this.createParcel(request);

    // Create shipment
    const shipmentPayload = {
      shipment: {
        to_address: {
          id: toAddress.id,
        },
        from_address: {
          id: fromAddress.id,
        },
        parcel: {
          id: parcel.id,
        },
      },
    };

    const shipmentResponse = await this.request<{ shipment: EasyPostShipment }>(
      "POST",
      `${this.baseUrl}/shipments`,
      {
        headers: { Authorization: this.authHeader },
        body: shipmentPayload,
      }
    );

    const shipmentId = shipmentResponse.shipment.id;

    // Buy the rate
    const buyPayload = {
      rate: {
        id: rateId,
      },
    };

    const labelResponse = await this.request<{ shipment: EasyPostShipment }>(
      "POST",
      `${this.baseUrl}/shipments/${shipmentId}/buy`,
      {
        headers: { Authorization: this.authHeader },
        body: buyPayload,
      }
    );

    return this.normalizeLabel(labelResponse.shipment);
  }

  /**
   * Get a previously created label.
   */
  async getLabel(labelId: string): Promise<ShipmentLabel> {
    const response = await this.request<{ shipment: EasyPostShipment }>(
      "GET",
      `${this.baseUrl}/shipments/${labelId}`,
      {
        headers: { Authorization: this.authHeader },
      }
    );

    return this.normalizeLabel(response.shipment);
  }

  /**
   * Track a shipment.
   */
  async track(trackingNumber: string): Promise<TrackingResult> {
    const response = await this.request<{ tracker: EasyPostTracker }>(
      "GET",
      `${this.baseUrl}/trackers/${trackingNumber}`,
      {
        headers: { Authorization: this.authHeader },
      }
    );

    const tracker = response.tracker;
    const events: TrackingEvent[] = (tracker.checkpoints || []).map(
      (checkpoint: EasyPostCheckpoint) => ({
        timestamp: new Date(checkpoint.created_at),
        status: checkpoint.status,
        message: checkpoint.message,
        location: [
          checkpoint.tracking_location?.city,
          checkpoint.tracking_location?.state,
        ]
          .filter(Boolean)
          .join(", "),
        rawResponse: checkpoint,
      })
    );

    return {
      trackingNumber,
      carrier: this.normalizeCarrier(tracker.carrier) as CarrierType,
      status: tracker.status,
      estimatedDeliveryDate: tracker.est_delivery_date
        ? new Date(tracker.est_delivery_date)
        : undefined,
      events,
      rawResponse: tracker,
    };
  }

  /**
   * Cancel a shipment/label.
   */
  async cancelShipment(labelId: string): Promise<boolean> {
    try {
      // EasyPost doesn't have a direct cancel endpoint; refund would be manual
      // For now, we'll return false to indicate cancellation is not supported
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Validate an address.
   */
  async validateAddress(
    address: ShippingAddress
  ): Promise<AddressValidationResult> {
    const normalized = this.AddressNormalizer.normalize(address);

    try {
      const response = await this.request<{ address: EasyPostAddress }>(
        "POST",
        `${this.baseUrl}/addresses`,
        {
          headers: { Authorization: this.authHeader },
          body: {
            address: {
              street1: normalized.street1,
              street2: normalized.street2,
              city: normalized.city,
              state: normalized.state,
              zip: normalized.zip,
              country: normalized.country,
              name: normalized.name,
              phone: normalized.phone,
              email: normalized.email,
            },
          },
        }
      );

      return {
        valid: !response.address.message,
        address: normalized,
        messages: response.address.message ? [response.address.message] : [],
        rawResponse: response,
      };
    } catch (error: unknown) {
      return {
        valid: false,
        messages: [
          error instanceof Error ? error.message : "Address validation failed",
        ],
        rawResponse: null,
      };
    }
  }

  // ─── Helper Methods ─────────────────────────────────────────

  /**
   * Create or validate an address in EasyPost.
   */
  private async createOrValidateAddress(
    address: ShippingAddress
  ): Promise<EasyPostAddress> {
    const normalized = this.AddressNormalizer.normalize(address);

    const payload = {
      address: {
        street1: normalized.street1,
        street2: normalized.street2,
        city: normalized.city,
        state: normalized.state,
        zip: normalized.zip,
        country: normalized.country,
        name: normalized.name,
        phone: normalized.phone,
        email: normalized.email,
      },
    };

    const response = await this.request<{ address: EasyPostAddress }>(
      "POST",
      `${this.baseUrl}/addresses`,
      {
        headers: { Authorization: this.authHeader },
        body: payload,
      }
    );

    return response.address;
  }

  /**
   * Create a parcel in EasyPost.
   */
  private async createParcel(request: ShipmentRequest): Promise<EasyPostParcel> {
    const weight = this.UnitConverter.normalizeWeight(request.weight);

    // Convert kg to ounces for EasyPost
    const ounces = weight.value * 35.274;

    const payload = {
      parcel: {
        weight: ounces,
        length: request.dimensions
          ? this.UnitConverter.cmToIn(request.dimensions.length)
          : undefined,
        width: request.dimensions
          ? this.UnitConverter.cmToIn(request.dimensions.width)
          : undefined,
        height: request.dimensions
          ? this.UnitConverter.cmToIn(request.dimensions.height)
          : undefined,
      },
    };

    const response = await this.request<{ parcel: EasyPostParcel }>(
      "POST",
      `${this.baseUrl}/parcels`,
      {
        headers: { Authorization: this.authHeader },
        body: payload,
      }
    );

    return response.parcel;
  }

  /**
   * Normalize EasyPost rate to internal format.
   */
  private normalizeRate(rate: EasyPostRate): ShipmentRate {
    return {
      rateId: rate.id,
      carrier: this.normalizeCarrier(rate.carrier) as CarrierType,
      service: this.normalizeService(rate.service) as ServiceLevel,
      price: Math.round(parseFloat(rate.rate) * 100),
      currency: "USD",
      estimatedDays: rate.est_delivery_days || 5,
      insurable: true,
      rawResponse: rate,
    };
  }

  /**
   * Normalize EasyPost shipment to label format.
   */
  private normalizeLabel(shipment: EasyPostShipment): ShipmentLabel {
    const labelUrl = shipment.postage_label?.url || "";

    return {
      labelId: shipment.id,
      trackingNumber: shipment.tracking_code,
      carrier: this.normalizeCarrier(shipment.carrier) as CarrierType,
      service: this.normalizeService(shipment.service) as ServiceLevel,
      labelUrl,
      format: this.normalizeLabelFormat(
        shipment.postage_label?.fileformat || "pdf"
      ) as LabelFormat,
      createdAt: new Date(shipment.created_at),
      rawResponse: shipment,
    };
  }

  /**
   * Normalize carrier code to internal format.
   */
  private normalizeCarrier(code: string): CarrierType {
    const mapping: Record<string, CarrierType> = {
      FEDEX: "FEDEX",
      UPS: "UPS",
      USPS: "USPS",
      DHL: "DHL",
    };

    const codeUpper = code.toUpperCase();
    return mapping[codeUpper] || "EASYPOST";
  }

  /**
   * Normalize service code to internal format.
   */
  private normalizeService(code: string): ServiceLevel {
    const codeUpper = code.toUpperCase();

    if (codeUpper.includes("GROUND")) return "GROUND";
    if (codeUpper.includes("EXPRESS")) return "EXPRESS";
    if (codeUpper.includes("OVERNIGHT")) return "OVERNIGHT";
    if (codeUpper.includes("PRIORITY")) return "PRIORITY";

    return "STANDARD";
  }

  /**
   * Normalize label format.
   */
  private normalizeLabelFormat(format: string): string {
    const mapping: Record<string, LabelFormat> = {
      pdf: "PDF",
      png: "PNG",
      zpl: "ZPL",
    };

    return mapping[format.toLowerCase()] || "PDF";
  }

  /**
   * Webhook handler for EasyPost events.
   * Includes HMAC verification for security.
   */
  public parseWebhook(
    payload: unknown,
    headers: Record<string, string>
  ): ShippingWebhookEvent | null {
    if (typeof payload !== "object" || payload === null) {
      return null;
    }

    const data = payload as Record<string, unknown>;
    const result = data.result as Record<string, unknown> | undefined;

    // Verify HMAC signature if webhook_secret is configured
    const signature = headers["x-webhook-signature"];
    if (signature && this.config.apiSecret) {
      const hmac = createHmac("sha256", this.config.apiSecret);
      hmac.update(JSON.stringify(payload));
      const expected = hmac.digest("hex");

      if (signature !== expected) {
        console.warn("EasyPost webhook signature verification failed");
        return null;
      }
    }

    return {
      eventType: String(data.description || "UNKNOWN"),
      resourceId: String(result?.id || ""),
      carrier: "EASYPOST",
      trackingNumber: (result as Record<string, unknown>)
        ?.tracking_code as string | undefined,
      data: payload,
      timestamp: new Date(),
      rawPayload: payload,
    };
  }
}
