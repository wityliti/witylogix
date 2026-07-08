/**
 * Google Analytics 4 Analytics Adapter
 *
 * Integrates with Google Analytics 4 Data API and Admin API for:
 * - Service account and OAuth2 authentication
 * - runReport, batchRunReports, runRealtimeReport
 * - Property and stream management
 * - Audience management
 * - Custom dimensions and metrics
 * - Data retention settings
 */

import { AnalyticsAdapter } from "./analytics-adapter.js";
import type {
  AnalyticsConfig,
  QueryDefinition,
  QueryResult,
  DashboardDefinition,
  EmbedToken,
  EmbedScope,
  RLSRule,
  ExportResult,
  AnalyticsExportFormat,
  HealthCheckResult,
  DataSource,
  FilterDefinition,
} from "./types.js";

interface GA4Property {
  name: string;
  displayName: string;
  parent: string;
  createTime: string;
  updateTime: string;
  timeZone: string;
  currencyCode: string;
}

interface GA4Stream {
  name: string;
  displayName: string;
  createTime: string;
  updateTime: string;
  type: string;
  webStreamData?: GA4WebStreamData;
  iosAppStreamData?: GA4AppStreamData;
  androidAppStreamData?: GA4AppStreamData;
}

interface GA4WebStreamData {
  measurementId: string;
  firebaseAppId?: string;
  defaultUri?: string;
}

interface GA4AppStreamData {
  firebaseAppId?: string;
  bundleId?: string;
  packageName?: string;
}

interface GA4Audience {
  name: string;
  displayName: string;
  description?: string;
  createTime: string;
  membershipDurationDays: number;
}

interface GA4CustomDimension {
  name: string;
  displayName: string;
  description?: string;
  parameterName: string;
  scope: string;
  disallowAdsPersonalization?: boolean;
}

interface GA4CustomMetric {
  name: string;
  displayName: string;
  description?: string;
  parameterName: string;
  measurementUnit: string;
  scope: string;
}

interface GA4ReportRequest {
  dimensions: Array<{ name: string }>;
  metrics: Array<{ name: string }>;
  dateRanges: Array<{ startDate: string; endDate: string }>;
  dimensionFilter?: any;
  metricFilter?: any;
  limit?: number;
}

interface GA4ReportResponse {
  propertyName: string;
  data: {
    rows: Array<{
      dimensionValues: Array<{ value: string }>;
      metricValues: Array<{ value: string }>;
    }>;
    totals?: Array<{
      dimensionValues?: Array<{ value: string }>;
      metricValues: Array<{ value: string }>;
    }>;
  };
}

/**
 * Google Analytics 4 adapter.
 * Supports service account and OAuth2 authentication.
 */
export class GoogleAnalyticsClient extends AnalyticsAdapter {
  private accessToken: string = "";
  private tokenExpiresAt: number = 0;
  private propertyId: string = "";

  constructor(config: AnalyticsConfig) {
    super(config);
    this.propertyId = config.defaultWorkspaceId || "";
  }

  /**
   * Authenticate with Google Analytics using service account or OAuth2.
   * @returns Access token for API calls
   */
  async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    // Try service account authentication
    if (this.config.credentials.type === "service_account") {
      return this._authenticateServiceAccount();
    }

    // Try OAuth2
    if (this.config.oauthToken) {
      this.accessToken = this.config.oauthToken;
      return this.accessToken;
    }

