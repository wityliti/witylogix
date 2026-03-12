/**
 * Multi-Gateway Payment Router
 *
 * Intelligently routes payments to optimal gateway based on:
 * - Payment method type (card, PayPal, bank transfer, etc.)
 * - Currency support
 * - Amount limits
 * - Geographic region
 * - Transaction fees
 * - Gateway health/availability
 */

import type { PaymentGatewayConfig } from './types.js';
import { PaymentGatewayBase } from './payment-gateway.js';
import { PayPalGateway } from './paypal-adapter.js';
import { SquareGateway } from './square-adapter.js';

// ─── GATEWAY METADATA ──────────────────────────────────────────────────────

export interface GatewayMetadata {
  gatewayCode: string;
  name: string;
  isEnabled: boolean;
  priority: number; // Lower = higher priority (1 is highest)
  supportedMethods: string[];
  supportedCurrencies: string[];
  minAmount: number; // In cents
  maxAmount: number; // In cents
  transactionFeePercent: number; // e.g., 2.9
  fixedFeeInCents: number; // e.g., 30 cents
  regions: string[]; // ['US', 'CA', 'GB', etc.]
  healthScore: number; // 0-100, 100 = healthy
  lastHealthCheckAt: Date;
  monthlyVolume: number; // Total processed amount in cents
  monthlyTransactionCount: number;
}

export interface GatewayRoutingParams {
  method: string; // 'card', 'paypal', 'bank_transfer', etc.
  currency: string; // 'USD', 'EUR', etc.
  amount: number; // In cents
  region?: string; // 'US', 'CA', 'GB', etc.
  customerId?: string;
  metadata?: Record<string, any>;
}

export interface RoutingDecision {
  primaryGateway: GatewayMetadata;
  secondaryGateway?: GatewayMetadata;
  tertiaryGateway?: GatewayMetadata;
  estimatedFee: number; // In cents
  reasoning: string;
}

// ─── MULTI-GATEWAY ROUTER ─────────────────────────────────────────────────

export class MultiGatewayRouter {
  private gateways: Map<string, PaymentGatewayBase> = new Map();
  private gatewayMetadata: Map<string, GatewayMetadata> = new Map();
  private preferredGateway: string = 'square'; // Default

  constructor(private logger: any = console) {}

  /**
   * Register a payment gateway
   */
  registerGateway(
    gateway: PaymentGatewayBase,
    metadata: GatewayMetadata,
  ): void {
    const code = metadata.gatewayCode;

    this.gateways.set(code, gateway);
    this.gatewayMetadata.set(code, metadata);

    this.logger.log('info', `Registered payment gateway: ${code}`, {
      priority: metadata.priority,
      supportedMethods: metadata.supportedMethods,
    });
  }

  /**
   * Set preferred/default gateway
   */
  setPreferredGateway(gatewayCode: string): void {
    if (!this.gateways.has(gatewayCode)) {
      throw new Error(`Gateway not found: ${gatewayCode}`);
    }
    this.preferredGateway = gatewayCode;
  }

  /**
   * Route payment to optimal gateway
   */
  routePayment(params: GatewayRoutingParams): RoutingDecision {
    const candidates = this.findCandidateGateways(params);

    if (candidates.length === 0) {
      throw new Error(
        `No suitable payment gateway found for method=${params.method}, ` +
        `currency=${params.currency}, amount=${params.amount}`,
      );
    }

    // Sort by priority and health
    candidates.sort((a, b) => {
      // First sort by priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by health score
      return b.healthScore - a.healthScore;
    });

    const primary = candidates[0];
    const secondary = candidates[1];
    const tertiary = candidates[2];

    const estimatedFee = this.calculateTransactionFee(params.amount, primary);

    const reasoning = this.generateRoutingReasoning(
      params,
      primary,
      secondary,
      tertiary,
    );

    return {
      primaryGateway: primary,
      secondaryGateway: secondary,
      tertiaryGateway: tertiary,
      estimatedFee,
      reasoning,
    };
  }

  /**
   * Find candidate gateways for payment
   */
  private findCandidateGateways(params: GatewayRoutingParams): GatewayMetadata[] {
    const candidates: GatewayMetadata[] = [];

    for (const [_code, metadata] of this.gatewayMetadata.entries()) {
      if (!metadata.isEnabled) {
        continue;
      }

      // Check method support
      if (!metadata.supportedMethods.includes(params.method)) {
        continue;
      }

      // Check currency support
      if (!metadata.supportedCurrencies.includes(params.currency)) {
        continue;
      }

      // Check amount limits
      if (params.amount < metadata.minAmount || params.amount > metadata.maxAmount) {
        continue;
      }

      // Check region support
      if (params.region && !metadata.regions.includes(params.region)) {
        continue;
      }

      // Check health score
      if (metadata.healthScore < 50) {
        // Gateway is unhealthy
        this.logger.log('warn', `Gateway health is low: ${metadata.name}`, {
          healthScore: metadata.healthScore,
        });
        continue;
      }

      candidates.push(metadata);
    }

    return candidates;
  }

