/**
 * Admin UI component types
 */

export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ServiceHealthData {
  id: string;
  name: string;
  status: ServiceStatus;
  uptimePercentage: number;
  responseTimeMs: number;
  lastCheckAt: Date;
  responseTimeHistory: number[];
}

export type IntegrationProvider =
  | 'shopify'
  | 'woocommerce'
  | 'stripe'
  | 'paypal'
  | 'slack'
  | 'twilio'
  | 'sendgrid'
  | 'custom';

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'syncing';

export interface IntegrationStatusData {
  id: string;
  provider: IntegrationProvider;
  name: string;
  status: ConnectionStatus;
  lastSyncAt?: Date;
  successRate: number;
  errorCount: number;
  errors?: IntegrationError[];
}

export interface IntegrationError {
  timestamp: Date;
  message: string;
  code?: string;
}

export type ActivityAction = 'login' | 'create' | 'update' | 'delete' | 'export' | 'import';

export interface ActivityEntry {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  action: ActivityAction;
  resource: string;
  resourceType: string;
  timestamp: Date;
  details?: string;
}

export interface ServiceHealthCardProps {
  data: ServiceHealthData;
  className?: string;
}

export interface IntegrationStatusRowProps {
  data: IntegrationStatusData;
  onTest?: (integrationId: string) => void;
  onReconfigure?: (integrationId: string) => void;
  className?: string;
}

export interface ActivityTimelineProps {
  activities: ActivityEntry[];
  onActivityClick?: (activity: ActivityEntry) => void;
  className?: string;
}
