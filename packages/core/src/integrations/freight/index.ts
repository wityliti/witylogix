/**
 * Freight Integration Module Exports
 */

export { FreightAdapter } from "./freight-adapter";
export { DATClient } from "./dat-client";
export { TruckstopClient } from "./truckstop-client";
export { LoadBoard123Client } from "./loadboard123-client";
export { DirectFreightClient } from "./direct-freight-client";
export { FreightBoardAggregator } from "./freight-board-aggregator";

export type {
  FreightConfig,
  LoadPosting,
  FreightQuote,
  CarrierProfile,
  LaneRate,
  BookingConfirmation,
  ShipmentTracking,
  FreightInvoice,
  ComplianceDocument,
  Location,
  Contact,
  EquipmentType,
  ShipmentStatus,
  CarrierRatingFactor,
  ComplianceDocumentType,
} from "./types";

export {
  EquipmentType,
  ShipmentStatus,
  CarrierRatingFactor,
  ComplianceDocumentType,
} from "./types";
