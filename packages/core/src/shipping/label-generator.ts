/**
 * Label Generator
 *
 * Creates shipping labels across multiple carriers with unified interface.
 * Supports batch label generation, label validation, and format conversion.
 *
 * @module shipping/label-generator
 */

import {
  CarrierCode,
  Shipment,
  ShipmentLabel,
  ShippingError,
} from "./shipping-types";

// ============================================================================
// Types
// ============================================================================

/**
 * Label format options per carrier
 */
interface CarrierLabelFormats {
  /** Supported formats */
  formats: ("PDF" | "ZPL" | "PNG")[];

  /** Default format */
  default: "PDF" | "ZPL" | "PNG";
}

/**
 * Batch label creation result
 */
export interface BatchLabelResult {
  /** Successfully created labels */
  labels: ShipmentLabel[];

  /** Failed label creations */
  failures: {
    shipmentId: string;
    error: string;
  }[];

  /** Total duration in milliseconds */
  duration: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Label format support per carrier
 * Maps carrier to supported label formats
 */
const CARRIER_LABEL_FORMATS: Record<CarrierCode, CarrierLabelFormats> = {
  [CarrierCode.EASYPOST]: {
    formats: ["PDF", "ZPL", "PNG"],
    default: "PDF",
  },
  [CarrierCode.SHIPPO]: {
    formats: ["PDF", "ZPL"],
    default: "PDF",
  },
  [CarrierCode.SHIPSTATION]: {
    formats: ["PDF"],
    default: "PDF",
  },
  [CarrierCode.DHL]: {
    formats: ["PDF", "ZPL"],
    default: "PDF",
  },
  [CarrierCode.USPS]: {
    formats: ["PDF", "ZPL"],
    default: "PDF",
  },
  [CarrierCode.UPS]: {
    formats: ["PDF", "ZPL", "PNG"],
    default: "PDF",
  },
  [CarrierCode.FEDEX]: {
    formats: ["PDF", "ZPL"],
    default: "PDF",
  },
  [CarrierCode.DOORDASH]: {
    formats: ["PDF"],
    default: "PDF",
  },
  [CarrierCode.UBER]: {
    formats: ["PDF"],
    default: "PDF",
  },
};

// ============================================================================
// LabelGenerator Class
// ============================================================================

/**
 * Unified label creation across carriers
 *
 * Features:
 * - Unified interface for all carriers
 * - Address validation before label creation
 * - Batch label generation with parallel processing
 * - Format negotiation with fallback support
 * - Label voiding/cancellation
 */
export class LabelGenerator {
  /**
   * In-memory label storage (keyed by labelId)
   * In production, this would use a database
   */
  private labelStore = new Map<string, ShipmentLabel>();

  /**
   * Mock label creation functions (for testing)
   * Maps carrier to mock create function
   */
  private mockCarriers: Map<
    CarrierCode,
    (shipment: Shipment, format: string) => Promise<ShipmentLabel>
  > = new Map();

  /**
   * Register a mock carrier for testing
   * @param carrier - Carrier code
   * @param createFn - Mock create function
   */
  registerMockCarrier(
    carrier: CarrierCode,
    createFn: (shipment: Shipment, format: string) => Promise<ShipmentLabel>,
  ): void {
    this.mockCarriers.set(carrier, createFn);
  }

  /**
   * Create a shipping label
   * @param shipment - Shipment with addresses and packages
   * @param carrier - Carrier code
   * @param format - Label format (PDF/ZPL/PNG). Falls back to carrier default if not supported
   * @returns Created label
   */
  async createLabel(
    shipment: Shipment,
    carrier: CarrierCode,
    format: "PDF" | "ZPL" | "PNG" = "PDF",
  ): Promise<ShipmentLabel> {
    // Validate shipment data
    this.validateShipment(shipment);

    // Validate addresses before label creation
    await this.validateAddresses(shipment, carrier);

    // Negotiate format with carrier
    const negotiatedFormat = this.negotiateFormat(carrier, format);

    // Check for mock carrier first
    const mockFn = this.mockCarriers.get(carrier);
    if (mockFn) {
      const label = await mockFn(shipment, negotiatedFormat);
      this.labelStore.set(label.labelId, label);
      return label;
    }

    // In a real implementation, this would call the carrier's API
    // For now, we'll throw an error
    throw new ShippingError(
      "CARRIER_NOT_IMPLEMENTED",
      `Carrier ${carrier} label creation not yet implemented`,
      carrier,
    );
  }

  /**
   * Void/cancel a label
   * @param labelId - Label ID to void
   * @param carrier - Carrier code
   * @returns Whether void was successful
   */
  async voidLabel(labelId: string, carrier: CarrierCode): Promise<boolean> {
    if (!labelId) {
      throw new ShippingError(
        "INVALID_LABEL_ID",
        "Label ID is required",
        carrier,
      );
    }

    const label = this.labelStore.get(labelId);
    if (!label) {
      throw new ShippingError(
        "LABEL_NOT_FOUND",
        `Label ${labelId} not found`,
        carrier,
      );
    }

    if (label.carrier !== carrier) {
      throw new ShippingError(
        "CARRIER_MISMATCH",
        `Label belongs to ${label.carrier}, not ${carrier}`,
        carrier,
      );
    }

    // In a real implementation, this would call the carrier's void API
    // For now, we just remove it from our store
    this.labelStore.delete(labelId);

    return true;
  }

