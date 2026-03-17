/**
 * Unified ELD Types for Samsara, KeepTruckin (Motive v2), and FMCSA
 *
 * This module provides unified types across multiple ELD/compliance providers:
 * - Samsara Fleet API v1
 * - KeepTruckin (Motive v2) API
 * - FMCSA DataQs API
 *
 * Normalizes payload structures and enables cross-provider data mapping.
 */

// ─── Samsara Types ──────────────────────────────────────

export interface SamsaraDriver {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  licenseNumber?: string;
  licenseState?: string;
  licenseExpirationDate?: string;
  eldDeviceId?: string;
  currentDutyStatus?: "driving" | "on_duty" | "sleeper_berth" | "off_duty";
  createdAt: string;
  updatedAt: string;
}

export interface SamsaraVehicle {
  id: string;
  name: string;
  vin: string;
  licensePlate: string;
  make?: string;
  model?: string;
  year?: number;
  vinReportingWeight?: number;
  gvwr?: number;
  fuelType?: "diesel" | "gasoline" | "electric" | "hybrid";
  createdAt: string;
  updatedAt: string;
}

export interface SamsaraHOSLog {
  id: string;
  driverId: string;
  vehicleId?: string;
  startTime: string;
  endTime: string;
  dutyStatus: "driving" | "on_duty" | "sleeper_berth" | "off_duty";
  milesDriven?: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  notes?: string;
  edited: boolean;
  editedAt?: string;
  editReason?: string;
  createdAt: string;
}

export interface SamsaraHOSViolation {
  id: string;
  driverId: string;
  violationType: string;
  detectedAt: string;
  resolvedAt?: string;
  description: string;
}

export interface SamsaraLocation {
  id?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  timestamp: string;
}

export interface SamsaraVehicleStats {
  fuelPercent?: number;
  engineState?: "off" | "on" | "idle";
  speedMph?: number;
  odometer?: {
    miles: number;
    time: string;
  };
}

export interface SamsaraAsset {
  id: string;
  name: string;
  assetType: "vehicle" | "trailer" | "equipment";
  externalIds?: Record<string, string>;
  createdAt: string;
}

export interface SamsaraDVIR {
  id: string;
  driverId: string;
  vehicleId: string;
  inspectionDate: string;
  inspectionType: "pre_trip" | "post_trip";
  defectsSummary?: "pass" | "fail" | "not_applicable";
  defects: Array<{
    component: string;
    defectDescription: string;
    isResolved: boolean;
    resolvedAt?: string;
  }>;
  driverNotes?: string;
  mechanicNotes?: string;
}

export interface SamsaraHarshEvent {
  id: string;
  driverId: string;
  vehicleId: string;
  eventType: "speeding" | "hard_accel" | "hard_brake" | "hard_turn" | "collision";
  severity: "low" | "medium" | "high";
  timestamp: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  speedMph?: number;
  coachingState?: "uncoached" | "coached";
}

export interface SamsaraRoute {
  id: string;
  name: string;
  startLocation: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  endLocation: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  stops: Array<{
    id: string;
    sequence: number;
    location: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    eta?: string;
    arrivedAt?: string;
    departedAt?: string;
  }>;
}

export interface SamsaraDocument {
  id: string;
  type: "license" | "certificate" | "medical_cert" | "training" | "permit";
  driverId: string;
  expirationDate?: string;
  issueDate?: string;
  documentUrl?: string;
}

