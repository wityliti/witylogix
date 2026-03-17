/**
 * Analytics Hooks — Dashboard, report, and data source management
 *
 * Features:
 * - useDashboards: Manage saved dashboards, create/update/delete
 * - useReports: Handle scheduled reports and report builder state
 * - useDataSources: Query available data sources and refresh status
 * - useAnalyticsMetrics: Track KPI metrics and performance data
 * - useScheduledReports: Manage report scheduling and delivery
 *
 * @example
 * ```tsx
 * const dashboards = useDashboards();
 * const reports = useReports({ page: 1 });
 * const metrics = useAnalyticsMetrics();
 * ```
 */

'use client';

import { useCallback, useEffect, useReducer, useState } from 'react';

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

export interface DashboardsState {
  dashboards: Dashboard[];
  total: number;
  isLoading: boolean;
  error: Error | null;
}

export interface ReportsState {
  reports: Report[];
  total: number;
  page: number;
  isLoading: boolean;
  error: Error | null;
}

// ─── MOCK DATA ──────────────────────────────────────────────────────

const MOCK_DASHBOARDS: Dashboard[] = [
  {
    id: 'dash-001',
    name: 'Executive Overview',
    description: 'High-level metrics for leadership',
    widgetCount: 8,
    lastModified: '2026-03-15T14:30:00Z',
    autoRefresh: true,
    refreshInterval: 300,
    owner: 'John Smith',
    isShared: true,
    viewers: 12,
  },
  {
    id: 'dash-002',
    name: 'Sales Performance',
    description: 'Regional sales and pipeline tracking',
    widgetCount: 12,
    lastModified: '2026-03-16T09:15:00Z',
    autoRefresh: true,
    refreshInterval: 600,
    owner: 'Sarah Johnson',
    isShared: true,
    viewers: 8,
  },
  {
    id: 'dash-003',
    name: 'Operations Efficiency',
    description: 'Operational metrics and bottleneck analysis',
    widgetCount: 10,
    lastModified: '2026-03-14T16:45:00Z',
    autoRefresh: false,
    refreshInterval: 0,
    owner: 'Mike Chen',
    isShared: false,
    viewers: 0,
  },
];

const MOCK_REPORTS: Report[] = [
  {
    id: 'rep-001',
    name: 'Weekly Sales Summary',
    description: 'Comprehensive sales metrics by region',
    type: 'scheduled',
    status: 'active',
    frequency: 'weekly',
    lastRun: '2026-03-16T08:00:00Z',
    nextRun: '2026-03-23T08:00:00Z',
    recipients: ['team@company.com'],
    formats: ['pdf', 'xlsx'],
  },
  {
    id: 'rep-002',
    name: 'Daily Operations Report',
    description: 'Hourly operational metrics snapshot',
    type: 'scheduled',
    status: 'active',
    frequency: 'daily',
    lastRun: '2026-03-17T06:00:00Z',
    nextRun: '2026-03-18T06:00:00Z',
    recipients: ['ops-team@company.com'],
    formats: ['pdf', 'csv'],
  },
  {
    id: 'rep-003',
    name: 'Custom Analysis',
    description: 'Ad-hoc analysis report',
    type: 'adhoc',
    status: 'draft',
    recipients: [],
    formats: ['pdf', 'xlsx', 'csv'],
  },
];

const MOCK_DATA_SOURCES: DataSource[] = [
  {
    id: 'ds-001',
    name: 'Production Database',
    type: 'database',
    status: 'connected',
    lastSync: '2026-03-17T12:45:00Z',
    syncDuration: 45,
    rowCount: 2450000,
    refreshFrequency: 'hourly',
  },
  {
    id: 'ds-002',
    name: 'CRM System',
    type: 'crm',
    status: 'syncing',
    lastSync: '2026-03-17T12:30:00Z',
    syncDuration: 120,
    rowCount: 85000,
    refreshFrequency: 'hourly',
  },
  {
    id: 'ds-003',
    name: 'Marketing API',
    type: 'api',
    status: 'connected',
    lastSync: '2026-03-17T12:00:00Z',
    syncDuration: 30,
    rowCount: 150000,
    refreshFrequency: 'daily',
  },
];

const MOCK_METRICS: AnalyticsMetric[] = [
  {
    id: 'metric-001',
    name: 'Active Dashboards',
    value: 45,
    unit: 'dashboards',
    trend: 12,
    trendLabel: 'vs last month',
    color: 'success',
  },
  {
    id: 'metric-002',
    name: 'Scheduled Reports',
    value: 28,
    unit: 'reports',
    trend: 5,
    trendLabel: 'vs last month',
    color: 'success',
  },
  {
    id: 'metric-003',
    name: 'Data Freshness',
    value: 99.2,
    unit: '%',
    trend: 0.8,
    trendLabel: 'improvement',
    color: 'success',
  },
  {
    id: 'metric-004',
    name: 'Query Performance',
    value: 1240,
    unit: 'ms',
    trend: -15,
    trendLabel: 'faster',
    color: 'success',
  },
  {
    id: 'metric-005',
    name: 'Active Users',
    value: 157,
    unit: 'users',
    trend: 8,
    trendLabel: 'today',
    color: 'info',
  },
  {
    id: 'metric-006',
    name: 'Total Anomalies',
    value: 3,
    unit: 'detected',
    trend: -2,
    trendLabel: 'vs yesterday',
    color: 'warning',
  },
];

