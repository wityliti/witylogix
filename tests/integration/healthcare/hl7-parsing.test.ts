/**
 * @witylogix/api — Healthcare HL7 Parsing Integration Tests
 *
 * Comprehensive test suite for HL7v2 message handling
 * - Parse HL7v2 messages (ADT, ORM, ORU, SIU segments)
 * - Extract individual segments and fields
 * - Handle complex data types (XPN, XAD, CX)
 * - Transform HL7 to FHIR resources
 * - Generate ACK/NACK messages
 * - Handle malformed and edge-case messages
 *
 * Pattern: Mock HL7 message parsing and transformation
 * ~250 lines, 20+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ============================================================================
// MOCK TYPES & INTERFACES
// ============================================================================

interface Hl7Message {
  messageType: string;
  messageControlId: string;
  sendingApplication: string;
  receivingApplication: string;
  timestamp: string;
  segments: Hl7Segment[];
}

interface Hl7Segment {
  type: string;
  fields: string[][];
  line: string;
}

interface Hl7ParseResult {
  success: boolean;
  message: Hl7Message | null;
  errors: string[];
  warnings: string[];
}

interface AckMessage {
  messageType: "ACK" | "NAK";
  messageControlId: string;
  acknowledgeCode: "AA" | "AE" | "AR" | "CE" | "CR";
  textMessage?: string;
}

interface Hl7ToFhirMapping {
  hl7Segment: string;
  fhirResource: string;
  fieldMappings: Array<{
    hl7Field: string;
    fhirPath: string;
  }>;
}

// ============================================================================
// MOCK SERVICE IMPLEMENTATION
// ============================================================================

class MockHl7Service {
  private hl7Segments: Record<string, string> = {
    "MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|20240115120000||ADT^A01|MSG123|P|2.4":
      "MSH - Message Header",
    "PID|||MRN123^^^MRN||DOE^JOHN||19800101|M|||123 MAIN ST^^CITY^ST^12345||555-1234":
      "PID - Patient Identification",
    "OBX|1|NM|9279-1^Respiratory rate||16|breaths/min|12-20|N|||F":
      "OBX - Observation/Result",
    "ORU|^~\\&|LAB|LAB_FAC|RECEIVING|RECEIVING_FAC|20240115120000||ORU^R01|MSG124|P|2.4":
      "ORU - Observation Result",
  };

  parseMessage(messageText: string): Hl7ParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let message: Hl7Message | null = null;

    try {
      const lines = messageText.split("\n");
      const segments: Hl7Segment[] = [];

      // Parse MSH segment first
      const mshLine = lines[0];
      if (!mshLine.startsWith("MSH")) {
        errors.push("First segment must be MSH");
        return { success: false, message: null, errors, warnings };
      }

      const fieldSeparator = mshLine[3];
      const encodingChars = mshLine.substring(4, 8);

      // Parse all segments
      for (const line of lines) {
        if (!line.trim()) continue;

        const segmentType = line.substring(0, 3);
        const fields = line.split(fieldSeparator).slice(1);
        const subFields = fields.map((f) => f.split("~"));

        segments.push({
          type: segmentType,
          fields: subFields,
          line,
        });
      }

      // Extract message type from MSH
      const mshSegment = segments[0];
      const messageType = mshSegment.fields[8]?.[0] || "UNKNOWN";
      const messageControlId = mshSegment.fields[9]?.[0] || "UNKNOWN";
      const sendingApp = mshSegment.fields[2]?.[0] || "UNKNOWN";
      const receivingApp = mshSegment.fields[4]?.[0] || "UNKNOWN";
      const timestamp = mshSegment.fields[6]?.[0] || new Date().toISOString();

      message = {
        messageType,
        messageControlId,
        sendingApplication: sendingApp,
        receivingApplication: receivingApp,
        timestamp,
        segments,
      };

      if (segments.length === 0) {
        warnings.push("Message contains no segments");
      }
    } catch (error) {
      errors.push(
        `Parsing error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      success: errors.length === 0,
      message,
      errors,
      warnings,
    };
  }

  extractSegment(message: Hl7Message, segmentType: string): Hl7Segment | null {
    return message.segments.find((s) => s.type === segmentType) || null;
  }

  extractField(segment: Hl7Segment, fieldIndex: number): string {
    if (fieldIndex < 0 || fieldIndex >= segment.fields.length) {
      return "";
    }
    return segment.fields[fieldIndex].join("~");
  }

  extractSubField(
    segment: Hl7Segment,
    fieldIndex: number,
    subFieldIndex: number,
  ): string {
    if (
      fieldIndex < 0 ||
      fieldIndex >= segment.fields.length ||
      subFieldIndex < 0 ||
      subFieldIndex >= segment.fields[fieldIndex].length
    ) {
      return "";
    }
    return segment.fields[fieldIndex][subFieldIndex];
  }

  getPatientName(pidSegment: Hl7Segment): {
    familyName: string;
    givenName: string;
  } {
    const nameField = this.extractField(pidSegment, 4);
    const parts = nameField.split("^");
    return {
      familyName: parts[0] || "",
      givenName: parts[1] || "",
    };
  }

  getPatientDob(pidSegment: Hl7Segment): string {
    return this.extractField(pidSegment, 6);
  }

  getPatientGender(pidSegment: Hl7Segment): string {
    return this.extractField(pidSegment, 7);
  }

  generateAck(
    originalMessage: Hl7Message,
    acknowledgeCode: string,
    textMessage?: string,
  ): AckMessage {
    return {
      messageType: acknowledgeCode === "AA" ? "ACK" : "NAK",
      messageControlId: originalMessage.messageControlId,
      acknowledgeCode: acknowledgeCode as "AA" | "AE" | "AR" | "CE" | "CR",
      textMessage,
    };
  }

  transformToFhir(message: Hl7Message): Record<string, unknown> {
    const fhirResources: Record<string, unknown> = {
      resourceType: "Bundle",
      type: "batch",
      entry: [],
    };

    // Find PID segment and convert to Patient
    const pidSegment = this.extractSegment(message, "PID");
    if (pidSegment) {
      const name = this.getPatientName(pidSegment);
      const dob = this.getPatientDob(pidSegment);
      const gender = this.getPatientGender(pidSegment);

      const patient = {
        resourceType: "Patient",
        name: [
          {
            given: [name.givenName],
            family: name.familyName,
          },
        ],
        birthDate: dob,
        gender: gender.toLowerCase(),
      };

      (fhirResources.entry as unknown[]) = [{ resource: patient }];
    }

    return fhirResources;
  }

  validateMessage(
    messageText: string,
  ): Array<{ type: "error" | "warning"; message: string }> {
    const issues: Array<{ type: "error" | "warning"; message: string }> = [];

    // Check minimum structure
    if (!messageText.startsWith("MSH")) {
      issues.push({
        type: "error",
        message: "Message must start with MSH segment",
      });
    }

    // Check field separator
    if (messageText[3] !== "|") {
      issues.push({
        type: "error",
        message: "Invalid field separator at position 3",
      });
    }

    // Check segment count
    const segments = messageText.split("\n");
    if (segments.length < 2) {
      issues.push({
        type: "warning",
        message: "Message contains only one segment",
      });
    }

    return issues;
  }

  parseDataType(dataType: string, value: string): Record<string, string> {
    const result: Record<string, string> = {};

    if (dataType === "XPN") {
      // Extended Person Name
      const parts = value.split("^");
      result.familyName = parts[0] || "";
      result.givenName = parts[1] || "";
      result.middleName = parts[2] || "";
      result.suffix = parts[3] || "";
    } else if (dataType === "XAD") {
      // Extended Address
      const parts = value.split("^");
      result.streetAddress = parts[0] || "";
      result.city = parts[2] || "";
      result.state = parts[3] || "";
      result.zipCode = parts[4] || "";
    } else if (dataType === "CX") {
      // Extended Composite ID with check digit
      const parts = value.split("^");
      result.id = parts[0] || "";
      result.checkDigit = parts[1] || "";
      result.system = parts[3] || "";
    }

    return result;
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("HL7 Parsing", () => {
  let service: MockHl7Service;

  beforeEach(() => {
    service = new MockHl7Service();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Message Parsing
  // ──────────────────────────────────────────────────────────────────────────

  it("should parse valid HL7 message", () => {
    const hl7Message =
      "MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|20240115120000||ADT^A01|MSG123|P|2.4\nPID|||MRN123^^^MRN||DOE^JOHN||19800101|M";

    const result = service.parseMessage(hl7Message);

    expect(result.success).toBe(true);
    expect(result.message).toBeTruthy();
    expect(result.errors).toHaveLength(0);
  });

  it("should extract message type from MSH", () => {
    const hl7Message =
      "MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|20240115120000||ADT^A01|MSG123|P|2.4";

    const result = service.parseMessage(hl7Message);

    expect(result.message?.messageType).toBe("ADT^A01");
  });

  it("should extract message control ID", () => {
    const hl7Message =
      "MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|20240115120000||ADT^A01|MSG456|P|2.4";

    const result = service.parseMessage(hl7Message);

    expect(result.message?.messageControlId).toBe("MSG456");
  });

  it("should error on missing MSH segment", () => {
    const hl7Message = "PID|||MRN123^^^MRN||DOE^JOHN||19800101|M";

    const result = service.parseMessage(hl7Message);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("MSH"))).toBe(true);
  });

  it("should parse ADT message", () => {
    const hl7Message =
      "MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|20240115120000||ADT^A01|MSG123|P|2.4\nPID|||MRN123^^^MRN||DOE^JOHN||19800101|M";

    const result = service.parseMessage(hl7Message);

    expect(result.message?.messageType).toContain("ADT");
  });

  it("should parse ORM message", () => {
    const hl7Message =
      "MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|20240115120000||ORM^O01|MSG124|P|2.4\nORC|NW|ORDER123";

    const result = service.parseMessage(hl7Message);

    expect(result.message?.messageType).toContain("ORM");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Segment Extraction
  // ──────────────────────────────────────────────────────────────────────────

  it("should extract PID segment", () => {
    const hl7Message =
      "MSH|^~\\&|APP|FAC|APP|FAC|20240115120000||ADT^A01|MSG123|P|2.4\nPID|||MRN123^^^MRN||DOE^JOHN||19800101|M";

    const result = service.parseMessage(hl7Message);
    const pidSegment = service.extractSegment(result.message!, "PID");

    expect(pidSegment).toBeTruthy();
    expect(pidSegment?.type).toBe("PID");
  });

  it("should extract field from segment", () => {
    const hl7Message =
      "MSH|^~\\&|APP|FAC|APP|FAC|20240115120000||ADT^A01|MSG123|P|2.4\nPID|||MRN123^^^MRN||DOE^JOHN||19800101|M";

    const result = service.parseMessage(hl7Message);
    const pidSegment = service.extractSegment(result.message!, "PID");
    const mrnField = service.extractField(pidSegment!, 2);

    expect(mrnField).toBeTruthy();
  });

  it("should extract patient name", () => {
    const hl7Message =
      "MSH|^~\\&|APP|FAC|APP|FAC|20240115120000||ADT^A01|MSG123|P|2.4\nPID|||MRN123^^^MRN||DOE^JOHN||19800101|M";

    const result = service.parseMessage(hl7Message);
    const pidSegment = service.extractSegment(result.message!, "PID");
    const name = service.getPatientName(pidSegment!);

    expect(name.familyName).toBe("DOE");
    expect(name.givenName).toBe("JOHN");
  });

  it("should extract patient DOB", () => {
    const hl7Message =
      "MSH|^~\\&|APP|FAC|APP|FAC|20240115120000||ADT^A01|MSG123|P|2.4\nPID|||MRN123^^^MRN||DOE^JOHN||19800101|M";

    const result = service.parseMessage(hl7Message);
    const pidSegment = service.extractSegment(result.message!, "PID");
    const dob = service.getPatientDob(pidSegment!);

    expect(dob).toBe("19800101");
  });

  it("should extract patient gender", () => {
    const hl7Message =
      "MSH|^~\\&|APP|FAC|APP|FAC|20240115120000||ADT^A01|MSG123|P|2.4\nPID|||MRN123^^^MRN||DOE^JOHN||19800101|M";

    const result = service.parseMessage(hl7Message);
    const pidSegment = service.extractSegment(result.message!, "PID");
    const gender = service.getPatientGender(pidSegment!);

    expect(gender).toBe("M");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Data Type Parsing
  // ──────────────────────────────────────────────────────────────────────────

  it("should parse XPN (Extended Person Name) data type", () => {
    const parsed = service.parseDataType("XPN", "DOE^JOHN^MICHAEL^JR");

    expect(parsed.familyName).toBe("DOE");
    expect(parsed.givenName).toBe("JOHN");
    expect(parsed.middleName).toBe("MICHAEL");
    expect(parsed.suffix).toBe("JR");
  });

  it("should parse XAD (Extended Address) data type", () => {
    const parsed = service.parseDataType(
      "XAD",
      "123 MAIN ST^^SPRINGFIELD^IL^62701",
    );

    expect(parsed.streetAddress).toBe("123 MAIN ST");
    expect(parsed.city).toBe("SPRINGFIELD");
    expect(parsed.state).toBe("IL");
    expect(parsed.zipCode).toBe("62701");
  });

  it("should parse CX (Extended Composite ID) data type", () => {
    const parsed = service.parseDataType("CX", "MRN123^0^MRN^HOSPITAL");

    expect(parsed.id).toBe("MRN123");
    expect(parsed.checkDigit).toBe("0");
    expect(parsed.system).toBe("HOSPITAL");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ACK Generation
  // ──────────────────────────────────────────────────────────────────────────

  it("should generate positive acknowledgment (AA)", () => {
    const hl7Message =
      "MSH|^~\\&|APP|FAC|APP|FAC|20240115120000||ADT^A01|MSG123|P|2.4";
    const result = service.parseMessage(hl7Message);

    const ack = service.generateAck(result.message!, "AA");

    expect(ack.messageType).toBe("ACK");
    expect(ack.acknowledgeCode).toBe("AA");
    expect(ack.messageControlId).toBe("MSG123");
  });

  it("should generate negative acknowledgment (AE)", () => {
    const hl7Message =
      "MSH|^~\\&|APP|FAC|APP|FAC|20240115120000||ADT^A01|MSG123|P|2.4";
    const result = service.parseMessage(hl7Message);

    const ack = service.generateAck(result.message!, "AE", "Application Error");

    expect(ack.messageType).toBe("NAK");
    expect(ack.acknowledgeCode).toBe("AE");
    expect(ack.textMessage).toBe("Application Error");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // HL7 to FHIR Transformation
  // ──────────────────────────────────────────────────────────────────────────

  it("should transform HL7 message to FHIR", () => {
    const hl7Message =
      "MSH|^~\\&|APP|FAC|APP|FAC|20240115120000||ADT^A01|MSG123|P|2.4\nPID|||MRN123^^^MRN||DOE^JOHN||19800101|M";
    const result = service.parseMessage(hl7Message);

    const fhirBundle = service.transformToFhir(result.message!);

    expect(fhirBundle.resourceType).toBe("Bundle");
    expect(fhirBundle.type).toBe("batch");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Validation
  // ──────────────────────────────────────────────────────────────────────────

  it("should validate message structure", () => {
    const hl7Message =
      "MSH|^~\\&|APP|FAC|APP|FAC|20240115120000||ADT^A01|MSG123|P|2.4\nPID|||MRN123";

    const issues = service.validateMessage(hl7Message);

    expect(issues.filter((i) => i.type === "error")).toHaveLength(0);
  });

  it("should detect invalid field separator", () => {
    const hl7Message =
      "MSHx^~\\&|APP|FAC|APP|FAC|20240115120000||ADT^A01|MSG123|P|2.4";

    const issues = service.validateMessage(hl7Message);

    expect(issues.some((i) => i.type === "error")).toBe(true);
  });

  it("should warn on single segment", () => {
    const hl7Message =
      "MSH|^~\\&|APP|FAC|APP|FAC|20240115120000||ADT^A01|MSG123|P|2.4";

    const issues = service.validateMessage(hl7Message);

    expect(issues.some((i) => i.type === "warning")).toBe(true);
  });
});
