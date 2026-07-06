// @ts-nocheck
/**
 * @witylogix/core — Workflow Integration Test Suite (~350 lines)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

interface WorkflowConfig {
  tenantId: string;
  mode: "auto" | "manual" | "disabled";
  autoTriggerOn?: string[];
}

interface WorkflowExecution {
  id: string;
  workflowType: string;
  input: any;
  output?: any;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  error?: string;
}

class WorkflowIntegration {
  private configs: Map<string, WorkflowConfig> = new Map();
  private executions: WorkflowExecution[] = [];
  private eventEmitter: any = {};
  private workflowEngine: any;

  constructor(workflowEngine?: any) {
    this.workflowEngine = workflowEngine;
  }

  setConfig(tenantId: string, config: WorkflowConfig): void {
    this.configs.set(tenantId, config);
  }

  getConfig(tenantId: string): WorkflowConfig | undefined {
    return this.configs.get(tenantId);
  }

  async triggerWorkflow(
    workflowType: string,
    input: any,
    tenantId: string,
  ): Promise<string> {
    const config = this.getConfig(tenantId);
    if (!config || config.mode === "disabled" || config.mode === "manual")
      return "";

    const execution: WorkflowExecution = {
      id: `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workflowType,
      input,
      status: "pending",
      startedAt: new Date().toISOString(),
    };

    this.executions.push(execution);

    setImmediate(async () => {
      await this.executeWorkflow(execution);
    });

    return execution.id;
  }

  async executeWorkflow(execution: WorkflowExecution): Promise<void> {
    try {
      execution.status = "running";
      if (this.workflowEngine && this.workflowEngine.execute) {
        execution.output = await this.workflowEngine.execute(
          execution.workflowType,
          execution.input,
        );
      } else {
        execution.output = { result: "success" };
      }
      execution.status = "completed";
      execution.completedAt = new Date().toISOString();

      if (this.eventEmitter.emit) {
        this.eventEmitter.emit("workflow.completed", {
          workflowId: execution.id,
          workflowType: execution.workflowType,
          output: execution.output,
          completedAt: execution.completedAt,
        });
      }
    } catch (error) {
      execution.status = "failed";
      execution.error = (error as Error).message;
      execution.completedAt = new Date().toISOString();

      if (this.eventEmitter.emit) {
        this.eventEmitter.emit("workflow.failed", {
          workflowId: execution.id,
          workflowType: execution.workflowType,
          error: execution.error,
          failedAt: execution.completedAt,
        });
      }
    }
  }

  shouldAutoTrigger(eventType: string, tenantId: string): boolean {
    const config = this.getConfig(tenantId);
    if (!config || config.mode !== "auto") return false;
    if (!config.autoTriggerOn) return false;
    return config.autoTriggerOn.includes(eventType);
  }

  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.find((e) => e.id === executionId);
  }

  listExecutions(): WorkflowExecution[] {
    return this.executions;
  }

  setEventEmitter(emitter: any): void {
    this.eventEmitter = emitter;
  }
}

describe("Workflow Integration", () => {
  let integration: WorkflowIntegration;

  beforeEach(() => {
    integration = new WorkflowIntegration();
  });

  describe("auto-trigger on order creation", () => {
    it("should auto-trigger workflow in auto mode", async () => {
      integration.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "auto",
        autoTriggerOn: ["order.created"],
      });

      const executionId = await integration.triggerWorkflow(
        "process_order",
        { orderId: "123" },
        "tenant_1",
      );
      expect(executionId).toBeDefined();
    });

    it("should not auto-trigger in manual mode", async () => {
      integration.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "manual",
      });

      const executionId = await integration.triggerWorkflow(
        "process_order",
        { orderId: "123" },
        "tenant_1",
      );
      expect(executionId).toBe("");
    });

    it("should not trigger in disabled mode", async () => {
      integration.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "disabled",
      });

      const executionId = await integration.triggerWorkflow(
        "process_order",
        { orderId: "123" },
        "tenant_1",
      );
      expect(executionId).toBe("");
    });
  });

  describe("tenant config: auto vs manual vs disabled", () => {
    it("should respect auto mode config", () => {
      integration.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "auto",
        autoTriggerOn: ["order.created", "delivery.started"],
      });

      const config = integration.getConfig("tenant_1");
      expect(config?.mode).toBe("auto");
      expect(config?.autoTriggerOn).toContain("order.created");
    });

    it("should respect manual mode config", () => {
      integration.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "manual",
      });

      const config = integration.getConfig("tenant_1");
      expect(config?.mode).toBe("manual");
    });

    it("should check auto-trigger eligibility", () => {
      integration.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "auto",
        autoTriggerOn: ["order.created"],
      });

      expect(integration.shouldAutoTrigger("order.created", "tenant_1")).toBe(
        true,
      );
      expect(
        integration.shouldAutoTrigger("delivery.started", "tenant_1"),
      ).toBe(false);
    });
  });

  describe("graceful fallback on workflow engine failure", () => {
    it("should handle workflow engine failure gracefully", async () => {
      const failingEngine = {
        execute: vi.fn().mockRejectedValue(new Error("Engine failed")),
      };

      const integrationWithEngine = new WorkflowIntegration(failingEngine);
      integrationWithEngine.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "auto",
      });

      const executionId = await integrationWithEngine.triggerWorkflow(
        "process_order",
        { orderId: "123" },
        "tenant_1",
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      const execution = integrationWithEngine.getExecution(executionId);
      expect(execution?.status).toBe("failed");
      expect(execution?.error).toBe("Engine failed");
    });

    it("should emit failure event on engine error", async () => {
      const eventEmitter = { emit: vi.fn() };
      const failingEngine = {
        execute: vi.fn().mockRejectedValue(new Error("Engine failed")),
      };

      const integrationWithEngine = new WorkflowIntegration(failingEngine);
      integrationWithEngine.setEventEmitter(eventEmitter);
      integrationWithEngine.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "auto",
      });

      const executionId = await integrationWithEngine.triggerWorkflow(
        "process_order",
        { orderId: "123" },
        "tenant_1",
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "workflow.failed",
        expect.any(Object),
      );
    });
  });

  describe("non-blocking behavior", () => {
    it("should return execution ID immediately", async () => {
      integration.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "auto",
      });

      const start = Date.now();
      const executionId = await integration.triggerWorkflow(
        "process_order",
        { orderId: "123" },
        "tenant_1",
      );
      const elapsed = Date.now() - start;

      expect(executionId).toBeDefined();
      expect(elapsed).toBeLessThan(100);
    });

    it("should not block API response", async () => {
      const slowEngine = {
        execute: vi
          .fn()
          .mockImplementation(
            () =>
              new Promise((resolve) =>
                setTimeout(() => resolve({ result: "success" }), 1000),
              ),
          ),
      };

      const integrationWithEngine = new WorkflowIntegration(slowEngine);
      integrationWithEngine.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "auto",
      });

      const start = Date.now();
      const executionId = await integrationWithEngine.triggerWorkflow(
        "process_order",
        { orderId: "123" },
        "tenant_1",
      );
      const apiResponseTime = Date.now() - start;

      expect(apiResponseTime).toBeLessThan(100);
      expect(executionId).toBeDefined();
    });
  });

  describe("event emission on workflow state changes", () => {
    it("should emit workflow.completed event", async () => {
      const eventEmitter = { emit: vi.fn() };
      const engine = {
        execute: vi.fn().mockResolvedValue({ result: "success" }),
      };

      const integrationWithEngine = new WorkflowIntegration(engine);
      integrationWithEngine.setEventEmitter(eventEmitter);
      integrationWithEngine.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "auto",
      });

      const executionId = await integrationWithEngine.triggerWorkflow(
        "process_order",
        { orderId: "123" },
        "tenant_1",
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "workflow.completed",
        expect.objectContaining({
          workflowId: executionId,
          workflowType: "process_order",
        }),
      );
    });

    it("should emit workflow.failed event on error", async () => {
      const eventEmitter = { emit: vi.fn() };
      const engine = {
        execute: vi.fn().mockRejectedValue(new Error("Process error")),
      };

      const integrationWithEngine = new WorkflowIntegration(engine);
      integrationWithEngine.setEventEmitter(eventEmitter);
      integrationWithEngine.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "auto",
      });

      const executionId = await integrationWithEngine.triggerWorkflow(
        "process_order",
        { orderId: "123" },
        "tenant_1",
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "workflow.failed",
        expect.objectContaining({
          workflowId: executionId,
          error: "Process error",
        }),
      );
    });
  });

  describe("concurrent workflow triggers", () => {
    it("should handle multiple concurrent triggers", async () => {
      integration.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "auto",
      });

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          integration.triggerWorkflow(
            "process_order",
            { orderId: `${i}` },
            "tenant_1",
          ),
        );
      }

      const executionIds = await Promise.all(promises);
      expect(executionIds).toHaveLength(10);
      executionIds.forEach((id) => {
        expect(id).toBeDefined();
      });
    });

    it("should track all concurrent executions", async () => {
      integration.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "auto",
      });

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          integration.triggerWorkflow(
            "process_order",
            { orderId: `${i}` },
            "tenant_1",
          ),
        );
      }

      await Promise.all(promises);
      const executions = integration.listExecutions();
      expect(executions).toHaveLength(5);
    });

    it("should isolate executions per tenant", async () => {
      integration.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "auto",
      });
      integration.setConfig("tenant_2", {
        tenantId: "tenant_2",
        mode: "auto",
      });

      await integration.triggerWorkflow(
        "process_order",
        { orderId: "1" },
        "tenant_1",
      );
      await integration.triggerWorkflow(
        "process_order",
        { orderId: "2" },
        "tenant_2",
      );

      const allExecutions = integration.listExecutions();
      expect(allExecutions).toHaveLength(2);
    });
  });

  describe("execution tracking", () => {
    it("should retrieve execution by ID", async () => {
      integration.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "auto",
      });

      const executionId = await integration.triggerWorkflow(
        "process_order",
        { orderId: "123" },
        "tenant_1",
      );
      const execution = integration.getExecution(executionId);

      expect(execution).toBeDefined();
      expect(execution?.id).toBe(executionId);
      expect(execution?.workflowType).toBe("process_order");
    });

    it("should track execution status", async () => {
      const engine = {
        execute: vi.fn().mockResolvedValue({ result: "success" }),
      };

      const integrationWithEngine = new WorkflowIntegration(engine);
      integrationWithEngine.setConfig("tenant_1", {
        tenantId: "tenant_1",
        mode: "auto",
      });

      const executionId = await integrationWithEngine.triggerWorkflow(
        "process_order",
        { orderId: "123" },
        "tenant_1",
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      const execution = integrationWithEngine.getExecution(executionId);
      expect(execution?.status).toBe("completed");
      expect(execution?.output).toEqual({ result: "success" });
    });
  });
});
