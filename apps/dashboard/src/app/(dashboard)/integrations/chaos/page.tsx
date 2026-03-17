'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useChaosScenarios,
  useChaosExecution,
  useChaosHistory,
  type ChaosScenario,
  type ChaosExecution,
  type ChaosResult,
} from '@/hooks/use-chaos-testing';

const PROVIDERS = ['Stripe', 'PayPal', 'Square', 'Adyen', 'AWS S3'];
const FAULT_TYPES = [
  { value: 'latency', label: 'Latency Injection' },
  { value: 'error', label: 'Error Responses' },
  { value: 'timeout', label: 'Timeout' },
  { value: 'partial_failure', label: 'Partial Failure' },
];
const SEVERITIES = [
  { value: 'low', label: 'Low', color: 'info' },
  { value: 'medium', label: 'Medium', color: 'warning' },
  { value: 'high', label: 'High', color: 'danger' },
];

const PREDEFINED_SCENARIOS = [
  { id: 'provider-down', name: 'Provider Down', faultType: 'timeout', severity: 'high' },
  { id: 'degraded', name: 'Degraded Response', faultType: 'latency', severity: 'medium' },
  { id: 'rate-limit', name: 'Rate Limit Exceeded', faultType: 'error', severity: 'high' },
  { id: 'auth-failure', name: 'Auth Failure', faultType: 'error', severity: 'high' },
  { id: 'partial-data', name: 'Partial Data Loss', faultType: 'partial_failure', severity: 'medium' },
];

