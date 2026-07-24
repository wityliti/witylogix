/**
 * POS (Point of Sale) Integration Types
 * Standardized types for restaurant and retail POS operations
 */

/**
 * Order status enumeration
 */
export type OrderStatus =
  | "open"
  | "in_progress"
  | "ready"
  | "completed"
  | "voided"
  | "cancelled";

/**
 * Order type enumeration
 */
export type OrderType = "dine-in" | "takeout" | "delivery";

/**
 * Payment method enumeration
 */
export type POSPaymentMethod =
  | "cash"
  | "card"
  | "mobile"
  | "check"
  | "gift_card";

/**
 * Kitchen display order status
 */
export type KitchenOrderStatus =
  | "new"
  | "received"
  | "in_progress"
  | "ready"
  | "completed";

/**
 * Labor shift status
 */
export type ShiftStatus = "open" | "closed" | "break" | "off_duty";

/**
 * POS location entity
 */
export interface POSLocation {
  id: string;
  externalId: string; // Provider's location ID
  providerId: string;
  name: string;
  address: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  phone?: string;
  email?: string;
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * POS terminal entity
 */
export interface POSTerminal {
  id: string;
  externalId: string;
  providerId: string;
  locationId: string;
  name: string;
  terminalId: string;
  hardwareType?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Menu category
 */
export interface POSCategory {
  id: string;
  externalId: string;
  providerId: string;
  locationId: string;
  name: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Menu modifier group (customizations)
 */
export interface POSModifier {
  id: string;
  externalId: string;
  providerId: string;
  categoryId: string;
  groupId?: string;
  name: string;
  price: number; // In cents
  currency: string;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Menu item
 */
export interface POSMenuItem {
  id: string;
  externalId: string;
  providerId: string;
  locationId: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number; // In cents
  currency: string;
  cost?: number; // In cents (for profitability)
  taxable: boolean;
  discountable: boolean;
  modifiers: POSModifier[];
  imageUrl?: string;
  sku?: string;
  barcode?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Order line item
 */
export interface POSOrderLineItem {
  id: string;
  externalId?: string;
  menuItemId: string;
  quantity: number;
  price: number; // In cents
  subtotal: number; // In cents (price * quantity)
  modifiers?: Array<{
    modifierId: string;
    price: number; // In cents
  }>;
  notes?: string;
  kitchenStatus?: KitchenOrderStatus;
}

/**
 * Order discount
 */
export interface POSDiscount {
  id: string;
  type: "fixed" | "percentage";
  amount: number; // In cents or percentage points
  reason?: string;
  appliedBy?: string;
}

/**
 * Order payment
 */
export interface POSPayment {
  id: string;
  method: POSPaymentMethod;
  amount: number; // In cents
  currency: string;
  transactionId?: string;
  tip?: number; // In cents
  createdAt: Date;
}

/**
 * POS order entity
 */
export interface POSOrder {
  id: string;
  externalId: string; // Provider's order ID
  providerId: string;
  locationId: string;
  terminalId?: string;
  orderNumber: string;
  status: OrderStatus;
  orderType: OrderType;
  tableNumber?: string;
  partySize?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  lineItems: POSOrderLineItem[];
  discounts: POSDiscount[];
  payments: POSPayment[];
  subtotal: number; // In cents
  tax: number; // In cents
  total: number; // In cents
  notes?: string;
  metadata?: Record<string, any>;
  kitchenDisplayItems?: Array<{
    id: string;
    lineItemId: string;
    status: KitchenOrderStatus;
    startedAt?: Date;
    completedAt?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * Employee
 */
export interface POSEmployee {
  id: string;
  externalId: string;
  providerId: string;
  locationId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  pin?: string;
  role: string;
  permissions?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Shift
 */
export interface POSShift {
  id: string;
  externalId: string;
  providerId: string;
  locationId: string;
  terminalId?: string;
  employeeId: string;
  startTime: Date;
  endTime?: Date;
  status: ShiftStatus;
  breakTime?: number; // In minutes
  cashDrawerOpeningAmount?: number; // In cents
  cashDrawerClosingAmount?: number; // In cents
  salesAmount?: number; // In cents
  discountsAmount?: number; // In cents
  refundsAmount?: number; // In cents
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Revenue center (dining area)
 */
export interface POSRevenueCenter {
  id: string;
  externalId: string;
  providerId: string;
  locationId: string;
  name: string;
  type: "bar" | "dining_room" | "patio" | "private_event" | "other";
  tableCount?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Dining option (dine-in, takeout, delivery)
 */
export interface POSDiningOption {
  id: string;
  externalId: string;
  providerId: string;
  locationId: string;
  name: string;
  type: OrderType;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * POS configuration
 */
export interface POSConfig {
  providerId: string;
  provider:
    | "toast"
    | "square"
    | "clover"
    | "lightspeed"
    | "toast-pos"
    | "square-restaurants";
  credentials: {
    apiKey?: string;
    apiSecret?: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    accountId?: string;
    merchantId?: string;
    locationId?: string;
    environment: "sandbox" | "production";
  };
  webhookSecret?: string;
  webhookUrl?: string;
  features: {
    supportsOnlineOrdering: boolean;
    supportsLaborManagement: boolean;
    supportsInventoryManagement: boolean;
    supportsCustomers: boolean;
    supportsGiftCards: boolean;
    supportsSubscriptions: boolean;
    supportsKitchenDisplay: boolean;
    supportsDelivery: boolean;
  };
  rateLimit: {
    requestsPerSecond: number;
    burstSize: number;
  };
  retryPolicy: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
}

/**
 * POS webhook event
 */
export interface POSWebhookEvent {
  id: string;
  providerId: string;
  provider: string;
  eventType: string;
  resourceType:
    | "order"
    | "payment"
    | "employee"
    | "shift"
    | "menu"
    | "inventory";
  resourceId: string;
  data: Record<string, any>;
  timestamp: Date;
  signature?: string;
  verified: boolean;
  retryCount: number;
  lastRetryAt?: Date;
  processingError?: string;
}

/**
 * POS adapter interface
 */
export interface POSAdapterInterface {
  /**
   * Get location details
   */
  getLocation(locationId: string): Promise<POSLocation>;

  /**
   * List locations
   */
  listLocations(): Promise<POSLocation[]>;

  /**
   * Get menu items
   */
  getMenuItems(locationId: string, categoryId?: string): Promise<POSMenuItem[]>;

  /**
   * Sync menu (full refresh)
   */
  syncMenu(locationId: string): Promise<void>;

  /**
   * Create order
   */
  createOrder(locationId: string, order: Partial<POSOrder>): Promise<POSOrder>;

  /**
   * Get order details
   */
  getOrder(locationId: string, orderId: string): Promise<POSOrder>;

  /**
   * List orders
   */
  listOrders(
    locationId: string,
    filters?: { startDate?: Date; endDate?: Date; status?: OrderStatus },
  ): Promise<POSOrder[]>;

  /**
   * Update order
   */
  updateOrder(
    locationId: string,
    orderId: string,
    updates: Partial<POSOrder>,
  ): Promise<POSOrder>;

  /**
   * Add payment to order
   */
  addPayment(
    locationId: string,
    orderId: string,
    payment: Partial<POSPayment>,
  ): Promise<POSPayment>;

  /**
   * Void order
   */
  voidOrder(
    locationId: string,
    orderId: string,
    reason?: string,
  ): Promise<POSOrder>;

  /**
   * Send order to kitchen display
   */
  sendToKitchen(locationId: string, orderId: string): Promise<void>;

  /**
   * Get kitchen display status
   */
  getKitchenDisplayStatus(
    locationId: string,
    orderId: string,
  ): Promise<KitchenOrderStatus>;

  /**
   * List employees
   */
  listEmployees(locationId: string): Promise<POSEmployee[]>;

  /**
   * Create shift
   */
  createShift(locationId: string, shift: Partial<POSShift>): Promise<POSShift>;

  /**
   * Close shift
   */
  closeShift(locationId: string, shiftId: string): Promise<POSShift>;

  /**
   * Get revenue center details
   */
  getRevenueCenter(
    locationId: string,
    revenueCenterId: string,
  ): Promise<POSRevenueCenter>;

  /**
   * List revenue centers
   */
  listRevenueCenters(locationId: string): Promise<POSRevenueCenter[]>;

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean;

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: Record<string, any>): POSWebhookEvent | null;
}

/**
 * Menu sync options
 */
export interface MenuSyncOptions {
  fullRefresh?: boolean;
  includeModifiers?: boolean;
  includeImages?: boolean;
}

/**
 * Order filters
 */
export interface OrderFilters {
  locationId: string;
  startDate?: Date;
  endDate?: Date;
  status?: OrderStatus;
  orderType?: OrderType;
  minAmount?: number; // In cents
  maxAmount?: number; // In cents
  customerId?: string;
}
