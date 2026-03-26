/**
 * Type definitions for the createDeliveryOrderWorkflow
 * Defines input/output types for each workflow step and overall orchestration
 */

type Decimal = number | string | { toString(): string };

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW INPUT & OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Main input for the createDeliveryOrderWorkflow.
 * Contains all required data to create a complete delivery order.
 */
export interface CreateDeliveryOrderInput {
  // Shop context
  shopId: string;
  userId: string;

  // Order identification (external platform agnostic)
  externalOrderId: string;
  externalOrderNumber?: string;

  // Customer information
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  // Pickup location (warehouse/store)
  pickupLocationId: string;

  // Delivery address
  deliveryAddressLine1: string;
  deliveryAddressLine2?: string;
  deliveryCity: string;
  deliveryProvince?: string;
  deliveryPostalCode: string;
  deliveryCountry: string;

  // Order items
  items: OrderItem[];

  // Delivery preferences
  preferredDeliveryDate?: Date;
  timeSlotId?: string;

  // Payment info
  totalPrice: Decimal | number;
  totalWeight: Decimal | number;

  // Additional metadata
  notes?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Order item in the delivery order
 */
export interface OrderItem {
  productId: string;
  variantId?: string;
  title: string;
  quantity: number;
  weight?: number;
  price?: Decimal | number;
}

/**
 * Main output of the createDeliveryOrderWorkflow.
 * Contains the created order and all enriched data.
 */
export interface CreateDeliveryOrderOutput {
  orderId: string;
  status: string;
  trackingToken: string;
  geocodedDeliveryLocation: GeocodeResult;
  shippingRate: CalculatedShippingRate;
  assignedZone: DeliveryZoneInfo;
  inventoryReservationId: string;
  confirmationSent: boolean;
  orderCreatedEvent: OrderCreatedEvent;
  totalDurationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP-LEVEL INPUT/OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Step 1: validateOrder
 * Validates all order inputs for completeness and correctness.
 */
export interface ValidateOrderInput {
  input: CreateDeliveryOrderInput;
}

export interface ValidateOrderOutput {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedInput: CreateDeliveryOrderInput;
}

/**
 * Step 2: geocodeAddresses
 * Geocodes pickup and delivery addresses using external geocoding service.
 */
export interface GeocodeAddressesInput {
  pickupLocationId: string;
  deliveryAddress: {
    line1: string;
    line2?: string;
    city: string;
    province?: string;
    postalCode: string;
    country: string;
  };
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  accuracy: string;
  formattedAddress: string;
  placeId?: string;
}

export interface GeocodeAddressesOutput {
  pickupCoordinates: GeocodeResult;
  deliveryCoordinates: GeocodeResult;
  distanceKm: number;
}

/**
 * Step 3: calculateShippingRate
 * Calculates shipping rate based on distance, weight, and zone.
 */
export interface CalculateShippingRateInput {
  distanceKm: number;
  totalWeight: number;
  deliveryCoordinates: GeocodeResult;
  shopId: string;
}

export interface CalculatedShippingRate {
  baseRate: number;
  distanceRate: number;
  weightRate: number;
  zoneMultiplier: number;
  subtotal: number;
  surcharges: Surcharge[];
  totalRate: number;
  estimatedDeliveryDays: number;
  currency: string;
}

export interface Surcharge {
  type: string;
  amount: number;
  description: string;
}

/**
 * Step 4: createOrderRecord
 * Creates the order in the database with all enriched data.
 */
export interface CreateOrderRecordInput {
  validatedInput: CreateDeliveryOrderInput;
  geocodedDeliveryLocation: GeocodeResult;
  shippingRate: CalculatedShippingRate;
}

export interface CreateOrderRecordOutput {
  orderId: string;
  trackingToken: string;
  createdAt: Date;
  status: string;
}

/**
 * Step 5: assignDeliveryZone
 * Determines the delivery zone based on coordinates and assigns to order.
 */
export interface AssignDeliveryZoneInput {
  orderId: string;
  deliveryCoordinates: GeocodeResult;
  shopId: string;
}

export interface DeliveryZoneInfo {
  zoneId: string;
  zoneName: string;
  baseRate: number;
  perKmRate: number;
  isRemoteArea: boolean;
}

export interface AssignDeliveryZoneOutput {
  orderId: string;
  assignedZone: DeliveryZoneInfo;
}

/**
 * Step 6: checkInventoryAvailability
 * Verifies that all order items are available at the pickup location.
 */
export interface CheckInventoryAvailabilityInput {
  locationId: string;
  items: OrderItem[];
  shopId: string;
}

export interface InventoryCheckResult {
  isAvailable: boolean;
  availableItems: {
    productId: string;
    variantId?: string;
    requestedQuantity: number;
    availableQuantity: number;
    isAvailable: boolean;
  }[];
  unavailableItems: string[];
}

export interface CheckInventoryAvailabilityOutput {
  inventoryCheck: InventoryCheckResult;
  canProceed: boolean;
}

/**
 * Step 7: reserveInventory
 * Reserves inventory for this order at the pickup location.
 */
export interface ReserveInventoryInput {
  locationId: string;
  orderId: string;
  items: OrderItem[];
  shopId: string;
}

export interface ReserveInventoryOutput {
  reservationId: string;
  orderId: string;
  reservedAt: Date;
  itemCount: number;
  expiresAt: Date;
}

/**
 * Step 8: sendOrderConfirmation
 * Sends order confirmation to customer via email/SMS.
 */
export interface SendOrderConfirmationInput {
  orderId: string;
  customerEmail: string;
  customerPhone: string;
  customerName: string;
  trackingToken: string;
  estimatedDeliveryDate: Date;
  totalPrice: number;
  shopId: string;
}

export interface SendOrderConfirmationOutput {
  confirmationEmailSent: boolean;
  confirmationSmsSent: boolean;
  sentAt: Date;
}

/**
 * Step 9: emitOrderCreatedEvent
 * Emits event for downstream consumers (analytics, webhooks, etc).
 */
export interface OrderCreatedEvent {
  orderId: string;
  shopId: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  totalPrice: number;
  itemCount: number;
  deliveryZoneId: string;
  estimatedDeliveryDate: Date;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface EmitOrderCreatedEventOutput {
  eventEmitted: boolean;
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
  reservationId?: string;
  zoneAssignmentId?: string;
  inventoryToRelease?: {
    locationId: string;
    items: OrderItem[];
  };
}

export interface CompensationResult {
  stepName: string;
  compensated: boolean;
  error?: string;
}
