/**
 * Locations Module Types
 *
 * Defines core types for location management, geo-fencing, and warehouse operations.
 * Pure TypeScript interfaces with no external dependencies.
 */

/**
 * Geographic coordinates (latitude/longitude)
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Location type enum
 */
export type LocationType = "warehouse" | "store" | "pickup_point" | "hub";

/**
 * Operating hours for a location (days of week)
 */
export interface OperatingHours {
  [day: string]: {
    open: string; // HH:mm format
    close: string; // HH:mm format
    isClosed?: boolean;
  };
}

/**
 * Contact information for a location
 */
export interface ContactInfo {
  name?: string;
  phone?: string;
  email?: string;
  manager?: string;
}

/**
 * Warehouse capacity tracking
 */
export interface WarehouseCapacity {
  totalSlots: number;
  usedSlots: number;
  available: number;
  utilizationPercent: number;
}

/**
 * Geo-fence type definition
 */
export type GeoFenceType = "circle" | "polygon";

/**
 * Geo-fence definition for location boundaries
 */
export interface GeoFence {
  type: GeoFenceType;
  center?: Coordinates; // Required for circle type
  radius?: number; // Radius in meters, required for circle type
  points?: Coordinates[]; // Array of points, required for polygon type
  color?: string; // Optional color for UI display (hex format)
}

/**
 * Result of geo-fence check operation
 */
export interface GeoFenceCheck {
  isInside: boolean;
  distance: number; // Distance in meters (negative if inside, positive if outside)
  nearestPoint: Coordinates; // Nearest point on the geo-fence boundary
}

/**
 * Main Location entity with all properties
 */
export interface Location {
  id: string;
  shopId: string;
  name: string;
  type: LocationType;
  address: string;
  coordinates: Coordinates;
  geofence?: GeoFence;
  operatingHours: OperatingHours;
  capacity?: WarehouseCapacity;
  contactInfo: ContactInfo;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Normalized address components
 */
export interface NormalizedAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  formatted: string;
}

/**
 * Search filter for finding locations
 */
export interface LocationSearchFilter {
  type?: LocationType;
  isActive?: boolean;
  nearCoordinates?: Coordinates;
  maxDistance?: number; // Distance in kilometers
  query?: string; // Full-text search on name/address
}

/**
 * Extended location with calculated distance
 */
export interface LocationWithDistance extends Location {
  distance: number; // Distance in kilometers
}

/**
 * Bounding box with cardinal directions
 */
export interface BoundingBox {
  nw: Coordinates; // Northwest corner
  ne: Coordinates; // Northeast corner
  sw: Coordinates; // Southwest corner
  se: Coordinates; // Southeast corner
}

/**
 * Coverage area analysis result
 */
export interface CoverageArea {
  totalAreaKm2: number;
  gaps: Coordinates[];
  warehouses: Location[];
}

/**
 * Warehouse assignment result
 */
export interface WarehouseAssignment {
  warehouse: Location;
  distance: number; // Distance in kilometers
  estimatedTime?: number; // Estimated delivery time in minutes
}
