/**
 * Unified POS SDK Types
 * Comprehensive types for Toast v2, Square v2, Clover, and Lightspeed integrations
 */

/**
 * Toast v2 API Types
 */
export namespace ToastV2 {
  export interface Config {
    environment: 'sandbox' | 'production';
    clientId: string;
    clientSecret: string;
    restaurantGuid?: string;
    accessToken?: string;
    refreshToken?: string;
  }

  export interface OAuthTokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }

  export interface Check {
    guid: string;
    checkNumber: string;
    status: 'open' | 'closed' | 'voided';
    locationGuid: string;
    tab: {
      lineItems: CheckLineItem[];
      discounts: Discount[];
      subtotal: number;
      tax: number;
      total: number;
    };
    payments: Payment[];
    tableName?: string;
    partySize?: number;
    createdTime: number;
    modifiedTime?: number;
  }

  export interface CheckLineItem {
    guid: string;
    itemGuid: string;
    name: string;
    quantity: number;
    unitPrice: number;
    modifiers: ModifierInstance[];
    specialInstructions?: string;
  }

  export interface ModifierInstance {
    guid: string;
    modifierGroupGuid: string;
    name: string;
    price: number;
  }

  export interface MenuItem {
    guid: string;
    name: string;
    description?: string;
    price: number;
    cost?: number;
    categoryGuid: string;
    taxable: boolean;
    discountable: boolean;
    modifiers: Modifier[];
    sku?: string;
    barcode?: string;
    deleted: boolean;
    createdTime: number;
  }

  export interface MenuCategory {
    guid: string;
    name: string;
    sortOrder: number;
    deleted: boolean;
  }

  export interface ModifierGroup {
    guid: string;
    name: string;
    minChoices: number;
    maxChoices: number;
    deleted: boolean;
  }

  export interface Modifier {
    guid: string;
    groupGuid: string;
    name: string;
    price: number;
    deleted: boolean;
  }

  export interface Discount {
    guid?: string;
    name: string;
    type: 'FIXED' | 'PERCENTAGE';
    amount: number;
  }

  export interface Payment {
    guid: string;
    type: 'CASH' | 'CARD' | 'CHECK' | 'GIFT_CARD' | 'THIRD_PARTY_DELIVERY';
    amount: number;
    tip?: number;
    cardPresent: boolean;
    last4?: string;
    createdTime: number;
  }

  export interface Employee {
    guid: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    pin?: string;
    role: string;
    deleted: boolean;
    createdTime: number;
  }

  export interface Shift {
    guid: string;
    employeeGuid: string;
    locationGuid: string;
    startTime: number;
    endTime?: number;
    status: 'open' | 'closed';
    createdTime: number;
  }

  export interface RevenueCenter {
    guid: string;
    name: string;
    type: string;
    deleted: boolean;
    createdTime: number;
  }

  export interface DaypartPricing {
    guid: string;
    name: string;
    price: number;
    daypart: string;
    deleted: boolean;
  }

  export interface SalesReport {
    locationGuid: string;
    startTime: number;
    endTime: number;
    grossSales: number;
    netSales: number;
    voidAmount: number;
    discountAmount: number;
    taxAmount: number;
    paymentMethodBreakdown: Record<string, number>;
  }

  export interface LaborReport {
    employeeGuid: string;
    totalHours: number;
    laborCost: number;
    laborCostPercentage: number;
    shifts: Shift[];
  }

  export interface WebhookEvent {
    id: string;
    type: string;
    entityType: string;
    entityId: string;
    timestamp: number;
    resourceUrl: string;
  }
}

/**
 * Square API v2 Types
 */
export namespace SquareV2 {
  export interface Config {
    environment: 'sandbox' | 'production';
    accessToken: string;
    locationId?: string;
  }

