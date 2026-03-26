import type { z } from 'zod';

export type PlatformType = 'doordash' | 'ubereats' | 'grubhub' | 'uberdirect';

export type DeliveryStatus =
  | 'created'
  | 'assigned'
  | 'picked-up'
  | 'in-transit'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export type ProofOfDeliveryType = 'photo' | 'signature' | 'none';

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country_code?: string;
}

export interface Contact {
  name: string;
  phone: string;
  email?: string;
}

export interface LastMileDelivery {
  id: string;
  platform: PlatformType;
  external_id: string;
  status: DeliveryStatus;
  order_id: string;

  pickup_location: Location;
  dropoff_location: Location;

  pickup_contact: Contact;
  dropoff_contact: Contact;

  item_count?: number;
  total_weight?: number;

  estimated_pickup_time?: Date;
  estimated_dropoff_time?: Date;
  actual_pickup_time?: Date;
  actual_dropoff_time?: Date;

  distance_meters?: number;
  duration_seconds?: number;

  driver?: LastMileDriver;
  tracking_url?: string;

  tip_amount?: number;

  notes?: string;
  special_instructions?: string;

  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface LastMileOrder {
  id: string;
  platform: PlatformType;
  external_id: string;

  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;

  merchant_id: string;
  merchant_name: string;

  items: OrderItem[];
  total_amount: number;
  currency: string;

  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'cancelled';

  delivery_address: Location;
  delivery_contact: Contact;

  scheduled_delivery_time?: Date;

  special_requests?: string;
  dietary_restrictions?: string[];

  created_at: Date;
  updated_at: Date;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions?: string;
}

export interface LastMileDriver {
  id: string;
  platform: PlatformType;
  external_id: string;

  first_name: string;
  last_name: string;
  phone: string;
  email?: string;

  vehicle?: {
    type: 'car' | 'bike' | 'scooter' | 'truck';
    make?: string;
    model?: string;
    year?: number;
    license_plate?: string;
    color?: string;
  };

  current_location?: Location;
  current_latitude?: number;
  current_longitude?: number;

  rating?: number;
  total_deliveries?: number;

  status: 'available' | 'on_delivery' | 'offline';

  created_at?: Date;
}

export interface LastMileQuote {
  id: string;
  platform: PlatformType;

  pickup_location: Location;
  dropoff_location: Location;

  distance_meters: number;
  duration_seconds: number;

  base_fee: number;
  distance_fee: number;
  time_fee: number;
  surge_multiplier: number;

  service_fee: number;
  small_order_fee?: number;

  subtotal: number;
  tax: number;
  total: number;

  currency: string;

  estimated_pickup_time: Date;
  estimated_dropoff_time: Date;

  valid_until: Date;
  expires_at: Date;

  platform_commission_rate: number;
  platform_commission_amount: number;
}

export interface LastMileTracking {
  delivery_id: string;
  platform: PlatformType;

  current_location: Location;
  current_latitude: number;
  current_longitude: number;

  status: DeliveryStatus;

  driver?: {
    id: string;
    name: string;
    phone?: string;
    rating?: number;
  };

  vehicle?: {
    type: string;
    license_plate?: string;
  };

  estimated_arrival: Date;
  distance_to_dropoff_meters: number;
  duration_to_dropoff_seconds: number;

  events: TrackingEvent[];
}

export interface TrackingEvent {
  timestamp: Date;
  status: DeliveryStatus;
  location?: Location;
  description: string;
  metadata?: Record<string, any>;
}

export interface LastMileConfig {
  platform: PlatformType;

  api_key?: string;
  api_secret?: string;

  oauth_client_id?: string;
  oauth_client_secret?: string;
  oauth_token?: string;
  oauth_refresh_token?: string;
  oauth_token_expires_at?: Date;

  jwt_developer_id?: string;
  jwt_key_id?: string;
  jwt_signing_secret?: string;

  webhook_secret?: string;
  webhook_url?: string;

  sandbox_mode?: boolean;

  business_id?: string;
  store_id?: string;
  merchant_id?: string;

