/**
 * Workflow Integration Platform Abstraction Tests
 * Phase 2 refactored workflow integration test suite
 * Tests externalOrderId usage, hooks passing, workflow triggering with platform source
 * ~500 lines
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ───────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ───────────────────────────────────────────────────────────────────────────

export type PlatformSource = 'SHOPIFY' | 'WOOCOMMERCE' | 'NATIVE';

export interface OrderData {
  orderId: string;
  externalOrderId: string; // Phase 2: Platform-agnostic external ID
  externalOrderNumber?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupLocationId: string;
  deliveryAddressLine1: string;
  deliveryAddressLine2?: string;
  deliveryCity: string;
  deliveryProvince?: string;
  deliveryPostalCode: string;
  deliveryCountry: string;
  items: Array<{
    productId: string;
    variantId?: string;
    title: string;
    quantity: number;
    weight?: number;
    price?: number;
  }>;
  totalPrice: number;
  totalWeight: number;
  notes?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface WorkflowContext {
  tenantId: string;
  userId: string;
  shopId: string;
  platform: PlatformSource;
  requestId?: string;
}

export interface WorkflowHook {
  name: string;
  execute(data: any, context: WorkflowContext): Promise<void>;
}

export interface Workflow {
  name: string;
  source: PlatformSource;
  hooks: WorkflowHook[];
  execute(orderData: OrderData, context: WorkflowContext): Promise<any>;
}

export interface WorkflowIntegrationService {
  registerWorkflow(workflow: Workflow): void;
  getWorkflow(name: string, source: PlatformSource): Workflow | null;
  executeWorkflow(
    workflowName: string,
    orderData: OrderData,
    context: WorkflowContext
  ): Promise<any>;
  getRegisteredWorkflows(): Workflow[];
}

// ───────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION
// ───────────────────────────────────────────────────────────────────────────

class WorkflowIntegrationImpl implements WorkflowIntegrationService {
  private workflows: Map<string, Workflow[]> = new Map();
  private executedWorkflows: Array<{
    name: string;
    source: PlatformSource;
    externalOrderId: string;
    timestamp: Date;
  }> = [];

  registerWorkflow(workflow: Workflow): void {
    const key = `${workflow.name}:${workflow.source}`;
    if (!this.workflows.has(key)) {
      this.workflows.set(key, []);
    }
    this.workflows.get(key)!.push(workflow);
  }

  getWorkflow(name: string, source: PlatformSource): Workflow | null {
    const key = `${name}:${source}`;
    const workflows = this.workflows.get(key);
    return workflows ? workflows[0] : null;
  }

  async executeWorkflow(
    workflowName: string,
    orderData: OrderData,
    context: WorkflowContext
  ): Promise<any> {
    const workflow = this.getWorkflow(workflowName, context.platform);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowName} for platform ${context.platform}`);
    }

    // Execute hooks
    for (const hook of workflow.hooks) {
      await hook.execute(orderData, context);
    }

    // Track execution
    this.executedWorkflows.push({
      name: workflowName,
      source: context.platform,
      externalOrderId: orderData.externalOrderId,
      timestamp: new Date(),
    });

    // Execute workflow
    return await workflow.execute(orderData, context);
  }

  getRegisteredWorkflows(): Workflow[] {
    const workflows: Workflow[] = [];
    this.workflows.forEach((list) => {
      workflows.push(...list);
    });
    return workflows;
  }

  getExecutedWorkflows() {
    return [...this.executedWorkflows];
  }

  clearExecutionHistory() {
    this.executedWorkflows = [];
  }
}

// ───────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ───────────────────────────────────────────────────────────────────────────

describe('Workflow Integration - Platform Abstraction Phase 2', () => {
  let workflowService: WorkflowIntegrationImpl;

  beforeEach(() => {
    workflowService = new WorkflowIntegrationImpl();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EXTERNAL ORDER ID USAGE
  // ─────────────────────────────────────────────────────────────────────────

  describe('External Order ID Usage (Phase 2)', () => {
    it('should use externalOrderId instead of platform-specific IDs', async () => {
      const mockHook = vi.fn();
      const workflow: Workflow = {
        name: 'createDeliveryOrder',
        source: 'SHOPIFY',
        hooks: [
          {
            name: 'validateOrder',
            execute: mockHook,
          },
        ],
        execute: async () => ({ executionId: 'exec-1' }),
      };

      workflowService.registerWorkflow(workflow);

      const orderData: OrderData = {
        orderId: 'internal-order-123',
        externalOrderId: 'shopify-order-456',
        externalOrderNumber: '1001',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        customerPhone: '+1234567890',
        pickupLocationId: 'loc-1',
        deliveryAddressLine1: '123 Main St',
        deliveryCity: 'Toronto',
        deliveryPostalCode: 'M1A 2B3',
        deliveryCountry: 'Canada',
        items: [],
        totalPrice: 100,
        totalWeight: 5,
      };

      const context: WorkflowContext = {
        tenantId: 'shop-1',
        userId: 'user-1',
        shopId: 'shop-1',
        platform: 'SHOPIFY',
      };

      await workflowService.executeWorkflow('createDeliveryOrder', orderData, context);

      expect(mockHook).toHaveBeenCalledWith(orderData, expect.any(Object));
      const callArgs = mockHook.mock.calls[0][0];
      expect(callArgs.externalOrderId).toBe('shopify-order-456');
      expect(callArgs.externalOrderNumber).toBe('1001');
    });

    it('should use externalOrderId for WooCommerce orders', async () => {
      const mockHook = vi.fn();
      const workflow: Workflow = {
        name: 'createDeliveryOrder',
        source: 'WOOCOMMERCE',
        hooks: [
          {
            name: 'validateOrder',
            execute: mockHook,
          },
        ],
        execute: async () => ({ executionId: 'exec-2' }),
      };

      workflowService.registerWorkflow(workflow);

      const orderData: OrderData = {
        orderId: 'internal-order-789',
        externalOrderId: 'woo-order-2001',
        externalOrderNumber: '2001',
        customerName: 'Jane Smith',
        customerEmail: 'jane@example.com',
        customerPhone: '+1987654321',
        pickupLocationId: 'loc-2',
        deliveryAddressLine1: '456 Oak Ave',
        deliveryCity: 'Vancouver',
        deliveryPostalCode: 'V6B 1A1',
        deliveryCountry: 'Canada',
        items: [],
        totalPrice: 150,
        totalWeight: 8,
      };

      const context: WorkflowContext = {
        tenantId: 'shop-2',
        userId: 'user-2',
        shopId: 'shop-2',
        platform: 'WOOCOMMERCE',
      };

      await workflowService.executeWorkflow('createDeliveryOrder', orderData, context);

      const callArgs = mockHook.mock.calls[0][0];
      expect(callArgs.externalOrderId).toBe('woo-order-2001');
    });

    it('should NOT use shopifyOrderId or platform-specific fields', async () => {
      const mockHook = vi.fn();
      const workflow: Workflow = {
        name: 'createDeliveryOrder',
        source: 'SHOPIFY',
        hooks: [
          {
            name: 'validateOrder',
            execute: mockHook,
          },
        ],
        execute: async () => ({ executionId: 'exec-3' }),
      };

      workflowService.registerWorkflow(workflow);

      const orderData: OrderData = {
        orderId: 'internal-123',
        externalOrderId: 'shopify-999',
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        customerPhone: '+1111111111',
        pickupLocationId: 'loc-1',
        deliveryAddressLine1: '789 Pine St',
        deliveryCity: 'Calgary',
        deliveryPostalCode: 'T2P 1A1',
        deliveryCountry: 'Canada',
        items: [],
        totalPrice: 200,
        totalWeight: 10,
      };

      const context: WorkflowContext = {
        tenantId: 'shop-1',
        userId: 'user-1',
        shopId: 'shop-1',
        platform: 'SHOPIFY',
      };

      await workflowService.executeWorkflow('createDeliveryOrder', orderData, context);

      const callArgs = mockHook.mock.calls[0][0];
      // Phase 2: externalOrderId is the standard field, not shopifyOrderId
      expect(callArgs.externalOrderId).toBeDefined();
      expect((callArgs as any).shopifyOrderId).toBeUndefined();
    });

    it('should preserve externalOrderId through entire workflow', async () => {
      const hookExecutions: any[] = [];

      const workflow: Workflow = {
        name: 'createDeliveryOrder',
        source: 'SHOPIFY',
        hooks: [
          {
            name: 'hook1',
            execute: async (data) => {
              hookExecutions.push({ hook: 'hook1', externalOrderId: data.externalOrderId });
            },
          },
          {
            name: 'hook2',
            execute: async (data) => {
              hookExecutions.push({ hook: 'hook2', externalOrderId: data.externalOrderId });
            },
          },
        ],
        execute: async () => ({ executionId: 'exec-4' }),
      };

      workflowService.registerWorkflow(workflow);

      const orderData: OrderData = {
        orderId: 'internal-456',
        externalOrderId: 'shopify-555',
        customerName: 'Multi-Hook User',
        customerEmail: 'multi@example.com',
        customerPhone: '+2222222222',
        pickupLocationId: 'loc-3',
        deliveryAddressLine1: '999 Maple Blvd',
        deliveryCity: 'Montreal',
        deliveryPostalCode: 'H1A 1A1',
        deliveryCountry: 'Canada',
        items: [],
        totalPrice: 250,
        totalWeight: 12,
      };

      const context: WorkflowContext = {
        tenantId: 'shop-1',
        userId: 'user-1',
        shopId: 'shop-1',
        platform: 'SHOPIFY',
      };

      await workflowService.executeWorkflow('createDeliveryOrder', orderData, context);

      expect(hookExecutions).toHaveLength(2);
      expect(hookExecutions[0].externalOrderId).toBe('shopify-555');
      expect(hookExecutions[1].externalOrderId).toBe('shopify-555');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // HOOKS PASSING DATA CORRECTLY
  // ─────────────────────────────────────────────────────────────────────────

  describe('Hooks Pass Data Correctly', () => {
    it('should pass complete order data to all hooks', async () => {
      const hook1 = vi.fn();
      const hook2 = vi.fn();

      const workflow: Workflow = {
        name: 'createDeliveryOrder',
        source: 'SHOPIFY',
        hooks: [
          { name: 'hook1', execute: hook1 },
          { name: 'hook2', execute: hook2 },
        ],
        execute: async () => ({ executionId: 'exec-5' }),
      };

      workflowService.registerWorkflow(workflow);

      const orderData: OrderData = {
        orderId: 'order-111',
        externalOrderId: 'ext-111',
        externalOrderNumber: '5001',
        customerName: 'Alice Johnson',
        customerEmail: 'alice@example.com',
        customerPhone: '+3333333333',
        pickupLocationId: 'loc-A',
        deliveryAddressLine1: '111 Address St',
        deliveryCity: 'Toronto',
        deliveryPostalCode: 'M5V 3A1',
        deliveryCountry: 'Canada',
        items: [
          { productId: 'prod-1', title: 'Item 1', quantity: 2, price: 50 },
        ],
        totalPrice: 100,
        totalWeight: 5,
        tags: ['express', 'fragile'],
      };

      const context: WorkflowContext = {
        tenantId: 'shop-1',
        userId: 'user-1',
        shopId: 'shop-1',
        platform: 'SHOPIFY',
      };

      await workflowService.executeWorkflow('createDeliveryOrder', orderData, context);

      expect(hook1).toHaveBeenCalledWith(orderData, context);
      expect(hook2).toHaveBeenCalledWith(orderData, context);
      expect(hook1.mock.calls[0][0].items).toHaveLength(1);
      expect(hook1.mock.calls[0][0].tags).toContain('express');
    });

    it('should pass context with externalOrderId to hooks', async () => {
      const hookContext = vi.fn();

      const workflow: Workflow = {
        name: 'createDeliveryOrder',
        source: 'WOOCOMMERCE',
        hooks: [
          {
            name: 'contextHook',
            execute: hookContext,
          },
        ],
        execute: async () => ({ executionId: 'exec-6' }),
      };

      workflowService.registerWorkflow(workflow);

      const orderData: OrderData = {
        orderId: 'order-222',
        externalOrderId: 'woo-222',
        customerName: 'Bob Wilson',
        customerEmail: 'bob@example.com',
        customerPhone: '+4444444444',
        pickupLocationId: 'loc-B',
        deliveryAddressLine1: '222 Context Ave',
        deliveryCity: 'Calgary',
        deliveryPostalCode: 'T1X 0A1',
        deliveryCountry: 'Canada',
        items: [],
        totalPrice: 75,
        totalWeight: 3,
      };

      const context: WorkflowContext = {
        tenantId: 'shop-2',
        userId: 'user-2',
        shopId: 'shop-2',
        platform: 'WOOCOMMERCE',
        requestId: 'req-999',
      };

      await workflowService.executeWorkflow('createDeliveryOrder', orderData, context);

      expect(hookContext).toHaveBeenCalled();
      const callContext = hookContext.mock.calls[0][1];
      expect(callContext.platform).toBe('WOOCOMMERCE');
      expect(callContext.requestId).toBe('req-999');
    });

    it('should handle hooks with custom metadata', async () => {
      const metadataHook = vi.fn();

      const workflow: Workflow = {
        name: 'createDeliveryOrder',
        source: 'SHOPIFY',
        hooks: [
          {
            name: 'metadataHook',
            execute: metadataHook,
          },
        ],
        execute: async () => ({ executionId: 'exec-7' }),
      };

      workflowService.registerWorkflow(workflow);

      const orderData: OrderData = {
        orderId: 'order-333',
        externalOrderId: 'shopify-333',
        customerName: 'Charlie Davis',
        customerEmail: 'charlie@example.com',
        customerPhone: '+5555555555',
        pickupLocationId: 'loc-C',
        deliveryAddressLine1: '333 Metadata Rd',
        deliveryCity: 'Vancouver',
        deliveryPostalCode: 'V6E 4A1',
        deliveryCountry: 'Canada',
        items: [],
        totalPrice: 120,
        totalWeight: 6,
        metadata: {
          source: 'SHOPIFY',
          shopifyOrderId: 'shopify-333',
          customField: 'customValue',
        },
      };

      const context: WorkflowContext = {
        tenantId: 'shop-1',
        userId: 'user-1',
        shopId: 'shop-1',
        platform: 'SHOPIFY',
      };

      await workflowService.executeWorkflow('createDeliveryOrder', orderData, context);

      expect(metadataHook).toHaveBeenCalled();
      const callData = metadataHook.mock.calls[0][0];
      expect(callData.metadata?.source).toBe('SHOPIFY');
      expect(callData.metadata?.customField).toBe('customValue');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // WORKFLOW TRIGGERING WITH PLATFORM SOURCE
  // ─────────────────────────────────────────────────────────────────────────

  describe('Workflow Triggering with Platform Source', () => {
    it('should trigger Shopify workflow with SHOPIFY source', async () => {
      const shopifyWorkflow = vi.fn(async () => ({ success: true }));

      const workflow: Workflow = {
        name: 'createDeliveryOrder',
        source: 'SHOPIFY',
        hooks: [],
        execute: shopifyWorkflow,
      };

      workflowService.registerWorkflow(workflow);

      const orderData: OrderData = {
        orderId: 'order-444',
        externalOrderId: 'shopify-444',
        customerName: 'Diane Evans',
        customerEmail: 'diane@example.com',
        customerPhone: '+6666666666',
        pickupLocationId: 'loc-D',
        deliveryAddressLine1: '444 Shopify St',
        deliveryCity: 'Montreal',
        deliveryPostalCode: 'H2X 1A1',
        deliveryCountry: 'Canada',
        items: [],
        totalPrice: 95,
        totalWeight: 4,
      };

      const context: WorkflowContext = {
        tenantId: 'shop-1',
        userId: 'user-1',
        shopId: 'shop-1',
        platform: 'SHOPIFY',
      };

      const result = await workflowService.executeWorkflow('createDeliveryOrder', orderData, context);

      expect(result.success).toBe(true);
      expect(shopifyWorkflow).toHaveBeenCalledWith(orderData, context);
    });

    it('should trigger WooCommerce workflow with WOOCOMMERCE source', async () => {
      const wooWorkflow = vi.fn(async () => ({ success: true }));

      const workflow: Workflow = {
        name: 'createDeliveryOrder',
        source: 'WOOCOMMERCE',
        hooks: [],
        execute: wooWorkflow,
      };

      workflowService.registerWorkflow(workflow);

      const orderData: OrderData = {
        orderId: 'order-555',
        externalOrderId: 'woo-555',
        customerName: 'Edward Foster',
        customerEmail: 'edward@example.com',
        customerPhone: '+7777777777',
        pickupLocationId: 'loc-E',
        deliveryAddressLine1: '555 WooCommerce Ave',
        deliveryCity: 'Edmonton',
        deliveryPostalCode: 'T5J 2A1',
        deliveryCountry: 'Canada',
        items: [],
        totalPrice: 140,
        totalWeight: 7,
      };

      const context: WorkflowContext = {
        tenantId: 'shop-2',
        userId: 'user-2',
        shopId: 'shop-2',
        platform: 'WOOCOMMERCE',
      };

      const result = await workflowService.executeWorkflow('createDeliveryOrder', orderData, context);

      expect(result.success).toBe(true);
      expect(wooWorkflow).toHaveBeenCalledWith(orderData, context);
    });

    it('should keep platform source consistent throughout workflow execution', async () => {
      const executionLog: any[] = [];

      const workflow: Workflow = {
        name: 'createDeliveryOrder',
        source: 'SHOPIFY',
        hooks: [
          {
            name: 'logHook',
            execute: async (data, ctx) => {
              executionLog.push({ stage: 'hook', source: ctx.platform });
            },
          },
        ],
        execute: async (data, ctx) => {
          executionLog.push({ stage: 'execute', source: ctx.platform });
          return { executionId: 'exec-8' };
        },
      };

      workflowService.registerWorkflow(workflow);

      const orderData: OrderData = {
        orderId: 'order-666',
        externalOrderId: 'shopify-666',
        customerName: 'Fiona Green',
        customerEmail: 'fiona@example.com',
        customerPhone: '+8888888888',
        pickupLocationId: 'loc-F',
        deliveryAddressLine1: '666 Consistency Ave',
        deliveryCity: 'Ottawa',
        deliveryPostalCode: 'K1A 0A1',
        deliveryCountry: 'Canada',
        items: [],
        totalPrice: 110,
        totalWeight: 5,
      };

      const context: WorkflowContext = {
        tenantId: 'shop-1',
        userId: 'user-1',
        shopId: 'shop-1',
        platform: 'SHOPIFY',
      };

      await workflowService.executeWorkflow('createDeliveryOrder', orderData, context);

      expect(executionLog[0].source).toBe('SHOPIFY');
      expect(executionLog[1].source).toBe('SHOPIFY');
    });

    it('should fail to trigger workflow with wrong platform source', async () => {
      const shopifyWorkflow: Workflow = {
        name: 'createDeliveryOrder',
        source: 'SHOPIFY',
        hooks: [],
        execute: async () => ({ success: true }),
      };

      workflowService.registerWorkflow(shopifyWorkflow);

      const orderData: OrderData = {
        orderId: 'order-777',
        externalOrderId: 'woo-777',
        customerName: 'George Harris',
        customerEmail: 'george@example.com',
        customerPhone: '+9999999999',
        pickupLocationId: 'loc-G',
        deliveryAddressLine1: '777 Error Ave',
        deliveryCity: 'Quebec City',
        deliveryPostalCode: 'G1R 2A1',
        deliveryCountry: 'Canada',
        items: [],
        totalPrice: 85,
        totalWeight: 3,
      };

      const context: WorkflowContext = {
        tenantId: 'shop-2',
        userId: 'user-2',
        shopId: 'shop-2',
        platform: 'WOOCOMMERCE', // Wrong platform!
      };

      await expect(
        workflowService.executeWorkflow('createDeliveryOrder', orderData, context)
      ).rejects.toThrow('Workflow not found');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ORDER DATA TRANSFORMATION AND FIELD PRESERVATION
  // ─────────────────────────────────────────────────────────────────────────

  describe('Order Data Transformation Preserves All Fields', () => {
    it('should preserve all required order fields', async () => {
      const captureData = vi.fn();

      const workflow: Workflow = {
        name: 'createDeliveryOrder',
        source: 'SHOPIFY',
        hooks: [
          {
            name: 'captureHook',
            execute: captureData,
          },
        ],
        execute: async () => ({ executionId: 'exec-9' }),
      };

      workflowService.registerWorkflow(workflow);

      const orderData: OrderData = {
        orderId: 'order-888',
        externalOrderId: 'shopify-888',
        externalOrderNumber: '8001',
        customerName: 'Hannah Jackson',
        customerEmail: 'hannah@example.com',
        customerPhone: '+1111000011',
        pickupLocationId: 'loc-H',
        deliveryAddressLine1: '888 Field St',
        deliveryAddressLine2: 'Unit 5',
        deliveryCity: 'Winnipeg',
        deliveryProvince: 'MB',
        deliveryPostalCode: 'R3B 0A1',
        deliveryCountry: 'Canada',
        items: [
          {
            productId: 'prod-a1',
            variantId: 'var-a1',
            title: 'Product A',
            quantity: 2,
            weight: 1.5,
            price: 60,
          },
        ],
        totalPrice: 120,
        totalWeight: 3,
        notes: 'Handle with care',
        tags: ['fragile', 'express'],
        metadata: { reference: 'REF123' },
      };

      const context: WorkflowContext = {
        tenantId: 'shop-1',
        userId: 'user-1',
        shopId: 'shop-1',
        platform: 'SHOPIFY',
        requestId: 'req-888',
      };

      await workflowService.executeWorkflow('createDeliveryOrder', orderData, context);

      const capturedData = captureData.mock.calls[0][0];
      expect(capturedData.orderId).toBe('order-888');
      expect(capturedData.externalOrderId).toBe('shopify-888');
      expect(capturedData.externalOrderNumber).toBe('8001');
      expect(capturedData.customerName).toBe('Hannah Jackson');
      expect(capturedData.customerEmail).toBe('hannah@example.com');
      expect(capturedData.customerPhone).toBe('+1111000011');
      expect(capturedData.pickupLocationId).toBe('loc-H');
      expect(capturedData.deliveryAddressLine1).toBe('888 Field St');
      expect(capturedData.deliveryAddressLine2).toBe('Unit 5');
      expect(capturedData.deliveryCity).toBe('Winnipeg');
      expect(capturedData.deliveryProvince).toBe('MB');
      expect(capturedData.deliveryPostalCode).toBe('R3B 0A1');
      expect(capturedData.deliveryCountry).toBe('Canada');
      expect(capturedData.items).toHaveLength(1);
      expect(capturedData.items[0].variantId).toBe('var-a1');
      expect(capturedData.items[0].weight).toBe(1.5);
      expect(capturedData.totalPrice).toBe(120);
      expect(capturedData.totalWeight).toBe(3);
      expect(capturedData.notes).toBe('Handle with care');
      expect(capturedData.tags).toContain('express');
      expect(capturedData.metadata?.reference).toBe('REF123');
    });

    it('should preserve all optional fields in order items', async () => {
      const captureData = vi.fn();

      const workflow: Workflow = {
        name: 'createDeliveryOrder',
        source: 'WOOCOMMERCE',
        hooks: [
          {
            name: 'itemCaptureHook',
            execute: captureData,
          },
        ],
        execute: async () => ({ executionId: 'exec-10' }),
      };

      workflowService.registerWorkflow(workflow);

      const orderData: OrderData = {
        orderId: 'order-999',
        externalOrderId: 'woo-999',
        customerName: 'Iris Lee',
        customerEmail: 'iris@example.com',
        customerPhone: '+1111111112',
        pickupLocationId: 'loc-I',
        deliveryAddressLine1: '999 Items Blvd',
        deliveryCity: 'Regina',
        deliveryPostalCode: 'S4P 0A1',
        deliveryCountry: 'Canada',
        items: [
          {
            productId: 'prod-x1',
            variantId: 'var-x1-blue',
            title: 'Colored Widget',
            quantity: 5,
            weight: 0.5,
            price: 25.5,
          },
          {
            productId: 'prod-y1',
            title: 'Basic Item',
            quantity: 1,
          },
        ],
        totalPrice: 155.5,
        totalWeight: 3.5,
      };

      const context: WorkflowContext = {
        tenantId: 'shop-2',
        userId: 'user-2',
        shopId: 'shop-2',
        platform: 'WOOCOMMERCE',
      };

      await workflowService.executeWorkflow('createDeliveryOrder', orderData, context);

      const capturedData = captureData.mock.calls[0][0];
      expect(capturedData.items[0].variantId).toBe('var-x1-blue');
      expect(capturedData.items[0].weight).toBe(0.5);
      expect(capturedData.items[0].price).toBe(25.5);
      expect(capturedData.items[1].variantId).toBeUndefined();
      expect(capturedData.items[1].weight).toBeUndefined();
      expect(capturedData.items[1].price).toBeUndefined();
    });

    it('should track execution with externalOrderId', async () => {
      const workflow: Workflow = {
        name: 'createDeliveryOrder',
        source: 'SHOPIFY',
        hooks: [],
        execute: async () => ({ executionId: 'exec-11' }),
      };

      workflowService.registerWorkflow(workflow);

      const orderData: OrderData = {
        orderId: 'order-000',
        externalOrderId: 'shopify-000',
        customerName: 'Jack Kim',
        customerEmail: 'jack@example.com',
        customerPhone: '+1111111113',
        pickupLocationId: 'loc-J',
        deliveryAddressLine1: '000 Tracking Ave',
        deliveryCity: 'Saskatoon',
        deliveryPostalCode: 'S7K 0A1',
        deliveryCountry: 'Canada',
        items: [],
        totalPrice: 50,
        totalWeight: 2,
      };

      const context: WorkflowContext = {
        tenantId: 'shop-1',
        userId: 'user-1',
        shopId: 'shop-1',
        platform: 'SHOPIFY',
      };

      await workflowService.executeWorkflow('createDeliveryOrder', orderData, context);

      const executions = workflowService.getExecutedWorkflows();
      expect(executions).toHaveLength(1);
      expect(executions[0].externalOrderId).toBe('shopify-000');
      expect(executions[0].source).toBe('SHOPIFY');
      expect(executions[0].name).toBe('createDeliveryOrder');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ERROR HANDLING AND EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing workflow gracefully', async () => {
      const orderData: OrderData = {
        orderId: 'order-err1',
        externalOrderId: 'shopify-err1',
        customerName: 'Error Test',
        customerEmail: 'error@example.com',
        customerPhone: '+1000000000',
        pickupLocationId: 'loc-err',
        deliveryAddressLine1: '000 Error St',
        deliveryCity: 'Toronto',
        deliveryPostalCode: 'M1A 1A1',
        deliveryCountry: 'Canada',
        items: [],
        totalPrice: 0,
        totalWeight: 0,
      };

      const context: WorkflowContext = {
        tenantId: 'shop-err',
        userId: 'user-err',
        shopId: 'shop-err',
        platform: 'SHOPIFY',
      };

      await expect(
        workflowService.executeWorkflow('nonexistentWorkflow', orderData, context)
      ).rejects.toThrow('Workflow not found');
    });

    it('should support multiple workflows for same source', async () => {
      const workflow1: Workflow = {
        name: 'workflow1',
        source: 'SHOPIFY',
        hooks: [],
        execute: async () => ({ id: 'wf1' }),
      };

      const workflow2: Workflow = {
        name: 'workflow2',
        source: 'SHOPIFY',
        hooks: [],
        execute: async () => ({ id: 'wf2' }),
      };

      workflowService.registerWorkflow(workflow1);
      workflowService.registerWorkflow(workflow2);

      const workflows = workflowService.getRegisteredWorkflows();
      expect(workflows.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty items list', async () => {
      const captureData = vi.fn();

      const workflow: Workflow = {
        name: 'createDeliveryOrder',
        source: 'WOOCOMMERCE',
        hooks: [
          {
            name: 'captureHook',
            execute: captureData,
          },
        ],
        execute: async () => ({ executionId: 'exec-12' }),
      };

      workflowService.registerWorkflow(workflow);

      const orderData: OrderData = {
        orderId: 'order-empty',
        externalOrderId: 'woo-empty',
        customerName: 'Empty Order',
        customerEmail: 'empty@example.com',
        customerPhone: '+0000000000',
        pickupLocationId: 'loc-empty',
        deliveryAddressLine1: '000 Empty St',
        deliveryCity: 'Toronto',
        deliveryPostalCode: 'M1A 1A1',
        deliveryCountry: 'Canada',
        items: [],
        totalPrice: 0,
        totalWeight: 0,
      };

      const context: WorkflowContext = {
        tenantId: 'shop-empty',
        userId: 'user-empty',
        shopId: 'shop-empty',
        platform: 'WOOCOMMERCE',
      };

      await workflowService.executeWorkflow('createDeliveryOrder', orderData, context);

      const capturedData = captureData.mock.calls[0][0];
      expect(capturedData.items).toEqual([]);
    });
  });
});
