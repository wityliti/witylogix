/**
 * Shipping and Last-Mile Carrier Mock Fixtures
 * Provides mock data for EasyPost, ShipStation, DoorDash, and Uber Direct APIs
 * Used for integration testing without real API calls
 */

// ─── RATE ENGINE FIXTURES ────────────────────────────────────────────────────

export const mockCarrierRates = {
  fedex: {
    carrier: "FedEx",
    serviceType: "Ground",
    cost: 25.5,
    currency: "USD",
    estimatedDays: 3,
    timestamp: new Date().toISOString(),
  },
  ups: {
    carrier: "UPS",
    serviceType: "2-Day Air",
    cost: 32.75,
    currency: "USD",
    estimatedDays: 2,
    timestamp: new Date().toISOString(),
  },
  usps: {
    carrier: "USPS",
    serviceType: "Priority Mail",
    cost: 18.0,
    currency: "USD",
    estimatedDays: 2,
    timestamp: new Date().toISOString(),
  },
  dhl: {
    carrier: "DHL",
    serviceType: "Express",
    cost: 45.0,
    currency: "USD",
    estimatedDays: 1,
    timestamp: new Date().toISOString(),
  },
  ontrac: {
    carrier: "OnTrac",
    serviceType: "Ground",
    cost: 22.0,
    currency: "USD",
    estimatedDays: 3,
    timestamp: new Date().toISOString(),
  },
};

export const mockRateRequestPayload = {
  shipment: {
    toAddress: {
      name: "John Smith",
      street1: "500 Market St",
      city: "San Francisco",
      state: "CA",
      zip: "94105",
      country: "US",
      phone: "+14155551234",
    },
    fromAddress: {
      name: "Warehouse",
      street1: "200 Market St",
      city: "San Francisco",
      state: "CA",
      zip: "94102",
      country: "US",
      phone: "+14155555555",
    },
    parcel: {
      length: 12,
      width: 8,
      height: 6,
      weight: 2.5,
      distanceUnit: "inch",
      massUnit: "lb",
    },
  },
};

export const mockCachedRate = {
  carrier: "USPS",
  serviceType: "Priority Mail",
  cost: 18.0,
  currency: "USD",
  estimatedDays: 2,
  cachedAt: new Date().toISOString(),
  ttl: 3600, // 1 hour in seconds
};

// ─── LABEL GENERATION FIXTURES ───────────────────────────────────────────────

export const mockLabelCreationRequest = {
  shipment: {
    toAddress: {
      name: "Jane Doe",
      street1: "123 Oak Ave",
      city: "Brooklyn",
      state: "NY",
      zip: "11201",
      country: "US",
      phone: "+13105551234",
    },
    fromAddress: {
      name: "Store",
      street1: "456 Elm St",
      city: "Manhattan",
      state: "NY",
      zip: "10001",
      country: "US",
      phone: "+12125555555",
    },
    parcel: {
      length: 10,
      width: 6,
      height: 4,
      weight: 1.2,
      distanceUnit: "inch",
      massUnit: "lb",
    },
    carrier: "USPS",
    service: "Priority Mail",
  },
};

export const mockLabel = {
  id: "label_123456",
  trackingCode: "USPS123456789US",
  labelUrl: "https://easypost.com/labels/label_123456.pdf",
  labelZpl:
    "CT~~CD,~CC^~CT~^XA^MMC^PW812^LL0203^LS0^BY3,3,83^FT512,175^BCN,,Y,N^FD123456789US^FS^XZ",
  labelFormat: "PDF",
  carrier: "USPS",
  service: "Priority Mail",
  shipmentId: "shipment_789",
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
};

