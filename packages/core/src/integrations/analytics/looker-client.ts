/**
 * Looker Analytics Adapter
 *
 * Integrates with Looker API 4.0 for:
 * - OAuth2 client credentials authentication
 * - Look/Dashboard CRUD operations
 * - Running queries and explores
 * - Explore metadata and model set management
 * - Scheduled plans (email, S3, webhook)
 * - System activity tracking
 * - Content access management
 */

import { AnalyticsAdapter } from './analytics-adapter.js';
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
  DataType,
  FilterDefinition,
} from './types.js';

interface LookerLook {
  id: string;
  title: string;
  description?: string;
  model: string;
  explore: string;
  query_id?: string;
  user_id?: string;
  created_at: Date;
  updated_at: Date;
}

interface LookerDashboard {
  id: string;
  title: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
  dashboard_elements: LookerDashboardElement[];
}

interface LookerDashboardElement {
  id: string;
  title?: string;
  query_id?: string;
  look_id?: string;
  subtitle_text?: string;
}

interface LookerExplore {
  name: string;
  model: string;
  description?: string;
  view_name: string;
  fields?: LookerField[];
}

interface LookerField {
  name: string;
  field_type: string;
  type: string;
  description?: string;
  label?: string;
}

interface LookerQuery {
  id: string;
  model: string;
  explore: string;
  dimensions: string[];
  measures: string[];
  filters?: string[];
  limit?: number;
}

interface LookerQueryResult {
  query_id: string;
  data: Record<string, unknown>[];
  fields: Array<{ name: string; type: DataType }>;
}

interface LookerScheduledPlan {
  id: string;
  name: string;
  look_id?: string;
  dashboard_id?: string;
  query_id?: string;
  frequency: string;
  cron_expression?: string;
  next_run_time?: string;
  scheduled_plan_destination?: LookerScheduledPlanDestination[];
}

interface LookerScheduledPlanDestination {
  type: 'email' | 's3' | 'webhook';
  address?: string;
  parameters?: Record<string, unknown>;
}

interface LookerModel {
  name: string;
  project_name: string;
  explores: LookerExplore[];
}

interface LookerUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

/**
 * Looker analytics adapter using API 4.0.
 * Supports OAuth2 client credentials authentication.
 */
export class LookerClient extends AnalyticsAdapter {
  private accessToken: string = '';
  private tokenExpiresAt: number = 0;

  constructor(config: AnalyticsConfig) {
    super(config);
  }

  /**
   * Authenticate with Looker using OAuth2 client credentials.
   * @returns Access token for subsequent API calls
   */
  async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const clientId: string = this.config.credentials.clientId || '';
    const clientSecret: string = this.config.credentials.clientSecret || '';

    if (!clientId || !clientSecret) {
      throw new Error('Looker authentication requires clientId and clientSecret');
    }

