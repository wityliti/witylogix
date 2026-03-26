'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { TrendingUp, Plus, Calculator, X } from 'lucide-react';

interface Carrier {
  id: string;
  name: string;
}

export default function FreightRatesPage() {
  const [showRFPWizard, setShowRFPWizard] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const { items: carriers, loading, error, refetch } = useApiList<Carrier>('/api/v4/carriers');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Rate Management</h1>
            <p className="text-gray-400">{carriers.length} active carriers</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setCalculatorOpen(!calculatorOpen)}
              className="flex items-center gap-2"
            >
              <Calculator size={16} /> Calculator
            </Button>
            <Button variant="primary" size="md" onClick={() => setShowRFPWizard(true)} className="flex items-center gap-2">
              <Plus size={16} /> New RFP
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Active Carriers</span>
              <TrendingUp className="text-blue-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{carriers.length}</p>
            <p className="text-gray-400 text-xs mt-2">Ready for quotes</p>
          </div>
        </Card>

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Avg. Quote Time</span>
              <div className="w-5 h-5 rounded-full bg-emerald-500"></div>
            </div>
            <p className="text-3xl font-bold text-white">2h 45m</p>
            <p className="text-gray-400 text-xs mt-2">Response time</p>
          </div>
        </Card>
      </div>

      {/* Rate Calculator */}
      {calculatorOpen && (
        <Card className="mb-8 bg-gradient-to-br from-blue-500/5 to-emerald-500/5 border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Rate Calculator</h3>
              <button
                onClick={() => setCalculatorOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">Origin City</label>
                <input
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="City, State"
                  className="w-full px-4 py-2 border border-[#1e1e2e] rounded-lg text-sm text-white bg-[#12121a] focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">Destination City</label>
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="City, State"
                  className="w-full px-4 py-2 border border-[#1e1e2e] rounded-lg text-sm text-white bg-[#12121a] focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
            <Button variant="primary" className="w-full">
              Calculate Rate
            </Button>
          </div>
        </Card>
      )}

      {/* Carriers List */}
      <Card className="bg-[#12121a] border-[#1e1e2e]">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Active Carriers</h3>
          <div className="space-y-3">
            {carriers.length > 0 ? (
              carriers.map((carrier) => (
                <div
                  key={carrier.id}
                  className="flex items-center justify-between p-4 bg-[#1a1a2e] hover:bg-[#242436] rounded-lg transition-colors border border-[#1e1e2e]"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{carrier.name}</p>
                    <p className="text-xs text-gray-400">Approved carrier</p>
                  </div>
                  <Badge variant="success">Approved</Badge>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400">
                <p>No carriers available</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
