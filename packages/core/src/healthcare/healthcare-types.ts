/**
 * Healthcare Interoperability Engine - Type Definitions
 * FHIR R4 and HL7v2 integration types
 */

// FHIR R4 Resource Types
export interface FHIRMeta {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
  security?: Array<{ system: string; code: string; display: string }>;
  tag?: Array<{ system: string; code: string; display: string }>;
}

export interface FHIRReference {
  reference: string;
  type?: string;
  identifier?: FHIRIdentifier;
  display?: string;
}

export interface FHIRCodeableConcept {
  coding?: Array<{
    system?: string;
    version?: string;
    code?: string;
    display?: string;
    userSelected?: boolean;
  }>;
  text?: string;
}

export interface FHIRCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface FHIRIdentifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: FHIRCodeableConcept;
  system?: string;
  value?: string;
  period?: { start?: string; end?: string };
  assigner?: FHIRReference;
}

export interface FHIRHumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: { start?: string; end?: string };
}

export interface FHIRAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: { start?: string; end?: string };
}

export interface FHIRContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: { start?: string; end?: string };
}

export interface FHIRPeriod {
  start?: string; // ISO 8601 datetime
  end?: string;   // ISO 8601 datetime
}

export interface FHIRPatient {
  resourceType: 'Patient';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  active?: boolean;
  name?: FHIRHumanName[];
  telecom?: FHIRContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string; // YYYY-MM-DD
  deceased?: boolean | string;
  address?: FHIRAddress[];
  maritalStatus?: FHIRCodeableConcept;
  multipleBirth?: boolean | number;
  photo?: Array<{ contentType?: string; data?: string; url?: string }>;
  contact?: Array<{
    relationship?: FHIRCodeableConcept[];
    name?: FHIRHumanName;
    telecom?: FHIRContactPoint[];
    address?: FHIRAddress;
    gender?: string;
    organization?: FHIRReference;
    period?: FHIRPeriod;
  }>;
  communication?: Array<{
    language: FHIRCodeableConcept;
    preferred?: boolean;
  }>;
  generalPractitioner?: FHIRReference[];
  managingOrganization?: FHIRReference;
  link?: Array<{
    other: FHIRReference;
    type: 'replaced-by' | 'replaces' | 'refer' | 'seealso';
  }>;
}

export interface FHIREncounter {
  resourceType: 'Encounter';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  statusHistory?: Array<{ status: string; period: FHIRPeriod }>;
  class: { system?: string; code?: string; display?: string };
  classHistory?: Array<{ class: any; period: FHIRPeriod }>;
  type?: FHIRCodeableConcept[];
  serviceType?: FHIRCodeableConcept;
  priority?: FHIRCodeableConcept;
  subject?: FHIRReference;
  episodeOfCare?: FHIRReference[];
  basedOn?: FHIRReference[];
  participant?: Array<{
    type?: FHIRCodeableConcept[];
    period?: FHIRPeriod;
    individual?: FHIRReference;
  }>;
  appointment?: FHIRReference[];
  period?: FHIRPeriod;
  length?: { value?: number; comparator?: string; unit?: string; system?: string; code?: string };
  reason?: Array<{
    use?: FHIRCodeableConcept[];
    value?: FHIRCodeableConcept[];
  }>;
  diagnosis?: Array<{
    condition: FHIRReference;
    use?: FHIRCodeableConcept;
    rank?: number;
  }>;
  account?: FHIRReference[];
  hospitalization?: {
    preAdmissionIdentifier?: FHIRIdentifier;
    origin?: FHIRReference;
    admitSource?: FHIRCodeableConcept;
    reAdmission?: FHIRCodeableConcept;
    dietPreference?: FHIRCodeableConcept[];
    specialCourtesy?: FHIRCodeableConcept[];
    specialArrangement?: FHIRCodeableConcept[];
    destination?: FHIRReference;
    dischargeDisposition?: FHIRCodeableConcept;
  };
  location?: Array<{
    location: FHIRReference;
    status?: 'planned' | 'active' | 'reserved' | 'completed';
    physicalType?: FHIRCodeableConcept;
    period?: FHIRPeriod;
  }>;
  serviceProvider?: FHIRReference;
  partOf?: FHIRReference;
}

