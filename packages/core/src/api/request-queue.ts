/**
 * Request Queue — Priority-based queue for handling request bursts.
 *
 * Manages incoming requests with priority levels and queue size limits:
 * - Priority levels: critical (0) > high (1) > normal (2) > low (3)
 * - FIFO ordering within priority level
 * - Max queue size per tenant (configurable)
 * - Request timeout: queued requests expire after 30s
 * - Queue metrics: size, wait time, drop rate
 *
 * Usage:
 *   const queue = new RequestQueue();
 *   const task = queue.enqueue(handler, 'tenant-1', 'normal');
 *   const result = await task;
 */

type RequestPriority = "critical" | "high" | "normal" | "low";

interface QueuedRequest<T> {
  id: string;
  handler: () => Promise<T>;
  tenantId: string;
  priority: RequestPriority;
  enqueuedAt: number;
  timeout: number; // milliseconds
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
  timeoutHandle?: NodeJS.Timeout;
}

interface QueueMetrics {
  totalEnqueued: number;
  totalProcessed: number;
  totalDropped: number;
  currentSize: number;
  averageWaitTime: number; // milliseconds
  maxWaitTime: number; // milliseconds
  queueFullCount: number;
}

interface TenantQueueStats {
  tenantId: string;
  currentSize: number;
  criticalCount: number;
  highCount: number;
  normalCount: number;
  lowCount: number;
}

/**
 * Priority queue for request management.
 */
export class RequestQueue {
  private queues: Map<RequestPriority, QueuedRequest<any>[]> = new Map([
    ["critical", []],
    ["high", []],
    ["normal", []],
    ["low", []],
  ]);

  private maxQueueSize: number;
  private tenantQueueLimits: Map<string, number>;
  private metrics: QueueMetrics = {
    totalEnqueued: 0,
    totalProcessed: 0,
    totalDropped: 0,
    currentSize: 0,
    averageWaitTime: 0,
    maxWaitTime: 0,
    queueFullCount: 0,
  };

  private waitTimes: number[] = [];
  private maxWaitTimeHistory: number = 1000;
  private requestIdCounter: number = 0;
  private isProcessing: boolean = false;
  private defaultTimeout: number = 30000; // 30 seconds

  constructor(
    maxQueueSize: number = 10000,
    tenantQueueLimits: Map<string, number> = new Map(),
  ) {
    this.maxQueueSize = maxQueueSize;
    this.tenantQueueLimits = tenantQueueLimits;
  }

