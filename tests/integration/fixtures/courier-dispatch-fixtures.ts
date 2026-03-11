/**
 * Courier Dispatch Test Fixtures
 * Mock data generators for courier routing and webhook tests
 * ~120 lines
 */

// ─── DELIVERY REQUEST FIXTURES ──────────────────────────────────────────────

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface DeliveryRequest {
  id: string;
  pickupLocation: {
    address: string;
    coordinates: Coordinates;
    contactName: string;
    contactPhone: string;
  };
  dropoffLocation: {
    address: string;
    coordinates: Coordinates;
    contactName: string;
    contactPhone: string;
  };
  package: {
    weight: number; // kg
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
    contents?: string;
    fragile?: boolean;
  };
  requirements?: {
    signature: boolean;
    photo: boolean;
    hazmat: boolean;
    temperature_controlled?: "ambient" | "cold" | "hot";
  };
  metadata?: Record<string, unknown>;
}

export const createDeliveryRequest = (overrides?: Partial<DeliveryRequest>): DeliveryRequest => ({
  id: `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  pickupLocation: {
    address: "123 Main St, San Francisco, CA 94102",
    coordinates: {
      latitude: 37.7749,
      longitude: -122.4194,
    },
    contactName: "John Doe",
    contactPhone: "+14155551234",
  },
  dropoffLocation: {
    address: "456 Market St, San Francisco, CA 94105",
    coordinates: {
      latitude: 37.7896,
      longitude: -122.3971,
    },
    contactName: "Jane Smith",
    contactPhone: "+14155555678",
  },
  package: {
    weight: 2,
    dimensions: {
      length: 20,
      width: 15,
      height: 10,
    },
    contents: "Documents",
    fragile: false,
  },
  requirements: {
    signature: false,
    photo: true,
    hazmat: false,
  },
  metadata: {},
  ...overrides,
});

// ─── COURIER PROFILE FIXTURES ──────────────────────────────────────────────

export interface CourierProfile {
  id: string;
  provider: "onfleet" | "stuart" | "uber_direct";
  externalId: string;
  name: string;
  rating: number;
  acceptanceRate: number;
  cancellationRate: number;
  capacity: {
    currentDeliveries: number;
    maxDeliveries: number;
  };
  vehicleType: "bike" | "motorcycle" | "car" | "van" | "truck";
  serviceArea: Coordinates[];
  costPerDelivery: number;
  costPerMile: number;
  costPerHour: number;
  isActive: boolean;
  supportedPackageTypes: string[];
  metadata?: Record<string, unknown>;
}

export const createCourierProfile = (provider: "onfleet" | "stuart" | "uber_direct" = "onfleet", overrides?: Partial<CourierProfile>): CourierProfile => ({
  id: `courier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  provider,
  externalId: `ext_${Math.random().toString(36).substr(2, 9)}`,
  name: "John's Delivery",
  rating: 4.8,
  acceptanceRate: 0.95,
  cancellationRate: 0.02,
  capacity: {
    currentDeliveries: 5,
    maxDeliveries: 10,
  },
  vehicleType: "car",
  serviceArea: [
    { latitude: 37.7749, longitude: -122.4194 },
    { latitude: 37.7896, longitude: -122.3971 },
  ],
  costPerDelivery: 10,
  costPerMile: 2.5,
  costPerHour: 20,
  isActive: true,
  supportedPackageTypes: ["documents", "small_parcel", "medium_parcel"],
  metadata: {},
  ...overrides,
});

// ─── WEBHOOK EVENT FIXTURES ─────────────────────────────────────────────────

export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
  signature?: string;
}

