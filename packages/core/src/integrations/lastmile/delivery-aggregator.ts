import type {
  LastMileDelivery,
  LastMileQuote,
  LastMileTracking,
  DeliveryFilterOptions,
  QuoteOptions,
  Location,
  PlatformType,
  PlatformMetrics,
} from './types';
import { DoorDashDriveClient } from './doordash-drive-client';
import { UberEatsClient } from './ubereats-client';
import { GrubhubClient } from './grubhub-client';

interface AggregatorConfig {
  doordash?: {
    developer_id: string;
    key_id: string;
    signing_secret: string;
    webhook_secret: string;
    enabled: boolean;
  };
  ubereats?: {
    oauth_client_id: string;
    oauth_client_secret: string;
    initial_token: string;
    webhook_secret: string;
    enabled: boolean;
  };
  grubhub?: {
    api_key: string;
    webhook_secret: string;
    restaurant_id: string;
    oauth_client_id?: string;
    oauth_client_secret?: string;
    initial_token?: string;
    enabled: boolean;
  };
  sandbox_mode?: boolean;
}

interface QuoteComparison {
  doordash?: LastMileQuote;
  ubereats?: LastMileQuote;
  grubhub?: LastMileQuote;
  recommended_platform: PlatformType;
  reason: 'fastest' | 'cheapest' | 'best_rated';
}

interface TrackingUpdate {
  platform: PlatformType;
  delivery_id: string;
  tracking: LastMileTracking;
  timestamp: Date;
}

export class DeliveryAggregator {
  private doordash: DoorDashDriveClient | null = null;
  private ubereats: UberEatsClient | null = null;
  private grubhub: GrubhubClient | null = null;

  private enabled_platforms: PlatformType[] = [];
  private sandbox_mode: boolean = false;

  private delivery_cache: Map<string, LastMileDelivery> = new Map();
  private quote_cache: Map<string, QuoteComparison> = new Map();
  private tracking_history: TrackingUpdate[] = [];

  private metrics_by_platform: Map<PlatformType, PlatformMetrics> = new Map();

  constructor(config: AggregatorConfig) {
    this.sandbox_mode = config.sandbox_mode || false;

    if (config.doordash && config.doordash.enabled) {
      this.doordash = new DoorDashDriveClient(
        config.doordash.developer_id,
        config.doordash.key_id,
        config.doordash.signing_secret,
        config.doordash.webhook_secret,
        this.sandbox_mode
      );
      this.enabled_platforms.push('doordash');
    }

    if (config.ubereats && config.ubereats.enabled) {
      this.ubereats = new UberEatsClient(
        config.ubereats.oauth_client_id,
        config.ubereats.oauth_client_secret,
        config.ubereats.initial_token,
        config.ubereats.webhook_secret,
        this.sandbox_mode
      );
      this.enabled_platforms.push('ubereats');
    }

    if (config.grubhub && config.grubhub.enabled) {
      this.grubhub = new GrubhubClient(
        config.grubhub.api_key,
        config.grubhub.webhook_secret,
        config.grubhub.restaurant_id,
        config.grubhub.oauth_client_id,
        config.grubhub.oauth_client_secret,
        config.grubhub.initial_token,
        this.sandbox_mode
      );
      this.enabled_platforms.push('grubhub');
    }

    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    for (const platform of this.enabled_platforms) {
      this.metrics_by_platform.set(platform, {
        platform,
        total_deliveries: 0,
        successful_deliveries: 0,
        failed_deliveries: 0,
        cancelled_deliveries: 0,
        success_rate: 0,
        average_delivery_time_minutes: 0,
        average_distance_km: 0,
        total_revenue: 0,
        total_commissions: 0,
        net_revenue: 0,
        average_rating: 0,
        total_reviews: 0,
        period: {
          start_date: new Date(),
          end_date: new Date(),
        },
      });
    }
  }

  async createDelivery(
    platform: PlatformType,
    delivery: Partial<LastMileDelivery>
  ): Promise<LastMileDelivery> {
    const adapter = this.getAdapter(platform);
    if (!adapter) {
      throw new Error(`Platform ${platform} is not enabled`);
    }

    try {
      const created_delivery = await adapter.createDelivery(delivery);
      this.delivery_cache.set(created_delivery.id, created_delivery);
      this.recordMetric(platform, 'total_deliveries', 1);
      return created_delivery;
    } catch (error) {
      this.recordMetric(platform, 'failed_deliveries', 1);
      throw error;
    }
  }

