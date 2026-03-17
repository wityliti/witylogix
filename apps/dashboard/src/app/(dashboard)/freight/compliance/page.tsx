"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCarrierScorecard, useFMCSALookup } from "@/hooks/use-freight";

/* ═══════════════════════════════════════════════════════════
   FREIGHT COMPLIANCE PAGE — Carrier compliance monitoring
   ═══════════════════════════════════════════════════════════ */

const getSafetyBadgeVariant = (rating: number): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  if (rating >= 90) return "success";
  if (rating >= 80) return "warning";
  return "danger";
};

const getComplianceVariant = (score: number): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  if (score >= 90) return "success";
  if (score >= 75) return "warning";
  return "danger";
};

const getDaysUntilExpiry = (expiryDate: string): number => {
  const expiry = new Date(expiryDate);
  const today = new Date();
  const diff = expiry.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export default function FreightCompliancePage() {
  const { carriers } = useCarrierScorecard();
  const [searchQuery, setSearchQuery] = useState("");
  const { results: searchResults, loading: searchLoading } = useFMCSALookup(searchQuery);
  const [selectedCarrier, setSelectedCarrier] = useState<typeof carriers[0] | null>(null);
  const [filterStatus, setFilterStatus] = useState<"All" | "Active" | "Inactive" | "Suspended">("All");
  const [sortBy, setSortBy] = useState<"name" | "compliance" | "safety" | "volume">("compliance");

  // Filter and sort carriers
  const filteredCarriers = useMemo(() => {
    let result = carriers;

    if (filterStatus !== "All") {
      result = result.filter((c) => c.operatingAuthority === filterStatus);
    }

    return result.sort((a, b) => {
      switch (sortBy) {
        case "compliance":
          return b.complianceScore - a.complianceScore;
        case "safety":
          return b.safetyRating - a.safetyRating;
        case "volume":
          return b.loadVolume - a.loadVolume;
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [carriers, filterStatus, sortBy]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary">Carrier Compliance</h2>
          <p className="text-sm text-wl-text-secondary mt-1">{carriers.length} carriers monitored</p>
        </div>
        <Button variant="secondary" size="md">
          📋 Run Compliance Audit
        </Button>
      </div>

      {/* FMCSA Lookup */}
      <Card className="mb-6 bg-gradient-to-r from-wl-info-500/10 to-transparent">
        <div className="p-6">
          <h3 className="text-lg font-bold text-wl-text-primary mb-4">Quick Lookup</h3>
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by DOT#, MC#, or carrier name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 px-4 border border-wl-border-default rounded-md text-wl-text-primary text-sm font-sans bg-wl-bg-elevated outline-none"
              />
              {searchQuery && (
                <div className="absolute mt-1 bg-wl-bg-surface border border-wl-border-default rounded max-h-48 overflow-y-auto w-96 shadow-lg z-10">
                  {searchLoading ? (
                    <div className="p-3 text-xs text-wl-text-tertiary">Searching...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-3 text-xs text-wl-text-tertiary">No results found</div>
                  ) : (
                    searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => { setSelectedCarrier(result); setSearchQuery(""); }}
                        className="w-full text-left p-3 border-b border-wl-border-subtle hover:bg-wl-bg-overlay text-xs"
                      >
                        <div className="font-semibold text-wl-text-primary">{result.name}</div>
                        <div className="text-wl-text-tertiary">DOT: {result.dot} | MC: {result.mc}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <Button variant="primary" size="md">
              Verify
            </Button>
          </div>
        </div>
      </Card>

      {/* Filters & Sort */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex gap-2">
          {(["All", "Active", "Inactive", "Suspended"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-all",
                filterStatus === status
                  ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                  : "bg-transparent text-wl-text-tertiary border-wl-border-default"
              )}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="flex gap-2 ml-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1 rounded border border-wl-border-default text-xs bg-wl-bg-elevated text-wl-text-primary font-semibold cursor-pointer"
          >
            <option value="compliance">Sort by Compliance</option>
            <option value="safety">Sort by Safety</option>
            <option value="volume">Sort by Volume</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
      </div>

      {/* Carriers Table */}
      <Card className="overflow-hidden p-0 mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["Carrier", "DOT#", "Status", "Safety Rating", "Compliance Score", "Loads", "On-Time %", "Insurance", "Actions"].map((h) => (
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
              {filteredCarriers.map((carrier) => {
                const daysUntilExpiry = getDaysUntilExpiry(carrier.insuranceExpiry);
                const insuranceStatus =
                  daysUntilExpiry < 0 ? "expired" : daysUntilExpiry < 30 ? "expiring" : "active";

                return (
                  <tr
                    key={carrier.id}
                    onClick={() => setSelectedCarrier(carrier)}
                    className={cn(
                      "border-b border-wl-border-subtle cursor-pointer transition-colors",
                      selectedCarrier?.id === carrier.id ? "bg-[rgba(245,166,35,0.06)]" : "hover:bg-wl-bg-overlay"
                    )}
                  >
                    <td className="p-4 font-semibold text-wl-text-primary text-xs">{carrier.name}</td>
                    <td className="p-4 font-mono text-wl-text-secondary text-xs">{carrier.dot}</td>
                    <td className="p-4">
                      <Badge
                        variant={
                          carrier.operatingAuthority === "Active"
                            ? "success"
                            : carrier.operatingAuthority === "Suspended"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {carrier.operatingAuthority}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={getSafetyBadgeVariant(carrier.safetyRating)}>
                        {Math.round(carrier.safetyRating)}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={getComplianceVariant(carrier.complianceScore)}>
                        {Math.round(carrier.complianceScore)}
                      </Badge>
                    </td>
                    <td className="p-4 font-mono text-wl-text-secondary text-xs">{carrier.loadVolume}</td>
                    <td className="p-4 font-mono font-semibold text-wl-text-primary text-xs">
                      {carrier.onTimeRate.toFixed(1)}%
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          insuranceStatus === "active"
                            ? "success"
                            : insuranceStatus === "expiring"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {insuranceStatus === "active"
                          ? "✓"
                          : insuranceStatus === "expiring"
                            ? `${daysUntilExpiry}d`
                            : "Expired"}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); }}>
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Selected Carrier Detail Panel */}
      {selectedCarrier && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main detail card */}
          <Card className="lg:col-span-2">
            <div className="p-6 border-b border-wl-border-subtle flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-bold text-wl-text-primary">{selectedCarrier.name}</h3>
                <div className="flex gap-2 mt-2">
                  <Badge variant={selectedCarrier.operatingAuthority === "Active" ? "success" : "danger"}>
                    {selectedCarrier.operatingAuthority}
                  </Badge>
                  <Badge variant={getComplianceVariant(selectedCarrier.complianceScore)}>
                    Compliance: {Math.round(selectedCarrier.complianceScore)}
                  </Badge>
                </div>
              </div>
              <button
                onClick={() => setSelectedCarrier(null)}
                className="text-wl-text-tertiary hover:text-wl-text-primary text-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="text-xs font-semibold text-wl-text-secondary uppercase mb-3">
                    Identification
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-wl-text-tertiary">DOT Number</span>
                      <div className="text-sm font-mono font-semibold text-wl-text-primary">
                        {selectedCarrier.dot}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-wl-text-tertiary">MC Number</span>
                      <div className="text-sm font-mono font-semibold text-wl-text-primary">
                        {selectedCarrier.mc}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-wl-text-secondary uppercase mb-3">
                    Performance
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-wl-text-tertiary">Overall Rating</span>
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-500 text-lg">★</span>
                        <span className="text-sm font-semibold text-wl-text-primary">
                          {selectedCarrier.rating.toFixed(1)}/5
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-wl-text-tertiary">On-Time Rate</span>
                      <div className="text-sm font-semibold text-wl-text-primary">
                        {selectedCarrier.onTimeRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-wl-border-subtle mb-6" />

              {/* Compliance Score Trend */}
              <div>
                <h4 className="text-xs font-semibold text-wl-text-secondary uppercase mb-3">
                  Compliance Trend (12 Months)
                </h4>
                <div className="h-32 bg-wl-bg-surface rounded border border-wl-border-subtle flex items-end justify-between p-4 gap-1">
                  {selectedCarrier.scoreHistory.map((point, idx) => {
                    const maxScore = Math.max(...selectedCarrier.scoreHistory.map((p) => p.score));
                    const height = (point.score / maxScore) * 100;
                    return (
                      <div
                        key={idx}
                        className="flex-1 rounded-t bg-gradient-to-t from-wl-primary-500 to-wl-primary-400 hover:opacity-80 transition-opacity"
                        title={`${point.score}`}
                        style={{ height: `${Math.max(height, 8)}%` }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          {/* Sidebar: Alerts & Renewal */}
          <div className="space-y-6">
            {/* Insurance Alert */}
            <Card>
              <div className="p-6 border-b border-wl-border-subtle">
                <h4 className="text-lg font-bold text-wl-text-primary">Insurance & Bonds</h4>
              </div>
              <div className="p-6">
                {(() => {
                  const daysUntilExpiry = getDaysUntilExpiry(selectedCarrier.insuranceExpiry);
                  const status =
                    daysUntilExpiry < 0 ? "expired" : daysUntilExpiry < 30 ? "expiring" : "active";

                  return (
                    <div className={cn(
                      "p-4 rounded border",
                      status === "active"
                        ? "bg-wl-success-bg border-wl-success-400"
                        : status === "expiring"
                          ? "bg-wl-warning-bg border-wl-warning-400"
                          : "bg-wl-danger-bg border-wl-danger-400"
                    )}>
                      <div className={cn(
                        "text-sm font-semibold mb-2",
                        status === "active"
                          ? "text-wl-success-400"
                          : status === "expiring"
                            ? "text-wl-warning-400"
                            : "text-wl-danger-400"
                      )}>
                        {status === "active"
                          ? "Active"
                          : status === "expiring"
                            ? `Expiring in ${daysUntilExpiry} days`
                            : "EXPIRED"}
                      </div>
                      <div className="text-xs text-wl-text-secondary">
                        Expires: {new Date(selectedCarrier.insuranceExpiry).toLocaleDateString()}
                      </div>
                      {status !== "active" && (
                        <Button variant="danger" size="sm" className="mt-3 w-full">
                          Request Renewal
                        </Button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </Card>

            {/* Operating Authority */}
            <Card>
              <div className="p-6 border-b border-wl-border-subtle">
                <h4 className="text-lg font-bold text-wl-text-primary">Operating Authority</h4>
              </div>
              <div className="p-6">
                <Badge
                  variant={selectedCarrier.operatingAuthority === "Active" ? "success" : "danger"}
                  className="mb-3"
                >
                  {selectedCarrier.operatingAuthority}
                </Badge>
                <p className="text-xs text-wl-text-secondary">
                  Authority status is{" "}
                  <span className="font-semibold">
                    {selectedCarrier.operatingAuthority === "Active" ? "verified" : "suspended"}
                  </span>
                </p>
              </div>
            </Card>

            {/* Quick Stats */}
            <Card>
              <div className="p-6 border-b border-wl-border-subtle">
                <h4 className="text-lg font-bold text-wl-text-primary">Stats</h4>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <span className="text-xs text-wl-text-tertiary">Total Loads</span>
                  <div className="text-2xl font-bold text-wl-text-primary">
                    {selectedCarrier.loadVolume}
                  </div>
                </div>
                <div className="h-px bg-wl-border-subtle" />
                <div>
                  <span className="text-xs text-wl-text-tertiary">Safety Rating</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getSafetyBadgeVariant(selectedCarrier.safetyRating)}>
                      {Math.round(selectedCarrier.safetyRating)}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
