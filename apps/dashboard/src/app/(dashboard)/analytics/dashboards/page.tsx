'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDashboards } from '@/hooks/use-analytics';

interface Widget {
  id: string;
  name: string;
  type: 'metric' | 'chart' | 'table' | 'heatmap';
  size: 'small' | 'medium' | 'large';
}

interface LayoutPreset {
  id: string;
  name: string;
  columns: number;
  description: string;
}

interface AutoRefreshOption {
  interval: number;
  label: string;
}

// Mock data
const AVAILABLE_WIDGETS: Widget[] = [
  { id: 'widget-1', name: 'KPI Card', type: 'metric', size: 'small' },
  { id: 'widget-2', name: 'Line Chart', type: 'chart', size: 'medium' },
  { id: 'widget-3', name: 'Bar Chart', type: 'chart', size: 'medium' },
  { id: 'widget-4', name: 'Data Table', type: 'table', size: 'large' },
  { id: 'widget-5', name: 'Heatmap', type: 'heatmap', size: 'large' },
  { id: 'widget-6', name: 'Pie Chart', type: 'chart', size: 'medium' },
  { id: 'widget-7', name: 'Gauge', type: 'metric', size: 'small' },
  { id: 'widget-8', name: 'Area Chart', type: 'chart', size: 'large' },
];

const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: 'layout-1', name: 'Single Column', columns: 1, description: 'Full-width layout' },
  { id: 'layout-2', name: 'Two Columns', columns: 2, description: 'Balanced layout' },
  { id: 'layout-3', name: 'Three Columns', columns: 3, description: 'Compact layout' },
];

const AUTO_REFRESH_OPTIONS: AutoRefreshOption[] = [
  { interval: 0, label: 'Off' },
  { interval: 60, label: '1 minute' },
  { interval: 300, label: '5 minutes' },
  { interval: 900, label: '15 minutes' },
  { interval: 3600, label: '1 hour' },
];

const CHART_PLACEHOLDERS = [
  { title: 'Revenue Trend', values: [4500, 5200, 4800, 6200, 5900, 7100] },
  { title: 'Customer Growth', values: [2400, 2700, 3100, 3400, 3700, 4100] },
  { title: 'Order Volume', values: [1200, 1900, 1800, 2200, 2100, 2400] },
  { title: 'Conversion Rate', values: [65, 68, 70, 72, 71, 75] },
];

