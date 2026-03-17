'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useInventory,
  useOrders,
  useFulfillment,
  useDemandPlanning,
  useWarehouseOps,
} from '@/hooks/use-supply-chain';

interface PipelineStage {
  stage: string;
  count: number;
  percentage: number;
  status: 'healthy' | 'warning' | 'critical';
}

interface DemandSupplyData {
  period: string;
  demand: number;
  supply: number;
  variance: number;
}

// Mock data
const KPI_METRICS = [
  {
    id: 'kpi-1',
    name: 'Fill Rate',
    value: '96.8',
    unit: '%',
    trend: 2.3,
    trendLabel: 'vs last week',
    color: 'success' as const,
  },
  {
    id: 'kpi-2',
    name: 'Backorder Rate',
    value: '3.2',
    unit: '%',
    trend: -1.5,
    trendLabel: 'reduction',
    color: 'success' as const,
  },
  {
    id: 'kpi-3',
    name: 'Avg Lead Time',
    value: '4.2',
    unit: 'days',
    trend: -0.8,
    trendLabel: 'faster',
    color: 'success' as const,
  },
  {
    id: 'kpi-4',
    name: 'Inventory Turns',
    value: '6.8',
    unit: '/year',
    trend: 0.5,
    trendLabel: 'improvement',
    color: 'primary' as const,
  },
];

const INVENTORY_DISTRIBUTION = [
  { category: 'Class A Items', count: 12, percentage: 15, description: 'High value, critical' },
  { category: 'Class B Items', count: 34, percentage: 42, description: 'Medium value' },
  { category: 'Class C Items', count: 39, percentage: 43, description: 'Low value, frequent' },
];