export interface FHIRObservation {
  resourceType: 'Observation';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  basedOn?: FHIRReference[];
  partOf?: FHIRReference[];
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject?: FHIRReference;
  focus?: FHIRReference[];
  encounter?: FHIRReference;
  effectiveDateTime?: string;
  effectivePeriod?: FHIRPeriod;
  issued?: string;
  performer?: FHIRReference[];
  valueQuantity?: {
    value?: number;
    comparator?: string;
    unit?: string;
    system?: string;
    code?: string;
  };
  valueCodeableConcept?: FHIRCodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: any;
  valueRatio?: any;
  valueSampledData?: any;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: FHIRPeriod;
  dataAbsentReason?: FHIRCodeableConcept;
  interpretation?: FHIRCodeableConcept[];
  note?: Array<{ text?: string; time?: string; authorString?: string }>;
  bodySite?: FHIRCodeableConcept;
  method?: FHIRCodeableConcept;
  specimen?: FHIRReference;
  device?: FHIRReference;
  referenceRange?: Array<{
    low?: any;
    high?: any;
    type?: FHIRCodeableConcept;
    appliesTo?: FHIRCodeableConcept[];
    age?: any;
    text?: string;
  }>;
  hasMember?: FHIRReference[];
  derivedFrom?: FHIRReference[];
  component?: Array<{
    code: FHIRCodeableConcept;
    valueQuantity?: any;
    valueCodeableConcept?: FHIRCodeableConcept;
    valueString?: string;
    valueBoolean?: boolean;
    valueInteger?: number;
    valueRange?: any;
    valueRatio?: any;
    valueSampledData?: any;
    valueTime?: string;
    valueDateTime?: string;
    valuePeriod?: FHIRPeriod;
    dataAbsentReason?: FHIRCodeableConcept;
    interpretation?: FHIRCodeableConcept[];
    referenceRange?: any[];
  }>;
}

export interface FHIRCondition {
  resourceType: 'Condition';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  clinicalStatus?: FHIRCodeableConcept;
  verificationStatus?: FHIRCodeableConcept;
  category?: FHIRCodeableConcept[];
  severity?: FHIRCodeableConcept;
  code: FHIRCodeableConcept;
  bodySite?: FHIRCodeableConcept[];
  subject: FHIRReference;
  encounter?: FHIRReference;
  onsetDateTime?: string;
  onsetAge?: any;
  onsetPeriod?: FHIRPeriod;
  onsetRange?: any;
  onsetString?: string;
  abatementDateTime?: string;
  abatementAge?: any;
  abatementPeriod?: FHIRPeriod;
  abatementRange?: any;
  abatementString?: string;
  recordedDate?: string;
  recorder?: FHIRReference;
  asserter?: FHIRReference;
  stage?: Array<{
    summary?: FHIRCodeableConcept;
    assessment?: FHIRReference[];
    type?: FHIRCodeableConcept;
  }>;
  evidence?: Array<{
    code?: FHIRCodeableConcept[];
    detail?: FHIRReference[];
  }>;
  note?: Array<{ text?: string; time?: string; authorString?: string }>;
}

export interface FHIRMedicationRequest {
  resourceType: 'MedicationRequest';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'draft' | 'unknown';
  statusReason?: FHIRCodeableConcept;
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  category?: FHIRCodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  doNotPerform?: boolean;
  medicationCodeableConcept?: FHIRCodeableConcept;
  medicationReference?: FHIRReference;
  subject: FHIRReference;
  encounter?: FHIRReference;
  supportingInformation?: FHIRReference[];
  authoredOn?: string;
  requester?: FHIRReference;
  performer?: FHIRReference;
  performerType?: FHIRCodeableConcept;
  recorder?: FHIRReference;
  reasonCode?: FHIRCodeableConcept[];
  reasonReference?: FHIRReference[];
  courseOfTherapyType?: FHIRCodeableConcept;
  insurance?: FHIRReference[];
  note?: Array<{ text?: string; time?: string; authorString?: string }>;
  dosageInstruction?: Array<{
    sequence?: number;
    text?: string;
    additionalInstruction?: FHIRCodeableConcept[];
    patientInstruction?: string;
    timing?: any;
    asNeededBoolean?: boolean;
    asNeededCodeableConcept?: FHIRCodeableConcept;
    site?: FHIRCodeableConcept;
    route?: FHIRCodeableConcept;
    method?: FHIRCodeableConcept;
    doseAndRate?: Array<{
      type?: FHIRCodeableConcept;
      doseRange?: any;
      doseQuantity?: any;
      rateRatio?: any;
      rateRange?: any;
      rateQuantity?: any;
    }>;
    maxDosePerPeriod?: any;
    maxDosePerAdministration?: any;
    maxDosePerLifetime?: any;
  }>;
  dispenseRequest?: {
    initialFill?: { quantity?: any; duration?: any };
    dispenseInterval?: any;
    validityPeriod?: FHIRPeriod;
    numberOfRepeatsAllowed?: number;
    quantity?: any;
    expectedSupplyDuration?: any;
    performer?: FHIRReference;
  };
  substitution?: {
    allowed: boolean | FHIRCodeableConcept;
    reason?: FHIRCodeableConcept;
  };
  priorPrescription?: FHIRReference;
  detectedIssue?: FHIRReference[];
  eventHistory?: FHIRReference[];
}