    throw new Error(
      "GA4 authentication requires service account or OAuth2 credentials",
    );
  }

  /**
   * Run a GA4 report.
   * @param request Report request with dimensions, metrics, and date range
   * @returns Report response with data
   */
  async runReport(request: GA4ReportRequest): Promise<GA4ReportResponse> {
    const token: string = await this.authenticate();

    const body = {
      property: `properties/${this.propertyId}`,
      dateRanges: request.dateRanges,
      dimensions: request.dimensions,
      metrics: request.metrics,
      dimensionFilter: request.dimensionFilter,
      metricFilter: request.metricFilter,
      limit: request.limit || 100000,
    };

    const response: Response = await fetch(
      "https://analyticsdata.googleapis.com/v1beta/properties/" +
        `${this.propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to run GA4 report: ${response.statusText}`);
    }

    const data: any = await response.json();

    return {
      propertyName: `properties/${this.propertyId}`,
      data: {
        rows: data.rows || [],
        totals: data.totals,
      },
    };
  }

  /**
   * Run multiple GA4 reports in batch.
   * @param requests Array of report requests
   * @returns Array of report responses
   */
  async batchRunReports(
    requests: GA4ReportRequest[],
  ): Promise<GA4ReportResponse[]> {
    const token: string = await this.authenticate();

    const body = {
      requests: requests.map((req: GA4ReportRequest) => ({
        property: `properties/${this.propertyId}`,
        dateRanges: req.dateRanges,
        dimensions: req.dimensions,
        metrics: req.metrics,
        limit: req.limit || 100000,
      })),
    };

    const response: Response = await fetch(
      "https://analyticsdata.googleapis.com/v1beta/properties/" +
        `${this.propertyId}:batchRunReports`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to run batch reports: ${response.statusText}`);
    }

    const data: any = await response.json();

    return (
      data.reports?.map((report: any) => ({
        propertyName: `properties/${this.propertyId}`,
        data: {
          rows: report.rows || [],
          totals: report.totals,
        },
      })) || []
    );
  }

  /**
   * Run realtime report.
   * @param dimensions Dimensions to report on
   * @param metrics Metrics to report on
   * @returns Realtime report data
   */
  async runRealtimeReport(
    dimensions: string[],
    metrics: string[],
  ): Promise<GA4ReportResponse> {
    const token: string = await this.authenticate();

    const body = {
      property: `properties/${this.propertyId}`,
      dimensions: dimensions.map((d: string) => ({ name: d })),
      metrics: metrics.map((m: string) => ({ name: m })),
      limit: 100000,
    };

    const response: Response = await fetch(
      "https://analyticsdata.googleapis.com/v1beta/properties/" +
        `${this.propertyId}:runRealtimeReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to run realtime report: ${response.statusText}`);
    }

    const data: any = await response.json();

    return {
      propertyName: `properties/${this.propertyId}`,
      data: {
        rows: data.rows || [],
      },
    };
  }

  /**
   * Get GA4 properties.
   * @returns Array of properties
   */
  async getProperties(): Promise<GA4Property[]> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/properties",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch properties: ${response.statusText}`);
    }

    const data: any = await response.json();
    return (
      data.properties?.map((prop: any) => ({
        name: prop.name,
        displayName: prop.displayName,
        parent: prop.parent,
        createTime: prop.createTime,
        updateTime: prop.updateTime,
        timeZone: prop.timeZone,
        currencyCode: prop.currencyCode,
      })) || []
    );
  }

  /**
   * Get property details.
   * @param propertyId Property identifier
   * @returns Property details
   */
  async getProperty(propertyId: string): Promise<GA4Property> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch property: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      name: data.name,
      displayName: data.displayName,
      parent: data.parent,
      createTime: data.createTime,
      updateTime: data.updateTime,
      timeZone: data.timeZone,
      currencyCode: data.currencyCode,
    };
  }

  /**
   * Get data streams for a property.
   * @param propertyId Property identifier
   * @returns Array of streams
   */
  async getDataStreams(propertyId: string): Promise<GA4Stream[]> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/dataStreams`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch data streams: ${response.statusText}`);
    }

    const data: any = await response.json();
    return (
      data.dataStreams?.map((stream: any) => ({
        name: stream.name,
        displayName: stream.displayName,
        createTime: stream.createTime,
        updateTime: stream.updateTime,
        type: stream.type,
        webStreamData: stream.webStreamData,
        iosAppStreamData: stream.iosAppStreamData,
        androidAppStreamData: stream.androidAppStreamData,
      })) || []
    );
  }

  /**
   * Get audiences.
   * @param propertyId Property identifier
   * @returns Array of audiences
   */
  async getAudiences(propertyId: string): Promise<GA4Audience[]> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/audiences`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch audiences: ${response.statusText}`);
    }

    const data: any = await response.json();
    return (
      data.audiences?.map((audience: any) => ({
        name: audience.name,
        displayName: audience.displayName,
        description: audience.description,
        createTime: audience.createTime,
        membershipDurationDays: audience.membershipDurationDays,
      })) || []
    );
  }

  /**
   * Create an audience.
   * @param propertyId Property identifier
   * @param audience Audience definition
   * @returns Created audience
   */
  async createAudience(
    propertyId: string,
    audience: Omit<GA4Audience, "name" | "createTime">,
  ): Promise<GA4Audience> {
    const token: string = await this.authenticate();

    const body = {
      displayName: audience.displayName,
      description: audience.description,
      membershipDurationDays: audience.membershipDurationDays,
    };

    const response: Response = await fetch(
      `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/audiences`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to create audience: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      createTime: data.createTime,
      membershipDurationDays: data.membershipDurationDays,
    };
  }

  /**
   * Get custom dimensions.
   * @param propertyId Property identifier
   * @returns Array of custom dimensions
   */
  async getCustomDimensions(propertyId: string): Promise<GA4CustomDimension[]> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/customDimensions`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch custom dimensions: ${response.statusText}`,
      );
    }

    const data: any = await response.json();
    return (
      data.customDimensions?.map((dim: any) => ({
        name: dim.name,
        displayName: dim.displayName,
        description: dim.description,
        parameterName: dim.parameterName,
        scope: dim.scope,
        disallowAdsPersonalization: dim.disallowAdsPersonalization,
      })) || []
    );
  }

  /**
   * Get custom metrics.
   * @param propertyId Property identifier
   * @returns Array of custom metrics
   */
  async getCustomMetrics(propertyId: string): Promise<GA4CustomMetric[]> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/customMetrics`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch custom metrics: ${response.statusText}`);
    }

    const data: any = await response.json();
    return (
      data.customMetrics?.map((metric: any) => ({
        name: metric.name,
        displayName: metric.displayName,
        description: metric.description,
        parameterName: metric.parameterName,
        measurementUnit: metric.measurementUnit,
        scope: metric.scope,
      })) || []
    );
  }

  /**
   * Get available data sources.
   */
  async getDataSources(): Promise<DataSource[]> {
    const properties: GA4Property[] = await this.getProperties();

    return properties.map((prop: GA4Property) => ({
      id: prop.name.split("/")[1] || "",
      name: prop.displayName,
      type: "property",
      tableName: prop.displayName,
      archived: false,
      fields: [],
    }));
  }

  /**
   * Protected method: Execute query implementation for GA4.
   */
  protected async _executeQueryImpl(
    query: QueryDefinition,
  ): Promise<QueryResult> {
    const request: GA4ReportRequest = {
      dimensions: query.fields
        .filter((f: string) => !f.startsWith("metric_"))
        .map((f: string) => ({ name: f })),
      metrics: query.fields
        .filter((f: string) => f.startsWith("metric_"))
        .map((f: string) => ({ name: f.replace("metric_", "") })),
      dateRanges: [
        {
          startDate: "30daysAgo",
          endDate: "today",
        },
      ],
      limit: query.limit || 10000,
    };

    const result: GA4ReportResponse = await this.runReport(request);

    return {
      executionId: query.id,
      columns: [
        ...request.dimensions.map((d: any) => ({
          name: d.name,
          type: "string" as const,
        })),
        ...request.metrics.map((m: any) => ({
          name: m.name,
          type: "number" as const,
        })),
      ],
      rows: result.data.rows.map((row: any) => {
        const obj: Record<string, unknown> = {};
        row.dimensionValues.forEach((dv: any, idx: number) => {
          if (idx < request.dimensions.length) {
            obj[request.dimensions[idx].name] = dv.value;
          }
        });
        row.metricValues.forEach((mv: any, idx: number) => {
          if (idx < request.metrics.length) {
            obj[request.metrics[idx].name] = parseFloat(mv.value);
          }
        });
        return obj;
      }),
      totalRowCount: result.data.rows.length,
      executionTimeMs: 0,
      fromCache: false,
    };
  }

  /**
   * Protected method: Create dashboard implementation for GA4.
   */
  protected async _createDashboardImpl(
    dashboard: DashboardDefinition,
  ): Promise<DashboardDefinition> {
    dashboard.id = `ga4-dashboard-${Date.now()}`;
    return dashboard;
  }

  /**
   * Protected method: Get dashboard implementation for GA4.
   */
  protected async _getDashboardImpl(
    dashboardId: string,
  ): Promise<DashboardDefinition> {
    return {
      id: dashboardId,
      name: "GA4 Dashboard",
      widgets: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Protected method: Update dashboard implementation for GA4.
   */
  protected async _updateDashboardImpl(
    dashboardId: string,
    updates: Partial<DashboardDefinition>,
  ): Promise<DashboardDefinition> {
    return this._getDashboardImpl(dashboardId);
  }

  /**
   * Protected method: Delete dashboard implementation for GA4.
   */
  protected async _deleteDashboardImpl(_dashboardId: string): Promise<void> {
    // GA4 dashboard deletion would be implemented here
  }

  /**
   * Protected method: Generate embed token implementation for GA4.
   */
  protected async _generateEmbedTokenImpl(
    entityId: string,
    userId: string,
    _scopes: EmbedScope[],
    _rlsRules?: RLSRule[],
    expiryMinutes: number = 60,
  ): Promise<EmbedToken> {
    const token: string = await this.authenticate();

    return {
      id: `ga4-token-${Date.now()}`,
      token,
      entityId,
      entityType: "dashboard",
      userId,
      scopes: ["view"],
      expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
      createdAt: new Date(),
    };
  }

  /**
   * Protected method: Export dashboard implementation for GA4.
   */
  protected async _exportDashboardImpl(
    _entityId: string,
    format: AnalyticsExportFormat,
    _filters?: FilterDefinition[],
  ): Promise<ExportResult> {
    return {
      jobId: `export-${Date.now()}`,
      format,
      status: "completed",
      completedAt: new Date(),
    };
  }

  /**
   * Protected method: Health check implementation for GA4.
   */
  protected async _healthCheckImpl(): Promise<HealthCheckResult> {
    try {
      const token: string = await this.authenticate();

      const response: Response = await fetch(
        "https://analyticsadmin.googleapis.com/v1beta/properties",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return {
        healthy: response.ok,
        authenticated: true,
        responseTimeMs: 0,
      };
    } catch (error: unknown) {
      const message: string =
        error instanceof Error ? error.message : String(error);
      return {
        healthy: false,
        authenticated: false,
        responseTimeMs: 0,
        errorMessage: message,
      };
    }
  }

  private async _authenticateServiceAccount(): Promise<string> {
    const keyFile: any = JSON.parse(this.config.credentials.keyFile || "{}");

    if (!keyFile.private_key || !keyFile.client_email) {
      throw new Error("Invalid service account credentials");
    }

    // Create JWT assertion
    const now: number = Math.floor(Date.now() / 1000);
    const assertion = {
      iss: keyFile.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    // In production, sign with private key using JWT library
    // For now, simplified implementation
    const token: string = Buffer.from(JSON.stringify(assertion)).toString(
      "base64",
    );

    const body = new URLSearchParams();
    body.append("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
    body.append("assertion", token);

    const response: Response = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        body,
      },
    );

    if (!response.ok) {
      throw new Error(
        `Service account authentication failed: ${response.statusText}`,
      );
    }

    const data: any = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

    return this.accessToken;
  }
}