  export interface Order {
    id: string;
    locationId: string;
    referenceId?: string;
    customerId?: string;
    lineItems: OrderLineItem[];
    taxes: OrderTax[];
    discounts: OrderDiscount[];
    serviceCharges: ServiceCharge[];
    payments: Payment[];
    totalTaxAmount?: Money;
    totalDiscountAmount?: Money;
    totalTipAmount?: Money;
    totalAmount?: Money;
    createdAt: string;
    updatedAt: string;
    state?: 'OPEN' | 'COMPLETED' | 'CANCELED';
  }

  export interface OrderLineItem {
    uid?: string;
    name: string;
    quantity: string;
    catalogObjectId?: string;
    itemType: 'ITEM' | 'CUSTOM_AMOUNT';
    note?: string;
    basePriceMoney?: Money;
    grossSalesMoney?: Money;
    totalTaxMoney?: Money;
    totalDiscountMoney?: Money;
    totalMoney?: Money;
    appliedTaxes?: OrderLineItemAppliedTax[];
    appliedDiscounts?: OrderLineItemAppliedDiscount[];
    modifiers?: OrderLineItemModifier[];
  }

  export interface OrderLineItemModifier {
    uid?: string;
    catalogObjectId: string;
    name?: string;
    basePriceMoney?: Money;
    totalPriceMoney?: Money;
  }

  export interface OrderTax {
    uid?: string;
    catalogObjectId?: string;
    name?: string;
    type?: 'ADDITIVE' | 'INCLUSIVE';
    percentage?: string;
    appliedMoney?: Money;
    scope?: 'ORDER' | 'LINE_ITEM';
  }

  export interface OrderDiscount {
    uid?: string;
    catalogObjectId?: string;
    name?: string;
    type?: 'FIXED_PERCENTAGE' | 'FIXED_AMOUNT';
    percentage?: string;
    amountMoney?: Money;
    scope?: 'ORDER' | 'LINE_ITEM';
    appliedMoney?: Money;
  }

  export interface OrderLineItemAppliedTax {
    uid?: string;
    taxUid: string;
    appliedMoney: Money;
  }

  export interface OrderLineItemAppliedDiscount {
    uid?: string;
    discountUid: string;
    appliedMoney: Money;
  }

  export interface ServiceCharge {
    uid?: string;
    name?: string;
    type?: 'AUTO_GRATUITY' | 'CUSTOM';
    percentage?: string;
    amountMoney?: Money;
    appliedMoney?: Money;
    taxMoney?: Money;
  }

  export interface Payment {
    id: string;
    orderId?: string;
    amountMoney: Money;
    tipMoney?: Money;
    totalMoney?: Money;
    receiptNumber?: string;
    receiptUrl?: string;
    createdAt?: string;
    status?: 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELED';
  }

  export interface Money {
    amount?: number;
    currency?: string;
  }

  export interface CatalogObject {
    type: 'ITEM' | 'IMAGE' | 'CATEGORY' | 'TAX' | 'DISCOUNT' | 'MODIFIER' | 'MODIFIER_LIST' | 'PRICING_RULE' | 'PRODUCT_SET' | 'TIME_PERIOD' | 'MEASUREMENT_UNIT' | 'SUBSCRIPTION_PLAN' | 'ITEM_OPTION' | 'ITEM_OPTION_VAL' | 'CUSTOM_ATTRIBUTE_DEFINITION' | 'QUICK_AMOUNT_SETTINGS';
    id: string;
    itemData?: CatalogItem;
    categoryData?: CatalogCategory;
    taxData?: CatalogTax;
    discountData?: CatalogDiscount;
    modifierData?: CatalogModifier;
    imageData?: CatalogImage;
    createdAt?: string;
    updatedAt?: string;
    version?: number;
  }

  export interface CatalogItem {
    name: string;
    description?: string;
    abbreviation?: string;
    labelColor?: string;
    availableOnline?: boolean;
    availableForPickup?: boolean;
    availableElectronically?: boolean;
    categoryId?: string;
    taxIds?: string[];
    modifierListIds?: string[];
    variations?: CatalogItemVariation[];
    productType?: 'REGULAR' | 'APPOINTMENTS_SERVICE';
    skipModifierScreen?: boolean;
    itemOptions?: ItemOptionForItem[];
  }

