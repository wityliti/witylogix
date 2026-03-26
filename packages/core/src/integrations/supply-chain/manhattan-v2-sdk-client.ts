/**
 * Manhattan Active WMS API SDK Client
 *
 * Production-grade implementation with:
 * - OAuth2 + API key authentication
 * - Inbound operations (ASN, receiving, putaway)
 * - Inventory (locations, adjustments, transfers, cycle counts)
 * - Outbound (wave planning, allocation, picking, packing, shipping)
 * - Labor Management (transactions, standards, productivity)
 * - Slotting optimization recommendations
 * - Yard Management (dock doors, appointments)
 * - Billing and financial integration
 * - Webhooks (subscription-based)
 * - Rate limiting (300 req/min)
 * - Exponential backoff retry logic
 */

import type {
  NormalizedWarehouse,
  NormalizedInventory,
  NormalizedOrder,
  NormalizedWave,
  NormalizedShipment,
  WMSConfig,
  InventoryAdjustment,
  InventoryTransfer,
  CycleCount,
  SCWebhookConfig,
  SCWebhookPayload,
  RateLimitInfo,
  PaginatedResponse,
  HealthCheckResult,
  LaborTransaction,
  SlottingRecommendation,
  DockDoor,
  Appointment,
} from './supply-chain-sdk-types.js';

// ─── MANHATTAN SPECIFIC TYPES ──────────────────────────────────────

interface ManhattanAuthConfig {
  clientId: string;
  clientSecret: string;
  apiKey: string;
  tenantId: string;
  apiUrl: string;
}

interface ManhattanASN {
  id: string;
  asnNumber: string;
  warehouseId: string;
  supplierId?: string;
  status: string;
  lines?: Array<{ skuId: string; quantity: number }>;
  expectedArrivalDate?: string;
  createdDate?: string;
}

interface ManhattanReceiptOrder {
  id: string;
  receiptNumber: string;
  asnId?: string;
  warehouseId: string;
  supplierId?: string;
  status: string;
  lines?: Array<{ skuId: string; quantityReceived: number }>;
  createdDate?: string;
}

interface ManhattanLPNDetail {
  id: string;
  lpnNumber: string;
  warehouseId: string;
  location?: string;
  skuId?: string;
  quantity?: number;
  status: string;
  lastActivity?: string;
}

interface ManhattanWaveDetail {
  id: string;
  waveNumber: string;
  warehouseId: string;
  status: string;
  orderCount?: number;
  releaseDate?: string;
  completeDate?: string;
}

interface ManhattanPickList {
  id: string;
  pickListNumber: string;
  waveId: string;
  assignedTo?: string;
  status: string;
  lines?: Array<{
    skuId: string;
    quantity: number;
    locationId?: string;
  }>;
}

interface ManhattanPackDetail {
  id: string;
  packNumber: string;
  pickListId: string;
  status: string;
  shipmentId?: string;
  carton?: { id: string; barcode: string };
}

interface ManhattanShipmentDetail {
  id: string;
  shipmentNumber: string;
  warehouseId: string;
  carrierCode?: string;
  trackingNumber?: string;
  status: string;
  boxes?: Array<{ id: string; cartonId: string }>;
  shippedDate?: string;
}

interface ManhattanLaborTransaction {
  id: string;
  employeeId: string;
  activityCode: string;
  quantity: number;
  durationMinutes?: number;
  timestamp: string;
  warehouseId: string;
}

interface ManhattanSlot {
  id: string;
  skuId: string;
  locationId: string;
  warehouseId: string;
  reason?: string;
  priority?: string;
  createdDate?: string;
}

// ─── RATE LIMITER ───────────────────────────────────────────────────

class RateLimiter {
  private requestTimestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 300, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => now - ts < this.windowMs
    );

    if (this.requestTimestamps.length >= this.maxRequests) {
      const oldestTimestamp = this.requestTimestamps[0] as number;
      const waitTime = this.windowMs - (now - oldestTimestamp);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.acquire();
    }

    this.requestTimestamps.push(now);
  }

  getInfo(): RateLimitInfo {
    const now = Date.now();
    const recentRequests = this.requestTimestamps.filter(
      (ts) => now - ts < this.windowMs
    );
    const remaining = Math.max(0, this.maxRequests - recentRequests.length);

    return {
      remaining,
      limit: this.maxRequests,
      resetAt: new Date(now + this.windowMs),
    };
  }
}

