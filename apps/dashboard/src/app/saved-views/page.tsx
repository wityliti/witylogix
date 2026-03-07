"use client";

import { useState, useMemo } from "react";
import { Header } from "../../components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Copy, Edit2, Trash2, Eye, MoreVertical, Plus } from "lucide-react";

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

      <div style={{ padding: "var(--wl-space-6)" }}>
        {/* My Views Grid */}
        <div style={{ marginBottom: "var(--wl-space-6)" }}>
          <h2 style={{ fontSize: "var(--wl-text-lg)", fontWeight: 600, color: "var(--wl-text-primary)", marginBottom: "var(--wl-space-4)" }}>
            My Views
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "var(--wl-space-4)",
            }}
          >
            {SAVED_VIEWS.map((view) => (
              <Card key={view.id} style={{ display: "flex", flexDirection: "column" }}>
                <CardHeader style={{ paddingBottom: "var(--wl-space-3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--wl-space-2)" }}>
                    <div style={{ flex: 1 }}>
                      <CardTitle style={{ fontSize: "var(--wl-text-base)", marginBottom: "var(--wl-space-2)" }}>
                        {view.name}
                      </CardTitle>
                      <p style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-secondary)", margin: 0 }}>
                        {view.targetTable}
                      </p>
                    </div>
                    <button
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        color: "var(--wl-text-tertiary)",
                      }}
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </CardHeader>
                <CardContent style={{ flex: 1, paddingTop: 0, paddingBottom: "var(--wl-space-4)" }}>
                  {/* Badges */}
                  <div style={{ display: "flex", gap: "var(--wl-space-2)", marginBottom: "var(--wl-space-4)", flexWrap: "wrap" }}>
                    {view.isDefault && <Badge variant="primary">Default</Badge>}
                    {view.isShared && <Badge variant="info">Shared</Badge>}
                  </div>

                  {/* Stats */}
                  <div style={{ marginBottom: "var(--wl-space-4)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--wl-space-2)" }}>
                      <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)" }}>Filters</span>
                      <span style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)" }}>
                        {view.filters.length}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)" }}>Visible Columns</span>
                      <span style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)" }}>
                        {view.visibleColumns.length}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: "var(--wl-space-2)", flexWrap: "wrap" }}>
                    <Button variant="primary" size="sm" style={{ flex: "1 1 auto", minWidth: 80 }}>
                      <Eye size={14} style={{ marginRight: 4 }} />
                      Apply
                    </Button>
                    <Button variant="secondary" size="sm" style={{ flex: "1 1 auto", minWidth: 70 }}>
                      <Edit2 size={14} />
                    </Button>
                    <Button variant="secondary" size="sm" style={{ flex: "1 1 auto", minWidth: 70 }}>
                      <Copy size={14} />
                    </Button>
                    <Button variant="danger" size="sm" style={{ flex: "1 1 auto", minWidth: 70 }}>
                      <Trash2 size={14} />
                    </Button>
                  </div>

                  {/* Set as Default */}
                  {!view.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      style={{ width: "100%", marginTop: "var(--wl-space-3)", fontSize: "var(--wl-text-xs)" }}
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
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "var(--wl-space-4)",
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <Card
            style={{
              width: "100%",
              maxWidth: 700,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle>Create New Saved View</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-4)" }}>
                {/* Name Input */}
                <div>
                  <label style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)", marginBottom: "var(--wl-space-2)", display: "block" }}>
                    View Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Today's Priority Orders"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "var(--wl-space-2) var(--wl-space-3)",
                      background: "var(--wl-bg-elevated)",
                      border: "1px solid var(--wl-border-default)",
                      borderRadius: "var(--wl-radius-md)",
                      color: "var(--wl-text-primary)",
                      fontSize: "var(--wl-text-sm)",
                      fontFamily: "var(--wl-font-sans)",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Target Table Select */}
                <div>
                  <label style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)", marginBottom: "var(--wl-space-2)", display: "block" }}>
                    Target Table
                  </label>
                  <select
                    value={formData.targetTable}
                    onChange={(e) => handleTableChange(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "var(--wl-space-2) var(--wl-space-3)",
                      background: "var(--wl-bg-elevated)",
                      border: "1px solid var(--wl-border-default)",
                      borderRadius: "var(--wl-radius-md)",
                      color: "var(--wl-text-primary)",
                      fontSize: "var(--wl-text-sm)",
                      fontFamily: "var(--wl-font-sans)",
                      outline: "none",
                      cursor: "pointer",
                    }}
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
                  <label style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)", marginBottom: "var(--wl-space-2)", display: "block" }}>
                    Filters
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-3)" }}>
                    {formData.filters.map((filter, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "var(--wl-space-2)", alignItems: "flex-end" }}>
                        <select
                          value={filter.column}
                          onChange={(e) => updateFilter(idx, "column", e.target.value)}
                          style={{
                            flex: 1,
                            padding: "var(--wl-space-2) var(--wl-space-3)",
                            background: "var(--wl-bg-elevated)",
                            border: "1px solid var(--wl-border-default)",
                            borderRadius: "var(--wl-radius-md)",
                            color: "var(--wl-text-primary)",
                            fontSize: "var(--wl-text-sm)",
                            fontFamily: "var(--wl-font-sans)",
                            outline: "none",
                            cursor: "pointer",
                          }}
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
                          style={{
                            flex: 0.8,
                            padding: "var(--wl-space-2) var(--wl-space-3)",
                            background: "var(--wl-bg-elevated)",
                            border: "1px solid var(--wl-border-default)",
                            borderRadius: "var(--wl-radius-md)",
                            color: "var(--wl-text-primary)",
                            fontSize: "var(--wl-text-sm)",
                            fontFamily: "var(--wl-font-sans)",
                            outline: "none",
                            cursor: "pointer",
                          }}
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
                          style={{
                            flex: 0.8,
                            padding: "var(--wl-space-2) var(--wl-space-3)",
                            background: "var(--wl-bg-elevated)",
                            border: "1px solid var(--wl-border-default)",
                            borderRadius: "var(--wl-radius-md)",
                            color: "var(--wl-text-primary)",
                            fontSize: "var(--wl-text-sm)",
                            fontFamily: "var(--wl-font-sans)",
                            outline: "none",
                          }}
                        />
                        {formData.filters.length > 1 && (
                          <Button
                            variant="danger"
                            size="sm"
                            style={{ padding: "var(--wl-space-2)" }}
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
                      style={{ alignSelf: "flex-start" }}
                    >
                      + Add Filter
                    </Button>
                  </div>
                </div>

                {/* Column Visibility */}
                <div>
                  <label style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)", marginBottom: "var(--wl-space-2)", display: "block" }}>
                    Visible Columns
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--wl-space-3)" }}>
                    {availableColumns.map((col) => (
                      <label
                        key={col}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--wl-space-2)",
                          cursor: "pointer",
                          fontSize: "var(--wl-text-sm)",
                          color: "var(--wl-text-primary)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData.visibleColumns.includes(col)}
                          onChange={() => toggleColumn(col)}
                          style={{ cursor: "pointer" }}
                        />
                        {col}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sort Configuration */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--wl-space-3)" }}>
                  <div>
                    <label style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)", marginBottom: "var(--wl-space-2)", display: "block" }}>
                      Sort Column
                    </label>
                    <select
                      value={formData.sortColumn}
                      onChange={(e) => setFormData({ ...formData, sortColumn: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "var(--wl-space-2) var(--wl-space-3)",
                        background: "var(--wl-bg-elevated)",
                        border: "1px solid var(--wl-border-default)",
                        borderRadius: "var(--wl-radius-md)",
                        color: "var(--wl-text-primary)",
                        fontSize: "var(--wl-text-sm)",
                        fontFamily: "var(--wl-font-sans)",
                        outline: "none",
                        cursor: "pointer",
                      }}
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
                    <label style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)", marginBottom: "var(--wl-space-2)", display: "block" }}>
                      Direction
                    </label>
                    <select
                      value={formData.sortDirection}
                      onChange={(e) => setFormData({ ...formData, sortDirection: e.target.value as "asc" | "desc" })}
                      style={{
                        width: "100%",
                        padding: "var(--wl-space-2) var(--wl-space-3)",
                        background: "var(--wl-bg-elevated)",
                        border: "1px solid var(--wl-border-default)",
                        borderRadius: "var(--wl-radius-md)",
                        color: "var(--wl-text-primary)",
                        fontSize: "var(--wl-text-sm)",
                        fontFamily: "var(--wl-font-sans)",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                  </div>
                </div>

                {/* Share with Team */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--wl-space-2)",
                    cursor: "pointer",
                    fontSize: "var(--wl-text-sm)",
                    color: "var(--wl-text-primary)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.shareWithTeam}
                    onChange={(e) => setFormData({ ...formData, shareWithTeam: e.target.checked })}
                    style={{ cursor: "pointer" }}
                  />
                  Share with team
                </label>

                {/* Modal Actions */}
                <div style={{ display: "flex", gap: "var(--wl-space-3)", justifyContent: "flex-end", paddingTop: "var(--wl-space-4)", borderTop: "1px solid var(--wl-border-subtle)" }}>
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