// Onfleet webhook fixtures
export const createOnfleetTaskCompletedEvent = (overrides?: Partial<WebhookEvent>): WebhookEvent => ({
  id: `evt_onfleet_${Date.now()}`,
  type: "task.completed",
  timestamp: Math.floor(Date.now() / 1000),
  data: {
    task: {
      id: `task_${Math.random().toString(36).substr(2, 9)}`,
      shortId: "onfleet_task_123",
      state: 2,
      completionDetails: {
        success: true,
        failureNotes: null,
        photoUploadId: `photo_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Math.floor(Date.now() / 1000),
      },
      assignee: {
        id: `assignee_${Math.random().toString(36).substr(2, 9)}`,
        name: "John Doe",
      },
    },
  },
  signature: `sha256=${Math.random().toString(36).substr(2, 20)}`,
  ...overrides,
});

// Stuart webhook fixtures
export const createStuartDeliveryCompletedEvent = (overrides?: Partial<WebhookEvent>): WebhookEvent => ({
  id: `evt_stuart_${Date.now()}`,
  type: "delivery.completed",
  timestamp: Math.floor(Date.now() / 1000),
  data: {
    delivery: {
      id: `delivery_${Math.random().toString(36).substr(2, 9)}`,
      status: "delivered",
      driver: {
        id: `driver_${Math.random().toString(36).substr(2, 9)}`,
        first_name: "John",
        last_name: "Doe",
      },
      delivered_at: new Date().toISOString(),
      tracking_url: "https://stuart.com/tracking/123",
    },
  },
  signature: `hmac-sha256=${Math.random().toString(36).substr(2, 20)}`,
  ...overrides,
});

// Uber Direct webhook fixtures
export const createUberDirectDeliveryCompletedEvent = (overrides?: Partial<WebhookEvent>): WebhookEvent => ({
  id: `evt_uber_${Date.now()}`,
  type: "delivery.completed",
  timestamp: Math.floor(Date.now() / 1000),
  data: {
    delivery_id: `delivery_${Math.random().toString(36).substr(2, 9)}`,
    status: "completed",
    courier: {
      id: `courier_${Math.random().toString(36).substr(2, 9)}`,
      name: "John Doe",
    },
    completed_at: new Date().toISOString(),
    delivery_status: "completed",
    tracking_info: {
      status: "delivered",
    },
  },
  signature: `signature=${Math.random().toString(36).substr(2, 20)}`,
  ...overrides,
});

// ─── SLA DEFINITION FIXTURES ────────────────────────────────────────────────

export interface SLADefinition {
  id: string;
  courierId: string;
  name: string;
  targetTimeMinutes: number;
  targetDistanceMiles?: number;
  breachPenalty: number;
  currency: string;
  conditions?: {
    maxDeliveries?: number;
    packageWeightMax?: number;
    requireSignature?: boolean;
  };
  startDate: Date;
  endDate?: Date;
  metadata?: Record<string, unknown>;
}

export const createSLADefinition = (overrides?: Partial<SLADefinition>): SLADefinition => ({
  id: `sla_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  courierId: `courier_${Math.random().toString(36).substr(2, 9)}`,
  name: "Standard Same-Day Delivery SLA",
  targetTimeMinutes: 120,
  targetDistanceMiles: 15,
  breachPenalty: 25,
  currency: "USD",
  conditions: {
    maxDeliveries: 50,
    packageWeightMax: 30,
  },
  startDate: new Date(),
  metadata: {},
  ...overrides,
});

// ─── ROUTING REQUEST FIXTURES ──────────────────────────────────────────────

export interface RoutingRequest {
  deliveryRequest: DeliveryRequest;
  eligibleCouriers: string[]; // courier IDs
  costComparison?: Record<string, number>; // courierID -> cost
  performanceWeighting?: {
    rating: number;
    acceptanceRate: number;
    deliveryTime: number;
  };
}

export const createRoutingRequest = (
  availableCourierIds: string[] = [],
  overrides?: Partial<RoutingRequest>
): RoutingRequest => ({
  deliveryRequest: createDeliveryRequest(),
  eligibleCouriers: availableCourierIds.length > 0 ? availableCourierIds : [`courier_1`, `courier_2`, `courier_3`],
  costComparison: {
    courier_1: 12.5,
    courier_2: 15.0,
    courier_3: 10.0,
  },
  performanceWeighting: {
    rating: 0.4,
    acceptanceRate: 0.3,
    deliveryTime: 0.3,
  },
  ...overrides,
});

// ─── EDGE CASE FIXTURES ────────────────────────────────────────────────────

export const createNoCouriersAvailableScenario = () => {
  return {
    deliveryRequest: createDeliveryRequest(),
    availableCouriers: [],
    fallbackChain: ["local_courier_pool", "regional_partner", "national_carrier"],
    expectedBehavior: "attempt each fallback in sequence",
  };
};

export const createAllCouriersAtCapacityScenario = () => {
  return {
    deliveryRequest: createDeliveryRequest(),
    couriers: [
      createCourierProfile("onfleet", {
        capacity: { currentDeliveries: 10, maxDeliveries: 10 },
      }),
      createCourierProfile("stuart", {
        capacity: { currentDeliveries: 8, maxDeliveries: 8 },
      }),
      createCourierProfile("uber_direct", {
        capacity: { currentDeliveries: 5, maxDeliveries: 5 },
      }),
    ],
    expectedBehavior: "queue delivery or escalate to manual assignment",
  };
};

export const createPackageTypeIncompatibilityScenario = () => {
  return {
    deliveryRequest: createDeliveryRequest({
      package: {
        weight: 50,
        dimensions: { length: 100, width: 80, height: 60 },
        contents: "Heavy machinery part",
        fragile: true,
      },
    }),
    couriers: [
      createCourierProfile("onfleet", {
        supportedPackageTypes: ["documents", "small_parcel"],
      }),
      createCourierProfile("stuart", {
        supportedPackageTypes: ["medium_parcel"],
        vehicleType: "car",
      }),
    ],
    expectedBehavior: "skip incompatible couriers, try truck-capable providers",
  };
};

// ─── SPLIT DELIVERY FIXTURES ────────────────────────────────────────────────

export interface SplitDeliveryScenario {
  originalDelivery: DeliveryRequest;
  segments: DeliveryRequest[];
  reason: "capacity" | "time_constraint" | "service_area";
}

export const createSplitDeliveryScenario = (): SplitDeliveryScenario => {
  const originalDelivery = createDeliveryRequest({
    package: {
      weight: 100,
      dimensions: { length: 200, width: 150, height: 100 },
      contents: "50 parcels",
    },
  });

  return {
    originalDelivery,
    segments: [
      createDeliveryRequest({
        id: `segment_1_${Math.random().toString(36).substr(2, 9)}`,
        package: { ...originalDelivery.package, weight: 50 },
      }),
      createDeliveryRequest({
        id: `segment_2_${Math.random().toString(36).substr(2, 9)}`,
        package: { ...originalDelivery.package, weight: 50 },
      }),
    ],
    reason: "capacity",
  };
};
