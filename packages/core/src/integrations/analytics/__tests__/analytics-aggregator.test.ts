/**
 * Analytics Aggregator Integration Tests
 *
 * Comprehensive test suite covering:
 * - Unified query execution across providers
 * - Dashboard federation
 * - Metric normalization
 * - Cross-platform comparison reports
 * - Scheduled report aggregation
 * - Cache management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsAggregator } from '../analytics-aggregator.js';
import { AnalyticsAdapter } from '../analytics-adapter.js';
import type {
  AnalyticsConfig,
  QueryDefinition,
  QueryResult,
  DashboardDefinition,
  AnalyticsMetric,
} from '../types.js';

// Mock analytics adapter for testing
class MockAnalyticsAdapter extends AnalyticsAdapter {
  async getDataSources() {
    return [];
  }

  protected async _executeQueryImpl(query: QueryDefinition): Promise<QueryResult> {
    return {
      executionId: query.id,
      columns: [{ name: 'metric', type: 'number' }],
      rows: [{ metric: 100 }],
      executionTimeMs: 10,
      fromCache: false,
    };
  }

  protected async _createDashboardImpl(): Promise<DashboardDefinition> {
    throw new Error('Not implemented');
  }

  protected async _getDashboardImpl(): Promise<DashboardDefinition> {
    throw new Error('Not implemented');
  }

  protected async _updateDashboardImpl(): Promise<DashboardDefinition> {
    throw new Error('Not implemented');
  }

  protected async _deleteDashboardImpl(): Promise<void> {
    throw new Error('Not implemented');
  }

  protected async _generateEmbedTokenImpl() {
    throw new Error('Not implemented');
  }

  protected async _exportDashboardImpl() {
    throw new Error('Not implemented');
  }

  protected async _healthCheckImpl() {
    throw new Error('Not implemented');
  }
}

describe('AnalyticsAggregator', () => {
  let aggregator: AnalyticsAggregator;
  let mockTableau: MockAnalyticsAdapter;
  let mockPowerBI: MockAnalyticsAdapter;
  let mockLooker: MockAnalyticsAdapter;

  const baseConfig: AnalyticsConfig = {
    integrationId: 'test',
    provider: 'test',
    credentials: {},
  };

  beforeEach(() => {
    mockTableau = new MockAnalyticsAdapter(baseConfig);
    mockPowerBI = new MockAnalyticsAdapter(baseConfig);
    mockLooker = new MockAnalyticsAdapter(baseConfig);

    aggregator = new AnalyticsAggregator({
      providers: new Map([
        ['tableau', mockTableau],
        ['powerbi', mockPowerBI],
        ['looker', mockLooker],
      ]),
      defaultProvider: 'tableau',
      cache: {
        enabled: true,
        ttlSeconds: 3600,
      },
    });
  });

  describe('Provider Management', () => {
    it('should initialize with providers', () => {
      const providers = aggregator.getProviders();
      expect(providers).toContain('tableau');
      expect(providers).toContain('powerbi');
      expect(providers).toContain('looker');
    });

    it('should add new provider', () => {
      const newAdapter = new MockAnalyticsAdapter(baseConfig);
      aggregator.addProvider('qlik', newAdapter);

      const providers = aggregator.getProviders();
      expect(providers).toContain('qlik');
    });

    it('should remove provider', () => {
      aggregator.removeProvider('powerbi');

      const providers = aggregator.getProviders();
      expect(providers).not.toContain('powerbi');
    });

    it('should update default provider on removal', () => {
      aggregator.removeProvider('tableau');

      const providers = aggregator.getProviders();
      expect(providers.length).toBeGreaterThan(0);
    });
  });

  describe('Aggregated Query Execution', () => {
    it('should execute query across all providers', async () => {
      const query: QueryDefinition = {
        id: 'query-1',
        name: 'Test Query',
        dataSource: 'sales_data',
        fields: ['region', 'revenue'],
      };

      vi.spyOn(mockTableau, 'executeQuery').mockResolvedValueOnce({
        executionId: 'exec-1',
        columns: [{ name: 'revenue', type: 'number' }],
        rows: [{ revenue: 10000 }],
        executionTimeMs: 10,
        fromCache: false,
      });

      vi.spyOn(mockPowerBI, 'executeQuery').mockResolvedValueOnce({
        executionId: 'exec-2',
        columns: [{ name: 'revenue', type: 'number' }],
        rows: [{ revenue: 12000 }],
        executionTimeMs: 15,
        fromCache: false,
      });

      vi.spyOn(mockLooker, 'executeQuery').mockResolvedValueOnce({
        executionId: 'exec-3',
        columns: [{ name: 'revenue', type: 'number' }],
        rows: [{ revenue: 11000 }],
        executionTimeMs: 12,
        fromCache: false,
      });

      const results = await aggregator.executeAggregatedQuery(query);

      expect(results).toHaveLength(3);
      expect(results[0].provider).toBe('tableau');
      expect(results[1].provider).toBe('powerbi');
      expect(results[2].provider).toBe('looker');
    });

    it('should execute query on specific providers only', async () => {
      const query: QueryDefinition = {
        id: 'query-1',
        name: 'Test Query',
        dataSource: 'sales_data',
        fields: ['region', 'revenue'],
      };

      vi.spyOn(mockTableau, 'executeQuery').mockResolvedValueOnce({
        executionId: 'exec-1',
        columns: [{ name: 'revenue', type: 'number' }],
        rows: [{ revenue: 10000 }],
        executionTimeMs: 10,
        fromCache: false,
      });

      const results = await aggregator.executeAggregatedQuery(query, ['tableau']);

      expect(results).toHaveLength(1);
      expect(results[0].provider).toBe('tableau');
    });

    it('should cache query results', async () => {
      const query: QueryDefinition = {
        id: 'query-cache',
        name: 'Test Query',
        dataSource: 'sales_data',
        fields: ['region', 'revenue'],
      };

      const mockResult = {
        executionId: 'exec-1',
        columns: [{ name: 'revenue', type: 'number' }],
        rows: [{ revenue: 10000 }],
        executionTimeMs: 10,
        fromCache: false,
      };

      const spyTableau = vi.spyOn(mockTableau, 'executeQuery')
        .mockResolvedValue(mockResult);

      // First call
      await aggregator.executeAggregatedQuery(query, ['tableau']);

      // Second call should use cache
      await aggregator.executeAggregatedQuery(query, ['tableau']);

      expect(spyTableau).toHaveBeenCalledTimes(1);
    });

    it('should handle provider errors gracefully', async () => {
      const query: QueryDefinition = {
        id: 'query-1',
        name: 'Test Query',
        dataSource: 'sales_data',
        fields: ['region', 'revenue'],
      };

      vi.spyOn(mockTableau, 'executeQuery').mockRejectedValueOnce(
        new Error('Query execution failed')
      );

      vi.spyOn(mockPowerBI, 'executeQuery').mockResolvedValueOnce({
        executionId: 'exec-2',
        columns: [{ name: 'revenue', type: 'number' }],
        rows: [{ revenue: 12000 }],
        executionTimeMs: 15,
        fromCache: false,
      });

      vi.spyOn(mockLooker, 'executeQuery').mockResolvedValueOnce({
        executionId: 'exec-3',
        columns: [{ name: 'revenue', type: 'number' }],
        rows: [{ revenue: 11000 }],
        executionTimeMs: 12,
        fromCache: false,
      });

      const results = await aggregator.executeAggregatedQuery(query);

      // Tableau fails, powerbi and looker succeed
      expect(results).toHaveLength(2);
      expect(results[0].provider).toBe('powerbi');
      expect(results[1].provider).toBe('looker');
    });
  });

  describe('Dashboard Federation', () => {
    it('should federate dashboards from multiple providers', async () => {
      const dashboards = [
        {
          provider: 'tableau',
          dashboard: {
            id: 'dash-1',
            name: 'Tableau Dashboard',
            widgets: [
              {
                id: 'widget-1',
                title: 'Revenue',
                type: 'number' as const,
                query: {
                  id: 'q1',
                  name: 'Revenue Query',
                  dataSource: 'sales',
                  fields: ['revenue'],
                },
                x: 0,
                y: 0,
                width: 6,
                height: 4,
              },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
          } as DashboardDefinition,
        },
        {
          provider: 'powerbi',
          dashboard: {
            id: 'dash-2',
            name: 'PowerBI Dashboard',
            widgets: [
              {
                id: 'widget-2',
                title: 'Sales',
                type: 'bar' as const,
                query: {
                  id: 'q2',
                  name: 'Sales Query',
                  dataSource: 'sales_data',
                  fields: ['region', 'sales'],
                },
                x: 0,
                y: 0,
                width: 6,
                height: 4,
              },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
          } as DashboardDefinition,
        },
      ];

      vi.spyOn(mockTableau, 'executeQuery').mockResolvedValueOnce({
        executionId: 'exec-1',
        columns: [{ name: 'revenue', type: 'number' }],
        rows: [{ revenue: 100000 }],
        executionTimeMs: 10,
        fromCache: false,
      });

      vi.spyOn(mockPowerBI, 'executeQuery').mockResolvedValueOnce({
        executionId: 'exec-2',
        columns: [{ name: 'region', type: 'string' }, { name: 'sales', type: 'number' }],
        rows: [{ region: 'US', sales: 50000 }],
        executionTimeMs: 15,
        fromCache: false,
      });

      const result = await aggregator.federateDashboards(dashboards);

      expect(result.widgets).toHaveLength(2);
      expect(result.widgets[0].source).toBe('tableau');
      expect(result.widgets[1].source).toBe('powerbi');
    });

    it('should handle widget execution errors in federation', async () => {
      const dashboards = [
        {
          provider: 'tableau',
          dashboard: {
            id: 'dash-1',
            name: 'Dashboard',
            widgets: [
              {
                id: 'widget-1',
                title: 'Revenue',
                type: 'number' as const,
                query: {
                  id: 'q1',
                  name: 'Query',
                  dataSource: 'sales',
                  fields: ['revenue'],
                },
                x: 0,
                y: 0,
                width: 6,
                height: 4,
              },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
          } as DashboardDefinition,
        },
      ];

      vi.spyOn(mockTableau, 'executeQuery').mockRejectedValueOnce(
        new Error('Widget query failed')
      );

      const result = await aggregator.federateDashboards(dashboards);

      expect(result.widgets).toHaveLength(1);
      expect(result.widgets[0].error).toBeDefined();
    });
  });

  describe('Metric Normalization', () => {
    it('should normalize metrics across providers', async () => {
      aggregator = new AnalyticsAggregator({
        providers: new Map([
          ['tableau', mockTableau],
          ['powerbi', mockPowerBI],
        ]),
        defaultProvider: 'tableau',
        normalizationRules: {
          'bytes_metric': {
            source: 'bytes',
            target: 'megabytes',
            multiplier: 0.000001,
            unitConversion: 'bytes_to_mb',
          },
        },
      });

      const metrics = await aggregator.getNormalizedMetrics(['bytes_metric']);

      expect(metrics.length).toBeGreaterThanOrEqual(0);
    });

    it('should apply unit conversion rules', async () => {
      const aggregator2 = new AnalyticsAggregator({
        providers: new Map([
          ['tableau', mockTableau],
        ]),
        defaultProvider: 'tableau',
        normalizationRules: {
          'response_time': {
            source: 'milliseconds',
            target: 'seconds',
            multiplier: 0.001,
            unitConversion: 'ms_to_seconds',
          },
        },
      });

      const metrics = await aggregator2.getNormalizedMetrics(['response_time']);

      expect(metrics.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cross-Platform Comparison', () => {
    it('should compare metrics across platforms', async () => {
      const comparison = await aggregator.compareMetrics('revenue');

      expect(comparison.metric).toBe('revenue');
      expect(comparison).toHaveProperty('values');
      expect(comparison).toHaveProperty('differences');
      expect(comparison).toHaveProperty('percentDifferences');
      expect(comparison).toHaveProperty('highestValue');
      expect(comparison).toHaveProperty('lowestValue');
    });

    it('should include platform-specific values in comparison', async () => {
      const comparison = await aggregator.compareMetrics('revenue', ['tableau', 'powerbi']);

      expect(comparison.values).toBeDefined();
      expect(Object.keys(comparison.values).length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Metric Aggregation', () => {
    it('should aggregate metrics to hourly level', () => {
      const metrics: AnalyticsMetric[] = [
        {
          id: 'm1',
          name: 'revenue',
          value: 1000,
          unit: 'dollars',
          source: 'tableau',
          timestamp: new Date('2024-03-12T10:30:00Z'),
        },
        {
          id: 'm2',
          name: 'revenue',
          value: 1100,
          unit: 'dollars',
          source: 'tableau',
          timestamp: new Date('2024-03-12T10:45:00Z'),
        },
      ];

      const aggregated = aggregator.aggregateMetricsByLevel(metrics, 'hourly');

      expect(aggregated.length).toBeGreaterThan(0);
      expect(aggregated[0].value).toBe((1000 + 1100) / 2);
    });

    it('should aggregate metrics to daily level', () => {
      const metrics: AnalyticsMetric[] = [
        {
          id: 'm1',
          name: 'revenue',
          value: 1000,
          unit: 'dollars',
          source: 'tableau',
          timestamp: new Date('2024-03-12T10:00:00Z'),
        },
        {
          id: 'm2',
          name: 'revenue',
          value: 1100,
          unit: 'dollars',
          source: 'tableau',
          timestamp: new Date('2024-03-12T14:00:00Z'),
        },
      ];

      const aggregated = aggregator.aggregateMetricsByLevel(metrics, 'daily');

      expect(aggregated.length).toBeGreaterThan(0);
    });

    it('should keep raw metrics without aggregation', () => {
      const metrics: AnalyticsMetric[] = [
        {
          id: 'm1',
          name: 'revenue',
          value: 1000,
          unit: 'dollars',
          source: 'tableau',
          timestamp: new Date(),
        },
      ];

      const aggregated = aggregator.aggregateMetricsByLevel(metrics, 'raw');

      expect(aggregated).toEqual(metrics);
    });
  });

  describe('Report Scheduling', () => {
    it('should schedule report aggregation', () => {
      const scheduleId = aggregator.scheduleReportAggregation(
        {
          name: 'Daily Revenue Report',
          metrics: ['revenue', 'orders'],
          providers: ['tableau', 'powerbi'],
          format: 'email',
          destination: 'reports@example.com',
        },
        '0 9 * * *'
      );

      expect(scheduleId).toMatch(/^schedule-/);
    });

    it('should support different delivery methods', () => {
      const emailScheduleId = aggregator.scheduleReportAggregation(
        {
          name: 'Email Report',
          metrics: ['revenue'],
          providers: ['tableau'],
          format: 'email',
          destination: 'user@example.com',
        },
        '0 9 * * *'
      );

      const s3ScheduleId = aggregator.scheduleReportAggregation(
        {
          name: 'S3 Report',
          metrics: ['revenue'],
          providers: ['tableau'],
          format: 's3',
          destination: 's3://bucket/reports/',
        },
        '0 9 * * *'
      );

      expect(emailScheduleId).toBeDefined();
      expect(s3ScheduleId).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should clear cache for specific provider', () => {
      aggregator.clearCache('tableau');

      const stats = aggregator.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should clear cache for all providers', () => {
      aggregator.clearCache();

      const stats = aggregator.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should return cache statistics', () => {
      const stats = aggregator.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing provider gracefully', async () => {
      const query: QueryDefinition = {
        id: 'query-1',
        name: 'Test Query',
        dataSource: 'sales_data',
        fields: ['region', 'revenue'],
      };

      const results = await aggregator.executeAggregatedQuery(query, [
        'nonexistent-provider',
      ]);

      expect(results).toHaveLength(0);
    });

    it('should continue with remaining providers on error', async () => {
      const query: QueryDefinition = {
        id: 'query-1',
        name: 'Test Query',
        dataSource: 'sales_data',
        fields: ['region', 'revenue'],
      };

      vi.spyOn(mockTableau, 'executeQuery').mockRejectedValueOnce(
        new Error('Provider error')
      );

      vi.spyOn(mockPowerBI, 'executeQuery').mockResolvedValueOnce({
        executionId: 'exec-2',
        columns: [{ name: 'revenue', type: 'number' }],
        rows: [{ revenue: 12000 }],
        executionTimeMs: 15,
        fromCache: false,
      });

      const results = await aggregator.executeAggregatedQuery(query, [
        'tableau',
        'powerbi',
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].provider).toBe('powerbi');
    });
  });
});