export const mockBatchLabelRequest = {
  shipments: [
    {
      toAddress: {
        name: "Alice Johnson",
        street1: "789 Pine Rd",
        city: "Boston",
        state: "MA",
        zip: "02101",
        country: "US",
      },
      fromAddress: {
        name: "Fulfillment Center",
        street1: "999 Industrial Ave",
        city: "Boston",
        state: "MA",
        zip: "02108",
        country: "US",
      },
      parcel: {
        weight: 0.8,
        length: 8,
        width: 5,
        height: 3,
      },
    },
    {
      toAddress: {
        name: "Bob Wilson",
        street1: "321 Oak Lane",
        city: "Boston",
        state: "MA",
        zip: "02102",
        country: "US",
      },
      fromAddress: {
        name: "Fulfillment Center",
        street1: "999 Industrial Ave",
        city: "Boston",
        state: "MA",
        zip: "02108",
        country: "US",
      },
      parcel: {
        weight: 1.5,
        length: 10,
        width: 6,
        height: 4,
      },
    },
  ],
};

export const mockInternationalLabel = {
  id: "label_intl_789",
  trackingCode: "CP123456789CA",
  labelUrl: "https://easypost.com/labels/label_intl_789.pdf",
  carrier: "Canada Post",
  service: "Expedited Parcel",
  customsForm: {
    formType: "CN23",
    description: "Electronics",
    declaredValue: 150.0,
    currency: "USD",
    hsCode: "8517.62",
    countryOfOrigin: "US",
  },
  shipmentId: "shipment_intl_456",
  createdAt: new Date().toISOString(),
};

export const mockAddressVerificationFailure = {
  success: false,
  errors: [
    {
      code: "INVALID_ZIP",
      message: "ZIP code does not match city/state",
    },
  ],
  address: {
    street1: "500 Invalid Zip St",
    city: "San Francisco",
    state: "CA",
    zip: "99999",
    country: "US",
  },
};

// ─── TRACKING WEBHOOK FIXTURES ───────────────────────────────────────────────

export const mockEasyPostWebhook = {
  id: "evt_123",
  description: "batch.created",
  result: {
    id: "batch_456",
    reference: "batch_ref_123",
    status: "created",
    shipment_count: 10,
    created_at: new Date().toISOString(),
  },
  created_at: new Date().toISOString(),
};

export const mockShipStationWebhook = {
  resourceType: "ORDER_NOTIFY",
  resourceId: 123456789,
  eventTime: new Date().toISOString(),
  data: {
    orderId: 123456789,
    orderNumber: "WEB-12345-67890",
    status: "shipped",
    shipments: [
      {
        shipmentId: 987654321,
        createDate: new Date().toISOString(),
        shipDate: new Date().toISOString(),
        carrier: "USPS",
        trackingNumber: "USPS123456789US",
      },
    ],
  },
};

export const mockDoorDashWebhook = {
  event_type: "delivery_update",
  created_at: new Date().toISOString(),
  data: {
    delivery_id: "delivery_dd_789",
    status: "picked_up",
    updated_at: new Date().toISOString(),
    tracking_url: "https://doordash.com/track/delivery_dd_789",
  },
};

export const mockUberDirectWebhook = {
  event_id: "evt_uber_456",
  event_type: "delivery.status_change",
  created_at: Math.floor(Date.now() / 1000),
  delivery_id: "delivery_uber_456",
  status: "en_route_to_pickup",
  updated_at: Math.floor(Date.now() / 1000),
};

export const mockWebhookSignature = {
  easypost: {
    timestamp: Math.floor(Date.now() / 1000).toString(),
    secret: "test_key_FAKE0123",
    expectedSignature: "sha256=mock_signature_hash",
  },
  shipstation: {
    authToken: "test_key_FAKE0123",
    expectedHeader: "X-ShipStation-Auth",
  },
  doordash: {
    timestamp: new Date().toISOString(),
    secret: "test_key_FAKE0123",
    expectedSignature: "sha256=mock_dd_signature",
  },
  uberdirect: {
    timestamp: Math.floor(Date.now() / 1000).toString(),
    secret: "test_key_FAKE0123",
    expectedSignature: "sha256=mock_uber_signature",
  },
};

export const mockTrackingStatusNormalization = {
  carriers: {
    usps: { status: "in_transit", message: "In Transit" },
    fedex: { status: "in_transit", message: "In Transit" },
    ups: { status: "in_transit", message: "On Its Way" },
    doordash: { status: "in_progress", message: "En route to destination" },
    uberdirect: {
      status: "en_route_to_destination",
      message: "Going to delivery location",
    },
  },
  normalized: {
    status: "IN_TRANSIT",
    message: "Shipment in transit to destination",
  },
};

