/**
 * Dispatch Test Fixtures and Mock Data
 * Provides realistic test data for dispatch dashboard tests
 */

export const mockDrivers = [
  {
    id: "driver-001",
    name: "John Smith",
    email: "john.smith@witylogix.com",
    phone: "+1234567890",
    vehicle: {
      plate: "DL-01-AB-1234",
      type: "Van",
      capacity: 25,
    },
    rating: 4.8,
    status: "active",
    currentLocation: {
      lat: 40.7128,
      lng: -74.006,
    },
  },
  {
    id: "driver-002",
    name: "Maria Garcia",
    email: "maria.garcia@witylogix.com",
    phone: "+1234567891",
    vehicle: {
      plate: "DL-02-CD-5678",
      type: "Truck",
      capacity: 40,
    },
    rating: 4.9,
    status: "active",
    currentLocation: {
      lat: 40.758,
      lng: -73.9855,
    },
  },
  {
    id: "driver-003",
    name: "Ahmed Hassan",
    email: "ahmed.hassan@witylogix.com",
    phone: "+1234567892",
    vehicle: {
      plate: "DL-03-EF-9012",
      type: "Van",
      capacity: 20,
    },
    rating: 4.6,
    status: "on-break",
    currentLocation: {
      lat: 40.7489,
      lng: -73.968,
    },
  },
];

export const mockRoutes = [
  {
    id: "route-001",
    driverId: "driver-001",
    driverName: "John Smith",
    status: "in-progress",
    color: "#FF6B6B",
    stops: [
      {
        id: "stop-001",
        orderId: "ORD-001",
        address: "123 Main St, New York, NY 10001",
        phone: "+1111111111",
        timeWindow: "09:00-10:00",
        items: 2,
        status: "delivered",
      },
      {
        id: "stop-002",
        orderId: "ORD-002",
        address: "456 Park Ave, New York, NY 10022",
        phone: "+1111111112",
        timeWindow: "10:15-11:00",
        items: 1,
        status: "in-progress",
      },
      {
        id: "stop-003",
        orderId: "ORD-003",
        address: "789 Broadway, New York, NY 10003",
        phone: "+1111111113",
        timeWindow: "11:30-12:30",
        items: 3,
        status: "pending",
      },
    ],
    estimatedTime: "2h 45m",
    totalDistance: "12.5 km",
    completionPercentage: 33,
  },
  {
    id: "route-002",
    driverId: "driver-002",
    driverName: "Maria Garcia",
    status: "in-progress",
    color: "#4ECDC4",
    stops: [
      {
        id: "stop-004",
        orderId: "ORD-004",
        address: "321 5th Ave, New York, NY 10016",
        phone: "+1111111114",
        timeWindow: "08:00-09:00",
        items: 4,
        status: "delivered",
      },
      {
        id: "stop-005",
        orderId: "ORD-005",
        address: "654 Madison Ave, New York, NY 10065",
        phone: "+1111111115",
        timeWindow: "09:30-10:30",
        items: 2,
        status: "in-progress",
      },
    ],
    estimatedTime: "1h 30m",
    totalDistance: "8.3 km",
    completionPercentage: 50,
  },
];

export const mockUnscheduledStops = [
  {
    id: "stop-006",
    orderId: "ORD-006",
    address: "111 Central Park West, New York, NY 10023",
    phone: "+1111111116",
    timeWindow: "13:00-14:00",
    items: 1,
    weight: 2.5,
    volume: 0.05,
  },
  {
    id: "stop-007",
    orderId: "ORD-007",
    address: "222 Columbus Ave, New York, NY 10024",
    phone: "+1111111117",
    timeWindow: "14:00-15:00",
    items: 2,
    weight: 5.0,
    volume: 0.1,
  },
  {
    id: "stop-008",
    orderId: "ORD-008",
    address: "333 Amsterdam Ave, New York, NY 10025",
    phone: "+1111111118",
    timeWindow: "flexible",
    items: 3,
    weight: 7.5,
    volume: 0.15,
  },
];

export const mockMapMarkers = [
  {
    id: "driver-001-marker",
    type: "driver",
    driverId: "driver-001",
    lat: 40.7128,
    lng: -74.006,
    icon: "driver",
    color: "#FF6B6B",
  },
  {
    id: "driver-002-marker",
    type: "driver",
    driverId: "driver-002",
    lat: 40.758,
    lng: -73.9855,
    icon: "driver",
    color: "#4ECDC4",
  },
  {
    id: "stop-001-marker",
    type: "stop",
    stopId: "stop-001",
    lat: 40.71455,
    lng: -74.00712,
    icon: "stop",
    color: "#FFD93D",
  },
  {
    id: "stop-002-marker",
    type: "stop",
    stopId: "stop-002",
    lat: 40.76078,
    lng: -73.9855,
    icon: "stop",
    color: "#FFD93D",
  },
];

export const mockDispatchStats = {
  activeDrivers: 2,
  totalStops: 8,
  totalKm: "20.8 km",
  totalTime: "4h 15m",
  completedStops: 3,
  pendingStops: 5,
  onTimePercentage: 95,
};

/**
 * Get mock data for dispatch tests
 */
export function getDispatchTestData() {
  return {
    drivers: mockDrivers,
    routes: mockRoutes,
    unscheduledStops: mockUnscheduledStops,
    mapMarkers: mockMapMarkers,
    stats: mockDispatchStats,
  };
}

/**
 * Mock route optimization response
 */
export const routeOptimizationResponse = {
  originalRoutes: 2,
  optimizedRoutes: 2,
  distanceSaved: "2.5 km",
  timeSaved: "15 minutes",
  routes: [
    {
      id: "route-001-optimized",
      driverId: "driver-001",
      stops: ["stop-001", "stop-003", "stop-002"],
      estimatedTime: "2h 30m",
      totalDistance: "11.2 km",
    },
    {
      id: "route-002-optimized",
      driverId: "driver-002",
      stops: ["stop-004", "stop-005", "stop-006"],
      estimatedTime: "1h 45m",
      totalDistance: "9.1 km",
    },
  ],
};

/**
 * Mock real-time stats update
 */
export const realtimeStatsUpdate = {
  activeDrivers: 3,
  totalStops: 12,
  totalKm: "28.5 km",
  totalTime: "5h 30m",
  completedStops: 5,
  pendingStops: 7,
  onTimePercentage: 92,
};

/**
 * Mock stop detail response
 */
export const mockStopDetail = {
  id: "stop-001",
  orderId: "ORD-001",
  address: "123 Main St, New York, NY 10001",
  coordinates: {
    lat: 40.71455,
    lng: -74.00712,
  },
  phone: "+1111111111",
  email: "customer@example.com",
  timeWindow: {
    start: "09:00",
    end: "10:00",
  },
  items: [
    {
      id: "item-1",
      name: "Electronics Package",
      quantity: 1,
      weight: 2.5,
    },
    {
      id: "item-2",
      name: "Books",
      quantity: 1,
      weight: 3.0,
    },
  ],
  notes: "Leave at front desk if not answered",
  specialInstructions: "Signature required",
  status: "delivered",
  deliveredAt: "2026-03-11T09:15:00Z",
};
