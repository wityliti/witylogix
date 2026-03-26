/**
 * Freight Testing Fixtures - Factory Functions for Test Data
 * Provides realistic factory functions for mocking freight domain objects
 * Includes: loads, lanes, rates, carrier profiles, HOS logs, DVIRs, FMCSA data
 * ~300 lines total
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface MockLoad {
  loadId: string;
  origin: string;
  destination: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  distance: number;
  weight: number;
  equipment: string;
  rate: number;
  fuelSurcharge: number;
  totalRate: number;
  status: string;
  postedAt: Date;
  pickupTimewindow: { earliest: Date; latest: Date };
  deliveryTimewindow: { earliest: Date; latest: Date };
}

export interface MockLane {
  laneId: string;
  origin: string;
  destination: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  distance: number;
  lanes: number;
}

export interface MockRate {
  rateId: string;
  provider: string;
  origin: string;
  destination: string;
  equipment: string;
  rate: number;
  fuelSurcharge: number;
  accessorials: Array<{ type: string; charge: number }>;
  contractRate?: number;
  spotRate: number;
  timestamp: Date;
  ttl: number;
}

export interface MockCarrierProfile {
  carrierId: string;
  name: string;
  dotNumber: string;
  mcNumber: string;
  safetyRating: string;
  insuranceStatus: string;
  onTimeRate: number;
  tenderAcceptanceRate: number;
  claimsRatio: number;
  costPerMile: number;
  safetyScore: number;
  fleetSize: number;
}

export interface MockHOSLog {
  logId: string;
  driverId: string;
  vehicleId: string;
  dutyStatus: string;
  startTime: Date;
  endTime: Date;
  miles?: number;
  location?: string;
}

export interface MockViolation {
  violationId: string;
  driverId: string;
  type: string;
  severity: string;
  message: string;
  detectedAt: Date;
  regulatoryRef: string;
}

export interface MockDVIR {
  dvirId: string;
  vehicleId: string;
  driverId: string;
  inspectionType: string;
  defects: Array<{ code: string; severity: string; description: string }>;
  status: string;
  completedAt: Date;
}

export interface MockFMCSACarrier {
  dotNumber: string;
  legalName: string;
  safetyRating: string;
  safetyRatingDate: Date;
  outOfServiceDate?: Date;
  insuranceStatus: string;
  insuranceExpiryDate: Date;
  operatingAuthority: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createMockLoad(overrides?: Partial<MockLoad>): MockLoad {
  const baseLoad: MockLoad = {
    loadId: `load_${Math.random().toString(36).substr(2, 9)}`,
    origin: "Los Angeles, CA",
    destination: "New York, NY",
    originLat: 34.0522,
    originLng: -118.2437,
    destLat: 40.7128,
    destLng: -74.006,
    distance: 2800,
    weight: 20000,
    equipment: "53FT_DRY_VAN",
    rate: 2500,
    fuelSurcharge: 250,
    totalRate: 2750,
    status: "posted",
    postedAt: new Date(),
    pickupTimewindow: {
      earliest: new Date(Date.now() + 3600000),
      latest: new Date(Date.now() + 7200000),
    },
    deliveryTimewindow: {
      earliest: new Date(Date.now() + 259200000),
      latest: new Date(Date.now() + 345600000),
    },
  };

  return { ...baseLoad, ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────────
// LANE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createMockLane(overrides?: Partial<MockLane>): MockLane {
  const baseLane: MockLane = {
    laneId: `lane_${Math.random().toString(36).substr(2, 9)}`,
    origin: "Los Angeles, CA",
    destination: "New York, NY",
    originLat: 34.0522,
    originLng: -118.2437,
    destLat: 40.7128,
    destLng: -74.006,
    distance: 2800,
    lanes: 15,
  };

  return { ...baseLane, ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createMockRate(overrides?: Partial<MockRate>): MockRate {
  const baseRate: MockRate = {
    rateId: `rate_${Math.random().toString(36).substr(2, 9)}`,
    provider: "DAT",
    origin: "Los Angeles, CA",
    destination: "New York, NY",
    equipment: "53FT_DRY_VAN",
    rate: 2400,
    fuelSurcharge: 240,
    accessorials: [
      { type: "lumper", charge: 50 },
      { type: "detention", charge: 100 },
    ],
    contractRate: 2200,
    spotRate: 2400,
    timestamp: new Date(),
    ttl: 3600,
  };

  return { ...baseRate, ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────────
// CARRIER PROFILE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createMockCarrierProfile(
  overrides?: Partial<MockCarrierProfile>,
): MockCarrierProfile {
  const baseProfile: MockCarrierProfile = {
    carrierId: `carrier_${Math.random().toString(36).substr(2, 9)}`,
    name: "ABC Trucking Inc",
    dotNumber: `${Math.floor(Math.random() * 9000000) + 1000000}`,
    mcNumber: `MC${Math.floor(Math.random() * 9000000) + 1000000}`,
    safetyRating: "Satisfactory",
    insuranceStatus: "Active",
    onTimeRate: 0.95,
    tenderAcceptanceRate: 0.92,
    claimsRatio: 0.01,
    costPerMile: 2.15,
    safetyScore: 92,
    fleetSize: 150,
  };

  return { ...baseProfile, ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOS LOG FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createMockHOSLog(overrides?: Partial<MockHOSLog>): MockHOSLog {
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + 3600000); // 1 hour

  const baseLog: MockHOSLog = {
    logId: `hos_${Math.random().toString(36).substr(2, 9)}`,
    driverId: `driver_${Math.floor(Math.random() * 10000)}`,
    vehicleId: `vehicle_${Math.floor(Math.random() * 1000)}`,
    dutyStatus: "DRIVING",
    startTime,
    endTime,
    miles: 65,
    location: "I-40, Texas",
  };

  return { ...baseLog, ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────────
// VIOLATION FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createMockViolation(
  overrides?: Partial<MockViolation>,
): MockViolation {
  const baseViolation: MockViolation = {
    violationId: `violation_${Math.random().toString(36).substr(2, 9)}`,
    driverId: `driver_${Math.floor(Math.random() * 10000)}`,
    type: "DRIVING_11_HOUR_VIOLATION",
    severity: "CRITICAL",
    message: "Driver exceeded 11-hour driving limit",
    detectedAt: new Date(),
    regulatoryRef: "49 CFR 395.8(a)",
  };

  return { ...baseViolation, ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────────
// DVIR FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createMockDVIR(overrides?: Partial<MockDVIR>): MockDVIR {
  const baseDVIR: MockDVIR = {
    dvirId: `dvir_${Math.random().toString(36).substr(2, 9)}`,
    vehicleId: `vehicle_${Math.floor(Math.random() * 1000)}`,
    driverId: `driver_${Math.floor(Math.random() * 10000)}`,
    inspectionType: "pre_trip",
    defects: [
      { code: "BRAKE", severity: "CRITICAL", description: "Brake pad wear" },
      { code: "TIRE", severity: "MINOR", description: "Tire pressure low" },
    ],
    status: "open",
    completedAt: new Date(),
  };

  return { ...baseDVIR, ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────────
// FMCSA CARRIER FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createMockFMCSACarrier(
  overrides?: Partial<MockFMCSACarrier>,
): MockFMCSACarrier {
  const baseCarrier: MockFMCSACarrier = {
    dotNumber: `${Math.floor(Math.random() * 9000000) + 1000000}`,
    legalName: "Test Carrier LLC",
    safetyRating: "Satisfactory",
    safetyRatingDate: new Date(Date.now() - 86400000 * 30),
    insuranceStatus: "Valid",
    insuranceExpiryDate: new Date(Date.now() + 86400000 * 365),
    operatingAuthority: "Active",
  };

  return { ...baseCarrier, ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE COMPARISON GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create rates from multiple providers for same lane
 */