export interface FHIRAllergyIntolerance {
  resourceType: 'AllergyIntolerance';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  clinicalStatus?: FHIRCodeableConcept;
  verificationStatus?: FHIRCodeableConcept;
  type?: 'allergy' | 'intolerance' | 'propensity';
  category?: Array<'food' | 'medication' | 'environment' | 'biologic'>;
  criticality?: 'low' | 'high' | 'unable-to-assess';
  code: FHIRCodeableConcept;
  patient: FHIRReference;
  encounter?: FHIRReference;
  onsetDateTime?: string;
  onsetAge?: any;
  onsetPeriod?: FHIRPeriod;
  onsetRange?: any;
  onsetString?: string;
  recordedDate?: string;
  recorder?: FHIRReference;
  asserter?: FHIRReference;
  lastOccurrence?: string;
  note?: Array<{ text?: string; time?: string; authorString?: string }>;
  reaction?: Array<{
    substance?: FHIRCodeableConcept;
    manifestation: FHIRCodeableConcept[];
    description?: string;
    onset?: string;
    severity?: 'mild' | 'moderate' | 'severe';
    exposureRoute?: FHIRCodeableConcept;
    note?: Array<{ text?: string; time?: string; authorString?: string }>;
  }>;
}

export interface FHIRDiagnosticReport {
  resourceType: 'DiagnosticReport';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  basedOn?: FHIRReference[];
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject?: FHIRReference;
  encounter?: FHIRReference;
  effectiveDateTime?: string;
  effectivePeriod?: FHIRPeriod;
  issued?: string;
  performer?: FHIRReference[];
  resultsInterpreter?: FHIRReference[];
  specimen?: FHIRReference[];
  result?: FHIRReference[];
  imagingStudy?: FHIRReference[];
  media?: Array<{ comment?: string; link: FHIRReference }>;
  conclusion?: string;
  conclusionCode?: FHIRCodeableConcept[];
  presentedForm?: Array<{ contentType?: string; language?: string; data?: string; url?: string }>;
}

export interface FHIRProcedure {
  resourceType: 'Procedure';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: FHIRReference[];
  partOf?: FHIRReference[];
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';
  statusReason?: FHIRCodeableConcept;
  category?: FHIRCodeableConcept;
  code?: FHIRCodeableConcept;
  subject: FHIRReference;
  encounter?: FHIRReference;
  performedDateTime?: string;
  performedPeriod?: FHIRPeriod;
  performedString?: string;
  performedAge?: any;
  performer?: Array<{
    function?: FHIRCodeableConcept;
    actor: FHIRReference;
    onBehalfOf?: FHIRReference;
  }>;
  location?: FHIRReference;
  reasonCode?: FHIRCodeableConcept[];
  reasonReference?: FHIRReference[];
  bodySite?: FHIRCodeableConcept[];
  outcome?: FHIRCodeableConcept;
  report?: FHIRReference[];
  complication?: FHIRCodeableConcept[];
  complicationDetail?: FHIRReference[];
  followUp?: FHIRCodeableConcept[];
  note?: Array<{ text?: string; time?: string; authorString?: string }>;
  focalDevice?: Array<{
    action?: FHIRCodeableConcept;
    manipulated: FHIRReference;
  }>;
  usedReference?: FHIRReference[];
  usedCode?: FHIRCodeableConcept[];
}