  async getDelivery(platform: PlatformType, delivery_id: string): Promise<LastMileDelivery | null> {
    const cached = this.delivery_cache.get(delivery_id);
    if (cached) {
      return cached;
    }

    const adapter = this.getAdapter(platform);
    if (!adapter) {
      throw new Error(`Platform ${platform} is not enabled`);
    }

    const delivery = await adapter.getDelivery(delivery_id);
    if (delivery) {
      this.delivery_cache.set(delivery_id, delivery);
    }

    return delivery;
  }

  async updateDelivery(
    platform: PlatformType,
    delivery_id: string,
    updates: Partial<LastMileDelivery>
  ): Promise<LastMileDelivery> {
    const adapter = this.getAdapter(platform);
    if (!adapter) {
      throw new Error(`Platform ${platform} is not enabled`);
    }

    const updated_delivery = await adapter.updateDelivery(delivery_id, updates);
    this.delivery_cache.set(delivery_id, updated_delivery);
    return updated_delivery;
  }

  async cancelDelivery(platform: PlatformType, delivery_id: string): Promise<LastMileDelivery> {
    const adapter = this.getAdapter(platform);
    if (!adapter) {
      throw new Error(`Platform ${platform} is not enabled`);
    }

    const cancelled_delivery = await adapter.cancelDelivery(delivery_id);
    this.delivery_cache.delete(delivery_id);
    this.recordMetric(platform, 'cancelled_deliveries', 1);
    return cancelled_delivery;
  }

  async getQuote(
    pickup: Location,
    dropoff: Location,
    options?: QuoteOptions
  ): Promise<QuoteComparison> {
    const cache_key = `${pickup.latitude}-${pickup.longitude}-${dropoff.latitude}-${dropoff.longitude}`;
    const cached = this.quote_cache.get(cache_key);

    if (cached && new Date(cached.doordash?.valid_until || 0) > new Date()) {
      return cached;
    }

    const quotes: Record<PlatformType, LastMileQuote | null> = {
      doordash: null,
      ubereats: null,
      grubhub: null,
      uberdirect: null,
    };

    const quote_promises = [];

    if (this.doordash) {
      quote_promises.push(
        this.doordash
          .getQuote(pickup, dropoff, options)
          .then((q) => {
            quotes.doordash = q;
          })
          .catch(() => {
            // Handle error silently, continue with other platforms
          })
      );
    }

    if (this.ubereats) {
      quote_promises.push(
        this.ubereats
          .getQuote(pickup, dropoff, options)
          .then((q) => {
            quotes.ubereats = q;
          })
          .catch(() => {})
      );
    }

    if (this.grubhub) {
      quote_promises.push(
        this.grubhub
          .getQuote(pickup, dropoff, options)
          .then((q) => {
            quotes.grubhub = q;
          })
          .catch(() => {})
      );
    }

    await Promise.all(quote_promises);

    const comparison = this.compareQuotes(quotes);
    this.quote_cache.set(cache_key, comparison);

    return comparison;
  }

  private compareQuotes(quotes: Record<PlatformType, LastMileQuote | null>): QuoteComparison {
    const valid_quotes = Object.entries(quotes)
      .filter(([_, q]) => q !== null)
      .map(([platform, quote]) => ({
        platform: platform as PlatformType,
        quote: quote as LastMileQuote,
      }));

    if (valid_quotes.length === 0) {
      throw new Error('No quotes available from any platform');
    }

    // Find cheapest
    const cheapest = valid_quotes.reduce((min, curr) =>
      curr.quote.total < min.quote.total ? curr : min
    );

    // Find fastest (shortest duration)
    const fastest = valid_quotes.reduce((min, curr) =>
      curr.quote.duration_seconds < min.quote.duration_seconds ? curr : min
    );

    // Default to cheapest
    let recommended_platform = cheapest.platform;
    let reason: 'fastest' | 'cheapest' | 'best_rated' = 'cheapest';

    // Use fastest if time difference is significant
    if (fastest.quote.duration_seconds < cheapest.quote.duration_seconds * 0.8) {
      recommended_platform = fastest.platform;
      reason = 'fastest';
    }

    const result: QuoteComparison = {
      recommended_platform,
      reason,
    };

    if (quotes.doordash) result.doordash = quotes.doordash;
    if (quotes.ubereats) result.ubereats = quotes.ubereats;
    if (quotes.grubhub) result.grubhub = quotes.grubhub;

    return result;
  }

  async getTracking(platform: PlatformType, delivery_id: string): Promise<LastMileTracking> {
    const adapter = this.getAdapter(platform);
    if (!adapter) {
      throw new Error(`Platform ${platform} is not enabled`);
    }

    const tracking = await adapter.getTracking(delivery_id);
    this.tracking_history.push({
      platform,
      delivery_id,
      tracking,
      timestamp: new Date(),
    });

    return tracking;
  }

