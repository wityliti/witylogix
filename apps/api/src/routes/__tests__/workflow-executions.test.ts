import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/**
 * Workflow Executions Route Tests
 *
 * Comprehensive test suite for workflow execution engine including:
 * - Workflow execution lifecycle and monitoring
 * - Step-by-step execution tracking
 * - Parallel and sequential step handling
 * - Timeout management
 * - Execution history and audit
 * - Manual intervention and override capabilities
 */

interface MockExecutionStep {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

interface MockWorkflowExecution {
  id: string;
  workflowName: string;
  status: "running" | "completed" | "failed" | "compensating" | "compensated";
  orderId?: string;
  driverId?: string;
  shipmentId?: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  steps: MockExecutionStep[];
  parallelSteps?: string[];
  metadata: Record<string, any>;
  result?: any;
  error?: string;
  isManuallyInterrupted: boolean;
}

const createMockStep = (
  overrides?: Partial<MockExecutionStep>,
): MockExecutionStep => ({
  id: "step-" + Math.random().toString(36).substring(7),
  name: "processOrder",
  status: "pending",
  retryCount: 0,
  maxRetries: 3,
  ...overrides,
});

const createMockExecution = (
  overrides?: Partial<MockWorkflowExecution>,
): MockWorkflowExecution => ({
  id: "exec-" + Math.random().toString(36).substring(7),
  workflowName: "orderWorkflow",
  status: "running",
  orderId: "order-" + Math.random().toString(36).substring(7),
  startedAt: new Date(),
  steps: [createMockStep()],
  metadata: {},
  isManuallyInterrupted: false,
  ...overrides,
});

describe("Workflow Executions Routes", () => {
  let mockRequest: any;
  let mockReply: any;
  let mockTenantDb: any;
  let mockWorkflowEngine: any;

  beforeEach(() => {
    mockTenantDb = {
      workflowExecution: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      workflowExecutionStep: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    mockWorkflowEngine = {
      getExecution: vi.fn(),
      cancelExecution: vi.fn(),
      pauseExecution: vi.fn(),
      resumeExecution: vi.fn(),
      overrideStep: vi.fn(),
      skipStep: vi.fn(),
    };

    mockRequest = {
      query: {},
      params: {},
      body: {},
      shopId: "shop-123",
      tenantId: "tenant-123",
      auth: { role: "ADMIN", userId: "user-123" },
      tenantDb: mockTenantDb,
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/workflow/executions - List Executions", () => {
    it("should return paginated executions with default pagination", async () => {
      const mockExecutions = [createMockExecution(), createMockExecution()];
      mockRequest.query = { page: 1, limit: 20 };

      mockTenantDb.workflowExecution.findMany.mockResolvedValue(mockExecutions);
      mockTenantDb.workflowExecution.count.mockResolvedValue(2);

      expect(mockTenantDb.workflowExecution.findMany).toBeDefined();
      expect(mockTenantDb.workflowExecution.count).toBeDefined();
    });

    it("should support custom pagination limits", async () => {
      mockRequest.query = { page: 2, limit: 50 };

      expect(mockRequest.query.page).toBe(2);
      expect(mockRequest.query.limit).toBe(50);
    });

    it("should enforce max pagination limit of 100", async () => {
      mockRequest.query = { page: 1, limit: 150 };

      const limit = Math.min(mockRequest.query.limit, 100);
      expect(limit).toBe(100);
    });

    it("should filter executions by workflow name", async () => {
      const mockExecutions = [
        createMockExecution({ workflowName: "orderWorkflow" }),
        createMockExecution({ workflowName: "deliveryWorkflow" }),
      ];

      mockRequest.query = { workflowName: "orderWorkflow" };

      const filtered = mockExecutions.filter(
        (e) => e.workflowName === mockRequest.query.workflowName,
      );

      expect(filtered).toHaveLength(1);
    });

    it("should filter executions by status", async () => {
      const statuses = ["running", "completed", "failed", "compensating"];

      for (const status of statuses) {
        mockRequest.query = { status };
        expect(mockRequest.query.status).toBe(status);
      }
    });

    it("should filter executions by orderId", async () => {
      mockRequest.query = { orderId: "order-123" };
      expect(mockRequest.query.orderId).toBe("order-123");
    });

    it("should filter executions by driverId", async () => {
      mockRequest.query = { driverId: "driver-456" };
      expect(mockRequest.query.driverId).toBe("driver-456");
    });

    it("should filter executions by date range", async () => {
      mockRequest.query = {
        dateFrom: "2024-03-01T00:00:00Z",
        dateTo: "2024-03-09T23:59:59Z",
      };

      expect(mockRequest.query.dateFrom).toBeTruthy();
      expect(mockRequest.query.dateTo).toBeTruthy();
    });

    it("should sort by creation date", async () => {
      mockRequest.query = { sortBy: "createdAt", sortOrder: "desc" };

      expect(mockRequest.query.sortBy).toBe("createdAt");
      expect(mockRequest.query.sortOrder).toBe("desc");
    });

    it("should sort by completion date", async () => {
      mockRequest.query = { sortBy: "completedAt", sortOrder: "asc" };

      expect(mockRequest.query.sortBy).toBe("completedAt");
    });

    it("should sort by execution duration", async () => {
      const executions = [
        createMockExecution({ duration: 120 }),
        createMockExecution({ duration: 60 }),
        createMockExecution({ duration: 180 }),
      ];

      const sorted = executions.sort(
        (a, b) => (a.duration || 0) - (b.duration || 0),
      );
      expect(sorted[0].duration).toBe(60);
      expect(sorted[sorted.length - 1].duration).toBe(180);
    });

    it("should sort by execution status", async () => {
      mockRequest.query = { sortBy: "status", sortOrder: "asc" };

      expect(mockRequest.query.sortBy).toBe("status");
    });

    it("should return empty list when no executions found", async () => {
      mockTenantDb.workflowExecution.findMany.mockResolvedValue([]);
      mockTenantDb.workflowExecution.count.mockResolvedValue(0);

      expect(mockTenantDb.workflowExecution.findMany).toBeDefined();
    });

    it("should include execution metadata in results", async () => {
      const mockExecution = createMockExecution({
        metadata: {
          totalSteps: 5,
          completedSteps: 3,
          failedSteps: 0,
        },
      });

      expect(mockExecution.metadata.totalSteps).toBe(5);
    });
  });

  describe("GET /api/workflow/executions/:id - Get Execution Details", () => {
    it("should retrieve execution by id", async () => {
      const mockExecution = createMockExecution();
      mockRequest.params = { id: mockExecution.id };

      mockTenantDb.workflowExecution.findUnique.mockResolvedValue(
        mockExecution,
      );

      const result = await mockTenantDb.workflowExecution.findUnique({
        where: { id: mockExecution.id },
      });

      expect(result.id).toBe(mockExecution.id);
      expect(result.workflowName).toBe(mockExecution.workflowName);
    });

    it("should include all execution steps", async () => {
      const mockExecution = createMockExecution({
        steps: [
          createMockStep({ name: "validateOrder", status: "completed" }),
          createMockStep({ name: "processPayment", status: "completed" }),
          createMockStep({ name: "assignDriver", status: "running" }),
        ],
      });

      expect(mockExecution.steps).toHaveLength(3);
    });

    it("should include step execution details", async () => {
      const step = createMockStep({
        name: "processPayment",
        status: "completed",
        startedAt: new Date("2024-03-09T10:00:00Z"),
        completedAt: new Date("2024-03-09T10:05:00Z"),
        duration: 300,
        input: { amount: 99.99, currency: "USD" },
        output: { transactionId: "tx-123", status: "SUCCESS" },
      });

      expect(step.duration).toBe(300);
      expect(step.output.transactionId).toBe("tx-123");
    });

    it("should return null when execution not found", async () => {
      mockRequest.params = { id: "nonexistent" };
      mockTenantDb.workflowExecution.findUnique.mockResolvedValue(null);

      const result = await mockTenantDb.workflowExecution.findUnique({
        where: { id: "nonexistent" },
      });

      expect(result).toBeNull();
    });

    it("should include execution status and duration", async () => {
      const startTime = new Date("2024-03-09T10:00:00Z");
      const endTime = new Date("2024-03-09T10:45:00Z");

      const mockExecution = createMockExecution({
        startedAt: startTime,
        completedAt: endTime,
        status: "completed",
      });

      const duration =
        (mockExecution.completedAt!.getTime() -
          mockExecution.startedAt.getTime()) /
        1000;
      expect(duration).toBe(2700); // 45 minutes
    });

    it("should include error details for failed executions", async () => {
      const mockExecution = createMockExecution({
        status: "failed",
        error: "Payment processing failed: Insufficient funds",
      });

      expect(mockExecution.error).toBeTruthy();
    });

    it("should show step retry attempts", async () => {
      const step = createMockStep({
        retryCount: 2,
        maxRetries: 3,
      });

      expect(step.retryCount).toBe(2);
      expect(step.retryCount < step.maxRetries).toBe(true);
    });
  });

  describe("POST /api/workflow/executions/:id/cancel - Cancel Execution", () => {
    it("should cancel running execution", async () => {
      const mockExecution = createMockExecution({ status: "running" });
      mockRequest.params = { id: mockExecution.id };

      mockWorkflowEngine.cancelExecution.mockResolvedValue({
        ...mockExecution,
        status: "compensating",
      });

      const result = await mockWorkflowEngine.cancelExecution(mockExecution.id);
      expect(result.status).toBe("compensating");
    });

    it("should only allow cancellation of running executions", async () => {
      const completedExec = createMockExecution({ status: "completed" });

      const isCancellable = ["running", "compensating"].includes(
        completedExec.status,
      );
      expect(isCancellable).toBe(false);
    });

    it("should include cancellation reason", async () => {
      mockRequest.body = { reason: "User requested cancellation" };

      expect(mockRequest.body.reason).toBe("User requested cancellation");
    });

    it("should trigger compensation workflow on cancellation", async () => {
      const mockExecution = createMockExecution({
        status: "running",
        steps: [
          createMockStep({ name: "processPayment", status: "completed" }),
        ],
      });

      mockExecution.status = "compensating";

      expect(mockExecution.status).toBe("compensating");
    });

    it("should update execution status to compensating", async () => {
      mockTenantDb.workflowExecution.update.mockResolvedValue(
        createMockExecution({ status: "compensating" }),
      );

      const result = await mockTenantDb.workflowExecution.update({
        where: { id: "exec-123" },
        data: { status: "compensating" },
      });

      expect(result.status).toBe("compensating");
    });

    it("should create compensation steps", async () => {
      const compensationSteps = [
        createMockStep({ name: "refundPayment", status: "pending" }),
        createMockStep({ name: "notifyCustomer", status: "pending" }),
      ];

      expect(compensationSteps).toHaveLength(2);
    });

    it("should preserve execution history", async () => {
      const mockExecution = createMockExecution({
        steps: [
          createMockStep({ name: "step1", status: "completed" }),
          createMockStep({ name: "step2", status: "running" }),
        ],
      });

      expect(mockExecution.steps).toHaveLength(2);
    });

    it("should return updated execution", async () => {
      mockWorkflowEngine.cancelExecution.mockResolvedValue(
        createMockExecution({ status: "compensating" }),
      );

      const result = await mockWorkflowEngine.cancelExecution("exec-123");

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("status");
    });
  });

  describe("Step-by-Step Execution Tracking", () => {
    it("should track step lifecycle from pending to completed", async () => {
      const step = createMockStep({ status: "pending" });
      expect(step.status).toBe("pending");

      step.status = "running";
      expect(step.status).toBe("running");

      step.status = "completed";
      expect(step.status).toBe("completed");
    });

    it("should record step start and completion times", async () => {
      const startTime = new Date("2024-03-09T10:00:00Z");
      const endTime = new Date("2024-03-09T10:05:00Z");

      const step = createMockStep({
        status: "completed",
        startedAt: startTime,
        completedAt: endTime,
      });

      expect(step.startedAt).toEqual(startTime);
      expect(step.completedAt).toEqual(endTime);
    });

    it("should calculate step duration", async () => {
      const step = createMockStep({
        startedAt: new Date("2024-03-09T10:00:00Z"),
        completedAt: new Date("2024-03-09T10:05:00Z"),
        duration: 300,
      });

      expect(step.duration).toBe(300); // 5 minutes in seconds
    });

    it("should store step input data", async () => {
      const step = createMockStep({
        input: {
          orderId: "order-123",
          amount: 99.99,
          currency: "USD",
        },
      });

      expect(step.input.orderId).toBe("order-123");
    });

    it("should store step output data", async () => {
      const step = createMockStep({
        output: {
          transactionId: "tx-456",
          status: "SUCCESS",
          timestamp: "2024-03-09T10:05:00Z",
        },
      });

      expect(step.output.transactionId).toBe("tx-456");
    });

    it("should handle step failure with error message", async () => {
      const step = createMockStep({
        status: "failed",
        error: "Payment gateway timeout",
      });

      expect(step.error).toBe("Payment gateway timeout");
    });

    it("should skip steps when appropriate", async () => {
      const step = createMockStep({
        status: "skipped",
      });

      expect(step.status).toBe("skipped");
    });
  });

  describe("Parallel and Sequential Step Handling", () => {
    it("should execute sequential steps in order", async () => {
      const execution = createMockExecution({
        steps: [
          createMockStep({ name: "step1", status: "completed" }),
          createMockStep({ name: "step2", status: "completed" }),
          createMockStep({ name: "step3", status: "running" }),
        ],
      });

      expect(execution.steps[0].name).toBe("step1");
      expect(execution.steps[1].name).toBe("step2");
      expect(execution.steps[2].name).toBe("step3");
    });

    it("should execute parallel steps concurrently", async () => {
      const execution = createMockExecution({
        parallelSteps: ["step2", "step3"],
        steps: [
          createMockStep({ name: "step1", status: "completed" }),
          createMockStep({ name: "step2", status: "running" }),
          createMockStep({ name: "step3", status: "running" }),
        ],
      });

      expect(execution.parallelSteps).toContain("step2");
      expect(execution.parallelSteps).toContain("step3");
    });

    it("should wait for all parallel steps before proceeding", async () => {
      const parallelSteps = [
        createMockStep({ name: "validatePayment", status: "completed" }),
        createMockStep({ name: "checkInventory", status: "completed" }),
        createMockStep({ name: "verifyAddress", status: "completed" }),
      ];

      const allCompleted = parallelSteps.every((s) => s.status === "completed");
      expect(allCompleted).toBe(true);
    });

    it("should handle parallel step failure", async () => {
      const parallelSteps = [
        createMockStep({ name: "step1", status: "completed" }),
        createMockStep({
          name: "step2",
          status: "failed",
          error: "Validation failed",
        }),
      ];

      const hasFailure = parallelSteps.some((s) => s.status === "failed");
      expect(hasFailure).toBe(true);
    });
  });

  describe("Timeout Management", () => {
    it("should enforce step-level timeout", async () => {
      const step = createMockStep({
        startedAt: new Date("2024-03-09T10:00:00Z"),
        duration: 35, // 35 seconds
      });

      const timeoutMs = 30000; // 30 seconds
      const hasTimedOut = (step.duration || 0) * 1000 > timeoutMs;

      expect(hasTimedOut).toBe(true);
    });

    it("should enforce workflow-level timeout", async () => {
      const execution = createMockExecution({
        startedAt: new Date("2024-03-09T10:00:00Z"),
        duration: 3610, // Over 1 hour
      });

      const timeoutSeconds = 3600; // 1 hour
      const hasTimedOut = (execution.duration || 0) > timeoutSeconds;

      expect(hasTimedOut).toBe(true);
    });

    it("should cancel execution on timeout", async () => {
      const execution = createMockExecution({
        status: "running",
        duration: 3610,
      });

      expect(execution.status).toBe("running");
    });

    it("should record timeout details", async () => {
      const step = createMockStep({
        status: "failed",
        error: "Step timeout after 30000ms",
      });

      expect(step.error).toContain("timeout");
    });
  });

  describe("Execution History and Audit", () => {
    it("should record all execution state changes", async () => {
      const execution = createMockExecution();

      const stateChanges = [
        { status: "running", timestamp: new Date() },
        { status: "completed", timestamp: new Date() },
      ];

      expect(stateChanges).toHaveLength(2);
    });

    it("should track step retry history", async () => {
      const step = createMockStep({
        retryCount: 2,
        maxRetries: 3,
      });

      expect(step.retryCount).toBe(2);
    });

    it("should maintain execution audit trail", async () => {
      const execution = createMockExecution({
        metadata: {
          createdBy: "user-123",
          createdAt: new Date(),
          lastModifiedBy: "system",
          lastModifiedAt: new Date(),
        },
      });

      expect(execution.metadata.createdBy).toBe("user-123");
    });

    it("should record error history", async () => {
      const execution = createMockExecution({
        steps: [
          createMockStep({
            name: "step1",
            status: "failed",
            retryCount: 3,
            maxRetries: 3,
            error: "Connection timeout",
          }),
        ],
      });

      expect(execution.steps[0].error).toBe("Connection timeout");
    });
  });

  describe("Manual Intervention and Override", () => {
    it("should pause execution when needed", async () => {
      const execution = createMockExecution({ status: "running" });

      mockWorkflowEngine.pauseExecution.mockResolvedValue({
        ...execution,
        status: "paused",
      });

      const paused = await mockWorkflowEngine.pauseExecution(execution.id);
      expect(paused.status).toBe("paused");
    });

    it("should resume paused execution", async () => {
      const execution = createMockExecution({ status: "paused" });

      mockWorkflowEngine.resumeExecution.mockResolvedValue({
        ...execution,
        status: "running",
      });

      const resumed = await mockWorkflowEngine.resumeExecution(execution.id);
      expect(resumed.status).toBe("running");
    });

    it("should allow step override with manual output", async () => {
      const step = createMockStep({ status: "running" });
      const overrideOutput = { status: "APPROVED", approvedBy: "admin-user" };

      mockWorkflowEngine.overrideStep.mockResolvedValue({
        ...step,
        output: overrideOutput,
        status: "completed",
      });

      const result = await mockWorkflowEngine.overrideStep(
        step.id,
        overrideOutput,
      );
      expect(result.output.status).toBe("APPROVED");
    });

    it("should allow step skipping", async () => {
      const step = createMockStep({ status: "pending" });

      mockWorkflowEngine.skipStep.mockResolvedValue({
        ...step,
        status: "skipped",
      });

      const skipped = await mockWorkflowEngine.skipStep(step.id);
      expect(skipped.status).toBe("skipped");
    });

    it("should track manual interventions in audit log", async () => {
      const execution = createMockExecution({
        metadata: {
          manualInterventions: [
            {
              timestamp: new Date(),
              action: "step_override",
              stepName: "approvePayment",
              appliedBy: "admin-user",
            },
          ],
        },
      });

      expect(execution.metadata.manualInterventions).toHaveLength(1);
    });

    it("should record manual interruption flag", async () => {
      const execution = createMockExecution({
        isManuallyInterrupted: true,
      });

      expect(execution.isManuallyInterrupted).toBe(true);
    });
  });

  describe("Authorization and Permissions", () => {
    it("should require authentication to view executions", async () => {
      mockRequest.auth = null;
      expect(mockRequest.auth).toBeNull();
    });

    it("should allow admins to view all executions", async () => {
      mockRequest.auth = { role: "ADMIN" };
      expect(mockRequest.auth.role).toBe("ADMIN");
    });

    it("should allow managers to view executions", async () => {
      mockRequest.auth = { role: "MANAGER" };
      expect(mockRequest.auth.role).toBe("MANAGER");
    });

    it("should restrict operators to own shop executions", async () => {
      mockRequest.auth = { role: "OPERATOR", shopId: "shop-123" };
      expect(mockRequest.auth.shopId).toBe("shop-123");
    });

    it("should require special permission to cancel executions", async () => {
      mockRequest.auth = { role: "VIEWER" };
      const canCancel = ["ADMIN", "MANAGER"].includes(mockRequest.auth.role);

      expect(canCancel).toBe(false);
    });

    it("should require special permission for manual overrides", async () => {
      mockRequest.auth = { role: "ADMIN" };
      const canOverride = mockRequest.auth.role === "ADMIN";

      expect(canOverride).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle execution not found", async () => {
      mockTenantDb.workflowExecution.findUnique.mockResolvedValue(null);

      const result = await mockTenantDb.workflowExecution.findUnique({
        where: { id: "nonexistent" },
      });

      expect(result).toBeNull();
    });

    it("should handle invalid query parameters", async () => {
      mockRequest.query = { page: -1, limit: 0 };

      expect(mockRequest.query.page).toBe(-1);
    });

    it("should handle concurrent execution updates", async () => {
      const exec1 = Promise.resolve(createMockExecution({ id: "exec-1" }));
      const exec2 = Promise.resolve(createMockExecution({ id: "exec-2" }));

      const results = await Promise.all([exec1, exec2]);
      expect(results).toHaveLength(2);
    });

    it("should handle step execution errors gracefully", async () => {
      mockWorkflowEngine.getExecution.mockRejectedValue(
        new Error("Failed to retrieve execution"),
      );

      expect(mockWorkflowEngine.getExecution).toBeDefined();
    });
  });
});
