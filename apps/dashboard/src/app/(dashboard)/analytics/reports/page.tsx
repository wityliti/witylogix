'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useReports } from '@/hooks/use-analytics';

interface ReportStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

interface ScheduleOption {
  frequency: 'daily' | 'weekly' | 'monthly';
  label: string;
  icon: string;
}

interface ExportFormat {
  format: 'pdf' | 'csv' | 'xlsx';
  label: string;
  icon: string;
  enabled: boolean;
}

interface SharePermission {
  email: string;
  role: 'viewer' | 'editor';
  addedDate: string;
}

// Mock data
const REPORT_STEPS: ReportStep[] = [
  {
    id: 'step-1',
    title: 'Select Data Sources',
    description: 'Choose which data sources to include',
    completed: true,
  },
  {
    id: 'step-2',
    title: 'Configure Filters',
    description: 'Set up date ranges and dimensions',
    completed: true,
  },
  {
    id: 'step-3',
    title: 'Choose Charts',
    description: 'Drag and drop chart types',
    completed: false,
  },
  {
    id: 'step-4',
    title: 'Set Schedule',
    description: 'Configure delivery frequency',
    completed: false,
  },
];

const SCHEDULE_OPTIONS: ScheduleOption[] = [
  { frequency: 'daily', label: 'Daily', icon: '📅' },
  { frequency: 'weekly', label: 'Weekly', icon: '📊' },
  { frequency: 'monthly', label: 'Monthly', icon: '📈' },
];

const EXPORT_FORMATS: ExportFormat[] = [
  { format: 'pdf', label: 'PDF', icon: '📄', enabled: true },
  { format: 'csv', label: 'CSV', icon: '📋', enabled: true },
  { format: 'xlsx', label: 'Excel', icon: '📊', enabled: true },
];

const CHART_TYPES = [
  { id: 'line', name: 'Line Chart', icon: '📈' },
  { id: 'bar', name: 'Bar Chart', icon: '📊' },
  { id: 'pie', name: 'Pie Chart', icon: '🥧' },
  { id: 'area', name: 'Area Chart', icon: '📉' },
  { id: 'scatter', name: 'Scatter Plot', icon: '⚫' },
  { id: 'heatmap', name: 'Heatmap', icon: '🔥' },
];

const FILTER_PRESETS = [
  { id: 'last-7', label: 'Last 7 Days' },
  { id: 'last-30', label: 'Last 30 Days' },
  { id: 'last-90', label: 'Last 90 Days' },
  { id: 'ytd', label: 'Year to Date' },
  { id: 'custom', label: 'Custom Range' },
];

const DATA_SOURCE_OPTIONS = [
  { id: 'db-prod', name: 'Production Database', rowCount: '2.4M rows' },
  { id: 'crm', name: 'CRM System', rowCount: '85K rows' },
  { id: 'marketing', name: 'Marketing API', rowCount: '150K rows' },
];

const SAMPLE_SHARE_PERMISSIONS: SharePermission[] = [
  {
    email: 'team@company.com',
    role: 'viewer',
    addedDate: '2026-03-10T10:00:00Z',
  },
  {
    email: 'manager@company.com',
    role: 'editor',
    addedDate: '2026-03-12T14:30:00Z',
  },
];

