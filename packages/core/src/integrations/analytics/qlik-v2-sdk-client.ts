/**
 * Qlik Sense SaaS API SDK Client
 *
 * Production-grade implementation with:
 * - OAuth2 M2M (machine-to-machine) authentication
 * - Apps (CRUD, reload, publish, metadata)
 * - Sheets management and queries
 * - Bookmarks creation and management
 * - Selections and state management
 * - Data Connections management
 * - Spaces and organization
 * - Automations and triggers
 * - Themes and branding
 * - Extensions management
 * - Natural Language API for insights
 * - Audit API for compliance
 * - Rate limiting (100 req/min)
 * - Exponential backoff retry logic
 */

import type {
  NormalizedDashboard,
  NormalizedDataset,
  EmbedConfig,
  ExportConfig,
  ExportResult,
  ExportFormat,
  ScheduleConfig,
  QueryResult,
  HealthCheckResult,
  RateLimitInfo,
  PaginatedResponse,
} from "./analytics-sdk-types.js";

// ─── QLIK SPECIFIC TYPES ────────────────────────────────────────────

interface QlikAuthConfig {
  clientId: string;
  clientSecret: string;
  tenantUrl: string;
}

interface QlikApp {
  id: string;
  name: string;
  description?: string;
  createdDate: string;
  modifiedDate: string;
  owner: { id: string; name: string };
  published?: boolean;
  spaceId?: string;
  thumbnail?: {
    id: string;
    contentType: string;
    size?: number;
  };
}

interface QlikSheet {
  id: string;
  title: string;
  description?: string;
  rank?: number;
  published?: boolean;
  cells?: Array<{
    name?: string;
    type?: string;
    visualization?: {
      id: string;
      type: string;
    };
  }>;
}

interface QlikBookmark {
  id: string;
  title: string;
  description?: string;
  owner: { id: string; name: string };
  createdDate: string;
  modifiedDate: string;
  selectionState?: Record<string, unknown>;
}

interface QlikDataConnection {
  id: string;
  name: string;
  type: string;
  connectionstring?: string;
  owner?: { id: string; name: string };
  createdDate?: string;
  modifiedDate?: string;
}

interface QlikSpace {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  type: "shared" | "personal" | "managed";
  createdDate?: string;
  modifiedDate?: string;
}

interface QlikAutomation {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  triggers: Array<{
    type: string;
    config?: Record<string, unknown>;
  }>;
  actions: Array<{
    type: string;
    config?: Record<string, unknown>;
  }>;
  createdDate?: string;
  modifiedDate?: string;
}

interface QlikTheme {
  id: string;
  name: string;
  description?: string;
  published: boolean;
  owner: { id: string; name: string };
  createdDate: string;
}

interface QlikExtension {
  id: string;
  name: string;
  type: "visualization" | "interaction" | "data-connector" | "auth";
  version: string;
  owner?: { id: string; name: string };
  enabled: boolean;
}

interface QlikReloadTask {
  id: string;
  appId: string;
  startTime?: string;
  endTime?: string;
  status: "pending" | "running" | "completed" | "failed";
  logId?: string;
  message?: string;
}

// ─── RATE LIMITER ───────────────────────────────────────────────────

class RateLimiter {
  private requestTimestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => now - ts < this.windowMs,
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
      (ts) => now - ts < this.windowMs,
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
        lastError = error instanceof Error ? error : new Error(String(error));

        const statusCode =
          lastError instanceof Error &&
          "statusCode" in lastError &&
          typeof (lastError as Record<string, unknown>).statusCode === "number"
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
            Math.pow(this.config.backoffMultiplier, attempt),
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

// ─── QLIK V2 SDK CLIENT ─────────────────────────────────────────────

/**
 * Qlik Sense SaaS API SDK Client
 */
export class QlikV2SDKClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private readonly authConfig: QlikAuthConfig;
  private readonly rateLimiter: RateLimiter;
  private readonly retryHandler: RetryHandler;

  constructor(authConfig: QlikAuthConfig) {
    this.authConfig = authConfig;
    this.baseUrl = authConfig.tenantUrl.replace(/\/$/, "");
    this.rateLimiter = new RateLimiter(100, 60000);
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
   * Authenticate with Qlik using OAuth2 M2M
   */
  async authenticate(): Promise<string> {
    return this.retryHandler.execute(async () => {
      await this.rateLimiter.acquire();

      const payload = new URLSearchParams();
      payload.append("grant_type", "client_credentials");
      payload.append("client_id", this.authConfig.clientId);
      payload.append("client_secret", this.authConfig.clientSecret);

      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
    options: RequestInit = {},
  ): Promise<T> {
    return this.retryHandler.execute(async () => {
      await this.rateLimiter.acquire();

      const token = await this.ensureAuthenticated();
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string>),
      };

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = new Error(
          `API request failed: ${response.status} ${response.statusText}`,
        );
        (error as unknown as Record<string, unknown>).statusCode =
          response.status;
        throw error;
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return (await response.json()) as T;
      }

      return response as unknown as T;
    });
  }

