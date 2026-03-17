"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFreightLoads } from "@/hooks/use-freight";

/* ═══════════════════════════════════════════════════════════
   FREIGHT LOADS PAGE — Load board with filtering
   ═══════════════════════════════════════════════════════════ */

const statusBadgeVariant = (status: string): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  const map: Record<string, "success" | "warning" | "danger" | "info" | "primary" | "default"> = {
    Available: "primary",
    Booked: "success",
    "In-Transit": "info",
    Delivered: "success",
    Exception: "danger",
  };
  return map[status] ?? "default";
};

const modeIcon = (mode: string): string => {
  const map: Record<string, string> = {
    FTL: "🚛",
    LTL: "📦",
    Intermodal: "🚢",
  };
  return map[mode] ?? "📦";
};

export default function FreightLoadsPage() {
  const { loads, totalCount, page, setPage, filters, setFilters, search, setSearch, loading } = useFreightLoads(25);
  const [selectedLoad, setSelectedLoad] = useState<typeof loads[0] | null>(null);
  const [expandedLoadId, setExpandedLoadId] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | 3 | null>(null);
  const [selectedBulk, setSelectedBulk] = useState<Set<string>>(new Set());

  const pageCount = useMemo(() => Math.ceil(totalCount / 25), [totalCount]);

  // Calculate filter counts
  const filterCounts = useMemo(() => {
    const statuses = new Set(loads.map((l) => l.status));
    const modes = new Set(loads.map((l) => l.mode));
    return { statuses: Array.from(statuses), modes: Array.from(modes) };
  }, [loads]);

  const handleBulkToggle = (id: string) => {
    const newSet = new Set(selectedBulk);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedBulk(newSet);
  };

  const handleSelectAll = () => {
    if (selectedBulk.size === loads.length) {
      setSelectedBulk(new Set());
    } else {
      setSelectedBulk(new Set(loads.map((l) => l.id)));
    }
  };

  return (
    <div className="p-6">
      {/* Header & Actions */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary">Load Board</h2>
          <p className="text-sm text-wl-text-secondary mt-1">{totalCount} total loads</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setWizardStep(0)}
          >
            + Create Load
          </Button>
          <Button variant="secondary" size="md">
            📥 Import
          </Button>
        </div>
      </div>

      {/* Filters Row 1: Search + Status/Mode Filter Pills */}
      <div className="flex flex-col gap-4 mb-5">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search load ID, origin, destination, carrier..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full p-2 px-4 bg-wl-bg-elevated border border-wl-border-default rounded-md text-wl-text-primary text-sm font-sans outline-none"
          />
        </div>

        {/* Status Pills */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilters({ ...filters, status: "" as any })}
            className={cn(
              "px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-all",
              filters.status === ""
                ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                : "bg-transparent text-wl-text-tertiary border-wl-border-default"
            )}
          >
            All Statuses
          </button>
          {(["Available", "Booked", "In-Transit", "Delivered", "Exception"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilters({ ...filters, status: s })}
              className={cn(
                "px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-all",
                filters.status === s
                  ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                  : "bg-transparent text-wl-text-tertiary border-wl-border-default"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilters({ ...filters, mode: "" as any })}
            className={cn(
              "flex items-center gap-1 px-3 py-1 rounded border text-xs font-semibold cursor-pointer transition-all",
              filters.mode === ""
                ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                : "bg-transparent text-wl-text-tertiary border-wl-border-default"
            )}
          >
            All Modes
          </button>
          {(["FTL", "LTL", "Intermodal"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setFilters({ ...filters, mode: m })}
              className={cn(
                "flex items-center gap-1 px-3 py-1 rounded border text-xs font-semibold cursor-pointer transition-all",
                filters.mode === m
                  ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                  : "bg-transparent text-wl-text-tertiary border-wl-border-default"
              )}
            >
              <span>{modeIcon(m)}</span>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions (if any selected) */}
      {selectedBulk.size > 0 && (
        <div className="mb-4 p-3 bg-wl-info-bg border border-wl-info-400 rounded-md flex items-center justify-between">
          <span className="text-sm font-semibold text-wl-info-400">{selectedBulk.size} loads selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm">
              Assign Carrier
            </Button>
            <Button variant="ghost" size="sm">
              Update Status
            </Button>
            <Button variant="ghost" size="sm">
              📥 Export
            </Button>
          </div>
        </div>
      )}

      {/* Load Table */}
      <Card className="overflow-hidden p-0 mb-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-4 text-left w-8">
                  <input
                    type="checkbox"
                    checked={selectedBulk.size === loads.length && loads.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border border-wl-border-default cursor-pointer"
                  />
                </th>
                {["Load ID", "Origin", "Dest", "Mode", "Weight", "Carrier", "Rate", "Status", "Pickup", "Delivery"].map((h) => (
                  <th
                    key={h}
                    className="text-left p-4 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider border-b border-wl-border-subtle bg-wl-bg-surface sticky top-0 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-wl-text-tertiary text-sm">
                    Loading loads...
                  </td>
                </tr>
              ) : loads.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-wl-text-tertiary text-sm">
                    No loads found
                  </td>
                </tr>
              ) : (
                loads.map((load) => (
                  <tr
                    key={load.id}
                    className={cn(
                      "border-b border-wl-border-subtle transition-colors",
                      expandedLoadId === load.id ? "bg-[rgba(245,166,35,0.06)]" : "hover:bg-wl-bg-overlay"
                    )}
                  >
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedBulk.has(load.id)}
                        onChange={() => handleBulkToggle(load.id)}
                        className="w-4 h-4 rounded border border-wl-border-default cursor-pointer"
                      />
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => setExpandedLoadId(expandedLoadId === load.id ? null : load.id)}
                        className="font-mono font-semibold text-wl-primary-400 hover:underline text-xs"
                      >
                        {load.loadNumber}
                      </button>
                    </td>
                    <td className="p-4 text-wl-text-secondary text-xs">
                      {load.originCity}, {load.originState}
                    </td>
                    <td className="p-4 text-wl-text-secondary text-xs">
                      {load.destCity}, {load.destState}
                    </td>
                    <td className="p-4 text-xs">
                      <Badge variant="info">
                        <span className="mr-1">{modeIcon(load.mode)}</span>
                        {load.mode}
                      </Badge>
                    </td>
                    <td className="p-4 text-wl-text-secondary font-mono text-xs">
                      {Math.round(load.weight)} lbs
                    </td>
                    <td className="p-4 text-xs text-wl-text-secondary">
                      {load.carrier ?? "—"}
                    </td>
                    <td className="p-4 font-mono font-semibold text-wl-primary-400 text-xs">
                      ${load.rate}
                    </td>
                    <td className="p-4">
                      <Badge variant={statusBadgeVariant(load.status)}>
                        {load.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-wl-text-secondary font-mono text-xs whitespace-nowrap">
                      {new Date(load.pickupDate).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-wl-text-secondary font-mono text-xs whitespace-nowrap">
                      {new Date(load.deliveryDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Expandable Load Details */}
        {expandedLoadId && selectedLoad && (
          <div className="border-t border-wl-border-subtle bg-wl-bg-surface p-6">
            <div className="grid grid-cols-2 gap-8 mb-6">
              <div>
                <h4 className="text-sm font-bold text-wl-text-primary mb-4">Load Details</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-wl-text-tertiary">Load ID</span>
                    <div className="text-sm font-mono font-semibold text-wl-text-primary">{selectedLoad.loadNumber}</div>
                  </div>
                  <div>
                    <span className="text-xs text-wl-text-tertiary">Weight</span>
                    <div className="text-sm font-semibold text-wl-text-primary">{Math.round(selectedLoad.weight)} lbs ({selectedLoad.pallets} pallets)</div>
                  </div>
                  <div>
                    <span className="text-xs text-wl-text-tertiary">Mode</span>
                    <div className="text-sm font-semibold text-wl-text-primary">{selectedLoad.mode}</div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-wl-text-primary mb-4">Route Map</h4>
                <div className="w-full h-40 bg-wl-bg-overlay rounded border border-wl-border-default flex items-center justify-center text-sm text-wl-text-tertiary">
                  [Route map placeholder]
                </div>
              </div>
            </div>

            {/* Documents */}
            {selectedLoad.documents.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-bold text-wl-text-primary mb-2">Documents</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedLoad.documents.map((doc, idx) => (
                    <a
                      key={idx}
                      href="#"
                      className="text-xs text-wl-primary-400 hover:underline font-semibold px-3 py-1 bg-wl-bg-overlay rounded border border-wl-border-subtle"
                    >
                      📄 {doc}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="primary" size="sm">
                Assign Carrier
              </Button>
              <Button variant="secondary" size="sm">
                Edit Load
              </Button>
              <Button variant="ghost" size="sm">
                View Tracking
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-wl-text-tertiary">
          Page {page + 1} of {pageCount || 1}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(Math.max(0, page - 1))}
          >
            ← Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pageCount - 1}
            onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
          >
            Next →
          </Button>
        </div>
      </div>

      {/* Create Load Wizard Modal */}
      {wizardStep !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <div className="p-6 border-b border-wl-border-subtle flex items-center justify-between">
              <h3 className="text-xl font-bold text-wl-text-primary">Create Load</h3>
              <button
                onClick={() => setWizardStep(null)}
                className="text-wl-text-tertiary hover:text-wl-text-primary text-xl font-sans"
              >
                ✕
              </button>
            </div>

            {/* Wizard Steps */}
            <div className="p-6">
              <div className="flex gap-4 mb-6">
                {[0, 1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={cn(
                      "flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full border",
                      wizardStep === step
                        ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                        : wizardStep > step
                          ? "bg-wl-success-400 text-white border-wl-success-400"
                          : "bg-transparent text-wl-text-tertiary border-wl-border-default"
                    )}
                  >
                    {wizardStep > step ? "✓" : step + 1}
                  </div>
                ))}
              </div>

              {wizardStep === 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-wl-text-primary">Origin & Destination</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Origin City" className="p-2 border border-wl-border-default rounded text-sm text-wl-text-primary bg-wl-bg-elevated" />
                    <input placeholder="Dest City" className="p-2 border border-wl-border-default rounded text-sm text-wl-text-primary bg-wl-bg-elevated" />
                  </div>
                </div>
              )}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-wl-text-primary">Cargo Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Weight (lbs)" className="p-2 border border-wl-border-default rounded text-sm text-wl-text-primary bg-wl-bg-elevated" />
                    <input placeholder="Pallets" className="p-2 border border-wl-border-default rounded text-sm text-wl-text-primary bg-wl-bg-elevated" />
                  </div>
                </div>
              )}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-wl-text-primary">Carrier Selection</h4>
                  <input placeholder="Search carrier..." className="p-2 border border-wl-border-default rounded text-sm text-wl-text-primary bg-wl-bg-elevated w-full" />
                </div>
              )}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-wl-text-primary">Review & Confirm</h4>
                  <p className="text-sm text-wl-text-secondary">Load details will be finalized...</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-wl-border-subtle flex gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setWizardStep(null)}>
                Cancel
              </Button>
              {wizardStep > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setWizardStep((s) => ((s ?? 0) - 1) as any)}
                >
                  Back
                </Button>
              )}
              {wizardStep < 3 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setWizardStep((s) => ((s ?? 0) + 1) as any)}
                >
                  Next
                </Button>
              )}
              {wizardStep === 3 && (
                <Button variant="primary" size="sm" onClick={() => { setWizardStep(null); }}>
                  Create Load
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
