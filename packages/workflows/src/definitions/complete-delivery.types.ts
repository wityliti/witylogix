/**
 * Type definitions for the completeDeliveryWorkflow
 * Defines input/output types for each workflow step and overall orchestration
 */

// Inline type definition for Decimal (replacement for @prisma/client which is not available)
type Decimal = number | string | { toString(): string };

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW INPUT & OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Main input for the completeDeliveryWorkflow.
 * Contains all required data to complete a delivery.
 */
export interface CompleteDeliveryInput {
  // Order context
  orderId: string;
  driverId: string;
  shopId: string;

  // Proof of Delivery
  proofOfDelivery: ProofOfDelivery;

  // Delivery completion details
  actualDeliveryTime: Date;
  deliveryNotes?: string;
  recipientName?: string;

  // Optional: customer rating and feedback
  deliveryRating?: number; // 1-5 stars
  deliveryFeedback?: string;
  codAmount?: Decimal | number;
}

/**
 * Main output of the completeDeliveryWorkflow.
 * Contains all data after successful delivery completion.
 */
export interface CompleteDeliveryOutput {
  orderId: string;
  status: string;
  actualDeliveryTime: Date;
  deliveryMetrics: DeliveryMetrics;
  billingRecord: BillingRecord;
  proofOfDeliveryId: string;
  customerNotificationSent: boolean;
  merchantNotificationSent: boolean;
  totalDurationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROOF OF DELIVERY TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Proof of delivery - at least one method required:
 * - Photo URL(s)
 * - Signature (base64 encoded)
 * - Delivery code (4-6 digit numeric string)
 */
export interface ProofOfDelivery {
  photoUrls?: string[];
  signatureBase64?: string;
  deliveryCode?: string;
  recipientName?: string;
  deliveryLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  notes?: string;
}

/**
 * Delivery metrics calculated after delivery completion
 */
export interface DeliveryMetrics {
  driverId: string;
  orderId: string;
  estimatedDeliveryTime: Date;
  actualDeliveryTime: Date;
  deliveryDurationMinutes: number;
  isOnTime: boolean;
  deliveryRating?: number;
  deliveryFeedback?: string;
  proofOfDeliveryUrl?: string;
}

/**
 * Billing record for this delivery
 */
export interface BillingRecord {
  transactionId: string;
  orderId: string;
  driverId: string;
  deliveryCharge: number;
  platformCommission: number;
  driverPayout: number;
  currency: string;
  status: string;
  transactionDate: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP-LEVEL INPUT/OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Step 1: validateDeliveryCompletion
 * Verifies order exists, status is appropriate, driver is assigned
 */
export interface ValidateDeliveryCompletionInput {
  orderId: string;
  driverId: string;
  shopId: string;
}

export interface ValidateDeliveryCompletionOutput {
  isValid: boolean;
  orderId: string;
  orderStatus: string;
  driverId: string;
  errors: string[];
  warnings: string[];
}

/**
 * Step 2: verifyProofOfDelivery
 * Validates at least one POD method and verifies data integrity
 */
export interface VerifyProofOfDeliveryInput {
  orderId: string;
  proofOfDelivery: ProofOfDelivery;
}

export interface VerifyProofOfDeliveryOutput {
  isValid: boolean;
  orderId: string;
  proofMethods: string[]; // ["photo", "signature", "code"]
  verificationDetails: {
    photoCount?: number;
    signaturePresent: boolean;
    codeValid?: boolean;
    locationCoordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  errors: string[];
}

/**
 * Step 3: updateDeliveryStatus
 * Updates order status to DELIVERED and records actual delivery time
 */
export interface UpdateDeliveryStatusInput {
  orderId: string;
  actualDeliveryTime: Date;
  recipientName?: string;
  deliveryNotes?: string;
}

export interface UpdateDeliveryStatusOutput {
  orderId: string;
  previousStatus: string;
  newStatus: string;
  statusUpdatedAt: Date;
  shipmentIds: string[];
}

/**
 * Step 4: updateDriverStatus
 * Decrements driver active deliveries, updates availability
 */
export interface UpdateDriverStatusInput {
  driverId: string;
  actualDeliveryTime: Date;
}

export interface UpdateDriverStatusOutput {
  driverId: string;
  previousStatus: string;
  newStatus: string;
  activeDeliveries: number;
  lastDeliveryTime: Date;
}

/**
 * Step 5: processDeliveryMetrics
 * Calculates delivery metrics and performance data
 */
export interface ProcessDeliveryMetricsInput {
  orderId: string;
  driverId: string;
  estimatedDeliveryTime: Date;
  actualDeliveryTime: Date;
  deliveryRating?: number;
  deliveryFeedback?: string;
}

export interface ProcessDeliveryMetricsOutput {
  orderId: string;
  driverId: string;
  deliveryDurationMinutes: number;
  isOnTime: boolean;
  onTimePercentage?: number;
  deliveryRating?: number;
  metricsRecordedAt: Date;
}

/**
 * Step 6: triggerBilling
 * Creates billing record for driver payout and platform fee
 */
export interface TriggerBillingInput {
  orderId: string;
  driverId: string;
  totalPrice: Decimal | number;
  actualDeliveryTime: Date;
}

export interface TriggerBillingOutput {
  transactionId: string;
  orderId: string;
  driverId: string;
  deliveryCharge: number;
  platformCommission: number;
  driverPayout: number;
  currency: string;
  billingStatus: string;
  transactionDate: Date;
}

/**
 * Step 7: updateInventory
 * Finalizes inventory deduction (move from reserved to fulfilled)
 */
export interface UpdateInventoryInput {
  orderId: string;
  shopId: string;
}

export interface UpdateInventoryOutput {
  orderId: string;
  itemsFullfilled: number;
  inventoryUpdatedAt: Date;
  reservationsClosed: number;
}

/**
 * Step 8: notifyCustomer
 * Sends delivery confirmation with POD details and rating request
 */
export interface NotifyCustomerInput {
  orderId: string;
  customerEmail: string;
  customerPhone: string;
  customerName: string;
  trackingToken: string;
  proofOfDeliveryUrl?: string;
  deliveryFeedback?: string;
}

export interface NotifyCustomerOutput {
  orderId: string;
  emailSent: boolean;
  smsSent: boolean;
  notificationsSentAt: Date;
}

/**
 * Step 9: notifyMerchant
 * Notifies merchant/shop that order was delivered
 */
export interface NotifyMerchantInput {
  orderId: string;
  shopId: string;
  driverId: string;
  actualDeliveryTime: Date;
}

export interface NotifyMerchantOutput {
  orderId: string;
  shopId: string;
  merchantNotificationSent: boolean;
  notificationsSentAt: Date;
}

/**
 * Step 10: archiveDeliveryData
 * Moves real-time tracking data to cold storage, cleans up temp files
 */
export interface ArchiveDeliveryDataInput {
  orderId: string;
  shopId: string;
}

export interface ArchiveDeliveryDataOutput {
  orderId: string;
  dataArchived: boolean;
  trackingDataMoved: boolean;
  tempFilesCleaned: boolean;
  archivedAt: Date;
}

/**
 * Step 11: emitDeliveryCompletedEvent
 * Emits event for analytics, reporting, webhooks
 */
export interface EmitDeliveryCompletedEventInput {
  orderId: string;
  driverId: string;
  shopId: string;
  actualDeliveryTime: Date;
  deliveryMetrics: DeliveryMetrics;
  billingRecord: BillingRecord;
}

export interface EmitDeliveryCompletedEventOutput {
  eventEmitted: boolean;
  eventType: string;
  subscriberCount: number;
  emittedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPENSATION TYPES (for rollback on failure)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compensation data for reverting steps on failure
 */
export interface CompensationContext {
  orderId?: string;
  previousOrderStatus?: string;
  previousDriverStatus?: string;
  billingTransactionId?: string;
  inventoriesToRelease?: Array<{
    orderId: string;
    shipmentId: string;
    items: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
    }>;
  }>;
}

export interface CompensationResult {
  stepName: string;
  compensated: boolean;
  error?: string;
  compensatedAt: Date;
}
