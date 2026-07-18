"use client";

import { useState } from "react";
import { useApiList } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Calendar, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface CalendarRule {
  id: string;
  name: string;
  type: "OPERATING_DAYS" | "BLACKOUT" | "SPECIAL_HOURS" | "CAPACITY_OVERRIDE";
  startDate?: string;
  effectiveFrom?: string;
  endDate?: string;
  effectiveTo?: string;
  maxCapacityPerDay?: number;
  isActive: boolean;
  recurrencePattern?: string;
  daysOfWeek?: number[];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const { addToast } = useToast();
  const [filterType, setFilterType] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "BLACKOUT" as CalendarRule["type"],
    effectiveFrom: "",
    effectiveTo: "",
    daysOfWeek: [1, 2, 3, 4, 5],
    maxCapacityPerDay: "",
    priority: "0",
  });

  const { items: rules, loading, error, refetch } = useApiList<CalendarRule>("/api/v4/calendar-rules");

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const filtered = filterType === "all" ? rules : rules.filter((r) => r.type === filterType);

  const getRuleTypeVariant = (type: string): "danger" | "warning" | "info" | "primary" | "default" => {
    switch (type) {
      case "BLACKOUT": return "danger";
      case "SPECIAL_HOURS": return "warning";
      case "CAPACITY_OVERRIDE": return "info";
      case "OPERATING_DAYS": return "primary";
      default: return "default";
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/api/v4/calendar-rules/${id}`);
      addToast({ type: "success", title: "Rule removed", message: "Calendar rule deactivated" });
      refetch();
    } catch (err) {
      addToast({ type: "error", title: "Delete failed", message: err instanceof Error ? err.message : undefined });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day].sort(),
    }));
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/v4/calendar-rules", {
        name: formData.name.trim(),
        type: formData.type,
        effectiveFrom: formData.effectiveFrom || undefined,
        effectiveTo: formData.effectiveTo || undefined,
        daysOfWeek: formData.daysOfWeek,
        maxCapacityPerDay: formData.maxCapacityPerDay ? parseInt(formData.maxCapacityPerDay, 10) : undefined,
        priority: parseInt(formData.priority, 10) || 0,
      });
      addToast({ type: "success", title: "Rule created" });
      setShowCreateModal(false);
      setFormData({ name: "", type: "BLACKOUT", effectiveFrom: "", effectiveTo: "", daysOfWeek: [1,2,3,4,5], maxCapacityPerDay: "", priority: "0" });
      refetch();
    } catch (err) {
      addToast({ type: "error", title: "Failed to create rule", message: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-root">
      <div className="sticky top-0 z-10 bg-wl-bg-root/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Calendar Rules</h1>
              <p className="text-sm text-wl-text-secondary mt-1">Manage delivery calendar</p>
            </div>
            <Button variant="primary" size="md" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Rule
            </Button>
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={cn(
              "px-3 py-2 rounded-md text-sm font-medium",
              "bg-wl-bg-surface border border-wl-border-default",
              "text-white",
              "focus:outline-none focus:ring-2 focus:ring-wl-info-500"
            )}
          >
            <option value="all">All Types</option>
            <option value="BLACKOUT">Blackout</option>
            <option value="SPECIAL_HOURS">Special Hours</option>
            <option value="CAPACITY_OVERRIDE">Capacity Override</option>
            <option value="OPERATING_DAYS">Operating Days</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4 max-w-5xl">
          {filtered.length === 0 ? (
            <Card className="p-12 bg-wl-bg-surface border-wl-border-default text-center">
              <Calendar className="w-12 h-12 text-wl-text-tertiary mx-auto mb-4" />
              <p className="text-wl-text-secondary mb-4">No calendar rules found</p>
              <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Rule
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((rule) => {
                const start = rule.effectiveFrom ?? rule.startDate;
                const end = rule.effectiveTo ?? rule.endDate;
                return (
                  <Card key={rule.id} className="p-6 bg-wl-bg-surface border-wl-border-default hover:border-wl-border-strong transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-white">{rule.name}</h3>
                          <Badge variant={getRuleTypeVariant(rule.type)}>{rule.type.replace("_", " ")}</Badge>
                          {!rule.isActive && <Badge variant="default">Inactive</Badge>}
                        </div>
                        {(start || end) && (
                          <p className="text-sm text-wl-text-secondary mb-2">
                            {start ? new Date(start).toLocaleDateString() : "—"} → {end ? new Date(end).toLocaleDateString() : "—"}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-wl-text-tertiary flex-wrap">
                          {rule.daysOfWeek && rule.daysOfWeek.length > 0 && (
                            <span>Days: {rule.daysOfWeek.map((d) => DAY_NAMES[d]).join(", ")}</span>
                          )}
                          {rule.maxCapacityPerDay && <span>Capacity: {rule.maxCapacityPerDay}/day</span>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-wl-danger-500 hover:text-wl-danger-500 shrink-0"
                        onClick={() => handleDelete(rule.id)}
                        disabled={deletingId === rule.id}
                        title="Remove rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-wl-bg-surface border border-wl-border-default rounded-xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-wl-border-default">
              <h2 className="text-lg font-bold text-white">New Calendar Rule</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-wl-text-tertiary hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2">
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Christmas Blackout"
                  className={cn(
                    "w-full px-3 py-2 rounded-md bg-wl-bg-root border border-wl-border-default",
                    "text-white placeholder:text-wl-text-tertiary text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-wl-info-500"
                  )}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value as CalendarRule["type"] }))}
                  className={cn(
                    "w-full px-3 py-2 rounded-md bg-wl-bg-root border border-wl-border-default",
                    "text-white text-sm focus:outline-none focus:ring-2 focus:ring-wl-info-500"
                  )}
                >
                  <option value="BLACKOUT">Blackout</option>
                  <option value="SPECIAL_HOURS">Special Hours</option>
                  <option value="CAPACITY_OVERRIDE">Capacity Override</option>
                  <option value="OPERATING_DAYS">Operating Days</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2">
                    Effective From
                  </label>
                  <input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData((p) => ({ ...p, effectiveFrom: e.target.value }))}
                    className={cn(
                      "w-full px-3 py-2 rounded-md bg-wl-bg-root border border-wl-border-default",
                      "text-white text-sm focus:outline-none focus:ring-2 focus:ring-wl-info-500"
                    )}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2">
                    Effective To
                  </label>
                  <input
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData((p) => ({ ...p, effectiveTo: e.target.value }))}
                    className={cn(
                      "w-full px-3 py-2 rounded-md bg-wl-bg-root border border-wl-border-default",
                      "text-white text-sm focus:outline-none focus:ring-2 focus:ring-wl-info-500"
                    )}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2">
                  Active Days
                </label>
                <div className="flex gap-2 flex-wrap">
                  {DAY_NAMES.map((name, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={cn(
                        "w-11 h-9 rounded text-xs font-semibold transition-colors",
                        formData.daysOfWeek.includes(i)
                          ? "bg-blue-600 text-white"
                          : "bg-wl-bg-root border border-wl-border-default text-wl-text-tertiary hover:border-blue-500"
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {formData.type === "CAPACITY_OVERRIDE" && (
                <div>
                  <label className="block text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2">
                    Max Capacity / Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxCapacityPerDay}
                    onChange={(e) => setFormData((p) => ({ ...p, maxCapacityPerDay: e.target.value }))}
                    placeholder="e.g. 50"
                    className={cn(
                      "w-full px-3 py-2 rounded-md bg-wl-bg-root border border-wl-border-default",
                      "text-white text-sm focus:outline-none focus:ring-2 focus:ring-wl-info-500"
                    )}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-wl-border-default">
              <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreate}
                disabled={saving || !formData.name.trim()}
              >
                {saving ? "Creating…" : "Create Rule"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
