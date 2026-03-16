/**
 * Shipment Tracker
 *
 * Tracks shipments across multiple carriers with unified status and ETA calculation.
 * Normalizes carrier-specific statuses to standard ShipmentStatus enum.
 *
 * @module shipping/shipment-tracker
 */

import {
  CarrierCode,
  ShipmentStatus,
  TrackingInfo,
  TrackingEvent,
  ShipmentAddress,
  ShippingError,
} from './shipping-types';

// ============================================================================
// Types
// ============================================================================

/**
 * Carrier status mapping configuration
 */
interface StatusMapping {
  /** Carrier-specific status code */
  carrierStatus: string;

  /** Maps to standard ShipmentStatus */
  mappedStatus: ShipmentStatus;

  /** Human-readable description */
  description: string;
}

/**
 * ETA calculation result
 */
export interface ETAResult {
  /** Estimated delivery date */
  estimatedDeliveryDate: Date;

  /** Confidence level (0-1) */
  confidence: number;

  /** Days remaining until estimated delivery */
  daysRemaining: number;

  /** Delivery window (if available) */
  deliveryWindow?: {
    start: Date;
    end: Date;
  };
}

/**
 * Webhook subscription for tracking updates
 */
export interface TrackingSubscription {
  /** Subscription ID */
  subscriptionId: string;

  /** Tracking number being tracked */
  trackingNumber: string;

  /** Webhook URL to call on updates */
  webhookUrl: string;

  /** Whether subscription is active */
  isActive: boolean;

  /** When subscription was created */
  createdAt: Date;
}

// ============================================================================
// StatusMapper Class
// ============================================================================

/**
 * Maps carrier-specific statuses to standard ShipmentStatus enum
 *
 * Each carrier has different status codes. This class provides
 * carrier-aware mapping to normalize them.
 */