export default function DashboardsPage() {
  const dashboards = useDashboards();
  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(null);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [newDashboardDesc, setNewDashboardDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState('layout-2');
  const [selectedRefreshInterval, setSelectedRefreshInterval] = useState(300);
  const [dashboardWidgets, setDashboardWidgets] = useState<Widget[]>([]);
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false);

  const handleCreateDashboard = () => {
    if (newDashboardName.trim()) {
      const newDash = dashboards.createDashboard(newDashboardName, newDashboardDesc);
      setSelectedDashboard(newDash.id);
      setNewDashboardName('');
      setNewDashboardDesc('');
      setIsCreating(false);
      setDashboardWidgets([]);
    }
  };

  const addWidget = (widget: Widget) => {
    if (selectedDashboard) {
      setDashboardWidgets((prev) => [...prev, { ...widget, id: `${widget.id}-${Date.now()}` }]);
      dashboards.updateDashboard(selectedDashboard, {
        widgetCount: dashboardWidgets.length + 1,
      });
    }
  };

  const removeWidget = (widgetId: string) => {
    setDashboardWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    if (selectedDashboard) {
      dashboards.updateDashboard(selectedDashboard, {
        widgetCount: dashboardWidgets.length - 1,
      });
    }
  };

  const getLayoutColumns = () => {
    const preset = LAYOUT_PRESETS.find((p) => p.id === selectedLayout);
    return preset?.columns || 2;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary">Dashboard Gallery</h2>
          <p className="text-wl-text-secondary mt-1">
            Create and manage your custom dashboards
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setIsCreating(true)}
        >
          Create Dashboard
        </Button>
      </div>

      {/* Create Dashboard Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>New Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Dashboard Name
                </label>
                <input
                  type="text"
                  value={newDashboardName}
                  onChange={(e) => setNewDashboardName(e.target.value)}
                  placeholder="e.g., Sales Performance Dashboard"
                  className="w-full px-4 py-2 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle text-wl-text-primary placeholder-wl-text-tertiary focus:outline-none focus:border-wl-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newDashboardDesc}
                  onChange={(e) => setNewDashboardDesc(e.target.value)}
                  placeholder="Describe what this dashboard shows..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle text-wl-text-primary placeholder-wl-text-tertiary focus:outline-none focus:border-wl-primary-500"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsCreating(false);
                    setNewDashboardName('');
                    setNewDashboardDesc('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreateDashboard}
                  disabled={!newDashboardName.trim()}
                >
                  Create
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dashboards.dashboards.map((dashboard) => (
          <Card
            key={dashboard.id}
            onClick={() => setSelectedDashboard(dashboard.id)}
            className={cn(
              'cursor-pointer transition-all hover:border-wl-border-strong',
              selectedDashboard === dashboard.id && 'border-wl-primary-500'
            )}
          >
            <CardHeader>
              <div>
                <CardTitle className="text-base">{dashboard.name}</CardTitle>
                <p className="text-xs text-wl-text-tertiary mt-1">
                  {dashboard.description}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-wl-text-secondary">Widgets:</span>
                    <p className="font-semibold text-wl-text-primary">
                      {dashboard.widgetCount}
                    </p>
                  </div>
                  <div>
                    <span className="text-wl-text-secondary">Owner:</span>
                    <p className="font-semibold text-wl-text-primary">
                      {dashboard.owner}
                    </p>
                  </div>
                  <div>
                    <span className="text-wl-text-secondary">Auto-refresh:</span>
                    <p className="font-semibold text-wl-text-primary">
                      {dashboard.autoRefresh ? 'On' : 'Off'}
                    </p>
                  </div>
                  <div>
                    <span className="text-wl-text-secondary">Viewers:</span>
                    <p className="font-semibold text-wl-text-primary">
                      {dashboard.viewers}
                    </p>
                  </div>
                </div>

                {dashboard.isShared && (
                  <Badge variant="info">Shared</Badge>
                )}

                <div className="text-xs text-wl-text-tertiary">
                  Modified: {new Date(dashboard.lastModified).toLocaleDateString()}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      dashboards.deleteDashboard(dashboard.id);
                      setSelectedDashboard(null);
                    }}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dashboard Editor */}
      {selectedDashboard && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Dashboard Editor</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowWidgetLibrary(!showWidgetLibrary)}
                >
                  {showWidgetLibrary ? 'Hide' : 'Show'} Widgets
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDashboard(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Layout Configuration */}
              <div>
                <h3 className="font-semibold text-wl-text-primary mb-3">
                  Layout
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {LAYOUT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedLayout(preset.id)}
                      className={cn(
                        'p-3 rounded-lg border-2 text-center transition-all',
                        selectedLayout === preset.id
                          ? 'border-wl-primary-500 bg-wl-primary-500/10'
                          : 'border-wl-border-subtle bg-wl-bg-surface'
                      )}
                    >
                      <div className="text-sm font-medium text-wl-text-primary">
                        {preset.name}
                      </div>
                      <div className="text-xs text-wl-text-tertiary mt-1">
                        {preset.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-refresh Configuration */}
              <div>
                <h3 className="font-semibold text-wl-text-primary mb-3">
                  Auto-Refresh
                </h3>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {AUTO_REFRESH_OPTIONS.map((option) => (
                    <button
                      key={option.interval}
                      onClick={() => setSelectedRefreshInterval(option.interval)}
                      className={cn(
                        'px-3 py-2 rounded border text-xs font-medium transition-all',
                        selectedRefreshInterval === option.interval
                          ? 'border-wl-primary-500 bg-wl-primary-500/10 text-wl-primary-400'
                          : 'border-wl-border-subtle text-wl-text-secondary hover:border-wl-border-strong'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Widget Library */}
              {showWidgetLibrary && (
                <div>
                  <h3 className="font-semibold text-wl-text-primary mb-3">
                    Widget Library
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {AVAILABLE_WIDGETS.map((widget) => (
                      <button
                        key={widget.id}
                        onClick={() => addWidget(widget)}
                        className="p-3 rounded-lg border border-wl-border-subtle hover:border-wl-primary-500 transition-all text-center"
                      >
                        <div className="text-sm font-medium text-wl-text-primary">
                          {widget.name}
                        </div>
                        <div className="text-xs text-wl-text-tertiary mt-1">
                          {widget.type}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dashboard Preview */}
              <div>
                <h3 className="font-semibold text-wl-text-primary mb-3">
                  Dashboard Preview
                </h3>
                <div
                  className={cn(
                    'gap-4 p-4 bg-wl-bg-surface rounded-lg border border-wl-border-subtle',
                    `grid grid-cols-${getLayoutColumns()}`
                  )}
                >
                  {dashboardWidgets.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-wl-text-tertiary">
                      No widgets added yet. Select widgets from the library.
                    </div>
                  ) : (
                    dashboardWidgets.map((widget) => (
                      <div
                        key={widget.id}
                        className={cn(
                          'rounded-lg border border-wl-border-subtle overflow-hidden',
                          'bg-wl-bg-elevated'
                        )}
                      >
                        {/* Chart Placeholder */}
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium text-wl-text-primary">
                              {widget.name}
                            </h4>
                            <button
                              onClick={() => removeWidget(widget.id)}
                              className="text-wl-text-tertiary hover:text-wl-danger-400 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="aspect-video bg-wl-bg-overlay rounded flex items-center justify-center">
                            <span className="text-xs text-wl-text-tertiary">
                              {widget.type} chart
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                {CHART_PLACEHOLDERS.map((chart, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle">
                    <div className="text-xs font-medium text-wl-text-secondary mb-2">
                      {chart.title}
                    </div>
                    <div className="text-lg font-bold text-wl-text-primary">
                      {chart.values[chart.values.length - 1].toLocaleString()}
                    </div>
                    <div className="text-xs text-wl-text-tertiary mt-1">
                      ↑ {Math.round((chart.values[chart.values.length - 1] / chart.values[0] - 1) * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