// ─── RETRY HANDLER ──────────────────────────────────────────────────

interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

class RetryHandler {
  private readonly config: RetryConfig;

  constructor(config: RetryConfig) {
    this.config = config;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError =
          error instanceof Error ? error : new Error(String(error));

        const statusCode =
          lastError instanceof Error &&
          'statusCode' in lastError &&
          typeof (lastError as Record<string, unknown>).statusCode === 'number'
            ? ((lastError as Record<string, unknown>).statusCode as number)
            : 500;

        const shouldRetry =
          statusCode >= 500 || statusCode === 429 || statusCode === 408;

        if (!shouldRetry || attempt === this.config.maxAttempts - 1) {
          throw lastError;
        }

        const delay = Math.min(
          this.config.maxDelayMs,
          this.config.initialDelayMs *
            Math.pow(this.config.backoffMultiplier, attempt)
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

// ─── MANHATTAN V2 SDK CLIENT ────────────────────────────────────────

/**
 * Manhattan Active WMS API SDK Client
 */
export class ManhattanV2SDKClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private readonly authConfig: ManhattanAuthConfig;
  private readonly rateLimiter: RateLimiter;
  private readonly retryHandler: RetryHandler;

  constructor(authConfig: ManhattanAuthConfig) {
    this.authConfig = authConfig;
    this.baseUrl = authConfig.apiUrl.replace(/\/$/, '');
    this.rateLimiter = new RateLimiter(300, 60000);
    this.retryHandler = new RetryHandler({
      maxAttempts: 3,
      initialDelayMs: 500,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
    });
  }

  private async ensureAuthenticated(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    return this.authenticate();
  }

  /**
   * Authenticate with Manhattan using OAuth2 + API key
   */
  async authenticate(): Promise<string> {
    return this.retryHandler.execute(async () => {
      await this.rateLimiter.acquire();

      const payload = new URLSearchParams();
      payload.append('grant_type', 'client_credentials');
      payload.append('client_id', this.authConfig.clientId);
      payload.append('client_secret', this.authConfig.clientSecret);

      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-API-Key': this.authConfig.apiKey,
        },
        body: payload.toString(),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
      };

      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

      return this.accessToken;
    });
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    return this.retryHandler.execute(async () => {
      await this.rateLimiter.acquire();

      const token = await this.ensureAuthenticated();
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-API-Key': this.authConfig.apiKey,
        'X-Tenant-ID': this.authConfig.tenantId,
        ...(options.headers as Record<string, string>),
      };

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = new Error(
          `API request failed: ${response.status} ${response.statusText}`
        );
        (error as Record<string, unknown>).statusCode = response.status;
        throw error;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return (await response.json()) as T;
      }

      return response as unknown as T;
    });
  }

  // ─── INBOUND OPERATIONS ─────────────────────────────────────────

  /**
   * Create an Advanced Shipping Notice (ASN)
   */
  async createASN(config: {
    asnNumber: string;
    warehouseId: string;
    supplierId?: string;
    lines: Array<{ skuId: string; quantity: number }>;
    expectedArrivalDate?: string;
  }): Promise<ManhattanASN> {
    const data = (await this.request<ManhattanASN>(`/inbound/asn`, {
      method: 'POST',
      body: JSON.stringify(config),
    })) as ManhattanASN;

    return data;
  }

  /**
   * Get ASN by ID
   */
  async getASN(asnId: string): Promise<ManhattanASN> {
    const data = (await this.request<ManhattanASN>(
      `/inbound/asn/${asnId}`
    )) as ManhattanASN;

    return data;
  }

  /**
   * List ASNs
   */
  async listASNs(options?: {
    warehouseId?: string;
    status?: string;
    limit?: number;
  }): Promise<PaginatedResponse<ManhattanASN>> {
    const params = new URLSearchParams();
    if (options?.warehouseId)
      params.append('warehouseId', options.warehouseId);
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));

    const data = (await this.request<{ items: ManhattanASN[]; totalCount: number }>(
      `/inbound/asn?${params.toString()}`
    )) as { items: ManhattanASN[]; totalCount: number };

    return {
      items: data.items,
      totalCount: data.totalCount,
      pageSize: options?.limit || 25,
      pageNumber: 1,
      hasMore: data.items.length === (options?.limit || 25),
    };
  }

  /**
   * Create a receipt order
   */
  async createReceiptOrder(config: {
    receiptNumber: string;
    asnId?: string;
    warehouseId: string;
    lines: Array<{ skuId: string; quantityReceived: number }>;
  }): Promise<ManhattanReceiptOrder> {
    const data = (await this.request<ManhattanReceiptOrder>(
      `/inbound/receipt`,
      {
        method: 'POST',
        body: JSON.stringify(config),
      }
    )) as ManhattanReceiptOrder;

    return data;
  }

  /**
   * Complete putaway for an LPN
   */
  async completePutaway(
    lpnId: string,
    locationId: string
  ): Promise<{ success: boolean }> {
    await this.request(`/inbound/putaway/${lpnId}`, {
      method: 'POST',
      body: JSON.stringify({ locationId }),
    });

    return { success: true };
  }

  // ─── INVENTORY OPERATIONS ───────────────────────────────────────

  /**
   * Get inventory location
   */
  async getInventoryLocation(
    warehouseId: string,
    locationId: string
  ): Promise<{
    id: string;
    locationId: string;
    capacity: number;
    currentQuantity: number;
  }> {
    const data = (await this.request<{
      id: string;
      locationId: string;
      capacity: number;
      currentQuantity: number;
    }>(`/inventory/locations/${warehouseId}/${locationId}`)) as {
      id: string;
      locationId: string;
      capacity: number;
      currentQuantity: number;
    };

    return data;
  }

  /**
   * Get on-hand inventory
   */
  async getOnHandInventory(
    warehouseId: string,
    skuId: string
  ): Promise<NormalizedInventory> {
    const data = (await this.request<NormalizedInventory>(
      `/inventory/onhand/${warehouseId}/${skuId}`
    )) as NormalizedInventory;

    return data;
  }

  /**
   * Create inventory adjustment
   */
  async createInventoryAdjustment(
    config: InventoryAdjustment
  ): Promise<InventoryAdjustment> {
    const data = (await this.request<InventoryAdjustment>(
      `/inventory/adjustments`,
      {
        method: 'POST',
        body: JSON.stringify(config),
      }
    )) as InventoryAdjustment;

    return data;
  }

  /**
   * Create inventory transfer
   */
  async createInventoryTransfer(
    config: InventoryTransfer
  ): Promise<InventoryTransfer> {
    const data = (await this.request<InventoryTransfer>(
      `/inventory/transfers`,
      {
        method: 'POST',
        body: JSON.stringify(config),
      }
    )) as InventoryTransfer;

    return data;
  }

  /**
   * Create cycle count
   */
  async createCycleCount(config: {
    warehouseId: string;
    locationId?: string;
    countType: string;
  }): Promise<CycleCount> {
    const data = (await this.request<CycleCount>(`/inventory/cycle-counts`, {
      method: 'POST',
      body: JSON.stringify(config),
    })) as CycleCount;

    return data;
  }

  /**
   * Get LPN details
   */
  async getLPNDetails(lpnNumber: string): Promise<ManhattanLPNDetail> {
    const data = (await this.request<ManhattanLPNDetail>(
      `/inventory/lpn/${lpnNumber}`
    )) as ManhattanLPNDetail;

    return data;
  }

  // ─── OUTBOUND OPERATIONS ────────────────────────────────────────

  /**
   * Plan a wave
   */
  async planWave(config: {
    warehouseId: string;
    orderIds: string[];
    shipMethod?: string;
    priority?: string;
  }): Promise<NormalizedWave> {
    const data = (await this.request<ManhattanWaveDetail>(
      `/outbound/waves`,
      {
        method: 'POST',
        body: JSON.stringify(config),
      }
    )) as ManhattanWaveDetail;

    return {
      id: data.id,
      waveNumber: data.waveNumber,
      warehouseId: data.warehouseId,
      status: (data.status as any),
      orders: [],
      orderCount: 0,
      lineCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Release a wave
   */
  async releaseWave(waveId: string): Promise<{ success: boolean }> {
    await this.request(`/outbound/waves/${waveId}/release`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    return { success: true };
  }

  /**
   * Allocate orders in a wave
   */
  async allocateWave(waveId: string): Promise<{ allocatedLines: number }> {
    const data = (await this.request<{ allocatedLines: number }>(
      `/outbound/waves/${waveId}/allocate`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    )) as { allocatedLines: number };

    return data;
  }

  /**
   * Get pick list
   */
  async getPickList(waveId: string): Promise<ManhattanPickList> {
    const data = (await this.request<ManhattanPickList>(
      `/outbound/pick-lists/wave/${waveId}`
    )) as ManhattanPickList;

    return data;
  }

  /**
   * Complete picking
   */
  async completePicking(pickListId: string): Promise<{ success: boolean }> {
    await this.request(`/outbound/pick-lists/${pickListId}/complete`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    return { success: true };
  }

  /**
   * Create packing detail
   */
  async createPackingDetail(config: {
    pickListId: string;
    cartonBarcode: string;
  }): Promise<ManhattanPackDetail> {
    const data = (await this.request<ManhattanPackDetail>(
      `/outbound/packing`,
      {
        method: 'POST',
        body: JSON.stringify(config),
      }
    )) as ManhattanPackDetail;

    return data;
  }

  /**
   * Complete packing for a wave
   */
  async completeWavePacking(waveId: string): Promise<{ success: boolean }> {
    await this.request(`/outbound/waves/${waveId}/packing-complete`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    return { success: true };
  }

  /**
   * Create shipment
   */
  async createShipment(config: {
    warehouseId: string;
    waveId?: string;
    cartons: string[];
    carrierCode?: string;
  }): Promise<NormalizedShipment> {
    const data = (await this.request<ManhattanShipmentDetail>(
      `/outbound/shipments`,
      {
        method: 'POST',
        body: JSON.stringify(config),
      }
    )) as ManhattanShipmentDetail;

    return {
      id: data.id,
      shipmentNumber: data.shipmentNumber,
      warehouseId: data.warehouseId,
      status: (data.status as any),
      orders: [],
      lines: [],
      createdAt: new Date(data.shippedDate || new Date().toISOString()),
      carrier: data.carrierCode,
      trackingNumber: data.trackingNumber,
    };
  }

  /**
   * Get shipment details
   */
  async getShipment(shipmentId: string): Promise<ManhattanShipmentDetail> {
    const data = (await this.request<ManhattanShipmentDetail>(
      `/outbound/shipments/${shipmentId}`
    )) as ManhattanShipmentDetail;

    return data;
  }

  // ─── LABOR MANAGEMENT ───────────────────────────────────────────

  /**
   * Record labor transaction
   */
  async recordLaborTransaction(
    config: LaborTransaction
  ): Promise<LaborTransaction> {
    const data = (await this.request<LaborTransaction>(
      `/labor/transactions`,
      {
        method: 'POST',
        body: JSON.stringify(config),
      }
    )) as LaborTransaction;

    return data;
  }

  /**
   * Get employee labor summary
   */
  async getEmployeeLaborSummary(
    employeeId: string,
    dateRange: { startDate: string; endDate: string }
  ): Promise<{ efficiency: number; hoursWorked: number; unitsProcessed: number }> {
    const params = new URLSearchParams();
    params.append('startDate', dateRange.startDate);
    params.append('endDate', dateRange.endDate);

    const data = (await this.request<{
      efficiency: number;
      hoursWorked: number;
      unitsProcessed: number;
    }>(`/labor/summary/${employeeId}?${params.toString()}`)) as {
      efficiency: number;
      hoursWorked: number;
      unitsProcessed: number;
    };

    return data;
  }

  // ─── SLOTTING OPTIMIZATION ──────────────────────────────────────

  /**
   * Get slotting recommendations
   */
  async getSlottingRecommendations(
    warehouseId: string
  ): Promise<SlottingRecommendation[]> {
    const data = (await this.request<{ items: ManhattanSlot[] }>(
      `/slotting/recommendations/${warehouseId}`
    )) as { items: ManhattanSlot[] };

    return data.items.map((s) => ({
      id: s.id,
      warehouseId: s.warehouseId,
      skuId: s.skuId,
      recommendedLocationId: s.locationId,
      reason: (s.reason as any) || 'velocity',
      priority: (s.priority as any) || 'low',
      createdAt: new Date(s.createdDate || new Date().toISOString()),
    }));
  }

  /**
   * Apply slotting changes
   */
  async applySlotting(recommendations: string[]): Promise<{ success: boolean }> {
    await this.request(`/slotting/apply`, {
      method: 'POST',
      body: JSON.stringify({ recommendationIds: recommendations }),
    });

    return { success: true };
  }

  // ─── YARD MANAGEMENT ─────────────────────────────────────────────

  /**
   * Get dock doors
   */
  async getDockDoors(warehouseId: string): Promise<DockDoor[]> {
    const data = (await this.request<{ items: DockDoor[] }>(
      `/yard/dock-doors/${warehouseId}`
    )) as { items: DockDoor[] };

    return data.items;
  }

  /**
   * Create appointment
   */
  async createAppointment(config: Appointment): Promise<Appointment> {
    const data = (await this.request<Appointment>(`/yard/appointments`, {
      method: 'POST',
      body: JSON.stringify(config),
    })) as Appointment;

    return data;
  }

  /**
   * Check in appointment
   */
  async checkInAppointment(appointmentId: string): Promise<{ success: boolean }> {
    await this.request(`/yard/appointments/${appointmentId}/check-in`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    return { success: true };
  }

  /**
   * Check out appointment
   */
  async checkOutAppointment(appointmentId: string): Promise<{ success: boolean }> {
    await this.request(`/yard/appointments/${appointmentId}/check-out`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    return { success: true };
  }

  // ─── WEBHOOKS ───────────────────────────────────────────────────

  /**
   * Create webhook subscription
   */
  async createWebhook(config: SCWebhookConfig): Promise<SCWebhookConfig> {
    const data = (await this.request<SCWebhookConfig>(`/webhooks`, {
      method: 'POST',
      body: JSON.stringify(config),
    })) as SCWebhookConfig;

    return data;
  }

  /**
   * List webhooks
   */
  async listWebhooks(): Promise<SCWebhookConfig[]> {
    const data = (await this.request<{ items: SCWebhookConfig[] }>(
      `/webhooks`
    )) as { items: SCWebhookConfig[] };

    return data.items;
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request(`/webhooks/${webhookId}`, { method: 'DELETE' });
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(webhookId: string): Promise<{ statusCode: number; responseTime: number }> {
    const data = (await this.request<{ statusCode: number; responseTime: number }>(
      `/webhooks/${webhookId}/test`,
      { method: 'POST', body: JSON.stringify({}) }
    )) as { statusCode: number; responseTime: number };

    return data;
  }

  // ─── WAREHOUSE CONFIGURATION ────────────────────────────────────

  /**
   * Get WMS configuration
   */
  async getWMSConfig(warehouseId: string): Promise<WMSConfig> {
    const data = (await this.request<WMSConfig>(
      `/configuration/wms/${warehouseId}`
    )) as WMSConfig;

    return data;
  }

  /**
   * Update WMS configuration
   */
  async updateWMSConfig(
    warehouseId: string,
    config: Partial<WMSConfig>
  ): Promise<WMSConfig> {
    const data = (await this.request<WMSConfig>(
      `/configuration/wms/${warehouseId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(config),
      }
    )) as WMSConfig;

    return data;
  }

  // ─── HEALTH CHECK ───────────────────────────────────────────────

  /**
   * Health check for the API
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      await this.authenticate();
      const duration = Date.now() - startTime;

      return {
        status: 'healthy',
        timestamp: new Date(),
        responseTimeMs: duration,
      };
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        responseTimeMs: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Get rate limit info
   */
  getRateLimitInfo(): RateLimitInfo {
    return this.rateLimiter.getInfo();
  }
}
