/**
 * Telematics Mock Fixtures
 * Provides mock HTTP responses for Samsara and Geotab telematics APIs
 * Used for integration testing without real API calls
 */

import type {
  SamsaraVehicle,
  SamsaraLocation,
  SamsaraStats,
  SamsaraSafetyEvent,
  SamsaraFuel,
  GeotabDevice,
  GeotabDeviceStatusInfo,
  GeotabFaultData,
  GeotabExceptionEvent,
} from "../../../packages/core/src/integrations/telematics/types.js";

// ─── SAMSARA FIXTURES ────────────────────────────────────────────────────

export const mockSamsaraVehicle: SamsaraVehicle = {
  id: "vehicle_123",
  name: "Delivery Van A",
  externalIds: [{ externalIdType: "FLEET_ID", value: "FLEET_001" }],
  staticFields: {
    vin: "1HGBH41JXMN109186",
    licensePlate: "CA-12345",
    make: "Honda",
    model: "Odyssey",
    year: 2022,
  },
  onboardingTagIds: ["tag_001"],
};

export const mockSamsaraVehicles: SamsaraVehicle[] = [
  mockSamsaraVehicle,
  {
    id: "vehicle_456",
    name: "Delivery Van B",
    externalIds: [{ externalIdType: "FLEET_ID", value: "FLEET_002" }],
    staticFields: {
      vin: "5TDZZKRH2LS123456",
      licensePlate: "CA-54321",
      make: "Toyota",
      model: "Sienna",
      year: 2023,
    },
  },
];

export const mockSamsaraVehiclesResponse = {
  data: mockSamsaraVehicles,
  pagination: { hasNextPage: false, pageIndex: 0 },
};

export const mockSamsaraLocation: SamsaraLocation = {
  id: "location_123",
  vehicleId: "vehicle_123",
  latitude: 37.7749,
  longitude: -122.4194,
  speedMph: 35.5,
  heading: 180,
  time: "2024-03-11T14:30:00Z",
  accuracy: 5.0,
};

export const mockSamsaraLocationResponse = {
  data: [mockSamsaraLocation],
};

export const mockSamsaraStats: SamsaraStats = {
  engineState: "RUNNING",
  odometer: { miles: 125430.5 },
  faultCodes: [
    {
      id: "fault_001",
      spnId: 1234,
      fmiId: 5,
      description: "Engine Coolant Temperature High",
    },
    {
      id: "fault_002",
      spnId: 5678,
      fmiId: 2,
      description: "DPF Regeneration Required",
    },
  ],
};

export const mockSamsaraDiagnosticsResponse = {
  data: mockSamsaraStats,
};

export const mockSamsaraSafetyEvent: SamsaraSafetyEvent = {
  id: "event_123",
  vehicleId: "vehicle_123",
  driverId: "driver_456",
  eventType: "safetyEvent",
  eventSubType: "harshAcceleration",
  severity: "warning",
  latitude: 37.7749,
  longitude: -122.4194,
  speed: 45.2,
  speedLimit: 55,
  timestamp: "2024-03-11T14:20:00Z",
  description: "Harsh acceleration detected",
};

export const mockSamsaraSafetyEvents: SamsaraSafetyEvent[] = [
  mockSamsaraSafetyEvent,
  {
    id: "event_124",
    vehicleId: "vehicle_123",
    driverId: "driver_456",
    eventType: "safetyEvent",
    eventSubType: "harshBraking",
    severity: "critical",
    latitude: 37.7749,
    longitude: -122.4194,
    speed: 32.5,
    speedLimit: 55,
    timestamp: "2024-03-11T14:15:00Z",
    description: "Harsh braking detected",
  },
];

export const mockSamsaraBehaviorEventsResponse = {
  data: mockSamsaraSafetyEvents,
  pagination: { hasNextPage: false, pageIndex: 0 },
};

export const mockSamsaraFuel: SamsaraFuel & { id: string } = {
  id: "vehicle_123",
  vehicleId: "vehicle_123",
  fuelPercentageRemaining: 65.5,
};

export const mockSamsaraFuelResponse = {
  data: mockSamsaraFuel,
};

export const mockSamsaraWebhookResponse = {
  data: {
    id: "webhook_789",
    url: "https://example.com/webhooks/samsara",
    eventTypes: ["location.created", "location.updated"],
  },
};

// ─── GEOTAB FIXTURES ────────────────────────────────────────────────────

export const mockGeotabDevice: GeotabDevice = {
  id: "device_999",
  name: "Driver01-Device",
  vin: "2HGCV52639H537355",
  licensePlate: "NY-98765",
  make: "Toyota",
  model: "Camry",
  modelYear: 2021,
  deviceType: "GO9",
  status: "Active",
};

export const mockGeotabDevices: GeotabDevice[] = [
  mockGeotabDevice,
  {
    id: "device_888",
    name: "Driver02-Device",
    vin: "5TDJKRFH4LS123456",
    licensePlate: "NY-87654",
    make: "Honda",
    model: "Accord",
    modelYear: 2022,
    deviceType: "GO9",
    status: "Active",
  },
];

export const mockGeotabDeviceStatusInfo: GeotabDeviceStatusInfo = {
  device: { id: "device_999" },
  latitude: 40.7128,
  longitude: -74.006,
  speed: 28.5,
  bearing: 90,
  dateTime: "2024-03-11T14:30:00Z",
};

