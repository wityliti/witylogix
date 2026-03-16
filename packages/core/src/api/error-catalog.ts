/**
 * Standardized error catalog for the Witylogix API.
 * Centralized error definitions organized by domain with consistent structure.
 *
 * Usage:
 *   const error = ErrorCatalog.get('ORDER_NOT_FOUND');
 *   throw new AppError(error.message, error.httpStatus, error.code);
 */

export interface ErrorDefinition {
  code: string;
  httpStatus: number;
  messageTemplate: string;
  description: string;
  resolutionHint: string;
}

export interface ErrorRegistry {
  [key: string]: ErrorDefinition;
}

// ─── AUTHENTICATION ERRORS ──────────────────────────────────────

const AUTH_ERRORS: ErrorRegistry = {
  AUTH_INVALID_CREDENTIALS: {
    code: "AUTH_INVALID_CREDENTIALS",
    httpStatus: 401,
    messageTemplate: "Invalid email or password",
    description: "User provided incorrect credentials during login",
    resolutionHint: "Verify email and password, check for caps lock, reset if forgotten",
  },

  AUTH_ACCOUNT_LOCKED: {
    code: "AUTH_ACCOUNT_LOCKED",
    httpStatus: 401,
    messageTemplate: "Account locked due to too many failed login attempts",
    description: "User account is temporarily locked after failed login attempts",
    resolutionHint: "Wait 15 minutes or reset password to unlock account",
  },

  AUTH_EMAIL_NOT_VERIFIED: {
    code: "AUTH_EMAIL_NOT_VERIFIED",
    httpStatus: 403,
    messageTemplate: "Email not verified. Please check your email for verification link",
    description: "User has not verified their email address",
    resolutionHint: "Click verification link in email or request new verification email",
  },

  AUTH_EXPIRED_TOKEN: {
    code: "AUTH_EXPIRED_TOKEN",
    httpStatus: 401,
    messageTemplate: "Authentication token has expired",
    description: "JWT or refresh token has expired",
    resolutionHint: "Refresh your token or log in again",
  },

  AUTH_INVALID_TOKEN: {
    code: "AUTH_INVALID_TOKEN",
    httpStatus: 401,
    messageTemplate: "Invalid or malformed authentication token",
    description: "Provided token is invalid, malformed, or tampered with",
    resolutionHint: "Log in again to obtain a new token",
  },

  AUTH_MFA_REQUIRED: {
    code: "AUTH_MFA_REQUIRED",
    httpStatus: 403,
    messageTemplate: "Multi-factor authentication required",
    description: "User account has MFA enabled but code was not provided",
    resolutionHint: "Provide MFA code via /auth/mfa/verify endpoint",
  },

  AUTH_MFA_INVALID: {
    code: "AUTH_MFA_INVALID",
    httpStatus: 401,
    messageTemplate: "Invalid or expired MFA code",
    description: "MFA code is incorrect or has expired (typically 30 seconds)",
    resolutionHint: "Generate new code from authenticator app and try again",
  },

  AUTH_SESSION_EXPIRED: {
    code: "AUTH_SESSION_EXPIRED",
    httpStatus: 401,
    messageTemplate: "Session expired. Please log in again",
    description: "User session has timed out due to inactivity",
    resolutionHint: "Log in again to create new session",
  },

  AUTH_UNAUTHORIZED: {
    code: "AUTH_UNAUTHORIZED",
    httpStatus: 401,
    messageTemplate: "Authentication required",
    description: "Request requires authentication but none was provided",
    resolutionHint: "Include Authorization header with valid Bearer token",
  },

  AUTH_INSUFFICIENT_PERMISSIONS: {
    code: "AUTH_INSUFFICIENT_PERMISSIONS",
    httpStatus: 403,
    messageTemplate: "Insufficient permissions for this operation",
    description: "Authenticated user lacks required role/permission",
    resolutionHint: "Request access upgrade from organization admin",
  },
};

