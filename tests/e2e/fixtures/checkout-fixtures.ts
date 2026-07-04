/**
 * Checkout Test Fixtures and Mock Data
 * Provides realistic test data for checkout widget tests
 */

export const mockDeliveryZones = [
  {
    id: "zone-001",
    name: "Downtown",
    zipCodes: ["10001", "10002", "10003", "10004", "10005"],
    deliveryMethods: ["standard", "express", "sameday"],
    rates: {
      standard: 5.99,
      express: 9.99,
      sameday: 19.99,
    },
    cutoffTime: "18:00",
  },
  {
    id: "zone-002",
    name: "Midtown",
    zipCodes: ["10016", "10017", "10018", "10019", "10020", "10022"],
    deliveryMethods: ["standard", "express"],
    rates: {
      standard: 6.99,
      express: 11.99,
    },
    cutoffTime: "17:00",
  },
  {
    id: "zone-003",
    name: "Uptown",
    zipCodes: ["10023", "10024", "10025", "10026", "10027"],
    deliveryMethods: ["standard"],
    rates: {
      standard: 8.99,
    },
    cutoffTime: "16:00",
  },
];

export const mockAvailableDates = [
  {
    date: "2026-03-12",
    available: true,
    slots: 15,
    maxSlots: 20,
  },
  {
    date: "2026-03-13",
    available: true,
    slots: 8,
    maxSlots: 20,
  },
  {
    date: "2026-03-14",
    available: false,
    slots: 0,
    maxSlots: 20,
  },
  {
    date: "2026-03-15",
    available: true,
    slots: 12,
    maxSlots: 20,
  },
  {
    date: "2026-03-16",
    available: true,
    slots: 18,
    maxSlots: 20,
  },
];

export const mockTimeSlots = [
  {
    id: "slot-001",
    time: "08:00-10:00",
    capacity: 5,
    maxCapacity: 10,
    available: true,
  },
  {
    id: "slot-002",
    time: "10:00-12:00",
    capacity: 3,
    maxCapacity: 10,
    available: true,
  },
  {
    id: "slot-003",
    time: "12:00-14:00",
    capacity: 2,
    maxCapacity: 10,
    available: true,
  },
  {
    id: "slot-004",
    time: "14:00-16:00",
    capacity: 0,
    maxCapacity: 10,
    available: false,
  },
  {
    id: "slot-005",
    time: "16:00-18:00",
    capacity: 8,
    maxCapacity: 10,
    available: true,
  },
];

export const mockAddresses = [
  {
    address: "123 Main St, New York, NY 10001",
    zipcode: "10001",
    zone: "zone-001",
    coordinates: {
      lat: 40.71455,
      lng: -74.00712,
    },
  },
  {
    address: "456 Park Ave, New York, NY 10022",
    zipcode: "10022",
    zone: "zone-002",
    coordinates: {
      lat: 40.76078,
      lng: -73.9855,
    },
  },
  {
    address: "789 Broadway, New York, NY 10003",
    zipcode: "10003",
    zone: "zone-001",
    coordinates: {
      lat: 40.73202,
      lng: -73.98723,
    },
  },
  {
    address: "999 Outside Blvd, New York, NY 10099",
    zipcode: "10099",
    zone: null,
    isOutsideZone: true,
  },
];

export const mockCheckoutCart = {
  orderId: "ORDER-001",
  items: [
    {
      id: "item-1",
      name: "Electronics Package",
      quantity: 1,
      price: 29.99,
      weight: 2.5,
      volume: 0.05,
    },
    {
      id: "item-2",
      name: "Books Set",
      quantity: 2,
      price: 14.99,
      weight: 3.0,
      volume: 0.1,
    },
  ],
  subtotal: 59.97,
  tax: 5.34,
  deliveryFee: 5.99,
  total: 71.3,
};

export const mockCheckoutSession = {
  id: "session-001",
  customerId: "cust-001",
  customerEmail: "customer@example.com",
  customerPhone: "+1234567890",
  deliveryAddress: "123 Main St, New York, NY 10001",
  deliveryDate: "2026-03-12",
  deliveryTimeSlot: "slot-002",
  deliveryTime: "10:00-12:00",
  deliveryMethod: "standard",
  items: [
    {
      id: "item-1",
      name: "Electronics Package",
      quantity: 1,
      price: 29.99,
    },
  ],
  subtotal: 29.99,
  deliveryFee: 5.99,
  total: 35.98,
  status: "pending",
  createdAt: "2026-03-11T10:00:00Z",
  expiresAt: "2026-03-11T12:00:00Z",
};