export const mockGeotabDeviceStatusInfos: GeotabDeviceStatusInfo[] = [
  mockGeotabDeviceStatusInfo,
  {
    device: { id: "device_888" },
    latitude: 40.7228,
    longitude: -74.016,
    speed: 0,
    bearing: 0,
    dateTime: "2024-03-11T14:25:00Z",
  },
];

export const mockGeotabFaultData: GeotabFaultData = {
  device: { id: "device_999" },
  id: "fault_geotab_001",
  code: "P0101",
  description: "Mass Air Flow (MAF) Sensor Range/Performance",
  dateTime: "2024-03-11T10:15:00Z",
  dismissDateTime: undefined,
};

export const mockGeotabFaultDatas: GeotabFaultData[] = [
  mockGeotabFaultData,
  {
    device: { id: "device_999" },
    id: "fault_geotab_002",
    code: "P0102",
    description: "Mass Air Flow (MAF) Sensor Circuit Low Input",
    dateTime: "2024-03-11T09:30:00Z",
    dismissDateTime: "2024-03-11T10:00:00Z",
  },
];

export const mockGeotabExceptionEvent: GeotabExceptionEvent = {
  id: "exception_123",
  device: { id: "device_999" },
  driver: { id: "driver_789" },
  type: "speeding",
  exceptionType: "SpeedingEvent",
  severity: "warning",
  latitude: 40.7128,
  longitude: -74.006,
  speed: 65.5,
  speedZone: { postedSpeed: 55 },
  dateTime: "2024-03-11T14:20:00Z",
  activeFrom: "2024-03-11T14:20:00Z",
  activeTo: "2024-03-11T14:21:00Z",
};

export const mockGeotabExceptionEvents: GeotabExceptionEvent[] = [
  mockGeotabExceptionEvent,
  {
    id: "exception_124",
    device: { id: "device_999" },
    driver: { id: "driver_789" },
    type: "harsh_braking",
    exceptionType: "HarshBrakingEvent",
    severity: "critical",
    latitude: 40.7128,
    longitude: -74.006,
    speed: 32.5,
    dateTime: "2024-03-11T14:15:00Z",
    activeFrom: "2024-03-11T14:15:00Z",
    activeTo: "2024-03-11T14:15:30Z",
  },
];

export const mockGeotabSessionId = "GX3b=vP6W1S3k9Q2r8T5y7u4i";

// ─── ERROR RESPONSE FIXTURES ────────────────────────────────────────────────────

export const mockSamsaraUnauthorizedResponse = {
  code: "INVALID_TOKEN",
  message: "Invalid or expired authentication token",
};

export const mockSamsaraRateLimitResponse = {
  code: "RATE_LIMIT_EXCEEDED",
  message: "Too many requests. Please try again later.",
};

export const mockSamsaraTimeoutError = new Error("Request timeout");
mockSamsaraTimeoutError.name = "AbortError";

export const mockGeotabAuthErrorResponse = {
  jsonrpc: "2.0",
  error: {
    code: -32000,
    message: "Invalid login details",
  },
  id: 1,
};

export const mockGeotabRpcErrorResponse = {
  jsonrpc: "2.0",
  error: {
    code: -32002,
    message: "Server error. Method failed.",
  },
  id: 1,
};

// ─── AUTHENTICATION FIXTURES ────────────────────────────────────────────────────

export const mockSamsaraAuthSuccessResponse = {
  data: [],
  pagination: { hasNextPage: false, pageIndex: 0 },
};

export const mockGeotabAuthSuccessResponse = {
  jsonrpc: "2.0",
  result: mockGeotabSessionId,
  id: 1,
};

// ─── PAGINATION FIXTURES ────────────────────────────────────────────────────

export const mockSamsaraPaginatedVehiclesResponse = {
  data: [mockSamsaraVehicles[0]],
  pagination: { hasNextPage: true, pageIndex: 0 },
};

export const mockSamsaraPaginatedVehiclesPage2Response = {
  data: [mockSamsaraVehicles[1]],
  pagination: { hasNextPage: false, pageIndex: 1 },
};

// ─── EMPTY RESPONSE FIXTURES ────────────────────────────────────────────────────

export const mockEmptyVehiclesResponse = {
  data: [],
  pagination: { hasNextPage: false, pageIndex: 0 },
};

export const mockEmptyEventsResponse = {
  data: [],
  pagination: { hasNextPage: false, pageIndex: 0 },
};

// ─── EDGE CASE FIXTURES ────────────────────────────────────────────────────

export const mockSamsaraVehicleWithoutVin: SamsaraVehicle = {
  id: "vehicle_no_vin",
  name: "Generic Vehicle",
  externalIds: [],
  staticFields: {
    licensePlate: "XX-00000",
    make: "Unknown",
    model: "Unknown",
  },
};

export const mockSamsaraLocationWithoutGPS: SamsaraLocation = {
  id: "location_no_gps",
  vehicleId: "vehicle_123",
  latitude: 0,
  longitude: 0,
  speedMph: 0,
  heading: 0,
  time: "2024-03-11T14:30:00Z",
};

export const mockSamsaraStatsNoDiagnostics: SamsaraStats = {
  engineState: "OFF",
  odometer: { miles: 100000 },
};

export const mockSamsaraFuelNoData: SamsaraFuel & { id: string } = {
  id: "vehicle_no_fuel",
  vehicleId: "vehicle_no_fuel",
};

export const mockGeotabDeviceWithoutVin: GeotabDevice = {
  id: "device_no_vin",
  name: "Anonymous Device",
  deviceType: "GO9",
  status: "Active",
};
