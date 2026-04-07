/**
 * Abstract Supply Chain Adapter Base Class
 * Provides common interface and infrastructure for multiple WMS/TMS providers.
 * Includes rate limiting, circuit breaker, retry logic, and comprehensive error handling.
 * @packageDocumentation
 */

import { EventEmitter } from 'events';
import type {
  SupplyChainConfig,
  WarehouseLocation,
  InventoryItem,
  InboundShipment,
  OutboundOrder,
  FulfillmentRequest,
  PurchaseOrder,
  TransferOrder,
  ReceiptConfirmation,
  WaveDefinition,
  PickTask,
  PackStation,
  ShipConfirmation,
} from './types';

/**
 * Rate limiter implementation
 * Tracks API call frequency and enforces limits
 */
class RateLimiter {
  private callTimestamps: number[] = [];

  /**
   * Initialize rate limiter
   * @param maxCalls Maximum calls allowed
   * @param windowMs Time window in milliseconds
   */
  constructor(private maxCalls: number, private windowMs: number) {}

  /**
   * Check if call is allowed and update state
   * @returns True if call allowed, false if rate limit exceeded
   */
  public isAllowed(): boolean {
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter((ts) => now - ts < this.windowMs);

    if (this.callTimestamps.length < this.maxCalls) {
      this.callTimestamps.push(now);
      return true;
    }

    return false;
  }

  /**
   * Get time until next call allowed (in ms)
   * @returns Milliseconds to wait
   */
  public getRetryAfter(): number {
    if (this.callTimestamps.length === 0) return 0;
    const oldestCall = this.callTimestamps[0];
    return Math.max(0, oldestCall + this.windowMs - Date.now());
  }
}

/**
 * Circuit breaker implementation
 * Prevents cascading failures by tracking failure rates
 */
class CircuitBreaker {
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half_open' = 'closed';

  /**
   * Initialize circuit breaker
   * @param failureThreshold Consecutive failures to open circuit
   * @param successThreshold Successful calls to close circuit
   * @param resetTimeMs Time before attempting half-open state
   */
  constructor(
    private failureThreshold: number,
    private successThreshold: number,
    private resetTimeMs: number
  ) {}

  /**
   * Get current state
   * @returns Circuit state (closed, open, half_open)
   */
  public getState(): string {
    if (this.state === 'open') {
      const timeSinceFailure = Date.now() - (this.lastFailureTime || 0);
      if (timeSinceFailure > this.resetTimeMs) {
        this.state = 'half_open';
        this.failureCount = 0;
        this.successCount = 0;
      }
    }
    return this.state;
  }

  /**
   * Record successful call
   */
  public recordSuccess(): void {
    this.failureCount = 0;
    this.successCount += 1;

    if (this.state === 'half_open' && this.successCount >= this.successThreshold) {
      this.state = 'closed';
      this.successCount = 0;
    }
  }

  /**
   * Record failed call
   */
  public recordFailure(): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  /**
   * Check if circuit is open
   * @returns True if open (should reject calls)
   */
  public isOpen(): boolean {
    return this.getState() === 'open';
  }
}

/**
 * Retry handler with exponential backoff
 * Manages transient failure recovery
 */
export class RetryHandler {
  /**
   * Execute function with retry logic
   * @param fn Async function to retry
   * @param maxAttempts Maximum retry attempts
   * @param baseDelayMs Base delay before first retry
   * @param maxDelayMs Maximum delay between retries
   * @returns Function result on success
   * @throws Error after all retries exhausted
   */
  public static async execute<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelayMs: number = 1000,
    maxDelayMs: number = 30000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on non-transient errors
        if (!RetryHandler.isTransient(error)) {
          throw error;
        }

