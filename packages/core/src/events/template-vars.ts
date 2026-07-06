/**
 * Template Variable Builders for Notification Events
 *
 * Maps event payload data to human-readable template variables.
 * These variables are used in notification templates for variable substitution.
 *
 * Example:
 *   Template: "Your package {{tracking_number}} has been delivered!"
 *   Variables: { tracking_number: "TRK123456" }
 *   Output: "Your package TRK123456 has been delivered!"
 */

// ───────────────────────────────────────────────────────────────────
// SHIPMENT VARIABLES
// ───────────────────────────────────────────────────────────────────

/**
 * Extract and format shipment-related template variables.
 *
 * @param shipment - Shipment object from database or event payload.
 * @returns Formatted object with shipment template variables.
 *
 * @example
 *   const vars = buildShipmentVars(shipment);
 *   // Returns:
 *   // {
 *   //   shipment_id: "ship_123",
 *   //   tracking_number: "1Z999AA10123456784",
 *   //   carrier: "fedex",
 *   //   zone: "north_zone_1",
 *   //   weight_kg: 2.5,
 *   //   weight_lbs: 5.5,
 *   //   dimensions_cm: "20x15x10",
 *   //   reference_number: "REF-2024-001",
 *   //   status: "in_transit",
 *   //   created_at: "2024-03-06T10:30:00Z",
 *   //   updated_at: "2024-03-06T12:45:00Z",
 *   // }
 */
export function buildShipmentVars(
  shipment: Record<string, unknown>,
): Record<string, unknown> {
  const vars: Record<string, unknown> = {};

  // Primary identifiers
  vars.shipment_id = shipment.id || shipment.shipmentId;
  vars.tracking_number = shipment.trackingNumber;
  vars.reference_number = shipment.referenceNumber;

  // Carrier & routing
  vars.carrier = shipment.carrier;
  vars.carrier_name = getCarrierDisplayName(shipment.carrier as string);
  vars.zone = shipment.zone;
  vars.zone_name = shipment.zoneName;

  // Dimensions & weight
  if (shipment.weight) {
    const weight = shipment.weight as Record<string, number>;
    vars.weight_kg = weight.kg || weight.value;
    vars.weight_lbs = weight.lbs;
  }

  if (shipment.dimensions) {
    const dims = shipment.dimensions as Record<string, unknown>;
    vars.dimensions_cm = formatDimensions(
      dims.length as number,
      dims.width as number,
      dims.height as number,
    );
  }

  // Addresses
  if (shipment.pickupAddress) {
    const addr = shipment.pickupAddress as Record<string, unknown>;
    vars.pickup_address = formatAddress(addr);
    vars.pickup_city = addr.city;
    vars.pickup_postal_code = addr.postalCode;
  }

  if (shipment.deliveryAddress) {
    const addr = shipment.deliveryAddress as Record<string, unknown>;
    vars.delivery_address = formatAddress(addr);
    vars.delivery_city = addr.city;
    vars.delivery_postal_code = addr.postalCode;
  }

  // Status & dates
  vars.status = shipment.status;
  vars.status_display = getShipmentStatusDisplay(shipment.status as string);
  vars.created_at = formatDate(shipment.createdAt);
  vars.created_at_iso = shipment.createdAt;
  vars.updated_at = formatDate(shipment.updatedAt);
  vars.updated_at_iso = shipment.updatedAt;

  // Optional notes
  vars.special_instructions = shipment.specialInstructions;
  vars.notes = shipment.notes;

  return vars;
}

// ───────────────────────────────────────────────────────────────────
// ORDER VARIABLES
// ───────────────────────────────────────────────────────────────────

/**
 * Extract and format order-related template variables.
 *
 * @param order - Order object from database or event payload.
 * @returns Formatted object with order template variables.
 *
 * @example
 *   const vars = buildOrderVars(order);
 *   // Returns:
 *   // {
 *   //   order_id: "ord_456",
 *   //   order_number: "ORD-2024-001234",
 *   //   status: "confirmed",
 *   //   status_display: "Order Confirmed",
 *   //   subtotal: 99.99,
 *   //   shipping_cost: 10.00,
 *   //   tax: 8.80,
 *   //   total: 118.79,
 *   //   currency: "USD",
 *   //   currency_symbol: "$",
 *   //   item_count: 3,
 *   //   created_at: "2024-03-06T10:15:00Z",
 *   // }
 */
