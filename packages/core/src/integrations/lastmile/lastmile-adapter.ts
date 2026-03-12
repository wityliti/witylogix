import type {
  LastMileDelivery,
  LastMileDriver,
  LastMileQuote,
  LastMileTracking,
  LastMileAdapterInterface,
  DeliveryFilterOptions,
  QuoteOptions,
  Location,
  DeliveryTimeEstimate,
  DistanceCalculation,
  FeeCalculation,
  SurgePricingInfo,
  PlatformType,
  DeliveryStatus,
} from './types';
import { createHash, createHmac } from 'crypto';

interface RateLimitBucket {
  tokens: number;
  last_refill: number;
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half_open';
  failure_count: number;
  success_count: number;
  last_failure_time: number;
  opened_at: number;
}

export abstract class LastMileAdapter implements LastMileAdapterInterface {
  protected platform: PlatformType;
  protected api_key?: string;
  protected sandbox_mode: boolean = false;

  private rate_limit_buckets: Map<string, RateLimitBucket> = new Map();
  private circuit_breaker: CircuitBreakerState = {
    state: 'closed',
    failure_count: 0,
    success_count: 0,
    last_failure_time: 0,
    opened_at: 0,
  };

  private rate_limit_config = {
    max_requests: 1000,
    window_seconds: 60,
    per_second_limit: 20,
  };

  private circuit_breaker_config = {
    failure_threshold: 5,
    recovery_timeout_ms: 60000,
    success_threshold: 3,
  };

  constructor(platform: PlatformType, api_key?: string) {
    this.platform = platform;
    this.api_key = api_key;
  }

  // Abstract methods that subclasses must implement
  abstract createDelivery(delivery: Partial<LastMileDelivery>): Promise<LastMileDelivery>;
  abstract getDelivery(delivery_id: string): Promise<LastMileDelivery | null>;
  abstract updateDelivery(
    delivery_id: string,
    updates: Partial<LastMileDelivery>
  ): Promise<LastMileDelivery>;
  abstract cancelDelivery(delivery_id: string, reason?: string): Promise<LastMileDelivery>;
  abstract listDeliveries(filters?: DeliveryFilterOptions): Promise<LastMileDelivery[]>;
  abstract getQuote(
    pickup: Location,
    dropoff: Location,
    options?: QuoteOptions
  ): Promise<LastMileQuote>;
  abstract getTracking(delivery_id: string): Promise<LastMileTracking>;
  abstract getTrackingByExternalId(external_id: string): Promise<LastMileTracking>;
  abstract getDriver(driver_id: string): Promise<LastMileDriver | null>;
  abstract listAvailableDrivers(location: Location, radius_meters?: number): Promise<LastMileDriver[]>;
  abstract verifyWebhookSignature(payload: string, signature: string): boolean;
  abstract parseWebhookEvent(payload: string): any;

