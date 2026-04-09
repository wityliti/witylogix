/**
 * USPS Web Tools API v3 Adapter
 *
 * Native USPS integration for Witylogix (no third-party proxy).
 * Self-hosters configure via env vars: USPS_CONSUMER_KEY, USPS_CONSUMER_SECRET.
 *
 * Authentication: OAuth2 client credentials
 * Base URL: https://api.usps.com
 * Rate Limit: 60 req/min (conservative default)
 * Supported: domestic rate quotes, label creation, tracking, address validation
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

// ─── USPS API Response Types ────────────────────────────────────

interface USPSTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface USPSRatePrice {
  SKU: string;
  description: string;
  priceType: string; // RETAIL, COMMERCIAL, CONTRACT
  price: number;
  maxWeight: number;
  fees: Array<{ name: string; SKU: string; price: number }>;
  startDate: string;
  endDate: string;
  warnings?: string[];
}

interface USPSRateResponse {
  rateOptions: Array<{
    rates: USPSRatePrice[];
    totalBasePrice: number;
  }>;
}

interface USPSLabel {
  labelMetadata: {
    labelAddress: {
      streetAddress: string;
      city: string;
      ZIPCode: string;
      ZIPPlus4?: string;
      state: string;
      country?: string;
    };
    routingInformation: string;
    trackingNumber: string;
    constructCode: string;
    SKU: string;
    postage: number;
    extraServices?: Array<{ name: string; price: number }>;
    weight: number;
    dimensionalWeight?: number;
    zone?: string;
    mailingDate: string;
    labelImage: string; // base64 PDF
  };
}

interface USPSTrackingResponse {
  TrackSummary: {
    EventTime: string;
    EventDate: string;
    Event: string;
    EventCity: string;
    EventState: string;
    EventZIPCode: string;
    EventCountry: string;
    DeliveryAttributeCode?: string;
    GMT: string;
    GMTOffset: string;
  };
  TrackDetail: Array<{
    EventTime: string;
    EventDate: string;
    Event: string;
    EventCity: string;
    EventState: string;
    EventZIPCode: string;
    EventCountry: string;
    GMT: string;
    GMTOffset: string;
  }>;
}

interface USPSAddressResponse {
  firm?: string;
  address: {
    streetAddress: string;
    streetAddressAbbreviation?: string;
    secondaryAddress?: string;
    city: string;
    cityAbbreviation?: string;
    state: string;
    postalCode: string;
    ZIPPlus4?: string;
    urbanization?: string;
    country: string;
    countryISOCode: string;
  };
  corrections?: Array<{ originalValue: string; correctedValue: string }>;
  matches?: Array<{ address: unknown }>;
}

// ─── Service Code Map ────────────────────────────────────────────

/** Map USPS mail class codes to our ServiceLevel */
const USPS_SERVICE_MAP: Record<string, string> = {
  PRIORITY_MAIL_EXPRESS: "OVERNIGHT",
  PRIORITY_MAIL: "PRIORITY",
  USPS_GROUND_ADVANTAGE: "GROUND",
  FIRST_CLASS_PACKAGE_SERVICE: "STANDARD",
  LIBRARY_MAIL: "ECONOMY",
  MEDIA_MAIL: "ECONOMY",
  PARCEL_SELECT: "GROUND",
};

// ─── USPS Adapter ────────────────────────────────────────────────

export interface USPSConfig extends ShippingConfig {
  consumerKey: string;
  consumerSecret: string;
  isSandbox?: boolean;
}

/**
 * USPS Web Tools API v3 adapter.
 * Implements IShippingAdapter for domestic US shipments.
 */
export class USPSAdapter extends ShippingAdapter {
  private readonly baseUrl: string;
  private accessToken?: string;
  private tokenExpiresAt?: number;

  constructor(config: USPSConfig) {
    super(config, 1); // 1 rps (60/min conservative)
    this.baseUrl = config.isSandbox
      ? "https://api-cat.usps.com"
      : "https://api.usps.com";
  }

  async validateConfig(): Promise<void> {
    const cfg = this.config as USPSConfig;
    if (!cfg.consumerKey || !cfg.consumerSecret) {
      throw new Error(
        "USPS adapter requires consumerKey and consumerSecret (USPS_CONSUMER_KEY, USPS_CONSUMER_SECRET)"
      );
    }
    await this.ensureAuthenticated();
  }

