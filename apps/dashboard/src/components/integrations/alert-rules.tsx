"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Alert Rules component
 * Integration alert/notification rules builder with condition and action configuration
 * Features: condition builder, action configuration, priority levels, alert history
 */

export type AlertAction = 'email' | 'slack' | 'webhook' | 'in-app';

export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: AlertPriority;
  condition: {
    metric: string;
    operator: '>' | '<' | '==' | '!=';
    value: number;
    duration: number; // minutes
  };
  actions: AlertAction[];
  recentAlerts: Array<{
    id: string;
    timestamp: Date;
    triggered: boolean;
    message: string;
  }>;
}

export interface AlertRulesProps {
  rules: AlertRule[];
  onSave?: (rule: AlertRule) => void;
  onDelete?: (ruleId: string) => void;
  onToggle?: (ruleId: string, enabled: boolean) => void;
  className?: string;
}

export function AlertRules({ rules, onSave, onDelete, onToggle, className }: AlertRulesProps) {
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(rules[0]?.id || null);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [confirmDeleteRule, setConfirmDeleteRule] = useState(false);

  const selectedRule = rules.find((r) => r.id === selectedRuleId);
  const current = editingRule || selectedRule;

  const handleEdit = (rule: AlertRule) => {
    setEditingRule({ ...rule });
  };

  const handleSave = () => {
    if (editingRule) {
      onSave?.(editingRule);
      setEditingRule(null);
    }
  };

  const handleCancel = () => {
    setEditingRule(null);
  };

  const getPriorityColor = (priority: AlertPriority): string => {
    switch (priority) {
      case 'low':
        return 'var(--wl-info-500)';
      case 'medium':
        return 'var(--wl-warning-500)';
      case 'high':
        return 'var(--wl-danger-500)';
      case 'critical':
        return 'var(--wl-danger-500)';
    }
  };

  const getPriorityBadgeClass = (priority: AlertPriority): string => {
    switch (priority) {
      case 'low':
        return 'bg-wl-info-100 dark:bg-wl-info-900/30 text-wl-info-700 dark:text-wl-info-300';
      case 'medium':
        return 'bg-wl-warning-100 dark:bg-wl-warning-900/30 text-wl-warning-700 dark:text-wl-warning-300';
      case 'high':
        return 'bg-wl-danger-100 dark:bg-wl-danger-900/30 text-wl-danger-700 dark:text-wl-danger-300';
      case 'critical':
        return 'bg-wl-danger-bg text-wl-danger-600';
    }
  };

  return (
    <div
      className={cn(
        'border border-wl-border-subtle rounded-lg bg-wl-bg-surface overflow-hidden grid grid-cols-3 gap-0',
        className
      )}
      style={{ height: '700px' }}
    >
      {/* Rules List */}
      <div className="border-r border-wl-border-subtle flex flex-col overflow-hidden">
        <div className="bg-wl-surface-hover border-b border-wl-border-subtle p-4">
          <h3 className="font-semibold text-wl-text-primary text-sm">Alert Rules</h3>
          <p className="text-xs text-wl-text-secondary mt-1">{rules.filter((r) => r.enabled).length} active</p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-wl-border-subtle">
          {rules.length === 0 ? (
            <div className="p-4 text-center text-wl-text-tertiary">
              <div className="text-xs">No rules configured</div>
            </div>
          ) : (
            rules.map((rule) => (
              <button
                key={rule.id}
                onClick={() => {
                  setSelectedRuleId(rule.id);
                  setEditingRule(null);
                }}
                className={cn(
                  'w-full text-left p-3 hover:bg-wl-surface-hover transition-colors',
                  selectedRuleId === rule.id && 'bg-wl-primary-500/10 border-l-2 border-wl-primary-500'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-sm font-medium text-wl-text-primary flex-1 truncate">{rule.name}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle?.(rule.id, !rule.enabled);
                    }}
                    className="flex-shrink-0"
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded border-2 transition-colors flex items-center justify-center',
                        rule.enabled
                          ? 'bg-wl-primary-500 border-wl-primary-500'
                          : 'border-wl-border-subtle hover:border-wl-border-default'
                      )}
                    >
                      {rule.enabled && <span className="text-wl-text-primary text-xs">✓</span>}
                    </div>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', getPriorityBadgeClass(rule.priority))}>
                    {rule.priority}
                  </span>
                  <span className="text-xs text-wl-text-tertiary">{rule.actions.length} actions</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Rule Editor/Viewer */}
      {current ? (
        <div className="col-span-2 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="border-b border-wl-border-subtle bg-wl-surface-hover p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-wl-text-primary">{current.name}</h3>
                <p className="text-xs text-wl-text-secondary mt-1">
                  {current.enabled ? 'Active' : 'Inactive'}
                </p>
              </div>
              <button
                onClick={() => {
                  if (!editingRule) {
                    handleEdit(current);
                  } else {
                    handleSave();
                  }
                }}
                className={cn(
                  'px-3 py-2 rounded text-sm font-medium transition-colors',
                  editingRule
                    ? 'bg-wl-primary-500 text-white hover:bg-wl-primary-600'
                    : 'bg-wl-primary-100 text-wl-primary-700 hover:bg-wl-primary-200 dark:bg-wl-primary-900/30 dark:text-wl-primary-300 dark:hover:bg-wl-primary-900/50'
                )}
              >
                {editingRule ? 'Save' : 'Edit'}
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Condition Section */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-wl-text-primary mb-3">Condition</h4>
              <div className="p-4 rounded-lg bg-wl-surface-hover border border-wl-border-subtle">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-wl-text-secondary mb-2">Metric</label>
                    <input
                      type="text"
                      value={editingRule?.condition.metric || current.condition.metric}
                      onChange={(e) => {
                        if (!editingRule) setEditingRule({ ...current });
                        setEditingRule((prev) =>
                          prev ? { ...prev, condition: { ...prev.condition, metric: e.target.value } } : null
                        );
                      }}
                      disabled={!editingRule}
                      className={cn(
                        'w-full px-3 py-2 rounded border border-wl-border-subtle',
                        'bg-wl-bg-surface text-wl-text-primary text-sm',
                        'focus:outline-none focus:border-wl-primary-500'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-wl-text-secondary mb-2">Operator</label>
                    <select
                      value={editingRule?.condition.operator || current.condition.operator}
                      onChange={(e) => {
                        if (!editingRule) setEditingRule({ ...current });
                        setEditingRule((prev) =>
                          prev
                            ? {
                                ...prev,
                                condition: { ...prev.condition, operator: e.target.value as '>' | '<' | '==' | '!=' },
                              }
                            : null
                        );
                      }}
                      disabled={!editingRule}
                      className={cn(
                        'w-full px-3 py-2 rounded border border-wl-border-subtle',
                        'bg-wl-bg-surface text-wl-text-primary text-sm',
                        'focus:outline-none focus:border-wl-primary-500'
                      )}
                    >
                      <option value=">">&gt;</option>
                      <option value="<">&lt;</option>
                      <option value="==">==</option>
                      <option value="!=">!=</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-wl-text-secondary mb-2">Value</label>
                    <input
                      type="number"
                      value={editingRule?.condition.value || current.condition.value}
                      onChange={(e) => {
                        if (!editingRule) setEditingRule({ ...current });
                        setEditingRule((prev) =>
                          prev ? { ...prev, condition: { ...prev.condition, value: parseFloat(e.target.value) } } : null
                        );
                      }}
                      disabled={!editingRule}
                      className={cn(
                        'w-full px-3 py-2 rounded border border-wl-border-subtle',
                        'bg-wl-bg-surface text-wl-text-primary text-sm',
                        'focus:outline-none focus:border-wl-primary-500'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-wl-text-secondary mb-2">Duration (minutes)</label>
                    <input
                      type="number"
                      value={editingRule?.condition.duration || current.condition.duration}
                      onChange={(e) => {
                        if (!editingRule) setEditingRule({ ...current });
                        setEditingRule((prev) =>
                          prev ? { ...prev, condition: { ...prev.condition, duration: parseInt(e.target.value) } } : null
                        );
                      }}
                      disabled={!editingRule}
                      className={cn(
                        'w-full px-3 py-2 rounded border border-wl-border-subtle',
                        'bg-wl-bg-surface text-wl-text-primary text-sm',
                        'focus:outline-none focus:border-wl-primary-500'
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Priority Section */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-wl-text-primary mb-3">Priority</h4>
              <div className="grid grid-cols-4 gap-2">
                {(['low', 'medium', 'high', 'critical'] as const).map((priority) => (
                  <button
                    key={priority}
                    onClick={() => {
                      if (!editingRule) setEditingRule({ ...current });
                      setEditingRule((prev) => (prev ? { ...prev, priority } : null));
                    }}
                    disabled={!editingRule}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      (editingRule?.priority || current.priority) === priority
                        ? `text-wl-text-primary`
                        : 'bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle',
                      (editingRule?.priority || current.priority) === priority && 'ring-2 ring-wl-primary-500/20'
                    )}
                    style={{
                      backgroundColor:
                        (editingRule?.priority || current.priority) === priority
                          ? getPriorityColor(priority)
                          : undefined,
                    }}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions Section */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-wl-text-primary mb-3">Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                {(['email', 'slack', 'webhook', 'in-app'] as const).map((action) => (
                  <button
                    key={action}
                    onClick={() => {
                      if (!editingRule) setEditingRule({ ...current });
                      setEditingRule((prev) => {
                        if (!prev) return null;
                        const actions = prev.actions.includes(action)
                          ? prev.actions.filter((a) => a !== action)
                          : [...prev.actions, action];
                        return { ...prev, actions };
                      });
                    }}
                    disabled={!editingRule}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      (editingRule?.actions || current.actions).includes(action)
                        ? 'bg-wl-primary-100 text-wl-primary-700 dark:bg-wl-primary-900/30 dark:text-wl-primary-300'
                        : 'bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle'
                    )}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Alerts */}
            <div>
              <h4 className="text-sm font-semibold text-wl-text-primary mb-3">Recent Alerts</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {current.recentAlerts.length === 0 ? (
                  <div className="text-xs text-wl-text-tertiary p-3 text-center">No recent alerts</div>
                ) : (
                  current.recentAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      onClick={() => setExpandedAlertId(expandedAlertId === alert.id ? null : alert.id)}
                      className={cn(
                        'w-full text-left p-2 rounded border transition-colors',
                        alert.triggered
                          ? 'bg-wl-danger-500/10 border-wl-danger-500/20 hover:bg-wl-danger-500/15'
                          : 'bg-wl-success-500/10 border-wl-success-500/20 hover:bg-wl-success-500/15'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-wl-text-primary">{alert.message}</span>
                        <span className="text-xs text-wl-text-secondary">{alert.timestamp.toLocaleTimeString()}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          {editingRule && (
            <div className="border-t border-wl-border-subtle bg-wl-surface-hover p-4 flex gap-3">
              <button
                onClick={handleSave}
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                  'bg-wl-primary-500 text-white hover:bg-wl-primary-600'
                )}
              >
                Save Rule
              </button>
              <button
                onClick={handleCancel}
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                  'bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle'
                )}
              >
                Cancel
              </button>
              {confirmDeleteRule ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDeleteRule(false)}
                    className={cn(
                      'px-3 py-2 rounded-lg font-medium text-sm transition-colors',
                      'bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle'
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { setConfirmDeleteRule(false); onDelete?.(current.id); setEditingRule(null); }}
                    className={cn(
                      'px-3 py-2 rounded-lg font-medium text-sm transition-colors',
                      'bg-wl-danger-100 text-wl-danger-700 hover:bg-wl-danger-200',
                      'dark:bg-wl-danger-900/30 dark:text-wl-danger-300 dark:hover:bg-wl-danger-900/50'
                    )}
                  >
                    Confirm Delete
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteRule(true)}
                  className={cn(
                    'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                    'bg-wl-danger-100 text-wl-danger-700 hover:bg-wl-danger-200',
                    'dark:bg-wl-danger-900/30 dark:text-wl-danger-300 dark:hover:bg-wl-danger-900/50'
                  )}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="col-span-2 flex items-center justify-center">
          <div className="text-center text-wl-text-tertiary">
            <div className="text-sm">No rule selected</div>
            <div className="text-xs mt-1">Select a rule from the list</div>
          </div>
        </div>
      )}
    </div>
  );
}
