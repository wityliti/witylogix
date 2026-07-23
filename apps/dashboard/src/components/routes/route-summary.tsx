'use client';

import { Clock, MapPin, Zap, Fuel } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import type { Stop, OptimizationResult } from '@/hooks/use-route-planner';

interface RouteSummaryProps {
  result?: OptimizationResult;
  stops: Stop[];
  className?: string;
}

export function RouteSummary({ result, stops, className }: RouteSummaryProps) {
  if (!result) {
    return (
      <Card className={cn('p-6 bg-wl-bg-elevated border-wl-border-default', className)}>
        <div className="text-center text-wl-text-tertiary">
          Run optimization to see route summary
        </div>
      </Card>
    );
  }

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Stops */}
        <Card className="p-3 bg-wl-bg-surface border-wl-border-default">
          <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-1">
            Total Stops
          </div>
          <div className="text-2xl font-bold text-wl-primary-500">
            {result.stopSequence.length}
          </div>
        </Card>

        {/* Total Distance */}
        <Card className="p-3 bg-wl-bg-surface border-wl-border-default">
          <div className="flex items-center gap-1 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-1">
            <MapPin className="w-3 h-3" />
            Distance
          </div>
          <div className="text-2xl font-bold text-wl-info-400">
            {result.totalDistance.toFixed(1)} km
          </div>
        </Card>

        {/* Total Duration */}
        <Card className="p-3 bg-wl-bg-surface border-wl-border-default">
          <div className="flex items-center gap-1 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-1">
            <Clock className="w-3 h-3" />
            Duration
          </div>
          <div className="text-2xl font-bold text-wl-warning-400">
            {formatDuration(Math.round(result.totalDuration))}
          </div>
        </Card>

        {/* Fuel Estimate */}
        {result.fuelEstimate && (
          <Card className="p-3 bg-wl-bg-surface border-wl-border-default">
            <div className="flex items-center gap-1 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-1">
              <Fuel className="w-3 h-3" />
              Fuel Est.
            </div>
            <div className="text-2xl font-bold text-wl-success-400">
              {result.fuelEstimate.toFixed(1)}L
            </div>
          </Card>
        )}
      </div>

      {/* Stop Timeline */}
      <Card className="p-4 bg-wl-bg-elevated border-wl-border-default">
        <div className="text-sm font-semibold text-wl-text-primary mb-4">
          Route Timeline
        </div>

        <div className="space-y-0 max-h-64 overflow-y-auto">
          {result.stopSequence.map((stop, idx) => (
            <div
              key={stop.id}
              className="flex gap-3 pb-3 last:pb-0"
            >
              {/* Timeline Dot & Line */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-wl-text-primary"
                  style={{
                    backgroundColor: 'var(--wl-primary-500)',
                  }}
                >
                  {idx + 1}
                </div>
                {idx < result.stopSequence.length - 1 && (
                  <div
                    className="w-0.5 h-12 mt-1"
                    style={{
                      backgroundColor: 'var(--wl-border-default)',
                    }}
                  />
                )}
              </div>

              {/* Stop Details */}
              <div className="flex-1 pt-0.5">
                <div className="text-sm font-medium text-wl-text-primary">
                  {stop.address}
                </div>

                <div className="flex flex-wrap gap-2 mt-1">
                  {/* ETA */}
                  {stop.arrivalEta && (
                    <div className="text-xs text-wl-text-tertiary bg-wl-bg-surface px-2 py-1 rounded">
                      🕐 {stop.arrivalEta}
                    </div>
                  )}

                  {/* Time Window */}
                  {stop.timeWindow && (
                    <div className="text-xs text-wl-text-tertiary bg-wl-bg-surface px-2 py-1 rounded">
                      ⏱️ {stop.timeWindow.earliest} - {stop.timeWindow.latest}
                    </div>
                  )}

                  {/* Wait Time */}
                  {stop.waitTime && stop.waitTime > 0 && (
                    <div className="text-xs text-wl-warning-400 bg-wl-warning-bg/10 px-2 py-1 rounded border border-wl-warning-400/20">
                      Wait: {stop.waitTime}m
                    </div>
                  )}

                  {/* Service Time */}
                  {stop.serviceTime && (
                    <div className="text-xs text-wl-info-400 bg-wl-info-bg/10 px-2 py-1 rounded border border-wl-info-400/20">
                      Service: {stop.serviceTime}m
                    </div>
                  )}
                </div>

                {stop.notes && (
                  <div className="text-xs text-wl-text-tertiary mt-1.5 italic">
                    {stop.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Cost Estimate */}
      {result.costEstimate && (
        <Card className="p-4 bg-wl-bg-surface border-wl-border-default text-center">
          <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-1">
            Estimated Cost
          </div>
          <div className="text-3xl font-bold text-wl-success-400">
            ${result.costEstimate.toFixed(2)}
          </div>
        </Card>
      )}
    </div>
  );
}
