/**
 * @witylogix/workflows/steps — Reusable workflow step library
 *
 * All delivery workflows compose from these reusable steps,
 * providing consistency and maintainability across the platform.
 */

// Validation
export { validateOrderStep } from "./validation.js";
export type {
  ValidateOrderInput,
  ValidateOrderOutput,
} from "./validation.js";

// Geocoding
export { geocodeAddressStep } from "./geocoding.js";
export type {
  GeocodingInput,
  GeocodingOutput,
  GeocodedLocation,
} from "./geocoding.js";

// Rating/Pricing
export { calculateRateStep } from "./rating.js";
export type { RatingInput, RatingOutput } from "./rating.js";

// Zone Assignment
export { assignZoneStep } from "./assignment.js";
export type { AssignZoneInput, AssignZoneOutput } from "./assignment.js";

// Driver Search & Optimization
export { findAvailableDriversStep, optimizeAssignmentStep } from "./assignment.js";
export type {
  FindAvailableDriversInput,
  FindAvailableDriversOutput,
  DriverCandidate,
  OptimizeAssignmentInput,
  OptimizeAssignmentOutput,
} from "./assignment.js";

// Driver Assignment Record
export { assignDriverRecordStep } from "./assignment.js";
export type {
  AssignDriverRecordInput,
  AssignDriverRecordOutput,
} from "./assignment.js";

// Order Creation
export { createOrderRecordStep } from "./order.js";
export type {
  CreateOrderRecordInput,
  CreateOrderRecordOutput,
} from "./order.js";

// Delivery & Proof of Delivery
export { verifyProofOfDeliveryStep, updateDeliveryStatusStep } from "./delivery.js";
export type {
  VerifyProofOfDeliveryInput,
  VerifyProofOfDeliveryOutput,
  UpdateDeliveryStatusInput,
  UpdateDeliveryStatusOutput,
} from "./delivery.js";

// Billing
export { triggerBillingStep } from "./billing.js";
export type {
  TriggerBillingInput,
  TriggerBillingOutput,
} from "./billing.js";

// Notifications
export { sendNotificationStep } from "./notification.js";
export type {
  SendNotificationInput,
  SendNotificationOutput,
  NotificationLog,
} from "./notification.js";