// ─── ORDER ERRORS ───────────────────────────────────────────────

const ORDER_ERRORS: ErrorRegistry = {
  ORDER_NOT_FOUND: {
    code: "ORDER_NOT_FOUND",
    httpStatus: 404,
    messageTemplate: "Order not found",
    description: "Requested order does not exist or has been deleted",
    resolutionHint: "Verify order ID and check if order was previously deleted",
  },

  ORDER_INVALID_STATUS_TRANSITION: {
    code: "ORDER_INVALID_STATUS_TRANSITION",
    httpStatus: 422,
    messageTemplate: "Cannot transition from {{currentStatus}} to {{newStatus}}",
    description: "Requested status transition violates state machine rules",
    resolutionHint: "Check order state machine documentation for valid transitions",
  },

  ORDER_ALREADY_ASSIGNED: {
    code: "ORDER_ALREADY_ASSIGNED",
    httpStatus: 409,
    messageTemplate: "Order is already assigned to a driver",
    description: "Cannot reassign an order that is already in progress",
    resolutionHint: "Cancel current assignment first or update to different driver",
  },

  ORDER_MISSING_REQUIRED_FIELDS: {
    code: "ORDER_MISSING_REQUIRED_FIELDS",
    httpStatus: 422,
    messageTemplate: "Missing required fields: {{fields}}",
    description: "Order creation/update missing mandatory fields",
    resolutionHint: "Provide all required fields: customerName, phone, address, items",
  },

  ORDER_INVALID_ADDRESS: {
    code: "ORDER_INVALID_ADDRESS",
    httpStatus: 422,
    messageTemplate: "Invalid shipping address",
    description: "Provided address fails validation or geocoding",
    resolutionHint: "Verify address format: street, city, state, postal code, country",
  },

  ORDER_BULK_LIMIT_EXCEEDED: {
    code: "ORDER_BULK_LIMIT_EXCEEDED",
    httpStatus: 422,
    messageTemplate: "Bulk operation exceeds limit of {{max}} orders",
    description: "Bulk create/update request contains too many items",
    resolutionHint: "Split request into chunks of max 1000 orders per request",
  },

  ORDER_CANNOT_CANCEL: {
    code: "ORDER_CANNOT_CANCEL",
    httpStatus: 422,
    messageTemplate: "Cannot cancel order in {{status}} status",
    description: "Order cannot be cancelled in current status",
    resolutionHint: "Only orders in PENDING/ASSIGNED status can be cancelled",
  },

  ORDER_DUPLICATE_REFERENCE: {
    code: "ORDER_DUPLICATE_REFERENCE",
    httpStatus: 409,
    messageTemplate: "Order with reference ID {{refId}} already exists",
    description: "Reference ID must be unique within organization",
    resolutionHint: "Use different reference ID or check for duplicate import",
  },
};

// ─── DRIVER ERRORS ──────────────────────────────────────────────