  export interface CatalogItemVariation {
    itemId?: string;
    name: string;
    sku?: string;
    upc?: string;
    ordinal?: number;
    pricingType?: 'FIXED_PRICING' | 'VARIABLE_PRICING';
    priceMoney?: Money;
    locationOverrides?: ItemVariationLocationOverrides[];
    trackInventory?: boolean;
    inventoryAlertType?: 'NONE' | 'LOW_QUANTITY';
    inventoryAlertThreshold?: number;
    userData?: string;
    serviceDuration?: number;
    availableForBooking?: boolean;
    itemOptionValues?: CatalogItemOptionValueForItemVariation[];
    measurementUnitId?: string;
  }

  export interface ItemVariationLocationOverrides {
    locationId: string;
    pricingType?: 'FIXED_PRICING' | 'VARIABLE_PRICING';
    priceMoney?: Money;
    trackInventory?: boolean;
    inventoryAlertType?: 'NONE' | 'LOW_QUANTITY';
    inventoryAlertThreshold?: number;
  }

  export interface CatalogItemOptionValueForItemVariation {
    itemOptionId: string;
    itemOptionValueId?: string;
  }

  export interface ItemOptionForItem {
    itemOptionId: string;
  }

  export interface CatalogCategory {
    name: string;
    description?: string;
  }

  export interface CatalogTax {
    name?: string;
    calculationPhase?: 'TAX_PHASE' | 'SUBTOTAL_PHASE';
    inclusionType: 'ADDITIVE' | 'INCLUSIVE';
    percentage?: string;
    appliesToCustomAmounts?: boolean;
    enabled?: boolean;
  }

  export interface CatalogDiscount {
    name?: string;
    discountType: 'FIXED_PERCENTAGE' | 'FIXED_AMOUNT';
    percentage?: string;
    amountMoney?: Money;
    pinRequired?: boolean;
    labelColor?: string;
    modifyTaxBasis?: 'DO_NOT_MODIFY_TAX_BASIS' | 'MODIFY_TAX_BASIS';
    appliesToCustomAmounts?: boolean;
    enabled?: boolean;
  }

  export interface CatalogModifier {
    name?: string;
    modifierListId?: string;
    priceMoney?: Money;
  }

  export interface CatalogImage {
    caption?: string;
    url?: string;
  }

  export interface InventoryCount {
    catalogObjectId: string;
    catalogObjectType?: 'ITEM_VARIATION';
    state?: 'IN_STOCK' | 'SOLD' | 'RETURNED' | 'RESERVED_FOR_SALE' | 'SUPPORTED_BY_NEWER_VERSION' | 'DEPRECATED_BY_NEWER_VERSION' | 'ABSENT';
    locationId: string;
    quantity?: string;
    calculatedAt?: string;
  }

  export interface InventoryAdjustment {
    id?: string;
    referenceId?: string;
    fromState?: string;
    toState?: string;
    locationId: string;
    catalogObjectId: string;
    catalogObjectType?: string;
    quantity?: string;
    totalPriceMoney?: Money;
    occurredAt?: string;
    createdAt?: string;
  }

  export interface InventoryTransfer {
    id?: string;
    referenceId?: string;
    state?: 'PENDING' | 'COMPLETED' | 'CANCELED';
    fromLocationId: string;
    toLocationId: string;
    catalogObjectId: string;
    catalogObjectType?: string;
    quantity?: string;
    occurredAt?: string;
    createdAt?: string;
  }

