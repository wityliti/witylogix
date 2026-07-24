/**
 * Auto-generated TypeScript types from OpenAPI v2.0 spec
 * Do not edit manually. Regenerate using: npm run generate:types
 * Last generated: 2025-03-16
 */

// ─── Pagination ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ─── Error Responses ─────────────────────────────────────────────────

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any> | any[];
    requestId: string;
  };
}

// ─── Authentication ──────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
  shopDomain: string;
}

export interface DriverLoginRequest {
  phone: string;
  password: string;
  shopDomain: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user?: {
    id: string;
    email: string;
    name: string;
    role: "SUPER_ADMIN" | "ADMIN" | "DISPATCHER" | "DRIVER" | "CUSTOMER";
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface MfaSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface MfaVerifyRequest {
  code: string;
  deviceId?: string;
}

export interface PasswordResetRequest {
  email: string;
  shopDomain: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
}

// ─── Orders ──────────────────────────────────────────────────────────

export type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "ASSIGNED"
  | "PICKED_UP"
  | "OUT_FOR_DELIVERY"
  | "ARRIVED"
  | "DELIVERED"
  | "FAILED"
  | "RETURNED"
  | "CANCELLED";

export interface LineItem {
  shopifyLineId: string;
  title: string;
  quantity: number;
  price: number;
  sku?: string | null;
  grams?: number | null;
  variant?: string;
}

export interface Order {
  id: string;
  shopId: string;
  shopifyOrderId?: string | null;
  shopifyOrderNumber?: string | null;
  status: OrderStatus;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  province?: string | null;
  postalCode: string;
  country: string;
  deliveryDate?: string | null;
  deliveryTimeWindow?: {
    start: string;
    end: string;
  } | null;
  driverId?: string | null;
  totalPrice?: number | null;
  totalWeight?: number | null;
  itemCount: number;
  lineItems: LineItem[];
  trackingToken: string;
  tags: string[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderRequest {
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  province?: string | null;
  postalCode: string;
  country: string;
  deliveryDate?: string | null;
  totalPrice?: number | null;
  notes?: string | null;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
  notes?: string | null;
  proofOfDelivery?: {
    signatureUrl: string;
    photosUrls: string[];
  } | null;
}

export interface AssignOrderRequest {
  driverId: string;
}

export interface OrderTimeline {
  status: OrderStatus;
  timestamp: string;
  notes?: string | null;
}

// ─── Drivers ─────────────────────────────────────────────────────────

export type DriverStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED";
export type DriverOperationalStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "ON_DELIVERY"
  | "BREAK"
  | "UNAVAILABLE";
export type VehicleType = "MOTORCYCLE" | "CAR" | "VAN" | "TRUCK";

export interface Driver {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  email?: string | null;
  status: DriverStatus;
  vehicleType?: VehicleType | null;
  vehicleLicensePlate?: string | null;
  license?: {
    number: string;
    expiryDate: string;
  } | null;
  currentLocation?: {
    latitude: number;
    longitude: number;
    updatedAt: string;
  } | null;
  assignedOrders: number;
  completedDeliveries: number;
  averageRating?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDriverRequest {
  name: string;
  phone: string;
  email?: string | null;
  vehicleType?: VehicleType | null;
  vehicleLicensePlate?: string | null;
}

export interface UpdateDriverRequest {
  name?: string;
  phone?: string;
  email?: string | null;
  status?: DriverStatus;
  vehicleType?: VehicleType | null;
  vehicleLicensePlate?: string | null;
}

export interface DriverStatusUpdate {
  status: DriverOperationalStatus;
}

export interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

// ─── Zones ───────────────────────────────────────────────────────────

export interface DeliveryRate {
  minWeight: number;
  maxWeight?: number | null;
  rate: number;
  currency: string;
}

export interface Zone {
  id: string;
  shopId: string;
  name: string;
  description?: string | null;
  geometry?: Record<string, any> | null;
  deliveryRates: DeliveryRate[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateZoneRequest {
  name: string;
  description?: string | null;
  geometry?: Record<string, any> | null;
}

// ─── Routes ──────────────────────────────────────────────────────────

export type RouteStatus =
  | "DRAFT"
  | "OPTIMIZED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
export type StopType = "PICKUP" | "DELIVERY" | "RETURN" | "DEPOT";
export type StopStatus =
  | "PENDING"
  | "EN_ROUTE"
  | "ARRIVED"
  | "COMPLETED"
  | "SKIPPED"
  | "FAILED";

export interface RouteStop {
  id: string;
  sequence: number;
  orderId?: string | null;
  stopType: StopType;
  status: StopStatus;
  actualArrival?: string | null;
  departedAt?: string | null;
}

export interface Route {
  id: string;
  shopId: string;
  date: string;
  status: RouteStatus;
  driverId?: string | null;
  name?: string | null;
  totalDistance: number;
  estimatedDuration: number;
  stops: RouteStop[];
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRouteRequest {
  date: string;
  name?: string | null;
  driverId?: string | null;
  orderIds?: string[];
}

export interface CreateRouteStopRequest {
  orderId?: string | null;
  sequence: number;
  stopType?: StopType;
}

// ─── Integrations ────────────────────────────────────────────────────

export type IntegrationType =
  | "SHOPIFY"
  | "WOOCOMMERCE"
  | "MAGENTO"
  | "CUSTOM_API"
  | "CUSTOM_WEBHOOK";
export type IntegrationStatus = "INACTIVE" | "CONFIGURED" | "ACTIVE" | "ERROR";

export interface Integration {
  id: string;
  shopId: string;
  type: IntegrationType;
  status: IntegrationStatus;
  webhookUrl?: string | null;
  webhookSecret?: string | null;
  config: Record<string, any>;
  lastSyncAt?: string | null;
  lastErrorAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstallIntegrationRequest {
  type: IntegrationType;
  config?: Record<string, any> | null;
}

export interface IntegrationHealth {
  status: "HEALTHY" | "DEGRADED" | "ERROR";
  lastSyncAt?: string | null;
  lastError?: string | null;
}

// ─── Webhooks ────────────────────────────────────────────────────────

export type WebhookEvent =
  | "order.created"
  | "order.updated"
  | "order.assigned"
  | "order.status_changed"
  | "delivery.completed"
  | "delivery.failed"
  | "driver.location_updated"
  | "route.optimized"
  | "integration.error";

export type WebhookDeliveryStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "RETRYING";

export interface WebhookEndpoint {
  id: string;
  shopId: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  isActive: boolean;
  failureCount: number;
  lastDeliveryAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  payload: Record<string, any>;
  signature: string;
  status: WebhookDeliveryStatus;
  statusCode?: number | null;
  responseBody?: string | null;
  retryCount: number;
  nextRetryAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookRequest {
  url: string;
  events: WebhookEvent[];
  isActive?: boolean;
}

export interface WebhookPayload<T = any> {
  id: string;
  type: WebhookEvent;
  createdAt: string;
  data: T;
  attempt: number;
}

// Event Data Types
export interface OrderCreatedEvent {
  id: string;
  shopId: string;
  shopifyOrderId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  country: string;
  totalPrice?: number;
  itemCount: number;
  status: OrderStatus;
  createdAt: string;
}

export interface OrderStatusChangedEvent {
  id: string;
  oldStatus: OrderStatus;
  newStatus: OrderStatus;
  reason?: string;
  timestamp: string;
}

export interface DeliveryCompletedEvent {
  orderId: string;
  driverId: string;
  completedAt: string;
  proofOfDelivery?: {
    signatureUrl?: string;
    photoUrls: string[];
  };
}

export interface DriverLocationUpdatedEvent {
  driverId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
}

// ─── Admin ───────────────────────────────────────────────────────────

export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "DISPATCHER"
  | "DRIVER"
  | "CUSTOMER";
export type PlanType = "FREE" | "PRO" | "ENTERPRISE";

export interface User {
  id: string;
  shopId: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  plan: PlanType;
  maxShops: number;
  maxUsers: number;
  isActive: boolean;
  createdAt: string;
}

export interface HealthCheck {
  database: "ok" | "error";
  redis: "ok" | "error";
  queues?: "ok" | "error";
}

// ─── API Keys ────────────────────────────────────────────────────────

export type ApiKeyType = "LIVE" | "TEST";

export interface ApiKeyResponse {
  id: string;
  key?: string; // Only returned on creation
  name: string;
  type: ApiKeyType;
  scopes: string[];
  lastUsedAt?: string | null;
  createdAt: string;
}

export interface CreateApiKeyRequest {
  name: string;
  type: ApiKeyType;
  scopes: string[];
}

// ─── Tenants ─────────────────────────────────────────────────────────

export interface TenantConfig {
  plan: PlanType;
  limits: {
    ordersPerMinute: number;
    webhookEventsPerMinute: number;
    routeOptimizationsPerMinute: number;
  };
}

export interface TenantUsage {
  plan: PlanType;
  limits: {
    ordersPerMinute: number;
    webhookEventsPerMinute: number;
    routeOptimizationsPerMinute: number;
  };
  currentUsage: {
    ordersThisMinute: number;
    webhookEventsThisMinute: number;
    routeOptimizationsThisMinute: number;
  };
  resetAt: string;
}

// ─── API Response Wrappers ───────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
}

export interface ApiListResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ─── Rate Limit Info ─────────────────────────────────────────────────

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// ─── Request Context ────────────────────────────────────────────────

export interface RequestContext {
  shopId: string;
  userId?: string;
  role?: UserRole;
  orgId?: string;
}

// ─── Batch Operations ───────────────────────────────────────────────

export interface BatchStatusUpdate {
  id: string;
  status: OrderStatus;
  notes?: string;
}

export interface BatchStatusUpdateRequest {
  updates: BatchStatusUpdate[];
}

// ─── SDK Client Options ─────────────────────────────────────────────

export interface WitylogixClientConfig {
  baseUrl?: string;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  onTokenRefresh?: (tokens: {
    accessToken: string;
    refreshToken: string;
  }) => void;
  retryConfig?: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  };
  timeout?: number;
}

// ─── Helper Types ───────────────────────────────────────────────────

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// ─── Date Types ─────────────────────────────────────────────────────

export type DateISO = string; // ISO 8601 format
export type TimeISO = string; // ISO 8601 format
export type DateString = string; // YYYY-MM-DD format

// ─── Coordinate Types ───────────────────────────────────────────────

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  coordinates?: Coordinate;
}

// ─── Query Parameters ───────────────────────────────────────────────

export interface ListOrdersQuery extends PaginationQuery {
  status?: OrderStatus;
  driverId?: string;
  deliveryDate?: DateString;
  search?: string;
  sortBy?: "createdAt" | "deliveryDate" | "status" | "customerName";
}

export interface ListDriversQuery extends PaginationQuery {
  status?: DriverStatus;
  search?: string;
}

export interface ListRoutesQuery extends PaginationQuery {
  date?: DateString;
  driverId?: string;
  status?: RouteStatus;
}

// Export all types as namespace for convenience
export namespace Witylogix {
  export type {
    Order,
    Driver,
    Zone,
    Route,
    Integration,
    WebhookEndpoint,
    User,
    ApiKeyResponse,
  };
}
