/**
 * Data Transformers
 * Entity-specific transformation logic: order → Order, Shipment, Driver, etc.
 * Handles field mapping, enum conversion, relation resolution, and default values
 */

/**
 * Transform external order to internal Order entity
 * Maps external order structure (Shopify, WooCommerce, etc.) to database Order model
 */
export function transformOrder(orderData: any): any {
  if (!orderData) return null;

  const orderId = orderData.id?.toString() || orderData._id?.toString();
  const customerId = orderData.customer?.id?.toString() || orderData.customerId;

  return {
    id: orderId,
    shopId: orderData.shop_id || orderData.shopId,
    customerId: customerId,
    externalOrderId: orderData.shopify_order_id || orderData.external_order_id || orderData.externalOrderId || orderData.name || orderId,
    status: transformOrderStatus(orderData.status || orderData.fulfillment_status || 'pending'),
    email: orderData.customer?.email || orderData.email,
    phone: orderData.customer?.phone || orderData.phone,
    totalPrice: parseFloat(orderData.total_price ?? orderData.totalPrice ?? '0'),
    currency: orderData.currency || 'USD',
    shippingAddress: transformAddress(orderData.shipping_address || orderData.shippingAddress),
    billingAddress: transformAddress(orderData.billing_address || orderData.billingAddress),
    lineItems: transformLineItems(orderData.line_items || orderData.lineItems),
    tags: (orderData.tags || '').split(',').filter((t: string) => t.trim()),
    notes: orderData.note || orderData.notes || null,
    discountCode: orderData.discount_codes?.[0]?.code || orderData.discountCode || null,
    discountAmount: parseFloat(orderData.total_discounts ?? orderData.discountAmount ?? '0'),
    taxAmount: parseFloat(orderData.total_tax ?? orderData.taxAmount ?? '0'),
    shippingMethod: orderData.shipping_lines?.[0]?.title || orderData.shippingMethod || null,
    shippingCost: parseFloat(orderData.shipping_lines?.[0]?.price ?? '0'),
    metadata: orderData.metadata || orderData.metafields || {},
    createdAt: new Date(orderData.created_at || orderData.createdAt || new Date()),
    updatedAt: new Date(orderData.updated_at || orderData.updatedAt || new Date()),
  };
}

/**
 * Transform Shipment entity
 */
export function transformShipment(shipment: any): any {
  if (!shipment) return null;

  return {
    id: shipment._id?.toString() || shipment.id,
    orderId: shipment.order_id?.toString() || shipment.orderId,
    shopId: shipment.shop_id || shipment.shopId,
    status: transformShipmentStatus(shipment.status || 'pending'),
    carrier: shipment.carrier || null,
    trackingNumber: shipment.tracking_number || shipment.trackingNumber || null,
    estimatedDelivery: shipment.estimated_delivery ? new Date(shipment.estimated_delivery) : null,
    actualDelivery: shipment.actual_delivery ? new Date(shipment.actual_delivery) : null,
    locationId: shipment.location_id?.toString() || shipment.locationId || null,
    driverId: shipment.driver_id?.toString() || shipment.driverId || null,
    weight: parseFloat(shipment.weight ?? '0'),
    dimensions: shipment.dimensions || null,
    specialHandling: (shipment.special_handling || '').split(',').filter((h: string) => h.trim()),
    notes: shipment.notes || null,
    metadata: shipment.metadata || {},
    createdAt: new Date(shipment.created_at || shipment.createdAt || new Date()),
    updatedAt: new Date(shipment.updated_at || shipment.updatedAt || new Date()),
  };
}

/**
 * Transform Driver entity
 */
export function transformDriver(driver: any): any {
  if (!driver) return null;

  return {
    id: driver._id?.toString() || driver.id,
    shopId: driver.shop_id || driver.shopId,
    name: driver.name || 'Unknown',
    email: driver.email || null,
    phone: driver.phone || null,
    licensePlate: driver.license_plate || driver.licensePlate || null,
    licenseNumber: driver.license_number || driver.licenseNumber || null,
    licenseExpiry: driver.license_expiry ? new Date(driver.license_expiry) : null,
    status: transformDriverStatus(driver.status || 'active'),
    vehicleType: driver.vehicle_type || driver.vehicleType || 'van',
    vehicleCapacity: parseFloat(driver.vehicle_capacity ?? '100'),
    isVerified: driver.is_verified ?? driver.isVerified ?? false,
    verifiedAt: driver.verified_at ? new Date(driver.verified_at) : null,
    rating: parseFloat(driver.rating ?? '0'),
    totalDeliveries: parseInt(driver.total_deliveries ?? '0', 10),
    bankAccount: driver.bank_account || null,
    document: driver.document || null,
    metadata: driver.metadata || {},
    createdAt: new Date(driver.created_at || driver.createdAt || new Date()),
    updatedAt: new Date(driver.updated_at || driver.updatedAt || new Date()),
  };
}