  async getRates(request: ShipmentRequest): Promise<ShipmentRate[]> {
    await this.ensureAuthenticated();

    const weight = this.UnitConverter.normalizeWeight(request.weight);
    const weightLb = this.UnitConverter.kgToLb(weight.value);

    const body = {
      originZIPCode: request.from.zip,
      destinationZIPCode: request.to.zip,
      weight: weightLb,
      length: request.dimensions?.length
        ? this.UnitConverter.cmToIn(request.dimensions.length)
        : undefined,
      width: request.dimensions?.width
        ? this.UnitConverter.cmToIn(request.dimensions.width)
        : undefined,
      height: request.dimensions?.height
        ? this.UnitConverter.cmToIn(request.dimensions.height)
        : undefined,
      mailClasses: [
        "PRIORITY_MAIL_EXPRESS",
        "PRIORITY_MAIL",
        "USPS_GROUND_ADVANTAGE",
        "FIRST_CLASS_PACKAGE_SERVICE",
      ],
      priceType: "RETAIL",
    };

    const data = await this.request<USPSRateResponse>(
      "POST",
      `${this.baseUrl}/v3/prices/search`,
      { headers: this.authHeaders(), body }
    );

    const rates: ShipmentRate[] = [];
    for (const option of data.rateOptions ?? []) {
      for (const r of option.rates ?? []) {
        const service = USPS_SERVICE_MAP[r.SKU] ?? "STANDARD";
        rates.push({
          rateId: r.SKU,
          carrier: "USPS",
          service: service as ShipmentRate["service"],
          price: Math.round(r.price * 100), // dollars → cents
          currency: "USD",
          estimatedDays: this.estimateDeliveryDays(r.SKU),
          insurable: true,
          rawResponse: r,
        });
      }
    }
    return rates;
  }

  async createShipment(
    request: ShipmentRequest,
    rateId: string
  ): Promise<ShipmentLabel> {
    await this.ensureAuthenticated();

    const from = this.AddressNormalizer.normalize(request.from);
    const to = this.AddressNormalizer.normalize(request.to);
    const weight = this.UnitConverter.normalizeWeight(request.weight);

    const body = {
      toAddress: {
        streetAddress: to.street1,
        secondaryAddress: to.street2,
        city: to.city,
        state: to.state,
        ZIPCode: to.zip,
        country: to.country,
      },
      fromAddress: {
        streetAddress: from.street1,
        secondaryAddress: from.street2,
        city: from.city,
        state: from.state,
        ZIPCode: from.zip,
        country: from.country,
      },
      packageDescription: {
        weight: this.UnitConverter.kgToLb(weight.value),
        length: request.dimensions
          ? this.UnitConverter.cmToIn(request.dimensions.length)
          : undefined,
        height: request.dimensions
          ? this.UnitConverter.cmToIn(request.dimensions.height)
          : undefined,
        width: request.dimensions
          ? this.UnitConverter.cmToIn(request.dimensions.width)
          : undefined,
        mailClass: rateId,
        processingCategory: "MACHINABLE",
        destinationEntryFacilityType: "NONE",
        rateIndicator: "SP",
        destinationZIPCode: to.zip,
      },
      labelMetadata: {
        labelType: "4X6LABEL",
        imageInfo: { imageType: "PDF", resolution: "200" },
      },
    };

    const data = await this.request<USPSLabel>(
      "POST",
      `${this.baseUrl}/v3/labels`,
      { headers: this.authHeaders(), body }
    );

    const meta = data.labelMetadata;
    const labelBytes = Buffer.from(meta.labelImage, "base64");

    return {
      labelId: meta.trackingNumber,
      trackingNumber: meta.trackingNumber,
      carrier: "USPS",
      service: (USPS_SERVICE_MAP[rateId] ?? "STANDARD") as ShipmentLabel["service"],
      labelUrl: "",
      format: "PDF",
      labelBytes,
      rateId,
      createdAt: new Date(),
      rawResponse: data,
    };
  }

  async getLabel(labelId: string): Promise<ShipmentLabel> {
    // USPS v3 does not have a separate get-label endpoint — return stub
    return {
      labelId,
      trackingNumber: labelId,
      carrier: "USPS",
      service: "STANDARD",
      labelUrl: "",
      format: "PDF",
      createdAt: new Date(),
    };
  }

