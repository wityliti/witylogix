/**
 * Courier Service Mock Fixtures
 * Provides mock HTTP responses for Onfleet, Stuart, and Uber Direct APIs
 * Used for integration testing without real API calls
 */

// ─── ONFLEET FIXTURES ────────────────────────────────────────────────────

export const mockOnfleetTask = {
  id: "task_onfleet_123",
  organization: "org_abc123",
  shortId: "ABC123",
  trackingURL: "https://onfleet.com/tasks/task_onfleet_123/track",
  destination: {
    id: "dest_001",
    address: {
      street: "123 Main St",
      city: "San Francisco",
      state: "CA",
      postalCode: "94102",
      country: "US",
      latitude: 37.7749,
      longitude: -122.4194,
    },
    notes: "Leave at reception",
  },
  recipients: [
    {
      id: "recipient_001",
      name: "John Doe",
      phone: "+14155551234",
      email: "john@example.com",
      notes: "Preferred contact on arrival",
    },
  ],
  assignment: {
    teamId: "team_001",
    adminId: "admin_001",
    assignedAt: 1710153000000,
  },
  executionNotes: [],
  estimatedServiceTime: 5,
  estimatedArrivalTime: 1710153300000,
  estimatedCompletionTime: 1710153600000,
  completionDetails: null,
  pickupTask: false,
  quantity: 1,
  weight: 2.5,
  serviceTime: 5,
  status: "active",
  identity: {
    checksum: "checksum_001",
  },
  metadata: [
    {
      name: "order_id",
      value: "order_001",
      type: "string",
    },
  ],
};

export const mockOnfleetQuote = {
  deliveryDistance: 3.2,
  estimatedServiceTime: 5,
  estimatedArrivalTime: 1710153300000,
  estimatedCompletionTime: 1710153600000,
  estimatedPickupTime: 1710153000000,
  timeToPickup: 600,
};

export const mockOnfleetWorker = {
  id: "worker_001",
  name: "Jane Smith",
  phone: "+14155554567",
  email: "jane@onfleet.com",
  teams: ["team_001"],
  vehicle: {
    id: "vehicle_001",
    type: "car",
    description: "Honda Civic",
    licensePlate: "ABC-1234",
  },
  location: {
    latitude: 37.7849,
    longitude: -122.4094,
    accuracy: 10,
  },
  capacity: 20,
  tasks: ["task_onfleet_123"],
  onDuty: true,
};

export const mockOnfleetWebhookPayload = {
  id: "webhook_123",
  triggerId: "trigger_001",
  action: "task_update",
  time: 1710153000000,
  taskId: "task_onfleet_123",
  data: {
    id: "task_onfleet_123",
    status: "completed",
    completionDetails: {
      time: 1710153600000,
      location: [37.7749, -122.4194],
      notes: "Delivery completed successfully",
      success: true,
    },
  },
};

export const mockOnfleetTaskCompleted = {
  ...mockOnfleetTask,
  status: "completed",
  completionDetails: {
    time: 1710153600000,
    location: [37.7749, -122.4194],
    notes: "Successfully delivered",
    success: true,
  },
};

export const mockOnfleetTaskCancelled = {
  ...mockOnfleetTask,
  status: "cancelled",
};

// ─── STUART FIXTURES ────────────────────────────────────────────────────

export const mockStuartDelivery = {
  id: "delivery_stuart_456",
  status: "assigned",
  customer_reference: "order_002",
  pickup: {
    address: "200 Market St, San Francisco, CA 94102",
    latitude: 37.7899,
    longitude: -122.3987,
    contact_name: "Alice Johnson",
    contact_phone: "+14155558901",
    scheduled_at: "2024-03-11T14:00:00Z",
    ready_at: "2024-03-11T14:00:00Z",
  },
  dropoff: {
    address: "300 California St, San Francisco, CA 94104",
    latitude: 37.7927,
    longitude: -122.4014,
    contact_name: "Bob Smith",
    contact_phone: "+14155552345",
    scheduled_at: "2024-03-11T14:30:00Z",
  },
  current_courier_location: [37.7899, -122.3987],
  distance: {
    value: 1.5,
    unit: "km",
  },
  duration: 900,
  items: [
    {
      description: "Restaurant order",
      quantity: 1,
      weight: 1.2,
      size: "medium",
    },
  ],
  transport_type: "bike",
  estimated_delivery_time: 1710168300000, // 2024-03-11T14:45:00Z — 15 min after dropoff scheduled_at
  charged_weight: 1.2,
  pricing: {
    total_price: 850,
    currency: "GBP",
    breakdown: [
      {
        type: "distance",
        amount: 500,
      },
      {
        type: "base_fare",
        amount: 350,
      },
    ],
  },
};

