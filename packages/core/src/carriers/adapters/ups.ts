/**
 * UPS Carrier Adapter
 * Implements CarrierAdapter interface for UPS shipping
 * Uses OAuth2 authentication with REST API v2
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
 * UPS service code mappings
 * Maps generic service levels to UPS service codes
 */
const UPS_SERVICE_CODES = {
  '01': { name: 'UPS Next Day Air', level: 'overnight' },
  '02': { name: 'UPS 2nd Day Air', level: 'express' },
  '03': { name: 'UPS Ground', level: 'ground' },
  '13': { name: 'UPS Next Day Air Saver', level: 'overnight' },
  '14': { name: 'UPS 2nd Day Air A.M.', level: 'express' },
  '59': { name: 'UPS 2nd Day Air A.M.', level: 'express' },
  '11': { name: 'UPS Standard', level: 'economy' },
  '07': { name: 'UPS Worldwide Express', level: 'international' },
  '08': { name: 'UPS Worldwide Expedited', level: 'international' },
  '54': { name: 'UPS Worldwide Express Plus', level: 'international' },
} as const;

/**
 * UPS Carrier Adapter Implementation
 * Handles rate quotes, label generation, tracking, and pickups via UPS API
 */
export class UpsAdapter implements CarrierAdapter {
  readonly name = 'UPS';
  readonly code = 'ups';

  /** OAuth2 access token (cached) */
  private accessToken: string | null = null;

  /** Token expiration time */
  private tokenExpiresAt: Date | null = null;