export interface SamsaraWebhookPayload {
  id: string;
  eventType: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface SamsaraPaginationParams {
  limit?: number;
  after?: string;
}

export interface SamsaraCursorPaginationResponse<T> {
  data: T[];
  pagination: {
    hasNextPage: boolean;
    endCursor?: string;
  };
}

// ─── KeepTruckin (Motive v2) Types ──────────────────────

export interface KeepTruckinUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  timezone?: string;
  role?: string;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KeepTruckinDriver {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  licenseState: string;
  licenseExpiration?: string;
  companyId: string;
  eldDeviceId?: string;
  meid?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KeepTruckinHOSLogEntry {
  id: string;
  driverId: string;
  vehicleId?: string;
  status: "Driving" | "OnDuty" | "SleepBerth" | "OffDuty" | "PersonalConveyance" | "YardMove";
  startTime: string;
  endTime: string;
  milesDriven?: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  remarks?: string;
  isCertified?: boolean;
  certifiedAt?: string;
  editCount?: number;
  lastEditedAt?: string;
}

export interface KeepTruckinDailyLog {
  id: string;
  driverId: string;
  date: string;
  startTime: string;
  endTime: string;
  dutyStatusEntries: KeepTruckinHOSLogEntry[];
  isCertified: boolean;
  certifiedAt?: string;
  certifiedByDriverId?: string;
}

export interface KeepTruckinViolation {
  id: string;
  driverId: string;
  type: string;
  severity: "minor" | "major" | "critical";
  description: string;
  detectionDate: string;
  detectionTime: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface KeepTruckinVehicle {
  id: string;
  name: string;
  vin: string;
  licensePlate: string;
  make?: string;
  model?: string;
  year?: number;
  gvwr?: number;
  fuelType?: string;
  odometerMiles?: number;
  createdAt: string;
  updatedAt: string;
}

export interface KeepTruckinVehicleLocation {
  vehicleId: string;
  latitude: number;
  longitude: number;
  address?: string;
  speedMph?: number;
  heading?: number;
  timestamp: string;
  odometer?: number;
}

export interface KeepTruckinEngineData {
  vehicleId: string;
  odometerMiles: number;
  rpm?: number;
  throttlePercent?: number;
  engineTemp?: number;
  fuelLevel?: number;
  voltage?: number;
}

export interface KeepTruckinFaultCode {
  id: string;
  vehicleId: string;
  code: string;
  description: string;
  severity: "info" | "warning" | "error" | "critical";
  detectionTime: string;
  resolutionTime?: string;
}

export interface KeepTruckinDVIR {
  id: string;
  driverId: string;
  vehicleId: string;
  inspectionDate: string;
  inspectionTime: string;
  type: "PreTrip" | "PostTrip";
  status: "Pass" | "Fail" | "RepairedAndSafe";
  defects: Array<{
    id: string;
    type: string;
    severity: "Minor" | "Major" | "Critical";
    description: string;
    component: string;
    repairStatus?: "Unrepaired" | "Repaired" | "Deferred";
    repairDate?: string;
  }>;
  driverComments?: string;
  mechanicComments?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KeepTruckinIFTATrip {
  id: string;
  driverId: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  originState: string;
  destinationState: string;
  totalMiles: number;
  milesInState: { [state: string]: number };
  fuelPurchases: Array<{
    state: string;
    gallons: number;
    date: string;
    cost?: number;
  }>;
}

export interface KeepTruckinDocument {
  id: string;
  driverId: string;
  type: string;
  category: string;
  fileUrl: string;
  expirationDate?: string;
  uploadedAt: string;
  expiresAt?: string;
}

export interface KeepTruckinERodsExport {
  format: "eRODS";
  version: string;
  companyName: string;
  periodStart: string;
  periodEnd: string;
  drivers: Array<{
    id: string;
    name: string;
    licenseNumber: string;
    hosLogs: KeepTruckinHOSLogEntry[];
    violations: KeepTruckinViolation[];
  }>;
  externalUserId: string;
}

export interface KeepTruckinWebhookPayload {
  id: string;
  eventType: string;
  timestamp: string;
  resourceType: string;
  resourceId: string;
  data: Record<string, unknown>;
}

export interface KeepTruckinPaginationParams {
  page?: number;
  per_page?: number;
}

export interface KeepTruckinPaginationResponse<T> {
  data: T[];
  pagination: {
    page_no: number;
    per_page: number;
    total_records: number;
    total_pages: number;
  };
}

// ─── FMCSA DataQs Types ──────────────────────────────────

export interface FMCSACarrierProfile {
  dotNumber: string;
  mcNumber?: string;
  fmcNumber?: string;
  legalName: string;
  dbaName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phoneNumber?: string;
  operatingStatus: "Active" | "Inactive" | "OutOfService" | "Unknown";
  operationClassification: "Interstate" | "Intrastate" | "Exempt";
  carrierType: "Motor Carrier" | "Broker" | "Freight Forwarder";
  totalDrivers?: number;
  totalVehicles?: number;
  powerUnits?: number;
  trailers?: number;
  safetyManagement?: string;
  hazmatRegistered?: boolean;
}

export interface FMCSASafetyRating {
  dotNumber: string;
  safetyRating: "Satisfactory" | "Conditional" | "Unsatisfactory" | "Unrated";
  safetyRatingDate?: string;
  basics: Array<{
    basicNumber: number;
    basicDescription: string;
    score: number;
    percentile?: number;
    issueDate?: string;
  }>;
  crashIndicators?: {
    rateable: boolean;
    rate: number;
    percentile?: number;
  };
  smsOverallRating?: {
    numOfInspections: number;
    numOfViolations: number;
    weightedScore: number;
    percentile?: number;
  };
}

export interface FMCSAInspection {
  inspectionId: string;
  dotNumber: string;
  inspectionDate: string;
  inspectionType: "vehicle" | "carrier" | "driver";
  violationCount: number;
  outOfServiceCount: number;
  violations: Array<{
    violationCode: string;
    violationDescription: string;
    severity: "warning" | "critical" | "out_of_service";
  }>;
  state: string;
  roadwayType?: string;
}

export interface FMCSACrash {
  crashId: string;
  dotNumber: string;
  crashDate: string;
  crashLocation?: string;
  crashState?: string;
  fatalityCount: number;
  injuryCount: number;
  vehiclesInvolved: number;
  reportable: boolean;
}

export interface FMCSABasicScore {
  basicNumber: number;
  basicName: string;
  weight: number;
  score: number;
  percentile?: number;
}

export interface FMCSAInsurance {
  dotNumber: string;
  insured: boolean;
  activeBonds: Array<{
    bondType: string;
    bondAmount: number;
    bondEffectiveDate: string;
    bondExpirationDate: string;
  }>;
  activeInsurancePolicies: Array<{
    policyType: string;
    coverage: number;
    insurer: string;
    effectiveDate: string;
    expirationDate: string;
  }>;
  lastUpdatedDate?: string;
}

export interface FMCSAOperatingAuthority {
  dotNumber: string;
  mcNumber?: string;
  fmcNumber?: string;
  mcAuthorityStatus: "Active" | "Inactive" | "Pending" | "Revoked";
  ffAuthorityStatus: "Active" | "Inactive" | "Pending" | "Revoked";
  authorityEffectiveDate?: string;
  authorityExpirationDate?: string;
  numberOfAuthorityDocuments?: number;
}

export interface FMCSADataQsChallengeRequest {
  dotNumber: string;
  challengeType: "BasicsChallenge" | "DataChallenge";
  dataElementId?: string;
  reason: string;
  supportingDocumentationUrl?: string;
  submittedDate: string;
  status: "Pending" | "Approved" | "Denied" | "Resolved";
}

export interface FMCSACarrierLookupParams {
  dotNumber?: string;
  mcNumber?: string;
  legalName?: string;
  city?: string;
  state?: string;
}

export interface FMCSACarrierSearchResponse {
  carriers: FMCSACarrierProfile[];
  totalResults: number;
}

// ─── Unified Types ──────────────────────────────────────

export interface UnifiedDriver {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  licenseNumber?: string;
  licenseState?: string;
  licenseExpirationDate?: string;
  sourceProvider: "samsara" | "keeptruckin" | "motive";
  sourceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UnifiedVehicle {
  id: string;
  name: string;
  vin: string;
  licensePlate: string;
  make?: string;
  model?: string;
  year?: number;
  gvwr?: number;
  fuelType?: string;
  odometer?: number;
  sourceProvider: "samsara" | "keeptruckin" | "motive";
  sourceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UnifiedHOSLog {
  id: string;
  driverId: string;
  vehicleId?: string;
  startTime: Date;
  endTime: Date;
  dutyStatus: string;
  milesDriven?: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  notes?: string;
  edited: boolean;
  sourceProvider: "samsara" | "keeptruckin" | "motive";
  sourceId: string;
}

export interface UnifiedDVIR {
  id: string;
  driverId: string;
  vehicleId: string;
  inspectionDate: Date;
  inspectionType: "pre_trip" | "post_trip";
  status: "pass" | "fail" | "defect";
  defects: Array<{
    component: string;
    severity: string;
    description: string;
    resolved?: boolean;
  }>;
  driverNotes?: string;
  mechanicNotes?: string;
  sourceProvider: "samsara" | "keeptruckin" | "motive";
  sourceId: string;
}

export interface UnifiedViolation {
  id: string;
  driverId: string;
  violationType: string;
  description: string;
  severity: string;
  detectedAt: Date;
  sourceProvider: "samsara" | "keeptruckin" | "motive";
  sourceId: string;
}

// ─── Transfer and Export Formats ────────────────────────

export interface ELDTransferFormat {
  format: "eRODS" | "fmcsa" | "raw";
  version: string;
  exportDate: string;
  companyInfo: {
    name: string;
    dotNumber?: string;
    mcNumber?: string;
  };
  periodStart: string;
  periodEnd: string;
  drivers: Array<{
    id: string;
    name: string;
    hosLogs: UnifiedHOSLog[];
    violations: UnifiedViolation[];
    dvirRecords: UnifiedDVIR[];
  }>;
}

export interface InspectionExportFormat {
  exportType: "roadside_inspection" | "compliance_audit" | "fmcsa_challenge";
  carrier: FMCSACarrierProfile;
  inspections: FMCSAInspection[];
  violations: Array<{
    violationCode: string;
    description: string;
    severity: string;
  }>;
  metadata: {
    exportDate: string;
    exportedBy: string;
  };
}

// ─── Rate Limit and Pagination Info ─────────────────────

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
}

export interface PaginationInfo {
  hasMore: boolean;
  cursor?: string;
  pageNumber?: number;
  totalRecords?: number;
}

// ─── Webhook Verification ───────────────────────────────

export interface WebhookSignatureVerification {
  algorithm: "sha256" | "sha1";
  signature: string;
  payload: string;
  secret: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  timestamp?: number;
  error?: string;
}
