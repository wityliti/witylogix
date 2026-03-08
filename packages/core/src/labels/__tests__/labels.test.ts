/**
 * Comprehensive test suite for labels module.
 * Tests cover barcode generation, label generators (ZPL, PDF, HTML),
 * and label type validation.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  encodeCode128B,
  renderBarcodeToSVG,
  generateBarcodeBase64PNG,
} from "../barcode";
import {
  type LabelData,
  type LabelAddress,
  type LabelOptions,
  type GeneratedLabel,
  generateLabel,
  generateLabels,
  generateZPLBatch,
} from "../index";
import { generateZPL } from "../generators/zpl";
import { generateHTML } from "../generators/html";
import { generatePDF } from "../generators/pdf";

// ============================================================================
// Barcode Generation Tests
// ============================================================================

describe("Barcode Generation", () => {
  describe("encodeCode128B", () => {
    it("should encode simple alphanumeric string", () => {
      const result = encodeCode128B("ABC123");
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((n) => typeof n === "number")).toBe(true);
    });

    it("should encode numbers", () => {
      const result = encodeCode128B("123456789");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should encode tracking numbers", () => {
      const result = encodeCode128B("1Z999AA10123456784");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should encode special characters in Code128 Set B", () => {
      const result = encodeCode128B("TEST-123!");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should throw error for unsupported characters", () => {
      // Code128 Set B doesn't support all unicode characters
      expect(() => encodeCode128B("TEST™")).toThrow();
    });

    it("should handle spaces", () => {
      const result = encodeCode128B("SHIP TO JOHN");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should include checksum in encoded result", () => {
      const result1 = encodeCode128B("ABC");
      const result2 = encodeCode128B("ABD");

      // Different inputs should produce different encoded outputs
      expect(result1.length).not.toBe(result2.length);
    });

    it("should handle long tracking numbers", () => {
      const longTracking = "1Z999AA10123456784FEDEXN1234567890123456";
      const result = encodeCode128B(longTracking);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should return array of bar pattern values", () => {
      const result = encodeCode128B("TEST");
      expect(Array.isArray(result)).toBe(true);
      expect(result.every((n) => n >= 0)).toBe(true);
    });

    it("should encode punctuation marks", () => {
      const result = encodeCode128B("TEST:123;PO");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle mixed case letters", () => {
      const result = encodeCode128B("TestLabel123");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("renderBarcodeToSVG", () => {
    it("should generate SVG string for barcode", () => {
      const svg = renderBarcodeToSVG("TEST123", 200, 100);
      expect(typeof svg).toBe("string");
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
    });

    it("should include width and height in SVG", () => {
      const svg = renderBarcodeToSVG("TEST", 300, 150);
      expect(svg).toContain('width="300"');
      expect(svg).toContain('height="150"');
    });

    it("should include viewBox attribute", () => {
      const svg = renderBarcodeToSVG("TEST", 200, 100);
      expect(svg).toContain("viewBox");
    });

    it("should include white background rectangle", () => {
      const svg = renderBarcodeToSVG("TEST", 200, 100);
      expect(svg).toContain('fill="white"');
    });

    it("should include black bars", () => {
      const svg = renderBarcodeToSVG("TEST", 200, 100);
      expect(svg).toContain('fill="black"');
    });

    it("should be valid SVG format", () => {
      const svg = renderBarcodeToSVG("TEST123", 200, 100);
      expect(svg).toMatch(/^<svg[^>]*>.*<\/svg>$/s);
    });

    it("should handle different dimensions", () => {
      const svgSmall = renderBarcodeToSVG("TEST", 100, 50);
      const svgLarge = renderBarcodeToSVG("TEST", 400, 200);

      expect(svgSmall).toContain('width="100"');
      expect(svgLarge).toContain('width="400"');
    });

    it("should handle long barcode values", () => {
      const svg = renderBarcodeToSVG("1Z999AA10123456784FEDEX", 300, 100);
      expect(svg).toContain("<svg");
    });

    it("should generate consistent SVG for same input", () => {
      const svg1 = renderBarcodeToSVG("TEST", 200, 100);
      const svg2 = renderBarcodeToSVG("TEST", 200, 100);
      expect(svg1).toBe(svg2);
    });

    it("should use valid SVG path syntax", () => {
      const svg = renderBarcodeToSVG("TEST", 200, 100);
      expect(svg).toContain("<path");
      expect(svg).toMatch(/d="[^"]*"/);
    });
  });

  describe("generateBarcodeBase64PNG", () => {
    it("should generate base64 encoded string", () => {
      const base64 = generateBarcodeBase64PNG("TEST123");
      expect(typeof base64).toBe("string");
      expect(base64.length).toBeGreaterThan(0);
      // Base64 should only contain valid characters
      expect(base64).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it("should use default dimensions if not provided", () => {
      const base64 = generateBarcodeBase64PNG("TEST");
      expect(base64.length).toBeGreaterThan(0);
    });

    it("should use custom dimensions when provided", () => {
      const base64 = generateBarcodeBase64PNG("TEST", 300, 150);
      expect(base64.length).toBeGreaterThan(0);
    });

    it("should generate consistent output for same input", () => {
      const png1 = generateBarcodeBase64PNG("TEST", 200, 100);
      const png2 = generateBarcodeBase64PNG("TEST", 200, 100);
      expect(png1).toBe(png2);
    });

    it("should encode SVG content to base64", () => {
      const base64 = generateBarcodeBase64PNG("TEST");
      const decoded = Buffer.from(base64, "base64").toString("utf-8");
      expect(decoded).toContain("<svg");
    });

    it("should handle large barcodes", () => {
      const base64 = generateBarcodeBase64PNG(
        "1Z999AA10123456784FEDEX",
        500,
        200
      );
      expect(base64.length).toBeGreaterThan(0);
    });

    it("should produce valid base64 that can be decoded", () => {
      const base64 = generateBarcodeBase64PNG("TEST123");
      expect(() => {
        Buffer.from(base64, "base64");
      }).not.toThrow();
    });
  });
});

// ============================================================================
// Label Data Tests
// ============================================================================

describe("Label Data Validation", () => {
  let defaultLabel: LabelData;
  let defaultOptions: LabelOptions;

  beforeEach(() => {
    defaultLabel = {
      trackingNumber: "1Z999AA10123456784",
      carrier: "FedEx",
      service: "Ground",
      sender: {
        name: "John Sender",
        company: "Sender Corp",
        street1: "123 Main St",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
      },
      recipient: {
        name: "Jane Recipient",
        street1: "456 Oak Ave",
        city: "Los Angeles",
        state: "CA",
        postalCode: "90001",
        country: "USA",
      },
      weight: 2.5,
      weightUnit: "kg",
      shipDate: new Date(),
      barcodeType: "code128",
      barcodeValue: "1Z999AA10123456784",
    };

    defaultOptions = {
      format: "HTML",
      size: "4x6",
    };
  });

  it("should have required fields", () => {
    expect(defaultLabel).toHaveProperty("trackingNumber");
    expect(defaultLabel).toHaveProperty("carrier");
    expect(defaultLabel).toHaveProperty("service");
    expect(defaultLabel).toHaveProperty("sender");
    expect(defaultLabel).toHaveProperty("recipient");
    expect(defaultLabel).toHaveProperty("weight");
    expect(defaultLabel).toHaveProperty("barcodeType");
  });

  it("should have optional fields", () => {
    const labelWithOptional: LabelData = {
      ...defaultLabel,
      dimensions: { length: 10, width: 8, height: 5, unit: "cm" },
      reference: "REF123",
      poNumber: "PO-456",
      orderNumber: "ORD-789",
      sortCode: "SC123",
      returnAddress: {
        name: "Return Address",
        street1: "789 Return St",
        city: "Chicago",
        state: "IL",
        postalCode: "60601",
        country: "USA",
      },
    };

    expect(labelWithOptional.dimensions).toBeDefined();
    expect(labelWithOptional.reference).toBeDefined();
    expect(labelWithOptional.returnAddress).toBeDefined();
  });

  it("should accept different weight units", () => {
    const units: Array<"kg" | "lb" | "g" | "oz"> = ["kg", "lb", "g", "oz"];

    for (const unit of units) {
      const label = { ...defaultLabel, weightUnit: unit };
      expect(label.weightUnit).toBe(unit);
    }
  });

  it("should accept different barcode types", () => {
    const types: Array<"code128" | "qr" | "datamatrix"> = [
      "code128",
      "qr",
      "datamatrix",
    ];

    for (const type of types) {
      const label = { ...defaultLabel, barcodeType: type };
      expect(label.barcodeType).toBe(type);
    }
  });

  it("should have valid sender address", () => {
    const sender = defaultLabel.sender;
    expect(sender.name).toBeTruthy();
    expect(sender.street1).toBeTruthy();
    expect(sender.city).toBeTruthy();
    expect(sender.state).toBeTruthy();
    expect(sender.postalCode).toBeTruthy();
    expect(sender.country).toBeTruthy();
  });

  it("should have valid recipient address", () => {
    const recipient = defaultLabel.recipient;
    expect(recipient.name).toBeTruthy();
    expect(recipient.street1).toBeTruthy();
    expect(recipient.city).toBeTruthy();
    expect(recipient.state).toBeTruthy();
    expect(recipient.postalCode).toBeTruthy();
    expect(recipient.country).toBeTruthy();
  });

  it("should support optional address fields", () => {
    const address: LabelAddress = {
      name: "Test",
      company: "Test Corp",
      street1: "123 Main",
      street2: "Apt 5",
      city: "NYC",
      state: "NY",
      postalCode: "10001",
      country: "USA",
      phone: "555-0123",
    };

    expect(address.company).toBeDefined();
    expect(address.street2).toBeDefined();
    expect(address.phone).toBeDefined();
  });

  it("should accept all label format options", () => {
    const formats: Array<"PDF" | "ZPL" | "PNG" | "HTML"> = [
      "PDF",
      "ZPL",
      "PNG",
      "HTML",
    ];

    for (const format of formats) {
      const options = { ...defaultOptions, format };
      expect(options.format).toBe(format);
    }
  });

  it("should accept all label size options", () => {
    const sizes: Array<"4x6" | "6x4" | "4x8" | "8.5x11"> = [
      "4x6",
      "6x4",
      "4x8",
      "8.5x11",
    ];

    for (const size of sizes) {
      const options = { ...defaultOptions, size };
      expect(options.size).toBe(size);
    }
  });

  it("should include metadata for additional info", () => {
    const labelWithMetadata: LabelData = {
      ...defaultLabel,
    };

    expect(labelWithMetadata).toHaveProperty("trackingNumber");
  });
});

// ============================================================================
// ZPL Generator Tests
// ============================================================================

describe("ZPL Label Generator", () => {
  let defaultLabel: LabelData;
  let defaultOptions: LabelOptions;

  beforeEach(() => {
    defaultLabel = {
      trackingNumber: "1Z999AA10123456784",
      carrier: "FedEx",
      service: "Ground",
      sender: {
        name: "John Sender",
        company: "Sender Corp",
        street1: "123 Main St",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
      },
      recipient: {
        name: "Jane Recipient",
        street1: "456 Oak Ave",
        city: "Los Angeles",
        state: "CA",
        postalCode: "90001",
        country: "USA",
      },
      weight: 2.5,
      weightUnit: "kg",
      shipDate: new Date(),
      barcodeType: "code128",
      barcodeValue: "1Z999AA10123456784",
    };

    defaultOptions = {
      format: "ZPL",
      size: "4x6",
      dpi: 203,
    };
  });

  it("should generate ZPL string", () => {
    const zpl = generateZPL(defaultLabel, defaultOptions);
    expect(typeof zpl).toBe("string");
    expect(zpl.length).toBeGreaterThan(0);
  });

  it("should start with ^XA and end with ^XZ", () => {
    const zpl = generateZPL(defaultLabel, defaultOptions);
    expect(zpl).toContain("^XA");
    expect(zpl).toContain("^XZ");
  });

  it("should include carrier name", () => {
    const zpl = generateZPL(defaultLabel, defaultOptions);
    expect(zpl).toContain("FEDEX");
  });

  it("should include sender address", () => {
    const zpl = generateZPL(defaultLabel, defaultOptions);
    expect(zpl).toContain("FROM:");
    expect(zpl).toContain("John Sender");
    expect(zpl).toContain("123 Main St");
  });

  it("should include recipient address", () => {
    const zpl = generateZPL(defaultLabel, defaultOptions);
    expect(zpl).toContain("TO:");
    expect(zpl).toContain("Jane Recipient");
    expect(zpl).toContain("456 Oak Ave");
  });

  it("should include tracking number", () => {
    const zpl = generateZPL(defaultLabel, defaultOptions);
    expect(zpl).toContain("1Z999AA10123456784");
  });

  it("should include weight information", () => {
    const zpl = generateZPL(defaultLabel, defaultOptions);
    expect(zpl).toContain("2.5");
    expect(zpl).toContain("kg");
  });

  it("should include ship date", () => {
    const zpl = generateZPL(defaultLabel, defaultOptions);
    expect(zpl).toContain("Shipped:");
  });

  it("should include barcode command", () => {
    const zpl = generateZPL(defaultLabel, defaultOptions);
    expect(zpl).toContain("^BC");
  });

  it("should handle optional fields (PO, Order, Sort Code)", () => {
    const labelWithOptional = {
      ...defaultLabel,
      poNumber: "PO-12345",
      orderNumber: "ORD-67890",
      sortCode: "SC-111",
    };

    const zpl = generateZPL(labelWithOptional, defaultOptions);
    expect(zpl).toContain("PO-12345");
    expect(zpl).toContain("ORD-67890");
    expect(zpl).toContain("SC-111");
  });

  it("should use different DPI for high resolution", () => {
    const highDpiOptions = { ...defaultOptions, dpi: 300 };
    const zpl = generateZPL(defaultLabel, highDpiOptions);
    expect(zpl).toContain("^PR300,300,300");
  });

  it("should escape special ZPL characters", () => {
    const labelWithSpecialChars = {
      ...defaultLabel,
      sender: {
        ...defaultLabel.sender,
        company: "Test^Company",
      },
    };

    const zpl = generateZPL(labelWithSpecialChars, defaultOptions);
    // Should escape the caret
    expect(zpl).toContain("^^");
  });

  it("should truncate long names", () => {
    const labelWithLongName = {
      ...defaultLabel,
      recipient: {
        ...defaultLabel.recipient,
        name: "This is a very long name that exceeds maximum label character limit",
      },
    };

    const zpl = generateZPL(labelWithLongName, defaultOptions);
    expect(zpl).toContain("...");
  });

  it("should handle street2 address", () => {
    const labelWithStreet2 = {
      ...defaultLabel,
      recipient: {
        ...defaultLabel.recipient,
        street2: "Suite 200",
      },
    };

    const zpl = generateZPL(labelWithStreet2, defaultOptions);
    expect(zpl).toContain("Suite 200");
  });

  it("should set label width based on size", () => {
    const zpl = generateZPL(defaultLabel, defaultOptions);
    expect(zpl).toContain("^PW");
  });

  it("should generate consistent output for same input", () => {
    const zpl1 = generateZPL(defaultLabel, defaultOptions);
    const zpl2 = generateZPL(defaultLabel, defaultOptions);
    expect(zpl1).toBe(zpl2);
  });
});

// ============================================================================
// HTML Label Generator Tests
// ============================================================================

describe("HTML Label Generator", () => {
  let defaultLabel: LabelData;
  let defaultOptions: LabelOptions;

  beforeEach(() => {
    defaultLabel = {
      trackingNumber: "1Z999AA10123456784",
      carrier: "FedEx",
      service: "Ground",
      sender: {
        name: "John Sender",
        company: "Sender Corp",
        street1: "123 Main St",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
      },
      recipient: {
        name: "Jane Recipient",
        street1: "456 Oak Ave",
        city: "Los Angeles",
        state: "CA",
        postalCode: "90001",
        country: "USA",
      },
      weight: 2.5,
      weightUnit: "kg",
      shipDate: new Date(),
      barcodeType: "code128",
      barcodeValue: "1Z999AA10123456784",
    };

    defaultOptions = {
      format: "HTML",
      size: "4x6",
    };
  });

  it("should generate valid HTML", () => {
    const html = generateHTML(defaultLabel, defaultOptions);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain("<style>");
    expect(html).toContain("</style>");
  });

  it("should include label data in HTML", () => {
    const html = generateHTML(defaultLabel, defaultOptions);
    expect(html).toContain("John Sender");
    expect(html).toContain("Jane Recipient");
    expect(html).toContain("1Z999AA10123456784");
  });

  it("should include barcode SVG", () => {
    const html = generateHTML(defaultLabel, defaultOptions);
    expect(html).toContain("<svg");
  });

  it("should include print styles", () => {
    const html = generateHTML(defaultLabel, defaultOptions);
    expect(html).toContain("@media print");
  });

  it("should include print button for non-print context", () => {
    const html = generateHTML(defaultLabel, defaultOptions);
    expect(html).toContain("Print Label");
  });

  it("should properly escape HTML special characters", () => {
    const labelWithSpecialChars = {
      ...defaultLabel,
      sender: {
        ...defaultLabel.sender,
        name: "John <Sender> & Co.",
      },
    };

    const html = generateHTML(labelWithSpecialChars, defaultOptions);
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
    expect(html).toContain("&amp;");
  });

  it("should handle optional address fields", () => {
    const labelWithOptional = {
      ...defaultLabel,
      recipient: {
        ...defaultLabel.recipient,
        street2: "Suite 200",
      },
    };

    const html = generateHTML(labelWithOptional, defaultOptions);
    expect(html).toContain("Suite 200");
  });

  it("should include weight and shipped date in footer", () => {
    const html = generateHTML(defaultLabel, defaultOptions);
    expect(html).toContain("Weight:");
    expect(html).toContain("Shipped:");
    expect(html).toContain("2.5");
    expect(html).toContain("kg");
  });

  it("should include optional fields when present", () => {
    const labelWithOptional = {
      ...defaultLabel,
      poNumber: "PO-123",
      orderNumber: "ORD-456",
      sortCode: "SC-789",
    };

    const html = generateHTML(labelWithOptional, defaultOptions);
    expect(html).toContain("PO-123");
    expect(html).toContain("ORD-456");
    expect(html).toContain("SC-789");
  });

  it("should use correct dimensions for label size", () => {
    const html = generateHTML(defaultLabel, { ...defaultOptions, size: "4x6" });
    expect(html).toContain("384px");
    expect(html).toContain("576px");
  });

  it("should generate consistent output for same input", () => {
    const html1 = generateHTML(defaultLabel, defaultOptions);
    const html2 = generateHTML(defaultLabel, defaultOptions);
    expect(html1).toBe(html2);
  });

  it("should be printable HTML", () => {
    const html = generateHTML(defaultLabel, defaultOptions);
    expect(html).toContain("print");
    expect(html).toContain("page-break");
  });
});

// ============================================================================
// PDF Label Generator Tests
// ============================================================================

describe("PDF Label Generator", () => {
  let defaultLabel: LabelData;
  let defaultOptions: LabelOptions;

  beforeEach(() => {
    defaultLabel = {
      trackingNumber: "1Z999AA10123456784",
      carrier: "FedEx",
      service: "Ground",
      sender: {
        name: "John Sender",
        company: "Sender Corp",
        street1: "123 Main St",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
      },
      recipient: {
        name: "Jane Recipient",
        street1: "456 Oak Ave",
        city: "Los Angeles",
        state: "CA",
        postalCode: "90001",
        country: "USA",
      },
      weight: 2.5,
      weightUnit: "kg",
      shipDate: new Date(),
      barcodeType: "code128",
      barcodeValue: "1Z999AA10123456784",
    };

    defaultOptions = {
      format: "PDF",
      size: "4x6",
    };
  });

  it("should generate PDF data", () => {
    const pdf = generatePDF(defaultLabel, defaultOptions);
    expect(typeof pdf).toBe("string");
    expect(pdf.length).toBeGreaterThan(0);
  });

  it("should include tracking number in PDF", () => {
    const pdf = generatePDF(defaultLabel, defaultOptions);
    expect(pdf).toContain("1Z999AA10123456784");
  });

  it("should include carrier information", () => {
    const pdf = generatePDF(defaultLabel, defaultOptions);
    expect(pdf.toUpperCase()).toContain("FEDEX");
  });

  it("should include sender address", () => {
    const pdf = generatePDF(defaultLabel, defaultOptions);
    expect(pdf).toContain("John Sender");
    expect(pdf).toContain("123 Main St");
  });

  it("should include recipient address", () => {
    const pdf = generatePDF(defaultLabel, defaultOptions);
    expect(pdf).toContain("Jane Recipient");
    expect(pdf).toContain("456 Oak Ave");
  });

  it("should handle different page sizes", () => {
    const sizes: Array<"4x6" | "6x4" | "4x8" | "8.5x11"> = [
      "4x6",
      "6x4",
      "4x8",
      "8.5x11",
    ];

    for (const size of sizes) {
      const pdf = generatePDF(defaultLabel, { ...defaultOptions, size });
      expect(pdf.length).toBeGreaterThan(0);
    }
  });

  it("should include barcode data", () => {
    const pdf = generatePDF(defaultLabel, defaultOptions);
    // PDF should contain barcode rendering data
    expect(pdf.length).toBeGreaterThan(100);
  });

  it("should handle optional fields", () => {
    const labelWithOptional = {
      ...defaultLabel,
      poNumber: "PO-123",
      orderNumber: "ORD-456",
    };

    const pdf = generatePDF(labelWithOptional, defaultOptions);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it("should handle different DPI settings", () => {
    const pdfLow = generatePDF(defaultLabel, { ...defaultOptions, dpi: 203 });
    const pdfHigh = generatePDF(defaultLabel, { ...defaultOptions, dpi: 300 });

    expect(pdfLow.length).toBeGreaterThan(0);
    expect(pdfHigh.length).toBeGreaterThan(0);
  });

  it("should generate consistent output for same input", () => {
    const pdf1 = generatePDF(defaultLabel, defaultOptions);
    const pdf2 = generatePDF(defaultLabel, defaultOptions);
    expect(pdf1).toBe(pdf2);
  });
});

// ============================================================================
// Label Factory Function Tests
// ============================================================================

describe("Label Generation Factory Functions", () => {
  let defaultLabel: LabelData;

  beforeEach(() => {
    defaultLabel = {
      trackingNumber: "1Z999AA10123456784",
      carrier: "FedEx",
      service: "Ground",
      sender: {
        name: "John Sender",
        street1: "123 Main St",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
      },
      recipient: {
        name: "Jane Recipient",
        street1: "456 Oak Ave",
        city: "Los Angeles",
        state: "CA",
        postalCode: "90001",
        country: "USA",
      },
      weight: 2.5,
      weightUnit: "kg",
      shipDate: new Date(),
      barcodeType: "code128",
      barcodeValue: "1Z999AA10123456784",
    };
  });

  describe("generateLabel", () => {
    it("should generate HTML label", () => {
      const result = generateLabel(defaultLabel, {
        format: "HTML",
        size: "4x6",
      });

      expect(result.format).toBe("HTML");
      expect(result.mimeType).toBe("text/html");
      expect(result.trackingNumber).toBe("1Z999AA10123456784");
      expect(typeof result.data).toBe("string");
    });

    it("should generate ZPL label", () => {
      const result = generateLabel(defaultLabel, {
        format: "ZPL",
        size: "4x6",
      });

      expect(result.format).toBe("ZPL");
      expect(result.mimeType).toBe("text/plain");
      expect(result.data).toContain("^XA");
    });

    it("should generate PDF label", () => {
      const result = generateLabel(defaultLabel, {
        format: "PDF",
        size: "4x6",
      });

      expect(result.format).toBe("PDF");
      expect(result.mimeType).toBe("application/pdf");
    });

    it("should fallback PNG to HTML format", () => {
      const result = generateLabel(defaultLabel, {
        format: "PNG",
        size: "4x6",
      });

      expect(result.format).toBe("PNG");
      expect(result.mimeType).toBe("text/html");
    });

    it("should include correct size in result", () => {
      const result = generateLabel(defaultLabel, {
        format: "HTML",
        size: "8.5x11",
      });

      expect(result.size).toBe("8.5x11");
    });

    it("should throw error for unsupported format", () => {
      expect(() => {
        generateLabel(defaultLabel, {
          format: "INVALID" as any,
          size: "4x6",
        });
      }).toThrow();
    });

    it("should return GeneratedLabel interface", () => {
      const result = generateLabel(defaultLabel, {
        format: "HTML",
        size: "4x6",
      });

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("format");
      expect(result).toHaveProperty("mimeType");
      expect(result).toHaveProperty("size");
      expect(result).toHaveProperty("trackingNumber");
    });
  });

  describe("generateLabels", () => {
    it("should generate multiple labels", () => {
      const labels = [defaultLabel, defaultLabel, defaultLabel];

      const results = generateLabels(labels, {
        format: "HTML",
        size: "4x6",
      });

      expect(results.length).toBe(3);
      expect(results.every((r) => r.format === "HTML")).toBe(true);
    });

    it("should handle single label", () => {
      const results = generateLabels([defaultLabel], {
        format: "ZPL",
        size: "4x6",
      });

      expect(results.length).toBe(1);
    });

    it("should handle empty array", () => {
      const results = generateLabels([], {
        format: "HTML",
        size: "4x6",
      });

      expect(results.length).toBe(0);
    });

    it("should preserve tracking numbers", () => {
      const labels = [
        { ...defaultLabel, trackingNumber: "TRACK001" },
        { ...defaultLabel, trackingNumber: "TRACK002" },
      ];

      const results = generateLabels(labels, {
        format: "HTML",
        size: "4x6",
      });

      expect(results[0].trackingNumber).toBe("TRACK001");
      expect(results[1].trackingNumber).toBe("TRACK002");
    });

    it("should generate different data for different labels", () => {
      const labels = [
        { ...defaultLabel, trackingNumber: "TRACK001" },
        { ...defaultLabel, trackingNumber: "TRACK002" },
      ];

      const results = generateLabels(labels, {
        format: "HTML",
        size: "4x6",
      });

      expect(results[0].data).not.toBe(results[1].data);
    });
  });

  describe("generateZPLBatch", () => {
    it("should generate ZPL batch for single label", () => {
      const zpl = generateZPLBatch([defaultLabel], {
        format: "ZPL",
        size: "4x6",
      });

      expect(typeof zpl).toBe("string");
      expect(zpl).toContain("^XA");
      expect(zpl).toContain("^XZ");
    });

    it("should generate multiple copies with copies option", () => {
      const zpl = generateZPLBatch([defaultLabel], {
        format: "ZPL",
        size: "4x6",
        copies: 3,
      });

      // Should have 3 copies of the label
      const xzCount = (zpl.match(/\^XZ/g) || []).length;
      expect(xzCount).toBe(3);
    });

    it("should generate batch for multiple labels", () => {
      const labels = [
        { ...defaultLabel, trackingNumber: "TRACK001" },
        { ...defaultLabel, trackingNumber: "TRACK002" },
      ];

      const zpl = generateZPLBatch(labels, {
        format: "ZPL",
        size: "4x6",
      });

      expect(zpl).toContain("TRACK001");
      expect(zpl).toContain("TRACK002");
    });

    it("should handle empty label array", () => {
      const zpl = generateZPLBatch([], {
        format: "ZPL",
        size: "4x6",
      });

      expect(typeof zpl).toBe("string");
    });

    it("should default copies to 1 if not specified", () => {
      const zpl = generateZPLBatch([defaultLabel], {
        format: "ZPL",
        size: "4x6",
      });

      const xzCount = (zpl.match(/\^XZ/g) || []).length;
      expect(xzCount).toBe(1);
    });

    it("should concatenate labels in batch", () => {
      const labels = [
        { ...defaultLabel, trackingNumber: "LABEL1" },
        { ...defaultLabel, trackingNumber: "LABEL2" },
      ];

      const zpl = generateZPLBatch(labels, {
        format: "ZPL",
        size: "4x6",
        copies: 2,
      });

      // Should have 4 XZ endings (2 labels × 2 copies)
      const xzCount = (zpl.match(/\^XZ/g) || []).length;
      expect(xzCount).toBe(4);
    });

    it("should generate valid ZPL format", () => {
      const zpl = generateZPLBatch([defaultLabel], {
        format: "ZPL",
        size: "4x6",
      });

      expect(zpl).toContain("^XA");
      expect(zpl).toContain("^XZ");
      expect(zpl).toContain("^FD");
      expect(zpl).toContain("^FS");
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Labels Module Integration", () => {
  let defaultLabel: LabelData;

  beforeEach(() => {
    defaultLabel = {
      trackingNumber: "1Z999AA10123456784",
      carrier: "FedEx",
      service: "Ground",
      sender: {
        name: "Sender Company",
        street1: "100 Main St",
        city: "Boston",
        state: "MA",
        postalCode: "02101",
        country: "USA",
      },
      recipient: {
        name: "Recipient Name",
        street1: "200 Oak Ave",
        city: "Denver",
        state: "CO",
        postalCode: "80202",
        country: "USA",
      },
      weight: 3.2,
      weightUnit: "kg",
      shipDate: new Date("2024-03-08"),
      barcodeType: "code128",
      barcodeValue: "1Z999AA10123456784",
      poNumber: "PO-98765",
      orderNumber: "ORD-54321",
    };
  });

  it("should generate all formats for same label", () => {
    const html = generateLabel(defaultLabel, {
      format: "HTML",
      size: "4x6",
    });
    const zpl = generateLabel(defaultLabel, {
      format: "ZPL",
      size: "4x6",
    });
    const pdf = generateLabel(defaultLabel, {
      format: "PDF",
      size: "4x6",
    });

    expect(html.trackingNumber).toBe(defaultLabel.trackingNumber);
    expect(zpl.trackingNumber).toBe(defaultLabel.trackingNumber);
    expect(pdf.trackingNumber).toBe(defaultLabel.trackingNumber);

    expect(html.mimeType).toBe("text/html");
    expect(zpl.mimeType).toBe("text/plain");
    expect(pdf.mimeType).toBe("application/pdf");
  });

  it("should handle complete shipping workflow", () => {
    // Generate label for shipment
    const label = generateLabel(defaultLabel, {
      format: "HTML",
      size: "4x6",
    });

    // Barcode should be embedded in label
    expect(label.data).toContain("<svg");

    // Should be printable
    expect(label.data).toContain("Print Label");

    // Should contain tracking info
    expect(label.data).toContain(defaultLabel.trackingNumber);
  });

  it("should generate batch labels for multiple shipments", () => {
    const shipments = [
      { ...defaultLabel, trackingNumber: "TRACK001" },
      { ...defaultLabel, trackingNumber: "TRACK002" },
      { ...defaultLabel, trackingNumber: "TRACK003" },
    ];

    const labels = generateLabels(shipments, {
      format: "ZPL",
      size: "4x6",
    });

    expect(labels.length).toBe(3);
    expect(labels.map((l) => l.trackingNumber)).toEqual([
      "TRACK001",
      "TRACK002",
      "TRACK003",
    ]);
  });

  it("should support different label sizes for different carriers", () => {
    const smallLabel = generateLabel(defaultLabel, {
      format: "HTML",
      size: "4x6",
    });

    const largeLabel = generateLabel(defaultLabel, {
      format: "HTML",
      size: "8.5x11",
    });

    expect(smallLabel.size).toBe("4x6");
    expect(largeLabel.size).toBe("8.5x11");
    expect(smallLabel.data).not.toBe(largeLabel.data);
  });
});