export default function ChaosDashboard() {
  const [activeTab, setActiveTab] = useState<'builder' | 'execution' | 'results' | 'history'>('builder');
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);

  // Builder form state
  const [builderForm, setBuilderForm] = useState({
    name: '',
    provider: '',
    faultType: '',
    severity: '',
    duration: 60,
    endpoints: '',
  });

  const [recurringForm, setRecurringForm] = useState({
    frequency: 'weekly' as const,
    time: '02:00',
  });

  const { scenarios, executeScenario, createScenario } = useChaosScenarios();
  const { execution: currentExecution } = useChaosExecution(selectedExecution || '');
  const { results, fetchHistory } = useChaosHistory();

  const handleCreateScenario = async (useTemplate?: string) => {
    const payload: Omit<ChaosScenario, 'id' | 'createdAt'> = useTemplate
      ? {
          name: PREDEFINED_SCENARIOS.find((p) => p.id === useTemplate)?.name || 'Scenario',
          provider: PROVIDERS[0],
          faultType: (PREDEFINED_SCENARIOS.find((p) => p.id === useTemplate)?.faultType ||
            'latency') as any,
          severity: (PREDEFINED_SCENARIOS.find((p) => p.id === useTemplate)?.severity ||
            'medium') as any,
          duration: 60,
          targetEndpoints: [],
        }
      : {
          name: builderForm.name,
          provider: builderForm.provider,
          faultType: builderForm.faultType as any,
          severity: builderForm.severity as any,
          duration: builderForm.duration,
          targetEndpoints: builderForm.endpoints.split(',').filter(Boolean),
        };

    try {
      await createScenario(payload);
      setBuilderForm({ name: '', provider: '', faultType: '', severity: '', duration: 60, endpoints: '' });
    } catch (error) {
      console.error('Failed to create scenario:', error);
    }
  };

  const handleExecuteScenario = async (scenarioId: string) => {
    try {
      const execution = await executeScenario(scenarioId);
      setSelectedExecution(execution.id);
      setActiveTab('execution');
    } catch (error) {
      console.error('Failed to execute scenario:', error);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-[var(--wl-bg-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--wl-border-primary)] bg-[var(--wl-bg-primary)] px-8 py-6">
        <h1 className="text-3xl font-bold text-[var(--wl-text-primary)]">Chaos Testing Dashboard</h1>
        <p className="mt-2 text-[var(--wl-text-secondary)]">
          Test provider resilience with controlled fault injection
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--wl-border-primary)] px-8">
        <div className="flex gap-8">
          {(['builder', 'execution', 'results', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'border-b-2 px-1 py-4 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-[var(--wl-primary)] text-[var(--wl-primary)]'
                  : 'border-transparent text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-primary)]'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {activeTab === 'builder' && (
          <div className="space-y-6">
            {/* Predefined Scenarios */}
            <Card className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
              <h2 className="mb-4 text-lg font-semibold text-[var(--wl-text-primary)]">
                Predefined Scenarios
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {PREDEFINED_SCENARIOS.map((scenario) => (
                  <Button
                    key={scenario.id}
                    variant="secondary"
                    onClick={() => handleCreateScenario(scenario.id)}
                    className="h-auto justify-between p-4 text-left"
                  >
                    <div>
                      <div className="font-medium text-[var(--wl-text-primary)]">{scenario.name}</div>
                      <div className="text-xs text-[var(--wl-text-secondary)]">{scenario.faultType}</div>
                    </div>
                    <Badge variant={scenario.severity as any}>{scenario.severity}</Badge>
                  </Button>
                ))}
              </div>
            </Card>

            {/* Custom Scenario Builder */}
            <Card className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
              <h2 className="mb-6 text-lg font-semibold text-[var(--wl-text-primary)]">
                Custom Scenario Builder
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[var(--wl-text-primary)]">Scenario Name</Label>
                    <Input
                      value={builderForm.name}
                      onChange={(e) => setBuilderForm({ ...builderForm, name: e.target.value })}
                      placeholder="e.g., Black Friday Load Test"
                      className="mt-2 bg-[var(--wl-bg-primary)] text-[var(--wl-text-primary)]"
                    />
                  </div>
                  <div>
                    <Label className="text-[var(--wl-text-primary)]">Provider</Label>
                    <Select
                      value={builderForm.provider}
                      onValueChange={(value) => setBuilderForm({ ...builderForm, provider: value })}
                    >
                      <SelectTrigger className="mt-2 bg-[var(--wl-bg-primary)] text-[var(--wl-text-primary)]">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDERS.map((provider) => (
                          <SelectItem key={provider} value={provider}>
                            {provider}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-[var(--wl-text-primary)]">Fault Type</Label>
                    <Select
                      value={builderForm.faultType}
                      onValueChange={(value) => setBuilderForm({ ...builderForm, faultType: value })}
                    >
                      <SelectTrigger className="mt-2 bg-[var(--wl-bg-primary)] text-[var(--wl-text-primary)]">
                        <SelectValue placeholder="Select fault type" />
                      </SelectTrigger>
                      <SelectContent>
                        {FAULT_TYPES.map((fault) => (
                          <SelectItem key={fault.value} value={fault.value}>
                            {fault.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[var(--wl-text-primary)]">Severity</Label>
                    <Select
                      value={builderForm.severity}
                      onValueChange={(value) => setBuilderForm({ ...builderForm, severity: value })}
                    >
                      <SelectTrigger className="mt-2 bg-[var(--wl-bg-primary)] text-[var(--wl-text-primary)]">
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITIES.map((severity) => (
                          <SelectItem key={severity.value} value={severity.value}>
                            {severity.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[var(--wl-text-primary)]">Duration (seconds)</Label>
                    <Input
                      type="number"
                      value={builderForm.duration}
                      onChange={(e) =>
                        setBuilderForm({ ...builderForm, duration: parseInt(e.target.value) })
                      }
                      min="10"
                      max="3600"
                      className="mt-2 bg-[var(--wl-bg-primary)] text-[var(--wl-text-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[var(--wl-text-primary)]">Target Endpoints (comma-separated)</Label>
                  <Input
                    value={builderForm.endpoints}
                    onChange={(e) => setBuilderForm({ ...builderForm, endpoints: e.target.value })}
                    placeholder="/api/checkout, /api/payment"
                    className="mt-2 bg-[var(--wl-bg-primary)] text-[var(--wl-text-primary)]"
                  />
                </div>

                <Button variant="primary" onClick={() => handleCreateScenario()}>
                  Create Scenario
                </Button>
              </div>
            </Card>

            {/* Recurring Schedules */}
            <Card className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
              <h2 className="mb-6 text-lg font-semibold text-[var(--wl-text-primary)]">
                Schedule Recurring Tests
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[var(--wl-text-primary)]">Frequency</Label>
                    <Select value={recurringForm.frequency}>
                      <SelectTrigger className="mt-2 bg-[var(--wl-bg-primary)] text-[var(--wl-text-primary)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[var(--wl-text-primary)]">Time</Label>
                    <Input
                      type="time"
                      value={recurringForm.time}
                      onChange={(e) => setRecurringForm({ ...recurringForm, time: e.target.value })}
                      className="mt-2 bg-[var(--wl-bg-primary)] text-[var(--wl-text-primary)]"
                    />
                  </div>
                </div>
                <Button variant="primary">Schedule Test</Button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'execution' && currentExecution && (
          <ExecutionMonitor execution={currentExecution} />
        )}

        {activeTab === 'results' && selectedExecution && (
          <ResultsViewer executionId={selectedExecution} />
        )}

        {activeTab === 'history' && (
          <HistoryTable scenarios={scenarios} onExecute={handleExecuteScenario} />
        )}
      </div>
    </div>
  );
}

function ExecutionMonitor({ execution }: { execution: ChaosExecution }) {
  return (
    <Card className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--wl-text-primary)]">Execution Progress</h2>
            <Badge variant={execution.status as any}>{execution.status}</Badge>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--wl-bg-primary)]">
            <div
              className="h-full bg-[var(--wl-primary)] transition-all"
              style={{ width: `${execution.progress}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-[var(--wl-text-secondary)]">{execution.progress}% complete</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <MetricCard label="Requests Impacted" value={execution.metrics.requestsImpacted} />
          <MetricCard label="Error Rate" value={`${(execution.metrics.errorRate * 100).toFixed(1)}%`} />
          <MetricCard label="Latency" value={`${execution.metrics.latencyMs}ms`} />
          <MetricCard label="Circuit Breaker Trips" value={execution.metrics.circuitBreakerTrips} />
        </div>

        <div>
          <h3 className="mb-3 font-semibold text-[var(--wl-text-primary)]">Assertions</h3>
          <div className="space-y-2">
            {execution.assertions.map((assertion, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded border border-[var(--wl-border-primary)] bg-[var(--wl-bg-primary)] p-3"
              >
                <div className="text-sm text-[var(--wl-text-primary)]">{assertion.name}</div>
                <Badge variant={assertion.passed ? 'success' : 'danger'}>
                  {assertion.passed ? 'Passed' : 'Failed'}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <Button variant="danger">Stop Execution</Button>
      </div>
    </Card>
  );
}

function ResultsViewer({ executionId }: { executionId: string }) {
  return (
    <Card className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
      <div className="text-center text-[var(--wl-text-secondary)]">Results for execution {executionId}</div>
    </Card>
  );
}

function HistoryTable({
  scenarios,
  onExecute,
}: {
  scenarios: ChaosScenario[];
  onExecute: (id: string) => void;
}) {
  return (
    <Card className="border border-[var(--wl-border-primary)] bg-[var(--wl-bg-secondary)] p-6">
      <h2 className="mb-4 text-lg font-semibold text-[var(--wl-text-primary)]">Scenario History</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--wl-border-primary)]">
              <th className="px-4 py-2 text-left text-[var(--wl-text-primary)]">Name</th>
              <th className="px-4 py-2 text-left text-[var(--wl-text-primary)]">Provider</th>
              <th className="px-4 py-2 text-left text-[var(--wl-text-primary)]">Fault Type</th>
              <th className="px-4 py-2 text-left text-[var(--wl-text-primary)]">Severity</th>
              <th className="px-4 py-2 text-left text-[var(--wl-text-primary)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((scenario) => (
              <tr key={scenario.id} className="border-b border-[var(--wl-border-primary)]">
                <td className="px-4 py-2 text-[var(--wl-text-primary)]">{scenario.name}</td>
                <td className="px-4 py-2 text-[var(--wl-text-secondary)]">{scenario.provider}</td>
                <td className="px-4 py-2 text-[var(--wl-text-secondary)]">{scenario.faultType}</td>
                <td className="px-4 py-2">
                  <Badge variant={scenario.severity as any}>{scenario.severity}</Badge>
                </td>
                <td className="px-4 py-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onExecute(scenario.id)}
                  >
                    Execute
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-[var(--wl-border-primary)] bg-[var(--wl-bg-primary)] p-4">
      <div className="text-xs text-[var(--wl-text-secondary)]">{label}</div>
      <div className="mt-1 text-2xl font-bold text-[var(--wl-primary)]">{value}</div>
    </div>
  );
}
