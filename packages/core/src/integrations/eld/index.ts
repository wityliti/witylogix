/**
 * ELD Integrations — Public API
 *
 * Exports all ELD adapter clients and compliance engine.
 */

export type {
  DutyStatus,
  ViolationType,
  ELDEventType,
  ELDDriverLog,
  ELDDutyStatus,
  ELDViolation,
  ELDVehicle,
  ELDDVIR,
  ELDEvent,
  ELDConfig,
  ELDWebhookEvent,
  ELDAdapterInterface,
  HOSSummary,
  HOSDailyRecord,
  HOS8DayWindow,
} from "./types.js";

export {
  ELDAdapter,
  minutesToHours,
  hoursToMinutes,
  getHoursDifference,
  getStartOfDay,
  getEndOfDay,
  isSameDay,
} from "./eld-adapter.js";

export { MotiveELDClient } from "./motive-client.js";
export { OmnitrocsELDClient } from "./omnitracs-eld-client.js";
export { OmnitrocsXrsV2Client } from "./omnitracs-xrs-v2-client.js";
export { AzugaELDClient } from "./azuga-eld-client.js";
export { TrimbleELDClient } from "./trimble-eld-sdk-client.js";
export { GeotabDriveClient } from "./geotab-drive-sdk-client.js";
export { LytxDriveCamClient } from "./lytx-drivecam-client.js";

export {
  ELDComplianceEngine,
  type HOSExemption,
  type ComplianceScore,
  type FleetCompliance,
  type AuditLogEntry,
} from "./eld-compliance-engine.js";