/**
 * Transform Customer entity
 */
export function transformCustomer(customer: any): any {
  if (!customer) return null;

  return {
    id: customer._id?.toString() || customer.id,
    shopId: customer.shop_id || customer.shopId,
    externalCustomerId: customer.shopify_customer_id || customer.external_customer_id || customer.externalCustomerId || null,
    firstName: customer.first_name || customer.firstName || '',
    lastName: customer.last_name || customer.lastName || '',
    email: customer.email || null,
    phone: customer.phone || null,
    defaultAddress: transformAddress(customer.default_address || customer.defaultAddress),
    addresses: (customer.addresses || []).map((addr: any) => transformAddress(addr)),
    totalOrders: parseInt(customer.total_orders ?? '0', 10),
    totalSpent: parseFloat(customer.total_spent ?? '0'),
    tags: (customer.tags || []).map((t: any) => (typeof t === 'string' ? t : t.name)),
    isActive: customer.is_active ?? customer.isActive ?? true,
    metadata: customer.metadata || {},
    createdAt: new Date(customer.created_at || customer.createdAt || new Date()),
    updatedAt: new Date(customer.updated_at || customer.updatedAt || new Date()),
  };
}

/**
 * Transform Product entity
 */
export function transformProduct(product: any): any {
  if (!product) return null;

  return {
    id: product._id?.toString() || product.id,
    shopId: product.shop_id || product.shopId,
    externalProductId: product.shopify_product_id || product.external_product_id || product.externalProductId || null,
    name: product.name || 'Unknown Product',
    sku: product.sku || null,
    barcode: product.barcode || null,
    description: product.description || null,
    category: product.category || null,
    weight: parseFloat(product.weight ?? '0'),
    dimensions: product.dimensions || null,
    price: parseFloat(product.price ?? '0'),
    cost: parseFloat(product.cost ?? '0'),
    image: product.image || product.imageUrl || null,
    tags: (product.tags || []).filter((t: any) => t),
    isActive: product.is_active ?? product.isActive ?? true,
    metadata: product.metadata || {},
    createdAt: new Date(product.created_at || product.createdAt || new Date()),
    updatedAt: new Date(product.updated_at || product.updatedAt || new Date()),
  };
}

/**
 * Transform Zone/Delivery Zone entity
 */
export function transformZone(zone: any): any {
  if (!zone) return null;

  return {
    id: zone._id?.toString() || zone.id,
    shopId: zone.shop_id || zone.shopId,
    name: zone.name || 'Default Zone',
    description: zone.description || null,
    type: zone.type || 'postal_code',
    postalCodes: (zone.postal_codes || zone.postalCodes || []).filter((p: any) => p),
    polygonCoordinates: zone.polygon_coordinates || zone.polygonCoordinates || null,
    baseRate: parseFloat(zone.base_rate ?? zone.baseRate ?? '0'),
    perKmRate: parseFloat(zone.per_km_rate ?? zone.perKmRate ?? '0'),
    minOrder: parseFloat(zone.min_order ?? zone.minOrder ?? '0'),
    freeAbove: zone.free_above ? parseFloat(zone.free_above) : null,
    estimatedDays: parseInt(zone.estimated_days ?? zone.estimatedDays ?? '1', 10),
    priority: parseInt(zone.priority ?? '0', 10),
    isActive: zone.is_active ?? zone.isActive ?? true,
    metadata: zone.metadata || {},
    createdAt: new Date(zone.created_at || zone.createdAt || new Date()),
    updatedAt: new Date(zone.updated_at || zone.updatedAt || new Date()),
  };
}

/**
 * Transform Route entity
 */