export const mockStuartQuote = {
  delivery_price: 850,
  currency: "GBP",
  transport_type: "bike",
  estimated_duration_minutes: 15,
  estimated_distance_km: 1.5,
  pricing_breakdown: [
    {
      type: "distance",
      price: 500,
    },
    {
      type: "base_fare",
      price: 350,
    },
  ],
};

export const mockStuartCourier = {
  id: "courier_stuart_001",
  name: "Charlie Brown",
  phone: "+441234567890",
  location: [37.7899, -122.3987],
  rating: 4.8,
  vehicle_type: "bike",
  active_deliveries: 1,
};

export const mockStuartDeliveryCompleted = {
  ...mockStuartDelivery,
  status: "delivered",
  delivered_at: "2024-03-11T14:25:00Z",
  delivery_proof: {
    signature_required: false,
    photo_required: false,
  },
};

export const mockStuartDeliveryCancelled = {
  ...mockStuartDelivery,
  status: "cancelled",
  cancellation_reason: "Customer request",
};

export const mockStuartOAuth2Token = {
  access_token: "stuart_access_token_xyz789",
  token_type: "Bearer",
  expires_in: 3600,
  refresh_token: "stuart_refresh_token_abc123",
  scope: "deliveries:write deliveries:read",
};

// ─── UBER DIRECT FIXTURES ────────────────────────────────────────────────────

export const mockUberDirectDelivery = {
  delivery_id: "delivery_uber_789",
  status: "en_route_to_pickup",
  order_reference_id: "order_003",
  pickup: {
    location: {
      address: "400 Geary St, San Francisco, CA 94102",
      latitude: 37.785,
      longitude: -122.413,
    },
    contact: {
      name: "Carol Davis",
      phone: "+14155559012",
    },
    scheduled_time: "2024-03-11T14:00:00Z",
  },
  dropoff: {
    location: {
      address: "500 Market St, San Francisco, CA 94105",
      latitude: 37.789,
      longitude: -122.399,
    },
    contact: {
      name: "David Lee",
      phone: "+14155553456",
    },
    scheduled_time: "2024-03-11T14:30:00Z",
  },
  manifest: {
    items: [
      {
        title: "Package",
        quantity: 1,
        size_category: "medium",
        weight_kg: 2.0,
      },
    ],
    size_category: "medium",
    total_weight_kg: 2.0,
  },
  pricing: {
    currency_code: "USD",
    pickup_fee: 0,
    dropoff_fee: 0,
    tip_eligible: true,
    kind: "quote",
    distance_fee: 0,
    currency: "USD",
  },
  driver_assignments: {
    assigned_couriers: 1,
    driver: {
      name: "Emily Wilson",
      phone: "+14155554567",
      location: {
        latitude: 37.784,
        longitude: -122.412,
      },
      rating: 4.9,
    },
  },
  created_at: "2024-03-11T13:50:00Z",
};

export const mockUberDirectQuote = {
  delivery_id: "quote_uber_456",
  status: "ready_for_pickup",
  kind: "quote",
  pickup: {
    location: {
      address: "400 Geary St, San Francisco, CA 94102",
      latitude: 37.785,
      longitude: -122.413,
    },
  },
  dropoff: {
    location: {
      address: "500 Market St, San Francisco, CA 94105",
      latitude: 37.789,
      longitude: -122.399,
    },
  },
  pricing: {
    currency_code: "USD",
    pickup_fee: 0,
    dropoff_fee: 0,
    distance_fee: 450,
    tip_eligible: true,
  },
  estimated_pickup_time_sec: 600,
  estimated_dropoff_time_sec: 1200,
};

export const mockUberDirectDeliveryInTransit = {
  ...mockUberDirectDelivery,
  status: "en_route_to_dropoff",
  updated_at: "2024-03-11T14:10:00Z",
};

