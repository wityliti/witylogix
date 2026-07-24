/**
 * Synchronization API endpoints for order sync management.
 *
 * Provides REST API for:
 * - Triggering manual syncs
 * - Checking sync status
 * - Managing conflicts
 * - Retrieving sync metrics
 * - Bulk import/export operations
 * - Configuration management
 *
 * @module sync/sync-api
 */

import type {
  SyncJob,
  SyncConflict,
  SyncResult,
  SyncConfig,
  PlatformOrder,
  ConflictResolution,
  SyncMetrics,
} from "./sync-types.js";

/**
 * Request body for triggering a sync
 */
export interface TriggerSyncRequest {
  platformType: string;
  direction: "INBOUND" | "OUTBOUND" | "BIDIRECTIONAL";
  batchSize?: number;
}

/**
 * Request body for resolving a conflict
 */
export interface ResolveConflictRequest {
  resolution: "INTERNAL" | "EXTERNAL";
  note?: string;
}

/**
 * Request body for updating sync configuration
 */
export interface UpdateSyncConfigRequest {
  enabled?: boolean;
  syncInterval?: number;
  conflictStrategy?: string;
  maxBatchSize?: number;
  autoRetry?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Request body for bulk import
 */
export interface BulkImportRequest {
  orders: PlatformOrder[];
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Query filters for sync history
 */
export interface SyncHistoryFilters {
  platformType?: string;
  status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CONFLICT";
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Sync API service
 */
export class SyncAPIService {
  private baseUrl: string;
  private tenantId: string;
  private authToken: string;

  /**
   * Initialize sync API service
   * @param baseUrl - Base API URL
   * @param tenantId - Tenant ID
   * @param authToken - Authentication token
   */
  constructor(baseUrl: string, tenantId: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.tenantId = tenantId;
    this.authToken = authToken;
  }

  /**
   * Trigger a manual sync for a platform
   * POST /api/sync/trigger
   *
   * @param request - Trigger request
   * @returns Sync job
   */
  public async triggerSync(request: TriggerSyncRequest): Promise<SyncJob> {
    const response = await this.post("/api/sync/trigger", request);
    return response as SyncJob;
  }

  /**
   * Get sync status for all platforms
   * GET /api/sync/status
   *
   * @returns Array of sync jobs
   */
  public async getStatus(): Promise<SyncJob[]> {
    const response = await this.get("/api/sync/status");
    return response as SyncJob[];
  }

  /**
   * Get sync status for a specific platform
   * GET /api/sync/status/:platformType
   *
   * @param platformType - Platform type
   * @returns Sync job
   */
  public async getStatusForPlatform(
    platformType: string,
  ): Promise<SyncJob | null> {
    const response = await this.get(`/api/sync/status/${platformType}`);
    return (response as SyncJob) || null;
  }

  /**
   * List unresolved conflicts
   * GET /api/sync/conflicts
   *
   * @param limit - Max results (default 50)
   * @param offset - Result offset (default 0)
   * @returns Array of conflicts
   */
  public async getConflicts(
    limit: number = 50,
    offset: number = 0,
  ): Promise<SyncConflict[]> {
    const response = await this.get("/api/sync/conflicts", { limit, offset });
    return response as SyncConflict[];
  }

