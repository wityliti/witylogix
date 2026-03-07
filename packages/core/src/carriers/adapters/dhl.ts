/**
 * DHL Express Carrier Adapter
 * Implements CarrierAdapter interface for DHL Express shipping
 * Uses API key authentication with REST API endpoints
 * Focus on international shipping with customs documentation support
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
 * DHL service code mappings
 * DHL Express service codes for various delivery options
 */
const DHL_SERVICE_CODES = {
  P: { name: 'DHL PARCEL', level: 'ground', deliveryDays: 5 },
  N: { name: 'DHL Next Day 10:30 AM', level: 'overnight', deliveryDays: 1 },
  Y: { name: 'DHL Express 12:00 PM', level: 'express', deliveryDays: 1 },
  D: { name: 'DHL Express Worldwide Day', level: 'express', deliveryDays: 1 },
  C: { name: 'DHL Express Worldwide Cash', level: 'express', deliveryDays: 1 },
  A: { name: 'DHL Express Worldwide Account', level: 'express', deliveryDays: 1 },
  B: { name: 'DHL Express Worldwide Non-Document', level: 'express', deliveryDays: 1 },
  H: { name: 'DHL Express Worldwide 12:00', level: 'international', deliveryDays: 2 },
  K: { name: 'DHL Express 10:30 AM', level: 'international', deliveryDays: 2 },
  M: { name: 'DHL Express 9:00 AM', level: 'international', deliveryDays: 1 },
  X: { name: 'DHL Express Envelope', level: 'international', deliveryDays: 2 },
} as const;

/**
 * DHL Carrier Adapter Implementation
 * Handles rate quotes, label generation, tracking, and pickups via DHL API
 * Supports customs documentation for international shipments
 */
export class DhlAdapter implements CarrierAdapter {
  readonly name = 'DHL Express';
  readonly code = 'dhl';

  /** Cached API access key */
  private apiKey: string;

  /**
   * Create DHL adapter instance
   * @param apiKey - DHL API key for authentication
   * @param clientId - DHL client ID
   * @param password - DHL password for legacy auth (if using basic auth)
   * @param accountNumber - DHL account number
   * @param apiBaseUrl - Base URL for DHL API (default: production)
   */
  constructor(
    apiKey: string,
    private clientId: string,
    private password?: string,
    private accountNumber?: string,
    private apiBaseUrl = 'https://express.api.dhl.com',
  ) {
    this.apiKey = apiKey;
  }

