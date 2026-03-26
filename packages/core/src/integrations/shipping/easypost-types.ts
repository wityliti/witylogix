/**
 * EasyPost API Type Definitions
 *
 * Comprehensive TypeScript interfaces for all EasyPost API objects.
 * Aligned with EasyPost API v2 response schemas.
 *
 * API Reference: https://www.easypost.com/docs
 */

// ─── Core Objects ───────────────────────────────────────────────────────

/**
 * EasyPost Address object
 */
export interface EasyPostAddress {
  /** Unique address ID */
  id: string;

  /** Object type (always "address") */
  object: 'address';

  /** Creation timestamp (ISO 8601) */
  created_at: string;

  /** Last update timestamp (ISO 8601) */
  updated_at: string;

  /** Full name or business name */
  name: string;

  /** Company name */
  company?: string;

  /** Street address (line 1) */
  street1: string;

  /** Street address (line 2) */
  street2?: string;

  /** City */
  city: string;

  /** State or province code */
  state: string;

  /** ZIP or postal code */
  zip: string;

  /** Country code (ISO 3166-1 alpha-2) */
  country: string;

  /** Phone number */
  phone?: string;

  /** Email address */
  email?: string;

  /** API mode (test or production) */
  mode: 'test' | 'production';

  /** Whether address is residential */
  residential?: boolean;

  /** Validation message (if any issues) */
  message?: string;
}

/**
 * EasyPost Parcel object
 */
export interface EasyPostParcel {
  /** Unique parcel ID */
  id: string;

  /** Object type (always "parcel") */
  object: 'parcel';

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** Weight in ounces */
  weight: number;

  /** Length in inches */
  length?: number;

  /** Width in inches */
  width?: number;

  /** Height in inches */
  height?: number;

  /** Predefined package type (if using standard size) */
  predefined_package?: string;

  /** API mode */
  mode: 'test' | 'production';
}

/**
 * EasyPost Rate object
 */
export interface EasyPostRate {
  /** Unique rate ID */
  id: string;

  /** Object type (always "rate") */
  object: 'rate';

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** API mode */
  mode: 'test' | 'production';

  /** Service name (e.g., "Ground", "Express") */
  service: string;

  /** Carrier name (e.g., "UPS", "FedEx") */
  carrier: string;

  /** Rate/price as string (for precision) */
  rate: string;

  /** Currency code (e.g., "USD") */
  currency: string;

  /** List rate as string */
  list_rate?: string;

  /** List currency code */
  list_currency?: string;

  /** Estimated delivery days */
  delivery_days?: number;

  /** Estimated delivery date (ISO 8601) */
  delivery_date?: string;

  /** Estimated delivery days (alternative field) */
  est_delivery_days?: number;

  /** Associated shipment ID */
  shipment_id?: string;
}

/**
 * EasyPost Shipment object
 */
export interface EasyPostShipment {
  /** Unique shipment ID */
  id: string;

  /** Object type (always "shipment") */
  object: 'shipment';

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** API mode */
  mode: 'test' | 'production';

  /** Reference/custom ID for this shipment */
  reference?: string;

  /** Shipment status (e.g., "pending", "purchased", "cancelled") */
  status: string;

  /** Tracking number */
  tracking_code: string;

  /** Primary carrier (after purchase) */
  carrier?: string;

  /** Service level (after purchase) */
  service?: string;

  /** Purchased rate details */
  rate?: EasyPostRate;

  /** All available rates */
  rates: EasyPostRate[];

  /** Destination address */
  to_address: EasyPostAddress;

  /** Origin address */
  from_address: EasyPostAddress;

  /** Return address (if applicable) */
  return_address?: EasyPostAddress;

  /** Parcel details */
  parcel: EasyPostParcel;

  /** Postage label (after purchase) */
  postage_label?: {
    id: string;
    object: 'PostageLabel';
    created_at: string;
    updated_at: string;
    type: string;
    url: string;
    filename: string;
    fileformat: 'pdf' | 'png' | 'zpl' | 'epl2';
    carrier_barcode_ability: string;
  };

  /** Messages/warnings */
  messages?: Array<{ message?: string }>;

  /** Insurance object (if insured) */
  insurance?: unknown;

  /** Forms (e.g., customs forms) */
  forms?: unknown[];

  /** Fees */
  fees?: unknown[];

  /** Batch ID (if part of batch) */
  batch_id?: string;

  /** Batch status */
  batch_status?: string;

  /** Batch message */
  batch_message?: string;

  /** Label creation date */
  label_date?: string;

  /** Additional options */
  options?: Record<string, unknown>;
}

/**
 * EasyPost Label object (normalized from Shipment)
 */
export interface EasyPostLabel {
  /** Label/Shipment ID */
  id: string;

  /** Tracking number */
  tracking_code: string;

  /** Label download URL */
  label_url: string;

  /** Label format */
  label_format: 'PDF' | 'PNG' | 'ZPL' | 'EPL2';

  /** Creation timestamp */
  created_at: string;
}

/**
 * EasyPost Checkpoint (tracking event)
 */
export interface EasyPostCheckpoint {
  /** Object type */
  object: 'TrackingLocation';

  /** Event timestamp */
  created_at: string;

  /** Last update */
  updated_at: string;

  /** Event message */
  message: string;

  /** Event status */
  status: string;

  /** Detailed status */
  status_detail: string;