export function createMultiProviderRates(): {
  dat: MockRate;
  truckstop: MockRate;
  freightWaves: MockRate;
} {
  const lane = createMockLane();
  const baseRate = 2400;

  return {
    dat: createMockRate({
      provider: "DAT",
      origin: lane.origin,
      destination: lane.destination,
      rate: baseRate + 100,
      spotRate: baseRate + 100,
      contractRate: baseRate,
    }),
    truckstop: createMockRate({
      provider: "Truckstop",
      origin: lane.origin,
      destination: lane.destination,
      rate: baseRate + 50,
      spotRate: baseRate + 50,
      contractRate: baseRate - 50,
    }),
    freightWaves: createMockRate({
      provider: "FreightWaves",
      origin: lane.origin,
      destination: lane.destination,
      rate: baseRate + 200,
      spotRate: baseRate + 200,
      contractRate: baseRate + 100,
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOS CYCLE GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate HOS logs for 70h/8d cycle scenario
 */
export function createMockHOSCycle70h8d(): MockHOSLog[] {
  const logs: MockHOSLog[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 6); // 7 days ago

  for (let day = 0; day < 7; day++) {
    const dayStart = new Date(startDate);
    dayStart.setDate(dayStart.getDate() + day);
    dayStart.setHours(6, 0, 0, 0);

    // Drive ~10 hours per day
    const endTime = new Date(dayStart);
    endTime.setHours(dayStart.getHours() + 10);

    logs.push(
      createMockHOSLog({
        startTime: new Date(dayStart),
        endTime: new Date(endTime),
        dutyStatus: "DRIVING",
        miles: 650,
      }),
    );
  }

  return logs;
}

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE/AUDIT GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

export interface MockInvoiceLine {
  lineId: string;
  description: string;
  rate: number;
  quantity: number;
  amount: number;
  type: string; // "freight", "fuel", "accessorial"
}

export function createMockInvoiceLine(
  overrides?: Partial<MockInvoiceLine>,
): MockInvoiceLine {
  const baseLine: MockInvoiceLine = {
    lineId: `line_${Math.random().toString(36).substr(2, 9)}`,
    description: "Freight charge",
    rate: 2500,
    quantity: 1,
    amount: 2500,
    type: "freight",
  };

  return { ...baseLine, ...overrides };
}

export interface MockInvoice {
  invoiceId: string;
  proNumber: string;
  bolNumber: string;
  carrierId: string;
  amount: number;
  lines: MockInvoiceLine[];
  invoiceDate: Date;
  invoicedBy: string;
}

export function createMockInvoice(overrides?: Partial<MockInvoice>): MockInvoice {
  const load = createMockLoad();
  const baseInvoice: MockInvoice = {
    invoiceId: `inv_${Math.random().toString(36).substr(2, 9)}`,
    proNumber: `PRO${Math.floor(Math.random() * 1000000000)}`,
    bolNumber: `BOL${Math.floor(Math.random() * 1000000000)}`,
    carrierId: `carrier_${Math.floor(Math.random() * 10000)}`,
    amount: 2750,
    lines: [
      createMockInvoiceLine({
        description: "Freight",
        amount: 2500,
        type: "freight",
      }),
      createMockInvoiceLine({
        description: "Fuel surcharge",
        amount: 250,
        type: "fuel",
      }),
    ],
    invoiceDate: new Date(),
    invoicedBy: "Carrier",
  };

  return { ...baseInvoice, ...overrides };
}
