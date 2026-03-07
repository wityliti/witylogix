/**
 * Generic Carrier Adapter
 * Implements CarrierAdapter interface for custom/manual carriers
 * Used for local couriers, bike messengers, and non-API carriers
 * Flat-rate pricing with manual tracking entry
 */

import {
  CarrierAdapter,
  RateRequest,
  RateResponse,
  LabelRequest,
  LabelResponse,
  VoidResponse,
  TrackingResponse,
  PickupRequest,
  PickupResponse,
  Address,
  AddressValidationResponse,
  CarrierError,
  Package,
} from '../types';

/**
 * Generic carrier configuration
 * Stores flat-rate pricing and service definitions
 */
export interface GenericCarrierConfig {
  /** Carrier display name */
  name: string;

  /** Carrier code */
  code: string;

  /** Flat-rate pricing rules */
  rates: {
    /** Service code/identifier */
    code: string;

    /** Service display name */
    name: string;

    /** Fixed price for this service */
    price: number;

    /** Currency code */
    currency: string;

    /** Estimated delivery days */
    estimatedDays?: number;

    /** Whether delivery is guaranteed */
    guaranteed?: boolean;

    /** Weight limit in kg (if any) */
    maxWeight?: number;
  }[];

  /** Default service code if none specified */
  defaultService: string;

  /** Enable pickup scheduling */
  supportsPickup?: boolean;

  /** Enable address validation */
  supportsValidation?: boolean;

  /** Tracking prefix/pattern for generated tracking numbers */
  trackingPrefix?: string;
}

/**
 * Generic Carrier Adapter Implementation
 * Handles manual carriers without API integration
 * Perfect for local couriers, bike messengers, custom logistics
 */
export class GenericAdapter implements CarrierAdapter {
  readonly name: string;
  readonly code: string;

  /** Configuration for this generic carrier */
  private config: GenericCarrierConfig;

  /** Stored tracking entries (in-memory for demo; use DB in production) */
  private trackingStore = new Map<string, TrackingResponse>();

  /** Stored label records */
  private labelStore = new Map<string, LabelResponse>();

  /**
   * Create generic carrier adapter
   * @param config - Configuration for this generic carrier
   */
  constructor(config: GenericCarrierConfig) {
    this.config = config;
    this.name = config.name;
    this.code = config.code as any;
  }