  enabled: boolean;

  created_at: Date;
  updated_at: Date;
}

export interface LastMileWebhookEvent {
  id: string;
  platform: PlatformType;
  event_type: string;
  external_id?: string;

  delivery_id?: string;
  order_id?: string;
  driver_id?: string;

  status?: DeliveryStatus;
  previous_status?: DeliveryStatus;

  timestamp: Date;

  data: Record<string, any>;
  raw_payload: string;

  signature?: string;
  signature_verified: boolean;

  processed: boolean;
  processed_at?: Date;

  error?: string;

  created_at: Date;
}

export interface LastMileAdapterInterface {
  // Delivery operations
  createDelivery(delivery: Partial<LastMileDelivery>): Promise<LastMileDelivery>;
  getDelivery(delivery_id: string): Promise<LastMileDelivery | null>;
  updateDelivery(delivery_id: string, updates: Partial<LastMileDelivery>): Promise<LastMileDelivery>;
  cancelDelivery(delivery_id: string, reason?: string): Promise<LastMileDelivery>;
  listDeliveries(filters?: DeliveryFilterOptions): Promise<LastMileDelivery[]>;

  // Quotes
  getQuote(pickup: Location, dropoff: Location, options?: QuoteOptions): Promise<LastMileQuote>;

  // Tracking
  getTracking(delivery_id: string): Promise<LastMileTracking>;
  getTrackingByExternalId(external_id: string): Promise<LastMileTracking>;

  // Driver operations
  getDriver(driver_id: string): Promise<LastMileDriver | null>;
  listAvailableDrivers(location: Location, radius_meters?: number): Promise<LastMileDriver[]>;

  // Webhook
  verifyWebhookSignature(payload: string, signature: string): boolean;
  parseWebhookEvent(payload: string): LastMileWebhookEvent;
}

export interface DeliveryFilterOptions {
  status?: DeliveryStatus | DeliveryStatus[];
  order_id?: string;
  external_id?: string;
  created_after?: Date;
  created_before?: Date;
  limit?: number;
  offset?: number;
}

export interface QuoteOptions {
  item_count?: number;
  total_weight?: number;
  scheduled_pickup_time?: Date;
  scheduled_dropoff_time?: Date;
}

export interface DeliveryTimeEstimate {
  pickup_eta_minutes: number;
  dropoff_eta_minutes: number;
  total_duration_minutes: number;
  confidence_level: 'high' | 'medium' | 'low';
}

export interface DistanceCalculation {
  distance_km: number;
  distance_miles: number;
  distance_meters: number;
  duration_seconds: number;
  polyline?: string;
}

export interface FeeCalculation {
  base_fee: number;
  distance_fee: number;
  time_fee: number;
  surge_fee: number;
  service_fee: number;
  small_order_fee: number;
  tax: number;
  total_fee: number;
  currency: string;
}

export interface SurgePricingInfo {
  multiplier: number;
  is_surge: boolean;
  surge_reason?: string;
  normal_eta_minutes: number;
  surged_eta_minutes: number;
}

export interface PlatformMetrics {
  platform: PlatformType;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  cancelled_deliveries: number;

  success_rate: number;
  average_delivery_time_minutes: number;
  average_distance_km: number;

  total_revenue: number;
  total_commissions: number;
  net_revenue: number;

  average_rating: number;
  total_reviews: number;

  period: {
    start_date: Date;
    end_date: Date;
  };
}

export interface ProofOfDelivery {
  delivery_id: string;
  external_id: string;

  type: ProofOfDeliveryType;
  photo_urls?: string[];
  signature_url?: string;

  recipient_name?: string;
  recipient_signature?: boolean;

  timestamp: Date;

  verified: boolean;
  verified_at?: Date;
}

export interface RateLimitConfig {
  max_requests: number;
  window_seconds: number;
  per_second_limit?: number;
}

export interface CircuitBreakerConfig {
  failure_threshold: number;
  recovery_timeout_ms: number;
  success_threshold: number;
}
