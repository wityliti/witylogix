/**
 * Supply Chain SDK v2 Type Definitions
 *
 * Unified types for Manhattan Active WMS, Blue Yonder Luminate, and other supply chain platforms.
 * Provides normalized interfaces for inventory, orders, waves, shipments, and warehouse operations.
 */

// ─── WAREHOUSE TYPES ────────────────────────────────────────────────

/**
 * Normalized warehouse structure.
 */
export interface NormalizedWarehouse {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: "active" | "inactive" | "planned" | "closed";
  type: "distribution" | "fulfillment" | "cross_dock" | "returns" | "pick_pack";
  address: WarehouseAddress;
  timezone?: string;
  operatingHours?: OperatingHours;
  capacity?: WarehouseCapacity;
  equipment?: WarehouseEquipment[];
  contact?: WarehouseContact;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

/**
 * Warehouse address.
 */
export interface WarehouseAddress {
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Operating hours.
 */
export interface OperatingHours {
  monday?: TimeRange;
  tuesday?: TimeRange;
  wednesday?: TimeRange;
  thursday?: TimeRange;
  friday?: TimeRange;
  saturday?: TimeRange;
  sunday?: TimeRange;
  holidays?: Date[];
}

/**
 * Time range.
 */
export interface TimeRange {
  open: string; // HH:mm
  close: string; // HH:mm
}

/**
 * Warehouse capacity.
 */
export interface WarehouseCapacity {
  totalSqft: number;
  usedSqft: number;
  availableSqft: number;
  palletCapacity: number;
  usedPalletCapacity: number;
}

/**
 * Warehouse equipment.
 */
export interface WarehouseEquipment {
  id: string;
  type: "rack" | "conveyor" | "sorter" | "wcs" | "forklift" | "scanner";
  name: string;
  quantity: number;
  status: "active" | "maintenance" | "decommissioned";
}

/**
 * Warehouse contact.
 */
export interface WarehouseContact {
  name: string;
  email?: string;
  phone?: string;
  title?: string;
}

// ─── INVENTORY TYPES ────────────────────────────────────────────────

/**
 * Normalized inventory structure.
 */
export interface NormalizedInventory {
  id: string;
  warehouseId: string;
  skuId: string;
  skuCode: string;
  description?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  onOrderQuantity: number;
  locationId?: string;
  lotNumber?: string;
  serialNumber?: string;
  expiryDate?: Date;
  receivedDate: Date;
  lastMovedDate?: Date;
  unitOfMeasure: string;
  cost?: number;
  velocity?: "fast" | "medium" | "slow";
  damageFlag?: boolean;
  holdFlag?: boolean;
  tags?: string[];
}

/**
 * Inventory location.
 */
export interface InventoryLocation {
  id: string;
  warehouseId: string;
  zone: string;
  aisle: string;
  level: string;
  position: string;
  locationType:
    | "storage"
    | "pick"
    | "pack"
    | "staging"
    | "overstock"
    | "damaged";
  capacity: number;
  currentQuantity: number;
  lastCountDate?: Date;
  isActive: boolean;
}

/**
 * Inventory adjustment.
 */
export interface InventoryAdjustment {
  id: string;
  warehouseId: string;
  skuId: string;
  locationId?: string;
  adjustmentType:
    | "physical_count"
    | "damage"
    | "loss"
    | "transfer"
    | "correction"
    | "return";
  quantityBefore: number;
  quantityAfter: number;
  reason: string;
  createdBy: string;
  createdAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
}

/**
 * Inventory transfer.
 */
export interface InventoryTransfer {
  id: string;
  fromWarehouseId: string;
  fromLocationId?: string;
  toWarehouseId: string;
  toLocationId?: string;
  skuId: string;
  quantity: number;
  status: "pending" | "in_transit" | "completed" | "cancelled";
  createdAt: Date;
  shippedAt?: Date;
  receivedAt?: Date;
  shipmentId?: string;
}

/**
 * Cycle count.
 */
export interface CycleCount {
  id: string;
  warehouseId: string;
  locationId?: string;
  status: "planned" | "in_progress" | "completed" | "variance_found";
  countType: "full" | "zone" | "location" | "sku";
  plannedStartDate: Date;
  actualStartDate?: Date;
  completedDate?: Date;
  plannedEndDate?: Date;
  variance?: number;
  variancePercent?: number;
  notes?: string;
}

// ─── ORDER TYPES ────────────────────────────────────────────────────

/**
 * Normalized order structure.
 */
export interface NormalizedOrder {
  id: string;
  orderNumber: string;
  orderDate: Date;
  status: OrderStatus;
  source: "ecommerce" | "wholesale" | "retail" | "marketplace" | "manual";
  customer: Customer;
  shippingAddress: ShippingAddress;
  billingAddress?: ShippingAddress;
  lines: OrderLine[];
  subtotal: number;
  tax?: number;
  shipping?: number;
  total: number;
  currency: string;
  shipMethod?: string;
  trackingNumber?: string;
  priority?: "standard" | "expedited" | "overnight";
  notes?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Order status types.
 */
export type OrderStatus =
  | "pending"
  | "acknowledged"
  | "allocated"
  | "picked"
  | "packed"
  | "shipped"
  | "delivered"
  | "returned"
  | "cancelled";

/**
 * Customer information.
 */
export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  customerNumber?: string;
}

/**
 * Shipping address.
 */
export interface ShippingAddress {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
}

/**
 * Order line.
 */
export interface OrderLine {
  id: string;
  skuId: string;
  skuCode: string;
  description?: string;
  quantity: number;
  qtyAllocated?: number;
  qtyPicked?: number;
  qtyPacked?: number;
  qtyShipped?: number;
  unitPrice: number;
  lineTotal: number;
  details?: Record<string, unknown>;
}

/**
 * Return authorization.
 */
export interface ReturnAuthorization {
  id: string;
  raNumber: string;
  orderId: string;
  orderNumber: string;
  status: "open" | "in_transit" | "received" | "processed" | "closed";
  returnDate: Date;
  receiveDate?: Date;
  lines: ReturnLine[];
  reason?: string;
  condition?: "new" | "unopened" | "used" | "damaged" | "defective";
  refundStatus?: "pending" | "approved" | "processed";
}

/**
 * Return line item.
 */
export interface ReturnLine {
  id: string;
  skuId: string;
  quantity: number;
  reason: string;
  condition?: string;
  notes?: string;
}

// ─── WAVE TYPES ─────────────────────────────────────────────────────

/**
 * Normalized wave structure.
 */
export interface NormalizedWave {
  id: string;
  waveNumber: string;
  warehouseId: string;
  status: WaveStatus;
  planDate: Date;
  releaseDate?: Date;
  completeDate?: Date;
  orders: string[]; // order IDs
  orderCount: number;
  lineCount: number;
  priority?: "low" | "medium" | "high" | "urgent";
  shipMethod?: string;
  carrier?: string;
  loadNumber?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Wave status types.
 */
export type WaveStatus =
  | "planned"
  | "allocated"
  | "pick_in_progress"
  | "pick_complete"
  | "pack_in_progress"
  | "pack_complete"
  | "ready_to_ship"
  | "shipped"
  | "completed";

/**
 * Wave plan configuration.
 */
export interface WavePlanConfig {
  waveType: "order" | "time" | "route" | "shipment" | "combined";
  maxOrdersPerWave?: number;
  maxLinesPerWave?: number;
  maxPalletCount?: number;
  consolidateByShipping?: boolean;
  priorityRules?: string[];
  timeBasedFrequency?: "hourly" | "twice_daily" | "daily" | "custom";
}

// ─── SHIPMENT TYPES ─────────────────────────────────────────────────

/**
 * Normalized shipment structure.
 */
export interface NormalizedShipment {
  id: string;
  shipmentNumber: string;
  warehouseId: string;
  status: ShipmentStatus;
  waveId?: string;
  orders: string[]; // order IDs
  lines: ShipmentLine[];
  createdAt: Date;
  pickedAt?: Date;
  packedAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  carrier?: string;
  trackingNumber?: string;
  scac?: string; // Standard Carrier Alpha Code
  weight?: number;
  weightUnit?: "lb" | "kg";
  dimensions?: ShipmentDimensions;
  palletCount?: number;
  cost?: number;
  signature?: boolean;
  insurance?: number;
  notes?: string;
  tags?: string[];
}

/**
 * Shipment status types.
 */
export type ShipmentStatus =
  | "planned"
  | "picked"
  | "packed"
  | "manifested"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "cancelled";

/**
 * Shipment line item.
 */
export interface ShipmentLine {
  id: string;
  skuId: string;
  skuCode: string;
  quantity: number;
  serialNumbers?: string[];
  lotNumbers?: string[];
}

/**
 * Shipment dimensions.
 */
export interface ShipmentDimensions {
  length: number;
  width: number;
  height: number;
  unit: "in" | "cm";
}

// ─── DEMAND & FORECAST TYPES ────────────────────────────────────────

/**
 * Demand forecast.
 */
export interface DemandForecast {
  id: string;
  skuId: string;
  warehouseId?: string;
  forecastDate: Date;
  forecastPeriod: "daily" | "weekly" | "monthly";
  forecastQuantity: number;
  confidence?: number; // 0-100
  seasonalFactor?: number;
  trendFactor?: number;
  promotionalLift?: number;
  method: "statistical" | "ai" | "manual" | "hybrid";
  notes?: string;
  createdAt: Date;
}

/**
 * Replenishment recommendation.
 */
export interface ReplenishmentRecommendation {
  id: string;
  skuId: string;
  warehouseId: string;
  currentStock: number;
  safetyStock: number;
  recommendedQuantity: number;
  recommendedDate: Date;
  priority: "low" | "medium" | "high" | "critical";
  reason: string;
  leadTime: number; // days
  supplierSuggestedQuantity?: number;
}

// ─── WMS CONFIG TYPES ───────────────────────────────────────────────

/**
 * WMS configuration.
 */
export interface WMSConfig {
  warehouseId: string;
  enablePutaway: boolean;
  enablePickOptimization: boolean;
  enableWaveManagement: boolean;
  enableLaborTracking: boolean;
  enableSlotting: boolean;
  enableYardManagement: boolean;
  enableQualityChecks: boolean;
  pickingStrategy: "batch" | "wave" | "single_order";
  packingStrategy: "case_pack" | "each" | "custom";
  sortingStrategy: "by_destination" | "by_carrier" | "by_shipment";
  receiptLocationRule: "directed" | "user_directed" | "default";
  putawayLocationRule: "directed" | "user_directed" | "random";
  defaultBinSize?: "pallet" | "case" | "each";
}

// ─── LABOR & MANAGEMENT TYPES ───────────────────────────────────────

/**
 * Labor transaction.
 */
export interface LaborTransaction {
  id: string;
  employeeId: string;
  employeeName: string;
  warehouseId: string;
  activityType:
    | "receiving"
    | "putaway"
    | "picking"
    | "packing"
    | "shipping"
    | "counting"
    | "management";
  startTime: Date;
  endTime?: Date;
  durationMinutes?: number;
  quantity?: number;
  lines?: number;
  taskId?: string;
  efficiency?: number; // percentage
  notes?: string;
}

/**
 * Labor standard.
 */
export interface LaborStandard {
  id: string;
  activityType: string;
  method: "per_unit" | "per_line" | "per_transaction" | "per_hour";
  standardTime: number; // seconds
  warehouseId?: string;
  effectiveDate: Date;
  notes?: string;
}

// ─── SLOTTING TYPES ─────────────────────────────────────────────────

/**
 * Slotting recommendation.
 */
export interface SlottingRecommendation {
  id: string;
  warehouseId: string;
  skuId: string;
  recommendedLocationId: string;
  currentLocationId?: string;
  reason:
    | "velocity"
    | "aisle_balance"
    | "light_travel"
    | "proximity"
    | "weight";
  expectedProductivityGain?: number; // percentage
  priority: "low" | "medium" | "high";
  createdAt: Date;
}

// ─── YARD MANAGEMENT TYPES ──────────────────────────────────────────

/**
 * Dock door.
 */
export interface DockDoor {
  id: string;
  warehouseId: string;
  doorNumber: string;
  type: "inbound" | "outbound" | "cross_dock" | "shipping";
  status: "available" | "occupied" | "reserved" | "maintenance";
  currentActivity?: string;
  occupiedUntil?: Date;
  equipment?: string[];
}

/**
 * Appointment.
 */
export interface Appointment {
  id: string;
  warehouseId: string;
  appointmentNumber: string;
  carrierName: string;
  appointmentType: "inbound" | "outbound" | "pickup" | "return";
  scheduledDate: Date;
  scheduledStartTime: string; // HH:mm
  scheduledEndTime: string; // HH:mm
  actualArrivalTime?: string;
  actualDepartureTime?: string;
  dockDoorId?: string;
  shipmentCount?: number;
  palletCount?: number;
  status: "confirmed" | "check_in" | "in_progress" | "completed" | "cancelled";
  notes?: string;
}

// ─── AUTOMATION TYPES ───────────────────────────────────────────────

/**
 * Workflow automation rule.
 */
export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  triggers: AutomationTrigger[];
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Automation trigger.
 */
export interface AutomationTrigger {
  type: "event" | "schedule" | "threshold";
  eventType?: string;
  schedule?: string; // cron
  threshold?: number;
}

/**
 * Automation condition.
 */
export interface AutomationCondition {
  field: string;
  operator:
    | "equals"
    | "not_equals"
    | "greater_than"
    | "less_than"
    | "contains"
    | "in";
  value: unknown;
}

/**
 * Automation action.
 */
export interface AutomationAction {
  type: "notify" | "create" | "update" | "execute" | "send";
  target: string;
  payload?: Record<string, unknown>;
}

// ─── WEBHOOK TYPES ──────────────────────────────────────────────────

/**
 * Supply chain webhook event types.
 */
export type SCWebhookEventType =
  | "order.created"
  | "order.updated"
  | "order.shipped"
  | "shipment.created"
  | "shipment.shipped"
  | "shipment.delivered"
  | "inventory.adjusted"
  | "inventory.low"
  | "wave.created"
  | "wave.released"
  | "wave.completed"
  | "appointment.confirmed"
  | "forecast.updated"
  | "exception.raised";

/**
 * Supply chain webhook configuration.
 */
export interface SCWebhookConfig {
  id: string;
  url: string;
  events: SCWebhookEventType[];
  active: boolean;
  secret?: string;
  headers?: Record<string, string>;
  retryPolicy?: RetryPolicy;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Supply chain webhook payload.
 */
export interface SCWebhookPayload {
  id: string;
  timestamp: Date;
  eventType: SCWebhookEventType;
  resourceId: string;
  resourceType:
    | "order"
    | "shipment"
    | "inventory"
    | "wave"
    | "appointment"
    | "forecast";
  data: Record<string, unknown>;
  source?: string;
}

// ─── RETRY POLICY ───────────────────────────────────────────────────

/**
 * Retry policy for webhooks.
 */
export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

// ─── ERROR TYPES ────────────────────────────────────────────────────

/**
 * Supply chain SDK error.
 */
export interface SupplyChainSDKError extends Error {
  code: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  retryable: boolean;
}

// ─── RATE LIMIT TYPES ───────────────────────────────────────────────

/**
 * Rate limit information.
 */
export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}

// ─── COMMON TYPES ───────────────────────────────────────────────────

/**
 * Paginated response.
 */
export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageSize: number;
  pageNumber: number;
  hasMore: boolean;
}

/**
 * Health check result.
 */
export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  responseTimeMs: number;
  details?: Record<string, unknown>;
}
