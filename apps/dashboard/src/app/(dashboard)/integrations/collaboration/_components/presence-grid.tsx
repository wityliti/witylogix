'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface PresenceIndicator {
  userId: string;
  name: string;
  status: 'online' | 'away' | 'offline' | 'busy';
  lastActive: string;
}

interface PresenceGridProps {
  indicators: PresenceIndicator[];
}

function getStatusColor(status: string) {
  switch (status) {
    case 'online':
      return 'bg-wl-success-500/20 text-wl-success-400 border-wl-success-500/50';
    case 'away':
      return 'bg-wl-warning-bg text-wl-warning-400 border-wl-warning-500/50';
    case 'busy':
      return 'bg-wl-warning-500/20 text-wl-warning-400 border-wl-warning-500/50';
    case 'offline':
      return 'bg-wl-neutral-500/20 text-wl-text-secondary border-wl-neutral-500/50';
    default:
      return '';
  }
}

export function PresenceGrid({ indicators }: PresenceGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {indicators.map((indicator) => (
        <Card key={indicator.userId} className="bg-wl-bg-elevated">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center text-wl-text-primary font-semibold',
                    getStatusColor(indicator.status)
                  )}
                >
                  {indicator.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-wl-text-primary truncate">
                    {indicator.name}
                  </h4>
                  <p className="text-xs text-wl-text-tertiary mt-1">
                    {indicator.lastActive}
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  'px-2 py-1 rounded-full text-xs font-semibold border',
                  getStatusColor(indicator.status)
                )}
              >
                {indicator.status.charAt(0).toUpperCase() +
                  indicator.status.slice(1)}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
