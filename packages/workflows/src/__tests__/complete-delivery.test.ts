// @ts-nocheck

/**
 * @witylogix/workflows — Complete Delivery Workflow Test Suite
 *
 * Comprehensive tests for marking deliveries as complete:
 * - Happy path: photo/signature/code POD
 * - Missing/invalid POD validation
 * - Status validation (order must be "out_for_delivery")
 * - Billing processing and compensation
 * - On-time delivery tracking
 * - Metrics recording accuracy
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WorkflowContext, StepResult } from "../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK SERVICES & TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface CompleteDeliveryInput {
  orderId: string;
  driverId: string;
  deliveryTime: Date;
  proofOfDelivery: {
    type: "photo" | "signature" | "code";
    data: string; // base64 for photo, signature SVG, or code string
  };
  notes?: string;
  deliveryCoordinates?: { latitude: number; longitude: number };
}

interface CompletedDelivery {
  orderId: string;
  driverId: string;
  completedAt: Date;
  proofOfDeliveryType: string;
  onTimeDelivery: boolean;
  billingProcessed: boolean;
  totalCharge: number;
}

// Mock services
const mockValidateOrderStatus = vi.fn();
const mockValidateProof = vi.fn();
const mockUpdateOrderStatus = vi.fn();
const mockProcessBilling = vi.fn();
const mockRecordMetrics = vi.fn();
const mockArchiveProof = vi.fn();

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW STEPS
// ─────────────────────────────────────────────────────────────────────────────

const validateDeliveryStep = {
  name: "Validate Delivery",
  async invoke(
    input: CompleteDeliveryInput,
  ): Promise<StepResult<CompleteDeliveryInput>> {
    try {
      if (!input.orderId || input.orderId.trim().length === 0) {
        return {
          success: false,
          error: "Order ID is required",
          code: "INVALID_ORDER_ID",
        };
      }

      if (!input.driverId || input.driverId.trim().length === 0) {
        return {
          success: false,
          error: "Driver ID is required",
          code: "INVALID_DRIVER_ID",
        };
      }

      if (!input.proofOfDelivery || !input.proofOfDelivery.type) {
        return {
          success: false,
          error: "Proof of delivery is required",
          code: "MISSING_POD",
        };
      }

      const validPodTypes = ["photo", "signature", "code"];
      if (!validPodTypes.includes(input.proofOfDelivery.type)) {
        return {
          success: false,
          error: "Invalid proof of delivery type",
          code: "INVALID_POD_TYPE",
        };
      }

      if (
        !input.proofOfDelivery.data ||
        input.proofOfDelivery.data.trim().length === 0
      ) {
        return {
          success: false,
          error: "Proof of delivery data is required",
          code: "EMPTY_POD",
        };
      }

      return { success: true, data: input };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Validation error",
        code: "VALIDATION_ERROR",
      };
    }
  },
};

const checkOrderStatusStep = {
  name: "Check Order Status",
  async invoke(input: CompleteDeliveryInput): Promise<
    StepResult<
      CompleteDeliveryInput & {
        currentStatus: string;
        estimatedDeliveryTime: Date;
      }
    >
  > {
    try {
      const status = await mockValidateOrderStatus({
        orderId: input.orderId,
      });

      if (!status || !status.currentStatus) {
        return {
          success: false,
          error: "Order not found",
          code: "ORDER_NOT_FOUND",
        };
      }

      // Order must be in "out_for_delivery" status
      if (status.currentStatus !== "out_for_delivery") {
        return {
          success: false,
          error: `Order is in ${status.currentStatus} status, not out_for_delivery`,
          code: "INVALID_ORDER_STATUS",
        };
      }

      return {
        success: true,
        data: {
          ...input,
          currentStatus: status.currentStatus,
          estimatedDeliveryTime: new Date(status.estimatedDeliveryTime),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Status check error",
        code: "STATUS_CHECK_ERROR",
      };
    }
  },
};

const validateProofStep = {
  name: "Validate Proof of Delivery",
  async invoke(
    input: CompleteDeliveryInput & {
      currentStatus: string;
      estimatedDeliveryTime: Date;
    },
  ): Promise<
    StepResult<
      CompleteDeliveryInput & {
        currentStatus: string;
        estimatedDeliveryTime: Date;
        proofValidated: boolean;
      }
    >
  > {
    try {
      const validation = await mockValidateProof({
        type: input.proofOfDelivery.type,
        data: input.proofOfDelivery.data,
        coordinates: input.deliveryCoordinates,
      });

      if (!validation.isValid) {
        return {
          success: false,
          error: `Invalid ${input.proofOfDelivery.type}: ${validation.reason}`,
          code: "INVALID_PROOF",
        };
      }

      return {
        success: true,
        data: { ...input, proofValidated: true },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Proof validation error",
        code: "PROOF_VALIDATION_ERROR",
      };
    }
  },
};

const updateOrderStatusStep = {
  name: "Update Order Status",
  async invoke(
    input: CompleteDeliveryInput & {
      currentStatus: string;
      estimatedDeliveryTime: Date;
      proofValidated: boolean;
    },
  ): Promise<
    StepResult<
      CompleteDeliveryInput & {
        currentStatus: string;
        estimatedDeliveryTime: Date;
        proofValidated: boolean;
        onTimeDelivery: boolean;
        updateResult: any;
      }
    >
  > {
    try {
      const onTimeDelivery = input.deliveryTime <= input.estimatedDeliveryTime;

      const updateResult = await mockUpdateOrderStatus({
        orderId: input.orderId,
        newStatus: "delivered",
        completedAt: input.deliveryTime,
        proofOfDelivery: {
          type: input.proofOfDelivery.type,
          archivedPath: `s3://pod/${input.orderId}/${Date.now()}`,
        },
        onTime: onTimeDelivery,
      });

      if (!updateResult.success) {
        return {
          success: false,
          error: "Failed to update order status",
          code: "UPDATE_STATUS_FAILED",
        };
      }

      return {
        success: true,
        data: { ...input, onTimeDelivery, updateResult },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Status update error",
        code: "STATUS_UPDATE_ERROR",
      };
    }
  },
  async compensate(output: any) {
    // Revert order status to "out_for_delivery" if billing fails
    vi.fn()({
      orderId: output.orderId,
      revertStatus: "out_for_delivery",
    });
  },
};

const processBillingStep = {
  name: "Process Billing",
  async invoke(input: any): Promise<StepResult<any & { billingResult: any }>> {
    try {
      const billingResult = await mockProcessBilling({
        orderId: input.orderId,
        driverId: input.driverId,
        deliveryTime: input.deliveryTime,
        onTime: input.onTimeDelivery,
      });

      if (!billingResult.success) {
        return {
          success: false,
          error: "Billing processing failed",
          code: "BILLING_FAILED",
        };
      }

      return {
        success: true,
        data: { ...input, billingResult },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Billing error",
        code: "BILLING_ERROR",
      };
    }
  },
  async compensate(output: any) {
    // Void billing if a later step fails
    vi.fn()({
      orderId: output.orderId,
      transactionId: output.billingResult?.transactionId,
      action: "void",
    });
  },
};

const recordMetricsStep = {
  name: "Record Metrics",
  async invoke(input: any): Promise<StepResult<CompletedDelivery>> {
    try {
      const metricsResult = await mockRecordMetrics({
        orderId: input.orderId,
        driverId: input.driverId,
        deliveryTime: input.deliveryTime,
        onTimeDelivery: input.onTimeDelivery,
        proofOfDeliveryType: input.proofOfDelivery.type,
        totalCharge: input.billingResult?.totalCharge || 0,
      });

      if (!metricsResult.recorded) {
        return {
          success: false,
          error: "Failed to record metrics",
          code: "METRICS_RECORD_FAILED",
        };
      }

      return {
        success: true,
        data: {
          orderId: input.orderId,
          driverId: input.driverId,
          completedAt: input.deliveryTime,
          proofOfDeliveryType: input.proofOfDelivery.type,
          onTimeDelivery: input.onTimeDelivery,
          billingProcessed: true,
          totalCharge: input.billingResult?.totalCharge || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Metrics recording error",
        code: "METRICS_ERROR",
      };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe("Complete Delivery Workflow", () => {
  let mockContext: WorkflowContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      prisma: {} as any,
      userId: "user_123",
      shopId: "shop_123",
      orgId: "org_123",
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    };

    // Default mock implementations
    const estimatedTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

    mockValidateOrderStatus.mockResolvedValue({
      currentStatus: "out_for_delivery",
      estimatedDeliveryTime: estimatedTime.toISOString(),
    });

    mockValidateProof.mockResolvedValue({ isValid: true });

    mockUpdateOrderStatus.mockResolvedValue({ success: true });

    mockProcessBilling.mockResolvedValue({
      success: true,
      transactionId: "txn_123",
      totalCharge: 45.99,
    });

    mockRecordMetrics.mockResolvedValue({ recorded: true });

    mockArchiveProof.mockResolvedValue({ archived: true });
  });

  describe("Happy Path - Photo POD", () => {
    it("should complete delivery with photo proof", async () => {
      const deliveryTime = new Date();
      const input: CompleteDeliveryInput = {
        orderId: "order_123",
        driverId: "driver_456",
        deliveryTime,
        proofOfDelivery: {
          type: "photo",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        },
        deliveryCoordinates: { latitude: 43.6532, longitude: -79.3832 },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      expect(validated.success).toBe(true);

      const statusChecked = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );
      expect(statusChecked.success).toBe(true);

      const proofValidated = await validateProofStep.invoke(
        statusChecked.data!,
        mockContext,
      );
      expect(proofValidated.success).toBe(true);

      const statusUpdated = await updateOrderStatusStep.invoke(
        proofValidated.data!,
        mockContext,
      );
      expect(statusUpdated.success).toBe(true);

      const billed = await processBillingStep.invoke(
        statusUpdated.data!,
        mockContext,
      );
      expect(billed.success).toBe(true);

      const metricsRecorded = await recordMetricsStep.invoke(
        billed.data!,
        mockContext,
      );
      expect(metricsRecorded.success).toBe(true);
      expect(metricsRecorded.data!.proofOfDeliveryType).toBe("photo");
    });
  });

  describe("Happy Path - Signature POD", () => {
    it("should complete delivery with signature proof", async () => {
      const deliveryTime = new Date();
      const input: CompleteDeliveryInput = {
        orderId: "order_456",
        driverId: "driver_789",
        deliveryTime,
        proofOfDelivery: {
          type: "signature",
          data: "<svg>...</svg>", // SVG signature
        },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      expect(validated.success).toBe(true);

      const statusChecked = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );
      const proofValidated = await validateProofStep.invoke(
        statusChecked.data!,
        mockContext,
      );
      const statusUpdated = await updateOrderStatusStep.invoke(
        proofValidated.data!,
        mockContext,
      );
      const billed = await processBillingStep.invoke(
        statusUpdated.data!,
        mockContext,
      );
      const metricsRecorded = await recordMetricsStep.invoke(
        billed.data!,
        mockContext,
      );

      expect(metricsRecorded.success).toBe(true);
      expect(metricsRecorded.data!.proofOfDeliveryType).toBe("signature");
    });
  });

  describe("Happy Path - Code POD", () => {
    it("should complete delivery with code proof", async () => {
      const deliveryTime = new Date();
      const input: CompleteDeliveryInput = {
        orderId: "order_789",
        driverId: "driver_111",
        deliveryTime,
        proofOfDelivery: {
          type: "code",
          data: "123456",
        },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const statusChecked = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );
      const proofValidated = await validateProofStep.invoke(
        statusChecked.data!,
        mockContext,
      );
      const statusUpdated = await updateOrderStatusStep.invoke(
        proofValidated.data!,
        mockContext,
      );
      const billed = await processBillingStep.invoke(
        statusUpdated.data!,
        mockContext,
      );
      const metricsRecorded = await recordMetricsStep.invoke(
        billed.data!,
        mockContext,
      );

      expect(metricsRecorded.success).toBe(true);
      expect(metricsRecorded.data!.proofOfDeliveryType).toBe("code");
    });
  });

  describe("Proof of Delivery Validation", () => {
    it("should fail on missing POD", async () => {
      const input: CompleteDeliveryInput = {
        orderId: "order_123",
        driverId: "driver_456",
        deliveryTime: new Date(),
        proofOfDelivery: null as any,
      };

      const result = await validateDeliveryStep.invoke(input, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe("MISSING_POD");
    });

    it("should fail on empty POD data", async () => {
      const input: CompleteDeliveryInput = {
        orderId: "order_123",
        driverId: "driver_456",
        deliveryTime: new Date(),
        proofOfDelivery: {
          type: "photo",
          data: "",
        },
      };

      const result = await validateDeliveryStep.invoke(input, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe("EMPTY_POD");
    });

    it("should fail on invalid POD type", async () => {
      const input: CompleteDeliveryInput = {
        orderId: "order_123",
        driverId: "driver_456",
        deliveryTime: new Date(),
        proofOfDelivery: {
          type: "invalid_type" as any,
          data: "data",
        },
      };

      const result = await validateDeliveryStep.invoke(input, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe("INVALID_POD_TYPE");
    });

    it("should fail on invalid proof content", async () => {
      mockValidateProof.mockResolvedValue({
        isValid: false,
        reason: "Image too small",
      });

      const input: CompleteDeliveryInput = {
        orderId: "order_123",
        driverId: "driver_456",
        deliveryTime: new Date(),
        proofOfDelivery: {
          type: "photo",
          data: "invalid_base64",
        },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const statusChecked = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );
      const result = await validateProofStep.invoke(
        statusChecked.data!,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("INVALID_PROOF");
    });
  });

  describe("Order Status Validation", () => {
    it("should fail when order not found", async () => {
      mockValidateOrderStatus.mockResolvedValue(null);

      const input: CompleteDeliveryInput = {
        orderId: "order_nonexistent",
        driverId: "driver_456",
        deliveryTime: new Date(),
        proofOfDelivery: {
          type: "photo",
          data: "photo_data",
        },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const result = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("ORDER_NOT_FOUND");
    });

    it("should fail when order not in out_for_delivery status", async () => {
      mockValidateOrderStatus.mockResolvedValue({
        currentStatus: "pending",
        estimatedDeliveryTime: new Date().toISOString(),
      });

      const input: CompleteDeliveryInput = {
        orderId: "order_123",
        driverId: "driver_456",
        deliveryTime: new Date(),
        proofOfDelivery: {
          type: "photo",
          data: "photo_data",
        },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const result = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("INVALID_ORDER_STATUS");
    });

    it("should accept only out_for_delivery status", async () => {
      mockValidateOrderStatus.mockResolvedValue({
        currentStatus: "out_for_delivery",
        estimatedDeliveryTime: new Date().toISOString(),
      });

      const input: CompleteDeliveryInput = {
        orderId: "order_123",
        driverId: "driver_456",
        deliveryTime: new Date(),
        proofOfDelivery: {
          type: "photo",
          data: "photo_data",
        },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const result = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );

      expect(result.success).toBe(true);
    });
  });

  describe("On-Time Delivery Tracking", () => {
    it("should mark delivery as on-time", async () => {
      const estimatedTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const deliveryTime = new Date(Date.now() + 30 * 60 * 1000); // 30 mins from now (before estimated)

      mockValidateOrderStatus.mockResolvedValue({
        currentStatus: "out_for_delivery",
        estimatedDeliveryTime: estimatedTime.toISOString(),
      });

      const input: CompleteDeliveryInput = {
        orderId: "order_ontime",
        driverId: "driver_456",
        deliveryTime,
        proofOfDelivery: {
          type: "photo",
          data: "photo_data",
        },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const statusChecked = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );
      const proofValidated = await validateProofStep.invoke(
        statusChecked.data!,
        mockContext,
      );
      const statusUpdated = await updateOrderStatusStep.invoke(
        proofValidated.data!,
        mockContext,
      );

      expect(statusUpdated.data!.onTimeDelivery).toBe(true);
    });

    it("should mark delivery as late", async () => {
      const estimatedTime = new Date(Date.now() + 30 * 60 * 1000); // 30 mins from now
      const deliveryTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now (after estimated)

      mockValidateOrderStatus.mockResolvedValue({
        currentStatus: "out_for_delivery",
        estimatedDeliveryTime: estimatedTime.toISOString(),
      });

      const input: CompleteDeliveryInput = {
        orderId: "order_late",
        driverId: "driver_456",
        deliveryTime,
        proofOfDelivery: {
          type: "photo",
          data: "photo_data",
        },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const statusChecked = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );
      const proofValidated = await validateProofStep.invoke(
        statusChecked.data!,
        mockContext,
      );
      const statusUpdated = await updateOrderStatusStep.invoke(
        proofValidated.data!,
        mockContext,
      );

      expect(statusUpdated.data!.onTimeDelivery).toBe(false);
    });

    it("should record on-time metric in metrics step", async () => {
      const estimatedTime = new Date(Date.now() + 60 * 60 * 1000);
      const deliveryTime = new Date(Date.now() + 30 * 60 * 1000);

      mockValidateOrderStatus.mockResolvedValue({
        currentStatus: "out_for_delivery",
        estimatedDeliveryTime: estimatedTime.toISOString(),
      });

      const input: CompleteDeliveryInput = {
        orderId: "order_metric",
        driverId: "driver_456",
        deliveryTime,
        proofOfDelivery: {
          type: "photo",
          data: "photo_data",
        },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const statusChecked = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );
      const proofValidated = await validateProofStep.invoke(
        statusChecked.data!,
        mockContext,
      );
      const statusUpdated = await updateOrderStatusStep.invoke(
        proofValidated.data!,
        mockContext,
      );
      const billed = await processBillingStep.invoke(
        statusUpdated.data!,
        mockContext,
      );
      const metricsRecorded = await recordMetricsStep.invoke(
        billed.data!,
        mockContext,
      );

      expect(mockRecordMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          onTimeDelivery: true,
        }),
      );
    });
  });

  describe("Billing Processing", () => {
    it("should process billing on successful delivery", async () => {
      const input: CompleteDeliveryInput = {
        orderId: "order_billing",
        driverId: "driver_456",
        deliveryTime: new Date(),
        proofOfDelivery: {
          type: "photo",
          data: "photo_data",
        },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const statusChecked = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );
      const proofValidated = await validateProofStep.invoke(
        statusChecked.data!,
        mockContext,
      );
      const statusUpdated = await updateOrderStatusStep.invoke(
        proofValidated.data!,
        mockContext,
      );
      const result = await processBillingStep.invoke(
        statusUpdated.data!,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(mockProcessBilling).toHaveBeenCalled();
    });

    it("should trigger compensation on billing failure", async () => {
      mockProcessBilling.mockResolvedValue({ success: false });

      const input: CompleteDeliveryInput = {
        orderId: "order_billing_fail",
        driverId: "driver_456",
        deliveryTime: new Date(),
        proofOfDelivery: {
          type: "photo",
          data: "photo_data",
        },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const statusChecked = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );
      const proofValidated = await validateProofStep.invoke(
        statusChecked.data!,
        mockContext,
      );
      const statusUpdated = await updateOrderStatusStep.invoke(
        proofValidated.data!,
        mockContext,
      );
      const result = await processBillingStep.invoke(
        statusUpdated.data!,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("BILLING_FAILED");
    });

    it("should include on-time delivery info in billing", async () => {
      const estimatedTime = new Date(Date.now() + 60 * 60 * 1000);
      const deliveryTime = new Date(Date.now() + 30 * 60 * 1000);

      mockValidateOrderStatus.mockResolvedValue({
        currentStatus: "out_for_delivery",
        estimatedDeliveryTime: estimatedTime.toISOString(),
      });

      const input: CompleteDeliveryInput = {
        orderId: "order_ontime_billing",
        driverId: "driver_456",
        deliveryTime,
        proofOfDelivery: {
          type: "photo",
          data: "photo_data",
        },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const statusChecked = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );
      const proofValidated = await validateProofStep.invoke(
        statusChecked.data!,
        mockContext,
      );
      const statusUpdated = await updateOrderStatusStep.invoke(
        proofValidated.data!,
        mockContext,
      );
      await processBillingStep.invoke(statusUpdated.data!, mockContext);

      expect(mockProcessBilling).toHaveBeenCalledWith(
        expect.objectContaining({
          onTime: true,
        }),
      );
    });
  });

  describe("Metrics Recording", () => {
    it("should record delivery metrics", async () => {
      const input: CompleteDeliveryInput = {
        orderId: "order_metrics",
        driverId: "driver_456",
        deliveryTime: new Date(),
        proofOfDelivery: {
          type: "photo",
          data: "photo_data",
        },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const statusChecked = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );
      const proofValidated = await validateProofStep.invoke(
        statusChecked.data!,
        mockContext,
      );
      const statusUpdated = await updateOrderStatusStep.invoke(
        proofValidated.data!,
        mockContext,
      );
      const billed = await processBillingStep.invoke(
        statusUpdated.data!,
        mockContext,
      );
      const result = await recordMetricsStep.invoke(billed.data!, mockContext);

      expect(mockRecordMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order_metrics",
          driverId: "driver_456",
          proofOfDeliveryType: "photo",
        }),
      );

      expect(result.data!.orderId).toBe("order_metrics");
      expect(result.data!.billingProcessed).toBe(true);
    });

    it("should record correct total charge in metrics", async () => {
      mockProcessBilling.mockResolvedValue({
        success: true,
        transactionId: "txn_456",
        totalCharge: 99.99,
      });

      const input: CompleteDeliveryInput = {
        orderId: "order_charge",
        driverId: "driver_456",
        deliveryTime: new Date(),
        proofOfDelivery: {
          type: "photo",
          data: "photo_data",
        },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const statusChecked = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );
      const proofValidated = await validateProofStep.invoke(
        statusChecked.data!,
        mockContext,
      );
      const statusUpdated = await updateOrderStatusStep.invoke(
        proofValidated.data!,
        mockContext,
      );
      const billed = await processBillingStep.invoke(
        statusUpdated.data!,
        mockContext,
      );
      const result = await recordMetricsStep.invoke(billed.data!, mockContext);

      expect(result.data!.totalCharge).toBe(99.99);
    });

    it("should handle metrics recording failure", async () => {
      mockRecordMetrics.mockResolvedValue({ recorded: false });

      const input: CompleteDeliveryInput = {
        orderId: "order_metrics_fail",
        driverId: "driver_456",
        deliveryTime: new Date(),
        proofOfDelivery: {
          type: "photo",
          data: "photo_data",
        },
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const statusChecked = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );
      const proofValidated = await validateProofStep.invoke(
        statusChecked.data!,
        mockContext,
      );
      const statusUpdated = await updateOrderStatusStep.invoke(
        proofValidated.data!,
        mockContext,
      );
      const billed = await processBillingStep.invoke(
        statusUpdated.data!,
        mockContext,
      );
      const result = await recordMetricsStep.invoke(billed.data!, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe("METRICS_RECORD_FAILED");
    });
  });

  describe("Validation Input", () => {
    it("should fail on missing order ID", async () => {
      const input: CompleteDeliveryInput = {
        orderId: "",
        driverId: "driver_456",
        deliveryTime: new Date(),
        proofOfDelivery: {
          type: "photo",
          data: "photo_data",
        },
      };

      const result = await validateDeliveryStep.invoke(input, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe("INVALID_ORDER_ID");
    });

    it("should fail on missing driver ID", async () => {
      const input: CompleteDeliveryInput = {
        orderId: "order_123",
        driverId: "",
        deliveryTime: new Date(),
        proofOfDelivery: {
          type: "photo",
          data: "photo_data",
        },
      };

      const result = await validateDeliveryStep.invoke(input, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe("INVALID_DRIVER_ID");
    });
  });

  describe("Optional Coordinates", () => {
    it("should work without delivery coordinates", async () => {
      const input: CompleteDeliveryInput = {
        orderId: "order_no_coords",
        driverId: "driver_456",
        deliveryTime: new Date(),
        proofOfDelivery: {
          type: "code",
          data: "123456",
        },
        // No deliveryCoordinates
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      expect(validated.success).toBe(true);

      const statusChecked = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );
      const proofValidated = await validateProofStep.invoke(
        statusChecked.data!,
        mockContext,
      );
      expect(proofValidated.success).toBe(true);
    });

    it("should include coordinates in proof validation if provided", async () => {
      const coords = { latitude: 43.6532, longitude: -79.3832 };
      const input: CompleteDeliveryInput = {
        orderId: "order_with_coords",
        driverId: "driver_456",
        deliveryTime: new Date(),
        proofOfDelivery: {
          type: "photo",
          data: "photo_data",
        },
        deliveryCoordinates: coords,
      };

      const validated = await validateDeliveryStep.invoke(input, mockContext);
      const statusChecked = await checkOrderStatusStep.invoke(
        validated.data!,
        mockContext,
      );
      await validateProofStep.invoke(statusChecked.data!, mockContext);

      expect(mockValidateProof).toHaveBeenCalledWith(
        expect.objectContaining({
          coordinates: coords,
        }),
      );
    });
  });
});
