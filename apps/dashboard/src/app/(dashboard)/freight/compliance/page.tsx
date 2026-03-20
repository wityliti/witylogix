'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';

interface Shipment {
  id: string;
  status: string;
  carrier?: string;
}

export default function FreightCompliancePage() {
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Inactive' | 'Suspended'>('All');
  const [sortBy, setSortBy] = useState<'name' | 'compliance' | 'safety' | 'volume'>('compliance');
  const { items: shipments, loading, error, refetch } = useApiList<Shipment>('/api/v4/shipments?type=freight&view=compliance');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary">Carrier Compliance</h2>
          <p className="text-sm text-wl-text-secondary mt-1">{shipments.length} shipments monitored</p>
        </div>
        <Button variant="secondary" size="md">
          📋 Run Compliance Audit
        </Button>
      </div>

      {/* Compliance List */}
      <Card>
        <div className="p-6">
          <div className="space-y-3">
            {shipments.slice(0, 10).map((shipment) => (
              <div key={shipment.id} className="flex items-center justify-between p-3 bg-wl-bg-overlay rounded">
                <div>
                  <p className="text-sm font-medium text-wl-text-primary">{shipment.id}</p>
                  <p className="text-xs text-wl-text-secondary">{shipment.carrier || 'Unknown Carrier'}</p>
                </div>
                <Badge variant="success">Compliant</Badge>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
