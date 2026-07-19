'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { TrendingUp, Plus, Calculator, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Carrier {
  id: string;
  name: string;
}

interface ShippingProfile {
  id: string;
  name: string;
  deliveryMethod: string;
  rateType: string;
  flatRate: number | null;
  freeShippingAbove: number | null;
  processingTimeHours: number;
  isActive: boolean;
}

interface QuoteResult {
  profile: ShippingProfile;
  estimatedCost: number;
  isFree: boolean;
}

const deliveryMethodLabel: Record<string, string> = {
  LOCAL_DELIVERY: 'Local Delivery',
  STORE_PICKUP: 'Store Pickup',
  STANDARD_SHIPPING: 'Standard Shipping',
  EXPRESS_SHIPPING: 'Express Shipping',
  SAME_DAY: 'Same Day',
};

export default function FreightRatesPage() {
  const [showRFPWizard, setShowRFPWizard] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [orderValue, setOrderValue] = useState('');
  const [quoteResults, setQuoteResults] = useState<QuoteResult[] | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  const { items: carriers, loading, error, refetch } = useApiList<Carrier>('/api/v4/carriers');
  const { items: profiles, loading: profilesLoading } = useApiList<ShippingProfile>(
    '/api/v4/shipping-profiles?limit=50&isActive=true',
  );

  const handleCalculateRate = () => {
    if (!origin.trim() || !destination.trim()) {
      setCalcError('Please enter both origin and destination.');
      return;
    }
    setCalcError(null);
    setCalculating(true);

    // Compute quotes from active shipping profiles (client-side, using real profile data)
    setTimeout(() => {
      const value = parseFloat(orderValue) || 0;
      const results: QuoteResult[] = profiles
        .filter((p) => p.isActive)
        .map((p) => {
          const isFree = !!(p.freeShippingAbove && value >= p.freeShippingAbove) || p.flatRate === 0;
          const estimatedCost = isFree ? 0 : (p.flatRate ?? 0);
          return { profile: p, estimatedCost, isFree };
        })
        .sort((a, b) => a.estimatedCost - b.estimatedCost);
      setQuoteResults(results);
      setCalculating(false);
    }, 600);
  };

  if (loading || profilesLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-wl-text-primary">Rate Management</h1>
            <p className="text-sm text-wl-text-secondary mt-0.5">{carriers.length} active carriers</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setCalculatorOpen(!calculatorOpen);
                setQuoteResults(null);
                setCalcError(null);
              }}
            >
              <Calculator className="w-4 h-4" /> Calculator
            </Button>
            <Button variant="primary" size="md" onClick={() => setShowRFPWizard(true)}>
              <Plus className="w-4 h-4" /> New RFP
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-wl-text-secondary text-sm font-medium">Active Carriers</span>
              <TrendingUp className="text-wl-info-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-wl-text-primary">{carriers.length}</p>
            <p className="text-wl-text-tertiary text-xs mt-2">Ready for quotes</p>
          </div>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-wl-text-secondary text-sm font-medium">Coverage</span>
              <div className="w-5 h-5 rounded-full bg-wl-success-500" />
            </div>
            <p className="text-3xl font-bold text-wl-text-primary">
              {carriers.length > 0 ? 'Active' : 'None'}
            </p>
            <p className="text-wl-text-tertiary text-xs mt-2">Carrier network</p>
          </div>
        </Card>
      </div>

      {/* Rate Calculator */}
      {calculatorOpen && (
        <Card className="mb-6 bg-wl-bg-surface border-wl-border-default">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-wl-text-primary">Rate Calculator</h3>
              <button
                onClick={() => {
                  setCalculatorOpen(false);
                  setQuoteResults(null);
                  setCalcError(null);
                }}
                className="text-wl-text-tertiary hover:text-wl-text-primary transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-wl-text-secondary mb-2">Origin City</label>
                <input
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="City, State"
                  className="w-full px-4 py-2 border border-wl-border-default rounded-lg text-sm text-wl-text-primary bg-wl-bg-overlay focus:border-wl-primary-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-wl-text-secondary mb-2">Destination City</label>
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="City, State"
                  className="w-full px-4 py-2 border border-wl-border-default rounded-lg text-sm text-wl-text-primary bg-wl-bg-overlay focus:border-wl-primary-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-wl-text-secondary mb-2">Order Value (optional)</label>
                <input
                  value={orderValue}
                  onChange={(e) => setOrderValue(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-wl-border-default rounded-lg text-sm text-wl-text-primary bg-wl-bg-overlay focus:border-wl-primary-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {calcError && (
              <p className="text-wl-danger-400 text-xs mb-3 flex items-center gap-1">
                <AlertCircle size={12} /> {calcError}
              </p>
            )}

            <Button
              variant="primary"
              className="w-full"
              onClick={handleCalculateRate}
              disabled={calculating || profiles.length === 0}
            >
              {calculating ? 'Calculating…' : 'Calculate Rate'}
            </Button>

            {/* Quote Results */}
            {quoteResults !== null && (
              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-semibold text-wl-text-secondary">
                  Available rates for {origin} → {destination}
                </h4>
                {quoteResults.length === 0 ? (
                  <p className="text-sm text-wl-text-tertiary py-4 text-center">
                    No shipping profiles configured. Add profiles in Shipping Settings.
                  </p>
                ) : (
                  quoteResults.map((r) => (
                    <div
                      key={r.profile.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border transition-colors',
                        r.isFree
                          ? 'bg-wl-success-500/5 border-wl-success-500/20'
                          : 'bg-wl-bg-overlay border-wl-border-default',
                      )}
                    >
                      <div>
                        <p className="text-sm font-semibold text-wl-text-primary">{r.profile.name}</p>
                        <p className="text-xs text-wl-text-tertiary">
                          {deliveryMethodLabel[r.profile.deliveryMethod] ?? r.profile.deliveryMethod}
                          {' · '}{r.profile.processingTimeHours}h processing
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.isFree ? (
                          <span className="flex items-center gap-1 text-wl-success-400 text-sm font-bold">
                            <CheckCircle2 size={14} /> FREE
                          </span>
                        ) : (
                          <span className="text-wl-text-primary text-sm font-bold font-mono">
                            {formatCurrency(r.estimatedCost)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Carriers List */}
      <Card className="bg-wl-bg-surface border-wl-border-default">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-wl-text-primary mb-4">Active Carriers</h3>
          {carriers.length === 0 ? (
            <div className="py-8 text-center text-wl-text-tertiary">
              No carriers available. Add a carrier to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {carriers.map((carrier) => (
                <div
                  key={carrier.id}
                  className="flex items-center justify-between p-4 bg-wl-bg-overlay hover:bg-wl-bg-elevated rounded-lg transition-colors border border-wl-border-default"
                >
                  <div>
                    <p className="text-sm font-semibold text-wl-text-primary">{carrier.name}</p>
                    <p className="text-xs text-wl-text-tertiary">Approved carrier</p>
                  </div>
                  <Badge variant="success">Approved</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