    try {
      const body = new URLSearchParams();
      body.append('client_id', clientId);
      body.append('client_secret', clientSecret);

      const response: Response = await fetch(
        `${this.config.apiUrl}/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        }
      );

      if (!response.ok) {
        throw new Error(`Looker authentication failed: ${response.statusText}`);
      }

      const data: any = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

      return this.accessToken;
    } catch (error: unknown) {
      throw new Error(
        `Looker authentication error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get list of looks (saved queries).
   * @returns Array of looks
   */
  async getLooks(): Promise<LookerLook[]> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(`${this.config.apiUrl}/looks`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch looks: ${response.statusText}`);
    }

    const data: any = await response.json();
    return (
      data?.map((look: any) => ({
        id: look.id,
        title: look.title,
        description: look.description,
        model: look.model,
        explore: look.explore,
        query_id: look.query_id,
        user_id: look.user_id,
        created_at: new Date(look.created_at),
        updated_at: new Date(look.updated_at),
      })) || []
    );
  }

  /**
   * Get look by ID.
   * @param lookId Look identifier
   * @returns Look definition
   */
  async getLook(lookId: string): Promise<LookerLook> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(`${this.config.apiUrl}/looks/${lookId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch look: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      model: data.model,
      explore: data.explore,
      query_id: data.query_id,
      user_id: data.user_id,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  }

  /**
   * Create a new look (saved query).
   * @param look Look definition
   * @returns Created look
   */
  async createLook(look: Omit<LookerLook, 'id' | 'created_at' | 'updated_at'>): Promise<LookerLook> {
    const token: string = await this.authenticate();

    const body = {
      title: look.title,
      description: look.description,
      model: look.model,
      explore: look.explore,
      query_id: look.query_id,
    };

    const response: Response = await fetch(`${this.config.apiUrl}/looks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to create look: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      model: data.model,
      explore: data.explore,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  }

  /**
   * Get dashboards.
   * @returns Array of dashboards
   */
  async getDashboards(): Promise<LookerDashboard[]> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(`${this.config.apiUrl}/dashboards`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch dashboards: ${response.statusText}`);
    }

    const data: any = await response.json();
    return (
      data?.map((dashboard: any) => ({
        id: dashboard.id,
        title: dashboard.title,
        description: dashboard.description,
        created_at: new Date(dashboard.created_at),
        updated_at: new Date(dashboard.updated_at),
        dashboard_elements: dashboard.dashboard_elements || [],
      })) || []
    );
  }

  /**
   * Get dashboard by ID.
   * @param dashboardId Dashboard identifier
   * @returns Dashboard definition
   */
  private async _fetchLookerDashboard(dashboardId: string): Promise<LookerDashboard> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `${this.config.apiUrl}/dashboards/${dashboardId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch dashboard: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
      dashboard_elements: data.dashboard_elements || [],
    };
  }

  /**
   * Get explore metadata for a model.
   * @param modelName Model name
   * @param exploreName Explore name
   * @returns Explore metadata
   */
  async getExplore(modelName: string, exploreName: string): Promise<LookerExplore> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `${this.config.apiUrl}/models/${modelName}/explores/${exploreName}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch explore: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      name: data.name,
      model: data.model_name,
      description: data.description,
      view_name: data.view_name,
      fields: (data.fields || []).map((field: any) => ({
        name: field.name,
        field_type: field.field_type,
        type: field.type,
        description: field.description,
        label: field.label,
      })),
    };
  }

  /**
   * Run a query and get results.
   * @param query Query definition
   * @returns Query result
   */
  async runQuery(query: LookerQuery): Promise<LookerQueryResult> {
    const token: string = await this.authenticate();

    const body = {
      model: query.model,
      explore: query.explore,
      dimensions: query.dimensions,
      measures: query.measures,
      filters: query.filters || {},
      limit: query.limit || 500,
      result_format: 'json',
    };

    const response: Response = await fetch(`${this.config.apiUrl}/queries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to run query: ${response.statusText}`);
    }

    const queryData: any = await response.json();
    const queryId: string = queryData.id;

    // Run the query
    const resultResponse: Response = await fetch(
      `${this.config.apiUrl}/queries/${queryId}/run/json`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!resultResponse.ok) {
      throw new Error(`Failed to run query: ${resultResponse.statusText}`);
    }

    const results: any = await resultResponse.json();