export const mockUberDirectDeliveryCompleted = {
  ...mockUberDirectDelivery,
  status: "completed",
  updated_at: "2024-03-11T14:30:00Z",
  completed_at: "2024-03-11T14:30:00Z",
};

export const mockUberDirectDeliveryCancelled = {
  ...mockUberDirectDelivery,
  status: "cancelled",
  updated_at: "2024-03-11T14:35:00Z",
  cancel_reason: "Customer requested cancellation",
};

export const mockUberDirectOAuth2Token = {
  access_token: "uber_access_token_abc123",
  token_type: "Bearer",
  expires_in: 3600,
  refresh_token: "uber_refresh_token_xyz789",
  scope: "delivery_read delivery_write",
};

export const mockUberDirectWebhookPayload = {
  delivery_id: "delivery_uber_789",
  status: "completed",
  event_type: "delivery.status_change",
  event_id: "evt_12345",
  timestamp: "2024-03-11T14:30:00Z",
  data: {
    previous_status: "en_route_to_dropoff",
    current_status: "completed",
    location: {
      latitude: 37.789,
      longitude: -122.399,
    },
  },
};

// ─── DISPATCHER FIXTURES ────────────────────────────────────────────────────

export const mockQuoteComparison = {
  quotes: [
    {
      provider: "onfleet",
      estimatedDuration: 1800,
      estimatedCost: 2200,
      distance: 3.2,
    },
    {
      provider: "stuart",
      estimatedDuration: 1200,
      estimatedCost: 850,
      distance: 1.5,
    },
    {
      provider: "uber_direct",
      estimatedDuration: 1500,
      estimatedCost: 1250,
      distance: 2.1,
    },
  ],
};

export const mockDispatchRequest = {
  pickupAddress: "200 Market St, San Francisco, CA 94102",
  dropoffAddress: "500 Market St, San Francisco, CA 94105",
  pickupTime: new Date("2024-03-11T14:00:00Z"),
  dropoffTime: new Date("2024-03-11T14:30:00Z"),
  items: [
    {
      description: "Package",
      quantity: 1,
      weight: 2.0,
    },
  ],
};

export const mockMultiCourierDispatch = {
  providers: ["onfleet", "stuart", "uber_direct"],
  selectedProvider: "stuart",
  deliveryId: "delivery_stuart_456",
  estimatedDuration: 1200,
  estimatedCost: 850,
};

// ─── ERROR RESPONSE FIXTURES ────────────────────────────────────────────────────

export const mockOnfleetUnauthorizedError = {
  code: "UNAUTHORIZED",
  message: "Invalid authentication token",
};

export const mockStuartRateLimitError = {
  error: "rate_limit_exceeded",
  message: "Too many requests",
  retry_after: 60,
};

export const mockUberDirectInvalidDeliveryError = {
  code: "INVALID_REQUEST",
  message: "Delivery not found",
};

export const mockUberDirectQuoteExpiredError = {
  code: "QUOTE_EXPIRED",
  message: "Quote has expired. Please request a new quote.",
};

// ─── EDGE CASE FIXTURES ────────────────────────────────────────────────────

export const mockOnfleetTaskWithoutAssignment = {
  ...mockOnfleetTask,
  assignment: null,
};

export const mockOnfleetTaskWithoutEstimates = {
  ...mockOnfleetTask,
  estimatedServiceTime: undefined,
  estimatedArrivalTime: undefined,
};

export const mockStuartDeliveryWithoutCourier = {
  ...mockStuartDelivery,
  current_courier_location: undefined,
};

export const mockStuartMultiplePricingTiers = {
  ...mockStuartQuote,
  pricing_breakdown: [
    { type: "base_fare", price: 300 },
    { type: "distance", price: 300 },
    { type: "surge_multiplier", price: 250 },
    { type: "surcharge", price: 100 },
  ],
};

export const mockUberDirectQuoteWithoutDriver = {
  ...mockUberDirectDelivery,
  driver_assignments: {
    assigned_couriers: 0,
  },
};

export const mockUberDirectMinimalManifest = {
  ...mockUberDirectDelivery,
  manifest: {
    items: [],
    size_category: "small",
    total_weight_kg: 0,
  },
};