const DRIVER_ERRORS: ErrorRegistry = {
  DRIVER_NOT_FOUND: {
    code: "DRIVER_NOT_FOUND",
    httpStatus: 404,
    messageTemplate: "Driver not found",
    description: "Requested driver does not exist",
    resolutionHint: "Verify driver ID and check if driver was deleted",
  },

  DRIVER_INACTIVE: {
    code: "DRIVER_INACTIVE",
    httpStatus: 422,
    messageTemplate: "Driver is inactive or unavailable",
    description: "Cannot assign orders to inactive driver",
    resolutionHint: "Update driver status to AVAILABLE before assigning orders",
  },

  DRIVER_LICENSE_EXPIRED: {
    code: "DRIVER_LICENSE_EXPIRED",
    httpStatus: 422,
    messageTemplate: "Driver license has expired",
    description: "Driver's license expiration date has passed",
    resolutionHint: "Update driver profile with renewed license",
  },

  DRIVER_INSURANCE_EXPIRED: {
    code: "DRIVER_INSURANCE_EXPIRED",
    httpStatus: 422,
    messageTemplate: "Driver insurance has expired",
    description: "Driver's insurance policy has expired",
    resolutionHint: "Update driver profile with new insurance policy",
  },

  DRIVER_DOCUMENT_MISSING: {
    code: "DRIVER_DOCUMENT_MISSING",
    httpStatus: 422,
    messageTemplate: "Required document not provided: {{document}}",
    description: "Driver is missing required documents (license, insurance, etc)",
    resolutionHint: "Upload required documents to driver profile",
  },

  DRIVER_ASSIGNMENT_CAPACITY_EXCEEDED: {
    code: "DRIVER_ASSIGNMENT_CAPACITY_EXCEEDED",
    httpStatus: 422,
    messageTemplate: "Driver has reached maximum assignment capacity",
    description: "Cannot assign more orders to driver at current capacity",
    resolutionHint: "Wait for driver to complete deliveries or use different driver",
  },

  DRIVER_LOCATION_STALE: {
    code: "DRIVER_LOCATION_STALE",
    httpStatus: 422,
    messageTemplate: "Driver location data is stale ({{age}} minutes old)",
    description: "Last location update is older than acceptable threshold",
    resolutionHint: "Request driver to enable location sharing or update manually",
  },
};

// ─── DELIVERY ERRORS ────────────────────────────────────────────

const DELIVERY_ERRORS: ErrorRegistry = {
  DELIVERY_NOT_FOUND: {
    code: "DELIVERY_NOT_FOUND",
    httpStatus: 404,
    messageTemplate: "Delivery not found",
    description: "Requested delivery does not exist",
    resolutionHint: "Verify delivery ID",
  },

  DELIVERY_INVALID_STATUS_TRANSITION: {
    code: "DELIVERY_INVALID_STATUS_TRANSITION",
    httpStatus: 422,
    messageTemplate: "Invalid delivery status transition from {{current}} to {{target}}",
    description: "Status transition violates delivery state machine",
    resolutionHint: "Delivery status can only progress: PENDING → ASSIGNED → IN_PROGRESS → COMPLETED/FAILED",
  },

  DELIVERY_PROOF_REQUIRED: {
    code: "DELIVERY_PROOF_REQUIRED",
    httpStatus: 422,
    messageTemplate: "Delivery proof is required (signature/photo)",
    description: "Delivery requires proof of delivery but none provided",
    resolutionHint: "Provide signature or photo proof before completing delivery",
  },

  DELIVERY_RECIPIENT_UNREACHABLE: {
    code: "DELIVERY_RECIPIENT_UNREACHABLE",
    httpStatus: 422,
    messageTemplate: "Unable to reach recipient at delivery address",
    description: "Delivery failed because recipient was not available",
    resolutionHint: "Reschedule delivery for different time or use alternative contact",
  },

  DELIVERY_ADDRESS_INVALID: {
    code: "DELIVERY_ADDRESS_INVALID",
    httpStatus: 422,
    messageTemplate: "Delivery address is invalid or unreachable",
    description: "Address failed validation or geocoding",
    resolutionHint: "Verify and update address with customer",
  },

  DELIVERY_TIME_WINDOW_MISSED: {
    code: "DELIVERY_TIME_WINDOW_MISSED",
    httpStatus: 422,
    messageTemplate: "Scheduled delivery time window has passed",
    description: "Delivery time window has expired",
    resolutionHint: "Reschedule delivery for future time window",
  },
};

// ─── ZONE ERRORS ────────────────────────────────────────────────

