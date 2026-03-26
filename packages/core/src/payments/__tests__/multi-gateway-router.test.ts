/**
 * Multi-Gateway Router Tests
 *
 * Tests payment routing logic:
 * - Gateway selection based on payment method, currency, amount
 * - Fallback chain setup
 * - Fee comparison
 * - Health score management
 * - Gateway availability
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MultiGatewayRouter,
  type GatewayMetadata,
  type GatewayRoutingParams,
} from '../multi-gateway-router.js';
import type { PaymentGatewayBase } from '../payment-gateway.js';

// Mock gateway implementation
class MockGateway implements PaymentGatewayBase {
  name: string = 'Mock Gateway';
  code: string = 'mock';

  async createPaymentIntent() {
    throw new Error('Not implemented');
  }

  async capturePayment() {
    throw new Error('Not implemented');
  }

  async refundPayment() {
    throw new Error('Not implemented');
  }

  async verifyWebhookSignature() {
    throw new Error('Not implemented');
  }

  async parseWebhookPayload() {
    throw new Error('Not implemented');
  }

  async getPaymentStatus() {
    throw new Error('Not implemented');
  }
}

describe('MultiGatewayRouter', () => {
  let router: MultiGatewayRouter;
  let mockLogger = { log: () => {} };

  beforeEach(() => {
    router = new MultiGatewayRouter(mockLogger);
  });

  describe('Gateway Registration', () => {
    it('should register payment gateway', () => {
      const gateway = new MockGateway();
      const metadata: GatewayMetadata = {
        gatewayCode: 'square',
        name: 'Square',
        isEnabled: true,
        priority: 1,
        supportedMethods: ['card'],
        supportedCurrencies: ['USD'],
        minAmount: 1,
        maxAmount: 999999999,
        transactionFeePercent: 2.9,
        fixedFeeInCents: 0,
        regions: ['US', 'CA'],
        healthScore: 100,
        lastHealthCheckAt: new Date(),
        monthlyVolume: 0,
        monthlyTransactionCount: 0,
      };

      router.registerGateway(gateway, metadata);

      expect(router.getGateway('square')).toBe(gateway);
      expect(router.getGatewayMetadata('square')).toEqual(metadata);
    });

    it('should retrieve registered gateways', () => {
      const gateway1 = new MockGateway();
      const gateway2 = new MockGateway();

      const metadata1: GatewayMetadata = {
        gatewayCode: 'square',
        name: 'Square',
        isEnabled: true,
        priority: 1,
        supportedMethods: ['card'],
        supportedCurrencies: ['USD'],
        minAmount: 1,
        maxAmount: 999999999,
        transactionFeePercent: 2.9,
        fixedFeeInCents: 0,
        regions: ['US'],
        healthScore: 100,
        lastHealthCheckAt: new Date(),
        monthlyVolume: 0,
        monthlyTransactionCount: 0,
      };

      const metadata2: GatewayMetadata = {
        gatewayCode: 'paypal',
        name: 'PayPal',
        isEnabled: true,
        priority: 2,
        supportedMethods: ['paypal'],
        supportedCurrencies: ['USD', 'EUR'],
        minAmount: 50,
        maxAmount: 999999999,
        transactionFeePercent: 3.5,
        fixedFeeInCents: 30,
        regions: ['US', 'EU'],
        healthScore: 100,
        lastHealthCheckAt: new Date(),
        monthlyVolume: 0,
        monthlyTransactionCount: 0,
      };

      router.registerGateway(gateway1, metadata1);
      router.registerGateway(gateway2, metadata2);

      const all = router.getAllGateways();
      expect(all).toHaveLength(2);

      const metadata = router.getAllGatewayMetadata();
      expect(metadata).toHaveLength(2);
    });
  });

  describe('Payment Routing', () => {
    beforeEach(() => {
      const squareGateway = new MockGateway();
      const paypalGateway = new MockGateway();

      const squareMetadata: GatewayMetadata = {
        gatewayCode: 'square',
        name: 'Square',
        isEnabled: true,
        priority: 1,
        supportedMethods: ['card', 'apple_pay'],
        supportedCurrencies: ['USD', 'CAD'],
        minAmount: 1,
        maxAmount: 999999999,
        transactionFeePercent: 2.6,
        fixedFeeInCents: 0,
        regions: ['US', 'CA'],
        healthScore: 100,
        lastHealthCheckAt: new Date(),
        monthlyVolume: 0,
        monthlyTransactionCount: 0,
      };

      const paypalMetadata: GatewayMetadata = {
        gatewayCode: 'paypal',
        name: 'PayPal',
        isEnabled: true,
        priority: 2,
        supportedMethods: ['paypal', 'card'],
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        minAmount: 50,
        maxAmount: 999999999,
        transactionFeePercent: 2.9,
        fixedFeeInCents: 30,
        regions: ['US', 'EU', 'GB'],
        healthScore: 100,
        lastHealthCheckAt: new Date(),
        monthlyVolume: 0,
        monthlyTransactionCount: 0,
      };

      router.registerGateway(squareGateway, squareMetadata);
      router.registerGateway(paypalGateway, paypalMetadata);
    });

    it('should route to primary gateway', () => {
      const routing = router.routePayment({
        method: 'card',
        currency: 'USD',
        amount: 5000,
        region: 'US',
      } as GatewayRoutingParams);

      expect(routing.primaryGateway.gatewayCode).toBe('square');
      expect(routing.primaryGateway.priority).toBe(1);
    });

    it('should select fallback gateway', () => {
      const routing = router.routePayment({
        method: 'paypal',
        currency: 'USD',
        amount: 5000,
        region: 'US',
      } as GatewayRoutingParams);

      expect(routing.primaryGateway.gatewayCode).toBe('paypal');
      expect(routing.secondaryGateway?.gatewayCode).toBe('square');
    });

    it('should throw error when no suitable gateway found', () => {
      expect(() => {
        router.routePayment({
          method: 'bank_transfer',
          currency: 'USD',
          amount: 5000,
        } as GatewayRoutingParams);
      }).toThrow('No suitable payment gateway found');
    });

    it('should validate currency support', () => {
      expect(() => {
        router.routePayment({
          method: 'card',
          currency: 'JPY',
          amount: 5000,
        } as GatewayRoutingParams);
      }).toThrow('No suitable payment gateway found');
    });

    it('should validate amount limits', () => {
      expect(() => {
        router.routePayment({
          method: 'paypal',
          currency: 'USD',
          amount: 25, // Below PayPal minimum of 50
        } as GatewayRoutingParams);
      }).toThrow('No suitable payment gateway found');
    });

    it('should respect region constraints', () => {
      expect(() => {
        router.routePayment({
          method: 'card',
          currency: 'USD',
          amount: 5000,
          region: 'AU', // Square not available in AU
        } as GatewayRoutingParams);
      }).toThrow('No suitable payment gateway found');
    });
  });

  describe('Fee Calculation', () => {
    beforeEach(() => {
      const gateway = new MockGateway();
      const metadata: GatewayMetadata = {
        gatewayCode: 'square',
        name: 'Square',
        isEnabled: true,
        priority: 1,
        supportedMethods: ['card'],
        supportedCurrencies: ['USD'],
        minAmount: 1,
        maxAmount: 999999999,
        transactionFeePercent: 2.6,
        fixedFeeInCents: 10,
        regions: ['US'],
        healthScore: 100,
        lastHealthCheckAt: new Date(),
        monthlyVolume: 0,
        monthlyTransactionCount: 0,
      };

      router.registerGateway(gateway, metadata);
    });

    it('should calculate transaction fee', () => {
      const routing = router.routePayment({
        method: 'card',
        currency: 'USD',
        amount: 10000, // $100.00
      } as GatewayRoutingParams);

      // 2.6% of 10000 cents = 260 cents + 10 cents fixed = 270 cents
      expect(routing.estimatedFee).toBe(270);
    });

    it('should compare fees across gateways', () => {
      const comparison = router.compareTransactionFees(10000);

      expect(comparison).toHaveLength(1);
      expect(comparison[0]).toMatchObject({
        gatewayCode: 'square',
        fee: expect.any(Number),
        feePercent: expect.any(Number),
        netAmount: expect.any(Number),
      });
    });

    it('should calculate net amount after fees', () => {
      const comparison = router.compareTransactionFees(10000);

      const fee = comparison[0].fee;
      const net = comparison[0].netAmount;

      expect(net).toBe(10000 - fee);
    });
  });

  describe('Health Score Management', () => {
    beforeEach(() => {
      const gateway = new MockGateway();
      const metadata: GatewayMetadata = {
        gatewayCode: 'square',
        name: 'Square',
        isEnabled: true,
        priority: 1,
        supportedMethods: ['card'],
        supportedCurrencies: ['USD'],
        minAmount: 1,
        maxAmount: 999999999,
        transactionFeePercent: 2.6,
        fixedFeeInCents: 0,
        regions: ['US'],
        healthScore: 100,
        lastHealthCheckAt: new Date(),
        monthlyVolume: 0,
        monthlyTransactionCount: 0,
      };

      router.registerGateway(gateway, metadata);
    });

    it('should update gateway health score', () => {
      router.updateGatewayHealth('square', 85);

      expect(router.getGatewayMetadata('square')?.healthScore).toBe(85);
    });

    it('should clamp health score between 0-100', () => {
      router.updateGatewayHealth('square', 150);
      expect(router.getGatewayMetadata('square')?.healthScore).toBe(100);

      router.updateGatewayHealth('square', -50);
      expect(router.getGatewayMetadata('square')?.healthScore).toBe(0);
    });

    it('should degrade health on transaction failure', () => {
      const initial = router.getGatewayMetadata('square')?.healthScore || 100;

      router.recordFailure('square', 'Network timeout');

      const after = router.getGatewayMetadata('square')?.healthScore || 0;
      expect(after).toBeLessThan(initial);
    });

    it('should improve health on successful transaction', () => {
      router.updateGatewayHealth('square', 80);

      router.recordTransaction('square', 5000);

      const after = router.getGatewayMetadata('square')?.healthScore || 0;
      expect(after).toBeGreaterThan(80);
    });
  });

  describe('Gateway Availability', () => {
    beforeEach(() => {
      const gateway1 = new MockGateway();
      const gateway2 = new MockGateway();

      const metadata1: GatewayMetadata = {
        gatewayCode: 'square',
        name: 'Square',
        isEnabled: false,
        priority: 1,
        supportedMethods: ['card'],
        supportedCurrencies: ['USD'],
        minAmount: 1,
        maxAmount: 999999999,
        transactionFeePercent: 2.6,
        fixedFeeInCents: 0,
        regions: ['US'],
        healthScore: 100,
        lastHealthCheckAt: new Date(),
        monthlyVolume: 0,
        monthlyTransactionCount: 0,
      };

      const metadata2: GatewayMetadata = {
        gatewayCode: 'paypal',
        name: 'PayPal',
        isEnabled: true,
        priority: 2,
        supportedMethods: ['paypal'],
        supportedCurrencies: ['USD'],
        minAmount: 50,
        maxAmount: 999999999,
        transactionFeePercent: 2.9,
        fixedFeeInCents: 30,
        regions: ['US'],
        healthScore: 100,
        lastHealthCheckAt: new Date(),
        monthlyVolume: 0,
        monthlyTransactionCount: 0,
      };

      router.registerGateway(gateway1, metadata1);
      router.registerGateway(gateway2, metadata2);
    });

    it('should skip disabled gateways', () => {
      const routing = router.routePayment({
        method: 'paypal',
        currency: 'USD',
        amount: 5000,
      } as GatewayRoutingParams);

      expect(routing.primaryGateway.gatewayCode).toBe('paypal');
    });

    it('should check method availability', () => {
      expect(router.isMethodSupported('card')).toBe(false); // Square disabled
      expect(router.isMethodSupported('paypal')).toBe(true);
    });

    it('should get available methods', () => {
      const methods = router.getAvailableMethods();
      expect(methods).toContain('paypal');
      expect(methods).not.toContain('card'); // Square disabled
    });
  });

  describe('Payment Method Management', () => {
    beforeEach(() => {
      const squareGateway = new MockGateway();
      const paypalGateway = new MockGateway();

      const squareMetadata: GatewayMetadata = {
        gatewayCode: 'square',
        name: 'Square',
        isEnabled: true,
        priority: 1,
        supportedMethods: ['card', 'apple_pay', 'google_pay'],
        supportedCurrencies: ['USD'],
        minAmount: 1,
        maxAmount: 999999999,
        transactionFeePercent: 2.6,
        fixedFeeInCents: 0,
        regions: ['US'],
        healthScore: 100,
        lastHealthCheckAt: new Date(),
        monthlyVolume: 0,
        monthlyTransactionCount: 0,
      };

      const paypalMetadata: GatewayMetadata = {
        gatewayCode: 'paypal',
        name: 'PayPal',
        isEnabled: true,
        priority: 2,
        supportedMethods: ['paypal'],
        supportedCurrencies: ['USD'],
        minAmount: 50,
        maxAmount: 999999999,
        transactionFeePercent: 2.9,
        fixedFeeInCents: 30,
        regions: ['US'],
        healthScore: 100,
        lastHealthCheckAt: new Date(),
        monthlyVolume: 0,
        monthlyTransactionCount: 0,
      };

      router.registerGateway(squareGateway, squareMetadata);
      router.registerGateway(paypalGateway, paypalMetadata);
    });

    it('should get gateways supporting specific method', () => {
      const cardGateways = router.getGatewaysForMethod('card');

      expect(cardGateways).toHaveLength(1);
      expect(cardGateways[0].gatewayCode).toBe('square');
    });

    it('should return gateways in priority order', () => {
      const allGateways = router.getGatewaysForMethod('paypal');

      expect(allGateways[0].gatewayCode).toBe('paypal');
      expect(allGateways[0].priority).toBe(2);
    });
  });

  describe('Transaction Recording', () => {
    beforeEach(() => {
      const gateway = new MockGateway();
      const metadata: GatewayMetadata = {
        gatewayCode: 'square',
        name: 'Square',
        isEnabled: true,
        priority: 1,
        supportedMethods: ['card'],
        supportedCurrencies: ['USD'],
        minAmount: 1,
        maxAmount: 999999999,
        transactionFeePercent: 2.6,
        fixedFeeInCents: 0,
        regions: ['US'],
        healthScore: 100,
        lastHealthCheckAt: new Date(),
        monthlyVolume: 0,
        monthlyTransactionCount: 0,
      };

      router.registerGateway(gateway, metadata);
    });

    it('should record successful transaction', () => {
      router.recordTransaction('square', 5000);

      const metadata = router.getGatewayMetadata('square');
      expect(metadata?.monthlyVolume).toBe(5000);
      expect(metadata?.monthlyTransactionCount).toBe(1);
    });

    it('should accumulate transaction volume', () => {
      router.recordTransaction('square', 5000);
      router.recordTransaction('square', 3000);

      const metadata = router.getGatewayMetadata('square');
      expect(metadata?.monthlyVolume).toBe(8000);
      expect(metadata?.monthlyTransactionCount).toBe(2);
    });
  });
});
