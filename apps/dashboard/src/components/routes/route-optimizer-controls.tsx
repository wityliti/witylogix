'use client';

import { AlertCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OptimizationMode, RoutingProvider, OptimizationResult } from '@/hooks/use-route-planner';

interface RouteOptimizerControlsProps {
  optimizationMode: OptimizationMode;
  selectedProviders: RoutingProvider[];
  isOptimizing: boolean;
  progress: number;
  results: OptimizationResult[];
  selectedResult?: OptimizationResult;
  vehicleCapacity?: number;
  vehicleType?: string;
  weightLimit?: number;
  onSetOptimizationMode: (mode: OptimizationMode) => void;
  onSetSelectedProviders: (providers: RoutingProvider[]) => void;
  onRunOptimization: () => Promise<void>;
  onSelectResult: (result: OptimizationResult) => void;
  onUpdateConstraints?: (constraints: any) => void;
}

const providers: RoutingProvider[] = ['google', 'mapbox', 'here', 'valhalla'];
const modes: OptimizationMode[] = ['fastest', 'shortest', 'balanced'];

const providerLabels: Record<RoutingProvider, string> = {
  google: 'Google Maps',
  mapbox: 'Mapbox',
  here: 'HERE Maps',
  valhalla: 'Valhalla',
};

const modeLabels: Record<OptimizationMode, string> = {
  fastest: 'Fastest Route',
  shortest: 'Shortest Distance',
  balanced: 'Balanced',
};

const modeDescription: Record<OptimizationMode, string> = {
  fastest: 'Minimize travel time',
  shortest: 'Minimize distance',
  balanced: 'Balance time and distance',
};

