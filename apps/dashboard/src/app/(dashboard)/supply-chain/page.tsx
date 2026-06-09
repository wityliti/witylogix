'use client';

import { useState, useMemo } from 'react';
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


export default function SupplyChainPage() {
  const inventory = useInventory();
  const orders = useOrders();
  const fulfillment = useFulfillment();
  const demand = useDemandPlanning();
  const warehouse = useWarehouseOps();
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const totalOrders = orders.orders.length;
  const deliveredOrders = orders.orders.filter((o) => o.status === 'delivered').length;

  const kpiMetrics = useMemo(() => {
    const fillRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;
    const backorderRate = orders.orders.filter((o) => o.priority === 'backorder').length / Math.max(totalOrders, 1) * 100;
    const avgLeadTime = demand.items.length > 0
      ? demand.items.reduce((sum, d) => sum + (d.confidence ?? 0), 0) / demand.items.length
      : 0;
    const avgUtilization = warehouse.warehouses.length > 0
      ? warehouse.warehouses.reduce((sum, w) => sum + w.utilizationPercentage, 0) / warehouse.warehouses.length
      : 0;
    return [
      { id: 'kpi-1', name: 'Fill Rate', value: fillRate.toFixed(1), unit: '%', trend: 0, trendLabel: 'delivered', color: 'success' as const },
      { id: 'kpi-2', name: 'Backorder Rate', value: backorderRate.toFixed(1), unit: '%', trend: 0, trendLabel: 'of orders', color: backorderRate > 5 ? 'danger' as const : 'success' as const },
      { id: 'kpi-3', name: 'Avg Confidence', value: avgLeadTime.toFixed(0), unit: '%', trend: 0, trendLabel: 'forecast', color: 'success' as const },
      { id: 'kpi-4', name: 'Avg Utilization', value: avgUtilization.toFixed(1), unit: '%', trend: 0, trendLabel: 'warehouse', color: 'primary' as const },
    ];
  }, [orders.orders, totalOrders, deliveredOrders, demand.items, warehouse.warehouses]);

  const inventoryDistribution = useMemo(() => {
    const total = inventory.items.length;
    if (total === 0) return [];
    const counts = { A: 0, B: 0, C: 0 };
    for (const item of inventory.items) counts[item.abcClass]++;
    return [
      { category: 'Class A Items', count: counts.A, percentage: Math.round((counts.A / total) * 100), description: 'High value, critical' },
      { category: 'Class B Items', count: counts.B, percentage: Math.round((counts.B / total) * 100), description: 'Medium value' },
      { category: 'Class C Items', count: counts.C, percentage: Math.round((counts.C / total) * 100), description: 'Low value, frequent' },
    ];
  }, [inventory.items]);

  const demandSupplyData: DemandSupplyData[] = useMemo(
    () => demand.items.map((d) => ({ period: d.period, demand: d.demand, supply: d.supply, variance: d.variance })),
    [demand.items]
  );

  const totalPipelineOrders = Object.values(fulfillment.pipelineStats).reduce((s, v) => s + v, 0);

  const pipelineStages: PipelineStage[] = [
    { stage: 'Received', count: fulfillment.pipelineStats.received, percentage: totalPipelineOrders > 0 ? Math.round((fulfillment.pipelineStats.received / totalPipelineOrders) * 100) : 0, status: 'healthy' },
    { stage: 'Picked', count: fulfillment.pipelineStats.picked, percentage: totalPipelineOrders > 0 ? Math.round((fulfillment.pipelineStats.picked / totalPipelineOrders) * 100) : 0, status: 'healthy' },
    { stage: 'Packed', count: fulfillment.pipelineStats.packed, percentage: totalPipelineOrders > 0 ? Math.round((fulfillment.pipelineStats.packed / totalPipelineOrders) * 100) : 0, status: 'warning' },
    { stage: 'Shipped', count: fulfillment.pipelineStats.shipped, percentage: totalPipelineOrders > 0 ? Math.round((fulfillment.pipelineStats.shipped / totalPipelineOrders) * 100) : 0, status: 'healthy' },
    { stage: 'Delivered', count: fulfillment.pipelineStats.delivered, percentage: totalPipelineOrders > 0 ? Math.round((fulfillment.pipelineStats.delivered / totalPipelineOrders) * 100) : 0, status: 'healthy' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-root">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-wl-bg-root/95 backdrop-blur border-b border-wl-border-default">
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
            {kpiMetrics.map((metric, idx) => (
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
            <Card className="p-6 bg-wl-bg-surface border border-wl-border-default">
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
                    <div className="w-full bg-wl-bg-elevated rounded-full h-2">
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
                <div className="mt-6 p-4 rounded-lg bg-wl-bg-elevated border border-wl-border-default">
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
            <Card className="p-6 bg-wl-bg-surface border border-wl-border-default">
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
                    <div className="w-full bg-wl-bg-elevated rounded-full h-2.5">
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
                <div className="mt-6 p-4 rounded-lg bg-wl-bg-elevated border border-wl-border-default">
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
          <Card className="p-6 bg-wl-bg-surface border border-wl-border-default">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Demand vs Supply Forecast
            </h2>
            <div className="space-y-4">
              {demandSupplyData.map((data) => (
                <div key={data.period} className="pb-4 border-b border-wl-border-default last:border-0">
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
          <Card className="p-6 bg-wl-bg-surface border border-wl-border-default">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-500" />
              Inventory ABC Distribution
            </h2>
            <div className="space-y-4">
              {inventoryDistribution.map((item) => (
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
                  <div className="w-full bg-wl-bg-elevated rounded-full h-2">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400" style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 bg-wl-bg-surface border border-wl-border-default hover:border-blue-500/30 transition-colors">
              <Button variant="primary" className="w-full mb-3">
                <Plus className="w-4 h-4 mr-2" />
                Create Transfer Order
              </Button>
              <p className="text-xs text-gray-500 text-center">Move inventory between warehouses</p>
            </Card>
            <Card className="p-6 bg-wl-bg-surface border border-wl-border-default hover:border-emerald-500/30 transition-colors">
              <Button variant="primary" className="w-full mb-3">
                <Plus className="w-4 h-4 mr-2" />
                Schedule Cycle Count
              </Button>
              <p className="text-xs text-gray-500 text-center">Plan inventory verification</p>
            </Card>
            <Card className="p-6 bg-wl-bg-surface border border-wl-border-default hover:border-amber-500/30 transition-colors">
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