export function buildOrderVars(
  order: Record<string, unknown>,
): Record<string, unknown> {
  const vars: Record<string, unknown> = {};

  // Identifiers
  vars.order_id = order.id || order.orderId;
  vars.order_number = order.orderNumber || order.number;

  // Customer
  if (order.customerId) {
    vars.customer_id = order.customerId;
    vars.customer_name = order.customerName;
    vars.customer_email = order.customerEmail;
    vars.customer_phone = order.customerPhone;
  }

  // Pricing
  const subtotal = (order.subtotal as number) || 0;
  const shipping = (order.shippingCost as number) || 0;
  const tax = (order.tax as number) || 0;
  const total = (order.total as number) || subtotal + shipping + tax;

  vars.subtotal = formatCurrency(subtotal);
  vars.subtotal_amount = subtotal;
  vars.shipping_cost = formatCurrency(shipping);
  vars.shipping_cost_amount = shipping;
  vars.tax = formatCurrency(tax);
  vars.tax_amount = tax;
  vars.total = formatCurrency(total);
  vars.total_amount = total;
  vars.currency = order.currency || "USD";
  vars.currency_symbol = getCurrencySymbol(order.currency as string);

  // Items
  const items = (order.items as unknown[]) || [];
  vars.item_count = items.length;
  if (items.length > 0) {
    vars.first_item_name = (items[0] as Record<string, unknown>).name;
    vars.items_list = items
      .map((item: unknown) => {
        const i = item as Record<string, unknown>;
        return `${i.name} (qty: ${i.quantity})`;
      })
      .join(", ");
  }

  // Status & dates
  vars.status = order.status;
  vars.status_display = getOrderStatusDisplay(order.status as string);
  vars.created_at = formatDate(order.createdAt);
  vars.created_at_iso = order.createdAt;

  // Delivery windows (if applicable)
  if (order.deliveryWindowStart) {
    vars.delivery_window_start = formatDate(order.deliveryWindowStart);
  }
  if (order.deliveryWindowEnd) {
    vars.delivery_window_end = formatDate(order.deliveryWindowEnd);
  }

  return vars;
}

// ───────────────────────────────────────────────────────────────────
// DRIVER VARIABLES
// ───────────────────────────────────────────────────────────────────

/**
 * Extract and format driver-related template variables.
 *
 * @param driver - Driver object from database or event payload.
 * @returns Formatted object with driver template variables.
 *
 * @example
 *   const vars = buildDriverVars(driver);
 *   // Returns:
 *   // {
 *   //   driver_id: "drv_789",
 *   //   driver_name: "John Smith",
 *   //   driver_phone: "+1-555-123-4567",
 *   //   driver_email: "john@example.com",
 *   //   vehicle_number: "ABC-1234",
 *   //   vehicle_type: "delivery_van",
 *   //   zone: "north_zone_1",
 *   //   status: "active",
 *   //   status_display: "Active",
 *   //   rating: 4.8,
 *   //   deliveries_completed: 156,
 *   // }
 */
export function buildDriverVars(
  driver: Record<string, unknown>,
): Record<string, unknown> {
  const vars: Record<string, unknown> = {};

  // Identifiers
  vars.driver_id = driver.id || driver.driverId;

  // Contact info
  vars.driver_name = driver.name || driver.fullName;
  vars.driver_phone = driver.phone || driver.phoneNumber;
  vars.driver_email = driver.email;

  // Vehicle info
  vars.vehicle_number = driver.vehicleNumber || driver.vehicleRegistration;
  vars.vehicle_type = driver.vehicleType;
  vars.vehicle_type_display = getVehicleTypeDisplay(
    driver.vehicleType as string,
  );
  vars.license_plate = driver.licensePlate;

  // Assignment
  vars.zone = driver.zone;
  vars.zone_name = driver.zoneName;
  vars.assigned_at = formatDate(driver.assignedAt);

  // Status
  vars.status = driver.status;
  vars.status_display = getDriverStatusDisplay(driver.status as string);

  // Performance
  const rating = driver.rating as number;
  if (rating) {
    vars.rating = rating.toFixed(1);
    vars.rating_stars =
      "★".repeat(Math.floor(rating)) + "☆".repeat(5 - Math.floor(rating));
  }

  vars.deliveries_completed = driver.deliveriesCompleted || 0;
  vars.cancellations = driver.cancellations || 0;
  vars.on_time_percentage = driver.onTimePercentage || 0;

  return vars;
}