  async track(trackingNumber: string): Promise<TrackingResult> {
    await this.ensureAuthenticated();

    const data = await this.request<USPSTrackingResponse>(
      "GET",
      `${this.baseUrl}/v3/tracking/${encodeURIComponent(trackingNumber)}`,
      { headers: this.authHeaders() }
    );

    const events: TrackingEvent[] = [];

    if (data.TrackSummary) {
      events.push(this.parseEvent(data.TrackSummary));
    }
    for (const detail of data.TrackDetail ?? []) {
      events.push(this.parseEvent(detail));
    }

    // Sort chronologically
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const latest = events[events.length - 1];
    const status = latest?.status ?? "UNKNOWN";
    const delivered = status === "DELIVERED";

    return {
      trackingNumber,
      carrier: "USPS",
      status,
      deliveryDate: delivered ? latest.timestamp : undefined,
      events,
      rawResponse: data,
    };
  }

  async cancelShipment(_labelId: string): Promise<boolean> {
    // USPS does not support label cancellation via API v3 — must be done via web portal
    return false;
  }

  async validateAddress(address: ShippingAddress): Promise<AddressValidationResult> {
    await this.ensureAuthenticated();

    const normalized = this.AddressNormalizer.normalize(address);
    const params = new URLSearchParams({
      streetAddress: normalized.street1,
      city: normalized.city,
      state: normalized.state,
      ZIPCode: normalized.zip,
    });
    if (normalized.street2) {
      params.set("secondaryAddress", normalized.street2);
    }

    try {
      const data = await this.request<USPSAddressResponse>(
        "GET",
        `${this.baseUrl}/v3/addresses?${params.toString()}`,
        { headers: this.authHeaders() }
      );

      const corrected = data.address;
      return {
        valid: true,
        address: {
          name: address.name,
          street1: corrected.streetAddress,
          street2: corrected.secondaryAddress,
          city: corrected.city,
          state: corrected.state,
          zip: corrected.postalCode,
          country: corrected.countryISOCode || "US",
          phone: address.phone,
          email: address.email,
        },
        messages: (data.corrections ?? []).map(
          (c) => `${c.originalValue} → ${c.correctedValue}`
        ),
        rawResponse: data,
      };
    } catch {
      return { valid: false, messages: ["Address validation failed"] };
    }
  }

  // ─── Private helpers ─────────────────────────────────────────

  private async authenticate(): Promise<void> {
    const cfg = this.config as USPSConfig;
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: cfg.consumerKey,
      client_secret: cfg.consumerSecret,
    });

    const response = await fetch(`${this.baseUrl}/v3/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`USPS authentication failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as USPSTokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000 - 30_000;
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || Date.now() >= (this.tokenExpiresAt ?? 0)) {
      await this.authenticate();
    }
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  private estimateDeliveryDays(mailClass: string): number {
    const map: Record<string, number> = {
      PRIORITY_MAIL_EXPRESS: 1,
      PRIORITY_MAIL: 2,
      USPS_GROUND_ADVANTAGE: 5,
      FIRST_CLASS_PACKAGE_SERVICE: 3,
      PARCEL_SELECT: 7,
      LIBRARY_MAIL: 10,
      MEDIA_MAIL: 10,
    };
    return map[mailClass] ?? 5;
  }

  private parseEvent(
    e: USPSTrackingResponse["TrackSummary"]
  ): TrackingEvent {
    const ts = new Date(`${e.EventDate} ${e.EventTime}`);
    const location = [e.EventCity, e.EventState, e.EventZIPCode]
      .filter(Boolean)
      .join(", ");

    return {
      timestamp: isNaN(ts.getTime()) ? new Date() : ts,
      status: this.normalizeStatus(e.Event),
      message: e.Event,
      location: location || undefined,
      rawResponse: e,
    };
  }

  private normalizeStatus(event: string): string {
    const lower = event.toLowerCase();
    if (lower.includes("delivered")) return "DELIVERED";
    if (lower.includes("out for delivery")) return "OUT_FOR_DELIVERY";
    if (lower.includes("in transit") || lower.includes("in-transit")) return "IN_TRANSIT";
    if (lower.includes("accepted") || lower.includes("picked up")) return "PICKED_UP";
    if (lower.includes("arrived")) return "IN_TRANSIT";
    if (lower.includes("departed")) return "IN_TRANSIT";
    if (lower.includes("exception") || lower.includes("held")) return "EXCEPTION";
    return "UNKNOWN";
  }
}
