"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useApiList, useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { LayoutGrid, Plus, Trash2, Globe, Lock } from "lucide-react";

interface DashboardItem {
  id: string;
  name: string;
  description: string;
  widgets: Array<{ id: string; name: string; type: string; size: string }>;
  layout: number;
  createdAt: string;
  updatedAt: string;
  owner: string;
  isPublic: boolean;
}

function CreateDashboardModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [layout, setLayout] = useState(2);
  const { execute, loading, error } = useApiMutation<DashboardItem>(
    "POST",
    "/api/v4/analytics/dashboards",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await execute({
      name: name.trim(),
      description: description.trim(),
      isPublic,
      layout,
    });
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6 bg-wl-bg-elevated border-wl-border-default">
        <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
          New Dashboard
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-wl-text-secondary mb-1">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Operations Overview"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-wl-text-secondary mb-1">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-wl-text-secondary">
              Columns:
            </label>
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setLayout(n)}
                className={cn(
                  "w-8 h-8 rounded text-sm font-medium transition-colors",
                  layout === n
                    ? "bg-wl-primary-500 text-white"
                    : "bg-wl-bg-surface text-wl-text-secondary hover:bg-wl-bg-overlay",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-wl-text-secondary">
              Make public (visible to all team members)
            </span>
          </label>
          {error && <p className="text-sm text-red-400">{error.message}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !name.trim()}
            >
              {loading ? "Creating…" : "Create Dashboard"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function DashboardsPage() {
  const {
    items: dashboards,
    loading,
    error,
    refetch,
  } = useApiList<DashboardItem>("/api/v4/analytics/dashboards");
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await api.delete(`/api/v4/analytics/dashboards/${id}`);
      refetch();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <LoadingSkeleton />;
  if (error)
    return (
      <ErrorState
        message={error?.message ?? "Failed to load dashboards"}
        onRetry={refetch}
      />
    );

  return (
    <>
      {showCreate && (
        <CreateDashboardModal
          onClose={() => setShowCreate(false)}
          onCreated={refetch}
        />
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-sm p-6 bg-wl-bg-elevated border-wl-border-default">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-2">
              Delete dashboard?
            </h2>
            <p className="text-sm text-wl-text-secondary mb-6">
              This action cannot be undone. All widgets in this dashboard will
              also be removed.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={deletingId === confirmDeleteId}
                onClick={() => handleDelete(confirmDeleteId)}
              >
                {deletingId === confirmDeleteId ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="flex flex-col min-h-screen bg-wl-bg-root">
        <div className="sticky top-0 z-10 bg-wl-bg-root/95 backdrop-blur border-b border-wl-border-default">
          <div className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-wl-text-primary">
                  Dashboards
                </h1>
                <p className="text-sm text-wl-text-secondary mt-1">
                  Custom analytics dashboards
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="w-4 h-4" />
                New Dashboard
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6 max-w-7xl">
            {dashboards.length === 0 ? (
              <Card className="p-12 bg-wl-bg-surface border-wl-border-default text-center">
                <LayoutGrid className="w-12 h-12 text-wl-text-tertiary mx-auto mb-4" />
                <p className="text-wl-text-primary font-medium mb-1">
                  No dashboards yet
                </p>
                <p className="text-sm text-wl-text-secondary mb-4">
                  Create a custom dashboard to visualise your key metrics.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus className="w-4 h-4" />
                  Create first dashboard
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboards.map((dashboard) => (
                  <Card
                    key={dashboard.id}
                    className="p-6 bg-wl-bg-surface border-wl-border-default hover:border-wl-border-strong cursor-pointer transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-semibold text-wl-text-primary flex-1 line-clamp-1">
                        {dashboard.name}
                      </h3>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {dashboard.isPublic ? (
                          <Badge variant="info" className="text-xs gap-1">
                            <Globe className="w-3 h-3" /> Public
                          </Badge>
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-wl-text-tertiary" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(dashboard.id);
                          }}
                          disabled={deletingId === dashboard.id}
                          className="p-1 rounded hover:bg-red-500/15 hover:text-red-400 text-wl-text-tertiary transition-colors"
                          aria-label={`Delete ${dashboard.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {dashboard.description && (
                      <p className="text-sm text-wl-text-secondary mb-4 line-clamp-2">
                        {dashboard.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-wl-text-tertiary mt-auto pt-3 border-t border-wl-border-subtle">
                      <span>{dashboard.widgets?.length ?? 0} widgets</span>
                      <span>
                        {dashboard.layout} col
                        {dashboard.layout !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