  export interface Customer {
    id: string;
    creationSource?: 'APPOINTMENTS' | 'CHECKOUT' | 'DIRECTORY' | 'EGIFTING' | 'EMAIL_MARKETING' | 'FEEDBACK' | 'IMPORT' | 'INVOICES' | 'LOYALTY' | 'MARKETING' | 'ONLINE_STORE' | 'PHONE' | 'SQUARE_PAYROLL' | 'TERMINAL' | 'THIRD_PARTY' | 'OTHER';
    givenName?: string;
    familyName?: string;
    nickname?: string;
    companyName?: string;
    emailAddress?: string;
    address?: Address;
    phoneNumber?: string;
    referenceId?: string;
    note?: string;
    birthday?: string;
    customAttributes?: Record<string, CustomAttribute>;
    cards?: Card[];
    createdAt?: string;
    updatedAt?: string;
    segmentIds?: string[];
  }

  export interface Address {
    addressLine1?: string;
    addressLine2?: string;
    addressLine3?: string;
    locality?: string;
    sublocality?: string;
    administrativeDistrictLevel1?: string;
    administrativeDistrictLevel2?: string;
    administrativeDistrictLevel3?: string;
    postalCode?: string;
    country?: string;
    firstName?: string;
    lastName?: string;
  }

  export interface CustomAttribute {
    stringValue?: string;
    booleanValue?: boolean;
    numberValue?: string;
    selectionValue?: string;
    visibility?: 'VISIBILITY_READ_WRITE_VALUES' | 'VISIBILITY_READ_ONLY' | 'VISIBILITY_HIDDEN';
  }

  export interface Card {
    id: string;
    cardBrand?: string;
    last4?: string;
    expMonth?: number;
    expYear?: number;
    cardholderName?: string;
    billingAddress?: Address;
    fingerprint?: string;
    customerId?: string;
    enabled?: boolean;
    createdAt?: string;
    updated?: string;
  }

  export interface TeamMember {
    id: string;
    referenceId?: string;
    isOwner?: boolean;
    status?: 'ACTIVE' | 'INACTIVE';
    givenName?: string;
    familyName?: string;
    emailAddress?: string;
    phoneNumber?: string;
    assignedLocations?: AssignedLocation[];
    createdAt?: string;
    updatedAt?: string;
  }

  export interface AssignedLocation {
    locationId?: string;
    role?: string;
  }

  export interface TeamMemberWage {
    id?: string;
    teamMemberId?: string;
    title?: string;
    hourlyRate?: Money;
    createdAt?: string;
    updatedAt?: string;
  }

  export interface WorkweekConfig {
    id?: string;
    startOfWeek?: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
    startOfDayLocalTime?: string;
    version?: number;
    createdAt?: string;
    updatedAt?: string;
  }

  export interface Shift {
    id?: string;
    employeeId?: string;
    locationId?: string;
    timezone?: string;
    startAt: string;
    endAt?: string;
    wage?: ShiftWage;
    breaks?: Break[];
    status?: 'OPEN' | 'CLOSED';
    version?: number;
    createdAt?: string;
    updatedAt?: string;
  }

  export interface ShiftWage {
    title?: string;
    hourlyRate?: Money;
  }

  export interface Break {
    id?: string;
    startAt: string;
    endAt?: string;
    breakTypeId?: string;
    notes?: string;
  }

  export interface Location {
    id?: string;
    name?: string;
    address?: Address;
    timezone?: string;
    capabilities?: string[];
    status?: 'ACTIVE' | 'INACTIVE';
    createdAt?: string;
    updatedAt?: string;
    phoneNumber?: string;
    businessHours?: BusinessHours;
    mcc?: string;
    fullFormatLogoUrl?: string;
    logoUrl?: string;
  }

  export interface BusinessHours {
    periods?: BusinessHoursPeriod[];
  }

  export interface BusinessHoursPeriod {
    dayOfWeek?: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
    startLocalTime?: string;
    endLocalTime?: string;
  }

  export interface WebhookNotification {
    timestamp?: string;
    data?: Record<string, any>;
    type?: string;
    eventId?: string;
    apiVersion?: string;
  }
}

