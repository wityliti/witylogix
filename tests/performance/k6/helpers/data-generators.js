/**
 * Test Data Generators for K6 Load Testing
 *
 * Generates realistic test data for:
 * - Orders with items and delivery details
 * - Drivers with locations and ratings
 * - Deliveries with routes and tracking
 * - Addresses across US
 * - Contact information (emails, phones)
 * - Random utility functions
 *
 * Usage:
 *   import { generateOrder, generateDriver, generateDelivery } from './helpers/data-generators.js';
 *   const order = generateOrder('customer-123');
 *   const driver = generateDriver('shop-456');
 */

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Get random element from array
 * @param {Array} array - Input array
 * @returns {*} Random element
 */
export function randomFromArray(array) {
  if (!Array.isArray(array) || array.length === 0) {
    return null;
  }
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random float between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} decimals - Number of decimal places
 * @returns {number} Random float
 */
export function randomFloat(min, max, decimals = 2) {
  const value = Math.random() * (max - min) + min;
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Generate random string of given length
 * @param {number} length - String length
 * @returns {string} Random alphanumeric string
 */
export function randomString(length = 8) {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

// ─── Contact Information Generators ────────────────────────────────────────

/**
 * Generate unique email address
 * @param {string} domain - Email domain
 * @returns {string} Email address
 */
export function generateEmail(domain = "perf-test.local") {
  const timestamp = Date.now();
  const random = randomString(6);
  return `user.${timestamp}.${random}@${domain}`;
}

/**
 * Generate phone number (US format)
 * @param {string} areaCode - Area code (optional)
 * @returns {string} Phone number
 */
export function generatePhone(areaCode = null) {
  const area = areaCode || randomInt(201, 999);
  const exchange = randomInt(200, 999);
  const number = randomInt(1000, 9999);
  return `+1${area}${exchange}${number}`;
}

/**
 * Generate name
 * @returns {string} Person name
 */
export function generateName() {
  const firstNames = [
    "John",
    "Jane",
    "Michael",
    "Sarah",
    "David",
    "Emma",
    "Robert",
    "Lisa",
    "James",
    "Jennifer",
    "William",
    "Mary",
    "Richard",
    "Patricia",
    "Joseph",
    "Linda",
  ];
  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Hernandez",
    "Lopez",
    "Gonzalez",
    "Wilson",
    "Anderson",
    "Thomas",
  ];

  const first = randomFromArray(firstNames);
  const last = randomFromArray(lastNames);
  return `${first} ${last}`;
}

// ─── Address Generator ──────────────────────────────────────────────────────

/**
 * Generate US address
 * @returns {Object} Address object
 */
export function generateAddress() {
  const streets = [
    "Main Street",
    "Oak Avenue",
    "Maple Drive",
    "Elm Street",
    "Pine Road",
    "Birch Lane",
    "Cedar Court",
    "Ash Boulevard",
    "Walnut Way",
    "Spruce Circle",
  ];

  const cities = [
    "San Francisco",
    "Los Angeles",
    "New York",
    "Chicago",
    "Houston",
    "Phoenix",
    "Philadelphia",
    "San Antonio",
    "San Diego",
    "Dallas",
    "Boston",
    "Seattle",
    "Denver",
    "Austin",
    "Portland",
  ];

  const states = [
    "CA",
    "NY",
    "TX",
    "FL",
    "IL",
    "PA",
    "OH",
    "GA",
    "NC",
    "MI",
    "NJ",
    "VA",
    "WA",
    "AZ",
    "CO",
  ];

  const zipCodes = {
    CA: ["90001", "94102", "92101", "95014", "91001"],
    NY: ["10001", "10002", "10003", "10004", "10005"],
    TX: ["75001", "77001", "78201", "78701", "75701"],
    FL: ["33101", "33102", "33103", "33104", "33105"],
    IL: ["60601", "60602", "60603", "60604", "60605"],
  };

  const street = randomFromArray(streets);
  const city = randomFromArray(cities);
  const state = randomFromArray(states);
  const streetNumber = randomInt(100, 9999);
  const zipCode = zipCodes[state]?.[0] || "10001";

  return {
    street: `${streetNumber} ${street}`,
    city,
    state,
    postalCode: zipCode,
    country: "US",
    latitude: randomFloat(24.5, 49.5, 4),
    longitude: randomFloat(-125, -65, 4),
  };
}

// ─── Order Generator ───────────────────────────────────────────────────────

/**
 * Generate realistic order data
 * @param {string} customerId - Customer ID
 * @param {string} shopId - Shop ID (optional)
 * @returns {Object} Order object
 */
export function generateOrder(customerId, shopId = null) {
  const products = [
    { name: "Laptop", baseSku: "LAPTOP", basePrice: 99900 },
    { name: "Monitor", baseSku: "MON", basePrice: 29900 },
    { name: "Keyboard", baseSku: "KB", basePrice: 8900 },
    { name: "Mouse", baseSku: "MOUSE", basePrice: 2900 },
    { name: "Headphones", baseSku: "HP", basePrice: 12900 },
    { name: "Desk", baseSku: "DESK", basePrice: 39900 },
    { name: "Chair", baseSku: "CHAIR", basePrice: 24900 },
  ];

  const selectedProduct = randomFromArray(products);
  const quantity = randomInt(1, 3);
  const itemPrice = selectedProduct.basePrice + randomInt(-1000, 1000);
  const address = generateAddress();

  const items = [];
  for (let i = 0; i < quantity; i++) {
    items.push({
      sku: `${selectedProduct.baseSku}-${randomString(4).toUpperCase()}`,
      name: selectedProduct.name,
      quantity: randomInt(1, 5),
      unitPrice: itemPrice,
      totalPrice: itemPrice * randomInt(1, 5),
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const taxRate = 0.08;
  const tax = Math.round(subtotal * taxRate);
  const shippingCost = randomInt(500, 3000);
  const total = subtotal + tax + shippingCost;

  return {
    customerId: customerId || `cust_${randomString(8)}`,
    shopId: shopId || `shop_${randomString(8)}`,
    orderId: `ord_${Date.now()}_${randomString(6)}`,
    items,
    subtotalAmount: subtotal,
    taxAmount: tax,
    shippingCost,
    totalAmount: total,
    currency: "USD",
    status: "pending",
    customerName: generateName(),
    customerEmail: generateEmail(),
    customerPhone: generatePhone(),
    deliveryAddress: {
      ...address,
      recipientName: generateName(),
    },
    notes: `Order notes ${randomString(8)}`,
    createdAt: new Date().toISOString(),
    scheduledDeliveryDate: new Date(
      Date.now() + randomInt(1, 7) * 24 * 60 * 60 * 1000,
    ).toISOString(),
  };
}

/**
 * Generate multiple orders
 * @param {string} customerId - Customer ID
 * @param {number} count - Number of orders
 * @returns {Array<Object>} Array of order objects
 */
export function generateOrders(customerId, count = 5) {
  const orders = [];
  for (let i = 0; i < count; i++) {
    orders.push(generateOrder(customerId, `shop_${i}`));
  }
  return orders;
}

// ─── Driver Generator ───────────────────────────────────────────────────────

/**
 * Generate realistic driver data
 * @param {string} shopId - Shop ID
 * @returns {Object} Driver object
 */
export function generateDriver(shopId) {
  const vehicleTypes = ["car", "van", "truck", "motorcycle", "bicycle"];
  const address = generateAddress();

  return {
    driverId: `drv_${Date.now()}_${randomString(6)}`,
    shopId: shopId || `shop_${randomString(8)}`,
    name: generateName(),
    email: generateEmail(),
    phone: generatePhone(),
    licenseNumber: `DL${randomString(10).toUpperCase()}`,
    licenseExpiryDate: new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    vehicleType: randomFromArray(vehicleTypes),
    vehiclePlate: `${randomString(3).toUpperCase()}${randomInt(1000, 9999)}`,
    vehicleModel: randomFromArray([
      "Toyota Camry",
      "Honda Civic",
      "Ford Transit",
      "Chevy Bolt",
    ]),
    currentLocation: {
      latitude: address.latitude,
      longitude: address.longitude,
      updatedAt: new Date().toISOString(),
    },
    status: randomFromArray(["available", "busy", "offline"]),
    rating: randomFloat(3.5, 5.0),
    totalDeliveries: randomInt(50, 500),
    acceptanceRate: randomFloat(0.85, 0.99, 2),
    cancellationRate: randomFloat(0.01, 0.1, 2),
    createdAt: new Date(
      Date.now() - randomInt(30, 365) * 24 * 60 * 60 * 1000,
    ).toISOString(),
  };
}

/**
 * Generate multiple drivers
 * @param {string} shopId - Shop ID
 * @param {number} count - Number of drivers
 * @returns {Array<Object>} Array of driver objects
 */
export function generateDrivers(shopId, count = 10) {
  const drivers = [];
  for (let i = 0; i < count; i++) {
    drivers.push(generateDriver(shopId));
  }
  return drivers;
}

// ─── Delivery Generator ────────────────────────────────────────────────────

/**
 * Generate realistic delivery data
 * @param {string} orderId - Order ID
 * @param {string} driverId - Driver ID (optional)
 * @returns {Object} Delivery object
 */
export function generateDelivery(orderId, driverId = null) {
  const statuses = [
    "pending",
    "assigned",
    "picked_up",
    "in_transit",
    "delivered",
    "failed",
  ];
  const pickupAddress = generateAddress();
  const deliveryAddress = generateAddress();

  const createdAt = new Date(
    Date.now() - randomInt(1, 7) * 24 * 60 * 60 * 1000,
  );
  const estimatedDeliveryTime = new Date(
    createdAt.getTime() + randomInt(2, 24) * 60 * 60 * 1000,
  );

  return {
    deliveryId: `del_${Date.now()}_${randomString(6)}`,
    orderId: orderId || `ord_${randomString(8)}`,
    driverId: driverId || `drv_${randomString(8)}`,
    pickupLocation: {
      ...pickupAddress,
      name: "Warehouse A",
      contactName: generateName(),
      contactPhone: generatePhone(),
    },
    deliveryLocation: {
      ...deliveryAddress,
      name: "Customer Location",
      contactName: generateName(),
      contactPhone: generatePhone(),
    },
    status: randomFromArray(statuses),
    priority: randomFromArray(["standard", "express", "next_day"]),
    estimatedDistance: randomFloat(5, 100, 1),
    estimatedDuration: randomInt(15, 180),
    estimatedDeliveryTime: estimatedDeliveryTime.toISOString(),
    actualDeliveryTime: null,
    attempts: randomInt(1, 3),
    route: {
      waypoints: [
        {
          latitude: pickupAddress.latitude,
          longitude: pickupAddress.longitude,
        },
        {
          latitude: deliveryAddress.latitude,
          longitude: deliveryAddress.longitude,
        },
      ],
      totalDistance: randomFloat(5, 100, 1),
      totalDuration: randomInt(15, 180),
      polyline: randomString(50),
    },
    trackingUpdates: [
      {
        timestamp: createdAt.toISOString(),
        status: "pending",
        location: pickupAddress,
        message: "Delivery created",
      },
    ],
    createdAt: createdAt.toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Generate multiple deliveries
 * @param {string} orderId - Order ID
 * @param {number} count - Number of deliveries
 * @returns {Array<Object>} Array of delivery objects
 */
export function generateDeliveries(orderId, count = 1) {
  const deliveries = [];
  for (let i = 0; i < count; i++) {
    deliveries.push(generateDelivery(orderId));
  }
  return deliveries;
}

// ─── Webhook Event Generator ───────────────────────────────────────────────

/**
 * Generate webhook event payload
 * @param {string} eventType - Event type
 * @param {string} resourceId - Resource ID
 * @param {Object} resourceData - Resource data (optional)
 * @returns {Object} Webhook event payload
 */
export function generateWebhookEvent(eventType, resourceId, resourceData = {}) {
  return {
    eventId: `evt_${Date.now()}_${randomString(6)}`,
    eventType,
    timestamp: new Date().toISOString(),
    resourceId,
    resourceType: eventType.split(".")[0],
    resourceData,
    attemptNumber: 1,
    retryable: true,
  };
}

// ─── Paginated Response Generator ──────────────────────────────────────────

/**
 * Generate paginated response structure
 * @param {Array} items - Items array
 * @param {number} page - Current page
 * @param {number} pageSize - Items per page
 * @param {number} total - Total items
 * @returns {Object} Paginated response
 */
export function generatePaginatedResponse(
  items,
  page = 1,
  pageSize = 20,
  total = null,
) {
  return {
    data: items,
    pagination: {
      page,
      pageSize,
      total: total || items.length,
      totalPages: Math.ceil((total || items.length) / pageSize),
      hasNextPage: page < Math.ceil((total || items.length) / pageSize),
      hasPreviousPage: page > 1,
    },
    timestamp: new Date().toISOString(),
  };
}

// ─── Cursor-based Pagination Generator ──────────────────────────────────────

/**
 * Generate cursor-based paginated response
 * @param {Array} items - Items array
 * @param {string} cursor - Current cursor
 * @param {number} limit - Items limit
 * @param {boolean} hasMore - Has more items
 * @returns {Object} Cursor-paginated response
 */
export function generateCursorPaginatedResponse(
  items,
  cursor = null,
  limit = 20,
  hasMore = false,
) {
  const lastItem = items[items.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? btoa(JSON.stringify({ id: lastItem.id, timestamp: Date.now() }))
      : null;

  return {
    data: items,
    cursor: {
      current: cursor,
      next: nextCursor,
      limit,
      hasMore,
    },
    timestamp: new Date().toISOString(),
  };
}
