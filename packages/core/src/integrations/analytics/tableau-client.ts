/**
 * Tableau Analytics Adapter
 *
 * Integrates with Tableau Server/Online REST API and Hyper API for:
 * - Personal access token and JWT authentication
 * - Workbook and view CRUD operations
 * - Publishing and downloading workbooks
 * - Data source management and extract refresh
 * - Subscription management
 * - Embed URL generation with trusted tickets
 * - Querying views with filters
 */

import { AnalyticsAdapter } from './analytics-adapter.js';
import type {
  AnalyticsConfig,
  QueryDefinition,
  QueryResult,
  DashboardDefinition,
  DashboardWidget,
  EmbedToken,
  EmbedScope,
  RLSRule,
  ExportResult,
  AnalyticsExportFormat,
  HealthCheckResult,
  DataSource,
  FilterDefinition,
} from './types.js';

interface TableauWorkbook {
  id: string;
  name: string;
  description?: string;
  owner?: string;
  createdAt: Date;
  updatedAt: Date;
  views: TableauView[];
}

interface TableauView {
  id: string;
  name: string;
  workbookId: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TableauDataSource {
  id: string;
  name: string;
  description?: string;
  owner?: string;
  type: string;
  refreshSchedule?: string;
  lastRefreshedAt?: Date;
}

interface TableauSubscription {
  id: string;
  subject: string;
  contentId: string;
  contentType: 'workbook' | 'view';
  recipient: string;
  frequency: string;
  nextRunAt?: Date;
}

interface TableauTrustedTicket {
  ticket: string;
  expiresAt: Date;
  username: string;
  siteId?: string;
}

/**
 * Tableau Server/Online analytics adapter.
 * Handles authentication via PAT or JWT and provides full API integration.
 */
export class TableauClient extends AnalyticsAdapter {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private siteId: string = '';

  constructor(config: AnalyticsConfig) {
    super(config);
  }

  /**
   * Authenticate with Tableau Server using personal access token.
   * @returns Access token for subsequent API calls
   */
  async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const token: string = this.config.credentials.pat || this.config.credentials.personalAccessToken;
    const username: string = this.config.credentials.username || '';
    const contentUrl: string = this.config.credentials.contentUrl || '';

    if (!token || !username) {
      throw new Error('Tableau authentication requires PAT token and username');
    }