export class StatusMapper {
  /**
   * Status mappings by carrier
   */
  private static readonly STATUS_MAPPINGS: Record<CarrierCode, StatusMapping[]> = {
    [CarrierCode.EASYPOST]: [
      { carrierStatus: 'unknown', mappedStatus: ShipmentStatus.PENDING, description: 'Unknown status' },
      { carrierStatus: 'label_created', mappedStatus: ShipmentStatus.LABEL_CREATED, description: 'Label created' },
      { carrierStatus: 'picked_up', mappedStatus: ShipmentStatus.PICKED_UP, description: 'Package picked up' },
      { carrierStatus: 'in_transit', mappedStatus: ShipmentStatus.IN_TRANSIT, description: 'In transit' },
      { carrierStatus: 'out_for_delivery', mappedStatus: ShipmentStatus.OUT_FOR_DELIVERY, description: 'Out for delivery' },
      { carrierStatus: 'delivered', mappedStatus: ShipmentStatus.DELIVERED, description: 'Delivered' },
      { carrierStatus: 'return_to_sender', mappedStatus: ShipmentStatus.RETURNED, description: 'Returned' },
    ],
    [CarrierCode.SHIPPO]: [
      { carrierStatus: 'unknown', mappedStatus: ShipmentStatus.PENDING, description: 'Unknown status' },
      { carrierStatus: 'label_created', mappedStatus: ShipmentStatus.LABEL_CREATED, description: 'Label created' },
      { carrierStatus: 'picked_up', mappedStatus: ShipmentStatus.PICKED_UP, description: 'Picked up' },
      { carrierStatus: 'in_transit', mappedStatus: ShipmentStatus.IN_TRANSIT, description: 'In transit' },
      { carrierStatus: 'out_for_delivery', mappedStatus: ShipmentStatus.OUT_FOR_DELIVERY, description: 'Out for delivery' },
      { carrierStatus: 'delivered', mappedStatus: ShipmentStatus.DELIVERED, description: 'Delivered' },
    ],
    [CarrierCode.SHIPSTATION]: [
      { carrierStatus: 'pending', mappedStatus: ShipmentStatus.PENDING, description: 'Pending shipment' },
      { carrierStatus: 'on_hold', mappedStatus: ShipmentStatus.PENDING, description: 'On hold' },
      { carrierStatus: 'label_printed', mappedStatus: ShipmentStatus.LABEL_CREATED, description: 'Label printed' },
      { carrierStatus: 'picked_up', mappedStatus: ShipmentStatus.PICKED_UP, description: 'Picked up' },
      { carrierStatus: 'in_transit', mappedStatus: ShipmentStatus.IN_TRANSIT, description: 'In transit' },
      { carrierStatus: 'delivered', mappedStatus: ShipmentStatus.DELIVERED, description: 'Delivered' },
      { carrierStatus: 'cancelled', mappedStatus: ShipmentStatus.EXCEPTION, description: 'Cancelled' },
    ],
    [CarrierCode.DHL]: [
      { carrierStatus: 'shipped', mappedStatus: ShipmentStatus.PENDING, description: 'Shipped' },
      { carrierStatus: 'label_created', mappedStatus: ShipmentStatus.LABEL_CREATED, description: 'Label created' },
      { carrierStatus: 'picked_up', mappedStatus: ShipmentStatus.PICKED_UP, description: 'Picked up' },
      { carrierStatus: 'in_transit', mappedStatus: ShipmentStatus.IN_TRANSIT, description: 'In transit' },
      { carrierStatus: 'out_for_delivery', mappedStatus: ShipmentStatus.OUT_FOR_DELIVERY, description: 'Out for delivery' },
      { carrierStatus: 'delivered', mappedStatus: ShipmentStatus.DELIVERED, description: 'Delivered' },
      { carrierStatus: 'exception', mappedStatus: ShipmentStatus.EXCEPTION, description: 'Exception' },
    ],
    [CarrierCode.USPS]: [
      { carrierStatus: 'pending', mappedStatus: ShipmentStatus.PENDING, description: 'Pending pickup' },
      { carrierStatus: 'accepted', mappedStatus: ShipmentStatus.LABEL_CREATED, description: 'Accepted' },
      { carrierStatus: 'picked_up', mappedStatus: ShipmentStatus.PICKED_UP, description: 'Picked up' },
      { carrierStatus: 'in_transit', mappedStatus: ShipmentStatus.IN_TRANSIT, description: 'In transit' },
      { carrierStatus: 'out_for_delivery', mappedStatus: ShipmentStatus.OUT_FOR_DELIVERY, description: 'Out for delivery' },
      { carrierStatus: 'delivered', mappedStatus: ShipmentStatus.DELIVERED, description: 'Delivered' },
      { carrierStatus: 'returned', mappedStatus: ShipmentStatus.RETURNED, description: 'Returned' },
    ],
    [CarrierCode.UPS]: [
      { carrierStatus: 'pending', mappedStatus: ShipmentStatus.PENDING, description: 'Pending' },
      { carrierStatus: 'label_created', mappedStatus: ShipmentStatus.LABEL_CREATED, description: 'Label created' },
      { carrierStatus: 'picked_up', mappedStatus: ShipmentStatus.PICKED_UP, description: 'Picked up' },
      { carrierStatus: 'in_transit', mappedStatus: ShipmentStatus.IN_TRANSIT, description: 'In transit' },
      { carrierStatus: 'out_for_delivery', mappedStatus: ShipmentStatus.OUT_FOR_DELIVERY, description: 'Out for delivery' },
      { carrierStatus: 'delivered', mappedStatus: ShipmentStatus.DELIVERED, description: 'Delivered' },
      { carrierStatus: 'exception', mappedStatus: ShipmentStatus.EXCEPTION, description: 'Exception' },
    ],
    [CarrierCode.FEDEX]: [
      { carrierStatus: 'pending', mappedStatus: ShipmentStatus.PENDING, description: 'Pending' },
      { carrierStatus: 'label_created', mappedStatus: ShipmentStatus.LABEL_CREATED, description: 'Label created' },
      { carrierStatus: 'picked_up', mappedStatus: ShipmentStatus.PICKED_UP, description: 'Picked up' },
      { carrierStatus: 'in_transit', mappedStatus: ShipmentStatus.IN_TRANSIT, description: 'In transit' },
      { carrierStatus: 'out_for_delivery', mappedStatus: ShipmentStatus.OUT_FOR_DELIVERY, description: 'Out for delivery' },
      { carrierStatus: 'delivered', mappedStatus: ShipmentStatus.DELIVERED, description: 'Delivered' },
      { carrierStatus: 'returned', mappedStatus: ShipmentStatus.RETURNED, description: 'Returned' },
    ],
    [CarrierCode.DOORDASH]: [
      { carrierStatus: 'pending', mappedStatus: ShipmentStatus.PENDING, description: 'Pending' },
      { carrierStatus: 'accepted', mappedStatus: ShipmentStatus.IN_TRANSIT, description: 'Accepted' },
      { carrierStatus: 'pickedup', mappedStatus: ShipmentStatus.OUT_FOR_DELIVERY, description: 'Picked up' },
      { carrierStatus: 'delivered', mappedStatus: ShipmentStatus.DELIVERED, description: 'Delivered' },
    ],
    [CarrierCode.UBER]: [
      { carrierStatus: 'pending', mappedStatus: ShipmentStatus.PENDING, description: 'Pending' },
      { carrierStatus: 'assigned', mappedStatus: ShipmentStatus.IN_TRANSIT, description: 'Driver assigned' },
      { carrierStatus: 'picked_up', mappedStatus: ShipmentStatus.OUT_FOR_DELIVERY, description: 'Picked up' },
      { carrierStatus: 'delivered', mappedStatus: ShipmentStatus.DELIVERED, description: 'Delivered' },
    ],
  };

