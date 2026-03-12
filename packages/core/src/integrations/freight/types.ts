/**
 * Freight Integration Types
 *
 * Core data structures for freight board integrations including load posting,
 * rating, carrier profiles, and shipment tracking.
 */

/**
 * Equipment type enumeration for freight shipments
 */
export enum EquipmentType {
  DRY_VAN = "dry_van",
  REEFER = "reefer",
  FLATBED = "flatbed",
  STEP_DECK = "step_deck",
  TANK = "tank",
  DROP_DECK = "drop_deck",
  POWER_ONLY = "power_only",
  CONTAINER = "container",
  SPECIALIZED = "specialized",
}

/**
 * Shipment status tracking states
 */
export enum ShipmentStatus {
  PENDING = "pending",
  BOOKED = "booked",
  IN_TRANSIT = "in_transit",
  AT_DESTINATION = "at_destination",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
  EXCEPTION = "exception",
}

/**
 * Carrier rating factors
 */
export enum CarrierRatingFactor {
  SAFETY = "safety",
  RELIABILITY = "reliability",
  COMPLIANCE = "compliance",
  RESPONSIVENESS = "responsiveness",
  EQUIPMENT_QUALITY = "equipment_quality",
  CUSTOMER_SERVICE = "customer_service",
}

/**
 * Compliance document types
 */
export enum ComplianceDocumentType {
  MC_AUTHORITY = "mc_authority",
  INSURANCE = "insurance",
  HAZMAT_CERT = "hazmat_cert",
  CVOR = "cvor",
  SAFETY_RECORD = "safety_record",
  CSA_SCORES = "csa_scores",
  BACKGROUND_CHECK = "background_check",
}

/**
 * Freight adapter configuration
 */
export interface FreightConfig {
  /** API provider identifier */
  providerId: string;

  /** API authentication credentials */
  apiKey?: string;
  apiSecret?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;

  /** API endpoint base URL */
  baseUrl: string;

  /** OAuth token endpoint (if applicable) */
  tokenUrl?: string;

  /** Rate limiting configuration */
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };

  /** Circuit breaker configuration */
  circuitBreaker: {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
  };

  /** Retry configuration */
  retry: {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier: number;
  };

  /** Enable debug logging */
  debug?: boolean;

  /** Webhook secret for event validation */
  webhookSecret?: string;

  /** Custom headers to include in requests */
  customHeaders?: Record<string, string>;
}

/**
 * Load posting data structure
 */
export interface LoadPosting {
  /** Unique load identifier */
  loadId: string;

  /** Origin location */
  origin: Location;

  /** Destination location */
  destination: Location;

  /** Equipment type required */
  equipmentType: EquipmentType;

  /** Weight in pounds */
  weight: number;

  /** Length in feet */
  length: number;

  /** Pickup date/time */
  pickupDate: Date;

  /** Delivery date/time */
  deliveryDate: Date;

  /** Freight rate in dollars */
  rate: number;

  /** Currency code (default: USD) */
  currency?: string;

  /** Additional rate components */
  rateBreakdown?: {
    baseCost: number;
    fuel?: number;
    accessorial?: number;
    other?: number;
  };

  /** Commodity description */
  commodity: string;

  /** Hazmat flag */
  isHazmat: boolean;

  /** Additional load attributes */
  attributes?: string[];

  /** Shipper contact information */
  shipper: Contact;

  /** Receiver contact information */
  receiver: Contact;

  /** Posting broker/party */
  broker?: Contact;

  /** Special instructions */
  specialInstructions?: string;

  /** Load status */
  status: ShipmentStatus;

  /** Created timestamp */
  createdAt: Date;

  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Location structure
 */
export interface Location {
  /** Street address */
  address: string;

  /** City */
  city: string;

  /** State/Province */
  state: string;

  /** ZIP/Postal code */
  postalCode: string;

  /** Country code */
  country: string;

  /** Latitude */
  latitude?: number;

  /** Longitude */
  longitude?: number;
}

/**
 * Contact information
 */
export interface Contact {
  /** Full name */
  name: string;

  /** Email address */
  email: string;

  /** Phone number */
  phone: string;

  /** Company name */
  company?: string;
}

/**
 * Freight rate quote
 */
export interface FreightQuote {
  /** Unique quote identifier */
  quoteId: string;

  /** Associated load posting ID */
  loadId: string;

  /** Carrier providing the quote */
  carrier: CarrierProfile;

  /** Quoted amount in dollars */
  amount: number;

  /** Currency code */
  currency: string;

  /** Quote validity period (hours) */
  validityHours: number;

  /** Pickup date */
  pickupDate: Date;

  /** Delivery date estimate */
  deliveryDate: Date;

  /** Equipment offered */
  equipmentType: EquipmentType;

  /** Transit time estimate in hours */
  transitHours?: number;

  /** Additional quote terms */
  terms?: string;

  /** Quote status */
  status: "pending" | "accepted" | "rejected" | "expired";

  /** Created timestamp */
  createdAt: Date;

  /** Expires timestamp */
  expiresAt: Date;
}

/**
 * Carrier profile and ratings
 */
export interface CarrierProfile {
  /** Unique carrier identifier */
  carrierId: string;

  /** Company legal name */
  legalName: string;

  /** Operating name (DBA) */
  operatingName?: string;

  /** MC number (Motor Carrier) */
  mcNumber?: string;

  /** USDOT number */
  usdotNumber?: string;

  /** Dun & Bradstreet number */
  dunNumber?: string;

  /** Business type */
  businessType: "for_hire" | "private" | "broker" | "owner_operator";