    try {
      const response: Response = await fetch(
        `${this.config.apiUrl}/auth/signin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml',
          },
          body: this._buildSigninXml(username, token, contentUrl),
        }
      );

      if (!response.ok) {
        throw new Error(`Tableau authentication failed: ${response.statusText}`);
      }

      const text: string = await response.text();
      const tokenMatch: RegExpMatchArray | null = text.match(/<token>([^<]+)<\/token>/);
      const siteMatch: RegExpMatchArray | null = text.match(/<site id="([^"]+)"/);

      if (!tokenMatch || !tokenMatch[1]) {
        throw new Error('Failed to extract token from Tableau response');
      }

      this.accessToken = tokenMatch[1];
      this.siteId = siteMatch ? siteMatch[1] : '';
      this.tokenExpiresAt = Date.now() + 12 * 60 * 60 * 1000; // 12 hour TTL

      return this.accessToken;
    } catch (error: unknown) {
      throw new Error(
        `Tableau authentication error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate JWT token for Tableau authentication.
   * @returns JWT token
   */
  async generateJWT(): Promise<string> {
    const clientId: string = this.config.credentials.clientId || '';
    const clientSecret: string = this.config.credentials.clientSecret || '';

    if (!clientId || !clientSecret) {
      throw new Error('JWT generation requires clientId and clientSecret');
    }

    // Create JWT header and payload
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const now: number = Math.floor(Date.now() / 1000);
    const payload = {
      iss: clientId,
      sub: clientId,
      aud: 'tableau',
      iat: now,
      exp: now + 3600,
    };

    // Base64 encode and sign
    const headerB64: string = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64: string = Buffer.from(JSON.stringify(payload)).toString('base64url');

    // Create signature using HMAC-SHA256
    const crypto = await import('crypto');
    const signature: string = crypto
      .createHmac('sha256', clientSecret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    return `${headerB64}.${payloadB64}.${signature}`;
  }

  /**
   * Get list of workbooks accessible to current user.
   * @returns Array of workbooks with views
   */
  async getWorkbooks(): Promise<TableauWorkbook[]> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `${this.config.apiUrl}/sites/${this.siteId}/workbooks`,
      {
        method: 'GET',
        headers: {
          'X-Tableau-Auth': token,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch workbooks: ${response.statusText}`);
    }

    const data: any = await response.json();
    return (
      data.workbooks?.map((wb: any) => ({
        id: wb.id,
        name: wb.name,
        description: wb.description,
        owner: wb.owner?.id,
        createdAt: new Date(wb.createdAt),
        updatedAt: new Date(wb.updatedAt),
        views: wb.views || [],
      })) || []
    );
  }

  /**
   * Get workbook by ID.
   * @param workbookId Workbook identifier
   * @returns Workbook definition
   */
  async getWorkbook(workbookId: string): Promise<TableauWorkbook> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `${this.config.apiUrl}/sites/${this.siteId}/workbooks/${workbookId}`,
      {
        method: 'GET',
        headers: {
          'X-Tableau-Auth': token,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch workbook: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      owner: data.owner?.id,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      views: data.views || [],
    };
  }

  /**
   * Publish a workbook to Tableau Server.
   * @param workbookName Name for published workbook
   * @param filePath Path to workbook file
   * @param projectId Target project ID
   * @returns Published workbook info
   */
  async publishWorkbook(
    workbookName: string,
    filePath: string,
    projectId: string
  ): Promise<TableauWorkbook> {
    const token: string = await this.authenticate();

    // Read file
    const fs = await import('fs');
    const fileContent: Buffer = fs.readFileSync(filePath);

    const formData = new FormData();
    const blob = new Blob([fileContent], { type: 'application/octet-stream' });
    formData.append('file', blob, workbookName);
    formData.append('overwrite', 'true');

    const response: Response = await fetch(
      `${this.config.apiUrl}/sites/${this.siteId}/workbooks?projectId=${projectId}`,
      {
        method: 'POST',
        headers: {
          'X-Tableau-Auth': token,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to publish workbook: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      id: data.workbook.id,
      name: data.workbook.name,
      createdAt: new Date(),
      updatedAt: new Date(),
      views: [],
    };
  }

  /**
   * Download a workbook.
   * @param workbookId Workbook identifier
   * @returns Buffer containing workbook file
   */
  async downloadWorkbook(workbookId: string): Promise<Buffer> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `${this.config.apiUrl}/sites/${this.siteId}/workbooks/${workbookId}/content`,
      {
        method: 'GET',
        headers: {
          'X-Tableau-Auth': token,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to download workbook: ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Get data sources in Tableau.
   * @returns Array of data sources
   */
  async getDataSources(): Promise<DataSource[]> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `${this.config.apiUrl}/sites/${this.siteId}/datasources`,
      {
        method: 'GET',
        headers: {
          'X-Tableau-Auth': token,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch data sources: ${response.statusText}`);
    }

    const data: any = await response.json();
    return (
      data.datasources?.map((ds: any) => ({
        id: ds.id,
        name: ds.name,
        type: ds.datasourceType || 'unknown',
        tableName: ds.name,
        archived: ds.isArchived || false,
        lastRefreshedAt: ds.lastRefreshedAt ? new Date(ds.lastRefreshedAt) : undefined,
        fields: [],
      })) || []
    );
  }

  /**
   * Refresh a data source extract.
   * @param datasourceId Data source identifier
   * @returns Updated data source
   */
  async refreshDataSource(datasourceId: string): Promise<TableauDataSource> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `${this.config.apiUrl}/sites/${this.siteId}/datasources/${datasourceId}/refresh`,
      {
        method: 'POST',
        headers: {
          'X-Tableau-Auth': token,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to refresh data source: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      id: data.id,
      name: data.name,
      lastRefreshedAt: new Date(),
      type: 'extract',
    };
  }

  /**
   * Create a subscription to a view or workbook.
   * @param contentId Content identifier
   * @param recipient Email recipient
   * @param frequency Delivery frequency
   * @returns Subscription info
   */
  async createSubscription(
    contentId: string,
    recipient: string,
    frequency: string
  ): Promise<TableauSubscription> {
    const token: string = await this.authenticate();

    const body = {
      subscription: {
        contentId,
        recipient: { id: recipient },
        frequency,
      },
    };

    const response: Response = await fetch(
      `${this.config.apiUrl}/sites/${this.siteId}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'X-Tableau-Auth': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create subscription: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      id: data.subscription.id,
      subject: data.subscription.subject || '',
      contentId: data.subscription.contentId,
      contentType: data.subscription.contentType || 'view',
      recipient: data.subscription.recipient?.id || '',
      frequency: data.subscription.frequency || '',
    };
  }

  /**
   * Generate trusted ticket for Tableau embed.
   * @param username User identifier
   * @param siteId Site identifier (optional)
   * @returns Trusted ticket
   */
  async generateTrustedTicket(username: string, siteId?: string): Promise<TableauTrustedTicket> {
    const token: string = await this.config.credentials.trustedTicketToken || '';

    if (!token) {
      throw new Error('Trusted ticket token not configured');
    }

    const body = new URLSearchParams();
    body.append('username', username);
    if (siteId) {
      body.append('siteid', siteId);
    }

    const response: Response = await fetch(
      `${this.config.instanceUrl}/api/auth/v1.0/trusted-ticket`,
      {
        method: 'POST',
        body,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to generate trusted ticket: ${response.statusText}`);
    }

    const ticket: string = await response.text();

    return {
      ticket,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minute TTL
      username,
      siteId,
    };
  }

  /**
   * Generate embed URL for view with trusted ticket.
   * @param viewId View identifier
   * @param username User identifier
   * @returns Full embed URL
   */
  async generateEmbedUrl(viewId: string, username: string): Promise<string> {
    const trustedTicket: TableauTrustedTicket = await this.generateTrustedTicket(username);

    return `${this.config.instanceUrl}/#/views/${viewId}?:ticket=${trustedTicket.ticket}`;
  }

  /**
   * Query a view with optional filters.
   * @param viewId View identifier
   * @param filters Optional filter definitions
   * @returns Query result
   */
  async queryView(viewId: string, filters?: FilterDefinition[]): Promise<QueryResult> {
    const token: string = await this.authenticate();

    let url: string = `${this.config.apiUrl}/sites/${this.siteId}/views/${viewId}/data`;

    if (filters && filters.length > 0) {
      const queryParams: string[] = filters.map(
        (f: FilterDefinition) =>
          `${encodeURIComponent(f.field)}=${encodeURIComponent(String(f.value))}`
      );
      url += '?' + queryParams.join('&');
    }

    const response: Response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Tableau-Auth': token,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to query view: ${response.statusText}`);
    }

    const data: any = await response.json();

    return {
      executionId: `tableau-${viewId}-${Date.now()}`,
      columns: (data.columns || []).map((col: any) => ({
        name: col.name,
        type: 'string',
      })),
      rows: data.rows || [],
      totalRowCount: data.totalRowCount,
      executionTimeMs: 0,
      fromCache: false,
    };
  }