  /**
   * Enqueue a request handler.
   */
  enqueue<T>(
    handler: () => Promise<T>,
    tenantId: string,
    priority: RequestPriority = "normal",
    timeout: number = this.defaultTimeout,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Check queue size limits
      if (!this.canEnqueue(tenantId)) {
        this.metrics.queueFullCount++;
        this.metrics.totalDropped++;
        reject(new Error("Queue is full: request dropped"));
        return;
      }

      const requestId = this.generateRequestId();
      const enqueuedAt = Date.now();

      const request: QueuedRequest<T> = {
        id: requestId,
        handler,
        tenantId,
        priority,
        enqueuedAt,
        timeout,
        resolve,
        reject,
      };

      // Set timeout for queued request
      request.timeoutHandle = setTimeout(() => {
        this.removeRequest(requestId);
        reject(new Error("Request timeout: queued for " + timeout + "ms"));
      }, timeout);

      // Add to appropriate priority queue
      const priorityQueue = this.queues.get(priority)!;
      priorityQueue.push(request);

      this.metrics.totalEnqueued++;
      this.metrics.currentSize++;

      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Check if a request can be enqueued.
   */
  private canEnqueue(tenantId: string): boolean {
    // Check global queue size
    if (this.metrics.currentSize >= this.maxQueueSize) {
      return false;
    }

    // Check tenant-specific limit
    const tenantLimit = this.tenantQueueLimits.get(tenantId);
    if (tenantLimit) {
      const tenantQueueSize = this.getTenantQueueSize(tenantId);
      if (tenantQueueSize >= tenantLimit) {
        return false;
      }
    }

    return true;
  }

  /**
   * Process queue in priority order.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.metrics.currentSize > 0) {
        // Get next request from highest priority queue
        let request: QueuedRequest<any> | undefined;

        for (const priority of [
          "critical",
          "high",
          "normal",
          "low",
        ] as RequestPriority[]) {
          const queue = this.queues.get(priority)!;
          if (queue.length > 0) {
            request = queue.shift();
            break;
          }
        }

        if (!request) break;

        try {
          // Execute handler
          const result = await request.handler();

          // Record wait time
          const waitTime = Date.now() - request.enqueuedAt;
          this.recordWaitTime(waitTime);

          // Clear timeout
          if (request.timeoutHandle) clearTimeout(request.timeoutHandle);

          // Resolve promise
          request.resolve(result);
          this.metrics.totalProcessed++;
        } catch (error) {
          // Clear timeout
          if (request.timeoutHandle) clearTimeout(request.timeoutHandle);

          // Reject promise
          request.reject(error);
          this.metrics.totalProcessed++;
        } finally {
          this.metrics.currentSize--;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Record wait time and update metrics.
   */
  private recordWaitTime(waitTime: number): void {
    this.waitTimes.push(waitTime);

    if (this.waitTimes.length > this.maxWaitTimeHistory) {
      this.waitTimes = this.waitTimes.slice(-this.maxWaitTimeHistory);
    }

    // Update metrics
    this.metrics.maxWaitTime = Math.max(this.metrics.maxWaitTime, waitTime);
    this.metrics.averageWaitTime =
      this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length;
  }

  /**
   * Remove a request from queue by ID.
   */
  private removeRequest(requestId: string): void {
    for (const queue of this.queues.values()) {
      const index = queue.findIndex((r) => r.id === requestId);
      if (index !== -1) {
        const request = queue[index];
        if (request.timeoutHandle) clearTimeout(request.timeoutHandle);
        queue.splice(index, 1);
        this.metrics.currentSize--;
        break;
      }
    }
  }

  /**
   * Get queue size for specific tenant.
   */
  private getTenantQueueSize(tenantId: string): number {
    let size = 0;
    for (const queue of this.queues.values()) {
      size += queue.filter((r) => r.tenantId === tenantId).length;
    }
    return size;
  }

  /**
   * Generate unique request ID.
   */
  private generateRequestId(): string {
    return "req" + "-" + this.requestIdCounter++ + "-" + Date.now();
  }

  /**
   * Set tenant-specific queue limit.
   */
  setTenantLimit(tenantId: string, limit: number): void {
    this.tenantQueueLimits.set(tenantId, limit);
  }

  /**
   * Get metrics for queue.
   */
  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * Get stats for specific tenant.
   */
  getTenantStats(tenantId: string): TenantQueueStats {
    const stats: TenantQueueStats = {
      tenantId,
      currentSize: 0,
      criticalCount: 0,
      highCount: 0,
      normalCount: 0,
      lowCount: 0,
    };

    for (const [priority, queue] of this.queues) {
      const requests = queue.filter((r) => r.tenantId === tenantId);
      stats.currentSize += requests.length;

      if (priority === "critical") stats.criticalCount = requests.length;
      if (priority === "high") stats.highCount = requests.length;
      if (priority === "normal") stats.normalCount = requests.length;
      if (priority === "low") stats.lowCount = requests.length;
    }

    return stats;
  }

  /**
   * Get all queued requests for tenant.
   */
  getTenantRequests(tenantId: string): QueuedRequest<any>[] {
    const requests: QueuedRequest<any>[] = [];

    for (const queue of this.queues.values()) {
      requests.push(...queue.filter((r) => r.tenantId === tenantId));
    }

    return requests;
  }

  /**
   * Clear queue (for testing/shutdown).
   */
  clear(): void {
    for (const queue of this.queues.values()) {
      for (const request of queue) {
        if (request.timeoutHandle) clearTimeout(request.timeoutHandle);
        request.reject(new Error("Queue cleared"));
      }
      queue.length = 0;
    }

    this.metrics = {
      totalEnqueued: 0,
      totalProcessed: 0,
      totalDropped: 0,
      currentSize: 0,
      averageWaitTime: 0,
      maxWaitTime: 0,
      queueFullCount: 0,
    };
    this.waitTimes = [];
  }

  /**
   * Drain queue and process remaining requests.
   */
  async drain(): Promise<void> {
    while (this.metrics.currentSize > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

export type { RequestPriority, TenantQueueStats, QueueMetrics };