  /** Number of tractors */
  tractorCount?: number;

  /** Number of trailers */
  trailerCount?: number;

  /** Contact information */
  contact: Contact;

  /** Headquarters location */
  headquarters: Location;

  /** Service area states/regions */
  serviceArea?: string[];

  /** Equipment types operated */
  equipmentTypes: EquipmentType[];

  /** Overall rating (0-100) */
  overallRating: number;

  /** Detailed ratings by factor */
  ratings: Map<CarrierRatingFactor, number>;

  /** Insurance information */
  insurance?: {
    provider: string;
    policyNumber: string;
    coverage: number;
    expirationDate: Date;
  };

  /** Compliance documents */
  complianceDocuments: ComplianceDocument[];

  /** Years in operation */
  yearsInOperation?: number;

  /** Preferred lanes (if specialty carrier) */
  preferredLanes?: string[];

  /** Created timestamp */
  createdAt: Date;

  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Lane rate information
 */
export interface LaneRate {
  /** Unique lane identifier (origin-destination pair) */
  laneId: string;

  /** Origin state or city */
  origin: string;

  /** Destination state or city */
  destination: string;

  /** Equipment type */
  equipmentType: EquipmentType;

  /** Current rate per mile */
  ratePerMile: number;

  /** Typical weight capacity */
  typicalWeight?: number;

  /** Typical revenue per load */
  typicalRevenue?: number;

  /** Market volatility index (0-100) */
  volatilityIndex: number;

  /** Supply/demand ratio */
  supplyDemandRatio?: number;

  /** Average number of loads per day */
  dailyLoadCount?: number;

  /** 7-day trend (percentage change) */
  weeklyTrend?: number;

  /** 30-day trend (percentage change) */
  monthlyTrend?: number;

  /** Effective date */
  effectiveDate: Date;

  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Booking confirmation
 */
export interface BookingConfirmation {
  /** Unique booking confirmation number */
  confirmationNumber: string;

  /** Associated load ID */
  loadId: string;

  /** Selected carrier */
  carrier: CarrierProfile;

  /** Booked rate in dollars */
  bookedRate: number;

  /** Driver information */
  driver?: {
    name: string;
    licenseNumber?: string;
    phone: string;
  };

  /** Equipment details */
  equipment?: {
    type: EquipmentType;
    number?: string;
    year?: number;
  };

  /** Pickup window */
  pickupWindow: {
    start: Date;
    end: Date;
  };

  /** Delivery window */
  deliveryWindow?: {
    start: Date;
    end: Date;
  };

  /** Booking status */
  status: "confirmed" | "pending" | "cancelled";

  /** Reference numbers for carrier systems */
  carrierReferences?: Record<string, string>;

  /** Created timestamp */
  createdAt: Date;
}

/**
 * Shipment tracking information
 */
export interface ShipmentTracking {
  /** Unique shipment/tracking number */
  trackingNumber: string;

  /** Associated load ID */
  loadId: string;

  /** Associated booking confirmation */
  confirmationNumber?: string;

  /** Carrier operating the shipment */
  carrier: CarrierProfile;

  /** Current shipment status */
  status: ShipmentStatus;

  /** Current location */
  currentLocation?: Location;

  /** Pickup actual timestamp */
  pickedUpAt?: Date;

  /** Delivered actual timestamp */
  deliveredAt?: Date;

  /** Estimated delivery time */
  estimatedDelivery?: Date;

  /** Location history */
  locationHistory: Array<{
    location: Location;
    timestamp: Date;
    status: ShipmentStatus;
  }>;

  /** Exception events */
  exceptions?: Array<{
    code: string;
    description: string;
    timestamp: Date;
  }>;

  /** Special events */
  events?: Array<{
    eventType: string;
    description: string;
    timestamp: Date;
    location?: Location;
  }>;

  /** Proof of delivery document */
  proofOfDelivery?: {
    signature: string;
    receivedBy: string;
    timestamp: Date;
  };

  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Freight invoice
 */
export interface FreightInvoice {
  /** Unique invoice number */
  invoiceNumber: string;

  /** Associated load ID */
  loadId: string;

  /** Tracking/shipment number */
  trackingNumber?: string;

  /** Shipper information */
  shipper: Contact;

  /** Receiver information */
  receiver: Contact;

  /** Carrier information */
  carrier: CarrierProfile;

  /** Invoice date */
  invoiceDate: Date;

  /** Due date */
  dueDate: Date;

  /** Line items */
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;

  /** Subtotal before taxes/fees */
  subtotal: number;

  /** Tax amount */
  tax?: number;

  /** Fuel surcharge */
  fuelSurcharge?: number;

  /** Other fees/charges */
  fees?: number;

  /** Total amount due */
  total: number;

  /** Currency code */
  currency: string;

  /** Payment terms */
  paymentTerms?: string;

  /** Invoice status */
  status: "draft" | "issued" | "paid" | "overdue";

  /** Payment reference */
  paymentReference?: string;
}

/**
 * Compliance document
 */
export interface ComplianceDocument {
  /** Document identifier */
  documentId: string;

  /** Document type */
  type: ComplianceDocumentType;

  /** Document name/title */
  name: string;

  /** Issue date */
  issuedDate: Date;

  /** Expiration date */
  expirationDate?: Date;

  /** Issuing authority */
  issuingAuthority?: string;

  /** Document number/reference */
  documentNumber?: string;

  /** Storage URL or file path */
  documentUrl?: string;

  /** Verification status */
  verificationStatus: "verified" | "pending" | "expired" | "invalid";

  /** Last verified timestamp */
  verifiedAt?: Date;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
