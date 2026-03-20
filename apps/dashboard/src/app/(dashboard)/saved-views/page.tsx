"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Copy, Edit2, Trash2, Eye, MoreVertical, Plus } from "lucide-react";
import { useApiList } from '@/hooks/use-api';

/* ═══════════════════════════════════════════════════════════
   SAVED VIEWS PAGE — Reusable filter/sort/column presets
   ═══════════════════════════════════════════════════════════ */

interface FilterCondition {
  column: string;
  operator: string;
  value: string;
}

interface SavedView {
  id: string;
  name: string;
  targetTable: string;
  filters: FilterCondition[];
  visibleColumns: string[];
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  isDefault: boolean;
  isShared: boolean;
  createdAt: string;
  createdBy: string;
}

const SAVED_VIEWS: SavedView[] = [
  {
    id: "view-001",
    name: "Today's Priority Orders",
    targetTable: "Orders",
    filters: [
      { column: "createdAt", operator: "greater_than", value: "today" },
      { column: "status", operator: "equals", value: "pending" },
    ],
    visibleColumns: ["id", "customer", "total", "status", "createdAt"],
    sortColumn: "total",
    sortDirection: "desc",
    isDefault: true,
    isShared: true,
    createdAt: "2026-02-15T10:30:00Z",
    createdBy: "NK",
  },
  {
    id: "view-002",
    name: "Unassigned Shipments",
    targetTable: "Shipments",
    filters: [
      { column: "driverId", operator: "is_empty", value: "" },
      { column: "status", operator: "not_equals", value: "delivered" },
    ],
    visibleColumns: ["id", "origin", "destination", "weight", "status", "createdAt"],
    sortColumn: "createdAt",
    sortDirection: "asc",
    isDefault: false,
    isShared: true,
    createdAt: "2026-02-20T14:15:00Z",
    createdBy: "NK",
  },
  {
    id: "view-003",
    name: "Available Drivers",
    targetTable: "Drivers",
    filters: [
      { column: "status", operator: "equals", value: "available" },
      { column: "rating", operator: "greater_than", value: "4.0" },
    ],
    visibleColumns: ["name", "zone", "status", "rating", "completedDeliveries"],
    sortColumn: "rating",
    sortDirection: "desc",
    isDefault: false,
    isShared: false,
    createdAt: "2026-02-25T09:00:00Z",
    createdBy: "NK",
  },
  {
    id: "view-004",
    name: "Overdue Deliveries",
    targetTable: "Shipments",
    filters: [
      { column: "estimatedDelivery", operator: "less_than", value: "now" },
      { column: "status", operator: "not_equals", value: "delivered" },
    ],
    visibleColumns: ["id", "customer", "destination", "status", "estimatedDelivery", "daysOverdue"],
    sortColumn: "estimatedDelivery",
    sortDirection: "asc",
    isDefault: false,
    isShared: true,
    createdAt: "2026-02-28T11:45:00Z",
    createdBy: "NK",
  },
  {
    id: "view-005",
    name: "High Value Orders",
    targetTable: "Orders",
    filters: [
      { column: "total", operator: "greater_than", value: "1000" },
      { column: "status", operator: "not_equals", value: "cancelled" },
    ],
    visibleColumns: ["id", "customer", "total", "items", "status", "createdAt"],
    sortColumn: "total",
    sortDirection: "desc",
    isDefault: false,
    isShared: false,
    createdAt: "2026-03-01T13:20:00Z",
    createdBy: "NK",
  },
  {
    id: "view-006",
    name: "My Routes",
    targetTable: "Routes",
    filters: [
      { column: "assignedDriver", operator: "equals", value: "current_user" },
      { column: "status", operator: "in", value: "pending,in_progress" },
    ],
    visibleColumns: ["id", "stops", "totalDistance", "status", "assignedAt", "completedAt"],
    sortColumn: "status",
    sortDirection: "asc",
    isDefault: false,
    isShared: false,
    createdAt: "2026-03-03T08:30:00Z",
    createdBy: "NK",
  },
];

const TABLE_OPTIONS = [
  "Orders",
  "Shipments",
  "Drivers",
  "Routes",
  "Customers",
  "Inventory",
];

