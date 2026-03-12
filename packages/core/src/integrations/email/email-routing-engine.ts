/**
 * Email Routing Engine — Intelligent provider routing.
 *
 * Distributes emails across multiple providers based on:
 * - Domain-based routing
 * - Volume-based load balancing
 * - Failover handling
 * - Priority routing (transactional vs marketing)
 * - Warmup management for new IPs/domains
 * - Cost optimization
 * - Reputation monitoring
 * - Unified suppression across all providers
 */

import { EmailAdapter } from "./email-adapter.js";
import type {
  EmailAdapterConfig,
  EmailMessage,
  EmailRecipient,
  BulkEmailRequest,
  EmailDeliveryStatus,
  EmailRouteRule,
  SuppressionEntry,
  EmailStats,
} from "./types.js";
import { DeliveryStatus } from "./types.js";

/**
 * Provider routing metrics.
 */
interface ProviderMetrics {
  name: string;
  successRate: number;
  failureCount: number;
  sendQuota: number;
  sendQuotaRemaining: number;
  lastFailure?: Date;
  costPerThousand: number;
  reputation: number; // 0-100
  warmupPhase: boolean;
  warmupPercentage: number;
}

/**
 * Email routing decision result.
 */
interface RoutingDecision {
  provider: string;
  adapter: EmailAdapter;
  reason: string;
}

/**
 * Email routing engine for intelligent provider selection.
 */
export class EmailRoutingEngine {
  private providers: Map<string, EmailAdapter> = new Map();
  private rules: EmailRouteRule[] = [];
  private metrics: Map<string, ProviderMetrics> = new Map();
  private suppressionCache: Map<string, SuppressionEntry> = new Map();
  private domainRoutes: Map<string, string[]> = new Map(); // domain -> [providers]
  private loadBalancer: { [key: string]: number } = {}; // provider -> current index

  /**
   * Register an email provider adapter.
   */
  registerProvider(name: string, adapter: EmailAdapter): void {
    this.providers.set(name, adapter);

    this.metrics.set(name, {
      name,
      successRate: 1.0,
      failureCount: 0,
      sendQuota: 10000,
      sendQuotaRemaining: 10000,
      costPerThousand: 0.5,
      reputation: 100,
      warmupPhase: true,
      warmupPercentage: 10,
    });

    this.loadBalancer[name] = 0;
  }

