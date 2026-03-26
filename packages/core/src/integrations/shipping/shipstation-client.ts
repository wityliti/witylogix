/**
 * ShipStation API Client
 *
 * Implements IShippingAdapter for ShipStation integration.
 * Authentication: Basic HTTP authentication (API key:API secret encoded in base64)
 * API Base: https://ssapi.shipstation.com
 * Rate Limit: 40 requests per second
 *
 * ShipStation-specific features:
 * - Multi-carrier rate shopping (FedEx, UPS, USPS, DHL, OnTrac, etc.)
 * - Order management and creation
 * - Carrier and service level management
 * - Webhook support for shipment events
 * - Batch label creation
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
  CarrierType,
  ServiceLevel,
  LabelFormat,
  ShippingWebhookEvent,
} from "./types.js";

// ─── ShipStation API Types ──────────────────────────────────────

interface ShipStationCarrier {
  code: string;
  name: string;
  balance: number;
  isAccount: boolean;
}

interface ShipStationService {
  carrierCode: string;
  code: string;
  name: string;
}

interface ShipStationRate {
  rateId: number;
  carrierCode: string;
  serviceCode: string;
  serviceName: string;
  shipDate: string;
  negotiatedRate: number;
  baseRate: number;
  otherCost: number;
  insurance: number;
  confirmationAmount: number;
  transactionId: string;
}

interface ShipStationLabel {
  labelId: number;
  shipmentId: number;
  shipDate: string;
  trackingNumber: string;
  hasReturnLabel: boolean;
  isReturnLabel: boolean;
  labelDownload: {
    href: string;
    pdf: string;
    png: string;
    zpl: string;
  };
  labelFormat: string;
  labelLayout: string;
  carrierCode: string;
  serviceCode: string;
  packageCode: string;
  voided: boolean;
  voidedDate: string;
}

interface ShipStationShipment {
  shipmentId: number;
  orderId: number;
  userId: string;
  customerEmail: string;
  shipDate: string;
  shipmentCost: number;
  insuranceCost: number;
  trackingNumber: string;
  isReturnLabel: boolean;
  batchNumber: string;
  carrierCode: string;
  serviceCode: string;
  packageCode: string;
  confirmation: string;
  warehouseId: number;
  labelId: number;
  outboundSort: string;
  internationalOptions: unknown;
  advancedOptions: unknown;
  weight: {
    value: number;
    units: string;
  };
  dimensions: {
    unit: string;
    length: number;
    width: number;
    height: number;
  };
  insuranceOptions: {
    insureShipment: boolean;
    insuredValue: number;
    insuranceProvider: string;
  };
  internationalOptions: {
    contents: string;
    customsItems: unknown[];
    nonDelivery: string;
  };
  addressValidationStatus: string;
  shipTo: ShipStationAddress;
  shipFrom: ShipStationAddress;
  returnTo: ShipStationAddress;
}

interface ShipStationAddress {
  name: string;
  company: string;
  street1: string;
  street2: string;
  street3: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  residential: boolean;
}

interface ShipStationTrackingEvent {
  eventType: string;
  eventTimestamp: string;
  carrierStatus: string;
  carrierStatusMessage: string;
  description: string;
  cityLocality: string;
  stateProvince: string;
  postalCode: string;
  countryCode: string;
  company: string;
}

// ─── ShipStation Client ──────────────────────────────────────────

/**
 * ShipStation API Client
 */
export class ShipStationClient extends ShippingAdapter {
  readonly provider = "shipstation" as const;

  private baseUrl: string;

  private apiKey: string;

  private apiSecret: string;

  private authHeader: string;

  constructor(config: ShippingConfig) {
    super(config, 40); // 40 requests per second
    this.baseUrl = config.baseUrl || "https://ssapi.shipstation.com";
    this.apiKey = config.apiKey || "";
    this.apiSecret = config.apiSecret || "";

    // Encode API key:secret in base64 for Basic auth
    const credentials = `${this.apiKey}:${this.apiSecret}`;
    this.authHeader = `Basic ${Buffer.from(credentials).toString("base64")}`;
  }