const ZONE_ERRORS: ErrorRegistry = {
  ZONE_NOT_FOUND: {
    code: "ZONE_NOT_FOUND",
    httpStatus: 404,
    messageTemplate: "Zone not found",
    description: "Requested zone does not exist",
    resolutionHint: "Verify zone ID",
  },

  ZONE_INVALID_POLYGON: {
    code: "ZONE_INVALID_POLYGON",
    httpStatus: 422,
    messageTemplate: "Zone polygon is invalid (must be valid GeoJSON Polygon)",
    description: "Provided polygon does not conform to GeoJSON Polygon spec",
    resolutionHint: "Polygon must be GeoJSON format with valid coordinate rings",
  },

  ZONE_COORDINATES_OUTSIDE_BOUNDS: {
    code: "ZONE_COORDINATES_OUTSIDE_BOUNDS",
    httpStatus: 422,
    messageTemplate: "Coordinate {{lat}}, {{lng}} is outside valid bounds (±90 lat, ±180 lng)",
    description: "Provided coordinates are invalid",
    resolutionHint: "Latitude must be -90 to 90, longitude must be -180 to 180",
  },

  ZONE_OVERLAPPING: {
    code: "ZONE_OVERLAPPING",
    httpStatus: 409,
    messageTemplate: "Zone overlaps with existing zone {{existingZoneId}}",
    description: "Zone geometry conflicts with another zone",
    resolutionHint: "Adjust polygon or modify existing zone boundaries",
  },

  ZONE_DUPLICATE_NAME: {
    code: "ZONE_DUPLICATE_NAME",
    httpStatus: 409,
    messageTemplate: "Zone with name '{{name}}' already exists",
    description: "Zone names must be unique within organization",
    resolutionHint: "Use different zone name",
  },

  ZONE_STILL_IN_USE: {
    code: "ZONE_STILL_IN_USE",
    httpStatus: 422,
    messageTemplate: "Cannot delete zone - {{count}} active deliveries still assigned",
    description: "Zone cannot be deleted while deliveries are assigned to it",
    resolutionHint: "Complete or reassign deliveries before deleting zone",
  },
};

// ─── ORGANIZATION ERRORS ────────────────────────────────────────

const ORG_ERRORS: ErrorRegistry = {
  ORG_NOT_FOUND: {
    code: "ORG_NOT_FOUND",
    httpStatus: 404,
    messageTemplate: "Organization not found",
    description: "Requested organization does not exist",
    resolutionHint: "Verify organization ID or slug",
  },

  ORG_DUPLICATE_SLUG: {
    code: "ORG_DUPLICATE_SLUG",
    httpStatus: 409,
    messageTemplate: "Organization slug '{{slug}}' is already taken",
    description: "Organization slug must be globally unique",
    resolutionHint: "Choose different slug (lowercase alphanumeric + hyphens)",
  },

  ORG_INVALID_SLUG: {
    code: "ORG_INVALID_SLUG",
    httpStatus: 422,
    messageTemplate: "Invalid slug format (must be lowercase alphanumeric + hyphens)",
    description: "Slug does not match required format",
    resolutionHint: "Slug must be 1-100 characters, lowercase, alphanumeric and hyphens only",
  },

  ORG_MEMBER_NOT_FOUND: {
    code: "ORG_MEMBER_NOT_FOUND",
    httpStatus: 404,
    messageTemplate: "Member not found in organization",
    description: "User is not a member of this organization",
    resolutionHint: "Verify user is invited to organization first",
  },

  ORG_MEMBER_DUPLICATE: {
    code: "ORG_MEMBER_DUPLICATE",
    httpStatus: 409,
    messageTemplate: "User is already a member of this organization",
    description: "Cannot invite user who is already a member",
    resolutionHint: "Update existing member role instead",
  },

  ORG_INVITE_EXPIRED: {
    code: "ORG_INVITE_EXPIRED",
    httpStatus: 422,
    messageTemplate: "Invitation expired ({{expiresIn}} hours ago)",
    description: "Organization invite link has expired",
    resolutionHint: "Request new invitation from organization admin",
  },

  ORG_SUBSCRIPTION_REQUIRED: {
    code: "ORG_SUBSCRIPTION_REQUIRED",
    httpStatus: 402,
    messageTemplate: "Active subscription required for this feature",
    description: "Organization does not have valid subscription",
    resolutionHint: "Subscribe to plan or upgrade current subscription",
  },

  ORG_TRIAL_EXPIRED: {
    code: "ORG_TRIAL_EXPIRED",
    httpStatus: 402,
    messageTemplate: "Trial period expired",
    description: "Organization free trial has ended",
    resolutionHint: "Subscribe to paid plan to continue using service",
  },
};