const MOCK_SCHEDULED_REPORTS: ScheduledReport[] = [
  {
    id: 'sched-001',
    name: 'Weekly Executive Brief',
    frequency: 'weekly',
    nextRun: '2026-03-23T08:00:00Z',
    recipients: ['executive@company.com'],
    isActive: true,
    deliveryTime: '08:00 AM EST',
  },
  {
    id: 'sched-002',
    name: 'Daily Operations Summary',
    frequency: 'daily',
    nextRun: '2026-03-18T06:00:00Z',
    recipients: ['ops@company.com'],
    isActive: true,
    deliveryTime: '06:00 AM EST',
  },
  {
    id: 'sched-003',
    name: 'Monthly Financial Review',
    frequency: 'monthly',
    nextRun: '2026-04-01T09:00:00Z',
    recipients: ['finance@company.com'],
    isActive: true,
    deliveryTime: '09:00 AM EST',
  },
];

// ─── HOOKS ──────────────────────────────────────────────────────────

export function useDashboards() {
  const [state, setState] = useState<DashboardsState>({
    dashboards: MOCK_DASHBOARDS,
    total: MOCK_DASHBOARDS.length,
    isLoading: false,
    error: null,
  });

  const createDashboard = useCallback(
    (name: string, description: string) => {
      const newDashboard: Dashboard = {
        id: `dash-${Date.now()}`,
        name,
        description,
        widgetCount: 0,
        lastModified: new Date().toISOString(),
        autoRefresh: true,
        refreshInterval: 300,
        owner: 'Current User',
        isShared: false,
        viewers: 0,
      };
      setState((prev) => ({
        ...prev,
        dashboards: [...prev.dashboards, newDashboard],
        total: prev.total + 1,
      }));
      return newDashboard;
    },
    []
  );

  const updateDashboard = useCallback((id: string, updates: Partial<Dashboard>) => {
    setState((prev) => ({
      ...prev,
      dashboards: prev.dashboards.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    }));
  }, []);

  const deleteDashboard = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      dashboards: prev.dashboards.filter((d) => d.id !== id),
      total: prev.total - 1,
    }));
  }, []);

  return {
    ...state,
    createDashboard,
    updateDashboard,
    deleteDashboard,
  };
}

export function useReports({ page = 1 }: { page?: number } = {}) {
  const [state, setState] = useState<ReportsState>({
    reports: MOCK_REPORTS,
    total: MOCK_REPORTS.length,
    page,
    isLoading: false,
    error: null,
  });

  const createReport = useCallback((name: string, type: Report['type']) => {
    const newReport: Report = {
      id: `rep-${Date.now()}`,
      name,
      description: '',
      type,
      status: 'draft',
      recipients: [],
      formats: ['pdf'],
    };
    setState((prev) => ({
      ...prev,
      reports: [...prev.reports, newReport],
      total: prev.total + 1,
    }));
    return newReport;
  }, []);

  const updateReport = useCallback((id: string, updates: Partial<Report>) => {
    setState((prev) => ({
      ...prev,
      reports: prev.reports.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }));
  }, []);

  const deleteReport = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      reports: prev.reports.filter((r) => r.id !== id),
      total: prev.total - 1,
    }));
  }, []);

  return {
    ...state,
    createReport,
    updateReport,
    deleteReport,
  };
}

export function useDataSources() {
  const [dataSources, setDataSources] = useState<DataSource[]>(MOCK_DATA_SOURCES);
  const [isLoading, setIsLoading] = useState(false);

  const refreshDataSource = useCallback((id: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setDataSources((prev) =>
        prev.map((ds) =>
          ds.id === id
            ? {
                ...ds,
                lastSync: new Date().toISOString(),
                status: 'connected',
              }
            : ds
        )
      );
      setIsLoading(false);
    }, 2000);
  }, []);

  return {
    dataSources,
    isLoading,
    refreshDataSource,
  };
}

export function useAnalyticsMetrics() {
  const [metrics, setMetrics] = useState<AnalyticsMetric[]>(MOCK_METRICS);

  return {
    metrics,
  };
}

export function useScheduledReports() {
  const [reports, setReports] = useState<ScheduledReport[]>(MOCK_SCHEDULED_REPORTS);

  const updateSchedule = useCallback((id: string, updates: Partial<ScheduledReport>) => {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  }, []);

  const deleteSchedule = useCallback((id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return {
    reports,
    updateSchedule,
    deleteSchedule,
  };
}
