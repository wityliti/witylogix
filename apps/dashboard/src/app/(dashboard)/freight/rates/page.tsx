'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';

interface Carrier {
  id: string;
  name: string;
}

export default function FreightRatesPage() {
  const [showRFPWizard, setShowRFPWizard] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const { items: carriers, loading, error, refetch } = useApiList<Carrier>('/api/v4/carriers');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary">Rate Management</h2>
          <p className="text-sm text-wl-text-secondary mt-1">{carriers.length} active carriers</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" size="md" onClick={() => setCalculatorOpen(!calculatorOpen)}>
            📊 Calculator
          </Button>
          <Button variant="primary" size="md" onClick={() => setShowRFPWizard(true)}>
            + New RFP
          </Button>
        </div>
      </div>

      {/* Rate Calculator */}
      {calculatorOpen && (
        <Card className="mb-6 bg-gradient-to-br from-wl-primary-500/10 to-transparent">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-wl-text-primary">Rate Calculator</h3>
              <button onClick={() => setCalculatorOpen(false)} className="text-wl-text-tertiary text-xl">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-wl-text-secondary mb-1">Origin</label>
                <input placeholder="City, State" className="w-full p-2 border border-wl-border-default rounded text-sm text-wl-text-primary bg-wl-bg-elevated" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-wl-text-secondary mb-1">Destination</label>
                <input placeholder="City, State" className="w-full p-2 border border-wl-border-default rounded text-sm text-wl-text-primary bg-wl-bg-elevated" />
              </div>
            </div>
            <Button variant="primary" className="w-full">Calculate Rate</Button>
          </div>
        </Card>
      )}

      {/* Carriers Table */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-bold text-wl-text-primary mb-4">Carriers</h3>
          <div className="space-y-3">
            {carriers.map((carrier) => (
              <div key={carrier.id} className="flex items-center justify-between p-3 bg-wl-bg-overlay rounded">
                <div>
                  <p className="text-sm font-medium text-wl-text-primary">{carrier.name}</p>
                  <p className="text-xs text-wl-text-secondary">Active</p>
                </div>
                <Badge variant="success">Approved</Badge>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
