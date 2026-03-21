'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';

interface Shipment {
  id: string;
  status: string;
  carrier?: string;
  complianceScore?: number;
}

export default function FreightCompliancePage() {
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Inactive' | 'Suspended'>('All');
  const { items: shipments, loading, error, refetch } = useApiList<Shipment>('/api/v4/shipments?type=freight&view=compliance');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const compliantCount = shipments.filter(s => s.status === 'compliant').length;
  const avgScore = shipments.length > 0 ? Math.round((compliantCount / shipments.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Carrier Compliance</h1>
        <p className="text-gray-400">{shipments.length} shipments monitored</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Compliant Shipments</span>
              <CheckCircle className="text-emerald-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{compliantCount}</p>
            <p className="text-gray-400 text-xs mt-2">{avgScore}% compliance rate</p>
          </div>
        </Card>

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Avg. Score</span>
              <TrendingUp className="text-blue-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{avgScore}%</p>
            <p className="text-gray-400 text-xs mt-2">Overall compliance</p>
          </div>
        </Card>

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Flagged Items</span>
              <AlertCircle className="text-amber-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{shipments.length - compliantCount}</p>
            <p className="text-gray-400 text-xs mt-2">Requiring review</p>
          </div>
        </Card>
      </div>

      {/* Filters & Actions */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex gap-2">
          {(['All', 'Active', 'Inactive', 'Suspended'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                filterStatus === status
                  ? 'bg-blue-500 text-white'
                  : 'bg-[#1a1a2e] text-gray-400 hover:bg-[#242436]'
              )}
            >
              {status}
            </button>
          ))}
        </div>
        <Button variant="primary" size="md">
          Run Compliance Audit
        </Button>
      </div>

      {/* Compliance List */}
      <Card className="bg-[#12121a] border-[#1e1e2e]">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Compliance Status</h3>
          <div className="space-y-3">
            {shipments.slice(0, 10).map((shipment) => (
              <div key={shipment.id} className="flex items-center justify-between p-4 bg-[#1a1a2e] hover:bg-[#242436] rounded-lg transition-colors border border-[#1e1e2e]">
                <div>
                  <p className="text-sm font-semibold text-white">{shipment.id}</p>
                  <p className="text-xs text-gray-400">{shipment.carrier || 'Unknown Carrier'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{shipment.complianceScore || 95}%</p>
                    <p className="text-xs text-gray-400">Score</p>
                  </div>
                  <Badge variant={shipment.status === 'compliant' ? 'success' : 'warning'}>
                    {shipment.status === 'compliant' ? 'Compliant' : 'Review'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Empty State Info */}
      {shipments.length === 0 && (
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-12 text-center">
            <p className="text-gray-400">No shipments found</p>
          </div>
        </Card>
      )}
    </div>
  );
}