// ───────────────────────────────────────────────────────────────────
// PAYMENT VARIABLES
// ───────────────────────────────────────────────────────────────────

/**
 * Extract and format payment-related template variables.
 *
 * @param payment - Payment object from database or event payload.
 * @returns Formatted object with payment template variables.
 *
 * @example
 *   const vars = buildPaymentVars(payment);
 *   // Returns:
 *   // {
 *   //   payment_id: "pay_101112",
 *   //   amount: "$118.79",
 *   //   amount_value: 118.79,
 *   //   currency: "USD",
 *   //   method: "credit_card",
 *   //   method_display: "Credit Card",
 *   //   status: "completed",
 *   //   status_display: "Payment Completed",
 *   //   reference_id: "txn_abc123",
 *   //   receipt_url: "https://...",
 *   //   processed_at: "2024-03-06T10:20:00Z",
 *   //   last_four: "4242",
 *   // }
 */
export function buildPaymentVars(
  payment: Record<string, unknown>,
): Record<string, unknown> {
  const vars: Record<string, unknown> = {};

  // Identifiers
  vars.payment_id = payment.id || payment.paymentId;
  vars.reference_id = payment.referenceId || payment.transactionId;

  // Amount
  const amount = (payment.amount as number) || 0;
  const currency = (payment.currency as string) || "USD";

  vars.amount = formatCurrency(amount, currency);
  vars.amount_value = amount;
  vars.currency = currency;
  vars.currency_symbol = getCurrencySymbol(currency);

  // Method
  vars.method = payment.method;
  vars.method_display = getPaymentMethodDisplay(payment.method as string);

  // Card details (masked for security)
  if (payment.cardLastFour) {
    vars.last_four = payment.cardLastFour;
    vars.card_masked = `**** **** **** ${payment.cardLastFour}`;
  }
  if (payment.cardBrand) {
    vars.card_brand = (payment.cardBrand as string).toLowerCase();
  }

  // Status
  vars.status = payment.status;
  vars.status_display = getPaymentStatusDisplay(payment.status as string);

  // Dates
  vars.processed_at = formatDate(payment.processedAt || payment.createdAt);
  vars.processed_at_iso = payment.processedAt || payment.createdAt;

  // For receipts/invoices
  if (payment.receiptUrl) {
    vars.receipt_url = payment.receiptUrl;
  }
  if (payment.invoiceNumber) {
    vars.invoice_number = payment.invoiceNumber;
  }

  // Error details (if payment failed)
  if (payment.status === "failed" || payment.status === "declined") {
    vars.error_message =
      payment.errorMessage || "Payment could not be processed";
    vars.error_code = payment.errorCode;
  }

  return vars;
}

// ───────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ───────────────────────────────────────────────────────────────────

/**
 * Format an address object into a readable string.
 *
 * @param address - Address object with fields like street, city, state, postalCode.
 * @returns Formatted address string.
 */
function formatAddress(address: Record<string, unknown>): string {
  const parts: string[] = [];

  if (address.street) parts.push(address.street as string);
  if (address.city) parts.push(address.city as string);
  if (address.state) parts.push(address.state as string);
  if (address.postalCode) parts.push(address.postalCode as string);

  return parts.filter(Boolean).join(", ");
}

/**
 * Format dimensions as a readable string.
 *
 * @param length - Length in cm.
 * @param width - Width in cm.
 * @param height - Height in cm.
 * @returns Formatted string like "20x15x10 cm".
 */
