/**
 * FedEx Carrier Adapter
 * Implements CarrierAdapter interface for FedEx shipping
 * Uses OAuth2 token-based authentication with REST API v1
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
 * FedEx service code mappings
 * Maps service codes to display names and levels
 */
const FEDEX_SERVICE_CODES = {
  FEDEX_GROUND: { name: 'FedEx Ground', level: 'ground', deliveryDays: 5 },
  FEDEX_EXPRESS_SAVER: { name: 'FedEx Express Saver', level: 'economy', deliveryDays: 3 },
  FEDEX_2_DAY: { name: 'FedEx 2Day', level: 'express', deliveryDays: 2 },
  STANDARD_OVERNIGHT: { name: 'Standard Overnight', level: 'overnight', deliveryDays: 1 },
  PRIORITY_OVERNIGHT: { name: 'Priority Overnight', level: 'overnight', deliveryDays: 1 },
  FEDEX_1_DAY_FREIGHT: { name: 'FedEx 1Day Freight', level: 'overnight', deliveryDays: 1 },
  INTERNATIONAL_ECONOMY: { name: 'International Economy', level: 'international', deliveryDays: 6 },
  INTERNATIONAL_PRIORITY: { name: 'International Priority', level: 'international', deliveryDays: 3 },
  INTERNATIONAL_FIRST: { name: 'International First', level: 'international', deliveryDays: 1 },
} as const;

/**
 * FedEx Carrier Adapter Implementation
 * Handles rate quotes, label generation, tracking, and pickups via FedEx API
 */
export class FedExAdapter implements CarrierAdapter {
  readonly name = 'FedEx';
  readonly code = 'fedex';

  /** OAuth2 access token (cached) */
  private accessToken: string | null = null;

  /** Token expiration time */
  private tokenExpiresAt: Date | null = null;

  /**
   * Create FedEx adapter instance
   * @param clientId - FedEx OAuth2 client ID
   * @param clientSecret - FedEx OAuth2 client secret
   * @param accountNumber - FedEx account number
   * @param meterNumber - FedEx meter number
   * @param apiBaseUrl - Base URL for FedEx API (default: production)
   */
  constructor(
    private clientId: string,
    private clientSecret: string,
    private accountNumber: string,
    private meterNumber: string,
    private apiBaseUrl = 'https://apis.fedex.com',
  ) {}