  /**
   * Get shipping rates from DHL
   * @param request - Rate request with origin, destination, packages
   * @returns Array of available rate options
   */
  async getRates(request: RateRequest): Promise<RateResponse[]> {
    try {
      // Validate request
      this.validateRateRequest(request);

      // Build DHL rate request payload
      const payload = this.buildRatePayload(request);

      // TODO: Make HTTP request to DHL Rating API
      // POST {apiBaseUrl}/expressapi/rest/placeorder
      // Headers: Authorization: Basic {base64(clientId:password)}, Content-Type: application/json, Accept: application/json
      // OR use API key: DHL-API-Key: {apiKey}
      // Body: payload
      // Response: { bkingconfirmation } or { prices[] }

      // Mock response for development
      const mockRates: RateResponse[] = [
        {
          carrier: 'DHL Express',
          service: 'DHL Parcel',
          serviceCode: 'P',
          totalCharge: 16.75,
          currency: request.currency || 'USD',
          estimatedDeliveryDate: new Date(
            request.shipDate.getTime() + 5 * 24 * 60 * 60 * 1000,
          ),
          estimatedTransitDays: 5,
          guaranteedDelivery: false,
          breakdown: [
            { description: 'Base Rate', amount: 14.0 },
            { description: 'Surcharge', amount: 2.75 },
          ],
        },
        {
          carrier: 'DHL Express',
          service: 'DHL Express 12:00 PM',
          serviceCode: 'Y',
          totalCharge: 35.99,
          currency: request.currency || 'USD',
          estimatedDeliveryDate: new Date(
            request.shipDate.getTime() + 1 * 24 * 60 * 60 * 1000,
          ),
          estimatedTransitDays: 1,
          guaranteedDelivery: true,
          breakdown: [
            { description: 'Base Rate', amount: 32.0 },
            { description: 'Fuel Surcharge', amount: 3.99 },
          ],
        },
        {
          carrier: 'DHL Express',
          service: 'DHL Express Worldwide 12:00',
          serviceCode: 'H',
          totalCharge: 48.5,
          currency: request.currency || 'USD',
          estimatedDeliveryDate: new Date(
            request.shipDate.getTime() + 2 * 24 * 60 * 60 * 1000,
          ),
          estimatedTransitDays: 2,
          guaranteedDelivery: true,
          breakdown: [
            { description: 'Base Rate', amount: 44.0 },
            { description: 'International Surcharge', amount: 4.5 },
          ],
        },
      ];

      return mockRates;
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'dhl',
        'RATE_LOOKUP_FAILED',
        'Failed to retrieve DHL shipping rates',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Create a shipping label with DHL
   * @param request - Label creation request
   * @returns Shipping label with tracking number and label data
   */
  async createLabel(request: LabelRequest): Promise<LabelResponse> {
    try {
      // Validate request
      this.validateLabelRequest(request);

      // Build DHL shipping request payload
      const payload = this.buildShippingPayload(request);

      // TODO: Make HTTP request to DHL Shipment API
      // POST {apiBaseUrl}/expressapi/rest/shipmentrequest
      // Headers: DHL-API-Key: {apiKey}, Content-Type: application/json
      // Body: payload
      // Response: { shipmentResponse: { shipmentIdentificationNumber, packages[] } }

      // Mock response for development
      const trackingNumber = this.generateTrackingNumber();
      const labelUrl = `https://mydhl.express.dhl.com/mydhl-label-view?barcode=${trackingNumber}`;

      return {
        trackingNumber,
        labelUrl,
        labelData: this.generateMockLabelData(trackingNumber),
        labelFormat: request.labelFormat || 'PDF',
        carrier: 'DHL Express',
        service: DHL_SERVICE_CODES[request.serviceCode as keyof typeof DHL_SERVICE_CODES]?.name || 'DHL Express',
        estimatedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        cost: 28.99,
        currency: request.currency || 'USD',
        barcode: trackingNumber,
      };
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'dhl',
        'LABEL_CREATION_FAILED',
        'Failed to create DHL shipping label',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Void/cancel a DHL shipping label
   * @param trackingNumber - Tracking number to void
   * @returns Void confirmation
   */
  async voidLabel(trackingNumber: string): Promise<VoidResponse> {
    try {
      if (!trackingNumber || trackingNumber.length < 10) {
        throw new CarrierError('dhl', 'INVALID_TRACKING', 'Invalid DHL tracking number');
      }

      // TODO: Make HTTP request to DHL Cancellation API
      // DELETE {apiBaseUrl}/expressapi/rest/shipment/{shipmentId}
      // Headers: DHL-API-Key: {apiKey}
      // Response: { status: 'cancelled' }

      return {
        success: true,
        trackingNumber,
        refund: 28.99,
        currency: 'USD',
        voidedAt: new Date(),
        message: 'DHL shipment successfully cancelled',
      };
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'dhl',
        'VOID_FAILED',
        'Failed to void DHL shipping label',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Get tracking information for a DHL shipment
   * @param trackingNumber - DHL tracking number
   * @returns Complete tracking information and history
   */
  async getTracking(trackingNumber: string): Promise<TrackingResponse> {
    try {
      if (!trackingNumber || trackingNumber.length < 10) {
        throw new CarrierError('dhl', 'INVALID_TRACKING', 'Invalid DHL tracking number');
      }

      // TODO: Make HTTP request to DHL Track API
      // GET {apiBaseUrl}/track/shipments?trackingNumber={trackingNumber}
      // Headers: DHL-API-Key: {apiKey}
      // Response: { shipments: [{ status, events[] }] }

      // Mock response for development
      return {
        carrier: 'DHL Express',
        trackingNumber,
        status: 'in_transit',
        delivered: false,
        events: [
          {
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
            status: 'shipment_picked_up',
            description: 'Shipment picked up',
            location: {
              city: 'Singapore',
              country: 'SG',
            },
          },
          {
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
            status: 'customs_clearance',
            description: 'Customs clearance in progress',
            location: {
              city: 'Singapore',
              country: 'SG',
            },
          },
          {
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
            status: 'in_transit',
            description: 'In transit to destination',
            location: {
              city: 'Hong Kong',
              country: 'HK',
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
        'dhl',
        'TRACKING_FAILED',
        'Failed to retrieve DHL tracking information',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Schedule a DHL pickup
   * @param request - Pickup scheduling request
   * @returns Pickup confirmation details
   */
  async schedulePickup(request: PickupRequest): Promise<PickupResponse> {
    try {
      // Validate pickup request
      this.validatePickupRequest(request);

      // Build DHL pickup request payload
      const payload = this.buildPickupPayload(request);

      // TODO: Make HTTP request to DHL Pickup API
      // POST {apiBaseUrl}/expressapi/rest/pickuprequest
      // Headers: DHL-API-Key: {apiKey}, Content-Type: application/json
      // Body: payload
      // Response: { pickupConfirmationNumber, readyByTime }

      const pickupId = this.generatePickupId();

      return {
        pickupId,
        pickupDate: request.pickupDate,
        location: request.location,
        confirmedAt: new Date(),
        estimatedArrivalWindow: request.timeWindow,
        confirmationCode: `DHL-${pickupId}`,
        message: 'DHL pickup scheduled successfully',
      };
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'dhl',
        'PICKUP_FAILED',
        'Failed to schedule DHL pickup',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Cancel a scheduled DHL pickup
   * @param pickupId - Pickup ID to cancel
   */
  async cancelPickup(pickupId: string): Promise<void> {
    try {
      if (!pickupId) {
        throw new CarrierError('dhl', 'INVALID_PICKUP_ID', 'Pickup ID is required');
      }

      // TODO: Make HTTP request to DHL Pickup Cancellation API
      // DELETE {apiBaseUrl}/expressapi/rest/pickuprequest/{pickupId}
      // Headers: DHL-API-Key: {apiKey}
      // Response: { status: 'cancelled' }
    } catch (error) {
      if (error instanceof CarrierError) {
        throw error;
      }

      throw new CarrierError(
        'dhl',
        'PICKUP_CANCELLATION_FAILED',
        'Failed to cancel DHL pickup',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Validate a delivery address with DHL
   * @param address - Address to validate
   * @returns Validation response with corrected address if needed
   */
  async validateAddress(address: Address): Promise<AddressValidationResponse> {
    try {
      // Basic validation
      this.validateAddress_(address);

      // TODO: Make HTTP request to DHL Address Validation API
      // POST {apiBaseUrl}/expressapi/rest/addressvalidation
      // Headers: DHL-API-Key: {apiKey}, Content-Type: application/json
      // Body: { address: {...} }
      // Response: { validationResults: { validity, suggestions[] } }

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
        'dhl',
        'ADDRESS_VALIDATION_FAILED',
        'Failed to validate address with DHL',
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
      throw new CarrierError('dhl', 'INVALID_ORIGIN', 'Invalid origin address');
    }

    if (!request.destination?.street1 || !request.destination?.city) {
      throw new CarrierError('dhl', 'INVALID_DESTINATION', 'Invalid destination address');
    }

    if (!request.packages || request.packages.length === 0) {
      throw new CarrierError('dhl', 'NO_PACKAGES', 'At least one package is required');
    }
  }

  /**
   * Validate label request for required fields
   */
  private validateLabelRequest(request: LabelRequest): void {
    this.validateRateRequest(request as RateRequest);

    if (!request.serviceCode) {
      throw new CarrierError('dhl', 'NO_SERVICE_CODE', 'Service code is required');
    }
  }

  /**
   * Validate pickup request
   */
  private validatePickupRequest(request: PickupRequest): void {
    if (!request.location?.street1 || !request.location?.city) {
      throw new CarrierError('dhl', 'INVALID_LOCATION', 'Invalid pickup location');
    }

    if (request.packageCount <= 0) {
      throw new CarrierError('dhl', 'INVALID_PACKAGE_COUNT', 'Package count must be positive');
    }
  }

  /**
   * Validate address format
   */
  private validateAddress_(address: Address): void {
    if (!address.street1 || !address.city || !address.postalCode) {
      throw new CarrierError('dhl', 'INVALID_ADDRESS', 'Address is missing required fields');
    }
  }

  /**
   * Build rate request payload for DHL API
   */
  private buildRatePayload(request: RateRequest): Record<string, unknown> {
    return {
      getLabelResponse: {
        shipmentRequest: {
          ShipmentDetail: {
            Shipment: {
              ShipmentType: this.isDocument(request.packages) ? 'DOCUMENTS' : 'NON_DOCUMENTS',
              CurrencyCode: request.currency || 'USD',
              UnitOfMeasurement: 'SI',
              OriginServiceArea: {
                ServiceAreaCode: this.getServiceAreaCode(request.origin.country),
              },
              DestinationServiceArea: {
                ServiceAreaCode: this.getServiceAreaCode(request.destination.country),
              },
              Pieces: this.buildPiecesPayload(request.packages),
            },
          },
        },
      },
    };
  }

  /**
   * Build shipping/label request payload for DHL API
   */
  private buildShippingPayload(request: LabelRequest): Record<string, unknown> {
    return {
      planForPickupRequestIndicator: true,
      requestBarcodeType: 'IMG',
      shipmentRequest: {
        ShipmentDetail: {
          Shipment: {
            ServiceType: request.serviceCode,
            Currency: request.currency || 'USD',
            UnitOfMeasurement: 'SI',
            Shipper: this.addressToDhlFormat(request.origin),
            Recipient: this.addressToDhlFormat(request.destination),
            ShipmentType: this.isDocument(request.packages) ? 'DOCUMENTS' : 'NON_DOCUMENTS',
            InternationalDetail: this.buildInternationalDetail(request),
            Pieces: this.buildPiecesPayload(request.packages),
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
      pickupRequest: {
        Schedule: {
          PickupDate: this.formatDate(request.pickupDate),
          ReadyByTime: request.timeWindow?.start || '08:00',
          DeadlineTime: request.timeWindow?.end || '17:00',
        },
        PickupLocation: this.addressToDhlFormat(request.location),
        PickupDetails: {
          PackageCount: String(request.packageCount),
          TotalWeight: request.totalWeight || 1,
          WeightUnit: request.weightUnit?.toUpperCase() || 'KG',
        },
        SpecialInstructions: request.instructions,
      },
    };
  }

  /**
   * Build international shipping details for customs
   */
  private buildInternationalDetail(request: LabelRequest): Record<string, unknown> | undefined {
    // Only include for international shipments
    if (request.origin.country === request.destination.country) {
      return undefined;
    }

    return {
      Commodities: request.packages.map((pkg) => ({
        Description: pkg.description || 'Merchandise',
        Quantity: 1,
        UnitPrice: String(pkg.declaredValue || 0),
        NetWeight: String(this.convertToKg(pkg.weight, pkg.weightUnit)),
        GrossWeight: String(this.convertToKg(pkg.weight, pkg.weightUnit)),
        ExportLicenseNumber: undefined,
        ExportLicenseStatus: undefined,
      })),
      CustomerInvoiceNumber: request.reference,
      TermsOfTrade: 'DDP', // Delivered Duty Paid
    };
  }

  /**
   * Build pieces payload for packages
   */
  private buildPiecesPayload(packages: Package[]): Record<string, unknown> {
    return {
      Piece: packages.map((pkg, idx) => ({
        PieceNumber: String(idx + 1),
        Depth: String(Math.ceil(pkg.length || 0)),
        Width: String(Math.ceil(pkg.width || 0)),
        Height: String(Math.ceil(pkg.height || 0)),
        Weight: String(this.convertToKg(pkg.weight, pkg.weightUnit)),
        PieceContents: pkg.description || 'Package',
      })),
    };
  }

  /**
   * Convert Address to DHL format
   */
  private addressToDhlFormat(address: Address): Record<string, unknown> {
    return {
      Name: address.company || address.name,
      PersonName: address.name,
      StreetLine1: address.street1,
      StreetLine2: address.street2,
      City: address.city,
      PostalCode: address.postalCode,
      StateCode: address.state,
      CountryCode: address.country,
      PhoneNumber: address.phone,
      EmailAddress: address.email,
    };
  }

  /**
   * Determine if packages contain only documents
   */
  private isDocument(packages: Package[]): boolean {
    return packages.every((pkg) => {
      const desc = (pkg.description || '').toLowerCase();
      return desc.includes('document') || desc.includes('letter');
    });
  }

  /**
   * Get DHL service area code from country code
   */
  private getServiceAreaCode(countryCode: string): string {
    // Simplified mapping - in production this would be comprehensive
    const areaMap: Record<string, string> = {
      US: 'USA',
      CA: 'CAN',
      GB: 'GBR',
      DE: 'DEU',
      FR: 'FRA',
      JP: 'JPN',
      SG: 'SGP',
      AU: 'AUS',
      CN: 'CHN',
      IN: 'IND',
    };

    return areaMap[countryCode] || countryCode;
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
   * Format date for DHL API (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Generate mock DHL tracking number (11 digits)
   */
  private generateTrackingNumber(): string {
    return Math.floor(Math.random() * 100000000000).toString().padStart(11, '0');
  }

  /**
   * Generate mock DHL pickup ID
   */
  private generatePickupId(): string {
    return Math.floor(Math.random() * 1000000).toString().padStart(8, '0');
  }

  /**
   * Generate mock label data (base64)
   */
  private generateMockLabelData(trackingNumber: string): string {
    const labelContent = `DHL EXPRESS LABEL\nTracking: ${trackingNumber}\n\nInternational shipment`;
    return Buffer.from(labelContent).toString('base64');
  }
}
