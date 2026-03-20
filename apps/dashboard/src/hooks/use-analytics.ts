'use client';

import { useApiList, useApiQuery, useApiMutation, ApiFilters, UseApiQueryResult, UseApiListResult, UseApiMutationResult } from './use-api';

// ─── TYPES ──────────────────────────────────────────────────────────

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgetCount: number;
  lastModified: string;
  autoRefresh: boolean;
  refreshInterval: number;
  owner: string;
  isShared: boolean;
  viewers: number;
}

export interface Report {
  id: string;
  name: string;
  description: string;
  type: 'scheduled' | 'adhoc';
  status: 'draft' | 'active' | 'paused';
  frequency?: 'daily' | 'weekly' | 'monthly';
  lastRun?: string;
  nextRun?: string;
  recipients: string[];
  formats: ('pdf' | 'csv' | 'xlsx')[];
}

export interface DataSource {
  id: string;
  name: string;
  type: 'database' | 'api' | 'file' | 'crm';
  status: 'connected' | 'error' | 'syncing';
  lastSync: string;
  syncDuration: number;
  rowCount: number;
  refreshFrequency: 'hourly' | 'daily' | 'weekly';
}

export interface AnalyticsMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  trend: number;
  trendLabel: string;
  color: 'success' | 'warning' | 'danger' | 'info' | 'primary';
}

export interface ScheduledReport {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  nextRun: string;
  recipients: string[];
  isActive: boolean;
  deliveryTime?: string;
}

// ─── HOOKS ──────────────────────────────────────────────────────────

export function useDashboards(filters?: ApiFilters): UseApiListResult<Dashboard> {
  return useApiList<Dashboard>('/api/v4/dashboards', filters);
}

export function useDashboard(id: string | null): UseApiQueryResult<Dashboard> {
  return useApiQuery<Dashboard>(id ? `/api/v4/dashboards/${id}` : null);
}

export function useCreateDashboard(): UseApiMutationResult<Dashboard> {
  return useApiMutation<Dashboard>('POST', '/api/v4/dashboards');
}

export function useUpdateDashboard(id: string): UseApiMutationResult<Dashboard> {
  return useApiMutation<Dashboard>('PATCH', `/api/v4/dashboards/${id}`);
}

export function useDeleteDashboard(id: string): UseApiMutationResult<void> {
  return useApiMutation<void>('DELETE', `/api/v4/dashboards/${id}`);
}

export function useReports(filters?: ApiFilters): UseApiListResult<Report> {
  return useApiList<Report>('/api/v4/reports', filters);
}

export function useReport(id: string | null): UseApiQueryResult<Report> {
  return useApiQuery<Report>(id ? `/api/v4/reports/${id}` : null);
}

export function useCreateReport(): UseApiMutationResult<Report> {
  return useApiMutation<Report>('POST', '/api/v4/reports');
}

export function useUpdateReport(id: string): UseApiMutationResult<Report> {
  return useApiMutation<Report>('PATCH', `/api/v4/reports/${id}`);
}

export function useDeleteReport(id: string): UseApiMutationResult<void> {
  return useApiMutation<void>('DELETE', `/api/v4/reports/${id}`);
}

export function useDataSources(filters?: ApiFilters): UseApiListResult<DataSource> {
  return useApiList<DataSource>('/api/v4/data-sources', filters);
}

export function useAnalyticsMetrics(): UseApiQueryResult<AnalyticsMetric[]> {
  return useApiQuery<AnalyticsMetric[]>('/api/v4/analytics/metrics');
}

export function useScheduledReports(filters?: ApiFilters): UseApiListResult<ScheduledReport> {
  return useApiList<ScheduledReport>('/api/v4/scheduled-reports', filters);
}

export function useUpdateScheduledReport(id: string): UseApiMutationResult<ScheduledReport> {
  return useApiMutation<ScheduledReport>('PATCH', `/api/v4/scheduled-reports/${id}`);
}

export function useDeleteScheduledReport(id: string): UseApiMutationResult<void> {
  return useApiMutation<void>('DELETE', `/api/v4/scheduled-reports/${id}`);
}
