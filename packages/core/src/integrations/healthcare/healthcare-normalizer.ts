/**
 * Healthcare Data Normalizer
 *
 * Normalizes clinical data across multiple healthcare providers.
 * Supports patient matching, code system translation, unit conversion,
 * document format normalization, and de-identification.
 */

import type {
  Patient,
  Observation,
  TerminologyMapping,
  CodeSystem,
} from "./types.js";

// ─── Patient Matching (Master Patient Index) ────────────────────────────────

/**
 * Patient match score (0-100).
 */
export interface PatientMatchScore {
  patientId: string;
  provider: string;
  score: number; // 0-100
  matchedFields: string[];
}

/**
 * Normalize patient identifier for matching.
 */
function normalizeString(str: string | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i += 1) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate string similarity score (0-1).
 */
function stringSimilarity(a: string, b: string): number {
  const normalized_a = normalizeString(a);
  const normalized_b = normalizeString(b);

  if (normalized_a === normalized_b) {
    return 1;
  }

  if (!normalized_a || !normalized_b) {
    return 0;
  }

  const distance = levenshteinDistance(normalized_a, normalized_b);
  const maxLength = Math.max(normalized_a.length, normalized_b.length);

  return 1 - distance / maxLength;
}

/**
 * Match two patients across providers (MPI-style).
 */
export function matchPatients(
  patient1: Patient,
  patient2: Patient,
): PatientMatchScore {
  let score = 0;
  const matchedFields: string[] = [];

  // Match by exact MRN/medical record number
  const mrn1 = patient1.identifier?.find(
    (id) => id.system.includes("mrn") || id.system.includes("medical-record"),
  );
  const mrn2 = patient2.identifier?.find(
    (id) => id.system.includes("mrn") || id.system.includes("medical-record"),
  );

  if (mrn1 && mrn2 && mrn1.value === mrn2.value) {
    score += 50;
    matchedFields.push("mrn");
  }

  // Match by name
  const name1 = patient1.name?.[0];
  const name2 = patient2.name?.[0];

  if (name1 && name2) {
    const familySimilarity = stringSimilarity(
      name1.family || "",
      name2.family || "",
    );
    const givenSimilarity =
      name1.given && name2.given
        ? stringSimilarity(name1.given[0] || "", name2.given[0] || "")
        : 0;

    const nameScore = (familySimilarity * 0.6 + givenSimilarity * 0.4) * 30;
    score += nameScore;

    if (nameScore > 25) {
      matchedFields.push("name");
    }
  }

  // Match by date of birth
  if (
    patient1.birthDate &&
    patient2.birthDate &&
    patient1.birthDate === patient2.birthDate
  ) {
    score += 15;
    matchedFields.push("dob");
  }

  // Match by phone number
  const phone1 = patient1.telecom?.find((t) => t.system === "phone");
  const phone2 = patient2.telecom?.find((t) => t.system === "phone");

  if (phone1 && phone2 && phone1.value === phone2.value) {
    score += 5;
    matchedFields.push("phone");
  }

  return {
    patientId: patient2.id || "",
    provider: "unknown",
    score: Math.min(100, score),
    matchedFields,
  };
}

// ─── Code System Mapping ─────────────────────────────────────────────────────

/**
 * Built-in terminology mappings (simplified).
 */
const terminologyMappings: Record<
  string,
  Record<string, TerminologyMapping>
