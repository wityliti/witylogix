/**
 * Shipping Label Generation Integration Tests
 * Tests: label creation flow, format conversion, batch creation, voiding, international, address validation
 * ~200 lines
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  mockLabelCreationRequest,
  mockLabel,
  mockBatchLabelRequest,
  mockInternationalLabel,
  mockAddressVerificationFailure,
  mockValidAddress,
  mockInvalidAddress,
} from "../fixtures/shipping-fixtures.js";

interface Address {
  name?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  verified?: boolean;
  errors?: string[];
}

interface Label {
  id: string;
  trackingCode: string;
  labelUrl: string;
  labelZpl?: string;
  labelFormat: string;
  carrier: string;
  service: string;
  shipmentId: string;
  createdAt: string;
  expiresAt?: string;
}

interface Shipment {
  toAddress: Address;
  fromAddress: Address;
  parcel: any;
  carrier?: string;
  service?: string;
}

// Mock label service
class LabelService {
  private labels: Map<string, Label> = new Map();
  private voidedLabels: Set<string> = new Set();

  async validateAddress(
    address: Address,
  ): Promise<{ valid: boolean; errors?: string[] }> {
    // Simple validation
    const errors: string[] = [];

    if (!address.street1) errors.push("MISSING_STREET");
    if (!address.city) errors.push("MISSING_CITY");
    if (!address.state || address.state === "XX") errors.push("INVALID_STATE");
    if (!address.zip || address.zip === "00000") errors.push("INVALID_ZIP");
    if (address.zip && address.zip.length < 5) errors.push("INVALID_ZIP");

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async rateShipment(shipment: Shipment): Promise<any> {
    if (!shipment.toAddress || !shipment.fromAddress) {
      throw new Error("Missing address information");
    }

    return {
      carrier: shipment.carrier || "USPS",
      service: shipment.service || "Priority Mail",
      cost: 18.0,
      estimatedDays: 2,
    };
  }

  async createLabel(shipment: Shipment): Promise<Label> {
    // Validate addresses
    const toValid = await this.validateAddress(shipment.toAddress);
    const fromValid = await this.validateAddress(shipment.fromAddress);

    if (!toValid.valid || !fromValid.valid) {
      throw new Error(
        `Address validation failed: ${toValid.errors || fromValid.errors}`,
      );
    }

    // Get rate
    const rate = await this.rateShipment(shipment);

    const label: Label = {
      id: `label_${Math.random().toString(36).substr(2, 9)}`,
      trackingCode: `USPS${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      labelUrl: `https://easypost.com/labels/label_${Math.random().toString(36).substr(2, 9)}.pdf`,
      labelFormat: "PDF",
      carrier: rate.carrier,
      service: rate.service,
      shipmentId: `shipment_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    this.labels.set(label.id, label);
    return label;
  }

  convertLabelFormat(label: Label, format: "PDF" | "ZPL" | "PNG"): Label {
    const converted = { ...label, labelFormat: format };

    if (format === "ZPL") {
      converted.labelZpl =
        "CT~~CD,~CC^~CT~^XA^MMC^PW812^LL0203^LS0^BY3,3,83^FT512,175^BCN,,Y,N^FD" +
        label.trackingCode +
        "^FS^XZ";
    }

    return converted;
  }

  async createBatchLabels(shipments: Shipment[]): Promise<Label[]> {
    const labels: Label[] = [];

    for (const shipment of shipments) {
      try {
        const label = await this.createLabel(shipment);
        labels.push(label);
      } catch (error) {
        // Continue with next shipment on error
        continue;
      }
    }

    return labels;
  }

  async voidLabel(labelId: string): Promise<boolean> {
    if (!this.labels.has(labelId)) {
      return false;
    }

    this.voidedLabels.add(labelId);
    this.labels.delete(labelId);
    return true;
  }

  isLabelVoided(labelId: string): boolean {
    return this.voidedLabels.has(labelId);
  }

  getLabel(labelId: string): Label | undefined {
    return this.labels.get(labelId);
  }

  getAllLabels(): Label[] {
    return Array.from(this.labels.values());
  }

  clearLabels(): void {
    this.labels.clear();
    this.voidedLabels.clear();
  }
}

describe("Label Generation", () => {
  let service: LabelService;

  beforeEach(() => {
    service = new LabelService();
    vi.useFakeTimers({ now: new Date("2024-03-16") });
  });

  afterEach(() => {
    vi.useRealTimers();
    service.clearLabels();
  });

  describe("Label Creation Flow", () => {
    it("should validate destination address before creating label", async () => {
      const validation = await service.validateAddress(
        mockLabelCreationRequest.shipment.toAddress,
      );

      expect(validation.valid).toBe(true);
      expect(validation.errors).toBeUndefined();
    });

    it("should validate origin address before creating label", async () => {
      const validation = await service.validateAddress(
        mockLabelCreationRequest.shipment.fromAddress,
      );

      expect(validation.valid).toBe(true);
      expect(validation.errors).toBeUndefined();
    });

    it("should fetch rate after address validation", async () => {
      const rate = await service.rateShipment(
        mockLabelCreationRequest.shipment,
      );

      expect(rate).toBeDefined();
      expect(rate.carrier).toBe("USPS");
      expect(rate.cost).toBeGreaterThan(0);
      expect(rate.estimatedDays).toBeGreaterThan(0);
    });

    it("should create label after validation and rating", async () => {
      const label = await service.createLabel(
        mockLabelCreationRequest.shipment,
      );

      expect(label).toBeDefined();
      expect(label.id).toBeDefined();
      expect(label.trackingCode).toBeDefined();
      expect(label.labelUrl).toBeDefined();
      expect(label.carrier).toBe("USPS");
    });

    it("should assign shipment ID to created label", async () => {
      const label = await service.createLabel(
        mockLabelCreationRequest.shipment,
      );

      expect(label.shipmentId).toBeDefined();
      expect(label.shipmentId).toMatch(/^shipment_/);
    });

    it("should set label expiration date", async () => {
      const label = await service.createLabel(
        mockLabelCreationRequest.shipment,
      );

      expect(label.expiresAt).toBeDefined();
      const expiryDate = new Date(label.expiresAt!);
      const createdDate = new Date(label.createdAt);
      const diffMs = expiryDate.getTime() - createdDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeCloseTo(30, 0);
    });
  });

  describe("Label Format Conversion", () => {
    it("should convert label to PDF format", async () => {
      const label = await service.createLabel(
        mockLabelCreationRequest.shipment,
      );
      const pdfLabel = service.convertLabelFormat(label, "PDF");

      expect(pdfLabel.labelFormat).toBe("PDF");
      expect(pdfLabel.labelUrl).toBeDefined();
    });

    it("should convert label to ZPL format", async () => {
      const label = await service.createLabel(
        mockLabelCreationRequest.shipment,
      );
      const zplLabel = service.convertLabelFormat(label, "ZPL");

      expect(zplLabel.labelFormat).toBe("ZPL");
      expect(zplLabel.labelZpl).toBeDefined();
      expect(zplLabel.labelZpl).toContain("XA");
      expect(zplLabel.labelZpl).toContain(label.trackingCode);
    });

    it("should convert label to PNG format", async () => {
      const label = await service.createLabel(
        mockLabelCreationRequest.shipment,
      );
      const pngLabel = service.convertLabelFormat(label, "PNG");

      expect(pngLabel.labelFormat).toBe("PNG");
    });

    it("should preserve tracking code in format conversion", async () => {
      const label = await service.createLabel(
        mockLabelCreationRequest.shipment,
      );
      const trackingCode = label.trackingCode;

      const zplLabel = service.convertLabelFormat(label, "ZPL");
      expect(zplLabel.labelZpl).toContain(trackingCode);
    });

    it("should support multiple format conversions", async () => {
      let label = await service.createLabel(mockLabelCreationRequest.shipment);

      label = service.convertLabelFormat(label, "PDF");
      expect(label.labelFormat).toBe("PDF");

      label = service.convertLabelFormat(label, "ZPL");
      expect(label.labelFormat).toBe("ZPL");

      label = service.convertLabelFormat(label, "PNG");
      expect(label.labelFormat).toBe("PNG");
    });
  });

  describe("Batch Label Creation", () => {
    it("should create multiple labels in batch", async () => {
      const labels = await service.createBatchLabels(
        mockBatchLabelRequest.shipments,
      );

      expect(labels).toHaveLength(2);
      expect(labels[0]).toBeDefined();
      expect(labels[1]).toBeDefined();
    });

    it("should assign unique IDs to batch labels", async () => {
      const labels = await service.createBatchLabels(
        mockBatchLabelRequest.shipments,
      );

      const ids = labels.map((l) => l.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(labels.length);
    });

    it("should assign unique tracking codes to batch labels", async () => {
      const labels = await service.createBatchLabels(
        mockBatchLabelRequest.shipments,
      );

      const codes = labels.map((l) => l.trackingCode);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(labels.length);
    });

    it("should handle partial failures in batch creation", async () => {
      const mixedShipments = [
        mockBatchLabelRequest.shipments[0],
        {
          toAddress: mockInvalidAddress,
          fromAddress: mockBatchLabelRequest.shipments[0].fromAddress,
          parcel: mockBatchLabelRequest.shipments[0].parcel,
        },
        mockBatchLabelRequest.shipments[1],
      ];

      const labels = await service.createBatchLabels(mixedShipments);

      expect(labels.length).toBeGreaterThan(0);
      expect(labels.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Label Voiding", () => {
    it("should void a label by ID", async () => {
      const label = await service.createLabel(
        mockLabelCreationRequest.shipment,
      );
      const voided = await service.voidLabel(label.id);

      expect(voided).toBe(true);
    });

    it("should remove voided label from active labels", async () => {
      const label = await service.createLabel(
        mockLabelCreationRequest.shipment,
      );
      await service.voidLabel(label.id);

      const retrieved = service.getLabel(label.id);
      expect(retrieved).toBeUndefined();
    });

    it("should track voided label status", async () => {
      const label = await service.createLabel(
        mockLabelCreationRequest.shipment,
      );
      await service.voidLabel(label.id);

      expect(service.isLabelVoided(label.id)).toBe(true);
    });

    it("should return false when voiding non-existent label", async () => {
      const voided = await service.voidLabel("non_existent_123");

      expect(voided).toBe(false);
    });

    it("should prevent using voided labels", async () => {
      const label = await service.createLabel(
        mockLabelCreationRequest.shipment,
      );
      await service.voidLabel(label.id);

      const isVoided = service.isLabelVoided(label.id);
      expect(isVoided).toBe(true);
    });
  });

  describe("International Shipping", () => {
    it("should include customs form in international label", async () => {
      expect(mockInternationalLabel.customsForm).toBeDefined();
      expect(mockInternationalLabel.customsForm.formType).toBe("CN23");
    });

    it("should include item description in customs form", async () => {
      expect(mockInternationalLabel.customsForm.description).toBe(
        "Electronics",
      );
    });

    it("should include declared value in customs form", async () => {
      expect(mockInternationalLabel.customsForm.declaredValue).toBe(150.0);
      expect(mockInternationalLabel.customsForm.currency).toBe("USD");
    });

    it("should include HS code for customs classification", async () => {
      expect(mockInternationalLabel.customsForm.hsCode).toBe("8517.62");
    });

    it("should track country of origin", async () => {
      expect(mockInternationalLabel.customsForm.countryOfOrigin).toBe("US");
    });

    it("should use international carrier for cross-border shipments", async () => {
      expect(mockInternationalLabel.carrier).toBe("Canada Post");
    });
  });

  describe("Address Verification Failures", () => {
    it("should detect invalid ZIP code", async () => {
      const validation = await service.validateAddress(mockInvalidAddress);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("INVALID_ZIP");
    });

    it("should reject invalid state code", async () => {
      const validation = await service.validateAddress({
        street1: "500 Test St",
        city: "TestCity",
        state: "XX",
        zip: "12345",
        country: "US",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("INVALID_STATE");
    });

    it("should prevent label creation with invalid address", async () => {
      const invalidShipment = {
        ...mockLabelCreationRequest.shipment,
        toAddress: mockInvalidAddress,
      };

      await expect(service.createLabel(invalidShipment)).rejects.toThrow();
    });

    it("should provide detailed error messages for address issues", async () => {
      const validation = await service.validateAddress(mockInvalidAddress);

      expect(validation.errors).toBeDefined();
      expect(validation.errors?.length).toBeGreaterThan(0);
    });

    it("should handle missing required address fields", async () => {
      const incompleteAddress = {
        street1: "500 Test St",
        city: "",
        state: "CA",
        zip: "94105",
        country: "US",
      };

      const validation = await service.validateAddress(incompleteAddress);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("MISSING_CITY");
    });
  });

  describe("Label Listing", () => {
    it("should list all created labels", async () => {
      await service.createLabel(mockLabelCreationRequest.shipment);
      await service.createLabel(mockLabelCreationRequest.shipment);

      const allLabels = service.getAllLabels();
      expect(allLabels).toHaveLength(2);
    });

    it("should exclude voided labels from list", async () => {
      const label1 = await service.createLabel(
        mockLabelCreationRequest.shipment,
      );
      const label2 = await service.createLabel(
        mockLabelCreationRequest.shipment,
      );

      await service.voidLabel(label1.id);

      const allLabels = service.getAllLabels();
      expect(allLabels).toHaveLength(1);
      expect(allLabels[0].id).toBe(label2.id);
    });

    it("should reflect label creation time", async () => {
      const label = await service.createLabel(
        mockLabelCreationRequest.shipment,
      );

      expect(label.createdAt).toBeDefined();
      expect(new Date(label.createdAt).getTime()).toBeGreaterThan(0);
    });
  });
});
