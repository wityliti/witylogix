/**
 * Supply Chain Integration Types
 * Comprehensive type definitions for supply chain adapters supporting multiple WMS/TMS providers.
 * Includes warehouse management, inventory, orders, fulfillment, and logistics workflows.
 * @packageDocumentation
 */

/**
 * Supply chain provider configuration base
 * Supports authentication, endpoints, and feature flags for different providers
 */
export interface SupplyChainConfig {
  /** Unique provider identifier (e.g., 'manhattan', 'blue-yonder', 'korber') */
  provider:
    | "manhattan"
    | "blue-yonder"
    | "korber"
    | "deposco"
    | "extensiv"
    | "fishbowl";
  /** API key or OAuth2 client ID */
  apiKey?: string;
  /** OAuth2 client secret */
  clientSecret?: string;
  /** API base URL endpoint */
  baseUrl: string;
  /** OAuth2 token endpoint */
  tokenUrl?: string;
  /** Tenant/company identifier for multi-tenant systems */
  tenantId?: string;
  /** Warehouse identifier for WMS operations */
  warehouseId?: string;
  /** Feature flags for provider-specific capabilities */
  features?: {
    realTimeInventory?: boolean;
    waveManagement?: boolean;
    voiceDirectedWork?: boolean;
    roboticsIntegration?: boolean;
    returnProcessing?: boolean;
    demandPlanning?: boolean;
    manufacturingOrders?: boolean;
  };
  /** Timeout in milliseconds for API calls */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom headers for API requests */
  customHeaders?: Record<string, string>;
}

/**
 * Warehouse location information
 * Represents a physical warehouse or distribution center
 */
