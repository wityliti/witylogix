/**
 * OfflineQueue - Manages API request queuing when offline
 * Supports conflict resolution and automatic retry on reconnect
 */

export interface QueuedOperation {
  id: string;
  type: "POST" | "PUT" | "PATCH" | "DELETE";
  endpoint: string;
  method: string;
  body: Record<string, any>;
  createdAt: number;
  retryCount: number;
  status: "pending" | "completed" | "failed";
  lastError?: string;
  serverTimestamp?: number;
}

export interface QueueStatus {
  pending: number;
  failed: number;
  total: number;
  lastSyncAt?: number;
}

const STORAGE_KEY = "witylogix_offline_queue";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export class OfflineQueue {
  private queue: Map<string, QueuedOperation> = new Map();
  private isOnline: boolean =
    typeof navigator !== "undefined" ? navigator.onLine : true;
  private syncInProgress: boolean = false;
  private listeners: Set<() => void> = new Set();
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.loadFromStorage();
    this.setupNetworkListeners();
  }

  /**
   * Setup network status detection
   */
  private setupNetworkListeners(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("online", () => {
      this.isOnline = true;
      this.notifyListeners();
      this.processQueue();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.notifyListeners();
    });

    // Polling fallback for network detection
    this.pollInterval = setInterval(() => {
      const wasOnline = this.isOnline;
      this.isOnline = navigator.onLine;
      if (wasOnline !== this.isOnline) {
        this.notifyListeners();
        if (this.isOnline) {
          this.processQueue();
        }
      }
    }, 5000);
  }

  /**
   * Add operation to queue
   */
  enqueue(
    operation: Omit<
      QueuedOperation,
      "id" | "createdAt" | "retryCount" | "status"
    >,
  ): string {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedOp: QueuedOperation = {
      ...operation,
      id,
      createdAt: Date.now(),
      retryCount: 0,
      status: "pending",
    };

    this.queue.set(id, queuedOp);
    this.saveToStorage();
    this.notifyListeners();

    return id;
  }

  /**
   * Process queued operations when online
   */
  async processQueue(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;

    try {
      const pendingOps = Array.from(this.queue.values()).filter(
        (op) => op.status === "pending",
      );

      for (const operation of pendingOps) {
        await this.executeOperation(operation);
        await this.delay(RETRY_DELAY_MS / 2);
      }
    } catch (error) {
      console.error("Error processing queue:", error);
    } finally {
      this.syncInProgress = false;
      this.notifyListeners();
    }
  }

  /**
   * Execute a single operation with retry logic
   */
  private async executeOperation(operation: QueuedOperation): Promise<void> {
    try {
      const response = await fetch(operation.endpoint, {
        method: operation.type,
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(operation.body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      operation.status = "completed";
      operation.serverTimestamp = responseData.timestamp || Date.now();
      this.saveToStorage();
      this.notifyListeners();
    } catch (error) {
      operation.retryCount++;
      operation.lastError =
        error instanceof Error ? error.message : String(error);

      if (operation.retryCount >= MAX_RETRIES) {
        operation.status = "failed";
      } else {
        operation.status = "pending";
      }

      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Get authentication headers (override as needed)
   */
  private getAuthHeaders(): Record<string, string> {
    const token =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("auth_token")
        : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Retry failed operations
   */
  async retryFailed(): Promise<void> {
    const failedOps = Array.from(this.queue.values()).filter(
      (op) => op.status === "failed",
    );

    for (const operation of failedOps) {
      operation.retryCount = 0;
      operation.status = "pending";
    }

    this.saveToStorage();
    this.notifyListeners();

    await this.processQueue();
  }

  /**
   * Get queue status
   */
  getQueueStatus(): QueueStatus {
    const operations = Array.from(this.queue.values());
    const pending = operations.filter((op) => op.status === "pending").length;
    const failed = operations.filter((op) => op.status === "failed").length;
    const total = operations.length;

    return {
      pending,
      failed,
      total,
      lastSyncAt: this.getLastSyncTime(),
    };
  }

  /**
   * Clear completed operations
   */
  clearCompleted(): void {
    const opsToDelete: string[] = [];
    this.queue.forEach((op, id) => {
      if (op.status === "completed") {
        opsToDelete.push(id);
      }
    });

    opsToDelete.forEach((id) => this.queue.delete(id));
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Get operation by ID
   */
  getOperation(id: string): QueuedOperation | undefined {
    return this.queue.get(id);
  }

  /**
   * Get all operations
   */
  getAllOperations(): QueuedOperation[] {
    return Array.from(this.queue.values());
  }

  /**
   * Remove operation from queue
   */
  removeOperation(id: string): void {
    this.queue.delete(id);
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Check if currently online
   */
  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of queue changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Save queue to localStorage
   */
  private saveToStorage(): void {
    if (typeof localStorage === "undefined") return;

    try {
      const data = Array.from(this.queue.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save queue to storage:", error);
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage(): void {
    if (typeof localStorage === "undefined") return;

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const operations = JSON.parse(data) as QueuedOperation[];
        operations.forEach((op) => {
          this.queue.set(op.id, op);
        });
      }
    } catch (error) {
      console.error("Failed to load queue from storage:", error);
    }
  }

  /**
   * Get last sync time
   */
  private getLastSyncTime(): number | undefined {
    let lastSync: number | undefined;
    this.queue.forEach((op) => {
      if (op.status === "completed" && op.serverTimestamp) {
        if (!lastSync || op.serverTimestamp > lastSync) {
          lastSync = op.serverTimestamp;
        }
      }
    });
    return lastSync;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear all data and cleanup
   */
  destroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.listeners.clear();
    this.queue.clear();
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueue();
