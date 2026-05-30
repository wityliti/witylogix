/**
 * Healthcare Integration Module
 *
 * FHIR R4 adapters for Epic, Cerner, Allscripts
 * HL7 v2 support, consent management, audit logging
 */

export { HealthcareAdapter, RateLimiter, CircuitBreaker, RetryHandler } from "./healthcare-adapter.js";

export {
  type HealthcareConfig,
  type FHIRResource,
  type FHIRSearchParams,
  type FHIRSearchResult,
  type Patient,
  type Observation,
  type Encounter,
  type MedicationRequest,
  type DiagnosticReport,
  type Procedure,
  type Condition,
  type AllergyIntolerance,
  type HL7Message,
  type HL7Segment,
  type ClinicalDocument,
  type ConsentRecord,
  type ConsentPurpose,
  type AuditEntry,
  type TerminologyMapping,
  type CodeSystem,
  type BulkExportParams,
  type SMARTLaunchParams,
  type SMARTContext,
} from "./types.js";

export { CernerClient } from "./cerner-client.js";
export { AllscriptsClient } from "./allscripts-client.js";
export { EpicClient } from "./epic-client.js";
export { HL7FHIRClient } from "./hl7-fhir-client.js";

// FHIR v2 SDK Clients (production-grade)
export { EpicFhirV2SdkClient } from "./epic-fhir-v2-sdk-client.js";
export { CernerFhirV2SdkClient } from "./cerner-fhir-v2-sdk-client.js";
export { AllscriptsFhirV2SdkClient } from "./allscripts-fhir-v2-sdk-client.js";

// FHIR v2 SDK Types
export {
  type SDKConfig,
  type NormalizedPatient,
  type NormalizedEncounter,
  type NormalizedObservation,
  type NormalizedCondition,
  type NormalizedMedication,
  type FHIRBundle,
  type OperationOutcome,
  type BulkExportResult,
  type OAuth2Token,
  type RetryConfig,
  type RateLimiterState,
  HealthcareSDKError,
} from "./healthcare-sdk-types.js";

export {
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
} from "./healthcare-normalizer.js";