export const mockCheckoutErrors = {
  OUTSIDE_DELIVERY_ZONE: {
    code: "OUTSIDE_ZONE",
    message: "This address is outside our delivery zone",
    type: "zone-error",
  },
  INVALID_ZIPCODE: {
    code: "INVALID_ZIP",
    message: "Please enter a valid zipcode",
    type: "validation-error",
  },
  NO_AVAILABLE_SLOTS: {
    code: "NO_SLOTS",
    message: "No delivery slots available for this date",
    type: "availability-error",
  },
  ORDER_CUTOFF: {
    code: "CUTOFF_TIME",
    message: "Order deadline passed for this delivery date",
    type: "deadline-error",
  },
  ADDRESS_VALIDATION: {
    code: "INVALID_ADDRESS",
    message: "Please enter a valid address",
    type: "validation-error",
  },
};

/**
 * Get checkout test data
 */
export function getCheckoutTestData() {
  return {
    zones: mockDeliveryZones,
    dates: mockAvailableDates,
    slots: mockTimeSlots,
    addresses: mockAddresses,
    cart: mockCheckoutCart,
    session: mockCheckoutSession,
    errors: mockCheckoutErrors,
  };
}

/**
 * Mock address validation response
 */
export const addressValidationResponse = {
  valid: true,
  formatted: "123 Main St, New York, NY 10001",
  zipcode: "10001",
  zone: {
    id: "zone-001",
    name: "Downtown",
  },
  coordinates: {
    lat: 40.71455,
    lng: -74.00712,
  },
  suggestions: [
    "123 Main St, New York, NY 10001",
    "123 Main St Apt 1, New York, NY 10001",
  ],
};

/**
 * Mock geocoding response
 */
export const geocodingResponse = {
  address: "123 Main St, New York, NY 10001",
  coordinates: {
    lat: 40.71455,
    lng: -74.00712,
  },
  components: {
    street: "123 Main St",
    city: "New York",
    state: "NY",
    zipcode: "10001",
    country: "USA",
  },
};

/**
 * Mock rate calculation response
 */
export const rateCalculationResponse = {
  zone: "zone-001",
  address: "123 Main St, New York, NY 10001",
  method: "standard",
  baseRate: 5.99,
  weight: 2.5,
  weightSurcharge: 0,
  distance: 0,
  distanceSurcharge: 0,
  totalRate: 5.99,
  currency: "USD",
};

/**
 * Mock capacity check response
 */
export const capacityCheckResponse = {
  date: "2026-03-12",
  slots: [
    {
      id: "slot-001",
      time: "08:00-10:00",
      capacity: 5,
      maxCapacity: 10,
      available: true,
    },
    {
      id: "slot-002",
      time: "10:00-12:00",
      capacity: 3,
      maxCapacity: 10,
      available: true,
    },
    {
      id: "slot-003",
      time: "12:00-14:00",
      capacity: 2,
      maxCapacity: 10,
      available: true,
    },
    {
      id: "slot-004",
      time: "14:00-16:00",
      capacity: 0,
      maxCapacity: 10,
      available: false,
    },
  ],
};

/**
 * Mock order confirmation response
 */
export const orderConfirmationResponse = {
  orderId: "ORD-20260311-001",
  status: "confirmed",
  confirmationNumber: "CONF-123456",
  estimatedDelivery: "2026-03-12",
  estimatedTime: "10:00-12:00",
  deliveryAddress: "123 Main St, New York, NY 10001",
  totalAmount: 35.98,
  currency: "USD",
  paymentMethod: "credit_card",
  createdAt: "2026-03-11T10:30:00Z",
  trackingUrl: "https://witylogix.com/track/ORD-20260311-001",
};

/**
 * Mock blackout dates (when no delivery is available)
 */
export const mockBlackoutDates = ["2026-03-14", "2026-03-21", "2026-03-28"];