export function transformRoute(route: any): any {
  if (!route) return null;

  return {
    id: route._id?.toString() || route.id,
    shopId: route.shop_id || route.shopId,
    driverId: route.driver_id?.toString() || route.driverId,
    status: transformRouteStatus(route.status || 'pending'),
    shipmentIds: (route.shipment_ids || route.shipmentIds || []).map((id: any) =>
      typeof id === 'string' ? id : id?.toString?.() || id
    ),
    startTime: route.start_time ? new Date(route.start_time) : null,
    endTime: route.end_time ? new Date(route.end_time) : null,
    startLocation: transformAddress(route.start_location || route.startLocation),
    endLocation: transformAddress(route.end_location || route.endLocation),
    totalDistance: parseFloat(route.total_distance ?? '0'),
    totalTime: parseInt(route.total_time ?? '0', 10),
    waypoints: (route.waypoints || []).map((wp: any) => transformAddress(wp)),
    metadata: route.metadata || {},
    createdAt: new Date(route.created_at || route.createdAt || new Date()),
    updatedAt: new Date(route.updated_at || route.updatedAt || new Date()),
  };
}

/**
 * Transform address to standardized format
 */
function transformAddress(addr: any): any {
  if (!addr) return null;

  return {
    name: addr.name || addr.recipient || null,
    street: addr.street || addr.address1 || addr.addressLine1 || '',
    street2: addr.street2 || addr.address2 || addr.addressLine2 || null,
    city: addr.city || '',
    province: addr.province || addr.state || addr.region || null,
    zip: addr.zip || addr.postal_code || addr.postalCode || null,
    country: addr.country || 'US',
    phone: addr.phone || null,
    email: addr.email || null,
    latitude: addr.latitude ? parseFloat(addr.latitude) : null,
    longitude: addr.longitude ? parseFloat(addr.longitude) : null,
    isDefault: addr.default || addr.isDefault || false,
  };
}

/**
 * Transform line items from order
 */
function transformLineItems(items: any[]): any[] {
  if (!items || !Array.isArray(items)) {
    return [];
  }

  return items.map((item: any) => ({
    id: item._id?.toString() || item.id,
    productId: item.product_id?.toString() || item.productId,
    variantId: item.variant_id?.toString() || item.variantId,
    name: item.title || item.name,
    sku: item.sku || null,
    quantity: parseInt(item.quantity ?? '1', 10),
    price: parseFloat(item.price ?? '0'),
    total: parseFloat(item.total ?? '0'),
    weight: parseFloat(item.weight ?? '0'),
  }));
}

/**
 * Transform order status enum
 */
function transformOrderStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'PENDING',
    confirmed: 'CONFIRMED',
    processing: 'PROCESSING',
    shipped: 'SHIPPED',
    delivered: 'DELIVERED',
    cancelled: 'CANCELLED',
    refunded: 'REFUNDED',
    on_hold: 'ON_HOLD',
  };

  return statusMap[status?.toLowerCase()] || 'PENDING';
}

/**
 * Transform shipment status enum
 */
function transformShipmentStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'PENDING',
    picked: 'PICKED',
    packed: 'PACKED',
    dispatched: 'DISPATCHED',
    in_transit: 'IN_TRANSIT',
    out_for_delivery: 'OUT_FOR_DELIVERY',
    delivered: 'DELIVERED',
    failed: 'FAILED',
    returned: 'RETURNED',
    cancelled: 'CANCELLED',
  };

  return statusMap[status?.toLowerCase()] || 'PENDING';
}

/**
 * Transform driver status enum
 */
function transformDriverStatus(status: string): string {
  const statusMap: Record<string, string> = {
    active: 'ACTIVE',
    inactive: 'INACTIVE',
    suspended: 'SUSPENDED',
    onleave: 'ON_LEAVE',
    offline: 'OFFLINE',
  };

  return statusMap[status?.toLowerCase()] || 'ACTIVE';
}

/**
 * Transform route status enum
 */
function transformRouteStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'PENDING',
    assigned: 'ASSIGNED',
    in_progress: 'IN_PROGRESS',
    completed: 'COMPLETED',
    cancelled: 'CANCELLED',
  };

  return statusMap[status?.toLowerCase()] || 'PENDING';
}

/**
 * Get all transformer functions
 */
export const transformers = {
  transformOrder,
  transformShipment,
  transformDriver,
  transformCustomer,
  transformProduct,
  transformZone,
  transformRoute,
};

export default transformers;
