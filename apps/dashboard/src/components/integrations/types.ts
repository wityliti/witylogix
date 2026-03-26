/**
 * Integration UI component types
 */

export type IntegrationProvider =
  | 'shopify'
  | 'woocommerce'
  | 'stripe'
  | 'paypal'
  | 'slack'
  | 'twilio'
  | 'sendgrid'
  | 'zapier'
  | 'make'
  | 'custom';

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'paused';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export type AuthType = 'api-key' | 'oauth2' | 'basic' | 'bearer';

export type IntegrationCategory = 'ecommerce' | 'payment' | 'communication' | 'automation' | 'analytics';

export type SyncDirection = 'inbound' | 'outbound' | 'bidirectional';

export interface CredentialField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'url';
  required: boolean;
  placeholder?: string;
  pattern?: string;
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
  docLink?: string;
}

export interface CredentialConfig {
  authType: AuthType;
  fields: CredentialField[];
  testEndpoint?: string;
  oauthConfig?: {
    clientId: string;
    redirectUri: string;
    scopes: string[];
  };
}

export interface WebhookConfig {
  url: string;
  secretKey: string;
  events: string[];
  active: boolean;
  retryConfig: {
    maxAttempts: number;
    backoffStrategy: 'exponential' | 'linear';
    retryIntervalSeconds: number;
  };
}

export interface RateLimitInfo {
  current: number;
  limit: number;
  resetAt: Date;
  burstLimit?: number;
  burstCurrent?: number;
}

export interface ProviderMetrics {
  requestCount: number;
  errorCount: number;
  averageLatencyMs: number;
  successRate: number;
  lastRequestAt?: Date;
  requestTrend: number[]; // Last 24 hours hourly counts
}

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  checkedAt: Date;
}

export interface SyncLog {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  status: SyncStatus;
  recordsSynced: number;
  recordsFailed: number;
  recordsSkipped: number;
  errorMessage?: string;
}

export interface IntegrationProvider {
  id: string;
  name: string;
  provider: IntegrationProvider;
  category: IntegrationCategory;
  status: ConnectionStatus;
  isActive: boolean;
  metrics: ProviderMetrics;
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  syncStatus?: SyncStatus;
  credentialConfig?: CredentialConfig;
  webhookConfig?: WebhookConfig;
  rateLimit?: RateLimitInfo;
  healthChecks?: HealthCheckResult[];
  errors?: Array<{ timestamp: Date; message: string; code?: string }>;
}

export interface ProviderCardProps {
  provider: IntegrationProvider;
  onConfigure?: (providerId: string) => void;
  onTest?: (providerId: string) => void;
  onDisconnect?: (providerId: string) => void;
  className?: string;
}

export interface CredentialFormProps {
  credentialConfig: CredentialConfig;
  providerId: string;
  onSave?: (credentials: Record<string, unknown>) => void;
  onCancel?: () => void;
  onTest?: (credentials: Record<string, unknown>) => void;
  className?: string;
}

export interface WebhookConfigProps {
  webhookConfig: WebhookConfig;
  providerId: string;
  onSave?: (config: WebhookConfig) => void;
  onTest?: (url: string) => void;
  className?: string;
}

export interface HealthMonitorProps {
  providerId: string;
  healthChecks: HealthCheckResult[];
  responseTimeHistory: number[];
  errorRateHistory: number[];
  onCheckNow?: (providerId: string) => void;
  className?: string;
}

export interface RateLimitDisplayProps {
  rateLimit: RateLimitInfo;
  endpoints?: Array<{
    name: string;
    current: number;
    limit: number;
  }>;
  className?: string;
}

export interface SyncStatusCardProps {
  syncStatus: SyncStatus;
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  recordsSynced: number;
  recordsFailed: number;
  recordsSkipped: number;
  syncDirection: SyncDirection;
  errors?: Array<{ timestamp: Date; message: string }>;
  onTriggerSync?: () => void;
  className?: string;
}

export interface ConnectionWizardProps {
  providers: IntegrationProvider[];
  onComplete?: (providerId: string, config: ConnectionWizardConfig) => void;
  onCancel?: () => void;
  className?: string;
}

export interface ConnectionWizardConfig {
  credentials: Record<string, unknown>;
  syncConfig: {
    entities: string[];
    direction: SyncDirection;
    scheduleInterval: number; // minutes
  };
}

export interface ApiUsageChartProps {
  data: ApiUsageDataPoint[];
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
  onTimeRangeChange?: (range: '1h' | '6h' | '24h' | '7d' | '30d') => void;
  className?: string;
}

export interface ApiUsageDataPoint {
  timestamp: Date;
  requests: number;
  errors: number;
}

export interface ProviderComparisonProps {
  providers: IntegrationProvider[];
  metrics: 'latency' | 'uptime' | 'cost' | 'features' | 'rate-limits';
  maxCompare?: number;
  className?: string;
}