  /**
   * Calculate transaction fee
   */
  private calculateTransactionFee(
    amount: number,
    gateway: GatewayMetadata,
  ): number {
    const percentageFee = Math.round(amount * (gateway.transactionFeePercent / 100));
    return percentageFee + gateway.fixedFeeInCents;
  }

  /**
   * Generate routing decision reasoning
   */
  private generateRoutingReasoning(
    params: GatewayRoutingParams,
    primary: GatewayMetadata,
    secondary?: GatewayMetadata,
    tertiary?: GatewayMetadata,
  ): string {
    const parts: string[] = [
      `Routed to ${primary.name} (priority: ${primary.priority})`,
    ];

    const primaryFee = this.calculateTransactionFee(params.amount, primary);
    const secondaryFee = secondary
      ? this.calculateTransactionFee(params.amount, secondary)
      : null;

    if (secondaryFee !== null && primaryFee < secondaryFee) {
      parts.push(
        `lower fee: $${(primaryFee / 100).toFixed(2)} vs ` +
        `$${(secondaryFee / 100).toFixed(2)}`,
      );
    }

    if (primary.healthScore < 100) {
      parts.push(`health: ${primary.healthScore}%`);
    }

    if (secondary) {
      parts.push(
        `fallback: ${secondary.name}`,
      );
    }

    if (tertiary) {
      parts.push(
        `tertiary: ${tertiary.name}`,
      );
    }

    return parts.join(', ');
  }

  /**
   * Update gateway health score
   */
  updateGatewayHealth(
    gatewayCode: string,
    healthScore: number,
  ): void {
    const metadata = this.gatewayMetadata.get(gatewayCode);
    if (metadata) {
      metadata.healthScore = Math.max(0, Math.min(100, healthScore));
      metadata.lastHealthCheckAt = new Date();

      this.logger.log('info', `Updated gateway health: ${gatewayCode}`, {
        healthScore: metadata.healthScore,
      });
    }
  }

  /**
   * Record successful transaction
   */
  recordTransaction(
    gatewayCode: string,
    amount: number,
  ): void {
    const metadata = this.gatewayMetadata.get(gatewayCode);
    if (metadata) {
      metadata.monthlyVolume += amount;
      metadata.monthlyTransactionCount += 1;

      // Slight health improvement on success
      if (metadata.healthScore < 100) {
        metadata.healthScore = Math.min(100, metadata.healthScore + 0.5);
      }
    }
  }

  /**
   * Record failed transaction
   */
  recordFailure(
    gatewayCode: string,
    reason?: string,
  ): void {
    const metadata = this.gatewayMetadata.get(gatewayCode);
    if (metadata) {
      // Degrade health score on failure
      metadata.healthScore = Math.max(0, metadata.healthScore - 5);

      this.logger.log('warn', `Gateway transaction failed: ${gatewayCode}`, {
        reason,
        healthScore: metadata.healthScore,
      });
    }
  }

  /**
   * Get gateway instance
   */
  getGateway(gatewayCode: string): PaymentGatewayBase | null {
    return this.gateways.get(gatewayCode) || null;
  }

  /**
   * Get all gateways
   */
  getAllGateways(): Array<[string, PaymentGatewayBase]> {
    return Array.from(this.gateways.entries());
  }

  /**
   * Get gateway metadata
   */
  getGatewayMetadata(gatewayCode: string): GatewayMetadata | null {
    return this.gatewayMetadata.get(gatewayCode) || null;
  }

  /**
   * Get all gateway metadata
   */
  getAllGatewayMetadata(): GatewayMetadata[] {
    return Array.from(this.gatewayMetadata.values()).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Compare fees across gateways
   */
  compareTransactionFees(amount: number): Array<{
    gatewayCode: string;
    name: string;
    fee: number;
    feePercent: number;
    netAmount: number;
  }> {
    const comparison = [];

    for (const [code, metadata] of this.gatewayMetadata.entries()) {
      if (!metadata.isEnabled) {
        continue;
      }

      const fee = this.calculateTransactionFee(amount, metadata);
      const netAmount = amount - fee;
      const feePercent = (fee / amount) * 100;

      comparison.push({
        gatewayCode: code,
        name: metadata.name,
        fee,
        feePercent,
        netAmount,
      });
    }

    return comparison.sort((a, b) => a.fee - b.fee);
  }

  /**
   * Check if method is supported
   */
  isMethodSupported(method: string): boolean {
    for (const metadata of this.gatewayMetadata.values()) {
      if (metadata.isEnabled && metadata.supportedMethods.includes(method)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get available payment methods
   */
  getAvailableMethods(): string[] {
    const methods = new Set<string>();

    for (const metadata of this.gatewayMetadata.values()) {
      if (metadata.isEnabled) {
        metadata.supportedMethods.forEach((m) => methods.add(m));
      }
    }

    return Array.from(methods);
  }

  /**
   * Get gateways supporting specific method
   */
  getGatewaysForMethod(method: string): GatewayMetadata[] {
    const gateways = [];

    for (const metadata of this.gatewayMetadata.values()) {
      if (metadata.isEnabled && metadata.supportedMethods.includes(method)) {
        gateways.push(metadata);
      }
    }

    return gateways.sort((a, b) => a.priority - b.priority);
  }
}