  /**
   * Get supported label formats for a carrier
   * @param carrier - Carrier code
   * @returns Supported formats
   */
  getLabelFormats(carrier: CarrierCode): ("PDF" | "ZPL" | "PNG")[] {
    const formats = CARRIER_LABEL_FORMATS[carrier];
    if (!formats) {
      throw new ShippingError(
        "UNSUPPORTED_CARRIER",
        `Carrier ${carrier} is not supported`,
        carrier,
      );
    }

    return formats.formats;
  }

  /**
   * Create labels for multiple shipments in parallel
   * @param shipments - Shipments to create labels for
   * @param carrier - Carrier code
   * @param format - Label format
   * @returns Results with successes and failures
   */
  async batchCreateLabels(
    shipments: Shipment[],
    carrier: CarrierCode,
    format: "PDF" | "ZPL" | "PNG" = "PDF",
  ): Promise<BatchLabelResult> {
    const startTime = Date.now();

    if (!shipments || shipments.length === 0) {
      return {
        labels: [],
        failures: [],
        duration: 0,
      };
    }

    // Create labels in parallel
    const results = await Promise.allSettled(
      shipments.map((shipment) => this.createLabel(shipment, carrier, format)),
    );

    const labels: ShipmentLabel[] = [];
    const failures: { shipmentId: string; error: string }[] = [];

    results.forEach((result, index) => {
      const shipmentId = shipments[index].shipmentId;

      if (result.status === "fulfilled") {
        labels.push(result.value);
      } else if (result.status === "rejected") {
        failures.push({
          shipmentId,
          error: result.reason?.message ?? "Unknown error",
        });
      }
    });

    return {
      labels,
      failures,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Retrieve a label by ID
   * @param labelId - Label ID
   * @returns Label or undefined if not found
   */
  getLabel(labelId: string): ShipmentLabel | undefined {
    return this.labelStore.get(labelId);
  }

  /**
   * Retrieve labels for a shipment
   * @param shipmentId - Shipment ID
   * @returns Array of labels for this shipment
   */
  getLabelsForShipment(shipmentId: string): ShipmentLabel[] {
    const labels: ShipmentLabel[] = [];

    this.labelStore.forEach((label) => {
      if (label.shipmentId === shipmentId) {
        labels.push(label);
      }
    });

    return labels;
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  /**
   * Validate shipment data
   */
  private validateShipment(shipment: Shipment): void {
    if (!shipment) {
      throw new ShippingError("INVALID_SHIPMENT", "Shipment is required");
    }

    if (!shipment.shipmentId) {
      throw new ShippingError("MISSING_SHIPMENT_ID", "Shipment ID is required");
    }

    if (!shipment.origin) {
      throw new ShippingError("MISSING_ORIGIN", "Origin address is required");
    }

    if (!shipment.destination) {
      throw new ShippingError(
        "MISSING_DESTINATION",
        "Destination address is required",
      );
    }

    if (!shipment.packages || shipment.packages.length === 0) {
      throw new ShippingError(
        "NO_PACKAGES",
        "At least one package is required",
      );
    }

    // Validate each package
    for (let i = 0; i < shipment.packages.length; i++) {
      const pkg = shipment.packages[i];

      if (!pkg.weight || pkg.weight <= 0) {
        throw new ShippingError(
          "INVALID_PACKAGE_WEIGHT",
          `Package ${i + 1}: weight must be positive`,
        );
      }

      if (!pkg.weightUnit) {
        throw new ShippingError(
          "MISSING_WEIGHT_UNIT",
          `Package ${i + 1}: weight unit is required`,
        );
      }
    }
  }

  /**
   * Validate addresses
   * In a real implementation, this would call address validation APIs
   */
  private async validateAddresses(
    shipment: Shipment,
    carrier: CarrierCode,
  ): Promise<void> {
    // Validate origin address
    this.validateAddress(shipment.origin, "origin", carrier);

    // Validate destination address
    this.validateAddress(shipment.destination, "destination", carrier);
  }

  /**
   * Validate a single address
   */
  private validateAddress(
    address: any,
    type: string,
    carrier: CarrierCode,
  ): void {
    if (!address.name) {
      throw new ShippingError(
        "INVALID_ADDRESS",
        `${type} address: name is required`,
        carrier,
      );
    }

    if (!address.street1) {
      throw new ShippingError(
        "INVALID_ADDRESS",
        `${type} address: street1 is required`,
        carrier,
      );
    }

    if (!address.city) {
      throw new ShippingError(
        "INVALID_ADDRESS",
        `${type} address: city is required`,
        carrier,
      );
    }

    if (!address.state) {
      throw new ShippingError(
        "INVALID_ADDRESS",
        `${type} address: state is required`,
        carrier,
      );
    }

    if (!address.zip) {
      throw new ShippingError(
        "INVALID_ADDRESS",
        `${type} address: zip is required`,
        carrier,
      );
    }

    if (!address.country) {
      throw new ShippingError(
        "INVALID_ADDRESS",
        `${type} address: country is required`,
        carrier,
      );
    }
  }

  /**
   * Negotiate label format with carrier
   * Falls back to carrier default if requested format not supported
   */
  private negotiateFormat(
    carrier: CarrierCode,
    requestedFormat: "PDF" | "ZPL" | "PNG",
  ): "PDF" | "ZPL" | "PNG" {
    const carrierFormats = CARRIER_LABEL_FORMATS[carrier];

    if (!carrierFormats) {
      throw new ShippingError(
        "UNSUPPORTED_CARRIER",
        `Carrier ${carrier} is not supported`,
        carrier,
      );
    }

    // Return requested format if supported
    if (carrierFormats.formats.includes(requestedFormat)) {
      return requestedFormat;
    }

    // Fall back to carrier default
    return carrierFormats.default;
  }
}