        if (attempt < maxAttempts) {
          const delayMs = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
          await RetryHandler.delay(delayMs);
        }
      }
    }

    throw lastError || new Error('Retry exhausted');
  }

  /**
   * Check if error is transient (safe to retry)
   * @param error Error to check
   * @returns True if transient
   */
  private static isTransient(error: unknown): boolean {
    if (error instanceof Error) {
      // Network errors
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT') || error.message.toLowerCase().includes('network')) {
        return true;
      }
      // HTTP 429, 503, 504
      if (error.message.includes('429') || error.message.includes('503') || error.message.includes('504')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Delay execution
   * @param ms Milliseconds to delay
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Abstract base class for supply chain adapters
 * Implements common warehouse operations across all providers
 */
export abstract class SupplyChainAdapter extends EventEmitter {
  protected config: SupplyChainConfig;
  protected rateLimiter: RateLimiter;
  protected circuitBreaker: CircuitBreaker;
  protected requestIdCounter = 0;

  /**
   * Initialize supply chain adapter
   * @param config Supply chain configuration
   */
  constructor(config: SupplyChainConfig) {
    super();
    this.config = config;

    // Initialize rate limiter: 100 calls per minute per provider
    this.rateLimiter = new RateLimiter(100, 60000);

    // Initialize circuit breaker: open after 5 failures, close after 2 successes, reset every 30s
    this.circuitBreaker = new CircuitBreaker(5, 2, 30000);
  }

  /**
   * Initialize adapter connection and authenticate
   * @throws Error if connection fails
   */
  public abstract initialize(): Promise<void>;

  /**
   * Verify adapter connectivity and authentication
   * @returns True if connection successful
   */
  public abstract verifyConnection(): Promise<boolean>;

  // ============================================================================
  // WAREHOUSE OPERATIONS
  // ============================================================================

  /**
   * Get warehouse by ID
   * @param warehouseId Warehouse identifier
   * @returns Warehouse location details
   */
  public abstract getWarehouse(warehouseId: string): Promise<WarehouseLocation>;

  /**
   * List all warehouses accessible via adapter
   * @returns Array of warehouse locations
   */
  public abstract listWarehouses(): Promise<WarehouseLocation[]>;

  /**
   * Create new warehouse location
   * @param warehouse Warehouse data
   * @returns Created warehouse
   */
  public abstract createWarehouse(warehouse: WarehouseLocation): Promise<WarehouseLocation>;

  /**
   * Update warehouse configuration
   * @param warehouseId Warehouse identifier
   * @param updates Partial warehouse updates
   * @returns Updated warehouse
   */
  public abstract updateWarehouse(
    warehouseId: string,
    updates: Partial<WarehouseLocation>
  ): Promise<WarehouseLocation>;

  // ============================================================================
  // INVENTORY MANAGEMENT
  // ============================================================================

  /**
   * Get current inventory for SKU at warehouse
   * @param warehouseId Warehouse identifier
   * @param sku Stock keeping unit
   * @returns Inventory item details
   */
  public abstract getInventory(warehouseId: string, sku: string): Promise<InventoryItem>;

  /**
   * List all inventory items at warehouse
   * @param warehouseId Warehouse identifier
   * @param filters Optional filter criteria
   * @returns Array of inventory items
   */
  public abstract listInventory(
    warehouseId: string,
    filters?: {
      zone?: string;
      status?: string;
      sku?: string;
    }
  ): Promise<InventoryItem[]>;

  /**
   * Real-time inventory sync from provider system
   * Fetches current snapshot
   * @param warehouseId Warehouse identifier
   * @returns Synced inventory array
   */
  public abstract syncInventoryRealTime(warehouseId: string): Promise<InventoryItem[]>;

  /**
   * Batch inventory sync with change tracking
   * Efficiently sync multiple SKUs
   * @param warehouseId Warehouse identifier
   * @param skus Array of SKUs to sync
   * @returns Synced inventory items
   */
  public abstract syncInventoryBatch(warehouseId: string, skus: string[]): Promise<InventoryItem[]>;

  /**
   * Adjust inventory for a SKU
   * @param warehouseId Warehouse identifier
   * @param sku Stock keeping unit
   * @param quantity Quantity adjustment (positive or negative)
   * @param reason Reason for adjustment
   * @returns Updated inventory
   */
  public abstract adjustInventory(
    warehouseId: string,
    sku: string,
    quantity: number,
    reason: string
  ): Promise<InventoryItem>;

  /**
   * Move inventory between locations
   * @param warehouseId Warehouse identifier
   * @param sku Stock keeping unit
   * @param fromBin Source bin location
   * @param toBin Destination bin location
   * @param quantity Quantity to move
   * @returns Updated inventory items
   */
  public abstract moveInventory(
    warehouseId: string,
    sku: string,
    fromBin: string,
    toBin: string,
    quantity: number
  ): Promise<InventoryItem[]>;

  // ============================================================================
  // INBOUND OPERATIONS
  // ============================================================================

  /**
   * Get inbound shipment details
   * @param shipmentId Shipment identifier
   * @returns Inbound shipment
   */
  public abstract getInboundShipment(shipmentId: string): Promise<InboundShipment>;

  /**
   * List inbound shipments by status
   * @param warehouseId Warehouse identifier
   * @param status Filter by shipment status
   * @returns Array of inbound shipments
   */
  public abstract listInboundShipments(
    warehouseId: string,
    status?: string
  ): Promise<InboundShipment[]>;

  /**
   * Create inbound shipment receipt
   * @param shipment Inbound shipment data
   * @returns Created shipment
   */
  public abstract createInboundShipment(shipment: InboundShipment): Promise<InboundShipment>;

  /**
   * Receive inbound shipment at warehouse
   * @param shipmentId Shipment identifier
   * @param receivedItems Item-level receipt confirmation
   * @returns Updated shipment
   */
  public abstract receiveInboundShipment(
    shipmentId: string,
    receivedItems: Array<{
      sku: string;
      quantity: number;
      lotNumber?: string;
    }>
  ): Promise<InboundShipment>;

  /**
   * Confirm quality check on received items
   * @param shipmentId Shipment identifier
   * @param qcPassed Quality control passed flag
   * @param notes QC notes
   * @returns Receipt confirmation
   */
  public abstract confirmQualityCheck(
    shipmentId: string,
    qcPassed: boolean,
    notes?: string
  ): Promise<ReceiptConfirmation>;

  // ============================================================================
  // OUTBOUND OPERATIONS
  // ============================================================================

  /**
   * Get outbound order details
   * @param orderId Order identifier
   * @returns Outbound order
   */
  public abstract getOutboundOrder(orderId: string): Promise<OutboundOrder>;

  /**
   * List outbound orders by status
   * @param warehouseId Warehouse identifier
   * @param status Filter by order status
   * @returns Array of outbound orders
   */
  public abstract listOutboundOrders(
    warehouseId: string,
    status?: string
  ): Promise<OutboundOrder[]>;

  /**
   * Create outbound order
   * @param order Outbound order data
   * @returns Created order
   */
  public abstract createOutboundOrder(order: OutboundOrder): Promise<OutboundOrder>;

  /**
   * Update outbound order
   * @param orderId Order identifier
   * @param updates Partial order updates
   * @returns Updated order
   */
  public abstract updateOutboundOrder(
    orderId: string,
    updates: Partial<OutboundOrder>
  ): Promise<OutboundOrder>;

  /**
   * Cancel outbound order
   * @param orderId Order identifier
   * @param reason Cancellation reason
   * @returns Cancelled order
   */
  public abstract cancelOutboundOrder(orderId: string, reason: string): Promise<OutboundOrder>;

  // ============================================================================
  // FULFILLMENT & ALLOCATION
  // ============================================================================

  /**
   * Get fulfillment request
   * @param fulfillmentId Fulfillment request identifier
   * @returns Fulfillment request
   */
  public abstract getFulfillmentRequest(fulfillmentId: string): Promise<FulfillmentRequest>;

  /**
   * Allocate inventory to order (create fulfillment request)
   * @param orderId Order identifier
   * @param warehouseId Warehouse identifier
   * @param allocationMethod Allocation strategy
   * @returns Created fulfillment request
   */
  public abstract allocateOrder(
    orderId: string,
    warehouseId: string,
    allocationMethod?: 'fifo' | 'closest' | 'random'
  ): Promise<FulfillmentRequest>;

  /**
   * Release fulfillment request to picking
   * @param fulfillmentId Fulfillment request identifier
   * @returns Released fulfillment request
   */
  public abstract releaseFulfillment(fulfillmentId: string): Promise<FulfillmentRequest>;

  /**
   * Update fulfillment status
   * @param fulfillmentId Fulfillment request identifier
   * @param status New status
   * @returns Updated fulfillment request
   */
  public abstract updateFulfillmentStatus(
    fulfillmentId: string,
    status: string
  ): Promise<FulfillmentRequest>;

  // ============================================================================
  // WAVE MANAGEMENT
  // ============================================================================

  /**
   * Get wave definition
   * @param waveId Wave identifier
   * @returns Wave definition
   */
  public abstract getWave(waveId: string): Promise<WaveDefinition>;

  /**
   * List waves by status
   * @param warehouseId Warehouse identifier
   * @param status Wave status filter
   * @returns Array of wave definitions
   */
  public abstract listWaves(warehouseId: string, status?: string): Promise<WaveDefinition[]>;

  /**
   * Create wave from fulfillment requests
   * @param warehouseId Warehouse identifier
   * @param fulfillmentIds Array of fulfillment request IDs
   * @param pickMethod Pick method (zone, batch, order)
   * @returns Created wave
   */
  public abstract createWave(
    warehouseId: string,
    fulfillmentIds: string[],
    pickMethod?: 'zone' | 'batch' | 'order'
  ): Promise<WaveDefinition>;

  /**
   * Release wave to picking operations
   * @param waveId Wave identifier
   * @returns Released wave
   */
  public abstract releaseWave(waveId: string): Promise<WaveDefinition>;

  /**
   * Complete wave operations
   * @param waveId Wave identifier
   * @returns Completed wave
   */
  public abstract completeWave(waveId: string): Promise<WaveDefinition>;

  // ============================================================================
  // PICK/PACK/SHIP WORKFLOW
  // ============================================================================

  /**
   * Get pick task
   * @param taskId Pick task identifier
   * @returns Pick task
   */
  public abstract getPickTask(taskId: string): Promise<PickTask>;

  /**
   * List pick tasks for wave
   * @param waveId Wave identifier
   * @returns Array of pick tasks
   */
  public abstract listPickTasks(waveId: string): Promise<PickTask[]>;

  /**
   * Update pick task progress
   * @param taskId Pick task identifier
   * @param pickedQuantity Quantity actually picked
   * @param status Task status
   * @returns Updated pick task
   */
  public abstract updatePickTask(
    taskId: string,
    pickedQuantity: number,
    status: string
  ): Promise<PickTask>;

  /**
   * Get pack station
   * @param stationId Pack station identifier
   * @returns Pack station
   */
  public abstract getPackStation(stationId: string): Promise<PackStation>;

  /**
   * List pack stations
   * @param warehouseId Warehouse identifier
   * @returns Array of pack stations
   */
  public abstract listPackStations(warehouseId: string): Promise<PackStation[]>;

  /**
   * Confirm shipment and generate ship confirmation
   * @param orderId Order identifier
   * @param carrier Carrier code
   * @param trackingNumber Tracking number
   * @param weight Total weight
   * @returns Ship confirmation
   */
  public abstract confirmShipment(
    orderId: string,
    carrier: string,
    trackingNumber: string,
    weight?: number
  ): Promise<ShipConfirmation>;

  // ============================================================================
  // LOCATION & ZONE MANAGEMENT
  // ============================================================================

  /**
   * Get location/bin details
   * @param warehouseId Warehouse identifier
   * @param binLocation Bin location code
   * @returns Location information
   */
  public abstract getLocation(
    warehouseId: string,
    binLocation: string
  ): Promise<{
    binLocation: string;
    zone: string;
    capacity?: number;
    currentQuantity?: number;
  }>;

  /**
   * List zones in warehouse
   * @param warehouseId Warehouse identifier
   * @returns Array of zone identifiers
   */
  public abstract listZones(warehouseId: string): Promise<string[]>;

  /**
   * Configure zone settings
   * @param warehouseId Warehouse identifier
   * @param zone Zone identifier
   * @param config Zone configuration
   * @returns Updated zone config
   */
  public abstract configureZone(
    warehouseId: string,
    zone: string,
    config: {
      pickMethod?: string;
      packStations?: number;
      capacity?: number;
    }
  ): Promise<Record<string, unknown>>;

  // ============================================================================
  // PURCHASE ORDERS
  // ============================================================================

  /**
   * Get purchase order
   * @param poId Purchase order identifier
   * @returns Purchase order
   */
  public abstract getPurchaseOrder(poId: string): Promise<PurchaseOrder>;

  /**
   * List purchase orders by status
   * @param status PO status filter
   * @returns Array of purchase orders
   */
  public abstract listPurchaseOrders(status?: string): Promise<PurchaseOrder[]>;

  /**
   * Create purchase order
   * @param po Purchase order data
   * @returns Created PO
   */
  public abstract createPurchaseOrder(po: PurchaseOrder): Promise<PurchaseOrder>;

  // ============================================================================
  // TRANSFER ORDERS
  // ============================================================================

  /**
   * Get transfer order
   * @param toId Transfer order identifier
   * @returns Transfer order
   */
  public abstract getTransferOrder(toId: string): Promise<TransferOrder>;

  /**
   * List transfer orders by status
   * @param status TO status filter
   * @returns Array of transfer orders
   */
  public abstract listTransferOrders(status?: string): Promise<TransferOrder[]>;

  /**
   * Create transfer order between warehouses
   * @param to Transfer order data
   * @returns Created transfer order
   */
  public abstract createTransferOrder(to: TransferOrder): Promise<TransferOrder>;

  // ============================================================================
  // PROTECTED UTILITY METHODS
  // ============================================================================

  /**
   * Generate unique request ID for tracking
   * @returns Request ID string
   */
  protected generateRequestId(): string {
    return `${this.config.provider}-${Date.now()}-${++this.requestIdCounter}`;
  }

  /**
   * Check rate limiter and circuit breaker before API call
   * @throws Error if rate limited or circuit open
   */
  protected async checkPrerequisites(): Promise<void> {
    if (!this.rateLimiter.isAllowed()) {
      const retryAfter = this.rateLimiter.getRetryAfter();
      const error = new Error(`Rate limit exceeded. Retry after ${retryAfter}ms`);
      (error as any).retryAfter = retryAfter;
      throw error;
    }

    if (this.circuitBreaker.isOpen()) {
      throw new Error('Circuit breaker is open. Service temporarily unavailable');
    }
  }

  /**
   * Handle API response and update circuit breaker
   * @param success Whether API call succeeded
   * @param error Optional error object
   */
  protected handleApiResponse(success: boolean, error?: Error): void {
    if (success) {
      this.circuitBreaker.recordSuccess();
    } else {
      this.circuitBreaker.recordFailure();
      if (this.config.debug) {
        console.error(`[${this.config.provider}] API error:`, error);
      }
    }
  }

  /**
   * Log event with provider context
   * @param eventName Event name
   * @param data Event data
   */
  protected logEvent(eventName: string, data?: unknown): void {
    const logMessage = {
      timestamp: new Date().toISOString(),
      provider: this.config.provider,
      event: eventName,
      data,
    };

    if (this.config.debug) {
      console.log(`[${this.config.provider}]`, logMessage);
    }

    this.emit(eventName, logMessage);
  }
}