  /**
   * Get flat-rate shipping options
   * No API calls - returns configured rates
   * @param request - Rate request
   * @returns Configured rate options for this carrier
   */
  async getRates(request: RateRequest): Promise<RateResponse[]> {
    try {
      // Basic validation
      this.validateRateRequest(request);

      // Build total weight
      const totalWeight = request.packages.reduce((sum, pkg) => {
        return sum + this.convertToKg(pkg.weight, pkg.weightUnit);
      }, 0);

      // Filter rates by weight and service level
      const applicableRates = this.config.rates.filter((rate) => {
        // Check weight limit
        if (rate.maxWeight && totalWeight > rate.maxWeight) {
          return false;
        }

        // Filter by service level if specified
        if (request.serviceLevel) {
          // Simple matching - could be more sophisticated
          const rateLevel = rate.name.toLowerCase();
          return rateLevel.includes(request.serviceLevel.toLowerCase());
        }

        return true;
      });

      if (applicableRates.length === 0) {
        throw new CarrierError(
          this.code as any,
          'NO_APPLICABLE_RATES',
          `No applicable rates available for ${this.name} (total weight: ${totalWeight}kg)`,
        );
      }

      // Convert configured rates to RateResponse format
      return applicableRates.map((rate) => ({
        carrier: this.name,
        service: rate.name,
        serviceCode: rate.code,
        totalCharge: rate.price,
        currency: rate.currency,
        estimatedDeliveryDate: rate.estimatedDays
          ? new Date(request.shipDate.getTime() + rate.estimatedDays * 24 * 60 * 60 * 1000)
          : undefined,
        estimatedTransitDays: rate.estimatedDays,
        guaranteedDelivery: rate.guaranteed || false,
      }));
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        this.code as any,
        'RATE_LOOKUP_FAILED',
        `Failed to retrieve ${this.name} shipping rates`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Create a label for manual carrier
   * Generates tracking number and stores record
   * @param request - Label creation request
   * @returns Label with generated tracking number
   */
  async createLabel(request: LabelRequest): Promise<LabelResponse> {
    try {
      // Validate request
      this.validateLabelRequest(request);

      // Get rate configuration
      const rateConfig = this.config.rates.find((r) => r.code === request.serviceCode);

      if (!rateConfig) {
        throw new CarrierError(
          this.code as any,
          'INVALID_SERVICE_CODE',
          `Service code '${request.serviceCode}' not found for ${this.name}`,
        );
      }

      // Generate tracking number
      const trackingNumber = this.generateTrackingNumber();

      // Create label response
      const label: LabelResponse = {
        trackingNumber,
        carrier: this.name,
        service: rateConfig.name,
        cost: rateConfig.price,
        currency: rateConfig.currency,
        labelFormat: request.labelFormat || 'PDF',
        estimatedDeliveryDate: rateConfig.estimatedDays
          ? new Date(Date.now() + rateConfig.estimatedDays * 24 * 60 * 60 * 1000)
          : undefined,
        barcode: trackingNumber,
        labelData: this.generateMockLabelData(trackingNumber, rateConfig.name),
      };

      // Store label record
      this.labelStore.set(trackingNumber, label);

      // Initialize tracking record
      const trackingResponse: TrackingResponse = {
        carrier: this.name,
        trackingNumber,
        status: 'pending_pickup',
        delivered: false,
        events: [
          {
            timestamp: new Date(),
            status: 'label_created',
            description: `Label created for ${this.name}`,
          },
        ],
      };

      this.trackingStore.set(trackingNumber, trackingResponse);

      return label;
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        this.code as any,
        'LABEL_CREATION_FAILED',
        `Failed to create label for ${this.name}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Void/cancel a label
   * Marks tracking as cancelled
   * @param trackingNumber - Tracking number to void
   * @returns Void confirmation
   */
  async voidLabel(trackingNumber: string): Promise<VoidResponse> {
    try {
      if (!trackingNumber) {
        throw new CarrierError(
          this.code as any,
          'INVALID_TRACKING',
          'Tracking number is required',
        );
      }

      // Get label record
      const label = this.labelStore.get(trackingNumber);

      if (!label) {
        throw new CarrierError(
          this.code as any,
          'TRACKING_NOT_FOUND',
          `Tracking number '${trackingNumber}' not found`,
        );
      }

      // Get tracking record and mark as voided
      const tracking = this.trackingStore.get(trackingNumber);

      if (tracking) {
        tracking.status = 'voided';
        tracking.events.push({
          timestamp: new Date(),
          status: 'voided',
          description: 'Shipment cancelled',
        });
      }

      return {
        success: true,
        trackingNumber,
        refund: label.cost,
        currency: label.currency,
        voidedAt: new Date(),
        message: `${this.name} shipment cancelled`,
      };
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        this.code as any,
        'VOID_FAILED',
        `Failed to void ${this.name} shipment`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Get tracking information
   * Retrieves manually-entered tracking data
   * @param trackingNumber - Tracking number to look up
   * @returns Tracking information
   */
  async getTracking(trackingNumber: string): Promise<TrackingResponse> {
    try {
      if (!trackingNumber) {
        throw new CarrierError(
          this.code as any,
          'INVALID_TRACKING',
          'Tracking number is required',
        );
      }

      const tracking = this.trackingStore.get(trackingNumber);

      if (!tracking) {
        throw new CarrierError(
          this.code as any,
          'TRACKING_NOT_FOUND',
          `Tracking number '${trackingNumber}' not found for ${this.name}`,
        );
      }

      return tracking;
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        this.code as any,
        'TRACKING_FAILED',
        `Failed to retrieve tracking for ${this.name}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Update tracking information manually
   * Allows manual entry of tracking events
   * @param trackingNumber - Tracking number
   * @param status - New status
   * @param event - Event details to add
   */
  updateTracking(
    trackingNumber: string,
    status: string,
    event: {
      status: string;
      description: string;
      location?: { city: string; state?: string; country: string; zipCode?: string };
      details?: string;
    },
  ): void {
    const tracking = this.trackingStore.get(trackingNumber);

    if (!tracking) {
      throw new CarrierError(
        this.code as any,
        'TRACKING_NOT_FOUND',
        `Tracking number '${trackingNumber}' not found`,
      );
    }

    tracking.status = status;
    tracking.events.push({
      timestamp: new Date(),
      ...event,
    });

    // Mark as delivered if status is delivered
    if (status === 'delivered') {
      tracking.delivered = true;
      tracking.deliveredAt = new Date();
    }
  }

  /**
   * Schedule a pickup
   * Only supported if configured
   * @param request - Pickup request
   * @returns Pickup confirmation
   */
  async schedulePickup(request: PickupRequest): Promise<PickupResponse> {
    try {
      if (!this.config.supportsPickup) {
        throw new CarrierError(
          this.code as any,
          'PICKUP_NOT_SUPPORTED',
          `${this.name} does not support scheduled pickups`,
        );
      }

      // Validate request
      this.validatePickupRequest(request);

      const pickupId = this.generatePickupId();

      return {
        pickupId,
        pickupDate: request.pickupDate,
        location: request.location,
        confirmedAt: new Date(),
        estimatedArrivalWindow: request.timeWindow,
        confirmationCode: `${this.config.trackingPrefix || this.code}-${pickupId}`,
        message: `Pickup scheduled with ${this.name}`,
      };
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        this.code as any,
        'PICKUP_FAILED',
        `Failed to schedule ${this.name} pickup`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Cancel a scheduled pickup
   * @param pickupId - Pickup ID to cancel
   */
  async cancelPickup(pickupId: string): Promise<void> {
    try {
      if (!this.config.supportsPickup) {
        throw new CarrierError(
          this.code as any,
          'PICKUP_NOT_SUPPORTED',
          `${this.name} does not support scheduled pickups`,
        );
      }

      if (!pickupId) {
        throw new CarrierError(
          this.code as any,
          'INVALID_PICKUP_ID',
          'Pickup ID is required',
        );
      }

      // In a real implementation, this would cancel the pickup
      // For generic carrier, we just acknowledge the cancellation
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        this.code as any,
        'PICKUP_CANCELLATION_FAILED',
        `Failed to cancel ${this.name} pickup`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Validate an address
   * Basic validation only (no API calls)
   * @param address - Address to validate
   * @returns Validation response
   */
  async validateAddress(address: Address): Promise<AddressValidationResponse> {
    try {
      // Basic validation
      this.validateAddress_(address);

      if (!this.config.supportsValidation) {
        // Return basic validation result
        return {
          valid: true,
          address,
          standardized: false,
        };
      }

      // More thorough validation (if configured)
      return {
        valid: true,
        address,
        standardized: false,
        addressType: address.residential ? 'residential' : 'commercial',
      };
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        this.code as any,
        'ADDRESS_VALIDATION_FAILED',
        `Failed to validate address for ${this.name}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  /**
   * Validate rate request
   */
  private validateRateRequest(request: RateRequest): void {
    if (!request.origin?.street1 || !request.origin?.city) {
      throw new CarrierError(this.code as any, 'INVALID_ORIGIN', 'Invalid origin address');
    }

    if (!request.destination?.street1 || !request.destination?.city) {
      throw new CarrierError(
        this.code as any,
        'INVALID_DESTINATION',
        'Invalid destination address',
      );
    }

    if (!request.packages || request.packages.length === 0) {
      throw new CarrierError(this.code as any, 'NO_PACKAGES', 'At least one package is required');
    }
  }

  /**
   * Validate label request
   */
  private validateLabelRequest(request: LabelRequest): void {
    this.validateRateRequest(request as RateRequest);

    if (!request.serviceCode) {
      throw new CarrierError(
        this.code as any,
        'NO_SERVICE_CODE',
        'Service code is required',
      );
    }
  }

  /**
   * Validate pickup request
   */
  private validatePickupRequest(request: PickupRequest): void {
    if (!request.location?.street1 || !request.location?.city) {
      throw new CarrierError(this.code as any, 'INVALID_LOCATION', 'Invalid pickup location');
    }

    if (request.packageCount <= 0) {
      throw new CarrierError(
        this.code as any,
        'INVALID_PACKAGE_COUNT',
        'Package count must be positive',
      );
    }
  }

  /**
   * Validate address
   */
  private validateAddress_(address: Address): void {
    if (!address.street1 || !address.city || !address.postalCode) {
      throw new CarrierError(
        this.code as any,
        'INVALID_ADDRESS',
        'Address is missing required fields',
      );
    }
  }

  /**
   * Convert weight to kilograms
   */
  private convertToKg(weight: number, unit: string): number {
    switch (unit) {
      case 'kg':
        return weight;
      case 'g':
        return weight / 1000;
      case 'lb':
        return weight * 0.453592;
      case 'oz':
        return weight * 0.0283495;
      default:
        return weight;
    }
  }

  /**
   * Generate tracking number with optional prefix
   */
  private generateTrackingNumber(): string {
    const prefix = this.config.trackingPrefix || this.code.toUpperCase();
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}${random}`;
  }

  /**
   * Generate pickup ID
   */
  private generatePickupId(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  /**
   * Generate mock label data
   */
  private generateMockLabelData(trackingNumber: string, serviceName: string): string {
    const labelContent = `${this.name.toUpperCase()} LABEL\nTracking: ${trackingNumber}\nService: ${serviceName}\n\nManual/Custom Carrier`;
    return Buffer.from(labelContent).toString('base64');
  }
}

/**
 * Factory function to create a generic carrier adapter
 * @param name - Carrier name
 * @param code - Carrier code
 * @param rates - Rate configuration
 * @param defaultService - Default service code
 * @param options - Additional options
 * @returns Generic adapter instance
 */
export function createGenericCarrier(
  name: string,
  code: string,
  rates: GenericCarrierConfig['rates'],
  defaultService: string,
  options?: Partial<GenericCarrierConfig>,
): GenericAdapter {
  return new GenericAdapter({
    name,
    code,
    rates,
    defaultService,
    ...options,
  });
}