export const mockWebhookRetryScenario = {
  attempt1: {
    timestamp: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
    success: false,
    error: "TIMEOUT",
  },
  attempt2: {
    timestamp: new Date(Date.now() - 20000).toISOString(), // 20 seconds ago
    success: false,
    error: "NETWORK_ERROR",
  },
  attempt3: {
    timestamp: new Date().toISOString(), // now
    success: true,
    error: null,
  },
};

export const mockOutOfOrderWebhookEvents = [
  {
    eventId: "evt_3",
    timestamp: new Date(Date.now() - 10000).toISOString(),
    status: "delivered",
    sequence: 3,
  },
  {
    eventId: "evt_1",
    timestamp: new Date(Date.now() - 30000).toISOString(),
    status: "picked_up",
    sequence: 1,
  },
  {
    eventId: "evt_2",
    timestamp: new Date(Date.now() - 20000).toISOString(),
    status: "in_transit",
    sequence: 2,
  },
];

// ─── CARRIER FAILOVER FIXTURES ───────────────────────────────────────────────

export const mockCarrierAvailability = {
  primary: {
    carrier: "USPS",
    available: false,
    reason: "API_UNAVAILABLE",
  },
  secondary: {
    carrier: "UPS",
    available: true,
    reason: null,
  },
  tertiary: {
    carrier: "FedEx",
    available: true,
    reason: null,
  },
};

export const mockCarrierTimeoutScenario = {
  carriers: [
    {
      carrier: "USPS",
      timeout: 10000, // 10 seconds
      responseTime: 15000, // takes 15 seconds (timeout)
      success: false,
    },
    {
      carrier: "UPS",
      timeout: 10000,
      responseTime: 5000, // responds in 5 seconds
      success: true,
    },
  ],
};

export const mockCircuitBreakerState = {
  initial: {
    state: "CLOSED",
    failureCount: 0,
    successCount: 0,
    lastFailureTime: null,
  },
  afterFailures: {
    state: "OPEN",
    failureCount: 5,
    successCount: 0,
    lastFailureTime: new Date().toISOString(),
    resetTimeout: 60000, // 60 seconds
  },
  afterRecovery: {
    state: "HALF_OPEN",
    failureCount: 5,
    successCount: 1,
    lastFailureTime: new Date(Date.now() - 120000).toISOString(),
    resetTimeout: null,
  },
};

export const mockCarrierRecovery = {
  timestamp: new Date().toISOString(),
  carrier: "USPS",
  previousState: "OPEN",
  newState: "CLOSED",
  recoveryTime: 120000, // 2 minutes
};

// ─── ADDRESS VALIDATION FIXTURES ─────────────────────────────────────────────

export const mockValidAddress = {
  name: "John Smith",
  street1: "500 Market St",
  street2: "Suite 200",
  city: "San Francisco",
  state: "CA",
  zip: "94105",
  country: "US",
  phone: "+14155551234",
  verified: true,
  standardized: true,
};

export const mockInvalidAddress = {
  street1: "999 Nonexistent St",
  city: "Fakeville",
  state: "XX",
  zip: "00000",
  country: "US",
  verified: false,
  errors: ["UNKNOWN_CITY", "INVALID_STATE", "INVALID_ZIP"],
};

// ─── CURRENCY NORMALIZATION FIXTURES ─────────────────────────────────────────

export const mockMultiCurrencyRates = {
  usd: {
    carrier: "FedEx",
    cost: 25.5,
    currency: "USD",
    originalCurrency: "USD",
  },
  eur: {
    carrier: "DHL",
    cost: 22.5,
    currency: "EUR",
    originalCurrency: "EUR",
    usdEquivalent: 24.75, // approximate conversion
  },
  gbp: {
    carrier: "Royal Mail",
    cost: 18.5,
    currency: "GBP",
    originalCurrency: "GBP",
    usdEquivalent: 23.25, // approximate conversion
  },
};