export interface WarehouseLocation {
  /** Unique warehouse identifier */
  id: string;
  /** Warehouse name */
  name: string;
  /** Warehouse code/abbreviation */
  code: string;
  /** Address information */
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  /** Geographical coordinates */
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  /** Warehouse type (distribution center, fulfillment center, etc.) */
  type: "dc" | "fc" | "return_center" | "manufacturing" | "cross_dock";
  /** Operational status */
  status: "active" | "inactive" | "maintenance" | "closed";
  /** Operating hours */
  operatingHours?: {
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
  }[];
  /** Capacity information */
  capacity?: {
    maxPallets: number;
    maxSkus: number;
    maxUnits: number;
  };
  /** Zone configuration for pick/pack/ship operations */
  zones?: string[];
  /** Contact information */
  contact?: {
    name: string;
    phone: string;
    email: string;
  };
  /** Custom attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Inventory item representing stock at a warehouse location
 * Tracks quantity, location, and status
 */
export interface InventoryItem {
  /** Unique inventory record identifier */
  id: string;
  /** Stock Keeping Unit identifier */
  sku: string;
  /** Warehouse location identifier */
  warehouseId: string;
  /** Physical location zone/bin */
  zone?: string;
  /** Bin/location code */
  binLocation?: string;
  /** Current quantity on hand */
  quantityOnHand: number;
  /** Quantity allocated to orders */
  quantityAllocated: number;
  /** Quantity available for new orders */
  quantityAvailable: number;
  /** Quantity in quality hold */
  quantityHold?: number;
  /** Product description */
  productName: string;
  /** Unit of measure */
  uom: string;
  /** Lot/batch number for traceability */
  lotNumber?: string;
  /** Serial number for serialized items */
  serialNumber?: string;
  /** Expiration date for perishables */
  expirationDate?: Date;
  /** Receiving timestamp */
  receivedDate: Date;
  /** Last inventory count date */
  countDate?: Date;
  /** Item status (available, hold, damaged, expired) */
  status: "available" | "hold" | "damaged" | "expired" | "in_transit";
  /** FIFO/LIFO designation */
  fifoSequence?: number;
  /** Reorder point threshold */
  reorderPoint?: number;
  /** Reorder quantity */
  reorderQuantity?: number;
  /** Cost per unit */
  unitCost?: number;
  /** Custom attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Inbound shipment from supplier or return
 * Tracks receiving and putaway workflow
 */
export interface InboundShipment {
  /** Unique shipment identifier */
  id: string;
  /** Shipment tracking number */
  trackingNumber: string;
  /** Destination warehouse ID */
  warehouseId: string;
  /** Supplier or origin identifier */
  supplierId?: string;
  /** Return/RMA number if applicable */
  rmaNumber?: string;
  /** Expected delivery date */
  expectedDeliveryDate: Date;
  /** Actual receipt date */
  receivedDate?: Date;
  /** Shipment status */
  status:
    | "in_transit"
    | "at_dock"
    | "received"
    | "quality_check"
    | "putaway_in_progress"
    | "closed";
  /** Shipment items with quantities */
  items: {
    sku: string;
    quantity: number;
    expectedQuantity?: number;
    receivedQuantity?: number;
    lotNumber?: string;
    expirationDate?: Date;
  }[];
  /** Dock door assignment */
  dockDoor?: string;
  /** Receiving user identifier */
  receivedBy?: string;
  /** Quality control notes */
  qualityNotes?: string;
  /** Variance explanation (for quantity mismatches) */
  varianceNotes?: string;
  /** Carrier information */
  carrier?: string;
  /** Bill of lading reference */
  bolNumber?: string;
  /** Total weight in pounds */
  weight?: number;
  /** Pallet count */
  palletCount?: number;
  /** Custom attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Outbound order for customer fulfillment
 * Represents a sales order or transfer order
 */
export interface OutboundOrder {
  /** Unique order identifier */
  id: string;
  /** Customer-facing order number */
  orderNumber: string;
  /** Order type (sales, transfer, return) */
  type: "sales" | "transfer" | "rma" | "sample";
  /** Source warehouse */
  sourceWarehouseId: string;
  /** Destination warehouse (for transfers) */
  destinationWarehouseId?: string;
  /** Customer/recipient identifier */
  customerId?: string;
  /** Ship-to address */
  shipToAddress?: {
    name: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  /** Order date */
  orderDate: Date;
  /** Required ship date */
  shipDate?: Date;
  /** Expected delivery date */
  deliveryDate?: Date;
  /** Order status */
  status:
    | "pending"
    | "allocated"
    | "picking"
    | "packing"
    | "shipped"
    | "cancelled"
    | "on_hold";
  /** Order priority (standard, expedited, overnight) */
  priority: "standard" | "expedited" | "overnight";
  /** Ordered items with quantities */
  items: {
    sku: string;
    quantity: number;
    allocatedQuantity?: number;
    pickedQuantity?: number;
    unitPrice?: number;
  }[];
  /** Fulfillment request ID when allocated */
  fulfillmentRequestId?: string;
  /** Wave identifier when assigned */
  waveId?: string;
  /** Shipping method */
  shippingMethod?: "ground" | "expedited" | "overnight" | "pickup";
  /** Carrier identifier */
  carrierId?: string;
  /** Special handling instructions */
  specialInstructions?: string;
  /** Custom attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Fulfillment request created from order allocation
 * Links order to warehouse operations
 */
export interface FulfillmentRequest {
  /** Unique fulfillment request ID */
  id: string;
  /** Associated outbound order ID */
  orderId: string;
  /** Source warehouse ID */
  warehouseId: string;
  /** Request creation timestamp */
  createdAt: Date;
  /** Fulfillment status */
  status: "pending" | "allocated" | "in_progress" | "completed" | "cancelled";
  /** Allocated items */
  allocations: {
    sku: string;
    requestedQuantity: number;
    allocatedQuantity: number;
    zone?: string;
    binLocation?: string;
  }[];
  /** Wave identifier when wave-planned */
  waveId?: string;
  /** Priority score (for sorting in wave) */
  priority?: number;
  /** Allocation method used */
  allocationMethod?: "fifo" | "closest" | "random" | "lifo";
  /** Notes on fulfillment */
  notes?: string;
  /** Custom attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Purchase order for inbound procurement
 * Tracks purchasing and receipt
 */
export interface PurchaseOrder {
  /** Unique purchase order ID */
  id: string;
  /** PO number for supplier reference */
  poNumber: string;
  /** Supplier/vendor identifier */
  supplierId: string;
  /** Destination warehouse */
  warehouseId: string;
  /** Creation date */
  createdDate: Date;
  /** Expected delivery date */
  expectedDeliveryDate: Date;
  /** Actual receipt date */
  receivedDate?: Date;
  /** PO status */
  status:
    | "draft"
    | "issued"
    | "acknowledged"
    | "in_transit"
    | "received"
    | "invoiced"
    | "closed";
  /** Ordered items */
  items: {
    sku: string;
    quantity: number;
    unitCost: number;
    lineNumber: number;
    lotNumber?: string;
    expirationDate?: Date;
  }[];
  /** Total PO value */
  totalValue?: number;
  /** Currency code */
  currency?: string;
  /** Shipping method */
  shippingMethod?: string;
  /** Carrier identifier */
  carrierId?: string;
  /** Tracking number */
  trackingNumber?: string;
  /** Acceptance status */
  acceptanceStatus?: "pending" | "accepted" | "rejected" | "conditional";
  /** Custom attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Transfer order between warehouses
 * Manages inter-warehouse stock movement
 */
export interface TransferOrder {
  /** Unique transfer order ID */
  id: string;
  /** Transfer order number */
  toNumber: string;
  /** Source warehouse */
  fromWarehouseId: string;
  /** Destination warehouse */
  toWarehouseId: string;
  /** Creation date */
  createdDate: Date;
  /** Expected delivery date */
  expectedDeliveryDate: Date;
  /** Actual receipt date */
  receivedDate?: Date;
  /** Transfer status */
  status: "pending" | "in_transit" | "received" | "cancelled";
  /** Transferred items */
  items: {
    sku: string;
    quantity: number;
    shippedQuantity?: number;
    receivedQuantity?: number;
  }[];
  /** Reason for transfer */
  reason?: string;
  /** Transit method */
  transitMethod?: "ltl" | "truckload" | "parcel" | "courier";
  /** Carrier */
  carrier?: string;
  /** Tracking number */
  trackingNumber?: string;
  /** Custom attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Receipt confirmation document
 * Generated when inbound shipment is received
 */
export interface ReceiptConfirmation {
  /** Unique receipt confirmation ID */
  id: string;
  /** Associated inbound shipment ID */
  shipmentId: string;
  /** Receiving warehouse */
  warehouseId: string;
  /** Receipt date */
  receiptDate: Date;
  /** Receiving user */
  receivedBy: string;
  /** Receipt status */
  status:
    | "pending_qc"
    | "qc_passed"
    | "qc_failed"
    | "partial_receipt"
    | "completed";
  /** Received items with actual quantities */
  items: {
    sku: string;
    expectedQuantity: number;
    receivedQuantity: number;
    discrepancies?: string;
    lotNumber?: string;
  }[];
  /** Quality control result */
  qcStatus?: "pass" | "fail" | "conditional";
  /** QC notes */
  qcNotes?: string;
  /** Damage report */
  damageReport?: string;
  /** Putaway flag */
  putawayCompleted?: boolean;
  /** Custom attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Wave definition for batch fulfillment
 * Groups multiple orders for efficient picking
 */
export interface WaveDefinition {
  /** Unique wave identifier */
  id: string;
  /** Wave number for tracking */
  waveNumber: string;
  /** Source warehouse */
  warehouseId: string;
  /** Wave creation timestamp */
  createdAt: Date;
  /** Wave status */
  status: "planned" | "released" | "in_progress" | "completed" | "cancelled";
  /** Associated fulfillment request IDs */
  fulfillmentRequestIds: string[];
  /** Planned pick start time */
  pickStartTime?: Date;
  /** Actual pick start time */
  pickActualStart?: Date;
  /** Planned pick completion time */
  pickEndTime?: Date;
  /** Actual pick completion time */
  pickActualEnd?: Date;
  /** Pick method (zone, batch, order) */
  pickMethod?: "zone" | "batch" | "order" | "cluster";
  /** Zones included in wave */
  zones?: string[];
  /** Wave priority */
  priority?: number;
  /** Total orders in wave */
  orderCount?: number;
  /** Total units to pick */
  unitCount?: number;
  /** Planned pick path optimization */
  pickPath?: string[];
  /** Custom attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Pick task assigned to warehouse worker
 * Individual unit for picking operation
 */
export interface PickTask {
  /** Unique pick task ID */
  id: string;
  /** Associated wave ID */
  waveId: string;
  /** Source bin location */
  fromBinLocation: string;
  /** Zone identifier */
  zone: string;
  /** SKU to pick */
  sku: string;
  /** Quantity to pick */
  quantity: number;
  /** Picked quantity */
  pickedQuantity?: number;
  /** Destination sort location or pack station */
  toBinLocation?: string;
  /** Associated fulfillment request ID */
  fulfillmentRequestId?: string;
  /** Associated order ID */
  orderId?: string;
  /** Task status */
  status:
    | "pending"
    | "assigned"
    | "in_progress"
    | "completed"
    | "skipped"
    | "exception";
  /** Assigned worker user ID */
  assignedWorker?: string;
  /** Assignment timestamp */
  assignedAt?: Date;
  /** Completion timestamp */
  completedAt?: Date;
  /** Exception reason if applicable */
  exceptionReason?: string;
  /** Voice/RF device tracking */
  deviceId?: string;
  /** Custom attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Pack station for consolidation
 * Physical station where items are packed into shipments
 */
export interface PackStation {
  /** Unique pack station ID */
  id: string;
  /** Station name/identifier */
  name: string;
  /** Warehouse location */
  warehouseId: string;
  /** Zone/area within warehouse */
  zone: string;
  /** Physical location code */
  location: string;
  /** Station type (manual, semi-automated, automated) */
  type: "manual" | "semi_auto" | "auto";
  /** Current status */
  status: "active" | "inactive" | "maintenance";
  /** Active work order/shipment */
  activeShipmentId?: string;
  /** Capacity in units per hour */
  capacity?: number;
  /** Assigned workers */
  workers?: string[];
  /** Packing method (individual, batch, case) */
  packingMethod?: "individual" | "batch" | "case" | "wave";
  /** Scales available */
  scalesAvailable?: boolean;
  /** Printer count */
  printerCount?: number;
  /** Custom attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Ship confirmation document
 * Generated when shipment leaves warehouse
 */
export interface ShipConfirmation {
  /** Unique ship confirmation ID */
  id: string;
  /** Associated order ID */
  orderId: string;
  /** Associated shipment number */
  shipmentNumber: string;
  /** Warehouse shipped from */
  warehouseId: string;
  /** Ship date */
  shipDate: Date;
  /** Shipped items */
  items: {
    sku: string;
    quantity: number;
    lotNumber?: string;
    serialNumber?: string;
  }[];
  /** Carrier code */
  carrier: string;
  /** Carrier service level */
  serviceLevel?: "ground" | "expedited" | "overnight" | "international";
  /** Tracking number */
  trackingNumber?: string;
  /** Weight */
  weight?: number;
  /** Dimensions */
  dimensions?: {
    length: number;
    width: number;
    height: number;
    uom: string;
  };
  /** Package count */
  packageCount?: number;
  /** Ship-to address validated flag */
  addressValidated?: boolean;
  /** Carrier manifest number */
  manifestNumber?: string;
  /** Custom attributes */
  attributes?: Record<string, unknown>;
}