  /**
   * Protected method: Execute query implementation for Tableau.
   */
  protected async _executeQueryImpl(query: QueryDefinition): Promise<QueryResult> {
    // For Tableau, queries map to views or direct API queries
    const result: QueryResult = await this.queryView(query.dataSource, query.filters);
    result.executionId = query.id;
    return result;
  }

  /**
   * Protected method: Create dashboard implementation for Tableau.
   */
  protected async _createDashboardImpl(
    dashboard: DashboardDefinition
  ): Promise<DashboardDefinition> {
    // Tableau dashboards are typically workbooks with multiple views
    // This would create a new workbook with the specified configuration
    const token: string = await this.authenticate();

    const body = {
      dashboard: {
        name: dashboard.name,
        description: dashboard.description,
        tags: dashboard.tags || [],
      },
    };

    const response: Response = await fetch(
      `${this.config.apiUrl}/sites/${this.siteId}/dashboards`,
      {
        method: 'POST',
        headers: {
          'X-Tableau-Auth': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create dashboard: ${response.statusText}`);
    }

    dashboard.id = `tableau-${Date.now()}`;
    return dashboard;
  }

  /**
   * Protected method: Get dashboard implementation for Tableau.
   */
  protected async _getDashboardImpl(dashboardId: string): Promise<DashboardDefinition> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `${this.config.apiUrl}/sites/${this.siteId}/dashboards/${dashboardId}`,
      {
        method: 'GET',
        headers: {
          'X-Tableau-Auth': token,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get dashboard: ${response.statusText}`);
    }

    const data: any = await response.json();

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      widgets: [],
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  /**
   * Protected method: Update dashboard implementation for Tableau.
   */
  protected async _updateDashboardImpl(
    dashboardId: string,
    updates: Partial<DashboardDefinition>
  ): Promise<DashboardDefinition> {
    const token: string = await this.authenticate();

    const body = {
      dashboard: {
        name: updates.name,
        description: updates.description,
      },
    };

    const response: Response = await fetch(
      `${this.config.apiUrl}/sites/${this.siteId}/dashboards/${dashboardId}`,
      {
        method: 'PUT',
        headers: {
          'X-Tableau-Auth': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update dashboard: ${response.statusText}`);
    }

    return this._getDashboardImpl(dashboardId);
  }

  /**
   * Protected method: Delete dashboard implementation for Tableau.
   */
  protected async _deleteDashboardImpl(dashboardId: string): Promise<void> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `${this.config.apiUrl}/sites/${this.siteId}/dashboards/${dashboardId}`,
      {
        method: 'DELETE',
        headers: {
          'X-Tableau-Auth': token,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete dashboard: ${response.statusText}`);
    }
  }

  /**
   * Protected method: Generate embed token implementation for Tableau.
   */
  protected async _generateEmbedTokenImpl(
    entityId: string,
    userId: string,
    scopes: EmbedScope[],
    rlsRules?: RLSRule[],
    expiryMinutes: number = 60
  ): Promise<EmbedToken> {
    const trustedTicket: TableauTrustedTicket = await this.generateTrustedTicket(userId);

    return {
      id: `tableau-token-${Date.now()}`,
      token: trustedTicket.ticket,
      entityId,
      entityType: 'view',
      userId,
      scopes,
      rlsRules,
      expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
      createdAt: new Date(),
    };
  }

  /**
   * Protected method: Export dashboard implementation for Tableau.
   */
  protected async _exportDashboardImpl(
    entityId: string,
    format: AnalyticsExportFormat,
    _filters?: FilterDefinition[]
  ): Promise<ExportResult> {
    const token: string = await this.authenticate();

    let mimeType: string;
    switch (format) {
      case 'pdf':
        mimeType = 'application/pdf';
        break;
      case 'png':
        mimeType = 'image/png';
        break;
      case 'csv':
        mimeType = 'text/csv';
        break;
      default:
        mimeType = 'application/octet-stream';
    }

    const response: Response = await fetch(
      `${this.config.apiUrl}/sites/${this.siteId}/views/${entityId}/${format}`,
      {
        method: 'GET',
        headers: {
          'X-Tableau-Auth': token,
          'Accept': mimeType,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to export dashboard: ${response.statusText}`);
    }

    const buffer: Buffer = Buffer.from(await response.arrayBuffer());

    return {
      jobId: `export-${Date.now()}`,
      format,
      fileSizeBytes: buffer.length,
      status: 'completed',
      completedAt: new Date(),
    };
  }

  /**
   * Protected method: Health check implementation for Tableau.
   */
  protected async _healthCheckImpl(): Promise<HealthCheckResult> {
    try {
      const token: string = await this.authenticate();

      const response: Response = await fetch(
        `${this.config.apiUrl}/sites/${this.siteId}/datasources`,
        {
          method: 'GET',
          headers: {
            'X-Tableau-Auth': token,
          },
        }
      );

      return {
        healthy: response.ok,
        authenticated: true,
        responseTimeMs: 0,
      };
    } catch (error: unknown) {
      const message: string = error instanceof Error ? error.message : String(error);
      return {
        healthy: false,
        authenticated: false,
        responseTimeMs: 0,
        errorMessage: message,
      };
    }
  }

  private _buildSigninXml(username: string, token: string, contentUrl: string): string {
    return `<?xml version='1.0' encoding='UTF-8'?>
      <tsRequest xmlns="http://tableauserverclient.com/api"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:schemaLocation="http://tableauserverclient.com/api
                http://tableauserverclient.com/api/ts-api-2.0.xsd">
        <credentials personalAccessTokenName="${username}" personalAccessTokenSecret="${token}">
          <site contentUrl="${contentUrl}"/>
        </credentials>
      </tsRequest>`;
  }
}