  /**
   * Map carrier status to standard status
   * @param carrier - Carrier code
   * @param carrierStatus - Carrier-specific status code
   * @returns Mapped ShipmentStatus
   */
  static mapStatus(carrier: CarrierCode, carrierStatus: string): ShipmentStatus {
    const mappings = this.STATUS_MAPPINGS[carrier] ?? [];

    for (const mapping of mappings) {
      if (mapping.carrierStatus.toLowerCase() === carrierStatus.toLowerCase()) {
        return mapping.mappedStatus;
      }
    }

    // Default to PENDING if no mapping found
    return ShipmentStatus.PENDING;
  }

  /**
   * Get description for carrier status
   * @param carrier - Carrier code
   * @param carrierStatus - Carrier-specific status code
   * @returns Description or empty string if not found
   */
  static getDescription(carrier: CarrierCode, carrierStatus: string): string {
    const mappings = this.STATUS_MAPPINGS[carrier] ?? [];

    for (const mapping of mappings) {
      if (mapping.carrierStatus.toLowerCase() === carrierStatus.toLowerCase()) {
        return mapping.description;
      }
    }

    return '';
  }
}

// ============================================================================
// ETACalculator Class
// ============================================================================

/**
 * Calculates estimated delivery date based on carrier and current status
 *
 * Uses heuristics based on:
 * - Current shipment status
 * - Carrier speed/reliability
 * - Historical delivery patterns
 * - Geographic distance
 */
export class ETACalculator {
  /**
   * Default delivery times by carrier (in days)
   */
  private static readonly DEFAULT_DELIVERY_TIMES: Record<CarrierCode, number> = {
    [CarrierCode.EASYPOST]: 3,
    [CarrierCode.SHIPPO]: 3,
    [CarrierCode.SHIPSTATION]: 3,
    [CarrierCode.DHL]: 4,
    [CarrierCode.USPS]: 4,
    [CarrierCode.UPS]: 3,
    [CarrierCode.FEDEX]: 2,
    [CarrierCode.DOORDASH]: 1,
    [CarrierCode.UBER]: 1,
  };