  // ─── APP OPERATIONS ─────────────────────────────────────────────

  /**
   * List apps
   */
  async listApps(options?: {
    spaceId?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<NormalizedDataset>> {
    const params = new URLSearchParams();
    if (options?.spaceId) params.append("spaceId", options.spaceId);
    if (options?.limit) params.append("limit", String(options.limit));
    if (options?.offset) params.append("offset", String(options.offset));

    const data = (await this.request<{ items: QlikApp[]; totalCount: number }>(
      `/v1/apps?${params.toString()}`,
    )) as { items: QlikApp[]; totalCount: number };

    return {
      items: data.items.map((app) => this.normalizeApp(app)),
      totalCount: data.totalCount,
      pageSize: options?.limit || 25,
      pageNumber:
        Math.floor((options?.offset || 0) / (options?.limit || 25)) + 1,
      hasMore:
        (options?.offset || 0) + (options?.limit || 25) < data.totalCount,
    };
  }

  /**
   * Get a specific app
   */
  async getApp(appId: string): Promise<NormalizedDataset> {
    const data = (await this.request<QlikApp>(`/v1/apps/${appId}`)) as QlikApp;

    return this.normalizeApp(data);
  }

  /**
   * Create an app
   */
  async createApp(config: {
    name: string;
    description?: string;
    spaceId?: string;
  }): Promise<NormalizedDataset> {
    const payload = {
      name: config.name,
      description: config.description,
      spaceId: config.spaceId,
    };

    const data = (await this.request<QlikApp>(`/v1/apps`, {
      method: "POST",
      body: JSON.stringify(payload),
    })) as QlikApp;

    return this.normalizeApp(data);
  }

  /**
   * Update app metadata
   */
  async updateApp(
    appId: string,
    updates: {
      name?: string;
      description?: string;
      published?: boolean;
    },
  ): Promise<NormalizedDataset> {
    const data = (await this.request<QlikApp>(`/v1/apps/${appId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    })) as QlikApp;

    return this.normalizeApp(data);
  }

  /**
   * Delete an app
   */
  async deleteApp(appId: string): Promise<void> {
    await this.request(`/v1/apps/${appId}`, { method: "DELETE" });
  }

  /**
   * Reload an app
   */
  async reloadApp(appId: string): Promise<{ taskId: string }> {
    const data = (await this.request<{ id: string }>(
      `/v1/apps/${appId}/reload`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    )) as { id: string };

    return { taskId: data.id };
  }

  /**
   * Get reload task status
   */
  async getReloadTaskStatus(
    appId: string,
    taskId: string,
  ): Promise<QlikReloadTask> {
    const data = (await this.request<QlikReloadTask>(
      `/v1/apps/${appId}/reload-tasks/${taskId}`,
    )) as QlikReloadTask;

    return data;
  }

  /**
   * Publish an app
   */
  async publishApp(appId: string, spaceId?: string): Promise<void> {
    await this.request(`/v1/apps/${appId}/publish`, {
      method: "POST",
      body: JSON.stringify({ spaceId }),
    });
  }

  // ─── SHEET OPERATIONS ───────────────────────────────────────────

  /**
   * List sheets in an app
   */
  async listSheets(appId: string): Promise<NormalizedDashboard[]> {
    const data = (await this.request<{ items: QlikSheet[] }>(
      `/v1/apps/${appId}/sheets`,
    )) as { items: QlikSheet[] };

    return data.items.map((sheet) => this.normalizeSheet(sheet));
  }

  /**
   * Get a specific sheet
   */
  async getSheet(appId: string, sheetId: string): Promise<NormalizedDashboard> {
    const data = (await this.request<QlikSheet>(
      `/v1/apps/${appId}/sheets/${sheetId}`,
    )) as QlikSheet;

    return this.normalizeSheet(data);
  }

  /**
   * Create a sheet
   */
  async createSheet(
    appId: string,
    config: {
      title: string;
      description?: string;
      rank?: number;
    },
  ): Promise<NormalizedDashboard> {
    const data = (await this.request<QlikSheet>(`/v1/apps/${appId}/sheets`, {
      method: "POST",
      body: JSON.stringify(config),
    })) as QlikSheet;

    return this.normalizeSheet(data);
  }

  /**
   * Update a sheet
   */
  async updateSheet(
    appId: string,
    sheetId: string,
    updates: {
      title?: string;
      description?: string;
      published?: boolean;
    },
  ): Promise<NormalizedDashboard> {
    const data = (await this.request<QlikSheet>(
      `/v1/apps/${appId}/sheets/${sheetId}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
      },
    )) as QlikSheet;

    return this.normalizeSheet(data);
  }

  // ─── BOOKMARK OPERATIONS ────────────────────────────────────────

  /**
   * List bookmarks
   */
  async listBookmarks(appId: string): Promise<QlikBookmark[]> {
    const data = (await this.request<{ items: QlikBookmark[] }>(
      `/v1/apps/${appId}/bookmarks`,
    )) as { items: QlikBookmark[] };

    return data.items;
  }

  /**
   * Get a specific bookmark
   */
  async getBookmark(appId: string, bookmarkId: string): Promise<QlikBookmark> {
    const data = (await this.request<QlikBookmark>(
      `/v1/apps/${appId}/bookmarks/${bookmarkId}`,
    )) as QlikBookmark;

    return data;
  }

  /**
   * Create a bookmark
   */
  async createBookmark(
    appId: string,
    config: {
      title: string;
      description?: string;
      selectionState?: Record<string, unknown>;
    },
  ): Promise<QlikBookmark> {
    const data = (await this.request<QlikBookmark>(
      `/v1/apps/${appId}/bookmarks`,
      {
        method: "POST",
        body: JSON.stringify(config),
      },
    )) as QlikBookmark;

    return data;
  }

  /**
   * Delete a bookmark
   */
  async deleteBookmark(appId: string, bookmarkId: string): Promise<void> {
    await this.request(`/v1/apps/${appId}/bookmarks/${bookmarkId}`, {
      method: "DELETE",
    });
  }

  // ─── DATA CONNECTIONS ───────────────────────────────────────────

  /**
   * List data connections
   */
  async listDataConnections(): Promise<QlikDataConnection[]> {
    const data = (await this.request<{ items: QlikDataConnection[] }>(
      `/v1/data-connections`,
    )) as { items: QlikDataConnection[] };

    return data.items;
  }

  /**
   * Create a data connection
   */
  async createDataConnection(
    config: QlikDataConnection,
  ): Promise<QlikDataConnection> {
    const data = (await this.request<QlikDataConnection>(
      `/v1/data-connections`,
      {
        method: "POST",
        body: JSON.stringify(config),
      },
    )) as QlikDataConnection;

    return data;
  }

  /**
   * Update a data connection
   */
  async updateDataConnection(
    connectionId: string,
    updates: Partial<QlikDataConnection>,
  ): Promise<QlikDataConnection> {
    const data = (await this.request<QlikDataConnection>(
      `/v1/data-connections/${connectionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
      },
    )) as QlikDataConnection;

    return data;
  }

  // ─── SPACES OPERATIONS ──────────────────────────────────────────

  /**
   * List spaces
   */
  async listSpaces(): Promise<QlikSpace[]> {
    const data = (await this.request<{ items: QlikSpace[] }>(`/v1/spaces`)) as {
      items: QlikSpace[];
    };

    return data.items;
  }

  /**
   * Create a space
   */
  async createSpace(config: {
    name: string;
    description?: string;
    type?: "shared" | "personal" | "managed";
  }): Promise<QlikSpace> {
    const data = (await this.request<QlikSpace>(`/v1/spaces`, {
      method: "POST",
      body: JSON.stringify(config),
    })) as QlikSpace;

    return data;
  }

  // ─── AUTOMATIONS ────────────────────────────────────────────────

  /**
   * List automations
   */
  async listAutomations(): Promise<QlikAutomation[]> {
    const data = (await this.request<{ items: QlikAutomation[] }>(
      `/v1/automations`,
    )) as { items: QlikAutomation[] };

    return data.items;
  }

  /**
   * Create an automation
   */
  async createAutomation(config: QlikAutomation): Promise<QlikAutomation> {
    const data = (await this.request<QlikAutomation>(`/v1/automations`, {
      method: "POST",
      body: JSON.stringify(config),
    })) as QlikAutomation;

    return data;
  }

  /**
   * Update an automation
   */
  async updateAutomation(
    automationId: string,
    updates: Partial<QlikAutomation>,
  ): Promise<QlikAutomation> {
    const data = (await this.request<QlikAutomation>(
      `/v1/automations/${automationId}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
      },
    )) as QlikAutomation;

    return data;
  }