  async validateConfig(): Promise<void> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error("ShipStation API key is required");
    }
    if (!this.apiSecret || this.apiSecret.trim().length === 0) {
      throw new Error("ShipStation API secret is required");
    }

    try {
      await this.getCarriers();
    } catch (error: unknown) {
      throw new Error(
        `Failed to validate ShipStation credentials: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get shipping rates from ShipStation.
   * ShipStation calls this "getrates" and accepts shipment details.
   */
  async getRates(request: ShipmentRequest): Promise<ShipmentRate[]> {
    const payload = {
      carrierCode: undefined, // null = all carriers
      serviceCode: undefined, // null = all services
      packageCode: this.normalizePackageCode(request.packageType),
      fromPostalCode: request.from.zip,
      toState: request.to.state,
      toCountry: request.to.country,
      toPostalCode: request.to.zip,
      weight: {
        value: this.UnitConverter.normalizeWeight(request.weight).value,
        units: "ounces",
      },
      dimensions: request.dimensions
        ? {
            unit: "inches",
            length: this.UnitConverter.cmToIn(request.dimensions.length),
            width: this.UnitConverter.cmToIn(request.dimensions.width),
            height: this.UnitConverter.cmToIn(request.dimensions.height),
          }
        : undefined,
      confirmation: request.deliveryConfirmation || "none",
      insuranceOptions: request.insureValue
        ? {
            insureShipment: true,
            insuredValue: request.insureValue / 100,
          }
        : undefined,
    };

    const response = await this.request<{ rates: ShipStationRate[] }>(
      "POST",
      `${this.baseUrl}/shipments/getrates`,
      {
        headers: { Authorization: this.authHeader },
        body: payload,
      }
    );

    return (response.rates || []).map((rate: ShipStationRate) =>
      this.normalizeRate(rate)
    );
  }

  /**
   * Create a shipment/label in ShipStation.
   */
  async createShipment(
    request: ShipmentRequest,
    rateId: string
  ): Promise<ShipmentLabel> {
    const payload = {
      carrierCode: undefined,
      serviceCode: undefined,
      packageCode: this.normalizePackageCode(request.packageType),
      confirmation: request.deliveryConfirmation || "none",
      shipDate: new Date().toISOString().split("T")[0],
      weight: {
        value: this.UnitConverter.normalizeWeight(request.weight).value,
        units: "ounces",
      },
      dimensions: request.dimensions
        ? {
            unit: "inches",
            length: this.UnitConverter.cmToIn(request.dimensions.length),
            width: this.UnitConverter.cmToIn(request.dimensions.width),
            height: this.UnitConverter.cmToIn(request.dimensions.height),
          }
        : undefined,
      shipTo: this.addressToShipStation(request.to),
      shipFrom: this.addressToShipStation(request.from),
      insuranceOptions: request.insureValue
        ? {
            insureShipment: true,
            insuredValue: request.insureValue / 100,
          }
        : undefined,
      internationalOptions: this.shouldUseInternational(request.from, request.to)
        ? {
            contents: "MERCHANDISE",
          }
        : undefined,
    };

    const response = await this.request<{ shipmentId: number; labelId: number }>(
      "POST",
      `${this.baseUrl}/shipments/createlabel`,
      {
        headers: { Authorization: this.authHeader },
        body: payload,
      }
    );

    // Fetch the label details
    return this.getLabel(String(response.labelId));
  }

  /**
   * Get a previously created label.
   */
  async getLabel(labelId: string): Promise<ShipmentLabel> {
    const response = await this.request<ShipStationLabel>(
      "GET",
      `${this.baseUrl}/labels/${labelId}`,
      {
        headers: { Authorization: this.authHeader },
      }
    );

    return this.normalizeLabel(response);
  }

  /**
   * Track a shipment.
   */
  async track(trackingNumber: string): Promise<TrackingResult> {
    // ShipStation doesn't have direct tracking, so we'd normally
    // use the carrier's tracking API. For now, return a placeholder.
    const events: TrackingEvent[] = [];

    return {
      trackingNumber,
      carrier: "SHIPSTATION",
      status: "UNKNOWN",
      events,
      rawResponse: null,
    };
  }

  /**
   * Cancel a shipment/label.
   */
  async cancelShipment(labelId: string): Promise<boolean> {
    try {
      await this.request<{ success: boolean }>(
        "DELETE",
        `${this.baseUrl}/labels/${labelId}`,
        {
          headers: { Authorization: this.authHeader },
        }
      );
      return true;
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
      const response = await this.request<{ addressValidationStatus: string }>(
        "POST",
        `${this.baseUrl}/addresses/validate`,
        {
          headers: { Authorization: this.authHeader },
          body: this.addressToShipStation(normalized),
        }
      );

      return {
        valid: response.addressValidationStatus === "VALID",
        address: normalized,
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
   * Get available carriers for this account.
   */
  private async getCarriers(): Promise<ShipStationCarrier[]> {
    const response = await this.request<{ carriers: ShipStationCarrier[] }>(
      "GET",
      `${this.baseUrl}/carriers`,
      {
        headers: { Authorization: this.authHeader },
      }
    );

    return response.carriers || [];
  }

  /**
   * Get services for a carrier.
   */
  private async getCarrierServices(
    carrierCode: string
  ): Promise<ShipStationService[]> {
    const response = await this.request<{ services: ShipStationService[] }>(
      "GET",
      `${this.baseUrl}/carriers/listservices`,
      {
        headers: { Authorization: this.authHeader },
        query: { carrierCode },
      }
    );

    return response.services || [];
  }

  /**
   * Normalize ShipStation rate to internal format.
   */
  private normalizeRate(rate: ShipStationRate): ShipmentRate {
    return {
      rateId: String(rate.rateId),
      carrier: this.normalizeCarrier(rate.carrierCode) as CarrierType,
      service: this.normalizeService(rate.serviceCode) as ServiceLevel,
      price: Math.round(rate.negotiatedRate * 100),
      currency: "USD",
      estimatedDays: 5, // Default; should come from rate data
      insurable: !!rate.insurance,
      rawResponse: rate,
    };
  }

  /**
   * Normalize ShipStation label to internal format.
   */
  private normalizeLabel(label: ShipStationLabel): ShipmentLabel {
    const labelUrl = label.labelDownload?.pdf || label.labelDownload?.png || "";

    return {
      labelId: String(label.labelId),
      trackingNumber: label.trackingNumber,
      carrier: this.normalizeCarrier(label.carrierCode) as CarrierType,
      service: this.normalizeService(label.serviceCode) as ServiceLevel,
      labelUrl,
      format: label.labelFormat as LabelFormat,
      createdAt: new Date(label.shipDate),
      rawResponse: label,
    };
  }

  /**
   * Convert internal address to ShipStation format.
   */
  private addressToShipStation(address: ShippingAddress): ShipStationAddress {
    return {
      name: address.name,
      company: "",
      street1: address.street1,
      street2: address.street2 || "",
      street3: "",
      city: address.city,
      state: address.state,
      postalCode: address.zip,
      country: address.country,
      phone: address.phone || "",
      residential: false,
    };
  }

  /**
   * Normalize package type to ShipStation code.
   */
  private normalizePackageCode(packageType?: string): string {
    const mapping: Record<string, string> = {
      ENVELOPE: "envelope",
      PACKAGE: "package",
      PALLET: "pallet",
      BOX: "box",
      TUBE: "tube",
      PAK: "pak",
      FLAT_RATE_ENVELOPE: "flat_rate_envelope",
      FLAT_RATE_BOX: "flat_rate_box",
    };

    return mapping[packageType || "PACKAGE"] || "package";
  }

  /**
   * Normalize carrier code to internal format.
   */
  private normalizeCarrier(code: string): CarrierType {
    const mapping: Record<string, CarrierType> = {
      fedex: "FEDEX",
      ups: "UPS",
      usps: "USPS",
      dhl: "DHL",
    };

    return mapping[code.toLowerCase()] || "SHIPSTATION";
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
   * Check if shipment is international.
   */
  private shouldUseInternational(
    from: ShippingAddress,
    to: ShippingAddress
  ): boolean {
    return from.country !== to.country;
  }

  /**
   * Webhook handler for ShipStation events.
   * ShipStation sends webhook notifications when labels are created, shipments update, etc.
   */
  public parseWebhook(
    payload: unknown,
    headers: Record<string, string>
  ): ShippingWebhookEvent | null {
    if (typeof payload !== "object" || payload === null) {
      return null;
    }

    const data = payload as Record<string, unknown>;

    return {
      eventType: String(data.eventType || "UNKNOWN"),
      resourceId: String(data.resourceId || ""),
      carrier: "SHIPSTATION",
      trackingNumber: data.trackingNumber as string | undefined,
      data: payload,
      timestamp: new Date(),
      rawPayload: payload,
    };
  }
}