const COLUMN_OPTIONS: Record<string, string[]> = {
  Orders: ["id", "customer", "total", "status", "items", "createdAt", "shippingAddress"],
  Shipments: ["id", "origin", "destination", "weight", "status", "driverId", "createdAt", "estimatedDelivery"],
  Drivers: ["name", "zone", "status", "rating", "completedDeliveries", "phone", "email"],
  Routes: ["id", "stops", "totalDistance", "status", "assignedAt", "completedAt", "distance"],
  Customers: ["name", "email", "phone", "ordersCount", "totalSpent", "lastOrder", "segment"],
  Inventory: ["sku", "name", "quantity", "status", "warehouse", "lastUpdated", "reorderPoint"],
};

export default function SavedViewsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    targetTable: TABLE_OPTIONS[0],
    filters: [{ column: "", operator: "equals", value: "" }],
    visibleColumns: COLUMN_OPTIONS[TABLE_OPTIONS[0]],
    sortColumn: "",
    sortDirection: "asc" as "asc" | "desc",
    shareWithTeam: false,
  });

  const availableColumns = COLUMN_OPTIONS[formData.targetTable] || [];

  const addFilter = () => {
    setFormData({
      ...formData,
      filters: [...formData.filters, { column: "", operator: "equals", value: "" }],
    });
  };

  const removeFilter = (idx: number) => {
    setFormData({
      ...formData,
      filters: formData.filters.filter((_, i) => i !== idx),
    });
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

  const handleCreateView = () => {
    if (formData.name.trim() && formData.visibleColumns.length > 0) {
      alert(`View "${formData.name}" created! (mock)`);
      setShowCreateModal(false);
      setFormData({
        name: "",
        targetTable: TABLE_OPTIONS[0],
        filters: [{ column: "", operator: "equals", value: "" }],
        visibleColumns: COLUMN_OPTIONS[TABLE_OPTIONS[0]],
        sortColumn: "",
        sortDirection: "asc",
        shareWithTeam: false,
      });
    }
  };

  const handleTableChange = (newTable: string) => {
    setFormData({
      ...formData,
      targetTable: newTable,
      visibleColumns: COLUMN_OPTIONS[newTable],
    });
  };

  return (
    <>
      <Header
        title="Saved Views"
        subtitle={`${SAVED_VIEWS.length} total views · 4 shared with team`}
        actions={
          <Button variant="primary" size="md" onClick={() => setShowCreateModal(true)}>
            + Create View
          </Button>
        }
      />

      <div className="p-6">
        {/* My Views Grid */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
            My Views
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SAVED_VIEWS.map((view) => (
              <Card key={view.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base mb-2">
                        {view.name}
                      </CardTitle>
                      <p className="text-sm text-wl-text-secondary">
                        {view.targetTable}
                      </p>
                    </div>
                    <button
                      className="bg-transparent border-0 cursor-pointer p-0 text-wl-text-tertiary"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-0 pb-4">
                  {/* Badges */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {view.isDefault && <Badge variant="primary">Default</Badge>}
                    {view.isShared && <Badge variant="info">Shared</Badge>}
                  </div>

                  {/* Stats */}
                  <div className="mb-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-wl-text-secondary">Filters</span>
                      <span className="text-sm font-semibold text-wl-text-primary">
                        {view.filters.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-wl-text-secondary">Visible Columns</span>
                      <span className="text-sm font-semibold text-wl-text-primary">
                        {view.visibleColumns.length}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="primary" size="sm" className="flex-1 min-w-20">
                      <Eye size={14} className="mr-1" />
                      Apply
                    </Button>
                    <Button variant="secondary" size="sm" className="flex-1 min-w-16">
                      <Edit2 size={14} />
                    </Button>
                    <Button variant="secondary" size="sm" className="flex-1 min-w-16">
                      <Copy size={14} />
                    </Button>
                    <Button variant="danger" size="sm" className="flex-1 min-w-16">
                      <Trash2 size={14} />
                    </Button>
                  </div>

                  {/* Set as Default */}
                  {!view.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-3 text-xs"
                      onClick={() => alert("Set as default (mock)")}
                    >
                      Set as Default
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Create View Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <Card
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle>Create New Saved View</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6">
                {/* Name Input */}
                <div>
                  <label className="block text-sm font-semibold text-wl-text-primary mb-2">
                    View Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Today's Priority Orders"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-subtle rounded-lg text-wl-text-primary text-sm font-sans outline-none"
                  />
                </div>

                {/* Target Table Select */}
                <div>
                  <label className="block text-sm font-semibold text-wl-text-primary mb-2">
                    Target Table
                  </label>
                  <select
                    value={formData.targetTable}
                    onChange={(e) => handleTableChange(e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-subtle rounded-lg text-wl-text-primary text-sm font-sans outline-none cursor-pointer"
                  >
                    {TABLE_OPTIONS.map((table) => (
                      <option key={table} value={table}>
                        {table}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filters Section */}
                <div>
                  <label className="block text-sm font-semibold text-wl-text-primary mb-2">
                    Filters
                  </label>
                  <div className="flex flex-col gap-3">
                    {formData.filters.map((filter, idx) => (
                      <div key={idx} className="flex gap-2 items-end">
                        <select
                          value={filter.column}
                          onChange={(e) => updateFilter(idx, "column", e.target.value)}
                          className="flex-1 px-3 py-2 bg-wl-bg-elevated border border-wl-border-subtle rounded-lg text-wl-text-primary text-sm font-sans outline-none cursor-pointer"
                        >
                          <option value="">Select Column</option>
                          {availableColumns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                        <select
                          value={filter.operator}
                          onChange={(e) => updateFilter(idx, "operator", e.target.value)}
                          className="flex-0.8 px-3 py-2 bg-wl-bg-elevated border border-wl-border-subtle rounded-lg text-wl-text-primary text-sm font-sans outline-none cursor-pointer"
                        >
                          <option value="equals">equals</option>
                          <option value="not_equals">not equals</option>
                          <option value="contains">contains</option>
                          <option value="starts_with">starts with</option>
                          <option value="greater_than">greater than</option>
                          <option value="less_than">less than</option>
                          <option value="in">in</option>
                          <option value="between">between</option>
                          <option value="is_empty">is empty</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Value"
                          value={filter.value}
                          onChange={(e) => updateFilter(idx, "value", e.target.value)}
                          className="flex-0.8 px-3 py-2 bg-wl-bg-elevated border border-wl-border-subtle rounded-lg text-wl-text-primary text-sm font-sans outline-none"
                        />
                        {formData.filters.length > 1 && (
                          <Button
                            variant="danger"
                            size="sm"
                            className="p-2"
                            onClick={() => removeFilter(idx)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={addFilter}
                      className="self-start"
                    >
                      + Add Filter
                    </Button>
                  </div>
                </div>

                {/* Column Visibility */}
                <div>
                  <label className="block text-sm font-semibold text-wl-text-primary mb-2">
                    Visible Columns
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {availableColumns.map((col) => (
                      <label
                        key={col}
                        className="flex items-center gap-2 cursor-pointer text-sm text-wl-text-primary"
                      >
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

                {/* Sort Configuration */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-wl-text-primary mb-2">
                      Sort Column
                    </label>
                    <select
                      value={formData.sortColumn}
                      onChange={(e) => setFormData({ ...formData, sortColumn: e.target.value })}
                      className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-subtle rounded-lg text-wl-text-primary text-sm font-sans outline-none cursor-pointer"
                    >
                      <option value="">None</option>
                      {availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-wl-text-primary mb-2">
                      Direction
                    </label>
                    <select
                      value={formData.sortDirection}
                      onChange={(e) => setFormData({ ...formData, sortDirection: e.target.value as "asc" | "desc" })}
                      className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-subtle rounded-lg text-wl-text-primary text-sm font-sans outline-none cursor-pointer"
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                  </div>
                </div>

                {/* Share with Team */}
                <label
                  className="flex items-center gap-2 cursor-pointer text-sm text-wl-text-primary"
                >
                  <input
                    type="checkbox"
                    checked={formData.shareWithTeam}
                    onChange={(e) => setFormData({ ...formData, shareWithTeam: e.target.checked })}
                    className="cursor-pointer"
                  />
                  Share with team
                </label>

                {/* Modal Actions */}
                <div className="flex gap-3 justify-end pt-4 border-t border-wl-border-subtle">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleCreateView}
                  >
                    Create View
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