    return {
      query_id: queryId,
      data: Array.isArray(results) ? results : [],
      fields: query.dimensions.concat(query.measures).map((field: string) => ({
        name: field,
        type: 'string' as const,
      })),
    };
  }

  /**
   * Create a scheduled plan (email, S3, webhook delivery).
   * @param plan Scheduled plan definition
   * @returns Created scheduled plan
   */
  async createScheduledPlan(
    plan: Omit<LookerScheduledPlan, 'id'>
  ): Promise<LookerScheduledPlan> {
    const token: string = await this.authenticate();

    const body = {
      name: plan.name,
      look_id: plan.look_id,
      dashboard_id: plan.dashboard_id,
      query_id: plan.query_id,
      frequency: plan.frequency,
      cron_expression: plan.cron_expression,
      scheduled_plan_destination: plan.scheduled_plan_destination,
    };

    const response: Response = await fetch(`${this.config.apiUrl}/scheduled_plans`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to create scheduled plan: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      id: data.id,
      name: data.name,
      look_id: data.look_id,
      dashboard_id: data.dashboard_id,
      frequency: data.frequency,
    };
  }

  /**
   * Get system activity events.
   * @param limit Number of events to return
   * @returns Activity events
   */
  async getSystemActivity(limit: number = 100): Promise<Array<Record<string, unknown>>> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `${this.config.apiUrl}/system_activity?limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch system activity: ${response.statusText}`);
    }

    const data: any = await response.json();
    return data || [];
  }

  /**
   * Get available data sources.
   */
  async getDataSources(): Promise<DataSource[]> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(`${this.config.apiUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data: any = await response.json();
    return (
      data?.map((model: any) => ({
        id: model.name,
        name: model.name,
        type: 'model',
        tableName: model.name,
        archived: false,
        fields: [],
      })) || []
    );
  }

  /**
   * Protected method: Execute query implementation for Looker.
   */
  protected async _executeQueryImpl(query: QueryDefinition): Promise<QueryResult> {
    const lookerQuery: LookerQuery = {
      id: query.id,
      model: query.dataSource.split('.')[0] || 'default',
      explore: query.dataSource.split('.')[1] || 'main',
      dimensions: query.fields.filter((f: string) => !f.includes('_count')),
      measures: query.fields.filter((f: string) => f.includes('_count')),
      limit: query.limit || 500,
    };

    const result: LookerQueryResult = await this.runQuery(lookerQuery);

    return {
      executionId: query.id,
      columns: result.fields,
      rows: result.data,
      totalRowCount: result.data.length,
      executionTimeMs: 0,
      fromCache: false,
    };
  }

  /**
   * Protected method: Create dashboard implementation for Looker.
   */
  protected async _createDashboardImpl(
    dashboard: DashboardDefinition
  ): Promise<DashboardDefinition> {
    const token: string = await this.authenticate();

    const body = {
      title: dashboard.name,
      description: dashboard.description,
      dashboard_filters: dashboard.defaultFilters || [],
    };

    const response: Response = await fetch(`${this.config.apiUrl}/dashboards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to create dashboard: ${response.statusText}`);
    }

    const data: any = await response.json();
    dashboard.id = data.id;
    return dashboard;
  }

  /**
   * Protected method: Get dashboard implementation for Looker.
   */
  protected async _getDashboardImpl(dashboardId: string): Promise<DashboardDefinition> {
    const lookerDashboard: LookerDashboard = await this._fetchLookerDashboard(dashboardId);

    return {
      id: lookerDashboard.id,
      name: lookerDashboard.title,
      description: lookerDashboard.description,
      widgets: [],
      createdAt: lookerDashboard.created_at,
      updatedAt: lookerDashboard.updated_at,
    };
  }

  /**
   * Protected method: Update dashboard implementation for Looker.
   */
  protected async _updateDashboardImpl(
    dashboardId: string,
    updates: Partial<DashboardDefinition>
  ): Promise<DashboardDefinition> {
    const token: string = await this.authenticate();

    const body = {
      title: updates.name,
      description: updates.description,
    };

    const response: Response = await fetch(
      `${this.config.apiUrl}/dashboards/${dashboardId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
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
   * Protected method: Delete dashboard implementation for Looker.
   */
  protected async _deleteDashboardImpl(dashboardId: string): Promise<void> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `${this.config.apiUrl}/dashboards/${dashboardId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete dashboard: ${response.statusText}`);
    }
  }

  /**
   * Protected method: Generate embed token implementation for Looker.
   */
  protected async _generateEmbedTokenImpl(
    entityId: string,
    userId: string,
    _scopes: EmbedScope[],
    _rlsRules?: RLSRule[],
    expiryMinutes: number = 60
  ): Promise<EmbedToken> {
    const token: string = await this.authenticate();

    const body = {
      namespace: 'embed',
      type: 'look',
      id: entityId,
      user: userId,
    };

    const response: Response = await fetch(`${this.config.apiUrl}/embed/urls`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate embed token: ${response.statusText}`);
    }

    const data: any = await response.json();

    return {
      id: `looker-token-${Date.now()}`,
      token: data.url,
      entityId,
      entityType: 'look',
      userId,
      scopes: ['view'],
      expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
      createdAt: new Date(),
      embedUrl: data.url,
    };
  }

  /**
   * Protected method: Export dashboard implementation for Looker.
   */
  protected async _exportDashboardImpl(
    entityId: string,
    format: AnalyticsExportFormat,
    _filters?: FilterDefinition[]
  ): Promise<ExportResult> {
    const token: string = await this.authenticate();

    const response: Response = await fetch(
      `${this.config.apiUrl}/dashboards/${entityId}/export/${format}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
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
   * Protected method: Health check implementation for Looker.
   */
  protected async _healthCheckImpl(): Promise<HealthCheckResult> {
    try {
      const token: string = await this.authenticate();

      const response: Response = await fetch(`${this.config.apiUrl}/looks`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

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
}