function formatDimensions(
  length: number | undefined,
  width: number | undefined,
  height: number | undefined,
): string {
  const parts = [length, width, height].filter((x) => x !== undefined);
  return `${parts.join("x")} cm`;
}

/**
 * Format a date for display.
 *
 * @param date - Date string, Date object, or timestamp.
 * @returns Formatted date string (e.g., "March 6, 2024 at 10:30 AM").
 */
function formatDate(date: unknown): string {
  if (!date) return "";

  let d: Date;
  if (typeof date === "string") {
    d = new Date(date);
  } else if (typeof date === "number") {
    d = new Date(date);
  } else if (date instanceof Date) {
    d = date;
  } else {
    return "";
  }

  if (isNaN(d.getTime())) return "";

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a number as currency.
 *
 * @param amount - Numeric amount.
 * @param currency - ISO currency code (default: USD).
 * @returns Formatted currency string (e.g., "$99.99").
 */
function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Get the currency symbol for a given currency code.
 *
 * @param currency - ISO currency code.
 * @returns Currency symbol (e.g., "$", "€", "£").
 */
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    INR: "₹",
    AUD: "A$",
    CAD: "C$",
    CHF: "CHF",
    CNY: "¥",
    SEK: "kr",
  };
  return symbols[currency] || currency;
}

/**
 * Get a human-readable carrier name.
 *
 * @param carrierCode - Carrier slug (e.g., "fedex", "ups").
 * @returns Display name.
 */
function getCarrierDisplayName(carrierCode: string): string {
  const names: Record<string, string> = {
    fedex: "FedEx",
    ups: "UPS",
    usps: "USPS",
    dhl: "DHL",
    amazon: "Amazon Logistics",
    local: "Local Delivery",
  };
  return names[carrierCode] || carrierCode;
}

/**
 * Get a human-readable shipment status.
 *
 * @param status - Status code.
 * @returns Display name.
 */
function getShipmentStatusDisplay(status: string): string {
  const displays: Record<string, string> = {
    created: "Shipment Created",
    label_created: "Label Created",
    picked_up: "Picked Up",
    in_transit: "In Transit",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    failed: "Delivery Failed",
    returned: "Returned",
  };
  return displays[status] || status;
}

/**
 * Get a human-readable order status.
 *
 * @param status - Status code.
 * @returns Display name.
 */
function getOrderStatusDisplay(status: string): string {
  const displays: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return displays[status] || status;
}

/**
 * Get a human-readable driver status.
 *
 * @param status - Status code.
 * @returns Display name.
 */
function getDriverStatusDisplay(status: string): string {
  const displays: Record<string, string> = {
    active: "Active",
    inactive: "Inactive",
    on_break: "On Break",
    offline: "Offline",
    suspended: "Suspended",
  };
  return displays[status] || status;
}

/**
 * Get a human-readable vehicle type.
 *
 * @param vehicleType - Vehicle type code.
 * @returns Display name.
 */
function getVehicleTypeDisplay(vehicleType: string): string {
  const displays: Record<string, string> = {
    motorcycle: "Motorcycle",
    bicycle: "Bicycle",
    car: "Car",
    van: "Van",
    truck: "Truck",
    delivery_van: "Delivery Van",
  };
  return displays[vehicleType] || vehicleType;
}

/**
 * Get a human-readable payment method.
 *
 * @param method - Payment method code.
 * @returns Display name.
 */
function getPaymentMethodDisplay(method: string): string {
  const displays: Record<string, string> = {
    credit_card: "Credit Card",
    debit_card: "Debit Card",
    bank_transfer: "Bank Transfer",
    upi: "UPI",
    wallet: "Digital Wallet",
    cash: "Cash on Delivery",
  };
  return displays[method] || method;
}

/**
 * Get a human-readable payment status.
 *
 * @param status - Status code.
 * @returns Display name.
 */
function getPaymentStatusDisplay(status: string): string {
  const displays: Record<string, string> = {
    pending: "Pending",
    completed: "Completed",
    failed: "Failed",
    declined: "Declined",
    refunded: "Refunded",
    cancelled: "Cancelled",
  };
  return displays[status] || status;
}