/**
 * Clover API Types
 */
export namespace Clover {
  export interface Config {
    environment: 'sandbox' | 'production';
    merchantId: string;
    accessToken: string;
    apiKey?: string;
  }

  export interface Order {
    id: string;
    total: number;
    lineItems: OrderLineItem[];
    discounts: OrderDiscount[];
    taxes: OrderTax[];
    serviceCharge?: number;
    payments: Payment[];
    refunds: Refund[];
    state: 'open' | 'locked' | 'closed';
    note?: string;
    createdTime: number;
    updatedTime?: number;
  }

  export interface OrderLineItem {
    id: string;
    item: {
      id: string;
      name: string;
    };
    name: string;
    quantity: number;
    price: number;
    unitQty?: number;
    note?: string;
    modifiers: OrderLineItemModifier[];
    createdTime: number;
  }

  export interface OrderLineItemModifier {
    id: string;
    modifier: {
      id: string;
      name: string;
    };
    name: string;
    price: number;
  }

  export interface OrderDiscount {
    id: string;
    name?: string;
    percent?: number;
    amount?: number;
    createdTime: number;
  }

  export interface OrderTax {
    id: string;
    name?: string;
    rate?: number;
    amount?: number;
  }

  export interface Payment {
    id: string;
    amount: number;
    cashTendered?: number;
    externalPaymentId?: string;
    note?: string;
    tender?: PaymentTender;
    refunds?: Refund[];
    createdTime: number;
  }

  export interface PaymentTender {
    id: string;
    label: string;
    labelKey?: string;
    opensCashDrawer: boolean;
  }

  export interface Refund {
    id: string;
    payment: {
      id: string;
    };
    amount: number;
    reason?: string;
    createdTime: number;
  }

  export interface Item {
    id: string;
    name: string;
    code?: string;
    sku?: string;
    unitName?: string;
    price?: number;
    priceType?: number;
    cost?: number;
    tax?: Tax;
    modifierGroups?: ModifierGroup[];
    createdTime: number;
  }

  export interface ItemVariant {
    id: string;
    item: { id: string };
    name: string;
    sku?: string;
    price?: number;
    createdTime: number;
  }

  export interface Category {
    id: string;
    name: string;
    items?: Item[];
    createdTime: number;
  }

  export interface Modifier {
    id: string;
    name: string;
    price?: number;
    createdTime: number;
  }

  export interface ModifierGroup {
    id: string;
    name: string;
    modifiers: Modifier[];
    createdTime: number;
  }

  export interface Tax {
    id: string;
    name: string;
    rate?: number;
    isDefault?: boolean;
    createdTime: number;
  }

  export interface Employee {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    pin?: string;
    role?: Role;
    inviteSent?: boolean;
    active: boolean;
    createdTime: number;
  }

  export interface Role {
    id: string;
    name: string;
    permissions?: string[];
  }

  export interface Shift {
    id: string;
    employee: { id: string };
    inTime: number;
    outTime?: number;
    cashier?: Cashier;
    createdTime: number;
  }

  export interface Cashier {
    id: string;
    employee: { id: string };
    nickname?: string;
    inviteSent: boolean;
    active: boolean;
  }

  export interface Merchant {
    id: string;
    name: string;
    address?: Address;
    phone?: string;
    email?: string;
    timezone?: string;
    currency?: string;
    businessType?: string;
    createdTime: number;
  }

  export interface Address {
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }

  export interface Device {
    id: string;
    name?: string;
    serial?: string;
    merchantId: string;
    active: boolean;
    createdTime: number;
  }

  export interface InventoryItem {
    id: string;
    item: { id: string };
    quantity: number;
    quantityPendingCount?: number;
    reorderLevel?: number;
    reorderQuantity?: number;
    createdTime: number;
  }

  export interface WebhookEvent {
    type: string;
    merchantId: string;
    objectId: string;
    payload: Record<string, any>;
    timestamp: number;
  }
}

