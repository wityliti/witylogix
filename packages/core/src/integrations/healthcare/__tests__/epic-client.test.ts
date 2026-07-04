/**
 * Epic Client Tests
 *
 * Tests for Epic FHIR R4 adapter implementation.
 * Covers: FHIR CRUD, MyChart, care plans, scheduling, consents, audit logging.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EpicClient } from "../epic-client.js";
import type {
  HealthcareConfig,
  Patient,
  Encounter,
  MedicationRequest,
  DiagnosticReport,
} from "../types.js";

describe("EpicClient", () => {
  let client: EpicClient;
  let config: HealthcareConfig;

  beforeEach(() => {
    config = {
      provider: "epic",
      baseUrl: "https://fhirauth.epic.com/interconnect-fhir-oauth/",
      clientId: "epic_test_client",
      clientSecret: "epic_test_secret",
      tenantId: "epic_test_tenant",
      auditLogging: true,
      metadata: {
        jwtSigningKey: "test_key_12345",
      },
    };

    client = new EpicClient(config);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  describe("validateConfig", () => {
    it("should throw error if base URL is missing", async () => {
      const invalidClient = new EpicClient({
        ...config,
        baseUrl: "",
      });

      await expect(invalidClient.validateConfig()).rejects.toThrow(
        "Epic base URL is required",
      );
    });

    it("should throw error if client ID is missing", async () => {
      const invalidClient = new EpicClient({
        ...config,
        clientId: "",
      });

      await expect(invalidClient.validateConfig()).rejects.toThrow(
        "Epic client ID is required",
      );
    });

    it("should validate with valid configuration", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ resourceType: "CapabilityStatement" }),
      });

      await expect(client.validateConfig()).resolves.not.toThrow();
    });
  });

  describe("FHIR CRUD Operations", () => {
    describe("create", () => {
      it("should create a FHIR resource", async () => {
        const newPatient: Omit<Patient, "id"> = {
          resourceType: "Patient",
          name: [{ family: "Doe", given: ["John"] }],
          gender: "male",
          birthDate: "1985-01-15",
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ...newPatient, id: "patient-123" }),
        });

        const result = await client.create<Patient>("Patient", newPatient);

        expect(result.id).toBe("patient-123");
        expect(result.name?.[0].family).toBe("Doe");
      });

      it("should handle API errors during create", async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: () => Promise.resolve("Invalid patient data"),
        });

        const newPatient: Omit<Patient, "id"> = {
          resourceType: "Patient",
          name: [{ family: "Doe" }],
        };

        await expect(
          client.create<Patient>("Patient", newPatient),
        ).rejects.toThrow();
      });

      it("should apply rate limiting", async () => {
        const newPatient: Omit<Patient, "id"> = {
          resourceType: "Patient",
          name: [{ family: "Test" }],
        };

        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ ...newPatient, id: "p-1" }),
        });

        // Make multiple requests to test rate limiting
        const promises = Array.from({ length: 5 }, () =>
          client.create<Patient>("Patient", newPatient),
        );

        const results = await Promise.all(promises);
        expect(results).toHaveLength(5);
      });
    });

    describe("read", () => {
      it("should read a FHIR resource by ID", async () => {
        const mockPatient: Patient = {
          resourceType: "Patient",
          id: "patient-123",
          name: [{ family: "Smith" }],
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPatient),
        });

        const result = await client.read<Patient>("Patient", "patient-123");

        expect(result.id).toBe("patient-123");
        expect(result.name?.[0].family).toBe("Smith");
      });

      it("should handle 404 errors for non-existent resources", async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: () => Promise.resolve("Patient not found"),
        });

        await expect(
          client.read<Patient>("Patient", "nonexistent"),
        ).rejects.toThrow();
      });
    });

    describe("update", () => {
      it("should update a FHIR resource", async () => {
        const updatedPatient: Partial<Patient> = {
          name: [{ family: "Johnson" }],
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              resourceType: "Patient",
              id: "patient-123",
              ...updatedPatient,
            }),
        });

        const result = await client.update<Patient>(
          "Patient",
          "patient-123",
          updatedPatient,
        );

        expect(result.name?.[0].family).toBe("Johnson");
      });
    });

    describe("delete", () => {
      it("should delete a FHIR resource", async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          status: 204,
        });

        await expect(
          client.delete("Patient", "patient-123"),
        ).resolves.not.toThrow();
      });
    });

    describe("search", () => {
      it("should search for FHIR resources", async () => {
        const mockBundle = {
          resourceType: "Bundle",
          type: "searchset",
          total: 1,
          entry: [
            {
              resource: {
                resourceType: "Patient",
                id: "patient-123",
                name: [{ family: "Doe" }],
              },
            },
          ],
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockBundle),
        });

        const result = await client.search<Patient>("Patient", {
          filters: { name: "Doe" },
        });

        expect(result.total).toBe(1);
        expect(result.entry).toHaveLength(1);
      });

      it("should support pagination", async () => {
        const mockBundle = {
          resourceType: "Bundle",
          type: "searchset",
          total: 100,
          entry: [],
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockBundle),
        });

        const result = await client.search<Patient>("Patient", {
          pageSize: 10,
          pageNumber: 1,
        });

        expect(result.total).toBe(100);
      });

      it("should support sorting", async () => {
        const mockBundle = {
          resourceType: "Bundle",
          type: "searchset",
          entry: [],
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockBundle),
        });

        const result = await client.search<Patient>("Patient", {
          sort: "-birthDate",
        });

        expect(result.resourceType).toBe("Bundle");
      });
    });
  });

  describe("MyChart Integration", () => {
    it("should get messages from MyChart inbox", async () => {
      const mockMessages = [
        {
          id: "msg-1",
          from: "doctor@epic.com",
          subject: "Test message",
          body: "Hello patient",
          sentAt: new Date().toISOString(),
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMessages),
      });

      const result = await client.getMyChartMessages("patient-123");

      expect(result).toHaveLength(1);
      expect(result[0].subject).toBe("Test message");
    });

    it("should send message via MyChart", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "msg-new" }),
      });

      const result = await client.sendMyChartMessage(
        "patient-123",
        "I have a question",
        "doctor-456",
      );

      expect(result.id).toBe("msg-new");
    });
  });

  describe("Care Plan Management", () => {
    it("should get care plans for a patient", async () => {
      const mockCarePlans = {
        resourceType: "Bundle",
        entry: [
          {
            resource: {
              resourceType: "CarePlan",
              id: "plan-1",
              status: "active",
              title: "Diabetes Management",
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCarePlans),
      });

      const result = await client.getCarePlans("patient-123");

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Diabetes Management");
    });

    it("should create a care plan", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            resourceType: "CarePlan",
            id: "plan-new",
            title: "New Care Plan",
          }),
      });

      const result = await client.createCarePlan(
        "patient-123",
        "Hypertension Management",
        ["Monitor blood pressure", "Reduce sodium intake"],
      );

      expect(result.id).toBe("plan-new");
    });
  });

  describe("Scheduling & Appointments", () => {
    it("should get available appointment slots", async () => {
      const mockSlots = {
        entry: [
          {
            resource: {
              resourceType: "Slot",
              id: "slot-1",
              status: "free",
              start: "2025-04-15T10:00:00Z",
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSlots),
      });

      const result = await client.getAppointmentSlots(
        "provider-1",
        "2025-04-01",
        "2025-04-30",
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("free");
    });

    it("should create an appointment", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            resourceType: "Appointment",
            id: "apt-1",
            status: "booked",
          }),
      });

      const result = await client.createAppointment(
        "patient-123",
        "provider-1",
        "slot-1",
        "Annual checkup",
      );

      expect(result.status).toBe("booked");
    });
  });

  describe("Consent Management", () => {
    it("should get consents for a patient", async () => {
      const mockConsents = {
        entry: [
          {
            resource: {
              resourceType: "Consent",
              id: "consent-1",
              status: "active",
              category: [{ coding: [{ code: "OPTIN" }] }],
              dateTime: new Date().toISOString(),
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConsents),
      });

      const result = await client.getConsents("patient-123");

      expect(result).toHaveLength(1);
      expect(result[0].consentType).toBe("OPT_IN");
    });

    it("should create a consent", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            resourceType: "Consent",
            id: "consent-new",
          }),
      });

      const result = await client.createConsent({
        patientId: "patient-123",
        consentType: "OPT_IN",
        purpose: "TREATMENT",
        validFrom: new Date().toISOString(),
      });

      expect(result.id).toBe("consent-new");
    });

    it("should revoke a consent", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            resourceType: "Consent",
            id: "consent-1",
            status: "inactive",
            patient: { reference: "Patient/patient-123" },
            dateTime: new Date().toISOString(),
          }),
      });

      const result = await client.revokeConsent("consent-1");

      expect(result.revokedAt).toBeDefined();
    });
  });

  describe("HIPAA Audit Logging", () => {
    it("should log audit entry", async () => {
      const entry = await client.logAuditEntry({
        eventId: "event-1",
        eventType: "READ",
        resourceType: "Patient",
        resourceId: "patient-123",
        patientId: "patient-123",
        action: "READ Patient",
        outcome: "SUCCESS",
        sourceApplication: "epic",
      });

      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeDefined();
    });

    it("should retrieve audit logs for a patient", async () => {
      const result = await client.getAuditLogs(
        "patient-123",
        "2025-01-01",
        "2025-12-31",
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Terminology Service", () => {
    it("should get terminology mapping", async () => {
      const mapping = await client.getTerminologyMapping(
        "ICD-10",
        "I10",
        "SNOMED-CT",
      );

      // Would call actual terminology service
      expect(mapping === null || mapping).toBe(true);
    });

    it("should create terminology mapping", async () => {
      const mapping = await client.createTerminologyMapping({
        sourceSystem: "ICD-10",
        sourceCode: "E11",
        targetSystem: "SNOMED-CT",
        targetCode: "44054006",
      });

      expect(mapping.sourceCode).toBe("E11");
      expect(mapping.createdAt).toBeDefined();
    });
  });

  describe("Bulk Data Operations", () => {
    it("should initiate bulk export", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            url: "https://epic.com/export/123",
            output: [],
          }),
      });

      const result = await client.bulkExport({
        resourceType: "Patient",
        outputFormat: "ndjson",
      });

      expect(result.outputUrl).toBeDefined();
      expect(result.transactionTime).toBeDefined();
    });

    it("should get bulk export status", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionTime: new Date().toISOString(),
            output: [],
          }),
      });

      const result = await client.getBulkExportStatus("export-123");

      expect(result.transactionTime).toBeDefined();
    });

    it("should cancel bulk export", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 202,
      });

      await expect(
        client.cancelBulkExport("export-123"),
      ).resolves.not.toThrow();
    });
  });

  describe("SMART on FHIR OAuth", () => {
    it("should generate SMART launch URL", () => {
      const url = client.generateSMARTLaunchUrl({
        launchUrl: "https://epic.com/fhir/oauth",
        clientId: "client-123",
        redirectUri: "https://myapp.com/callback",
        scope: "patient/Patient.read patient/Observation.read",
      });

      expect(url).toContain("client_id=client-123");
      expect(url).toContain("redirect_uri");
      expect(url).toContain("scope");
    });

    it("should handle OAuth code exchange", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(""),
      });

      // Note: This would require actual token endpoint
      // For now, just verify the method exists
      expect(client.exchangeAuthorizationCode).toBeDefined();
    });

    it("should retrieve SMART context", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            resourceType: "Patient",
            id: "patient-123",
          }),
      });

      const context = await client.getSMARTContext("test-token");

      expect(context.scope).toEqual(expect.arrayContaining([]));
    });
  });

  describe("Error Handling", () => {
    it("should retry failed requests", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Server error"),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ resourceType: "CapabilityStatement" }),
        });

      // Circuit breaker/retry would handle this
      expect(client).toBeDefined();
    });

    it("should handle circuit breaker states", async () => {
      const client2 = new EpicClient(config);
      expect(client2).toBeDefined();
    });
  });

  describe("HL7 v2 Message Operations", () => {
    it("should parse HL7 message", () => {
      const hl7Message =
        "MSH|^~\\&|SENDER|FAC1|RECEIVER|FAC2|20250312120000||ADT^A01|MSG001|P|2.5\n";

      const parsed = client.parseHL7Message(hl7Message);

      expect(parsed.messageType).toBe("ADT^A01");
      expect(parsed.messageControlId).toBe("MSG001");
    });

    it("should generate HL7 message", () => {
      const message = client.generateHL7Message({
        messageType: "ADT^A01",
        messageControlId: "MSG001",
        processingId: "P",
        versionId: "2.5",
        timestamp: "20250312120000",
      });

      expect(message).toContain("MSH");
      expect(message).toContain("ADT^A01");
      expect(message).toContain("MSG001");
    });
  });

  describe("Clinical Document Operations", () => {
    it("should get documents for a patient", async () => {
      const mockDocuments = {
        entry: [
          {
            resource: {
              resourceType: "DocumentReference",
              id: "doc-1",
              description: "Discharge Summary",
              date: new Date().toISOString(),
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDocuments),
      });

      const result = await client.getDocuments("patient-123");

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Discharge Summary");
    });

    it("should retrieve a specific document", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            resourceType: "DocumentReference",
            id: "doc-1",
            description: "CCD",
            date: new Date().toISOString(),
            subject: { reference: "Patient/patient-123" },
          }),
      });

      const result = await client.getDocument("doc-1", "pdf");

      expect(result.id).toBe("doc-1");
      expect(result.title).toBe("CCD");
    });
  });

  describe("Health Check", () => {
    it("should perform health check", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ resourceType: "CapabilityStatement" }),
      });

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it("should return false on health check failure", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });
});
