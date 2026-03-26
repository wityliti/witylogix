/**
 * Core type definitions for the Witylogix SDK
 */

// ============================================================================
// Order Types
// ============================================================================

export interface Order {
  id: string;
  reference_number: string;
  status: OrderStatus;
  customer_id: string;
  origin: Location;
  destination: Location;
  items: OrderItem[];
  assigned_driver_id?: string;
  scheduled_date: string;
  time_slot?: TimeSlot;
  special_instructions?: string;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  weight?: number;
  dimensions?: Dimensions;
}

// ============================================================================
// Driver Types
// ============================================================================

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: DriverStatus;
  vehicle_id: string;
  current_location?: Location;
  assigned_zone_id?: string;
  available_capacity: number;
  total_capacity: number;
  created_at: string;
  updated_at: string;
}

export type DriverStatus = 'active' | 'inactive' | 'on_leave' | 'suspended';

export interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
}

// ============================================================================
// Zone Types
// ============================================================================

export interface Zone {
  id: string;
  name: string;
  polygon_coordinates: Location[];
  status: ZoneStatus;
  assigned_drivers: string[];
  capacity: number;
  created_at: string;
  updated_at: string;
}

export type ZoneStatus = 'active' | 'inactive' | 'maintenance';

export interface ZoneCheckResult {
  zone_id: string;
  inside: boolean;
  distance_to_boundary?: number;
}

// ============================================================================
// Shipment Types
// ============================================================================

export interface Shipment {
  id: string;
  order_id: string;
  tracking_number: string;
  status: ShipmentStatus;
  current_location?: Location;
  estimated_delivery: string;
  actual_delivery?: string;
  driver_id?: string;
  created_at: string;
  updated_at: string;
}

export type ShipmentStatus = 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned';

export interface ShipmentTracking {
  shipment_id: string;
  tracking_number: string;
  status: ShipmentStatus;
  location?: Location;
  last_update: string;
  events: TrackingEvent[];
}

export interface TrackingEvent {
  timestamp: string;
  status: ShipmentStatus;
  location?: Location;
  description?: string;
}

// ============================================================================
// Common Types
// ============================================================================

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
}

export interface Dimensions {
  length: number;
  width: number;
  height: number;
  unit: 'cm' | 'in';
}

export interface TimeSlot {
  start_time: string;
  end_time: string;
  date: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ListParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  [key: string]: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// ============================================================================
// Error Types
// ============================================================================

export interface ErrorOptions {
  status: number;
  code?: string;
  details?: Record<string, any>;
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface ClientConfig {
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
}
