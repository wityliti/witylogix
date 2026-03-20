'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  BoxIcon,
  TrendingUp,
  AlertCircle,
  Plus,
  Package,
  Warehouse,
} from 'lucide-react';
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
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e]">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Supply Chain</h1>
              <p className="text-sm text-gray-400 mt-1">Inventory, orders, and warehouse operations</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" size="md">
                <AlertCircle className="w-4 h-4 mr-2" />
                Alerts
              </Button>
              <Button variant="primary" size="md">
                <Plus className="w-4 h-4 mr-2" />
                Create Order
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="space-y-6 max-w-7xl">
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
            <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BoxIcon className="w-5 h-5 text-blue-500" />
                Order Fulfillment Pipeline
              </h2>
              <div className="space-y-4">
                {pipelineStages.map((stage) => (
                  <div key={stage.stage}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 cursor-pointer" onClick={() => setSelectedStage(selectedStage === stage.stage ? null : stage.stage)}>
                        <h4 className="font-medium text-white">{stage.stage}</h4>
                        <p className="text-xs text-gray-500">{stage.count} orders</p>
                      </div>
                      <Badge variant={stage.status === 'healthy' ? 'success' : stage.status === 'warning' ? 'warning' : 'danger'}>
                        {stage.count}
                      </Badge>
                    </div>
                    <div className="w-full bg-[#1a1a2e] rounded-full h-2">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          stage.status === 'healthy' ? 'bg-emerald-500' : stage.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                        )}
                        style={{ width: `${stage.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}

                {/* Pipeline Summary */}
                <div className="mt-6 p-4 rounded-lg bg-[#1a1a2e] border border-[#1e1e2e]">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400">Total Orders:</span>
                      <p className="font-semibold text-white mt-1">
                        {pipelineStages.reduce((sum, s) => sum + s.count, 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-400">Avg Process Time:</span>
                      <p className="font-semibold text-white mt-1">2.3 days</p>
                    </div>
                    <div>
                      <span className="text-gray-400">On-Time Rate:</span>
                      <p className="font-semibold text-white mt-1">94.2%</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Backlog:</span>
                      <p className="font-semibold text-white mt-1">12 orders</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Warehouse Utilization */}
            <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-emerald-500" />
                Warehouse Utilization
              </h2>
              <div className="space-y-4">
                {warehouse.warehouses.map((wh) => (
                  <div key={wh.warehouseId}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-white">{wh.name}</h4>
                      <span className="text-sm font-semibold text-white">{wh.utilizationPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-[#1a1a2e] rounded-full h-2.5">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          wh.utilizationPercentage < 60 ? 'bg-emerald-500' : wh.utilizationPercentage < 80 ? 'bg-amber-500' : 'bg-red-500'
                        )}
                        style={{ width: `${wh.utilizationPercentage}%` }}
                      />
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>{wh.activeOrders} active orders</span>
                      <span>{wh.pendingPutaway} pending putaway</span>
                      <span>{wh.cycleCountsScheduled} cycle counts</span>
                    </div>
                  </div>
                ))}

                {/* Warehouse Summary */}
                <div className="mt-6 p-4 rounded-lg bg-[#1a1a2e] border border-[#1e1e2e]">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Highest Utilization</p>
                    <p className="text-lg font-bold text-white">{warehouse.highestUtilization.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{warehouse.highestUtilization.utilizationPercentage.toFixed(1)}% capacity used</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Demand vs Supply */}
          <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Demand vs Supply Forecast
            </h2>
            <div className="space-y-4">
              {demandSupplyData.map((data) => (
                <div key={data.period} className="pb-4 border-b border-[#1e1e2e] last:border-0">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-medium text-white">{data.period}</h4>
                    <Badge variant={data.variance > 10 ? 'danger' : data.variance < -10 ? 'warning' : 'success'}>
                      {data.variance > 0 ? '+' : ''}{data.variance.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-xs text-gray-400">Demand:</span>
                        <span className="text-sm font-semibold text-white flex-1">{data.demand.toLocaleString()} units</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-xs text-gray-400">Supply:</span>
                        <span className="text-sm font-semibold text-white flex-1">{data.supply.toLocaleString()} units</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Inventory ABC Distribution */}
          <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-500" />
              Inventory ABC Distribution
            </h2>
            <div className="space-y-4">
              {INVENTORY_DISTRIBUTION.map((item) => (
                <div key={item.category}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-white">{item.category}</h4>
                      <p className="text-xs text-gray-500">{item.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{item.count} SKUs</p>
                      <p className="text-xs text-gray-500">{item.percentage}% of inventory</p>
                    </div>
                  </div>
                  <div className="w-full bg-[#1a1a2e] rounded-full h-2">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400" style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 bg-[#12121a] border border-[#1e1e2e] hover:border-blue-500/30 transition-colors">
              <Button variant="primary" className="w-full mb-3">
                <Plus className="w-4 h-4 mr-2" />
                Create Transfer Order
              </Button>
              <p className="text-xs text-gray-500 text-center">Move inventory between warehouses</p>
            </Card>
            <Card className="p-6 bg-[#12121a] border border-[#1e1e2e] hover:border-emerald-500/30 transition-colors">
              <Button variant="primary" className="w-full mb-3">
                <Plus className="w-4 h-4 mr-2" />
                Schedule Cycle Count
              </Button>
              <p className="text-xs text-gray-500 text-center">Plan inventory verification</p>
            </Card>
            <Card className="p-6 bg-[#12121a] border border-[#1e1e2e] hover:border-amber-500/30 transition-colors">
              <Button variant="primary" className="w-full mb-3">
                <Plus className="w-4 h-4 mr-2" />
                Process Reorders
              </Button>
              <p className="text-xs text-gray-500 text-center">Create purchase orders for low stock</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