  /**
   * Calculate ETA for a shipment
   * @param carrier - Carrier code
   * @param currentStatus - Current shipment status
   * @param shipDate - When shipment was sent
   * @param estimatedDays - Estimated days from rate quote (optional)
   * @returns ETA result
   */
  static calculateETA(
    carrier: CarrierCode,
    currentStatus: ShipmentStatus,
    shipDate: Date,
    estimatedDays?: number,
  ): ETAResult {
    const defaultDays = estimatedDays ?? this.DEFAULT_DELIVERY_TIMES[carrier] ?? 5;

    // Calculate based on current status
    let remainingDays = defaultDays;
    let confidence = 0.95;

    switch (currentStatus) {
      case ShipmentStatus.DELIVERED:
        remainingDays = 0;
        confidence = 1.0;
        break;
      case ShipmentStatus.OUT_FOR_DELIVERY:
        remainingDays = 1;
        confidence = 0.99;
        break;
      case ShipmentStatus.IN_TRANSIT:
        remainingDays = Math.max(1, Math.ceil(defaultDays / 2));
        confidence = 0.9;
        break;
      case ShipmentStatus.PICKED_UP:
        remainingDays = defaultDays;
        confidence = 0.85;
        break;
      case ShipmentStatus.LABEL_CREATED:
        remainingDays = defaultDays + 1;
        confidence = 0.7;
        break;
      case ShipmentStatus.PENDING:
        remainingDays = defaultDays + 2;
        confidence = 0.5;
        break;
      case ShipmentStatus.EXCEPTION:
      case ShipmentStatus.RETURNED:
        // Exceptions add uncertainty
        remainingDays = defaultDays + 3;
        confidence = 0.3;
        break;
    }

    const estimatedDeliveryDate = new Date(shipDate.getTime() + remainingDays * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.max(0, Math.ceil((estimatedDeliveryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

    return {
      estimatedDeliveryDate,
      confidence,
      daysRemaining,
      deliveryWindow: {
        start: new Date(estimatedDeliveryDate.getTime() - 12 * 60 * 60 * 1000),
        end: new Date(estimatedDeliveryDate.getTime() + 12 * 60 * 60 * 1000),
      },
    };
  }
}

// ============================================================================
// UnifiedTracker Class
// ============================================================================

/**
 * Unified shipment tracker across multiple carriers
 *
 * Features:
 * - Normalize carrier-specific tracking to standard format
 * - ETA calculation and updates
 * - Webhook subscriptions for status changes
 * - Historical event tracking
 */
export class UnifiedTracker {
  /**
   * In-memory tracking storage (keyed by tracking number)
   * In production, this would use a database
   */
  private trackingStore = new Map<string, TrackingInfo>();

  /**
   * Webhook subscriptions (keyed by subscription ID)
   */
  private subscriptions = new Map<string, TrackingSubscription>();

  /**
   * Mock tracking fetch functions (for testing)
   */
  private mockCarriers: Map<
    CarrierCode,
    (trackingNumber: string) => Promise<TrackingInfo>
  > = new Map();

  /**
   * Register a mock carrier for testing
   * @param carrier - Carrier code
   * @param fetchFn - Mock fetch function
   */
  registerMockCarrier(
    carrier: CarrierCode,
    fetchFn: (trackingNumber: string) => Promise<TrackingInfo>,
  ): void {
    this.mockCarriers.set(carrier, fetchFn);
  }

  /**
   * Track a shipment
   * @param trackingNumber - Tracking number
   * @param carrier - Carrier code
   * @returns Tracking information
   */
  async trackShipment(trackingNumber: string, carrier: CarrierCode): Promise<TrackingInfo> {
    if (!trackingNumber) {
      throw new ShippingError(
        'INVALID_TRACKING',
        'Tracking number is required',
        carrier,
      );
    }

    // Check cache first
    const cached = this.trackingStore.get(trackingNumber);
    if (cached && cached.carrier === carrier) {
      return cached;
    }

    // Try mock carrier
    const mockFn = this.mockCarriers.get(carrier);
    if (mockFn) {
      const tracking = await mockFn(trackingNumber);
      this.trackingStore.set(trackingNumber, tracking);
      return tracking;
    }

    // In production, this would call the carrier's tracking API
    throw new ShippingError(
      'CARRIER_NOT_IMPLEMENTED',
      `Tracking for ${carrier} not yet implemented`,
      carrier,
    );
  }

  /**
   * Subscribe to tracking updates via webhook
   * @param trackingNumber - Tracking number to watch
   * @param webhookUrl - URL to POST updates to
   * @returns Subscription details
   */
  subscribeToUpdates(trackingNumber: string, webhookUrl: string): TrackingSubscription {
    if (!trackingNumber || !webhookUrl) {
      throw new ShippingError(
        'INVALID_SUBSCRIPTION',
        'Tracking number and webhook URL are required',
      );
    }

    const subscriptionId = this.generateSubscriptionId();

    const subscription: TrackingSubscription = {
      subscriptionId,
      trackingNumber,
      webhookUrl,
      isActive: true,
      createdAt: new Date(),
    };

    this.subscriptions.set(subscriptionId, subscription);

    return subscription;
  }

  /**
   * Unsubscribe from tracking updates
   * @param subscriptionId - Subscription ID
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);

    if (!subscription) {
      throw new ShippingError(
        'SUBSCRIPTION_NOT_FOUND',
        `Subscription ${subscriptionId} not found`,
      );
    }

    subscription.isActive = false;
  }

  /**
   * Update tracking for a shipment
   * In production, this would be called by carrier webhooks
   * @param trackingNumber - Tracking number
   * @param carrier - Carrier code
   * @param event - New tracking event
   */
  updateTracking(
    trackingNumber: string,
    carrier: CarrierCode,
    event: Omit<TrackingEvent, 'timestamp'>,
  ): void {
    let tracking = this.trackingStore.get(trackingNumber);

    if (!tracking) {
      // Create new tracking record if doesn't exist
      tracking = {
        trackingNumber,
        shipmentId: '',
        carrier,
        status: event.status ?? ShipmentStatus.PENDING,
        events: [],
        delivered: false,
        updatedAt: new Date(),
      };

      this.trackingStore.set(trackingNumber, tracking);
    }

    // Add new event
    const newEvent: TrackingEvent = {
      ...event,
      timestamp: new Date(),
    };

    tracking.events.push(newEvent);

    // Update status
    tracking.status = event.status ?? tracking.status;

    // Update delivered flag if relevant
    if (event.status === ShipmentStatus.DELIVERED) {
      tracking.delivered = true;
      tracking.deliveredAt = new Date();
    }

    // Update timestamp
    tracking.updatedAt = new Date();
  }

  /**
   * Get tracking information
   * @param trackingNumber - Tracking number
   * @returns Tracking info or undefined if not found
   */
  getTracking(trackingNumber: string): TrackingInfo | undefined {
    return this.trackingStore.get(trackingNumber);
  }

  /**
   * List all active subscriptions for a tracking number
   * @param trackingNumber - Tracking number
   * @returns Active subscriptions
   */
  getSubscriptions(trackingNumber: string): TrackingSubscription[] {
    const subs: TrackingSubscription[] = [];

    this.subscriptions.forEach((sub) => {
      if (sub.trackingNumber === trackingNumber && sub.isActive) {
        subs.push(sub);
      }
    });

    return subs;
  }

  /**
   * Calculate ETA for a shipment
   * @param trackingNumber - Tracking number
   * @returns ETA result or undefined if tracking not found
   */
  calculateETA(trackingNumber: string): ETAResult | undefined {
    const tracking = this.trackingStore.get(trackingNumber);

    if (!tracking) {
      return undefined;
    }

    // Find ship date from events (first event or use current date)
    let shipDate = new Date();
    if (tracking.events.length > 0) {
      shipDate = tracking.events[0].timestamp;
    }

    return ETACalculator.calculateETA(
      tracking.carrier,
      tracking.status,
      shipDate,
    );
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}
