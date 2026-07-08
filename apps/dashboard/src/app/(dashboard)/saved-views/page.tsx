'use client';

import { useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Edit2, Trash2, Eye, MoreVertical, RefreshCw } from 'lucide-react';
import { useApiList } from '@/hooks/use-api';
import { ErrorState } from '@/components/ui/error-state';
import { api } from '@/lib/api';

interface FilterCondition {
  column: string;
  operator: string;
  value: string;
}

interface SavedView {
  id: string;
  name: string;
  tableName?: string;
  targetTable?: string;
  filters?: FilterCondition[];
  visibleColumns?: string[];
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  isDefault?: boolean;
  isShared?: boolean;
  createdAt: string;
}

const TABLE_OPTIONS = ['Orders', 'Shipments', 'Drivers', 'Routes', 'Customers', 'Inventory'];

const COLUMN_OPTIONS: Record<string, string[]> = {
  Orders: ['id', 'customer', 'total', 'status', 'items', 'createdAt', 'shippingAddress'],
  Shipments: ['id', 'origin', 'destination', 'weight', 'status', 'driverId', 'createdAt', 'estimatedDelivery'],
  Drivers: ['name', 'zone', 'status', 'rating', 'completedDeliveries', 'phone', 'email'],
  Routes: ['id', 'stops', 'totalDistance', 'status', 'assignedAt', 'completedAt', 'distance'],
  Customers: ['name', 'email', 'phone', 'ordersCount', 'totalSpent', 'lastOrder', 'segment'],
  Inventory: ['sku', 'name', 'quantity', 'status', 'warehouse', 'lastUpdated', 'reorderPoint'],
};