// ─── INTEGRATION ERRORS ────────────────────────────────────────

const INTEGRATION_ERRORS: ErrorRegistry = {
  INTEGRATION_NOT_FOUND: {
    code: "INTEGRATION_NOT_FOUND",
    httpStatus: 404,
    messageTemplate: "Integration not found",
    description: "Requested integration does not exist",
    resolutionHint: "Install integration first via /integrations/:type/install",
  },

  INTEGRATION_ALREADY_INSTALLED: {
    code: "INTEGRATION_ALREADY_INSTALLED",
    httpStatus: 409,
    messageTemplate: "Integration already installed",
    description: "Cannot install integration that is already active",
    resolutionHint: "Update existing integration or uninstall first",
  },

  INTEGRATION_INVALID_CREDENTIALS: {
    code: "INTEGRATION_INVALID_CREDENTIALS",
    httpStatus: 422,
    messageTemplate: "Invalid integration credentials",
    description: "Provided credentials failed authentication with external service",
    resolutionHint: "Verify API key, token, or credentials are correct",
  },

  INTEGRATION_CONNECTION_FAILED: {
    code: "INTEGRATION_CONNECTION_FAILED",
    httpStatus: 502,
    messageTemplate: "Failed to connect to {{service}}",
    description: "Unable to reach external service",
    resolutionHint: "Check service status page, verify credentials, check network",
  },

  INTEGRATION_SYNC_FAILED: {
    code: "INTEGRATION_SYNC_FAILED",
    httpStatus: 502,
    messageTemplate: "Sync with {{service}} failed",
    description: "Data synchronization encountered error",
    resolutionHint: "Check integration settings, verify API limits not exceeded",
  },

  INTEGRATION_RATE_LIMIT: {
    code: "INTEGRATION_RATE_LIMIT",
    httpStatus: 429,
    messageTemplate: "Integration API rate limit exceeded",
    description: "External service rate limit reached",
    resolutionHint: "Wait before retrying, consider increasing API quota",
  },

  INTEGRATION_WEBHOOK_INVALID: {
    code: "INTEGRATION_WEBHOOK_INVALID",
    httpStatus: 422,
    messageTemplate: "Invalid webhook payload signature",
    description: "Webhook signature verification failed",
    resolutionHint: "Verify webhook signing secret matches, check request timing",
  },
};

// ─── BILLING ERRORS ────────────────────────────────────────────

const BILLING_ERRORS: ErrorRegistry = {
  BILLING_PLAN_NOT_FOUND: {
    code: "BILLING_PLAN_NOT_FOUND",
    httpStatus: 404,
    messageTemplate: "Billing plan not found",
    description: "Requested plan does not exist",
    resolutionHint: "List available plans via GET /billing/plans",
  },

  BILLING_SUBSCRIPTION_NOT_FOUND: {
    code: "BILLING_SUBSCRIPTION_NOT_FOUND",
    httpStatus: 404,
    messageTemplate: "Subscription not found",
    description: "Requested subscription does not exist",
    resolutionHint: "List subscriptions via GET /billing/subscriptions",
  },

  BILLING_PAYMENT_FAILED: {
    code: "BILLING_PAYMENT_FAILED",
    httpStatus: 402,
    messageTemplate: "Payment processing failed: {{reason}}",
    description: "Payment was declined or processing failed",
    resolutionHint: "Verify payment method, contact payment processor support",
  },

  BILLING_PAYMENT_METHOD_INVALID: {
    code: "BILLING_PAYMENT_METHOD_INVALID",
    httpStatus: 422,
    messageTemplate: "Invalid payment method",
    description: "Provided payment method information is invalid",
    resolutionHint: "Verify card number, expiry date, CVV are correct",
  },

  BILLING_INSUFFICIENT_FUNDS: {
    code: "BILLING_INSUFFICIENT_FUNDS",
    httpStatus: 402,
    messageTemplate: "Insufficient funds for this operation",
    description: "Account lacks sufficient balance or credit",
    resolutionHint: "Add funds to account or use different payment method",
  },

  BILLING_USAGE_EXCEEDED: {
    code: "BILLING_USAGE_EXCEEDED",
    httpStatus: 402,
    messageTemplate: "Usage limit exceeded for current plan",
    description: "Organization has exceeded plan usage limits",
    resolutionHint: "Upgrade to higher tier plan or wait for billing cycle reset",
  },

  BILLING_INVOICE_NOT_FOUND: {
    code: "BILLING_INVOICE_NOT_FOUND",
    httpStatus: 404,
    messageTemplate: "Invoice not found",
    description: "Requested invoice does not exist",
    resolutionHint: "Verify invoice ID",
  },
};