  // Rate Limiting
  protected async checkRateLimit(key: string = 'default'): Promise<void> {
    const now = Date.now();
    let bucket = this.rate_limit_buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: this.rate_limit_config.max_requests,
        last_refill: now,
      };
      this.rate_limit_buckets.set(key, bucket);
    }

    const time_passed_ms = now - bucket.last_refill;
    const time_passed_s = time_passed_ms / 1000;
    const tokens_to_add = time_passed_s * (this.rate_limit_config.max_requests / this.rate_limit_config.window_seconds);

    bucket.tokens = Math.min(
      this.rate_limit_config.max_requests,
      bucket.tokens + tokens_to_add
    );
    bucket.last_refill = now;

    if (bucket.tokens < 1) {
      throw new Error(`Rate limit exceeded for key: ${key}`);
    }

    bucket.tokens -= 1;
  }

  // Circuit Breaker Pattern
  protected async executeWithCircuitBreaker<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    const cb = this.circuit_breaker;

    if (cb.state === 'open') {
      const time_since_open = Date.now() - cb.opened_at;
      if (time_since_open > this.circuit_breaker_config.recovery_timeout_ms) {
        cb.state = 'half_open';
        cb.success_count = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();

      if (cb.state === 'half_open') {
        cb.success_count += 1;
        if (cb.success_count >= this.circuit_breaker_config.success_threshold) {
          cb.state = 'closed';
          cb.failure_count = 0;
          cb.success_count = 0;
        }
      }

      return result;
    } catch (error) {
      cb.failure_count += 1;
      cb.last_failure_time = Date.now();

      if (cb.failure_count >= this.circuit_breaker_config.failure_threshold) {
        cb.state = 'open';
        cb.opened_at = Date.now();
      }

      throw error;
    }
  }

  // Distance Calculation using Haversine formula
  protected calculateDistance(start: Location, end: Location): DistanceCalculation {
    const R = 6371; // Earth's radius in km
    const dLat = this.degreesToRadians(end.latitude - start.latitude);
    const dLon = this.degreesToRadians(end.longitude - start.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degreesToRadians(start.latitude)) *
        Math.cos(this.degreesToRadians(end.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance_km = R * c;

    // Rough estimate: 1 km takes approximately 1.5 minutes at average city speed
    const duration_seconds = Math.round((distance_km / 30) * 3600);

    return {
      distance_km,
      distance_miles: distance_km * 0.621371,
      distance_meters: distance_km * 1000,
      duration_seconds,
    };
  }

  protected degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Delivery Time Estimation
  protected estimateDeliveryTime(
    pickup_location: Location,
    dropoff_location: Location,
    current_time: Date = new Date()
  ): DeliveryTimeEstimate {
    const distance = this.calculateDistance(pickup_location, dropoff_location);

    // Estimate 5 minutes for pickup, variable distance time, 3 minutes for dropoff
    const pickup_eta_minutes = 5;
    const distance_eta_minutes = Math.ceil(distance.duration_seconds / 60);
    const dropoff_eta_minutes = 3;

    const total_duration_minutes = pickup_eta_minutes + distance_eta_minutes + dropoff_eta_minutes;

    return {
      pickup_eta_minutes,
      dropoff_eta_minutes,
      total_duration_minutes,
      confidence_level: 'medium',
    };
  }

  // Fee and Commission Calculation
  protected calculateFees(
    distance_km: number,
    base_fee: number,
    distance_fee_per_km: number,
    time_fee_per_minute: number,
    duration_minutes: number,
    surge_multiplier: number = 1.0,
    item_count: number = 0
  ): FeeCalculation {
    const distance_fee = distance_km * distance_fee_per_km;
    const time_fee = duration_minutes * time_fee_per_minute;
    let small_order_fee = 0;

    if (item_count > 0 && item_count < 3) {
      small_order_fee = 1.5;
    }

    const subtotal_before_surge = base_fee + distance_fee + time_fee + small_order_fee;
    const surge_applied = subtotal_before_surge * (surge_multiplier - 1);

    const subtotal = subtotal_before_surge + surge_applied;
    const service_fee = Math.ceil(subtotal * 0.15); // 15% service fee
    const subtotal_with_service = subtotal + service_fee;

    const tax = Math.ceil(subtotal_with_service * 0.0875); // 8.75% tax (varies by location)

    return {
      base_fee,
      distance_fee,
      time_fee,
      surge_fee: surge_applied,
      service_fee,
      small_order_fee,
      tax,
      total_fee: subtotal_with_service + tax,
      currency: 'USD',
    };
  }

  // Surge Pricing Detection
  protected detectSurgePricing(
    current_demand_level: 'low' | 'medium' | 'high' | 'extreme',
    time_of_day: number // 0-23
  ): SurgePricingInfo {
    let multiplier = 1.0;
    let is_surge = false;
    let surge_reason: string | undefined;

    // Time-based surge (dinner rush 5-9pm, lunch 11:30am-1:30pm)
    if ((time_of_day >= 17 && time_of_day <= 21) ||
        (time_of_day >= 11 && time_of_day <= 14)) {
      multiplier *= 1.3;
      surge_reason = 'peak_hours';
      is_surge = true;
    }

    // Demand-based surge
    switch (current_demand_level) {
      case 'high':
        multiplier *= 1.5;
        surge_reason = 'high_demand';
        is_surge = true;
        break;
      case 'extreme':
        multiplier *= 2.5;
        surge_reason = 'extreme_demand';
        is_surge = true;
        break;
    }

    return {
      multiplier,
      is_surge,
      surge_reason,
      normal_eta_minutes: 20,
      surged_eta_minutes: Math.ceil(20 / multiplier),
    };
  }

  // Webhook Signature Verification using HMAC
  protected verifyHmacSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const computed_signature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return computed_signature === signature;
  }

  // Alternative webhook verification using RSA (for platforms that use public key)
  protected verifyRsaSignature(
    payload: string,
    signature: string,
    public_key: string
  ): boolean {
    try {
      const verify = createHmac('sha256', public_key);
      verify.update(payload);
      return verify.digest('hex') === signature;
    } catch {
      return false;
    }
  }

  // Commission Calculation
  protected calculateCommission(
    total_amount: number,
    commission_rate: number
  ): { commission: number; net_amount: number } {
    const commission = Math.round(total_amount * commission_rate);
    return {
      commission,
      net_amount: total_amount - commission,
    };
  }

  // Platform-agnostic delivery status mapping
  protected mapStatusToUnified(platform_status: string): DeliveryStatus {
    const status_map: Record<string, DeliveryStatus> = {
      created: 'created',
      pending: 'created',
      accepted: 'assigned',
      assigned: 'assigned',
      picked_up: 'picked-up',
      picked: 'picked-up',
      in_transit: 'in-transit',
      in_progress: 'in-transit',
      en_route: 'in-transit',
      delivered: 'delivered',
      completed: 'delivered',
      cancelled: 'cancelled',
      rejected: 'cancelled',
      failed: 'failed',
      error: 'failed',
    };

    return status_map[platform_status.toLowerCase()] || ('created' as DeliveryStatus);
  }

  protected mapUnifiedToStatus(unified_status: DeliveryStatus, platform: PlatformType): string {
    const status_reverse_map: Record<PlatformType, Record<DeliveryStatus, string>> = {
      doordash: {
        created: 'PENDING',
        assigned: 'ACCEPTED',
        'picked-up': 'PICKED_UP',
        'in-transit': 'EN_ROUTE_TO_CONSUMER',
        delivered: 'DELIVERED',
        cancelled: 'CANCELLED',
        failed: 'FAILED',
      },
      ubereats: {
        created: 'PENDING',
        assigned: 'ACCEPTED',
        'picked-up': 'PICKED_UP',
        'in-transit': 'EN_ROUTE_TO_DROPOFF',
        delivered: 'DELIVERED',
        cancelled: 'CANCELLED',
        failed: 'FAILED',
      },
      grubhub: {
        created: 'PENDING',
        assigned: 'ASSIGNED',
        'picked-up': 'PICKED_UP',
        'in-transit': 'IN_TRANSIT',
        delivered: 'DELIVERED',
        cancelled: 'CANCELLED',
        failed: 'FAILED',
      },
    };

    return status_reverse_map[platform]?.[unified_status] || 'PENDING';
  }

  // Validation helpers
  protected validateLocation(location: Location): boolean {
    return (
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180
    );
  }

  protected validateContact(contact: any): boolean {
    return contact && contact.name && contact.phone;
  }

  protected hashSignature(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  protected generateRequestId(): string {
    return `${this.platform}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected getCurrentTimestamp(): string {
    return new Date().toISOString();
  }
}