export default function ReportsPage() {
  const reports = useReports();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCharts, setSelectedCharts] = useState<string[]>([]);
  const [selectedFrequency, setSelectedFrequency] = useState<string>('weekly');
  const [selectedExports, setSelectedExports] = useState<string[]>(['pdf', 'xlsx']);
  const [selectedDataSources, setSelectedDataSources] = useState<string[]>(['db-prod']);
  const [selectedDateRange, setSelectedDateRange] = useState<string>('last-30');
  const [sharedWith, setSharedWith] = useState<SharePermission[]>(SAMPLE_SHARE_PERMISSIONS);

  const toggleChart = (chartId: string) => {
    setSelectedCharts((prev) =>
      prev.includes(chartId)
        ? prev.filter((id) => id !== chartId)
        : [...prev, chartId]
    );
  };

  const toggleExport = (format: string) => {
    setSelectedExports((prev) =>
      prev.includes(format)
        ? prev.filter((f) => f !== format)
        : [...prev, format]
    );
  };

  const toggleDataSource = (sourceId: string) => {
    setSelectedDataSources((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  return (
    <div className="space-y-8">
      {/* Reports List Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary">Report Builder</h2>
          <p className="text-wl-text-secondary mt-1">
            Create, schedule, and share reports with your team
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            const newReport = reports.createReport(`New Report ${Date.now()}`, 'adhoc');
            setSelectedReport(newReport.id);
            setCurrentStep(0);
          }}
        >
          Create Report
        </Button>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.reports.map((report) => (
          <Card
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            className={cn(
              'cursor-pointer transition-all hover:border-wl-border-strong',
              selectedReport === report.id && 'border-wl-primary-500'
            )}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{report.name}</CardTitle>
                  <p className="text-xs text-wl-text-tertiary mt-1">
                    {report.description}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-wl-text-secondary">Status:</span>
                  <Badge
                    variant={
                      report.status === 'active'
                        ? 'success'
                        : report.status === 'paused'
                        ? 'warning'
                        : 'default'
                    }
                  >
                    {report.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-wl-text-secondary">Type:</span>
                  <span className="text-wl-text-primary capitalize">{report.type}</span>
                </div>
                {report.frequency && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-wl-text-secondary">Frequency:</span>
                    <span className="text-wl-text-primary capitalize">{report.frequency}</span>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      reports.deleteReport(report.id);
                      setSelectedReport(null);
                    }}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Report Builder */}
      {selectedReport && (
        <Card>
          <CardHeader>
            <CardTitle>Report Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Step Progress */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                {REPORT_STEPS.map((step, idx) => (
                  <div
                    key={step.id}
                    onClick={() => setCurrentStep(idx)}
                    className="flex flex-col items-center flex-1"
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center font-semibold cursor-pointer transition-all',
                        currentStep >= idx
                          ? 'bg-wl-primary-500 text-wl-text-inverse'
                          : 'bg-wl-bg-overlay text-wl-text-secondary'
                      )}
                    >
                      {idx + 1}
                    </div>
                    <div className="text-xs text-wl-text-secondary mt-2 text-center">
                      {step.title}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-1">
                {REPORT_STEPS.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'h-0.5 flex-1',
                      currentStep > idx ? 'bg-wl-primary-500' : 'bg-wl-bg-overlay'
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Step Content */}
            <div className="space-y-6">
              {currentStep === 0 && (
                <div>
                  <h3 className="font-semibold text-wl-text-primary mb-4">
                    Select Data Sources
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {DATA_SOURCE_OPTIONS.map((source) => (
                      <div
                        key={source.id}
                        onClick={() => toggleDataSource(source.id)}
                        className={cn(
                          'p-4 rounded-lg border-2 cursor-pointer transition-all',
                          selectedDataSources.includes(source.id)
                            ? 'border-wl-primary-500 bg-wl-primary-500/10'
                            : 'border-wl-border-subtle bg-wl-bg-surface'
                        )}
                      >
                        <div className="font-medium text-wl-text-primary">
                          {source.name}
                        </div>
                        <div className="text-xs text-wl-text-tertiary mt-1">
                          {source.rowCount}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div>
                  <h3 className="font-semibold text-wl-text-primary mb-4">
                    Configure Filters
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-wl-text-secondary block mb-3">
                        Date Range
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {FILTER_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => setSelectedDateRange(preset.id)}
                            className={cn(
                              'px-3 py-2 rounded border transition-all text-sm',
                              selectedDateRange === preset.id
                                ? 'border-wl-primary-500 bg-wl-primary-500/10 text-wl-primary-400'
                                : 'border-wl-border-subtle text-wl-text-secondary hover:border-wl-border-strong'
                            )}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div>
                  <h3 className="font-semibold text-wl-text-primary mb-4">
                    Select Chart Types
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {CHART_TYPES.map((chart) => (
                      <div
                        key={chart.id}
                        onClick={() => toggleChart(chart.id)}
                        className={cn(
                          'p-4 rounded-lg border-2 cursor-pointer transition-all text-center',
                          selectedCharts.includes(chart.id)
                            ? 'border-wl-primary-500 bg-wl-primary-500/10'
                            : 'border-wl-border-subtle bg-wl-bg-surface'
                        )}
                      >
                        <div className="text-2xl mb-2">{chart.icon}</div>
                        <div className="text-sm font-medium text-wl-text-primary">
                          {chart.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-wl-text-primary mb-4">
                      Schedule Delivery
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {SCHEDULE_OPTIONS.map((option) => (
                        <button
                          key={option.frequency}
                          onClick={() => setSelectedFrequency(option.frequency)}
                          className={cn(
                            'p-3 rounded-lg border-2 text-center transition-all',
                            selectedFrequency === option.frequency
                              ? 'border-wl-primary-500 bg-wl-primary-500/10'
                              : 'border-wl-border-subtle bg-wl-bg-surface'
                          )}
                        >
                          <div className="text-xl mb-2">{option.icon}</div>
                          <div className="text-sm font-medium text-wl-text-primary">
                            {option.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-wl-text-primary mb-4">
                      Export Formats
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {EXPORT_FORMATS.map((format) => (
                        <button
                          key={format.format}
                          onClick={() => toggleExport(format.format)}
                          disabled={!format.enabled}
                          className={cn(
                            'p-3 rounded-lg border-2 text-center transition-all disabled:opacity-50',
                            selectedExports.includes(format.format)
                              ? 'border-wl-primary-500 bg-wl-primary-500/10'
                              : 'border-wl-border-subtle bg-wl-bg-surface'
                          )}
                        >
                          <div className="text-xl mb-2">{format.icon}</div>
                          <div className="text-sm font-medium text-wl-text-primary">
                            {format.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-wl-text-primary mb-4">
                      Share Permissions
                    </h3>
                    <div className="space-y-3">
                      {sharedWith.map((perm) => (
                        <div
                          key={perm.email}
                          className="flex items-center justify-between p-3 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle"
                        >
                          <div>
                            <div className="text-sm font-medium text-wl-text-primary">
                              {perm.email}
                            </div>
                            <div className="text-xs text-wl-text-tertiary">
                              Added {new Date(perm.addedDate).toLocaleDateString()}
                            </div>
                          </div>
                          <Badge
                            variant={perm.role === 'editor' ? 'primary' : 'default'}
                          >
                            {perm.role}
                          </Badge>
                        </div>
                      ))}
                      <Button variant="secondary" size="sm" className="w-full">
                        Add User
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-3 mt-8">
              {currentStep > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => setCurrentStep(currentStep - 1)}
                >
                  Previous
                </Button>
              )}
              {currentStep < REPORT_STEPS.length - 1 && (
                <Button
                  variant="primary"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="ml-auto"
                >
                  Next
                </Button>
              )}
              {currentStep === REPORT_STEPS.length - 1 && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setSelectedReport(null);
                    setCurrentStep(0);
                  }}
                  className="ml-auto"
                >
                  Save Report
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