  /**
   * Delete an automation
   */
  async deleteAutomation(automationId: string): Promise<void> {
    await this.request(`/v1/automations/${automationId}`, {
      method: "DELETE",
    });
  }

  // ─── THEMES MANAGEMENT ──────────────────────────────────────────

  /**
   * List themes
   */
  async listThemes(): Promise<QlikTheme[]> {
    const data = (await this.request<{ items: QlikTheme[] }>(`/v1/themes`)) as {
      items: QlikTheme[];
    };

    return data.items;
  }

  /**
   * Create a theme
   */
  async createTheme(config: {
    name: string;
    description?: string;
    published?: boolean;
  }): Promise<QlikTheme> {
    const data = (await this.request<QlikTheme>(`/v1/themes`, {
      method: "POST",
      body: JSON.stringify(config),
    })) as QlikTheme;

    return data;
  }

  // ─── EXTENSIONS MANAGEMENT ──────────────────────────────────────

  /**
   * List extensions
   */
  async listExtensions(): Promise<QlikExtension[]> {
    const data = (await this.request<{ items: QlikExtension[] }>(
      `/v1/extensions`,
    )) as { items: QlikExtension[] };

    return data.items;
  }

  /**
   * Upload an extension
   */
  async uploadExtension(
    config: {
      name: string;
      type: string;
      version: string;
    },
    fileBuffer: Buffer,
  ): Promise<QlikExtension> {
    const formData = new FormData();
    formData.append("name", config.name);
    formData.append("type", config.type);
    formData.append("version", config.version);
    formData.append(
      "file",
      new Blob([fileBuffer], { type: "application/octet-stream" }),
    );

    const token = await this.ensureAuthenticated();
    const response = await fetch(`${this.baseUrl}/v1/extensions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Extension upload failed: ${response.statusText}`);
    }