// ─── VALIDATION & FORMAT ERRORS ────────────────────────────────

const VALIDATION_ERRORS: ErrorRegistry = {
  VALIDATION_FAILED: {
    code: "VALIDATION_FAILED",
    httpStatus: 422,
    messageTemplate: "Request validation failed",
    description: "Request body/parameters failed schema validation",
    resolutionHint: "Check error details for specific field errors",
  },

  INVALID_JSON: {
    code: "INVALID_JSON",
    httpStatus: 400,
    messageTemplate: "Invalid JSON in request body",
    description: "Request body is not valid JSON",
    resolutionHint: "Verify JSON syntax is correct",
  },

  INVALID_CONTENT_TYPE: {
    code: "INVALID_CONTENT_TYPE",
    httpStatus: 415,
    messageTemplate: "Unsupported content type: {{contentType}}",
    description: "Request Content-Type header is not supported",
    resolutionHint: "Use Content-Type: application/json",
  },

  INVALID_QUERY_PARAMETER: {
    code: "INVALID_QUERY_PARAMETER",
    httpStatus: 422,
    messageTemplate: "Invalid query parameter: {{parameter}}",
    description: "Query parameter value is invalid",
    resolutionHint: "Check parameter format in API documentation",
  },

  MISSING_REQUIRED_HEADER: {
    code: "MISSING_REQUIRED_HEADER",
    httpStatus: 400,
    messageTemplate: "Missing required header: {{header}}",
    description: "Required HTTP header is missing",
    resolutionHint: "Include header in request",
  },

  INVALID_ENUM_VALUE: {
    code: "INVALID_ENUM_VALUE",
    httpStatus: 422,
    messageTemplate: "Invalid value '{{value}}' for {{field}}. Allowed: {{allowed}}",
    description: "Enum field has invalid value",
    resolutionHint: "Use one of the allowed values",
  },
};

// ─── SYSTEM & INFRASTRUCTURE ERRORS ────────────────────────────

