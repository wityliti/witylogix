'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Plus, Trash2, ArrowLeft, Flag, CheckCircle2 } from 'lucide-react';

export interface FlowStage {
  key: string;
  label: string;
  description?: string;
  color?: string;
  isInitial?: boolean;
  isTerminal?: boolean;
  transitions: Array<{ to: string; label?: string; requiredScope?: string }>;
}

export interface ActivityFlow {
  id: string;
  entityType: 'SHIPMENT' | 'ORDER';
  key: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  graph: { stages: FlowStage[] };
  version: number;
}

interface FlowEditorProps {
  flowId?: string;
}

const DEFAULT_STAGE: FlowStage = {
  key: '',
  label: '',
  transitions: [],
};

const DEFAULT_FLOW: Omit<ActivityFlow, 'id' | 'version'> = {
  entityType: 'SHIPMENT',
  key: '',
  name: '',
  description: '',
  isDefault: false,
  status: 'DRAFT',
  graph: { stages: [] },
};

export function FlowEditor({ flowId }: FlowEditorProps) {
  const router = useRouter();
  const isEdit = Boolean(flowId);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [flow, setFlow] = useState<Omit<ActivityFlow, 'id' | 'version'>>(DEFAULT_FLOW);

  useEffect(() => {
    if (!flowId) return;
    setLoading(true);
    api
      .get<{ data: ActivityFlow }>(`/api/v4/operations/flows/${flowId}`)
      .then((res) => {
        setFlow({
          entityType: res.data.entityType,
          key: res.data.key,
          name: res.data.name,
          description: res.data.description ?? '',
          isDefault: res.data.isDefault,
          status: res.data.status,
          graph: res.data.graph ?? { stages: [] },
        });
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [flowId]);

  const validationErrors = useMemo(() => validateFlow(flow), [flow]);

  const updateStage = (index: number, patch: Partial<FlowStage>) => {
    setFlow((f) => ({
      ...f,
      graph: {
        ...f.graph,
        stages: f.graph.stages.map((s, i) => (i === index ? { ...s, ...patch } : s)),
      },
    }));
  };

  const addStage = () => {
    setFlow((f) => ({
      ...f,
      graph: {
        ...f.graph,
        stages: [
          ...f.graph.stages,
          {
            ...DEFAULT_STAGE,
            key: `stage_${f.graph.stages.length + 1}`,
            label: `Stage ${f.graph.stages.length + 1}`,
            isInitial: f.graph.stages.length === 0,
          },
        ],
      },
    }));
  };

  const removeStage = (index: number) => {
    setFlow((f) => ({
      ...f,
      graph: {
        ...f.graph,
        stages: f.graph.stages.filter((_, i) => i !== index),
      },
    }));
  };

  const toggleTransition = (stageIdx: number, targetKey: string) => {
    setFlow((f) => {
      const stage = f.graph.stages[stageIdx];
      const exists = stage.transitions.some((t) => t.to === targetKey);
      const transitions = exists
        ? stage.transitions.filter((t) => t.to !== targetKey)
        : [...stage.transitions, { to: targetKey }];
      return {
        ...f,
        graph: {
          ...f.graph,
          stages: f.graph.stages.map((s, i) =>
            i === stageIdx ? { ...s, transitions } : s,
          ),
        },
      };
    });
  };

  const handleSave = async () => {
    if (validationErrors.length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        entityType: flow.entityType,
        key: flow.key,
        name: flow.name,
        description: flow.description || undefined,
        graph: flow.graph,
        isDefault: flow.isDefault,
        status: flow.status,
      };
      if (isEdit) {
        await api.patch(`/api/v4/operations/flows/${flowId}`, payload);
      } else {
        await api.post(`/api/v4/operations/flows`, payload);
      }
      router.push('/operations/flows');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save flow');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSkeleton className="min-h-[60vh]" />;
  if (loadError) {
    return (
      <ErrorState
        message={loadError}
        onRetry={() => router.refresh()}
        onAction={{
          label: 'Back to flows',
          onClick: () => router.push('/operations/flows'),
        }}
      />
    );
  }

  return (
    <div>
      <Header
        title={isEdit ? `Edit: ${flow.name || 'Activity flow'}` : 'New activity flow'}
        subtitle="Stages define the states your shipments or orders can be in. Transitions are the allowed moves between them."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push('/operations/flows')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || validationErrors.length > 0}
            >
              {saving ? 'Saving…' : 'Save flow'}
            </Button>
          </div>
        }
      />

      <div className="p-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>
                Identifies and classifies the flow within your shop.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={flow.name}
                    onChange={(e) => setFlow({ ...flow, name: e.target.value })}
                    placeholder="Standard shipment flow"
                  />
                </div>
                <div>
                  <Label htmlFor="key">Key</Label>
                  <Input
                    id="key"
                    value={flow.key}
                    onChange={(e) =>
                      setFlow({
                        ...flow,
                        key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
                      })
                    }
                    placeholder="standard"
                    disabled={isEdit}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={flow.description ?? ''}
                  onChange={(e) => setFlow({ ...flow, description: e.target.value })}
                  placeholder="When to use this flow"
                  className="w-full rounded-md border border-wl-border-default bg-wl-bg-elevated px-3 py-2 text-sm min-h-20 resize-y"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="entityType">Entity type</Label>
                  <select
                    id="entityType"
                    value={flow.entityType}
                    onChange={(e) =>
                      setFlow({
                        ...flow,
                        entityType: e.target.value as 'SHIPMENT' | 'ORDER',
                      })
                    }
                    disabled={isEdit}
                    className="w-full rounded-md border border-wl-border-default bg-wl-bg-elevated px-3 py-2 text-sm"
                  >
                    <option value="SHIPMENT">Shipment</option>
                    <option value="ORDER">Order</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={flow.status}
                    onChange={(e) =>
                      setFlow({
                        ...flow,
                        status: e.target.value as ActivityFlow['status'],
                      })
                    }
                    className="w-full rounded-md border border-wl-border-default bg-wl-bg-elevated px-3 py-2 text-sm"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={flow.isDefault}
                      onChange={(e) =>
                        setFlow({ ...flow, isDefault: e.target.checked })
                      }
                    />
                    Default for this entity type
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Stages</CardTitle>
                <CardDescription>
                  One stage must be marked as initial. Terminal stages end the flow.
                </CardDescription>
              </div>
              <Button onClick={addStage} variant="secondary">
                <Plus className="w-4 h-4 mr-2" />
                Add stage
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {flow.graph.stages.length === 0 && (
                <p className="text-sm text-wl-text-tertiary text-center py-8">
                  Add your first stage to get started.
                </p>
              )}
              {flow.graph.stages.map((stage, idx) => (
                <StageEditor
                  key={idx}
                  stage={stage}
                  allStages={flow.graph.stages}
                  onChange={(patch) => updateStage(idx, patch)}
                  onRemove={() => removeStage(idx)}
                  onToggleTransition={(targetKey) => toggleTransition(idx, targetKey)}
                  onMakeInitial={() => {
                    setFlow((f) => ({
                      ...f,
                      graph: {
                        ...f.graph,
                        stages: f.graph.stages.map((s, i) => ({
                          ...s,
                          isInitial: i === idx,
                        })),
                      },
                    }));
                  }}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Validation</CardTitle>
            </CardHeader>
            <CardContent>
              {validationErrors.length === 0 ? (
                <div className="flex items-center gap-2 text-wl-success-500 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Flow looks good.
                </div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {validationErrors.map((err, i) => (
                    <li key={i} className="text-wl-danger-400">
                      {err}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Graph preview</CardTitle>
              <CardDescription>
                A quick visual sanity check of stages and their transitions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GraphPreview stages={flow.graph.stages} />
            </CardContent>
          </Card>

          {saveError && (
            <Card className="border-wl-danger-500">
              <CardContent className="py-4 text-sm text-wl-danger-400">
                {saveError}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

interface StageEditorProps {
  stage: FlowStage;
  allStages: FlowStage[];
  onChange: (patch: Partial<FlowStage>) => void;
  onRemove: () => void;
  onToggleTransition: (targetKey: string) => void;
  onMakeInitial: () => void;
}

function StageEditor({
  stage,
  allStages,
  onChange,
  onRemove,
  onToggleTransition,
  onMakeInitial,
}: StageEditorProps) {
  const otherStages = allStages.filter((s) => s.key !== stage.key);
  const transitionSet = new Set(stage.transitions.map((t) => t.to));

  return (
    <div className="rounded-lg border border-wl-border-default p-4 space-y-3 bg-wl-bg-elevated/40">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Input
            value={stage.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Stage label"
            className="flex-1"
          />
          <Input
            value={stage.key}
            onChange={(e) =>
              onChange({
                key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
              })
            }
            placeholder="stage_key"
            className="flex-1 font-mono text-xs"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {stage.isInitial && (
            <Badge variant="default" className="gap-1">
              <Flag className="w-3 h-3" /> initial
            </Badge>
          )}
          {stage.isTerminal && <Badge variant="default">terminal</Badge>}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            aria-label="Remove stage"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-wl-text-tertiary">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="flow-initial-stage"
            checked={Boolean(stage.isInitial)}
            onChange={onMakeInitial}
          />
          Initial
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={Boolean(stage.isTerminal)}
            onChange={(e) =>
              onChange({
                isTerminal: e.target.checked,
                transitions: e.target.checked ? [] : stage.transitions,
              })
            }
          />
          Terminal
        </label>
      </div>

      {!stage.isTerminal && otherStages.length > 0 && (
        <div>
          <div className="text-xs text-wl-text-tertiary mb-1.5">Allowed next:</div>
          <div className="flex flex-wrap gap-1.5">
            {otherStages.map((target) => (
              <button
                key={target.key}
                onClick={() => onToggleTransition(target.key)}
                className={
                  transitionSet.has(target.key)
                    ? 'px-2 py-1 rounded-md text-xs bg-wl-accent-500/20 text-wl-accent-400 border border-wl-accent-500/40'
                    : 'px-2 py-1 rounded-md text-xs bg-wl-bg-surface text-wl-text-tertiary border border-wl-border-default hover:border-wl-border-strong'
                }
              >
                → {target.label || target.key}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GraphPreview({ stages }: { stages: FlowStage[] }) {
  if (stages.length === 0) {
    return (
      <p className="text-sm text-wl-text-tertiary text-center py-8">
        Stages will appear here as you add them.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {stages.map((stage) => (
        <div key={stage.key} className="text-sm">
          <div className="flex items-center gap-2">
            {stage.isInitial && <Flag className="w-3 h-3 text-wl-accent-500" />}
            <span className="font-medium">{stage.label || stage.key}</span>
            {stage.isTerminal && (
              <Badge variant="default" className="text-xs">
                end
              </Badge>
            )}
          </div>
          {stage.transitions.length > 0 && (
            <div className="pl-5 text-xs text-wl-text-tertiary">
              → {stage.transitions.map((t) => t.to).join(', ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function validateFlow(flow: Omit<ActivityFlow, 'id' | 'version'>): string[] {
  const errors: string[] = [];
  if (!flow.name.trim()) errors.push('Name is required');
  if (!flow.key.trim()) errors.push('Key is required');
  if (!/^[a-z0-9_-]+$/.test(flow.key)) {
    errors.push('Key may only contain lowercase letters, digits, dashes, and underscores');
  }
  const stageKeys = new Set<string>();
  let initialCount = 0;
  for (const stage of flow.graph.stages) {
    if (!stage.key) errors.push('Every stage needs a key');
    if (stageKeys.has(stage.key)) errors.push(`Duplicate stage key: ${stage.key}`);
    stageKeys.add(stage.key);
    if (stage.isInitial) initialCount++;
    if (stage.isTerminal && stage.transitions.length > 0) {
      errors.push(`Terminal stage "${stage.key}" cannot have transitions`);
    }
  }
  if (flow.graph.stages.length > 0 && initialCount !== 1) {
    errors.push(`Flow must have exactly one initial stage (found ${initialCount})`);
  }
  for (const stage of flow.graph.stages) {
    for (const t of stage.transitions) {
      if (!stageKeys.has(t.to)) {
        errors.push(`Stage "${stage.key}" transitions to unknown stage "${t.to}"`);
      }
    }
  }
  return errors;
}