> = {
  "ICD-10-to-SNOMED-CT": {
    I10: {
      sourceSystem: "ICD-10",
      sourceCode: "I10",
      targetSystem: "SNOMED-CT",
      targetCode: "59621000",
      equivalence: "equivalent",
      sourceDisplay: "Essential (primary) hypertension",
      targetDisplay: "Essential hypertension",
    },
    E11: {
      sourceSystem: "ICD-10",
      sourceCode: "E11",
      targetSystem: "SNOMED-CT",
      targetCode: "44054006",
      equivalence: "equivalent",
      sourceDisplay: "Type 2 diabetes mellitus",
      targetDisplay: "Type 2 diabetes mellitus",
    },
  },
  "LOINC-to-SNOMED-CT": {
    "2345-7": {
      sourceSystem: "LOINC",
      sourceCode: "2345-7",
      targetSystem: "SNOMED-CT",
      targetCode: "385354001",
      sourceDisplay: "Glucose in Serum or Plasma",
      targetDisplay: "Glucose measurement",
    },
    "2164-2": {
      sourceSystem: "LOINC",
      sourceCode: "2164-2",
      targetSystem: "SNOMED-CT",
      targetCode: "703421000",
      sourceDisplay: "Creatinine in Serum or Plasma",
      targetDisplay: "Creatinine measurement",
    },
  },
};

/**
 * Translate a code from one system to another.
 */
export function translateCode(
  sourceSystem: CodeSystem,
  sourceCode: string,
  targetSystem: CodeSystem,
): TerminologyMapping | null {
  const key = `${sourceSystem}-to-${targetSystem}`;
  const mapping = terminologyMappings[key]?.[sourceCode];

  if (mapping) {
    return mapping;
  }

  return null;
}

// ─── Unit Conversion ─────────────────────────────────────────────────────────

/**
 * Unit conversion factors (base SI units).
 */
const unitConversions: Record<
  string,
  Record<string, number | ((v: number) => number)>
> = {
  // Weight
  kg: { kg: 1, lb: 2.20462, g: 1000 },
  lb: { kg: 0.453592, lb: 1, g: 453.592 },
  g: { kg: 0.001, lb: 0.00220462, g: 1 },

  // Length
  m: { m: 1, cm: 100, mm: 1000, in: 39.3701, ft: 3.28084 },
  cm: { m: 0.01, cm: 1, mm: 10, in: 0.393701, ft: 0.0328084 },
  mm: { m: 0.001, cm: 0.1, mm: 1, in: 0.0393701, ft: 0.00328084 },
  in: { m: 0.0254, cm: 2.54, mm: 25.4, in: 1, ft: 0.0833333 },
  ft: { m: 0.3048, cm: 30.48, mm: 304.8, in: 12, ft: 1 },

  // Temperature (Celsius)
  C: { C: 1, F: (v: number) => v * 1.8 + 32, K: (v: number) => v + 273.15 },
  F: {
    C: (v: number) => (v - 32) / 1.8,
    F: 1,
    K: (v: number) => (v - 32) / 1.8 + 273.15,
  },
  K: {
    C: (v: number) => v - 273.15,
    F: (v: number) => (v - 273.15) * 1.8 + 32,
    K: 1,
  },

  // Glucose (mg/dL to mmol/L)
  "mg/dL": { "mg/dL": 1, "mmol/L": 0.0555 },
  "mmol/L": { "mg/dL": 18.0182, "mmol/L": 1 },
};

/**
 * Convert a value from one unit to another.
 */
export function convertUnit(
  value: number,
  fromUnit: string,
  toUnit: string,
): number {
  const conversions = unitConversions[fromUnit];

  if (!conversions) {
    throw new Error(`Unknown unit: ${fromUnit}`);
  }

  const factor = conversions[toUnit];

  if (factor === undefined) {
    throw new Error(`Cannot convert from ${fromUnit} to ${toUnit}`);
  }

  if (typeof factor === "function") {
    return factor(value);
  }

  return value * factor;
}

// ─── Observation Normalization ──────────────────────────────────────────────

/**
 * Normalize observation to standard units.
 */
export function normalizeObservation(
  observation: Observation,
  targetUnit: string,
): Observation {
  if (
    !observation.value ||
    typeof observation.value === "string" ||
    !("value" in observation.value)
  ) {
    return observation;
  }

  const currentValue = observation.value as any;

  if (typeof currentValue.value !== "number") {
    return observation;
  }

  const currentUnit = currentValue.unit || currentValue.code;

  if (!currentUnit || currentUnit === targetUnit) {
    return observation;
  }

  try {
    const convertedValue = convertUnit(
      currentValue.value,
      currentUnit,
      targetUnit,
    );

    return {
      ...observation,
      value: {
        ...currentValue,
        value: convertedValue,
        unit: targetUnit,
      },
    };
  } catch {
    return observation;
  }
}