    const data = (await response.json()) as QlikExtension;
    return data;
  }

  // ─── NATURAL LANGUAGE API ───────────────────────────────────────

  /**
   * Generate insights using natural language
   */
  async generateInsights(
    appId: string,
    prompt: string,
  ): Promise<{ insights: Array<{ title: string; description: string }> }> {
    const data = (await this.request<{
      insights: Array<{ title: string; description: string }>;
    }>(`/v1/apps/${appId}/insights`, {
      method: "POST",
      body: JSON.stringify({ prompt }),
    })) as {
      insights: Array<{ title: string; description: string }>;
    };

    return data;
  }

  // ─── AUDIT API ──────────────────────────────────────────────────

  /**
   * Get audit events
   */
  async getAuditEvents(options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<Array<any>> {
    const params = new URLSearchParams();
    if (options?.startDate) params.append("startDate", options.startDate);
    if (options?.endDate) params.append("endDate", options.endDate);
    if (options?.limit) params.append("limit", String(options.limit));

    const data = (await this.request<{ items: Array<any> }>(
      `/v1/audit/events?${params.toString()}`,
    )) as { items: Array<any> };

    return data.items;
  }

  // ─── EMBED OPERATIONS ───────────────────────────────────────────

  /**
   * Generate embed token for an app
   */
  async generateAppEmbedToken(appId: string): Promise<EmbedConfig> {
    const data = (await this.request<{ token: string; expiresIn: number }>(
      `/v1/apps/${appId}/embed-token`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    )) as { token: string; expiresIn: number };

    return {
      type: "dashboard",
      contentId: appId,
      token: data.token,
      tokenExpiresAt: new Date(Date.now() + data.expiresIn * 1000),
      url: `${this.baseUrl}/embed/apps/${appId}`,
    };
  }

  /**
   * Generate embed token for a sheet
   */
  async generateSheetEmbedToken(
    appId: string,
    sheetId: string,
  ): Promise<EmbedConfig> {
    const data = (await this.request<{ token: string; expiresIn: number }>(
      `/v1/apps/${appId}/sheets/${sheetId}/embed-token`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    )) as { token: string; expiresIn: number };

    return {
      type: "dashboard",
      contentId: sheetId,
      token: data.token,
      tokenExpiresAt: new Date(Date.now() + data.expiresIn * 1000),
      url: `${this.baseUrl}/embed/apps/${appId}/sheets/${sheetId}`,
    };
  }

  // ─── NORMALIZATION HELPERS ──────────────────────────────────────

  private normalizeApp(app: QlikApp): NormalizedDataset {
    return {
      id: app.id,
      name: app.name,
      description: app.description,
      ownerName: app.owner?.name,
      createdAt: new Date(app.createdDate),
      updatedAt: new Date(app.modifiedDate),
      isPublished: app.published || false,
      tables: [],
    };
  }

  private normalizeSheet(sheet: QlikSheet): NormalizedDashboard {
    return {
      id: sheet.id,
      name: sheet.title,
      description: sheet.description,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPublished: sheet.published || false,
      items: (sheet.cells || []).map((cell, idx) => ({
        id: cell.name || `cell-${idx}`,
        title: cell.name || "Cell",
        type: (cell.type as any) || "visualization",
        x: 0,
        y: idx * 4,
        width: 12,
        height: 4,
      })),
    };
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
        status: "healthy",
        timestamp: new Date(),
        responseTimeMs: duration,
      };
    } catch (error: unknown) {
      return {
        status: "unhealthy",
        timestamp: new Date(),
        responseTimeMs: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
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
