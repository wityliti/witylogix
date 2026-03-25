'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { LayoutGrid, Plus } from 'lucide-react';

interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: Array<{
    id: string;
    name: string;
    type: 'metric' | 'chart' | 'table' | 'heatmap';
    size: 'small' | 'medium' | 'large';
  }>;
  layout: number;
  createdAt: string;
  updatedAt: string;
  owner: string;
  isPublic: boolean;
}

/**
 * Analytics Dashboards Page
 *
 * Browse, create, and manage custom analytics dashboards
 */
export default function DashboardsPage() {
  const { items: dashboards, loading, error } = useApiList<Dashboard>(
    '/api/v4/analytics?view=dashboards'
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error?.message ?? 'Failed to load dashboards'} />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary">Dashboards</h1>
              <p className="text-sm text-wl-text-secondary mt-1">Custom analytics dashboards</p>
            </div>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              New Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-7xl">
          {dashboards.length === 0 ? (
            <Card className="p-12 bg-wl-bg-surface border-wl-border-default text-center">
              <LayoutGrid className="w-12 h-12 text-wl-text-tertiary mx-auto mb-4" />
              <p className="text-wl-text-secondary">No dashboards yet</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboards.map((dashboard) => (
                <Card
                  key={dashboard.id}
                  className="p-6 bg-wl-bg-surface border-wl-border-default hover:border-wl-border-strong cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="font-semibold text-wl-text-primary flex-1">{dashboard.name}</h3>
                    {dashboard.isPublic && (
                      <Badge variant="info" className="text-xs">Public</Badge>
                    )}
                  </div>
                  <p className="text-sm text-wl-text-secondary mb-4">{dashboard.description}</p>
                  <div className="flex items-center justify-between text-xs text-wl-text-tertiary">
                    <span>{dashboard.widgets.length} widgets</span>
                    <span>{dashboard.layout} columns</span>
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