  /**
   * Get OAuth2 access token
   * Implements token caching and refresh logic
   * @returns Valid access token
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      // TODO: Implement actual OAuth2 token request
      // POST https://apis.fedex.com/oauth/token
      // Headers: Content-Type: application/x-www-form-urlencoded
      // Body: grant_type=client_credentials&client_id={clientId}&client_secret={clientSecret}
      // Response: { access_token, token_type, expires_in, scope }

      const tokenResponse = {
        access_token: 'mock_fedex_token_' + Date.now(),
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'all',
      };

      this.accessToken = tokenResponse.access_token;
      this.tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

      return this.accessToken;
    } catch (error) {
      throw new CarrierError(
        'fedex',
        'AUTH_FAILED',
        'Failed to obtain FedEx OAuth2 token',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Get shipping rates from FedEx
   * @param request - Rate request with origin, destination, packages
   * @returns Array of available rate options
   */
  async getRates(request: RateRequest): Promise<RateResponse[]> {
    try {
      const token = await this.getAccessToken();

      // Validate request
      this.validateRateRequest(request);

      // Build FedEx rate request payload
      const payload = this.buildRatePayload(request);

      // TODO: Make HTTP request to FedEx Rate API
      // POST {apiBaseUrl}/rate/v1/rates/quotes
      // Headers: Authorization: Bearer {token}, Content-Type: application/json, X-Customer-Transaction-Id: {uuid}
      // Body: payload
      // Response: { output: { rateReplyDetails: { ratedShipmentDetails[] } } }

      // Mock response for development
      const mockRates: RateResponse[] = [
        {
          carrier: 'FedEx',
          service: 'FedEx Ground',
          serviceCode: 'FEDEX_GROUND',
          totalCharge: 14.99,
          currency: request.currency || 'USD',
          estimatedDeliveryDate: new Date(
            request.shipDate.getTime() + 5 * 24 * 60 * 60 * 1000,
          ),
          estimatedTransitDays: 5,
          guaranteedDelivery: false,
          breakdown: [
            { description: 'Base Rate', amount: 12.0 },
            { description: 'Fuel Surcharge', amount: 2.99 },
          ],
        },
        {
          carrier: 'FedEx',
          service: 'FedEx 2Day',
          serviceCode: 'FEDEX_2_DAY',
          totalCharge: 26.5,
          currency: request.currency || 'USD',
          estimatedDeliveryDate: new Date(
            request.shipDate.getTime() + 2 * 24 * 60 * 60 * 1000,
          ),
          estimatedTransitDays: 2,
          guaranteedDelivery: true,
          breakdown: [
            { description: 'Base Rate', amount: 23.5 },
            { description: 'Fuel Surcharge', amount: 3.0 },
          ],
        },
        {
          carrier: 'FedEx',
          service: 'Priority Overnight',
          serviceCode: 'PRIORITY_OVERNIGHT',
          totalCharge: 52.75,
          currency: request.currency || 'USD',
          estimatedDeliveryDate: new Date(
            request.shipDate.getTime() + 1 * 24 * 60 * 60 * 1000,
          ),
          estimatedTransitDays: 1,
          guaranteedDelivery: true,
          breakdown: [
            { description: 'Base Rate', amount: 48.0 },
            { description: 'Fuel Surcharge', amount: 4.75 },
          ],
        },
      ];

      return mockRates;
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'fedex',
        'RATE_LOOKUP_FAILED',
        'Failed to retrieve FedEx shipping rates',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Create a shipping label with FedEx
   * @param request - Label creation request
   * @returns Shipping label with tracking number and label data
   */
  async createLabel(request: LabelRequest): Promise<LabelResponse> {
    try {
      const token = await this.getAccessToken();

      // Validate request
      this.validateLabelRequest(request);

      // Build FedEx shipping request payload
      const payload = this.buildShippingPayload(request);

      // TODO: Make HTTP request to FedEx Ship API
      // POST {apiBaseUrl}/ship/v1/shipments
      // Headers: Authorization: Bearer {token}, Content-Type: application/json, X-Customer-Transaction-Id: {uuid}
      // Body: payload
      // Response: { output: { transactionShipments[] } }

      // Mock response for development
      const trackingNumber = this.generateTrackingNumber();
      const labelUrl = `https://track.fedex.com/services/trackingpackages?tracknumbers=${trackingNumber}`;

      return {
        trackingNumber,
        labelUrl,
        labelData: this.generateMockLabelData(trackingNumber),
        labelFormat: request.labelFormat || 'PDF',
        carrier: 'FedEx',
        service: FEDEX_SERVICE_CODES[request.serviceCode as keyof typeof FEDEX_SERVICE_CODES]?.name || 'FedEx Ground',
        estimatedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        cost: 22.5,
        currency: request.currency || 'USD',
        barcode: trackingNumber,
      };
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'fedex',
        'LABEL_CREATION_FAILED',
        'Failed to create FedEx shipping label',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Void/cancel a FedEx shipping label
   * @param trackingNumber - Tracking number to void
   * @returns Void confirmation with refund details
   */
  async voidLabel(trackingNumber: string): Promise<VoidResponse> {
    try {
      const token = await this.getAccessToken();

      if (!trackingNumber || trackingNumber.length < 12) {
        throw new CarrierError('fedex', 'INVALID_TRACKING', 'Invalid FedEx tracking number');
      }

      // TODO: Make HTTP request to FedEx Cancel API
      // DELETE {apiBaseUrl}/ship/v1/shipments/{transactionId}
      // Headers: Authorization: Bearer {token}, X-Customer-Transaction-Id: {uuid}
      // Response: { output: { transactionShipments[] } }

      return {
        success: true,
        trackingNumber,
        refund: 22.5,
        currency: 'USD',
        voidedAt: new Date(),
        message: 'FedEx shipment successfully cancelled',
      };
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'fedex',
        'VOID_FAILED',
        'Failed to void FedEx shipping label',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Get tracking information for a FedEx shipment
   * @param trackingNumber - FedEx tracking number
   * @returns Complete tracking information and history
   */
  async getTracking(trackingNumber: string): Promise<TrackingResponse> {
    try {
      if (!trackingNumber || trackingNumber.length < 12) {
        throw new CarrierError('fedex', 'INVALID_TRACKING', 'Invalid FedEx tracking number');
      }

      // TODO: Make HTTP request to FedEx Track API
      // POST {apiBaseUrl}/track/v1/trackingnumbers
      // Headers: Authorization: Bearer {token}, Content-Type: application/json, X-Customer-Transaction-Id: {uuid}
      // Body: { trackingInfo: [{ trackingNumberInfo: { trackingNumber } }] }
      // Response: { output: { completeTrackResults[] } }

      // Mock response for development
      return {
        carrier: 'FedEx',
        trackingNumber,
        status: 'in_transit',
        delivered: false,
        events: [
          {
            timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
            status: 'picked_up',
            description: 'Picked up',
            location: {
              city: 'Los Angeles',
              state: 'CA',
              country: 'US',
              zipCode: '90001',
            },
          },
          {
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
            status: 'in_fedex_possession',
            description: 'In FedEx possession',
            location: {
              city: 'Long Beach',
              state: 'CA',
              country: 'US',
              zipCode: '90801',
            },
          },
          {
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
            status: 'in_transit',
            description: 'In transit',
            location: {
              city: 'Las Vegas',
              state: 'NV',
              country: 'US',
              zipCode: '89101',
            },
          },
        ],
        estimatedDeliveryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      };
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'fedex',
        'TRACKING_FAILED',
        'Failed to retrieve FedEx tracking information',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Schedule a FedEx pickup
   * @param request - Pickup scheduling request
   * @returns Pickup confirmation details
   */
  async schedulePickup(request: PickupRequest): Promise<PickupResponse> {
    try {
      const token = await this.getAccessToken();

      // Validate pickup request
      this.validatePickupRequest(request);

      // Build FedEx pickup request payload
      const payload = this.buildPickupPayload(request);

      // TODO: Make HTTP request to FedEx Pickup API
      // POST {apiBaseUrl}/pickup/v1/pickups
      // Headers: Authorization: Bearer {token}, Content-Type: application/json, X-Customer-Transaction-Id: {uuid}
      // Body: payload
      // Response: { output: { pickupConfirmationCode, pickupScheduleTime } }

      const pickupId = this.generatePickupId();

      return {
        pickupId,
        pickupDate: request.pickupDate,
        location: request.location,
        confirmedAt: new Date(),
        estimatedArrivalWindow: request.timeWindow,
        confirmationCode: `FX-${pickupId}`,
        driverInfo: {
          name: 'FedEx Driver',
          phone: '1-800-463-3339',
        },
        message: 'Pickup scheduled successfully with FedEx',
      };
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'fedex',
        'PICKUP_FAILED',
        'Failed to schedule FedEx pickup',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Cancel a scheduled FedEx pickup
   * @param pickupId - Pickup ID to cancel
   */
  async cancelPickup(pickupId: string): Promise<void> {
    try {
      const token = await this.getAccessToken();

      if (!pickupId) {
        throw new CarrierError('fedex', 'INVALID_PICKUP_ID', 'Pickup ID is required');
      }

      // TODO: Make HTTP request to FedEx Pickup Cancellation API
      // DELETE {apiBaseUrl}/pickup/v1/pickups/{pickupId}
      // Headers: Authorization: Bearer {token}, X-Customer-Transaction-Id: {uuid}
      // Response: { output: { pickupConfirmationCode } }
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'fedex',
        'PICKUP_CANCELLATION_FAILED',
        'Failed to cancel FedEx pickup',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Validate a delivery address with FedEx
   * @param address - Address to validate
   * @returns Validation response with corrected address if needed
   */
  async validateAddress(address: Address): Promise<AddressValidationResponse> {
    try {
      // Basic validation
      this.validateAddress_(address);

      // TODO: Make HTTP request to FedEx Address Validation API
      // POST {apiBaseUrl}/address/v1/addresses/resolve
      // Headers: Authorization: Bearer {token}, Content-Type: application/json, X-Customer-Transaction-Id: {uuid}
      // Body: { addressesToResolve: [{ address: {...} }] }
      // Response: { output: { resolvedAddresses[] } }

      return {
        valid: true,
        address,
        standardized: false,
      };
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'fedex',
        'ADDRESS_VALIDATION_FAILED',
        'Failed to validate address with FedEx',
        error instanceof Error ? error : undefined,
      );
    }
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  /**
   * Validate rate request for required fields
   */
  private validateRateRequest(request: RateRequest): void {
    if (!request.origin?.street1 || !request.origin?.city) {
      throw new CarrierError('fedex', 'INVALID_ORIGIN', 'Invalid origin address');
    }

    if (!request.destination?.street1 || !request.destination?.city) {
      throw new CarrierError('fedex', 'INVALID_DESTINATION', 'Invalid destination address');
    }

    if (!request.packages || request.packages.length === 0) {
      throw new CarrierError('fedex', 'NO_PACKAGES', 'At least one package is required');
    }
  }

  /**
   * Validate label request for required fields
   */
  private validateLabelRequest(request: LabelRequest): void {
    this.validateRateRequest(request as RateRequest);

    if (!request.serviceCode) {
      throw new CarrierError('fedex', 'NO_SERVICE_CODE', 'Service code is required');
    }
  }

  /**
   * Validate pickup request
   */
  private validatePickupRequest(request: PickupRequest): void {
    if (!request.location?.street1 || !request.location?.city) {
      throw new CarrierError('fedex', 'INVALID_LOCATION', 'Invalid pickup location');
    }

    if (request.packageCount <= 0) {
      throw new CarrierError('fedex', 'INVALID_PACKAGE_COUNT', 'Package count must be positive');
    }
  }

  /**
   * Validate address format
   */
  private validateAddress_(address: Address): void {
    if (!address.street1 || !address.city || !address.state || !address.postalCode) {
      throw new CarrierError('fedex', 'INVALID_ADDRESS', 'Address is missing required fields');
    }
  }

  /**
   * Build rate request payload for FedEx API
   */
  private buildRatePayload(request: RateRequest): Record<string, unknown> {
    return {
      accountNumber: {
        value: this.accountNumber,
      },
      requestedShipment: {
        shipper: this.addressToFedExFormat(request.origin),
        recipient: this.addressToFedExFormat(request.destination),
        shipDateStamp: this.formatDate(request.shipDate),
        pickupType: 'BUSINESS_SERVICE_CENTER',
        rateRequestType: ['ACCOUNT', 'LIST'],
        requestedPackageLineItems: request.packages.map((pkg, idx) =>
          this.packageToFedExFormat(pkg, idx),
        ),
      },
    };
  }

  /**
   * Build shipping/label request payload for FedEx API
   */
  private buildShippingPayload(request: LabelRequest): Record<string, unknown> {
    return {
      labelResponseOptions: 'URL_ONLY',
      requestedShipment: {
        shipper: this.addressToFedExFormat(request.origin),
        recipient: this.addressToFedExFormat(request.destination),
        shipDateStamp: this.formatDate(new Date()),
        serviceType: request.serviceCode,
        packagingType: 'YOUR_PACKAGING',
        rateRequestType: 'ACCOUNT',
        requestedPackageLineItems: request.packages.map((pkg, idx) =>
          this.packageToFedExFormat(pkg, idx),
        ),
      },
      accountNumber: {
        value: this.accountNumber,
      },
    };
  }

  /**
   * Build pickup request payload
   */
  private buildPickupPayload(request: PickupRequest): Record<string, unknown> {
    return {
      accountNumber: {
        value: this.accountNumber,
      },
      pickupRequestType: 'SAME_DAY',
      associatedAccountNumber: {
        value: this.accountNumber,
      },
      location: this.addressToFedExFormat(request.location),
      pickupDateAndTime: this.formatDate(request.pickupDate),
      readyTimestamp: request.timeWindow?.start || '08:00',
      closeTimeStamp: request.timeWindow?.end || '17:00',
      pickupItemsDetail: {
        itemNumber: 1,
        description: `${request.packageCount} package(s)`,
        weight: {
          units: request.weightUnit?.toUpperCase() || 'LB',
          value: request.totalWeight || 1,
        },
      },
      remarks: request.instructions,
    };
  }

  /**
   * Convert Address to FedEx format
   */
  private addressToFedExFormat(address: Address): Record<string, unknown> {
    return {
      contact: {
        personName: address.name,
        companyName: address.company || address.name,
        phoneNumber: address.phone,
        emailAddress: address.email,
      },
      address: {
        streetLines: [address.street1, ...(address.street2 ? [address.street2] : [])],
        city: address.city,
        stateOrProvinceCode: address.state,
        postalCode: address.postalCode,
        countryCode: address.country,
        residential: address.residential || false,
      },
    };
  }

  /**
   * Convert Package to FedEx format
   */
  private packageToFedExFormat(pkg: Package, index: number): Record<string, unknown> {
    const weightInLbs = this.convertToLbs(pkg.weight, pkg.weightUnit);

    return {
      sequenceNumber: String(index + 1),
      itemSequenceNumber: String(index + 1),
      packageRating: {
        weight: {
          units: 'LB',
          value: Math.ceil(weightInLbs),
        },
        dimensions: pkg.length
          ? {
              length: Math.ceil(pkg.length),
              width: Math.ceil(pkg.width || 0),
              height: Math.ceil(pkg.height || 0),
              units: pkg.dimensionUnit?.toUpperCase() || 'IN',
            }
          : undefined,
      },
      weight: {
        units: 'LB',
        value: Math.ceil(weightInLbs),
      },
      declaredValue:
        pkg.declaredValue && pkg.declaredValue > 0
          ? {
              currency: 'USD',
              value: pkg.declaredValue,
            }
          : undefined,
    };
  }

  /**
   * Convert weight to pounds
   */
  private convertToLbs(weight: number, unit: string): number {
    switch (unit) {
      case 'lb':
        return weight;
      case 'oz':
        return weight / 16;
      case 'kg':
        return weight * 2.20462;
      case 'g':
        return weight * 0.00220462;
      default:
        return weight;
    }
  }

  /**
   * Format date for FedEx API (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Generate mock FedEx tracking number (15 digits)
   */
  private generateTrackingNumber(): string {
    return Math.floor(Math.random() * 1000000000000000).toString().padStart(15, '0');
  }

  /**
   * Generate mock FedEx pickup ID
   */
  private generatePickupId(): string {
    return Math.floor(Math.random() * 1000000).toString().padStart(8, '0');
  }

  /**
   * Generate mock label data (base64)
   */
  private generateMockLabelData(trackingNumber: string): string {
    const labelContent = `FEDEX SHIPPING LABEL\nTracking: ${trackingNumber}\n\nThis is a mock FedEx label`;
    return Buffer.from(labelContent).toString('base64');
  }
}