const SYSTEM_ERRORS: ErrorRegistry = {
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    httpStatus: 500,
    messageTemplate: "Internal server error",
    description: "Unexpected server error occurred",
    resolutionHint: "Contact support if problem persists, include requestId",
  },

  SERVICE_UNAVAILABLE: {
    code: "SERVICE_UNAVAILABLE",
    httpStatus: 503,
    messageTemplate: "Service temporarily unavailable",
    description: "Server is temporarily unavailable (maintenance or overload)",
    resolutionHint: "Retry after a few moments",
  },

  DATABASE_ERROR: {
    code: "DATABASE_ERROR",
    httpStatus: 500,
    messageTemplate: "Database operation failed",
    description: "Database query or transaction failed",
    resolutionHint: "Contact support if problem persists",
  },

  CACHE_ERROR: {
    code: "CACHE_ERROR",
    httpStatus: 500,
    messageTemplate: "Cache operation failed",
    description: "Redis or cache layer error occurred",
    resolutionHint: "Retry operation or contact support",
  },

  QUEUE_ERROR: {
    code: "QUEUE_ERROR",
    httpStatus: 500,
    messageTemplate: "Background job processing failed",
    description: "Job queue or worker error occurred",
    resolutionHint: "Retry operation later or contact support",
  },

  EXTERNAL_SERVICE_ERROR: {
    code: "EXTERNAL_SERVICE_ERROR",
    httpStatus: 502,
    messageTemplate: "External service error: {{service}}",
    description: "Third-party service returned error",
    resolutionHint: "Check service status page, retry later",
  },

  TIMEOUT: {
    code: "TIMEOUT",
    httpStatus: 504,
    messageTemplate: "Request timeout (exceeded {{timeout}}ms)",
    description: "Request took too long to complete",
    resolutionHint: "Retry with more specific filters or smaller data set",
  },

  RATE_LIMIT_EXCEEDED: {
    code: "RATE_LIMIT_EXCEEDED",
    httpStatus: 429,
    messageTemplate: "Rate limit exceeded: {{limit}} requests per {{window}}",
    description: "Too many requests from this client",
    resolutionHint: "Wait {{resetIn}} seconds before retrying",
  },
};

// ─── COMBINED REGISTRY ──────────────────────────────────────────

export const ERROR_REGISTRY: ErrorRegistry = {
  ...AUTH_ERRORS,
  ...ORDER_ERRORS,
  ...DRIVER_ERRORS,
  ...DELIVERY_ERRORS,
  ...ZONE_ERRORS,
  ...ORG_ERRORS,
  ...INTEGRATION_ERRORS,
  ...BILLING_ERRORS,
  ...VALIDATION_ERRORS,
  ...SYSTEM_ERRORS,
};

// ─── ERROR CATALOG CLASS ────────────────────────────────────────

/**
 * Central error catalog for API responses.
 * Provides consistent error structure across all endpoints.
 */
export class ErrorCatalog {
  /**
   * Get error definition by code
   */
  static get(code: string): ErrorDefinition {
    const error = ERROR_REGISTRY[code];
    if (!error) {
      return ERROR_REGISTRY.INTERNAL_ERROR;
    }
    return error;
  }

  /**
   * Get error with template variables substituted
   */
  static getFormatted(code: string, variables: Record<string, any> = {}): ErrorDefinition {
    const error = this.get(code);
    return {
      ...error,
      messageTemplate: this.interpolate(error.messageTemplate, variables),
      resolutionHint: this.interpolate(error.resolutionHint, variables),
    };
  }

  /**
   * Check if error code exists
   */
  static exists(code: string): boolean {
    return code in ERROR_REGISTRY;
  }

  /**
   * List all error codes by domain
   */
  static listByDomain(domain: string): string[] {
    const prefix = `${domain.toUpperCase()}_`;
    return Object.keys(ERROR_REGISTRY).filter((code) =>
      code.startsWith(prefix),
    );
  }

  /**
   * Get all errors for a domain
   */
  static getDomain(domain: string): ErrorRegistry {
    const prefix = `${domain.toUpperCase()}_`;
    const result: ErrorRegistry = {};
    for (const [code, error] of Object.entries(ERROR_REGISTRY)) {
      if (code.startsWith(prefix)) {
        result[code] = error;
      }
    }
    return result;
  }

  /**
   * Simple string interpolation for template variables
   */
  private static interpolate(template: string, variables: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, "g"), String(value));
    }
    return result;
  }
}

// ─── EXPORT TYPES ───────────────────────────────────────────────

export type { ErrorDefinition, ErrorRegistry };

/**
 * List of all error codes for type safety
 */
export const ERROR_CODES = Object.keys(ERROR_REGISTRY) as const;
export type ErrorCode = typeof ERROR_CODES[number];