/**
 * Lightspeed API Types
 */
export namespace Lightspeed {
  export interface Config {
    environment: 'sandbox' | 'production';
    accountId: string;
    accessToken: string;
    refreshToken?: string;
  }

  export interface Sale {
    saleID: number;
    customerID?: number;
    employeeID?: number;
    registerID?: number;
    saleStatus: 'CURRENT' | 'DELETED' | 'ARCHIVED';
    timezoneID?: number;
    total: number;
    subtotal?: number;
    discountTotal?: number;
    tax: number;
    tip?: number;
    createdDate: string;
    updatedDate?: string;
    completedDate?: string;
    lineItems?: SaleLineItem[];
    payments?: SalePayment[];
  }

  export interface SaleLineItem {
    saleLineID: number;
    itemID: number;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
    taxRate?: number;
    note?: string;
    createdDate: string;
  }

  export interface SalePayment {
    salePaymentID: number;
    paymentTypeID: number;
    amount: number;
    createdDate: string;
  }

  export interface Item {
    itemID: number;
    itemType: 'item' | 'variant' | 'modifier';
    title: string;
    description?: string;
    sku?: string;
    upc?: string;
    basePrice: number;
    cost?: number;
    reorderPoint?: number;
    reorderQuantity?: number;
    active: number;
    archived: number;
    createdDate: string;
    updatedDate?: string;
    variants?: ItemVariant[];
  }

  export interface ItemVariant {
    variantID: number;
    title: string;
    sku?: string;
    basePrice: number;
    quantity?: number;
  }

  export interface Category {
    categoryID: number;
    name: string;
    parentID?: number;
    createdDate: string;
  }

  export interface Modifier {
    modifierID: number;
    groupID?: number;
    name: string;
    price?: number;
    createdDate: string;
  }

  export interface ModifierGroup {
    groupID: number;
    name: string;
    modifiers?: Modifier[];
  }

  export interface Employee {
    employeeID: number;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    pin?: string;
    role?: string;
    archived: number;
    createdDate: string;
  }

  export interface TimeClockEntry {
    timeclockID: number;
    employeeID: number;
    clockInTime: string;
    clockOutTime?: string;
    breakDuration?: number;
    notes?: string;
    createdDate: string;
  }

  export interface InventoryCount {
    inventoryID: number;
    itemID: number;
    quantity: number;
    cost?: number;
    lastCountedDate?: string;
    createdDate: string;
  }

  export interface InventoryTransfer {
    transferID: number;
    fromLocationID: number;
    toLocationID: number;
    itemID: number;
    quantity: number;
    status: 'pending' | 'received' | 'canceled';
    createdDate: string;
  }

  export interface Customer {
    customerID: number;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    archived: number;
    createdDate: string;
  }

  export interface Register {
    registerID: number;
    name: string;
    locationID: number;
    active: number;
    createdDate: string;
  }

  export interface ZReport {
    zReportID: number;
    registerID: number;
    employeeID: number;
    openingBalance: number;
    closingBalance: number;
    cashDropped?: number;
    totalSales: number;
    totalTaxCollected: number;
    createdDate: string;
  }

  export interface SalesReport {
    totalSales: number;
    totalTax: number;
    totalDiscounts: number;
    totalRefunds: number;
    transactionCount: number;
    periodStart: string;
    periodEnd: string;
  }

  export interface WebhookEvent {
    eventID: number;
    accountID: number;
    type: string;
    payload: Record<string, any>;
    timestamp: string;
  }
}

/**
 * Unified error types
 */
export interface POSSDKError {
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  statusCode?: number;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
}

/**
 * Idempotency key for operations
 */
export interface IdempotencyOptions {
  key: string;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
}

/**
 * Filter options for list operations
 */
export interface FilterOptions {
  startDate?: Date;
  endDate?: Date;
  status?: string;
  [key: string]: any;
}
