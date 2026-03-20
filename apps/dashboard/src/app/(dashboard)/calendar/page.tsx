'use client';

import { useState } from 'react';
import { useApiList } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus, Calendar, Trash2 } from 'lucide-react';

interface CalendarRule {
  id: string;
  name: string;
  type: 'BLACKOUT' | 'HOLIDAY' | 'CAPACITY_OVERRIDE' | 'RECURRING';
  startDate: string;
  endDate: string;
  zones: string[];
  capacity?: number;
  isActive: boolean;
  recurrencePattern?: string;
}

export default function CalendarPage() {
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedZone, setSelectedZone] = useState<string>('all');

  const { items: rules, loading, error } = useApiList<CalendarRule>(
    '/api/v4/calendar-rules'
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;

  const filtered = rules.filter((rule) => {
    if (filterType !== 'all' && rule.type !== filterType) return false;
    if (selectedZone !== 'all' && !rule.zones.includes(selectedZone)) return false;
    return true;
  });

  const allZones = Array.from(new Set(rules.flatMap((r) => r.zones))).sort();

  const getRuleTypeColor = (type: string) => {
    switch (type) {
      case 'BLACKOUT':
        return 'danger';
      case 'HOLIDAY':
        return 'warning';
      case 'CAPACITY_OVERRIDE':
        return 'info';
      case 'RECURRING':
        return 'primary';
      default:
        return 'default';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      <div className="sticky top-0 z-10 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary">Calendar Rules</h1>
              <p className="text-sm text-wl-text-secondary mt-1">Manage delivery calendar</p>
            </div>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              New Rule
            </Button>
          </div>

          <div className="flex gap-4 mt-6">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={cn(
                'px-3 py-2 rounded-md text-sm font-medium',
                'bg-wl-bg-overlay border border-wl-border-default',
                'text-wl-text-primary',
                'focus:outline-none focus:ring-2 focus:ring-wl-primary-500'
              )}
            >
              <option value="all">All Types</option>
              <option value="BLACKOUT">Blackout</option>
              <option value="HOLIDAY">Holiday</option>
              <option value="CAPACITY_OVERRIDE">Capacity Override</option>
              <option value="RECURRING">Recurring</option>
            </select>

            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className={cn(
                'px-3 py-2 rounded-md text-sm font-medium',
                'bg-wl-bg-overlay border border-wl-border-default',
                'text-wl-text-primary',
                'focus:outline-none focus:ring-2 focus:ring-wl-primary-500'
              )}
            >
              <option value="all">All Zones</option>
              {allZones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4 max-w-5xl">
          {filtered.length === 0 ? (
            <Card className="p-12 bg-wl-bg-surface border-wl-border-default text-center">
              <Calendar className="w-12 h-12 text-wl-text-tertiary mx-auto mb-4" />
              <p className="text-wl-text-secondary">No calendar rules found</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((rule) => (
                <Card
                  key={rule.id}
                  className="p-6 bg-wl-bg-surface border-wl-border-default hover:border-wl-border-strong transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-wl-text-primary">{rule.name}</h3>
                        <Badge variant={getRuleTypeColor(rule.type) as any}>
                          {rule.type}
                        </Badge>
                        {!rule.isActive && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-wl-text-secondary mb-3">
                        {new Date(rule.startDate).toLocaleDateString()} to {new Date(rule.endDate).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-wl-text-tertiary">
                        <span>Zones: {rule.zones.join(', ')}</span>
                        {rule.capacity && <span>Capacity: {rule.capacity}</span>}
                        {rule.recurrencePattern && <span>Pattern: {rule.recurrencePattern}</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-wl-danger-500 hover:text-wl-danger-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
