'use client';

import { useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Settings, Trash2, Plus, BarChart3, LineChart, PieChart, Table2, MapPin, Activity, Calendar, RefreshCw } from 'lucide-react';
import { useApiList, useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { ErrorState } from '@/components/ui/error-state';

interface Widget {
  id: string;
  name: string;
  type: string;
  size?: string;
  isActive: boolean;
  position?: number;
}

interface CatalogWidget {
  type: string;
  name: string;
  description: string;
  defaultSize?: string;
}

interface CatalogResponse {
  data: CatalogWidget[];
  total: number;
}

const getWidgetIcon = (type: string) => {
  switch (type) {
    case 'line_chart': return <LineChart size={18} />;
    case 'bar_chart': return <BarChart3 size={18} />;
    case 'pie_chart': return <PieChart size={18} />;
    case 'table': return <Table2 size={18} />;
    case 'map': return <MapPin size={18} />;
    case 'activity': return <Activity size={18} />;
    case 'calendar': return <Calendar size={18} />;
    default: return <BarChart3 size={18} />;
  }
};

const getWidgetColor = (index: number): string => {
  const colors = [
    'rgba(59, 130, 246, 0.1)',
    'rgba(34, 197, 94, 0.1)',
    'rgba(249, 115, 22, 0.1)',
    'rgba(168, 85, 247, 0.1)',
    'rgba(236, 72, 153, 0.1)',
    'rgba(14, 165, 233, 0.1)',
  ];
  return colors[index % colors.length];
};

export default function WidgetsPage() {
  const [showGallery, setShowGallery] = useState(false);

  const { items: allWidgets, loading, error, refetch } = useApiList<Widget>('/api/v4/widgets');
  const { data: catalogResp } = useApiQuery<CatalogResponse>('/api/v4/widgets/catalog');

  const catalog = catalogResp?.data ?? [];
  const activeWidgets = allWidgets.filter((w) => w.isActive);

  const handleRemoveWidget = useCallback(async (widgetId: string) => {
    await api.delete(`/api/v4/widgets/${widgetId}`);
    refetch();
  }, [refetch]);

  const handleAddWidget = useCallback(async (widget: CatalogWidget) => {
    await api.post('/api/v4/widgets', { type: widget.type, name: widget.name });
    refetch();
  }, [refetch]);

  return (
    <>
      <Header
        title="Dashboard Widgets"
        subtitle={`${activeWidgets.length} active · ${catalog.length} available`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={refetch} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
            <Button variant="primary" size="md" onClick={() => setShowGallery(!showGallery)}>
              {showGallery ? 'Hide Gallery' : '+ Add Widget'}
            </Button>
          </div>
        }
      />

      <div className="p-6 bg-wl-bg-root min-h-screen">
        {loading ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-wl-bg-surface border border-wl-border-default animate-pulse h-52">{" "}</Card>
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error.message} onRetry={refetch} />
        ) : (
          <>
            {/* Active Widgets */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">Active Widgets</h2>
              {activeWidgets.length === 0 ? (
                <Card className="bg-wl-bg-surface border border-wl-border-default p-8 text-center">
                  <p className="text-gray-400">No active widgets. Add some from the gallery.</p>
                </Card>
              ) : (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                  {activeWidgets.map((widget, idx) => (
                    <Card key={widget.id} className="bg-wl-bg-surface border border-wl-border-default flex flex-col">
                      <CardHeader className="pb-3">
                        <div className="flex gap-2 items-center flex-1">
                          <div
                            className="p-2 rounded-md flex items-center justify-center text-white"
                            style={{ background: getWidgetColor(idx) }}
                          >
                            {getWidgetIcon(widget.type)}
                          </div>
                          <div>
                            <CardTitle className="text-base text-white">{widget.name}</CardTitle>
                            {widget.size && <p className="text-xs text-gray-400 mt-1">{widget.size}</p>}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 pt-0 pb-4">
                        <div className="mb-4">
                          <Badge variant="success">Active</Badge>
                        </div>
                        <div
                          className="border border-dashed border-wl-border-default rounded-md flex items-center justify-center mb-4 text-xs text-gray-400"
                          style={{ background: getWidgetColor(idx), height: '80px' }}
                        >
                          Widget Preview
                        </div>
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" className="flex-1">
                            <Settings size={14} />
                          </Button>
                          <Button variant="danger" size="sm" className="flex-1" onClick={() => handleRemoveWidget(widget.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Widget Gallery */}
            {showGallery && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-white mb-4">Widget Gallery</h2>
                {catalog.length === 0 ? (
                  <Card className="bg-wl-bg-surface border border-wl-border-default p-8 text-center">
                    <p className="text-gray-400">No widgets available in catalog.</p>
                  </Card>
                ) : (
                  <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                    {catalog.map((widget, idx) => (
                      <Card key={widget.type} className="bg-wl-bg-surface border border-wl-border-default flex flex-col">
                        <CardHeader className="pb-3">
                          <div className="flex gap-2 items-center">
                            <div
                              className="p-2 rounded-md flex items-center justify-center text-white"
                              style={{ background: getWidgetColor(idx) }}
                            >
                              {getWidgetIcon(widget.type)}
                            </div>
                            <CardTitle className="text-base text-white">{widget.name}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1 pt-0 pb-4 flex flex-col">
                          <p className="text-sm text-gray-400 mb-4 flex-1">{widget.description}</p>
                          <div
                            className="border border-dashed border-wl-border-default rounded-md flex items-center justify-center mb-4 text-xs text-gray-400"
                            style={{ background: getWidgetColor(idx), height: '60px' }}
                          >
                            Preview
                          </div>
                          <Button variant="primary" size="sm" className="w-full" onClick={() => handleAddWidget(widget)}>
                            <Plus size={14} className="mr-1" />
                            Add to Dashboard
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