// ─── Document Format Normalization ──────────────────────────────────────────

/**
 * Convert CDA (XML) to FHIR JSON format (simplified).
 */
export function convertCDAToFHIR(cdaXml: string): any {
  // INTEGRATION: Full CDA to FHIR conversion would require XML parsing
  // This is a simplified example
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: [
      {
        request: {
          method: "POST",
          url: "/Composition",
        },
        resource: {
          resourceType: "Composition",
          status: "final",
          type: {
            coding: [
              {
                system: "http://loinc.org",
                code: "34108-1",
              },
            ],
          },
          date: new Date().toISOString(),
        },
      },
    ],
  };
}

/**
 * Extract patient MRN from CDA document.
 */
export function extractPatientMRNFromCDA(cdaXml: string): string | null {
  // INTEGRATION: Full XML parsing needed
  // For now, attempt regex match
  const mrnMatch = cdaXml.match(/assignedId extension="([^"]+)"/);
  return mrnMatch ? mrnMatch[1] : null;
}

// ─── De-identification (HIPAA) ──────────────────────────────────────────────

/**
 * De-identify a patient (remove PHI).
 */
export function deidentifyPatient(patient: Patient): Patient {
  return {
    ...patient,
    name: patient.name?.map((n) => ({
      ...n,
      given: n.given?.map(() => "REDACTED"),
      family: "REDACTED",
    })),
    address: patient.address?.map((a) => ({
      ...a,
      line: a.line?.map(() => "REDACTED"),
      city: "REDACTED",
      state: "REDACTED",
      postalCode: "REDACTED",
      country: "REDACTED",
    })),
    telecom: patient.telecom?.map((t) => ({
      ...t,
      value: "REDACTED",
    })),
    birthDate: undefined,
    contact: undefined,
  };
}

/**
 * De-identify observation (remove PHI references).
 */
export function deidentifyObservation(observation: Observation): Observation {
  return {
    ...observation,
    subject: {
      reference: "Patient/REDACTED",
    },
    performer: observation.performer?.map(() => ({
      reference: "Practitioner/REDACTED",
    })),
  };
}

/**
 * Hash a value for de-identified tracking (HIPAA-compliant).
 */
export function hashPHI(value: string, salt: string = ""): string {
  // INTEGRATION: Use proper cryptographic hash
  // This is a simplified example
  const combined = value + salt;
  let hash = 0;

  for (let i = 0; i < combined.length; i += 1) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(16);
}

// ─── Batch Normalization ────────────────────────────────────────────────────

/**
 * Normalize multiple observations to standard units.
 */
export function normalizeObservations(
  observations: Observation[],
  targetUnits: Record<string, string>,
): Observation[] {
  return observations.map((obs) => {
    const loincCode = obs.code?.coding?.find((c) =>
      c.system.includes("loinc"),
    )?.code;
    const targetUnit = loincCode ? targetUnits[loincCode] : undefined;

    if (!targetUnit) {
      return obs;
    }

    return normalizeObservation(obs, targetUnit);
  });
}

/**
 * Normalize patients for cohort matching.
 */
export function normalizePatients(patients: Patient[]): Patient[] {
  return patients.map((p) => ({
    ...p,
    // Standardize names to Title Case
    name: p.name?.map((n) => ({
      ...n,
      family: n.family
        ?.split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(" "),
      given: n.given?.map(
        (g) => g.charAt(0).toUpperCase() + g.slice(1).toLowerCase(),
      ),
    })),
    // Standardize phone numbers (remove formatting)
    telecom: p.telecom?.map((t) => ({
      ...t,
      value: t.value.replace(/\D/g, ""),
    })),
  }));
}
