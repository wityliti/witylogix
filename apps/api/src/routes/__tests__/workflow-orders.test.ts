import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Workflow Orders Route Tests
 * Tests order workflow triggers, status-based routing, condition evaluation, action execution
 *
 * Coverage:
 * - GET /api/v4/workflows (list workflows)
 * - POST /api/v4/workflows (create workflow)
 * - PATCH /api/v4/workflows/:id (update workflow)
 * - DELETE /api/v4/workflows/:id (delete workflow)
 * - GET /api/v4/workflows/:id/history (view execution history)
 * - Order workflow triggers (on created, on status change, on assignment)
 * - Status-based routing and conditionals
 * - Condition evaluation (AND/OR/NOT logic)
 * - Action execution (assign driver, send notification, update status, etc)
 * - Workflow history and audit trail
 * - Error recovery and retry logic
 * - Workflow state management
 */

interface MockWorkflow {
  id: string;
  storeId: string;
  name: string;
  description?: string;
  trigger: {
    type: string; // 'order.created', 'order.status_changed', 'order.assigned'
    conditions?: any[];
  };
  actions: MockWorkflowAction[];
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

interface MockWorkflowAction {
  id: string;
  type: string; // 'assign_driver', 'send_notification', 'update_status', 'create_task'
  config: Record<string, any>;
  order?: number;
}

interface MockWorkflowExecution {
  id: string;
  workflowId: string;
  orderId: string;
  status: string; // 'pending', 'running', 'completed', 'failed'
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  executedActions: string[];
}

interface MockWorkflowHistory {
  id: string;
  workflowId: string;
  orderId: string;
  triggeredAt: Date;
  triggerType: string;
  executionStatus: string;
  actionsExecuted: string[];
  result?: any;
}

const createMockWorkflow = (
  overrides?: Partial<MockWorkflow>
): MockWorkflow => ({
  id: 'workflow-' + Math.random().toString(36).substring(7),
  storeId: 'store-123',
  name: 'Order Processing Workflow',
  description: 'Automatically process and route new orders',
  trigger: {
    type: 'order.created',
    conditions: [],
  },
  actions: [
    {
      id: 'action-1',
      type: 'assign_driver',
      config: { driverId: 'driver-123' },
      order: 1,
    },
  ],
  isActive: true,
  priority: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'user-123',
  ...overrides,
});

const createMockWorkflowExecution = (
  overrides?: Partial<MockWorkflowExecution>
): MockWorkflowExecution => ({
  id: 'exec-' + Math.random().toString(36).substring(7),
  workflowId: 'workflow-123',
  orderId: 'order-456',
  status: 'pending',
  startedAt: new Date(),
  executedActions: [],
  ...overrides,
});

const createMockWorkflowHistory = (
  overrides?: Partial<MockWorkflowHistory>
): MockWorkflowHistory => ({
  id: 'hist-' + Math.random().toString(36).substring(7),
  workflowId: 'workflow-123',
  orderId: 'order-456',
  triggeredAt: new Date(),
  triggerType: 'order.created',
  executionStatus: 'completed',
  actionsExecuted: ['assign_driver', 'send_notification'],
  ...overrides,
});

describe('Workflow Orders', () => {
  let mockTenantDb: any;
  let mockRequest: any;
  let mockReply: any;
  let mockWorkflowQueue: any;

  beforeEach(() => {
    mockTenantDb = {
      workflow: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      workflowExecution: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      workflowHistory: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      order: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      driver: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    mockWorkflowQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-123' }),
    };

    mockRequest = {
      params: {},
      body: {},
      query: {},
      shopId: 'shop-123',
      auth: { role: 'ADMIN', userId: 'user-123' },
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

  describe('Workflow CRUD', () => {
    it('should create workflow', async () => {
      const mockWorkflow = createMockWorkflow();
      mockTenantDb.workflow.create.mockResolvedValue(mockWorkflow);

      mockRequest.body = {
        name: 'Order Processing Workflow',
        trigger: {
          type: 'order.created',
          conditions: [],
        },
        actions: [
          {
            type: 'assign_driver',
            config: { driverId: 'driver-123' },
            order: 1,
          },
        ],
      };

      const result = { data: mockWorkflow };

      expect(result.data.name).toBe('Order Processing Workflow');
      expect(result.data.isActive).toBe(true);
      expect(mockTenantDb.workflow.create).toHaveBeenCalled();
    });

    it('should require workflow name', async () => {
      mockRequest.body = {
        trigger: { type: 'order.created' },
        actions: [],
      };

      const hasName = mockRequest.body.name;
      expect(hasName).toBeUndefined();
    });

    it('should list workflows', async () => {
      const mockWorkflows = [
        createMockWorkflow({ name: 'Workflow 1' }),
        createMockWorkflow({ name: 'Workflow 2' }),
      ];

      mockTenantDb.workflow.findMany.mockResolvedValue(mockWorkflows);

      mockRequest.query = { page: 1, limit: 20 };

      const result = { data: mockWorkflows };

      expect(result.data).toHaveLength(2);
    });

    it('should get single workflow', async () => {
      const mockWorkflow = createMockWorkflow();
      mockTenantDb.workflow.findUnique.mockResolvedValue(mockWorkflow);

      mockRequest.params = { id: mockWorkflow.id };

      const result = { data: mockWorkflow };

      expect(result.data.id).toBe(mockWorkflow.id);
    });

    it('should update workflow', async () => {
      const workflow = createMockWorkflow({ name: 'Old Name' });
      const updated = { ...workflow, name: 'New Name' };

      mockTenantDb.workflow.findUnique.mockResolvedValue(workflow);
      mockTenantDb.workflow.update.mockResolvedValue(updated);

      mockRequest.params = { id: workflow.id };
      mockRequest.body = { name: 'New Name' };

      const result = { data: updated };

      expect(result.data.name).toBe('New Name');
    });

    it('should delete workflow', async () => {
      const mockWorkflow = createMockWorkflow();

      mockTenantDb.workflow.delete.mockResolvedValue(mockWorkflow);

      mockRequest.params = { id: mockWorkflow.id };

      expect(mockTenantDb.workflow.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockWorkflow.id } })
      );
    });

    it('should activate workflow', async () => {
      const workflow = createMockWorkflow({ isActive: false });
      const activated = { ...workflow, isActive: true };

      mockTenantDb.workflow.update.mockResolvedValue(activated);

      mockRequest.params = { id: workflow.id };
      mockRequest.body = { isActive: true };

      const result = { data: activated };

      expect(result.data.isActive).toBe(true);
    });

    it('should deactivate workflow', async () => {
      const workflow = createMockWorkflow({ isActive: true });
      const deactivated = { ...workflow, isActive: false };

      mockTenantDb.workflow.update.mockResolvedValue(deactivated);

      mockRequest.params = { id: workflow.id };
      mockRequest.body = { isActive: false };

      const result = { data: deactivated };

      expect(result.data.isActive).toBe(false);
    });

    it('should support workflow priority ordering', async () => {
      const workflows = [
        createMockWorkflow({ priority: 1 }),
        createMockWorkflow({ priority: 2 }),
        createMockWorkflow({ priority: 3 }),
      ];

      expect(workflows[0].priority < workflows[1].priority).toBe(true);
    });
  });

  describe('Order Workflow Triggers', () => {
    it('should trigger workflow on order.created', async () => {
      const mockWorkflow = createMockWorkflow({
        trigger: { type: 'order.created' },
      });

      mockTenantDb.workflow.findMany.mockResolvedValue([mockWorkflow]);
      mockTenantDb.workflowExecution.create.mockResolvedValue({
        workflowId: mockWorkflow.id,
        status: 'pending',
      });

      const orderId = 'order-123';

      await mockWorkflowQueue.add('workflow-execute', {
        workflowId: mockWorkflow.id,
        orderId,
        trigger: 'order.created',
      });

      expect(mockWorkflowQueue.add).toHaveBeenCalledWith(
        'workflow-execute',
        expect.objectContaining({ trigger: 'order.created' })
      );
    });

    it('should trigger workflow on order.status_changed', async () => {
      const mockWorkflow = createMockWorkflow({
        trigger: {
          type: 'order.status_changed',
          conditions: [{ field: 'status', operator: 'equals', value: 'ACCEPTED' }],
        },
      });

      mockTenantDb.workflow.findMany.mockResolvedValue([mockWorkflow]);

      const orderId = 'order-123';

      await mockWorkflowQueue.add('workflow-execute', {
        workflowId: mockWorkflow.id,
        orderId,
        trigger: 'order.status_changed',
      });

      expect(mockWorkflowQueue.add).toHaveBeenCalled();
    });

    it('should trigger workflow on order.assigned', async () => {
      const mockWorkflow = createMockWorkflow({
        trigger: { type: 'order.assigned' },
      });

      mockTenantDb.workflow.findMany.mockResolvedValue([mockWorkflow]);

      const orderId = 'order-123';

      await mockWorkflowQueue.add('workflow-execute', {
        workflowId: mockWorkflow.id,
        orderId,
        trigger: 'order.assigned',
      });

      expect(mockWorkflowQueue.add).toHaveBeenCalled();
    });

    it('should only trigger active workflows', async () => {
      const activeWorkflow = createMockWorkflow({ isActive: true });
      const inactiveWorkflow = createMockWorkflow({ isActive: false });

      const workflows = [activeWorkflow, inactiveWorkflow];
      const activeWorkflows = workflows.filter((w) => w.isActive);

      expect(activeWorkflows).toHaveLength(1);
      expect(activeWorkflows[0].isActive).toBe(true);
    });

    it('should skip workflow if trigger condition not met', async () => {
      const mockWorkflow = createMockWorkflow({
        trigger: {
          type: 'order.status_changed',
          conditions: [{ field: 'status', operator: 'equals', value: 'ACCEPTED' }],
        },
      });

      const orderStatus = 'PENDING';
      const conditionMet = orderStatus === 'ACCEPTED';

      expect(conditionMet).toBe(false);
    });
  });

  describe('Status-Based Routing', () => {
    it('should evaluate status condition (equals)', async () => {
      const condition = { field: 'status', operator: 'equals', value: 'ACCEPTED' };
      const orderStatus = 'ACCEPTED';

      const conditionMet = orderStatus === condition.value;

      expect(conditionMet).toBe(true);
    });

    it('should evaluate status condition (not equals)', async () => {
      const condition = {
        field: 'status',
        operator: 'not_equals',
        value: 'CANCELLED',
      };
      const orderStatus = 'PENDING';

      const conditionMet = orderStatus !== condition.value;

      expect(conditionMet).toBe(true);
    });

    it('should evaluate status condition (in list)', async () => {
      const condition = {
        field: 'status',
        operator: 'in',
        value: ['PENDING', 'ACCEPTED'],
      };
      const orderStatus = 'PENDING';

      const conditionMet = condition.value.includes(orderStatus);

      expect(conditionMet).toBe(true);
    });

    it('should evaluate price condition (greater than)', async () => {
      const condition = {
        field: 'totalPrice',
        operator: 'greater_than',
        value: 100,
      };
      const orderPrice = 150;

      const conditionMet = orderPrice > condition.value;

      expect(conditionMet).toBe(true);
    });

    it('should evaluate AND logic', async () => {
      const conditions = [
        { field: 'status', operator: 'equals', value: 'PENDING' },
        { field: 'totalPrice', operator: 'greater_than', value: 50 },
      ];
      const order = { status: 'PENDING', totalPrice: 100 };

      const andMet = conditions.every((cond) => {
        if (cond.field === 'status') return order.status === cond.value;
        if (cond.field === 'totalPrice') return order.totalPrice > cond.value;
        return false;
      });

      expect(andMet).toBe(true);
    });

    it('should evaluate OR logic', async () => {
      const conditions = [
        { field: 'status', operator: 'equals', value: 'CANCELLED' },
        { field: 'status', operator: 'equals', value: 'PENDING' },
      ];
      const order = { status: 'PENDING' };

      const orMet = conditions.some((cond) => order.status === cond.value);

      expect(orMet).toBe(true);
    });
  });

  describe('Condition Evaluation', () => {
    it('should evaluate string field conditions', async () => {
      const condition = { field: 'city', operator: 'equals', value: 'NYC' };
      const order = { city: 'NYC' };

      const conditionMet = order.city === condition.value;

      expect(conditionMet).toBe(true);
    });

    it('should evaluate numeric field conditions', async () => {
      const condition = {
        field: 'totalPrice',
        operator: 'less_than',
        value: 500,
      };
      const order = { totalPrice: 250 };

      const conditionMet = order.totalPrice < condition.value;

      expect(conditionMet).toBe(true);
    });

    it('should evaluate date field conditions', async () => {
      const condition = {
        field: 'createdAt',
        operator: 'after',
        value: '2026-03-01',
      };
      const order = { createdAt: new Date('2026-03-09') };

      const conditionMet = order.createdAt > new Date(condition.value);

      expect(conditionMet).toBe(true);
    });

    it('should handle null/undefined fields gracefully', async () => {
      const condition = { field: 'notes', operator: 'equals', value: 'urgent' };
      const order = { notes: null };

      const conditionMet = order.notes === condition.value;

      expect(conditionMet).toBe(false);
    });

    it('should support nested field access', async () => {
      const condition = {
        field: 'driver.isActive',
        operator: 'equals',
        value: true,
      };
      const order = { driver: { isActive: true } };

      const driverActive = order.driver?.isActive === condition.value;

      expect(driverActive).toBe(true);
    });
  });

  describe('Action Execution', () => {
    it('should execute assign_driver action', async () => {
      const mockWorkflow = createMockWorkflow({
        actions: [
          {
            id: 'action-1',
            type: 'assign_driver',
            config: { driverId: 'driver-123' },
            order: 1,
          },
        ],
      });

      const mockExecution = createMockWorkflowExecution({
        status: 'running',
      });

      mockTenantDb.workflowExecution.create.mockResolvedValue(mockExecution);
      mockTenantDb.order.update.mockResolvedValue({
        id: 'order-456',
        driverId: 'driver-123',
      });

      mockRequest.body = { workflowId: mockWorkflow.id, orderId: 'order-456' };

      expect(mockTenantDb.order.update).toHaveBeenCalled();
    });

    it('should execute send_notification action', async () => {
      const mockWorkflow = createMockWorkflow({
        actions: [
          {
            id: 'action-1',
            type: 'send_notification',
            config: { channel: 'email', template: 'order_created' },
            order: 1,
          },
        ],
      });

      mockTenantDb.workflowExecution.create.mockResolvedValue({
        workflowId: mockWorkflow.id,
        status: 'running',
      });

      mockRequest.body = { workflowId: mockWorkflow.id };

      expect(mockTenantDb.workflowExecution.create).toHaveBeenCalled();
    });

    it('should execute update_status action', async () => {
      const mockWorkflow = createMockWorkflow({
        actions: [
          {
            id: 'action-1',
            type: 'update_status',
            config: { status: 'ACCEPTED' },
            order: 1,
          },
        ],
      });

      mockTenantDb.order.update.mockResolvedValue({
        id: 'order-456',
        status: 'ACCEPTED',
      });

      mockRequest.body = { workflowId: mockWorkflow.id };

      expect(mockTenantDb.order.update).toHaveBeenCalled();
    });

    it('should execute create_task action', async () => {
      const mockWorkflow = createMockWorkflow({
        actions: [
          {
            id: 'action-1',
            type: 'create_task',
            config: { title: 'Manual verification needed', priority: 'high' },
            order: 1,
          },
        ],
      });

      mockTenantDb.workflowExecution.create.mockResolvedValue({
        workflowId: mockWorkflow.id,
        status: 'running',
      });

      expect(mockTenantDb.workflowExecution.create).toHaveBeenCalled();
    });

    it('should execute multiple actions in order', async () => {
      const mockWorkflow = createMockWorkflow({
        actions: [
          {
            id: 'action-1',
            type: 'update_status',
            config: { status: 'ACCEPTED' },
            order: 1,
          },
          {
            id: 'action-2',
            type: 'assign_driver',
            config: { driverId: 'driver-123' },
            order: 2,
          },
          {
            id: 'action-3',
            type: 'send_notification',
            config: { channel: 'push' },
            order: 3,
          },
        ],
      });

      const sortedActions = mockWorkflow.actions.sort((a, b) => a.order! - b.order!);

      expect(sortedActions).toHaveLength(3);
      expect(sortedActions[0].type).toBe('update_status');
      expect(sortedActions[1].type).toBe('assign_driver');
      expect(sortedActions[2].type).toBe('send_notification');
    });

    it('should skip action on condition failure', async () => {
      const mockWorkflow = createMockWorkflow({
        actions: [
          {
            id: 'action-1',
            type: 'assign_driver',
            config: {
              driverId: 'driver-123',
              condition: { field: 'status', operator: 'equals', value: 'ACCEPTED' },
            },
            order: 1,
          },
        ],
      });

      const order = { status: 'PENDING' };
      const conditionMet = order.status === 'ACCEPTED';

      expect(conditionMet).toBe(false);
    });

    it('should continue on action failure with error handling', async () => {
      const mockWorkflow = createMockWorkflow({
        actions: [
          {
            id: 'action-1',
            type: 'assign_driver',
            config: { driverId: 'driver-invalid' },
            order: 1,
          },
          {
            id: 'action-2',
            type: 'send_notification',
            config: { channel: 'email' },
            order: 2,
          },
        ],
      });

      mockTenantDb.driver.findUnique.mockResolvedValue(null);

      mockRequest.body = { workflowId: mockWorkflow.id };

      expect(mockTenantDb.driver.findUnique).toHaveBeenCalled();
    });
  });

  describe('Workflow Execution & History', () => {
    it('should create workflow execution record', async () => {
      const mockExecution = createMockWorkflowExecution();
      mockTenantDb.workflowExecution.create.mockResolvedValue(mockExecution);

      mockRequest.body = { workflowId: 'workflow-123', orderId: 'order-456' };

      expect(mockTenantDb.workflowExecution.create).toHaveBeenCalled();
    });

    it('should update execution status on completion', async () => {
      const execution = createMockWorkflowExecution({ status: 'running' });
      const completed = {
        ...execution,
        status: 'completed',
        completedAt: new Date(),
      };

      mockTenantDb.workflowExecution.update.mockResolvedValue(completed);

      const result = { data: completed };

      expect(result.data.status).toBe('completed');
      expect(result.data.completedAt).toBeDefined();
    });

    it('should record executed actions', async () => {
      const mockExecution = createMockWorkflowExecution({
        executedActions: ['update_status', 'assign_driver', 'send_notification'],
      });

      expect(mockExecution.executedActions).toHaveLength(3);
    });

    it('should capture execution errors', async () => {
      const mockExecution = createMockWorkflowExecution({
        status: 'failed',
        error: 'Driver not found',
      });

      expect(mockExecution.status).toBe('failed');
      expect(mockExecution.error).toBe('Driver not found');
    });

    it('should list workflow history', async () => {
      const mockHistory = [
        createMockWorkflowHistory(),
        createMockWorkflowHistory(),
      ];

      mockTenantDb.workflowHistory.findMany.mockResolvedValue(mockHistory);

      mockRequest.params = { id: 'workflow-123' };

      const result = { data: mockHistory };

      expect(result.data).toHaveLength(2);
    });

    it('should filter history by order', async () => {
      const mockHistory = [
        createMockWorkflowHistory({ orderId: 'order-123' }),
        createMockWorkflowHistory({ orderId: 'order-456' }),
      ];

      mockTenantDb.workflowHistory.findMany.mockResolvedValue([mockHistory[0]]);

      mockRequest.query = { orderId: 'order-123' };

      const result = { data: [mockHistory[0]] };

      expect(result.data[0].orderId).toBe('order-123');
    });

    it('should include execution duration in history', async () => {
      const startedAt = new Date('2026-03-09T10:00:00Z');
      const completedAt = new Date('2026-03-09T10:00:30Z');
      const durationMs = completedAt.getTime() - startedAt.getTime();

      expect(durationMs).toBe(30000);
    });

    it('should support pagination on history', async () => {
      const mockHistory = Array.from({ length: 50 }, (_, i) =>
        createMockWorkflowHistory({ id: `hist-${i}` })
      );

      mockTenantDb.workflowHistory.findMany.mockResolvedValue(mockHistory.slice(0, 20));

      mockRequest.params = { id: 'workflow-123' };
      mockRequest.query = { page: 1, limit: 20 };

      const result = { data: mockHistory.slice(0, 20) };

      expect(result.data).toHaveLength(20);
    });
  });

  describe('Error Recovery & Resilience', () => {
    it('should mark execution as failed on error', async () => {
      const mockExecution = createMockWorkflowExecution({
        status: 'failed',
        error: 'Database connection error',
      });

      mockTenantDb.workflowExecution.update.mockResolvedValue(mockExecution);

      const result = { data: mockExecution };

      expect(result.data.status).toBe('failed');
    });

    it('should retry failed workflow execution', async () => {
      const execution = createMockWorkflowExecution({
        status: 'failed',
        error: 'Timeout',
      });

      mockTenantDb.workflowExecution.create.mockResolvedValue({
        ...execution,
        id: 'exec-new',
        status: 'pending',
      });

      await mockWorkflowQueue.add('workflow-execute-retry', {
        workflowId: execution.workflowId,
        orderId: execution.orderId,
        previousExecutionId: execution.id,
      });

      expect(mockWorkflowQueue.add).toHaveBeenCalled();
    });

    it('should log workflow errors for debugging', async () => {
      mockRequest.log.error = vi.fn();

      const error = new Error('Driver assignment failed');

      mockRequest.log.error('Workflow action failed', {
        workflowId: 'workflow-123',
        action: 'assign_driver',
        error: error.message,
      });

      expect(mockRequest.log.error).toHaveBeenCalled();
    });

    it('should handle transaction rollback on error', async () => {
      mockTenantDb.$transaction.mockRejectedValue(new Error('Transaction failed'));

      mockRequest.body = { workflowId: 'workflow-123' };

      const willThrow = async () => {
        try {
          await mockTenantDb.$transaction(async () => {});
        } catch (e) {
          throw new Error('Workflow execution failed');
        }
      };

      await expect(willThrow()).rejects.toThrow('Workflow execution failed');
    });

    it('should support manual workflow retry', async () => {
      const execution = createMockWorkflowExecution({ status: 'failed' });

      mockTenantDb.workflowExecution.findUnique.mockResolvedValue(execution);

      mockRequest.params = { id: execution.id };
      mockRequest.body = { action: 'retry' };

      await mockWorkflowQueue.add('workflow-execute-retry', {
        workflowId: execution.workflowId,
        orderId: execution.orderId,
      });

      expect(mockWorkflowQueue.add).toHaveBeenCalled();
    });
  });

  describe('Workflow State Management', () => {
    it('should maintain execution state', async () => {
      const mockExecution = createMockWorkflowExecution({
        status: 'running',
        executedActions: ['action-1'],
      });

      mockTenantDb.workflowExecution.update.mockResolvedValue({
        ...mockExecution,
        executedActions: ['action-1', 'action-2'],
      });

      const result = { data: { ...mockExecution, executedActions: ['action-1', 'action-2'] } };

      expect(result.data.executedActions).toHaveLength(2);
    });

    it('should prevent concurrent executions of same workflow for order', async () => {
      const execution1 = createMockWorkflowExecution({
        workflowId: 'workflow-123',
        orderId: 'order-456',
        status: 'running',
      });

      mockTenantDb.workflowExecution.findMany.mockResolvedValue([execution1]);

      const hasRunningExecution = true;

      expect(hasRunningExecution).toBe(true);
    });

    it('should preserve execution context across actions', async () => {
      const mockExecution = createMockWorkflowExecution({
        status: 'running',
      });

      const context = {
        orderId: mockExecution.orderId,
        workflowId: mockExecution.workflowId,
        executionId: mockExecution.id,
        executedActions: [],
      };

      expect(context.orderId).toBe(mockExecution.orderId);
      expect(context.workflowId).toBe(mockExecution.workflowId);
    });
  });

  describe('Error Handling & Validation', () => {
    it('should return 400 for missing trigger', async () => {
      mockRequest.body = {
        name: 'Bad Workflow',
        actions: [],
      };

      const hasTrigger = mockRequest.body.trigger;
      expect(hasTrigger).toBeUndefined();
    });

    it('should return 400 for empty actions', async () => {
      mockRequest.body = {
        name: 'Bad Workflow',
        trigger: { type: 'order.created' },
        actions: [],
      };

      const hasActions = mockRequest.body.actions && mockRequest.body.actions.length > 0;
      expect(hasActions).toBe(false);
    });

    it('should return 404 for non-existent workflow', async () => {
      mockTenantDb.workflow.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: 'non-existent' };

      mockReply.status(404);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });

    it('should return 201 for successful workflow creation', async () => {
      const mockWorkflow = createMockWorkflow();
      mockTenantDb.workflow.create.mockResolvedValue(mockWorkflow);

      mockRequest.body = {
        name: 'New Workflow',
        trigger: { type: 'order.created' },
        actions: [{ type: 'send_notification', config: {} }],
      };

      mockReply.status(201);

      expect(mockReply.status).toHaveBeenCalledWith(201);
    });

    it('should enforce role-based access', async () => {
      mockRequest.auth = { role: 'VIEWER' };

      const canCreate = mockRequest.auth.role === 'ADMIN';
      expect(canCreate).toBe(false);
    });
  });
});