export default function SavedViewsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    targetTable: TABLE_OPTIONS[0],
    filters: [{ column: '', operator: 'equals', value: '' }],
    visibleColumns: COLUMN_OPTIONS[TABLE_OPTIONS[0]],
    sortColumn: '',
    sortDirection: 'asc' as 'asc' | 'desc',
    shareWithTeam: false,
  });

  const { items: views, loading, error, refetch } = useApiList<SavedView>('/api/v4/views');

  const availableColumns = COLUMN_OPTIONS[formData.targetTable] ?? [];
  const sharedCount = views.filter((v) => v.isShared).length;

  const addFilter = () => {
    setFormData({ ...formData, filters: [...formData.filters, { column: '', operator: 'equals', value: '' }] });
  };

  const removeFilter = (idx: number) => {
    setFormData({ ...formData, filters: formData.filters.filter((_, i) => i !== idx) });
  };

  const updateFilter = (idx: number, key: string, value: string) => {
    const newFilters = [...formData.filters];
    newFilters[idx] = { ...newFilters[idx], [key]: value };
    setFormData({ ...formData, filters: newFilters });
  };

  const toggleColumn = (col: string) => {
    setFormData({
      ...formData,
      visibleColumns: formData.visibleColumns.includes(col)
        ? formData.visibleColumns.filter((c) => c !== col)
        : [...formData.visibleColumns, col],
    });
  };

  const handleTableChange = (newTable: string) => {
    setFormData({ ...formData, targetTable: newTable, visibleColumns: COLUMN_OPTIONS[newTable] ?? [] });
  };

  const handleCreateView = useCallback(async () => {
    if (!formData.name.trim() || formData.visibleColumns.length === 0) return;
    setCreating(true);
    try {
      await api.post('/api/v4/views', {
        name: formData.name,
        tableName: formData.targetTable,
        filters: formData.filters.filter((f) => f.column),
        sortConfig: formData.sortColumn ? { column: formData.sortColumn, direction: formData.sortDirection } : undefined,
        columnVisibility: formData.visibleColumns,
        isShared: formData.shareWithTeam,
      });
      refetch();
      setShowCreateModal(false);
      setFormData({
        name: '',
        targetTable: TABLE_OPTIONS[0],
        filters: [{ column: '', operator: 'equals', value: '' }],
        visibleColumns: COLUMN_OPTIONS[TABLE_OPTIONS[0]],
        sortColumn: '',
        sortDirection: 'asc',
        shareWithTeam: false,
      });
    } finally {
      setCreating(false);
    }
  }, [formData, refetch]);

  const handleDelete = useCallback(async (id: string) => {
    await api.delete(`/api/v4/views/${id}`);
    refetch();
  }, [refetch]);

  const handleDuplicate = useCallback(async (id: string) => {
    await api.post(`/api/v4/views/${id}/duplicate`);
    refetch();
  }, [refetch]);

  const handleSetDefault = useCallback(async (id: string) => {
    await api.patch(`/api/v4/views/${id}/default`, {});
    refetch();
  }, [refetch]);

  if (error && !loading) {
    return (
      <div className="w-full bg-wl-bg-root min-h-screen p-6">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="w-full bg-wl-bg-root min-h-screen">
      <Header
        title="Saved Views"
        subtitle={`${views.length} total views · ${sharedCount} shared with team`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={refetch} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="primary" size="md" onClick={() => setShowCreateModal(true)}>
              + Create View
            </Button>
          </div>
        }
      />

      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="bg-wl-bg-surface border-wl-border-default animate-pulse h-48">{" "}</Card>
            ))}
          </div>
        ) : error ? (
          <Card className="bg-wl-bg-surface border-wl-border-default p-8 text-center">
            <p className="text-red-400 mb-4">Failed to load views.</p>
            <Button variant="secondary" size="sm" onClick={refetch}>Retry</Button>
          </Card>
        ) : (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">My Views</h2>
            {views.length === 0 ? (
              <Card className="bg-wl-bg-surface border-wl-border-default p-8 text-center">
                <p className="text-wl-text-secondary">No saved views yet. Create your first view.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {views.map((view) => (
                  <Card key={view.id} className="bg-wl-bg-surface border-wl-border-default flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base mb-2 text-white">{view.name}</CardTitle>
                          <p className="text-sm text-wl-text-secondary">{view.tableName ?? view.targetTable}</p>
                        </div>
                        <button className="bg-transparent border-0 cursor-pointer p-0 text-wl-text-tertiary hover:text-wl-text-secondary transition-colors">
                          <MoreVertical size={18} />
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 pt-0 pb-4">
                      <div className="flex gap-2 mb-4 flex-wrap">
                        {view.isDefault && <Badge variant="primary">Default</Badge>}
                        {view.isShared && <Badge variant="info">Shared</Badge>}
                      </div>
                      <div className="mb-4">
                        <div className="flex justify-between mb-2">
                          <span className="text-xs text-wl-text-secondary">Filters</span>
                          <span className="text-sm font-semibold text-white">{view.filters?.length ?? 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-wl-text-secondary">Visible Columns</span>
                          <span className="text-sm font-semibold text-white">{view.visibleColumns?.length ?? 0}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button variant="primary" size="sm" className="flex-1 min-w-20">
                          <Eye size={14} className="mr-1" />
                          Apply
                        </Button>
                        <Button variant="secondary" size="sm" className="flex-1 min-w-16">
                          <Edit2 size={14} />
                        </Button>
                        <Button variant="secondary" size="sm" className="flex-1 min-w-16" onClick={() => handleDuplicate(view.id)}>
                          <Copy size={14} />
                        </Button>
                        <Button variant="danger" size="sm" className="flex-1 min-w-16" onClick={() => handleDelete(view.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      {!view.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-3 text-xs text-wl-text-secondary hover:text-white"
                          onClick={() => handleSetDefault(view.id)}
                        >
                          Set as Default
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create View Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <Card
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl bg-wl-bg-surface border-wl-border-default"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle className="text-white">Create New Saved View</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">View Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Today's Priority Orders"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Target Table</label>
                  <select
                    value={formData.targetTable}
                    onChange={(e) => handleTableChange(e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
                  >
                    {TABLE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Filters</label>
                  <div className="flex flex-col gap-3">
                    {formData.filters.map((filter, idx) => (
                      <div key={idx} className="flex gap-2 items-end">
                        <select
                          value={filter.column}
                          onChange={(e) => updateFilter(idx, 'column', e.target.value)}
                          className="flex-1 px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
                        >
                          <option value="">Select Column</option>
                          {availableColumns.map((col) => <option key={col} value={col}>{col}</option>)}
                        </select>
                        <select
                          value={filter.operator}
                          onChange={(e) => updateFilter(idx, 'operator', e.target.value)}
                          className="px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
                        >
                          <option value="equals">equals</option>
                          <option value="not_equals">not equals</option>
                          <option value="contains">contains</option>
                          <option value="greater_than">greater than</option>
                          <option value="less_than">less than</option>
                          <option value="is_empty">is empty</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Value"
                          value={filter.value}
                          onChange={(e) => updateFilter(idx, 'value', e.target.value)}
                          className="flex-1 px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        {formData.filters.length > 1 && (
                          <Button variant="danger" size="sm" onClick={() => removeFilter(idx)}>Remove</Button>
                        )}
                      </div>
                    ))}
                    <Button variant="secondary" size="sm" onClick={addFilter} className="self-start">
                      + Add Filter
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Visible Columns</label>
                  <div className="grid grid-cols-2 gap-3">
                    {availableColumns.map((col) => (
                      <label key={col} className="flex items-center gap-2 cursor-pointer text-sm text-wl-text-secondary hover:text-white transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.visibleColumns.includes(col)}
                          onChange={() => toggleColumn(col)}
                          className="cursor-pointer"
                        />
                        {col}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Sort Column</label>
                    <select
                      value={formData.sortColumn}
                      onChange={(e) => setFormData({ ...formData, sortColumn: e.target.value })}
                      className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
                    >
                      <option value="">None</option>
                      {availableColumns.map((col) => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Direction</label>
                    <select
                      value={formData.sortDirection}
                      onChange={(e) => setFormData({ ...formData, sortDirection: e.target.value as 'asc' | 'desc' })}
                      className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-sm text-wl-text-secondary hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.shareWithTeam}
                    onChange={(e) => setFormData({ ...formData, shareWithTeam: e.target.checked })}
                    className="cursor-pointer"
                  />
                  Share with team
                </label>

                <div className="flex gap-3 justify-end pt-4 border-t border-wl-border-default">
                  <Button variant="secondary" size="md" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                  <Button variant="primary" size="md" onClick={handleCreateView} disabled={creating}>
                    {creating ? 'Creating...' : 'Create View'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