  /**
   * Create UPS adapter instance
   * @param clientId - UPS OAuth2 client ID
   * @param clientSecret - UPS OAuth2 client secret
   * @param accountNumber - UPS account number (optional)
   * @param apiBaseUrl - Base URL for UPS API (default: production)
   */
  constructor(
    private clientId: string,
    private clientSecret: string,
    private accountNumber?: string,
    private apiBaseUrl = 'https://onlinetools.ups.com/rest',
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
      // POST https://onlinetools.ups.com/security/v1/oauth/token
      // Headers: Authorization: Basic {base64(clientId:clientSecret)}
      // Body: grant_type=client_credentials
      // Response: { access_token, expires_in, token_type }

      const tokenResponse = {
        access_token: 'mock_access_token_' + Date.now(),
        expires_in: 3600,
        token_type: 'Bearer',
      };

      this.accessToken = tokenResponse.access_token;
      this.tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

      return this.accessToken;
    } catch (error) {
      throw new CarrierError(
        'ups',
        'AUTH_FAILED',
        'Failed to obtain UPS OAuth2 token',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Get shipping rates from UPS
   * @param request - Rate request with origin, destination, packages
   * @returns Array of available rate options
   */
  async getRates(request: RateRequest): Promise<RateResponse[]> {
    try {
      const token = await this.getAccessToken();

      // Validate request
      this.validateRateRequest(request);

      // Build UPS rate request payload
      const payload = this.buildRatePayload(request);

      // TODO: Make HTTP request to UPS Rating API
      // POST {apiBaseUrl}/v2/shop/rates
      // Headers: Authorization: Bearer {token}, Content-Type: application/json
      // Body: payload
      // Response: { RateResponse: { Response, RatedShipment[] } }

      // Mock response for development
      const mockRates: RateResponse[] = [
        {
          carrier: 'UPS',
          service: 'UPS Ground',
          serviceCode: '03',
          totalCharge: 12.5,
          currency: request.currency || 'USD',
          estimatedDeliveryDate: new Date(
            request.shipDate.getTime() + 5 * 24 * 60 * 60 * 1000,
          ),
          estimatedTransitDays: 5,
          guaranteedDelivery: false,
          breakdown: [
            { description: 'Base Rate', amount: 10.0 },
            { description: 'Fuel Surcharge', amount: 2.5 },
          ],
        },
        {
          carrier: 'UPS',
          service: 'UPS 2nd Day Air',
          serviceCode: '02',
          totalCharge: 24.75,
          currency: request.currency || 'USD',
          estimatedDeliveryDate: new Date(
            request.shipDate.getTime() + 2 * 24 * 60 * 60 * 1000,
          ),
          estimatedTransitDays: 2,
          guaranteedDelivery: true,
          breakdown: [
            { description: 'Base Rate', amount: 22.0 },
            { description: 'Fuel Surcharge', amount: 2.75 },
          ],
        },
        {
          carrier: 'UPS',
          service: 'UPS Next Day Air',
          serviceCode: '01',
          totalCharge: 45.99,
          currency: request.currency || 'USD',
          estimatedDeliveryDate: new Date(
            request.shipDate.getTime() + 1 * 24 * 60 * 60 * 1000,
          ),
          estimatedTransitDays: 1,
          guaranteedDelivery: true,
          breakdown: [
            { description: 'Base Rate', amount: 42.0 },
            { description: 'Fuel Surcharge', amount: 3.99 },
          ],
        },
      ];

      return mockRates;
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'ups',
        'RATE_LOOKUP_FAILED',
        'Failed to retrieve UPS shipping rates',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Create a shipping label with UPS
   * @param request - Label creation request
   * @returns Shipping label with tracking number and label data
   */
  async createLabel(request: LabelRequest): Promise<LabelResponse> {
    try {
      const token = await this.getAccessToken();

      // Validate request
      this.validateLabelRequest(request);

      // Build UPS shipping request payload
      const payload = this.buildShippingPayload(request);

      // TODO: Make HTTP request to UPS Shipping API
      // POST {apiBaseUrl}/v2/ship/ship
      // Headers: Authorization: Bearer {token}, Content-Type: application/json
      // Body: payload
      // Response: { ShipmentResponse: { Response, ShipmentResults } }

      // Mock response for development
      const trackingNumber = this.generateTrackingNumber();
      const labelUrl = `https://tools.ups.com/track/v3/documents/${trackingNumber}`;

      return {
        trackingNumber,
        labelUrl,
        labelData: this.generateMockLabelData(trackingNumber),
        labelFormat: request.labelFormat || 'PDF',
        carrier: 'UPS',
        service: 'UPS ' + (request.serviceCode === '03' ? 'Ground' : '2nd Day Air'),
        estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        cost: 18.99,
        currency: request.currency || 'USD',
        barcode: trackingNumber,
      };
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'ups',
        'LABEL_CREATION_FAILED',
        'Failed to create UPS shipping label',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Void/cancel a UPS shipping label
   * @param trackingNumber - Tracking number to void
   * @returns Void confirmation with refund details
   */
  async voidLabel(trackingNumber: string): Promise<VoidResponse> {
    try {
      const token = await this.getAccessToken();

      if (!trackingNumber || trackingNumber.length < 10) {
        throw new CarrierError('ups', 'INVALID_TRACKING', 'Invalid tracking number provided');
      }

      // TODO: Make HTTP request to UPS Void API
      // DELETE {apiBaseUrl}/v2/shipping/{shipmentId}/void
      // Headers: Authorization: Bearer {token}
      // Response: { VoidShipmentResponse }

      return {
        success: true,
        trackingNumber,
        refund: 18.99,
        currency: 'USD',
        voidedAt: new Date(),
        message: 'Shipping label successfully voided',
      };
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'ups',
        'VOID_FAILED',
        'Failed to void UPS shipping label',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Get tracking information for a UPS shipment
   * @param trackingNumber - UPS tracking number
   * @returns Complete tracking information and history
   */
  async getTracking(trackingNumber: string): Promise<TrackingResponse> {
    try {
      if (!trackingNumber || trackingNumber.length < 10) {
        throw new CarrierError('ups', 'INVALID_TRACKING', 'Invalid tracking number provided');
      }

      // TODO: Make HTTP request to UPS Tracking API
      // GET {apiBaseUrl}/v2/track/{trackingNumber}
      // Headers: Authorization: Bearer {token}, transId: {uuid}, transactionSrc: WITYLOGIX
      // Response: { trackResponse: { shipment[] } }

      // Mock response for development
      return {
        carrier: 'UPS',
        trackingNumber,
        status: 'in_transit',
        delivered: false,
        events: [
          {
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
            status: 'pickup_scan',
            description: 'Package picked up',
            location: {
              city: 'San Francisco',
              state: 'CA',
              country: 'US',
              zipCode: '94105',
            },
          },
          {
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
            status: 'in_transit',
            description: 'Package in transit',
            location: {
              city: 'Oakland',
              state: 'CA',
              country: 'US',
              zipCode: '94607',
            },
          },
        ],
        estimatedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      };
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'ups',
        'TRACKING_FAILED',
        'Failed to retrieve UPS tracking information',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Schedule a UPS pickup
   * @param request - Pickup scheduling request
   * @returns Pickup confirmation details
   */
  async schedulePickup(request: PickupRequest): Promise<PickupResponse> {
    try {
      const token = await this.getAccessToken();

      // Validate pickup request
      this.validatePickupRequest(request);

      // Build UPS pickup request payload
      const payload = this.buildPickupPayload(request);

      // TODO: Make HTTP request to UPS Pickup API
      // POST {apiBaseUrl}/v2/pickup/schedule
      // Headers: Authorization: Bearer {token}, Content-Type: application/json
      // Body: payload
      // Response: { PickupResponse }

      const pickupId = this.generatePickupId();

      return {
        pickupId,
        pickupDate: request.pickupDate,
        location: request.location,
        confirmedAt: new Date(),
        estimatedArrivalWindow: request.timeWindow,
        confirmationCode: `UPS-${pickupId}`,
        message: 'Pickup scheduled successfully',
      };
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'ups',
        'PICKUP_FAILED',
        'Failed to schedule UPS pickup',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Cancel a scheduled UPS pickup
   * @param pickupId - Pickup ID to cancel
   */
  async cancelPickup(pickupId: string): Promise<void> {
    try {
      const token = await this.getAccessToken();

      if (!pickupId) {
        throw new CarrierError('ups', 'INVALID_PICKUP_ID', 'Pickup ID is required');
      }

      // TODO: Make HTTP request to UPS Pickup Cancellation API
      // DELETE {apiBaseUrl}/v2/pickup/{pickupId}/cancel
      // Headers: Authorization: Bearer {token}
      // Response: { CancelPickupResponse }
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'ups',
        'PICKUP_CANCELLATION_FAILED',
        'Failed to cancel UPS pickup',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Validate a delivery address with UPS
   * @param address - Address to validate
   * @returns Validation response with corrected address if needed
   */
  async validateAddress(address: Address): Promise<AddressValidationResponse> {
    try {
      // Basic validation
      this.validateAddress_(address);

      // TODO: Make HTTP request to UPS Address Validation API
      // POST {apiBaseUrl}/v2/address/validate
      // Headers: Authorization: Bearer {token}, Content-Type: application/json
      // Body: { UPSAccessPointIndicator: '', AddressKeyFormat: { AddressLine: [], City, etc } }
      // Response: { ValidAddressIndicator, AmbiguousAddressIndicator, ValidAddressResults[] }

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
        'ups',
        'ADDRESS_VALIDATION_FAILED',
        'Failed to validate address',
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
      throw new CarrierError('ups', 'INVALID_ORIGIN', 'Invalid origin address');
    }

    if (!request.destination?.street1 || !request.destination?.city) {
      throw new CarrierError('ups', 'INVALID_DESTINATION', 'Invalid destination address');
    }

    if (!request.packages || request.packages.length === 0) {
      throw new CarrierError('ups', 'NO_PACKAGES', 'At least one package is required');
    }
  }

  /**
   * Validate label request for required fields
   */
  private validateLabelRequest(request: LabelRequest): void {
    this.validateRateRequest(request as RateRequest);

    if (!request.serviceCode) {
      throw new CarrierError('ups', 'NO_SERVICE_CODE', 'Service code is required');
    }
  }

  /**
   * Validate pickup request
   */
  private validatePickupRequest(request: PickupRequest): void {
    if (!request.location?.street1 || !request.location?.city) {
      throw new CarrierError('ups', 'INVALID_LOCATION', 'Invalid pickup location');
    }

    if (request.packageCount <= 0) {
      throw new CarrierError('ups', 'INVALID_PACKAGE_COUNT', 'Package count must be positive');
    }
  }

  /**
   * Validate address format
   */
  private validateAddress_(address: Address): void {
    if (!address.street1 || !address.city || !address.state || !address.postalCode) {
      throw new CarrierError('ups', 'INVALID_ADDRESS', 'Address is missing required fields');
    }
  }

  /**
   * Build rate request payload for UPS API
   */
  private buildRatePayload(request: RateRequest): Record<string, unknown> {
    return {
      RateRequest: {
        Request: {
          RequestOption: 'Rate',
          SubVersion: '1902',
        },
        Shipment: {
          Shipper: this.addressToUpsFormat(request.origin),
          ShipTo: this.addressToUpsFormat(request.destination),
          Package: request.packages.map((pkg) => this.packageToUpsFormat(pkg)),
          ShipmentRatingOptions: {
            NegotiatedRatesIndicator: this.accountNumber ? '' : undefined,
            UserIDOptions: {},
          },
        },
      },
    };
  }

  /**
   * Build shipping/label request payload for UPS API
   */
  private buildShippingPayload(request: LabelRequest): Record<string, unknown> {
    return {
      ShipmentRequest: {
        Request: {
          RequestOption: 'nonvalidate',
          SubVersion: '1908',
        },
        Shipment: {
          Description: 'Witylogix Shipment',
          Shipper: this.addressToUpsFormat(request.origin),
          ShipTo: this.addressToUpsFormat(request.destination),
          Package: request.packages.map((pkg) => this.packageToUpsFormat(pkg)),
          Service: {
            Code: request.serviceCode,
            Description: UPS_SERVICE_CODES[request.serviceCode as keyof typeof UPS_SERVICE_CODES]
              ?.name,
          },
        },
        LabelSpecification: {
          LabelImageFormat: request.labelFormat || 'PDF',
          LabelStockSize: {
            Height: this.getLabelHeight(request.labelSize),
            Width: this.getLabelWidth(request.labelSize),
          },
        },
      },
    };
  }

  /**
   * Build pickup request payload
   */
  private buildPickupPayload(request: PickupRequest): Record<string, unknown> {
    return {
      PickupRequest: {
        Request: {
          RequestOption: 'nonvalidate',
          SubVersion: '1908',
        },
        PickupCreationDetails: {
          PickupDateInfo: {
            ClassOfPickup: '01',
            PickupDate: this.formatDate(request.pickupDate),
            PickupTime: request.timeWindow?.start || '08:00',
            ReadyTimeAM: request.timeWindow?.start || '08:00',
            CloseTimeAM: request.timeWindow?.end || '17:00',
          },
          CompanyCloseTime: '17:30',
          PickupLocation: this.addressToUpsFormat(request.location),
          ContactInfo: {
            CompanyName: request.location.company || request.location.name,
            ContactName: request.location.name,
            Phone: request.location.phone || '5551234567',
          },
          ShipmentIndicators: {
            DocumentsOnly: '',
            PackagesOnly: '',
            DeliveryConfirmation: '',
          },
          PickupDetails: {
            NumberOfContainers: String(request.packageCount),
            TotalWeight: request.totalWeight || 0,
            WeightUnitOfMeasure: request.weightUnit || 'LB',
            ServiceType: '03',
          },
          SpecialInstructions: request.instructions,
        },
      },
    };
  }

  /**
   * Convert Address to UPS format
   */
  private addressToUpsFormat(
    address: Address,
  ): Record<string, unknown> {
    return {
      Name: address.name,
      CompanyName: address.company,
      AttentionName: address.name,
      PhoneNumber: address.phone,
      EMailAddress: address.email,
      Address: {
        AddressLine1: address.street1,
        AddressLine2: address.street2,
        City: address.city,
        StateProvinceCode: address.state,
        PostalCode: address.postalCode,
        CountryCode: address.country,
        ResidentialAddressIndicator: address.residential ? 'Y' : 'N',
      },
    };
  }

  /**
   * Convert Package to UPS format
   */
  private packageToUpsFormat(pkg: Package): Record<string, unknown> {
    const weightInLbs = this.convertToLbs(pkg.weight, pkg.weightUnit);

    return {
      PackageWeight: {
        UnitOfMeasurement: {
          Code: 'LBS',
        },
        Weight: String(Math.ceil(weightInLbs)),
      },
      Dimensions: pkg.length
        ? {
            UnitOfMeasurement: {
              Code: pkg.dimensionUnit === 'cm' ? 'CM' : 'IN',
            },
            Length: String(Math.ceil(pkg.length)),
            Width: String(Math.ceil(pkg.width || 0)),
            Height: String(Math.ceil(pkg.height || 0)),
          }
        : undefined,
      PackageServiceOptions: pkg.declaredValue
        ? {
            DeclaredValue: {
              MonetaryValue: String(pkg.declaredValue),
            },
          }
        : undefined,
      Description: pkg.description || 'Package',
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
   * Get label height in inches
   */
  private getLabelHeight(size?: string): string {
    switch (size) {
      case '4x6':
        return '6';
      case '6x4':
        return '4';
      case '8.5x11':
        return '11';
      default:
        return '6';
    }
  }

  /**
   * Get label width in inches
   */
  private getLabelWidth(size?: string): string {
    switch (size) {
      case '4x6':
        return '4';
      case '6x4':
        return '6';
      case '8.5x11':
        return '8.5';
      default:
        return '4';
    }
  }

  /**
   * Format date for UPS API (YYYYMMDD)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  /**
   * Generate mock tracking number
   */
  private generateTrackingNumber(): string {
    // UPS tracking numbers are 1Z followed by 16 characters
    return '1Z' + Math.random().toString(36).substring(2, 18).toUpperCase();
  }

  /**
   * Generate mock pickup ID
   */
  private generatePickupId(): string {
    return Math.random().toString(36).substring(2, 12).toUpperCase();
  }

  /**
   * Generate mock label data (base64)
   */
  private generateMockLabelData(trackingNumber: string): string {
    // In production, this would be the actual PDF/ZPL label data
    const labelContent = `UPS SHIPPING LABEL\nTracking: ${trackingNumber}\n\nThis is a mock label`;
    return Buffer.from(labelContent).toString('base64');
  }
}