export default function SupplyChainPage() {
  const inventory = useInventory();
  const orders = useOrders();
  const fulfillment = useFulfillment();
  const demand = useDemandPlanning();
  const warehouse = useWarehouseOps();
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const pipelineStages: PipelineStage[] = [
    {
      stage: 'Received',
      count: fulfillment.pipelineStats.received,
      percentage: 25,
      status: 'healthy',
    },
    {
      stage: 'Picked',
      count: fulfillment.pipelineStats.picked,
      percentage: 20,
      status: 'healthy',
    },
    {
      stage: 'Packed',
      count: fulfillment.pipelineStats.packed,
      percentage: 25,
      status: 'warning',
    },
    {
      stage: 'Shipped',
      count: fulfillment.pipelineStats.shipped,
      percentage: 20,
      status: 'healthy',
    },
    {
      stage: 'Delivered',
      count: fulfillment.pipelineStats.delivered,
      percentage: 10,
      status: 'healthy',
    },
  ];

  const demandSupplyData: DemandSupplyData[] = [
    { period: 'Week 1', demand: 4500, supply: 5200, variance: 15.6 },
    { period: 'Week 2', demand: 5100, supply: 5200, variance: 2.0 },
    { period: 'Week 3', demand: 6200, supply: 5200, variance: -16.1 },
  ];

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_METRICS.map((metric, idx) => (
          <StatCard
            key={metric.id}
            label={metric.name}
            value={metric.value}
            change={{
              value: metric.trend,
              label: metric.trendLabel,
            }}
            accentColor={`var(--wl-${metric.color}-500)`}
            index={idx}
          />
        ))}
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Fulfillment Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle>Order Fulfillment Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pipelineStages.map((stage, idx) => (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-2">
                    <div
                      onClick={() => setSelectedStage(selectedStage === stage.stage ? null : stage.stage)}
                      className="flex-1 cursor-pointer"
                    >
                      <h4 className="font-medium text-wl-text-primary">
                        {stage.stage}
                      </h4>
                      <p className="text-xs text-wl-text-tertiary">
                        {stage.count} orders
                      </p>
                    </div>
                    <Badge
                      variant={
                        stage.status === 'healthy'
                          ? 'success'
                          : stage.status === 'warning'
                          ? 'warning'
                          : 'danger'
                      }
                    >
                      {stage.count}
                    </Badge>
                  </div>
                  <div className="w-full bg-wl-bg-overlay rounded-full h-2">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        stage.status === 'healthy'
                          ? 'bg-wl-success-500'
                          : stage.status === 'warning'
                          ? 'bg-wl-warning-500'
                          : 'bg-wl-danger-500'
                      )}
                      style={{ width: `${stage.percentage}%` }}
                    />
                  </div>
                </div>
              ))}

              {/* Pipeline Summary */}
              <div className="mt-6 p-4 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-wl-text-secondary">Total Orders:</span>
                    <p className="font-semibold text-wl-text-primary">
                      {pipelineStages.reduce((sum, s) => sum + s.count, 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-wl-text-secondary">Avg Process Time:</span>
                    <p className="font-semibold text-wl-text-primary">2.3 days</p>
                  </div>
                  <div>
                    <span className="text-wl-text-secondary">On-Time Rate:</span>
                    <p className="font-semibold text-wl-text-primary">94.2%</p>
                  </div>
                  <div>
                    <span className="text-wl-text-secondary">Backlog:</span>
                    <p className="font-semibold text-wl-text-primary">12 orders</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warehouse Utilization */}
        <Card>
          <CardHeader>
            <CardTitle>Warehouse Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {warehouse.warehouses.map((wh) => (
                <div key={wh.warehouseId}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-wl-text-primary">{wh.name}</h4>
                    <span className="text-sm font-semibold text-wl-text-primary">
                      {wh.utilizationPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-wl-bg-overlay rounded-full h-2.5">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        wh.utilizationPercentage < 60
                          ? 'bg-wl-success-500'
                          : wh.utilizationPercentage < 80
                          ? 'bg-wl-warning-500'
                          : 'bg-wl-danger-500'
                      )}
                      style={{ width: `${wh.utilizationPercentage}%` }}
                    />
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-wl-text-tertiary">
                    <span>{wh.activeOrders} active orders</span>
                    <span>{wh.pendingPutaway} pending putaway</span>
                    <span>{wh.cycleCountsScheduled} cycle counts</span>
                  </div>
                </div>
              ))}

              {/* Warehouse Summary */}
              <div className="mt-6 p-4 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle">
                <div className="text-center">
                  <p className="text-xs text-wl-text-secondary mb-1">Highest Utilization</p>
                  <p className="text-lg font-bold text-wl-text-primary">
                    {warehouse.highestUtilization.name}
                  </p>
                  <p className="text-xs text-wl-text-tertiary mt-1">
                    {warehouse.highestUtilization.utilizationPercentage.toFixed(1)}% capacity used
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Demand vs Supply */}
      <Card>
        <CardHeader>
          <CardTitle>Demand vs Supply Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {demandSupplyData.map((data) => (
              <div key={data.period} className="pb-4 border-b border-wl-border-subtle last:border-0">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-medium text-wl-text-primary">{data.period}</h4>
                  <Badge
                    variant={
                      data.variance > 10
                        ? 'danger'
                        : data.variance < -10
                        ? 'warning'
                        : 'success'
                    }
                  >
                    {data.variance > 0 ? '+' : ''}{data.variance.toFixed(1)}%
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-3 h-3 rounded-full bg-wl-primary-500" />
                      <span className="text-xs text-wl-text-secondary">Demand:</span>
                      <span className="text-sm font-semibold text-wl-text-primary flex-1">
                        {data.demand.toLocaleString()} units
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-3 h-3 rounded-full bg-wl-success-500" />
                      <span className="text-xs text-wl-text-secondary">Supply:</span>
                      <span className="text-sm font-semibold text-wl-text-primary flex-1">
                        {data.supply.toLocaleString()} units
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Inventory ABC Analysis Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory ABC Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {INVENTORY_DISTRIBUTION.map((item) => (
              <div key={item.category}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-wl-text-primary">
                      {item.category}
                    </h4>
                    <p className="text-xs text-wl-text-tertiary">{item.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-wl-text-primary">
                      {item.count} SKUs
                    </p>
                    <p className="text-xs text-wl-text-secondary">
                      {item.percentage}% of inventory
                    </p>
                  </div>
                </div>
                <div className="w-full bg-wl-bg-overlay rounded-full h-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-wl-primary-500 to-wl-primary-400"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <Button variant="primary" className="w-full">
              Create Transfer Order
            </Button>
            <p className="text-xs text-wl-text-tertiary text-center mt-3">
              Move inventory between warehouses
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Button variant="primary" className="w-full">
              Schedule Cycle Count
            </Button>
            <p className="text-xs text-wl-text-tertiary text-center mt-3">
              Plan inventory verification
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Button variant="primary" className="w-full">
              Process Reorders
            </Button>
            <p className="text-xs text-wl-text-tertiary text-center mt-3">
              Create purchase orders for low stock
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