  /** Location information */
  tracking_location?: {
    object: 'TrackingLocation';
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  };
}

/**
 * EasyPost Tracker object
 */
export interface EasyPostTracker {
  /** Unique tracker ID */
  id: string;

  /** Object type (always "tracker") */
  object: 'tracker';

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** API mode */
  mode: 'test' | 'production';

  /** Tracking number */
  tracking_code: string;

  /** Current status */
  status: string;

  /** Detailed status */
  status_detail: string;

  /** Carrier name */
  carrier: string;

  /** Package weight */
  weight?: number;

  /** Estimated delivery date */
  est_delivery_date?: string;

  /** Signed by (if delivered) */
  signed_by?: string;

  /** Carrier-specific details */
  carrier_detail?: unknown;

  /** Whether tracking is finalized */
  finalized: boolean;

  /** Whether this is a return shipment */
  is_return: boolean;

  /** Public tracking URL */
  public_url: string;

  /** Fees */
  fees?: unknown[];

  /** All tracking events */
  checkpoints: EasyPostCheckpoint[];
}

/**
 * EasyPost Batch object
 */
export interface EasyPostBatch {
  /** Unique batch ID */
  id: string;

  /** Object type (always "batch") */
  object: 'batch';

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** API mode */
  mode: 'test' | 'production';

  /** Batch state (e.g., "creating", "created", "purchasing", "purchased") */
  state: string;

  /** Number of shipments in batch */
  num_shipments: number;

  /** Shipments in batch */
  shipments: EasyPostShipment[];

  /** Label download information */
  label_download?: {
    href: string;
  };

  /** Scan form (after generation) */
  scan_form?: ScanForm;

  /** Messages */
  messages?: unknown[];
}

/**
 * EasyPost Scan Form object
 */
export interface ScanForm {
  /** Unique scan form ID */
  id: string;

  /** Object type */
  object: 'ScanForm';

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** API mode */
  mode: 'test' | 'production';

  /** Form status */
  status: string;

  /** Download URL */
  form_url: string;

  /** Batch ID this form is for */
  batch_id: string;

  /** Tracking numbers included */
  tracking_codes?: string[];
}

/**
 * EasyPost Customs Item object
 */
export interface EasyPostCustomsItem {
  /** Unique item ID */
  id: string;

  /** Object type */
  object: 'CustomsItem';

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** Description of item */
  description: string;

  /** Quantity */
  quantity: number;

  /** Weight per item in ounces */
  weight?: number;

  /** Value per item in USD */
  value?: string;

  /** Origin country code */
  origin_country?: string;

  /** HS/Tariff code */
  hs_code?: string;

  /** API mode */
  mode: 'test' | 'production';
}

/**
 * EasyPost Customs Info object
 */
export interface EasyPostCustomsInfo {
  /** Unique customs info ID */
  id: string;

  /** Object type */
  object: 'CustomsInfo';

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** Customs items */
  customs_items: EasyPostCustomsItem[];

  /** Customs declaration signature */
  declaration?: string;

  /** Contents type (gift, merchandise, documents, sample, return, repair) */
  contents_type?: string;

  /** Contents explanation */
  contents_explanation?: string;

  /** EEL/PFC code */
  eel_pfc?: string;

  /** Non-delivery option (abandon, return_to_sender) */
  non_delivery_option?: string;

  /** Restriction code */
  restriction_code?: string;

  /** Restriction comments */
  restriction_comments?: string;

  /** Certify (signature) */
  certify?: boolean;

  /** Certifier's name */
  certifier?: string;

  /** API mode */
  mode: 'test' | 'production';
}

/**
 * EasyPost Insurance object
 */
export interface EasyPostInsurance {
  /** Unique insurance ID */
  id: string;

  /** Object type */
  object: 'Insurance';

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** Insurance provider */
  provider: string;

  /** Amount insured (as string for precision) */
  amount: string;

  /** Currency code */
  currency: string;

  /** Associated shipment ID */
  shipment_id?: string;

  /** Insurance status */
  status?: string;

  /** API mode */
  mode: 'test' | 'production';
}

/**
 * EasyPost Carrier Account object
 */
export interface CarrierAccount {
  /** Unique account ID */
  id: string;

  /** Object type */
  object: 'CarrierAccount';

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** Carrier type (e.g., "FedEx", "UPS", "USPS") */
  type: string;

  /** Description */
  description?: string;

  /** Readable name */
  readable?: string;

  /** Account reference (carrier-specific ID) */
  reference?: string;

  /** API mode */
  mode: 'test' | 'production';

  /** Credentials (carrier-specific) */
  credentials?: Record<string, unknown>;

  /** Test credentials */
  test_credentials?: Record<string, unknown>;
}

/**
 * EasyPost Webhook Event object
 */
export interface EasyPostWebhookEvent {
  /** Event ID */
  id: string;

  /** Event description */
  description: string;

  /** Result object (shipment, tracker, batch, etc.) */
  result?: Record<string, unknown>;

  /** Event timestamp */
  created_at: string;
}

/**
 * EasyPost API Error object
 */
export interface EasyPostError {
  /** Error code */
  code?: string;

  /** Error message */
  message: string;

  /** List of errors (for validation errors) */
  errors?: Array<{
    field?: string;
    message: string;
  }>;

  /** HTTP status code */
  status_code?: number;
}