export interface FHIRImmunization {
  resourceType: 'Immunization';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  instantiatedOn?: string;
  status: 'completed' | 'entered-in-error' | 'not-done';
  statusReason?: FHIRCodeableConcept;
  vaccineCode: FHIRCodeableConcept;
  manufacturer?: FHIRReference;
  lotNumber?: string;
  expirationDate?: string;
  patient: FHIRReference;
  encounter?: FHIRReference;
  occurrenceDateTime?: string;
  occurrenceString?: string;
  recorded?: string;
  primarySource?: boolean;
  reportOrigin?: FHIRCodeableConcept;
  location?: FHIRReference;
  manufacturer?: FHIRReference;
  site?: FHIRCodeableConcept;
  route?: FHIRCodeableConcept;
  doseQuantity?: any;
  performer?: Array<{
    function?: FHIRCodeableConcept;
    actor: FHIRReference;
  }>;
  note?: Array<{ text?: string; time?: string; authorString?: string }>;
  reasonCode?: FHIRCodeableConcept[];
  reasonReference?: FHIRReference[];
  isSubpotent?: boolean;
  subpotentReason?: FHIRCodeableConcept[];
  education?: Array<{
    documentType?: string;
    reference?: string;
    publicationDate?: string;
    presentationDate?: string;
  }>;
  programEligibility?: Array<{
    program: FHIRCodeableConcept;
    programStatus: FHIRCodeableConcept;
  }>;
  fundingSource?: FHIRCodeableConcept;
  reaction?: Array<{
    date?: string;
    detail?: FHIRReference;
    reported?: boolean;
  }>;
  protocolApplied?: Array<{
    series?: string;
    authority?: FHIRReference;
    targetDisease?: FHIRCodeableConcept[];
    doseNumberPositiveInt?: number;
    doseNumberString?: string;
    seriesDosesPositiveInt?: number;
    seriesDosesString?: string;
  }>;
}

// HL7v2 Message Structure Types
export interface HL7Segment {
  id: string; // e.g., MSH, PID, OBX
  fields: string[];
  sequence: number;
}

export interface HL7Message {
  messageId: string;
  messageType: string; // ADT, ORM, ORU, SIU, etc.
  sendingApplication?: string;
  sendingFacility?: string;
  receivingApplication?: string;
  receivingFacility?: string;
  timestamp: string; // ISO 8601 datetime
  security?: string;
  messageControlId: string;
  processingId?: string; // P (production), T (test), D (debug)
  versionId?: string; // 2.3, 2.5, 2.8, etc.
  segments: HL7Segment[];
  raw?: string; // Original HL7 message text
}

// Clinical Event Types
export interface ClinicalEvent {
  id: string;
  patientId: string;
  eventType: 'admission' | 'discharge' | 'transfer' | 'observation' | 'medication' | 'procedure' | 'diagnosis';
  eventDateTime: string;
  eventData: Record<string, any>;
  sourceSystem: string;
  sourceId?: string;
  createdAt: string;
  processedAt?: string;
}

// Compliance and Data Quality Types
export interface ComplianceStatus {
  patientId: string;
  hipaaCompliant: boolean;
  dataIntegrityScore: number; // 0-100
  recordCompleteness: number; // 0-100
  lastAuditDate: string;
  auditNotes?: string;
  encryptionVerified: boolean;
  accessLogsAvailable: boolean;
}

export interface DataQualityScore {
  resourceType: string;
  resourceId: string;
  completenessScore: number; // 0-100
  accuracyScore: number; // 0-100
  consistencyScore: number; // 0-100
  timelinesScore: number; // 0-100
  validityScore: number; // 0-100
  overallScore: number; // 0-100
  issues: Array<{
    severity: 'critical' | 'warning' | 'info';
    field: string;
    description: string;
  }>;
  lastEvaluatedAt: string;
}

// Helper type for bundles
export interface FHIRBundle {
  resourceType: 'Bundle';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier;
  type: 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';
  timestamp?: string;
  total?: number;
  link?: Array<{ relation: string; url: string }>;
  entry?: Array<{
    fullUrl?: string;
    resource?: any; // Can be any FHIR resource
    search?: { mode?: 'match' | 'include' | 'outcome'; score?: number };
    request?: {
      method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      url: string;
      ifNoneMatch?: string;
      ifModifiedSince?: string;
      ifMatch?: string;
      ifNoneExist?: string;
    };
    response?: {
      status: string;
      location?: string;
      etag?: string;
      lastModified?: string;
      outcome?: any;
    };
  }>;
  signature?: { type?: any[]; when?: string; who?: FHIRReference; contentType?: string; blob?: string };
}