export function RouteOptimizerControls({
  optimizationMode,
  selectedProviders,
  isOptimizing,
  progress,
  results,
  selectedResult,
  vehicleCapacity,
  vehicleType,
  weightLimit,
  onSetOptimizationMode,
  onSetSelectedProviders,
  onRunOptimization,
  onSelectResult,
  onUpdateConstraints,
}: RouteOptimizerControlsProps) {
  const toggleProvider = (provider: RoutingProvider) => {
    const updated = selectedProviders.includes(provider)
      ? selectedProviders.filter((p) => p !== provider)
      : [...selectedProviders, provider];
    onSetSelectedProviders(updated);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Mode Selection */}
      <Card className="p-4 bg-wl-bg-elevated border-wl-border-default">
        <div className="text-sm font-semibold text-wl-text-primary mb-3">
          Optimization Mode
        </div>

        <div className="space-y-2">
          {modes.map((mode) => (
            <label
              key={mode}
              className={cn(
                'flex items-center gap-3 p-3 rounded-md cursor-pointer',
                'border transition-colors',
                optimizationMode === mode
                  ? 'bg-wl-primary-500/10 border-wl-primary-500'
                  : 'border-wl-border-default bg-wl-bg-surface hover:border-wl-border-strong'
              )}
            >
              <input
                type="radio"
                name="mode"
                value={mode}
                checked={optimizationMode === mode}
                onChange={() => onSetOptimizationMode(mode)}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-wl-text-primary">
                  {modeLabels[mode]}
                </div>
                <div className="text-xs text-wl-text-tertiary">
                  {modeDescription[mode]}
                </div>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {/* Provider Selection */}
      <Card className="p-4 bg-wl-bg-elevated border-wl-border-default">
        <div className="text-sm font-semibold text-wl-text-primary mb-3">
          Routing Providers
        </div>

        <div className="grid grid-cols-2 gap-2">
          {providers.map((provider) => (
            <button
              key={provider}
              onClick={() => toggleProvider(provider)}
              className={cn(
                'p-3 rounded-md border transition-colors text-sm font-medium',
                selectedProviders.includes(provider)
                  ? 'bg-wl-primary-500/10 border-wl-primary-500 text-wl-primary-400'
                  : 'border-wl-border-default bg-wl-bg-surface text-wl-text-secondary hover:border-wl-border-strong'
              )}
            >
              {providerLabels[provider]}
            </button>
          ))}
        </div>

        {selectedProviders.length === 0 && (
          <div className="mt-3 text-xs text-wl-warning-400 bg-wl-warning-bg/10 px-2 py-1.5 rounded border border-wl-warning-400/20 flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            Select at least one provider
          </div>
        )}
      </Card>

      {/* Vehicle Constraints */}
      <Card className="p-4 bg-wl-bg-elevated border-wl-border-default">
        <div className="text-sm font-semibold text-wl-text-primary mb-3">
          Vehicle Constraints
        </div>

        <div className="space-y-3">
          {vehicleType && (
            <div>
              <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-1">
                Type
              </div>
              <div className="text-sm text-wl-text-primary">
                {vehicleType}
              </div>
            </div>
          )}

          {vehicleCapacity && (
            <div>
              <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-1">
                Capacity
              </div>
              <div className="flex items-center gap-2">
                <div className="w-full bg-wl-bg-surface rounded-full h-2">
                  <div
                    className="bg-wl-primary-500 h-2 rounded-full"
                    style={{ width: '65%' }}
                  />
                </div>
                <span className="text-sm text-wl-text-secondary whitespace-nowrap">
                  13 / {vehicleCapacity}
                </span>
              </div>
            </div>
          )}

          {weightLimit && (
            <div>
              <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-1">
                Weight Limit
              </div>
              <div className="text-sm text-wl-text-primary">
                {weightLimit} kg
              </div>
            </div>
          )}

          {!vehicleType && !vehicleCapacity && !weightLimit && (
            <div className="text-xs text-wl-text-tertiary">
              No specific vehicle constraints
            </div>
          )}
        </div>
      </Card>

      {/* Optimize Button & Progress */}
      <div className="flex flex-col gap-3">
        <Button
          variant="primary"
          size="lg"
          onClick={onRunOptimization}
          disabled={isOptimizing || selectedProviders.length === 0}
          className="w-full"
        >
          <Zap className="w-4 h-4" />
          {isOptimizing ? 'Optimizing...' : 'Optimize Route'}
        </Button>

        {isOptimizing && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-wl-text-tertiary">
              <span>Optimization Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-wl-bg-surface rounded-full h-2 overflow-hidden">
              <div
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  progress >= 100 ? 'bg-wl-success-400' : 'bg-wl-primary-500'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Comparison Panel */}
      {results.length > 1 && (
        <Card className="p-4 bg-wl-bg-elevated border-wl-border-default">
          <div className="text-sm font-semibold text-wl-text-primary mb-3">
            Compare Results
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {results.map((result) => (
              <button
                key={result.provider}
                onClick={() => onSelectResult(result)}
                className={cn(
                  'w-full p-3 rounded-md border transition-colors text-left',
                  selectedResult?.provider === result.provider
                    ? 'bg-wl-primary-500/10 border-wl-primary-500'
                    : 'border-wl-border-default bg-wl-bg-surface hover:border-wl-border-strong'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-sm font-semibold text-wl-text-primary">
                    {providerLabels[result.provider]}
                  </div>
                  {selectedResult?.provider === result.provider && (
                    <Badge variant="primary" className="text-xs">
                      Selected
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-wl-text-secondary">
                  <div>
                    <div className="text-wl-text-tertiary">Distance</div>
                    <div className="font-semibold text-wl-info-400">
                      {result.totalDistance.toFixed(1)} km
                    </div>
                  </div>
                  <div>
                    <div className="text-wl-text-tertiary">Duration</div>
                    <div className="font-semibold text-wl-warning-400">
                      {Math.round(result.totalDuration)}m
                    </div>
                  </div>
                  <div>
                    <div className="text-wl-text-tertiary">Cost</div>
                    <div className="font-semibold text-wl-success-400">
                      ${result.costEstimate?.toFixed(2) ?? '—'}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