  /**
   * Add a routing rule.
   */
  addRule(rule: EmailRouteRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Configure domain-based routing.
   */
  setDomainRoute(domain: string, providers: string[]): void {
    this.domainRoutes.set(domain.toLowerCase(), providers);
  }

  /**
   * Get applicable routing rules for a message.
   */
  private getApplicableRules(message: EmailMessage): EmailRouteRule[] {
    return this.rules.filter((rule) => {
      if (!rule.enabled) return false;

      if (rule.domains) {
        const senderDomain = message.from.split("@")[1].toLowerCase();
        if (!rule.domains.includes(senderDomain)) return false;
      }

      if (rule.recipientPattern) {
        const toEmail = Array.isArray(message.to)
          ? message.to[0].email
          : message.to.email;
        const pattern = new RegExp(rule.recipientPattern);
        if (!pattern.test(toEmail)) return false;
      }

      if (rule.emailType && message.priority !== rule.emailType) {
        return false;
      }

      return true;
    });
  }

  /**
   * Select best provider based on strategy.
   */
  private selectFromProviders(
    providers: string[],
    strategy: "round_robin" | "random" | "fixed" = "fixed"
  ): string {
    const available = providers.filter(
      (p) => this.providers.has(p) && this.isProviderHealthy(p)
    );

    if (available.length === 0) {
      throw new Error("No healthy providers available");
    }

    switch (strategy) {
      case "round_robin": {
        const provider = available[this.loadBalancer[available[0]] || 0];
        this.loadBalancer[available[0]] = (this.loadBalancer[available[0]] || 0) + 1;
        return provider;
      }
      case "random":
        return available[Math.floor(Math.random() * available.length)];
      case "fixed":
      default:
        return available[0];
    }
  }

  /**
   * Check if provider is healthy.
   */
  private isProviderHealthy(providerName: string): boolean {
    const metrics = this.metrics.get(providerName);
    if (!metrics) return false;

    // Provider is unhealthy if failure count is high and recent
    if (metrics.failureCount > 5) {
      if (metrics.lastFailure && Date.now() - metrics.lastFailure.getTime() < 60000) {
        return false;
      }
    }

    // Check quota
    if (metrics.sendQuotaRemaining < 10) {
      return false;
    }

    return true;
  }

  /**
   * Determine optimal provider for message (main routing decision).
   */
  async routeMessage(message: EmailMessage): Promise<RoutingDecision> {
    // Check suppression cache
    const recipientEmail = Array.isArray(message.to)
      ? message.to[0].email
      : message.to.email;

    if (this.suppressionCache.has(recipientEmail.toLowerCase())) {
      throw new Error(`Recipient suppressed: ${recipientEmail}`);
    }

    // 1. Apply routing rules
    const applicableRules = this.getApplicableRules(message);
    if (applicableRules.length > 0) {
      const rule = applicableRules[0];
      const provider = this.selectFromProviders(
        rule.providers,
        rule.strategy || "fixed"
      );
      const adapter = this.providers.get(provider);
      if (adapter) {
        return {
          provider,
          adapter,
          reason: `Matched routing rule: ${rule.name}`,
        };
      }
    }

    // 2. Check domain-based routes
    const senderDomain = message.from.split("@")[1].toLowerCase();
    const domainProviders = this.domainRoutes.get(senderDomain);
    if (domainProviders && domainProviders.length > 0) {
      const provider = this.selectFromProviders(domainProviders, "fixed");
      const adapter = this.providers.get(provider);
      if (adapter) {
        return {
          provider,
          adapter,
          reason: `Domain routing: ${senderDomain}`,
        };
      }
    }

    // 3. Route by priority
    if (message.priority === "high") {
      return this.routeTransactional();
    }

    if (message.priority === "low") {
      return this.routeMarketing();
    }

    // 4. Default: cost-optimized provider
    return this.routeByLowestCost();
  }

  /**
   * Route transactional emails to fastest, most reliable provider.
   */
  private routeTransactional(): RoutingDecision {
    let bestProvider = "";
    let bestScore = -Infinity;

    for (const [name, metrics] of this.metrics.entries()) {
      if (!this.isProviderHealthy(name)) continue;

      const score =
        metrics.successRate * 0.7 + // Reliability 70%
        (metrics.reputation / 100) * 0.3; // Reputation 30%

      if (score > bestScore) {
        bestScore = score;
        bestProvider = name;
      }
    }

    if (!bestProvider) {
      throw new Error("No healthy transactional provider available");
    }

    const adapter = this.providers.get(bestProvider);
    if (!adapter) {
      throw new Error(`Provider ${bestProvider} not found`);
    }

    return {
      provider: bestProvider,
      adapter,
      reason: "Routed to most reliable provider (transactional)",
    };
  }

  /**
   * Route marketing emails to cheapest provider.
   */
  private routeMarketing(): RoutingDecision {
    let bestProvider = "";
    let bestScore = Infinity;

    for (const [name, metrics] of this.metrics.entries()) {
      if (!this.isProviderHealthy(name)) continue;

      const score = metrics.costPerThousand;

      if (score < bestScore) {
        bestScore = score;
        bestProvider = name;
      }
    }

    if (!bestProvider) {
      throw new Error("No healthy marketing provider available");
    }

    const adapter = this.providers.get(bestProvider);
    if (!adapter) {
      throw new Error(`Provider ${bestProvider} not found`);
    }

    return {
      provider: bestProvider,
      adapter,
      reason: "Routed to cheapest provider (marketing)",
    };
  }

  /**
   * Route to lowest cost provider overall.
   */
  private routeByLowestCost(): RoutingDecision {
    let bestProvider = "";
    let bestCost = Infinity;

    for (const [name, metrics] of this.metrics.entries()) {
      if (!this.isProviderHealthy(name)) continue;

      if (metrics.costPerThousand < bestCost) {
        bestCost = metrics.costPerThousand;
        bestProvider = name;
      }
    }

    if (!bestProvider) {
      throw new Error("No healthy provider available");
    }

    const adapter = this.providers.get(bestProvider);
    if (!adapter) {
      throw new Error(`Provider ${bestProvider} not found`);
    }

    return {
      provider: bestProvider,
      adapter,
      reason: "Routed to lowest cost provider",
    };
  }

  /**
   * Attempt to send via primary provider with failover.
   */
  async sendWithFailover(message: EmailMessage): Promise<{
    messageId: string;
    provider: string;
    timestamp: Date;
  }> {
    const primaryRoute = await this.routeMessage(message);

    try {
      const result = await primaryRoute.adapter.send(message);
      this.recordSuccess(primaryRoute.provider);
      return {
        messageId: result.messageId,
        provider: primaryRoute.provider,
        timestamp: result.timestamp,
      };
    } catch (error) {
      this.recordFailure(primaryRoute.provider, error as Error);

      // Try fallback providers
      for (const [name, adapter] of this.providers.entries()) {
        if (name === primaryRoute.provider) continue;
        if (!this.isProviderHealthy(name)) continue;

        try {
          const result = await adapter.send(message);
          this.recordSuccess(name);
          return {
            messageId: result.messageId,
            provider: name,
            timestamp: result.timestamp,
          };
        } catch (fallbackError) {
          this.recordFailure(name, fallbackError as Error);
        }
      }

      throw new Error(
        `Failed to send via all providers: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Send bulk emails distributed across providers.
   */
  async sendBulkDistributed(request: BulkEmailRequest): Promise<{
    messageIds: string[];
    provider: string;
    timestamp: Date;
  }> {
    const route = await this.routeMessage({
      from: request.from,
      to: request.recipients[0],
      subject: request.subject,
      priority: "low",
    } as EmailMessage);

    try {
      const results = await route.adapter.sendBatch(request);
      this.recordSuccess(route.provider);

      return {
        messageIds: results.map((r) => r.messageId),
        provider: route.provider,
        timestamp: new Date(),
      };
    } catch (error) {
      this.recordFailure(route.provider, error as Error);
      throw error;
    }
  }

  /**
   * Record successful send.
   */
  private recordSuccess(providerName: string): void {
    const metrics = this.metrics.get(providerName);
    if (metrics) {
      metrics.successRate = Math.min(1.0, metrics.successRate + 0.01);
      metrics.failureCount = Math.max(0, metrics.failureCount - 1);
      metrics.sendQuotaRemaining = Math.max(0, metrics.sendQuotaRemaining - 1);
    }
  }

  /**
   * Record failed send.
   */
  private recordFailure(providerName: string, error: Error): void {
    const metrics = this.metrics.get(providerName);
    if (metrics) {
      metrics.successRate = Math.max(0, metrics.successRate - 0.05);
      metrics.failureCount += 1;
      metrics.lastFailure = new Date();
      metrics.reputation = Math.max(0, metrics.reputation - 5);
    }
  }

  /**
   * Add email to suppression cache.
   */
  addSuppression(email: string, entry: SuppressionEntry): void {
    this.suppressionCache.set(email.toLowerCase(), entry);

    // Also add to each provider's suppression list
    for (const adapter of this.providers.values()) {
      (adapter as any).addToSuppressionList?.(email, entry);
    }
  }

  /**
   * Get aggregated metrics across all providers.
   */
  getMetrics(): ProviderMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics for specific provider.
   */
  getProviderMetrics(providerName: string): ProviderMetrics | undefined {
    return this.metrics.get(providerName);
  }

  /**
   * Update provider metrics (e.g., from external analytics).
   */
  updateMetrics(providerName: string, updates: Partial<ProviderMetrics>): void {
    const metrics = this.metrics.get(providerName);
    if (metrics) {
      Object.assign(metrics, updates);
    }
  }

  /**
   * Get current routing rules.
   */
  getRules(): EmailRouteRule[] {
    return this.rules;
  }

  /**
   * Remove routing rule by ID.
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all suppressions.
   */
  clearSuppressions(): void {
    this.suppressionCache.clear();

    for (const adapter of this.providers.values()) {
      (adapter as any).clearSuppressions?.();
    }
  }

  /**
   * Health status of entire system.
   */
  async getHealth(): Promise<{
    healthy: boolean;
    providersTotal: number;
    providersHealthy: number;
    metrics: ProviderMetrics[];
  }> {
    const metrics = this.getMetrics();
    const healthyCount = metrics.filter((m) =>
      this.isProviderHealthy(m.name)
    ).length;

    return {
      healthy: healthyCount > 0,
      providersTotal: this.providers.size,
      providersHealthy: healthyCount,
      metrics,
    };
  }
}
