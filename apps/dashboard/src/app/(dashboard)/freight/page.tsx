'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import {
  Truck,
  TrendingUp,
  AlertTriangle,
  Plus,
  BarChart3,
  DollarSign,
} from 'lucide-react';

interface Shipment {
  id: string;
  status: string;
  rate: number;
  carrier?: string;
  createdAt: string;
}

export default function FreightPage() {
  const { items: shipments, loading, error, refetch } = useApiList<Shipment>('/api/v4/shipments?type=freight');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const stats = useMemo(() => {
    const booked = shipments.filter((l) => l.status === 'Booked').length;
    const inTransit = shipments.filter((l) => l.status === 'In-Transit').length;
    const delivered = shipments.filter((l) => l.status === 'Delivered').length;
    const exceptions = shipments.filter((l) => l.status === 'Exception').length;
    const avgCostPerMile = shipments.length > 0 ? Math.round((shipments.reduce((sum, l) => sum + l.rate, 0) / shipments.length) * 100) / 100 : 0;

    return {
      booked,
      inTransit,
      delivered,
      exceptions,
      avgCostPerMile,
      totalLoadVolume: shipments.length,
    };
  }, [shipments]);

  const topCarriers = useMemo(() => {
    const carrierVolume: Record<string, { name: string; count: number; rate: number }> = {};
    shipments.forEach((load) => {
      if (load.carrier) {
        if (!carrierVolume[load.carrier]) {
          carrierVolume[load.carrier] = { name: load.carrier, count: 0, rate: 0 };
        }
        carrierVolume[load.carrier].count += 1;
        carrierVolume[load.carrier].rate += load.rate;
      }
    });

    return Object.values(carrierVolume)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((c) => ({ ...c, avgRate: Math.round(c.rate / c.count) }));
  }, [shipments]);

  const totalSavings = 15000;

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e]">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Freight Management</h1>
              <p className="text-sm text-gray-400 mt-1">Shipments, carriers, and cost optimization</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" size="md">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Exceptions
              </Button>
              <Button variant="primary" size="md">
                <Plus className="w-4 h-4 mr-2" />
                New Shipment
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="space-y-6 max-w-7xl">
          {/* KPI Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <Card className="p-4 bg-[#12121a] border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Active Loads</p>
              <p className="text-3xl font-bold text-white mt-2">{stats.booked}</p>
              <p className="text-xs text-gray-500 mt-1">Ready to ship</p>
            </Card>

            <Card className="p-4 bg-[#12121a] border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">In-Transit</p>
              <p className="text-3xl font-bold text-white mt-2">{stats.inTransit}</p>
              <p className="text-xs text-gray-500 mt-1">On the road</p>
            </Card>

            <Card className="p-4 bg-[#12121a] border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Delivered</p>
              <p className="text-3xl font-bold text-white mt-2">{stats.delivered}</p>
              <Badge variant="success" className="mt-2 text-xs">Completed</Badge>
            </Card>

            <Card className="p-4 bg-[#12121a] border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Exceptions</p>
              <p className="text-3xl font-bold text-white mt-2">{stats.exceptions}</p>
              {stats.exceptions > 0 && <Badge variant="danger" className="mt-2 text-xs">Needs Action</Badge>}
            </Card>

            <Card className="p-4 bg-[#12121a] border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Avg $/Mile</p>
              <p className="text-3xl font-bold text-white mt-2">${stats.avgCostPerMile}</p>
              <p className="text-xs text-gray-500 mt-1">Cost efficiency</p>
            </Card>

            <Card className="p-4 bg-[#12121a] border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Savings</p>
              <p className="text-3xl font-bold text-emerald-400 mt-2">${(totalSavings / 1000).toFixed(0)}k</p>
              <TrendingUp className="w-4 h-4 text-emerald-500 mt-1" />
            </Card>
          </div>

          {/* Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Carriers by Volume */}
            <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-500" />
                Top Carriers by Volume
              </h3>
              <div className="space-y-3">
                {topCarriers.map((carrier, idx) => (
                  <div key={carrier.name} className="flex items-center justify-between p-3 bg-[#1a1a2e] rounded-lg border border-[#1e1e2e] hover:border-blue-500/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-white">{idx + 1}. {carrier.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{carrier.count} loads · Avg rate: ${carrier.avgRate}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="info">${carrier.avgRate}/mi</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Shipment Status Summary */}
            <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-500" />
                Shipment Status Breakdown
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#1a1a2e] rounded-lg border border-blue-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-sm text-white">Booked</span>
                  </div>
                  <span className="font-semibold text-white">{stats.booked}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#1a1a2e] rounded-lg border border-amber-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-white">In-Transit</span>
                  </div>
                  <span className="font-semibold text-white">{stats.inTransit}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#1a1a2e] rounded-lg border border-emerald-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-sm text-white">Delivered</span>
                  </div>
                  <span className="font-semibold text-white">{stats.delivered}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#1a1a2e] rounded-lg border border-red-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm text-white">Exceptions</span>
                  </div>
                  <span className="font-semibold text-white">{stats.exceptions}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Cost Analytics */}
          <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              Cost Optimization Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-[#1a1a2e] border border-[#1e1e2e]">
                <p className="text-xs font-medium text-gray-400 mb-2">TOTAL SHIPMENT VALUE</p>
                <p className="text-2xl font-bold text-white">${(stats.avgCostPerMile * stats.totalLoadVolume).toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">For {stats.totalLoadVolume} loads</p>
              </div>
              <div className="p-4 rounded-lg bg-[#1a1a2e] border border-emerald-500/30">
                <p className="text-xs font-medium text-emerald-400 mb-2">NEGOTIATED SAVINGS</p>
                <p className="text-2xl font-bold text-emerald-400">${totalSavings.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{((totalSavings / (stats.avgCostPerMile * stats.totalLoadVolume)) * 100).toFixed(1)}% reduction</p>
              </div>
              <div className="p-4 rounded-lg bg-[#1a1a2e] border border-[#1e1e2e]">
                <p className="text-xs font-medium text-gray-400 mb-2">AVG COST PER MILE</p>
                <p className="text-2xl font-bold text-white">${stats.avgCostPerMile}</p>
                <p className="text-xs text-gray-500 mt-1">Industry standard: $1.50</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