  /**
   * Get conflicts for a specific platform
   * GET /api/sync/conflicts/:platformType
   *
   * @param platformType - Platform type
   * @param limit - Max results
   * @param offset - Result offset
   * @returns Array of conflicts
   */
  public async getConflictsForPlatform(
    platformType: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<SyncConflict[]> {
    const response = await this.get(`/api/sync/conflicts/${platformType}`, {
      limit,
      offset,
    });
    return response as SyncConflict[];
  }

  /**
   * Resolve a specific conflict
   * POST /api/sync/conflicts/:id/resolve
   *
   * @param conflictId - Conflict ID
   * @param request - Resolution request
   * @returns Conflict resolution
   */
  public async resolveConflict(
    conflictId: string,
    request: ResolveConflictRequest,
  ): Promise<ConflictResolution> {
    const response = await this.post(
      `/api/sync/conflicts/${conflictId}/resolve`,
      request,
    );
    return response as ConflictResolution;
  }

  /**
   * Get sync metrics
   * GET /api/sync/metrics
   *
   * @returns Array of metrics per platform
   */
  public async getMetrics(): Promise<SyncMetrics[]> {
    const response = await this.get("/api/sync/metrics");
    return response as SyncMetrics[];
  }

  /**
   * Get metrics for a specific platform
   * GET /api/sync/metrics/:platformType
   *
   * @param platformType - Platform type
   * @returns Metrics for platform
   */
  public async getMetricsForPlatform(
    platformType: string,
  ): Promise<SyncMetrics | null> {
    const response = await this.get(`/api/sync/metrics/${platformType}`);
    return (response as SyncMetrics) || null;
  }

  /**
   * Get sync job history
   * GET /api/sync/history
   *
   * @param filters - Query filters
   * @returns Array of sync jobs
   */
  public async getHistory(
    filters: SyncHistoryFilters = {},
  ): Promise<SyncJob[]> {
    const response = await this.get("/api/sync/history", filters);
    return response as SyncJob[];
  }

  /**
   * Get sync job details
   * GET /api/sync/jobs/:jobId
   *
   * @param jobId - Job ID
   * @returns Sync job details
   */
  public async getJobDetails(jobId: string): Promise<SyncJob | null> {
    const response = await this.get(`/api/sync/jobs/${jobId}`);
    return (response as SyncJob) || null;
  }

  /**
   * Update sync configuration for a platform
   * POST /api/sync/config
   *
   * @param platformType - Platform type
   * @param request - Config update request
   * @returns Updated config
   */
  public async updateConfig(
    platformType: string,
    request: UpdateSyncConfigRequest,
  ): Promise<SyncConfig> {
    const response = await this.post(
      `/api/sync/config/${platformType}`,
      request,
    );
    return response as SyncConfig;
  }

  /**
   * Get current sync configuration for a platform
   * GET /api/sync/config/:platformType
   *
   * @param platformType - Platform type
   * @returns Sync config
   */
  public async getConfig(platformType: string): Promise<SyncConfig | null> {
    const response = await this.get(`/api/sync/config/${platformType}`);
    return (response as SyncConfig) || null;
  }

  /**
   * Bulk import orders
   * POST /api/sync/import
   *
   * @param request - Import request
   * @returns Import result with stats
   */
  public async bulkImport(request: BulkImportRequest): Promise<SyncResult> {
    const response = await this.post("/api/sync/import", {
      orders: request.orders,
    });
    return response as SyncResult;
  }

  /**
   * Get import/export history
   * GET /api/sync/batch-operations
   *
   * @param limit - Max results
   * @param offset - Result offset
   * @returns Array of batch operations
   */
  public async getBatchOperations(
    limit: number = 50,
    offset: number = 0,
  ): Promise<any[]> {
    const response = await this.get("/api/sync/batch-operations", {
      limit,
      offset,
    });
    return response as any[];
  }

  /**
   * Pause syncs for a platform
   * POST /api/sync/pause
   *
   * @param platformType - Platform type
   * @returns Pause confirmation
   */
  public async pausePlatformSync(
    platformType: string,
  ): Promise<{ paused: boolean }> {
    const response = await this.post(`/api/sync/pause/${platformType}`, {});
    return response as { paused: boolean };
  }

  /**
   * Resume syncs for a platform
   * POST /api/sync/resume
   *
   * @param platformType - Platform type
   * @returns Resume confirmation
   */
  public async resumePlatformSync(
    platformType: string,
  ): Promise<{ resumed: boolean }> {
    const response = await this.post(`/api/sync/resume/${platformType}`, {});
    return response as { resumed: boolean };
  }

  /**
   * Health check for sync system
   * GET /api/sync/health
   *
   * @returns Health status
   */
  public async getHealth(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    activeSyncs: number;
    pendingConflicts: number;
    failedJobs: number;
  }> {
    const response = await this.get("/api/sync/health");
    return response as any;
  }

  /**
   * Make GET request
   */
  private async get(
    path: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  /**
   * Make POST request
   */
  private async post(path: string, body: unknown): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${path}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    return this.handleResponse(response);
  }

  /**
   * Get request headers
   */
  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.authToken}`,
      "X-Tenant-ID": this.tenantId,
    };
  }

  /**
   * Handle API response
   */
  private async handleResponse(response: Response): Promise<unknown> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `API error ${response.status}: ${(error as any).message || response.statusText}`,
      );
    }

    return response.json();
  }
}
