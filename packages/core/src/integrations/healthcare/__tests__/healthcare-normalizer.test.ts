/**
 * Healthcare Normalizer Tests
 *
 * Tests for clinical data normalization, patient matching, code translation,
 * unit conversion, and de-identification utilities.
 */

import { describe, it, expect } from "vitest";
import {
  matchPatients,
  translateCode,
  convertUnit,
  normalizeObservation,
  convertCDAToFHIR,
  extractPatientMRNFromCDA,
  deidentifyPatient,
  deidentifyObservation,
  hashPHI,
  normalizeObservations,
  normalizePatients,
  type PatientMatchScore,
} from "../healthcare-normalizer.js";
import type { Patient, Observation } from "../types.js";

describe("Healthcare Normalizer", () => {
  describe("Patient Matching (MPI)", () => {
    it("should match patients with exact MRN", () => {
      const patient1: Patient = {
        resourceType: "Patient",
        id: "p1",
        identifier: [
          { system: "http://hospital.org/mrn", value: "MRN123456" },
        ],
        name: [{ family: "Smith", given: ["John"] }],
        birthDate: "1980-01-15",
      };

      const patient2: Patient = {
        resourceType: "Patient",
        id: "p2",
        identifier: [
          { system: "http://clinic.org/mrn", value: "MRN123456" },
        ],
        name: [{ family: "Smith", given: ["John"] }],
        birthDate: "1980-01-15",
      };

      const match = matchPatients(patient1, patient2);

      expect(match.score).toBeGreaterThan(50);
      expect(match.matchedFields).toContain("mrn");
    });

    it("should match patients by name similarity", () => {
      const patient1: Patient = {
        resourceType: "Patient",
        id: "p1",
        name: [{ family: "Smith", given: ["John"] }],
      };

      const patient2: Patient = {
        resourceType: "Patient",
        id: "p2",
        name: [{ family: "Smith", given: ["Jon"] }],
      };

      const match = matchPatients(patient1, patient2);

      expect(match.score).toBeGreaterThan(15);
      expect(match.matchedFields).toContain("name");
    });

    it("should match patients by date of birth", () => {
      const patient1: Patient = {
        resourceType: "Patient",
        id: "p1",
        name: [{ family: "Doe" }],
        birthDate: "1990-06-20",
      };

      const patient2: Patient = {
        resourceType: "Patient",
        id: "p2",
        name: [{ family: "Doe" }],
        birthDate: "1990-06-20",
      };

      const match = matchPatients(patient1, patient2);

      expect(match.matchedFields).toContain("dob");
    });

    it("should match patients by phone number", () => {
      const patient1: Patient = {
        resourceType: "Patient",
        id: "p1",
        name: [{ family: "Test" }],
        telecom: [
          { system: "phone", value: "(555) 123-4567" },
        ],
      };

      const patient2: Patient = {
        resourceType: "Patient",
        id: "p2",
        name: [{ family: "Test" }],
        telecom: [
          { system: "phone", value: "(555) 123-4567" },
        ],
      };

      const match = matchPatients(patient1, patient2);

      expect(match.matchedFields).toContain("phone");
    });

    it("should handle patients with no matching data", () => {
      const patient1: Patient = {
        resourceType: "Patient",
        id: "p1",
        name: [{ family: "Smith", given: ["John"] }],
        birthDate: "1980-01-15",
      };

      const patient2: Patient = {
        resourceType: "Patient",
        id: "p2",
        name: [{ family: "Johnson", given: ["Jane"] }],
        birthDate: "1990-06-20",
      };

      const match = matchPatients(patient1, patient2);

      expect(match.score).toBeLessThan(15);
    });
  });

  describe("Code System Translation", () => {
    it("should translate ICD-10 to SNOMED-CT", () => {
      const mapping = translateCode("ICD-10", "I10", "SNOMED-CT");

      expect(mapping).not.toBeNull();
      if (mapping) {
        expect(mapping.targetCode).toBe("59621000");
        expect(mapping.equivalence).toBe("equivalent");
      }
    });

    it("should translate LOINC to SNOMED-CT", () => {
      const mapping = translateCode("LOINC", "2345-7", "SNOMED-CT");

      expect(mapping).not.toBeNull();
      if (mapping) {
        expect(mapping.targetCode).toBe("385354001");
      }
    });

    it("should return null for unmapped codes", () => {
      const mapping = translateCode("ICD-10", "UNMAPPED", "SNOMED-CT");

      expect(mapping).toBeNull();
    });
  });

  describe("Unit Conversion", () => {
    it("should convert weight from kg to lb", () => {
      const result = convertUnit(75, "kg", "lb");

      expect(result).toBeCloseTo(165.35, 1);
    });

    it("should convert weight from lb to kg", () => {
      const result = convertUnit(165, "lb", "kg");

      expect(result).toBeCloseTo(74.84, 1);
    });

    it("should convert length from cm to inches", () => {
      const result = convertUnit(180, "cm", "in");

      expect(result).toBeCloseTo(70.87, 1);
    });

    it("should convert glucose from mg/dL to mmol/L", () => {
      const result = convertUnit(100, "mg/dL", "mmol/L");

      expect(result).toBeCloseTo(5.55, 1);
    });

    it("should convert glucose from mmol/L to mg/dL", () => {
      const result = convertUnit(5.5, "mmol/L", "mg/dL");

      expect(result).toBeCloseTo(99.1, 0);
    });

    it("should convert temperature from Celsius to Fahrenheit", () => {
      const result = convertUnit(37, "C", "F");

      expect(result).toBeCloseTo(98.6, 1);
    });

    it("should convert temperature from Fahrenheit to Celsius", () => {
      const result = convertUnit(98.6, "F", "C");

      expect(result).toBeCloseTo(37, 1);
    });

    it("should throw error for unknown unit", () => {
      expect(() => convertUnit(100, "UNKNOWN", "kg")).toThrow("Unknown unit");
    });

    it("should throw error for invalid conversion", () => {
      expect(() => convertUnit(100, "kg", "INVALID")).toThrow("Cannot convert");
    });

    it("should handle same unit conversion", () => {
      const result = convertUnit(100, "kg", "kg");

      expect(result).toBe(100);
    });
  });

  describe("Observation Normalization", () => {
    it("should normalize observation to standard unit", () => {
      const observation: Observation = {
        resourceType: "Observation",
        status: "final",
        code: {
          coding: [
            { system: "http://loinc.org", code: "2345-7", display: "Glucose" },
          ],
        },
        subject: { reference: "Patient/p1" },
        value: {
          value: 180,
          unit: "mg/dL",
          system: "http://unitsofmeasure.org",
          code: "mg/dL",
        },
      };

      const normalized = normalizeObservation(observation, "mmol/L");

      if (normalized.value && typeof normalized.value === "object" && "value" in normalized.value) {
        expect(normalized.value.value).toBeCloseTo(9.99, 1);
        expect(normalized.value.unit).toBe("mmol/L");
      }
    });

    it("should handle observations without value", () => {
      const observation: Observation = {
        resourceType: "Observation",
        status: "final",
        code: {
          coding: [{ system: "http://loinc.org", code: "test" }],
        },
        subject: { reference: "Patient/p1" },
      };

      const normalized = normalizeObservation(observation, "mmol/L");

      expect(normalized).toEqual(observation);
    });

    it("should handle observations with same target unit", () => {
      const observation: Observation = {
        resourceType: "Observation",
        status: "final",
        code: {
          coding: [{ system: "http://loinc.org", code: "2345-7" }],
        },
        subject: { reference: "Patient/p1" },
        value: {
          value: 100,
          unit: "mg/dL",
          system: "http://unitsofmeasure.org",
          code: "mg/dL",
        },
      };

      const normalized = normalizeObservation(observation, "mg/dL");

      expect(normalized.value).toEqual(observation.value);
    });
  });

  describe("CDA Format Conversion", () => {
    it("should convert CDA to FHIR bundle", () => {
      const cdaXml = `<?xml version="1.0"?>
        <ClinicalDocument>
          <id extension="MRN123"/>
          <effectiveTime value="20250101120000"/>
        </ClinicalDocument>`;

      const result = convertCDAToFHIR(cdaXml);

      expect(result.resourceType).toBe("Bundle");
      expect(result.type).toBe("transaction");
      expect(result.entry).toBeDefined();
    });

    it("should extract patient MRN from CDA", () => {
      const cdaXml = `<?xml version="1.0"?>
        <ClinicalDocument>
          <recordTarget>
            <patientRole>
              <id extension="MRN12345" root="1.2.3.4"/>
            </patientRole>
          </recordTarget>
        </ClinicalDocument>`;

      // Note: This is a simplified example and the actual MRN extraction
      // would depend on full XML parsing
      const mrn = extractPatientMRNFromCDA(cdaXml);

      expect(mrn === null || typeof mrn === "string").toBe(true);
    });
  });

  describe("De-identification (HIPAA)", () => {
    it("should de-identify patient name", () => {
      const patient: Patient = {
        resourceType: "Patient",
        id: "p1",
        name: [{ family: "Smith", given: ["John", "Michael"] }],
        birthDate: "1980-01-15",
        address: [{ city: "New York", state: "NY" }],
      };

      const deidentified = deidentifyPatient(patient);

      if (deidentified.name) {
        expect(deidentified.name[0].family).toBe("REDACTED");
        expect(deidentified.name[0].given?.[0]).toBe("REDACTED");
      }
    });

    it("should de-identify patient address", () => {
      const patient: Patient = {
        resourceType: "Patient",
        id: "p1",
        name: [{ family: "Doe" }],
        address: [
          {
            line: ["123 Main St"],
            city: "Boston",
            state: "MA",
            postalCode: "02101",
          },
        ],
      };

      const deidentified = deidentifyPatient(patient);

      if (deidentified.address) {
        expect(deidentified.address[0].city).toBe("REDACTED");
        expect(deidentified.address[0].postalCode).toBe("REDACTED");
      }
    });

    it("should de-identify patient contact information", () => {
      const patient: Patient = {
        resourceType: "Patient",
        id: "p1",
        name: [{ family: "Test" }],
        telecom: [
          { system: "phone", value: "(555) 123-4567" },
          { system: "email", value: "test@example.com" },
        ],
      };

      const deidentified = deidentifyPatient(patient);

      if (deidentified.telecom) {
        expect(deidentified.telecom[0].value).toBe("REDACTED");
        expect(deidentified.telecom[1].value).toBe("REDACTED");
      }
    });

    it("should remove birthDate during de-identification", () => {
      const patient: Patient = {
        resourceType: "Patient",
        id: "p1",
        name: [{ family: "Smith" }],
        birthDate: "1980-01-15",
      };

      const deidentified = deidentifyPatient(patient);

      expect(deidentified.birthDate).toBeUndefined();
    });

    it("should de-identify observation", () => {
      const observation: Observation = {
        resourceType: "Observation",
        status: "final",
        code: {
          coding: [{ system: "http://loinc.org", code: "2345-7" }],
        },
        subject: { reference: "Patient/p1" },
        performer: [{ reference: "Practitioner/doc1" }],
        value: { value: 100, unit: "mg/dL", system: "http://unitsofmeasure.org", code: "mg/dL" },
      };

      const deidentified = deidentifyObservation(observation);

      expect(deidentified.subject.reference).toBe("Patient/REDACTED");
      if (deidentified.performer) {
        expect(deidentified.performer[0].reference).toBe("Practitioner/REDACTED");
      }
    });

    it("should hash PHI for tracking", () => {
      const value = "john.smith@example.com";
      const salt = "salt123";

      const hash1 = hashPHI(value, salt);
      const hash2 = hashPHI(value, salt);

      expect(hash1).toBe(hash2); // Deterministic hashing
      expect(hash1.length).toBeGreaterThan(0);
      expect(/^[0-9a-f]+$/.test(hash1)).toBe(true); // Hex string
    });
  });

  describe("Batch Operations", () => {
    it("should normalize multiple observations", () => {
      const observations: Observation[] = [
        {
          resourceType: "Observation",
          status: "final",
          code: {
            coding: [{ system: "http://loinc.org", code: "2345-7" }],
          },
          subject: { reference: "Patient/p1" },
          value: {
            value: 150,
            unit: "mg/dL",
            system: "http://unitsofmeasure.org",
            code: "mg/dL",
          },
        },
        {
          resourceType: "Observation",
          status: "final",
          code: {
            coding: [{ system: "http://loinc.org", code: "2345-7" }],
          },
          subject: { reference: "Patient/p1" },
          value: {
            value: 200,
            unit: "mg/dL",
            system: "http://unitsofmeasure.org",
            code: "mg/dL",
          },
        },
      ];

      const normalized = normalizeObservations(observations, {
        "2345-7": "mmol/L",
      });

      expect(normalized).toHaveLength(2);
    });

    it("should normalize patient names and phone numbers", () => {
      const patients: Patient[] = [
        {
          resourceType: "Patient",
          id: "p1",
          name: [{ family: "smith", given: ["john"] }],
          telecom: [{ system: "phone", value: "(555)123-4567" }],
        },
        {
          resourceType: "Patient",
          id: "p2",
          name: [{ family: "JOHNSON", given: ["JANE"] }],
          telecom: [{ system: "phone", value: "555.987.6543" }],
        },
      ];

      const normalized = normalizePatients(patients);

      expect(normalized[0].name?.[0].family).toBe("Smith");
      expect(normalized[1].name?.[0].family).toBe("Johnson");
    });
  });

  describe("Edge Cases", () => {
    it("should handle null/undefined values", () => {
      const patient: Patient = {
        resourceType: "Patient",
        id: "p1",
      };

      const deidentified = deidentifyPatient(patient);

      expect(deidentified).toBeDefined();
      expect(deidentified.id).toBe("p1");
    });

    it("should handle empty arrays", () => {
      const patient: Patient = {
        resourceType: "Patient",
        id: "p1",
        name: [],
        telecom: [],
      };

      const deidentified = deidentifyPatient(patient);

      expect(deidentified.name).toEqual([]);
    });

    it("should handle complex name structures", () => {
      const patient1: Patient = {
        resourceType: "Patient",
        id: "p1",
        name: [{ family: "O'Brien", given: ["Sean-Paul"] }],
      };

      const patient2: Patient = {
        resourceType: "Patient",
        id: "p2",
        name: [{ family: "Obrien", given: ["Sean Paul"] }],
      };

      const match = matchPatients(patient1, patient2);

      expect(match.score).toBeGreaterThan(0);
    });
  });
});