  async getUnifiedTrackingFeed(limit: number = 20): Promise<TrackingUpdate[]> {
    return this.tracking_history
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async getMetrics(platform?: PlatformType): Promise<PlatformMetrics | Map<PlatformType, PlatformMetrics>> {
    if (platform) {
      const metrics = this.metrics_by_platform.get(platform);
      if (!metrics) {
        throw new Error(`Platform ${platform} not found`);
      }
      return metrics;
    }

    return this.metrics_by_platform;
  }

  async getCommissionAnalysis(): Promise<{
    by_platform: Record<PlatformType, { total_commissions: number; commission_rate: number }>;
    total: number;
    average_rate: number;
  }> {
    const analysis: Record<
      PlatformType,
      { total_commissions: number; commission_rate: number }
    > = {
      doordash: { total_commissions: 0, commission_rate: 0.25 },
      ubereats: { total_commissions: 0, commission_rate: 0.25 },
      grubhub: { total_commissions: 0, commission_rate: 0.25 },
      uberdirect: { total_commissions: 0, commission_rate: 0.15 },
    };

    let total_commissions = 0;
    let total_rate = 0;
    let platform_count = 0;

    for (const platform of this.enabled_platforms) {
      const metrics = this.metrics_by_platform.get(platform);
      if (metrics) {
        analysis[platform].total_commissions = metrics.total_commissions;
        total_commissions += metrics.total_commissions;
        total_rate += analysis[platform].commission_rate;
        platform_count += 1;
      }
    }

    return {
      by_platform: analysis,
      total: total_commissions,
      average_rate: platform_count > 0 ? total_rate / platform_count : 0,
    };
  }

  async failoverToNextPlatform(
    primary_platform: PlatformType,
    delivery: Partial<LastMileDelivery>
  ): Promise<LastMileDelivery> {
    const available_platforms = this.enabled_platforms.filter((p) => p !== primary_platform);

    for (const platform of available_platforms) {
      try {
        return await this.createDelivery(platform, delivery);
      } catch (error) {
        // Try next platform
        continue;
      }
    }

    throw new Error(`Failed to create delivery on any platform`);
  }

  async syncMenus(platform: PlatformType): Promise<boolean> {
    // This would sync menu items between platforms
    // Implementation depends on specific platform APIs
    return true;
  }

  async syncOrders(platform: PlatformType, filters?: DeliveryFilterOptions): Promise<LastMileDelivery[]> {
    const adapter = this.getAdapter(platform);
    if (!adapter) {
      throw new Error(`Platform ${platform} is not enabled`);
    }

    const deliveries = await adapter.listDeliveries(filters);

    for (const delivery of deliveries) {
      this.delivery_cache.set(delivery.id, delivery);
    }

    return deliveries;
  }

  async listAllDeliveries(filters?: DeliveryFilterOptions): Promise<LastMileDelivery[]> {
    const all_deliveries: LastMileDelivery[] = [];

    for (const platform of this.enabled_platforms) {
      const adapter = this.getAdapter(platform);
      if (adapter) {
        try {
          const deliveries = await adapter.listDeliveries(filters);
          all_deliveries.push(...deliveries);
        } catch (error) {
          // Log but continue with other platforms
          console.error(`Failed to sync ${platform} deliveries:`, error);
        }
      }
    }

    return all_deliveries.sort(
      (a, b) => b.created_at.getTime() - a.created_at.getTime()
    );
  }

  private getAdapter(
    platform: PlatformType
  ): DoorDashDriveClient | UberEatsClient | GrubhubClient | null {
    switch (platform) {
      case 'doordash':
        return this.doordash;
      case 'ubereats':
        return this.ubereats;
      case 'grubhub':
        return this.grubhub;
      default:
        return null;
    }
  }

  private recordMetric(platform: PlatformType, metric: string, value: number): void {
    const metrics = this.metrics_by_platform.get(platform);
    if (metrics) {
      (metrics as any)[metric] = ((metrics as any)[metric] || 0) + value;
    }
  }

  getEnabledPlatforms(): PlatformType[] {
    return this.enabled_platforms;
  }

  getHealthStatus(): Record<PlatformType, boolean> {
    return {
      doordash: this.doordash !== null,
      ubereats: this.ubereats !== null,
      grubhub: this.grubhub !== null,
      uberdirect: false,
    };
  }

  clearCache(): void {
    this.delivery_cache.clear();
    this.quote_cache.clear();
    this.tracking_history = [];
  }
}
