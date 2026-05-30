"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDVIR, useDvirInspections } from "@/hooks/use-eld";
import { DVIRForm } from "@/components/eld/dvir-form";
import { useApiMutation } from "@/hooks/use-api";
import { useToast } from "@/components/ui/toast";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  CheckCircle,
  AlertTriangle,
  Calendar,
  Plus,
  Eye,
  Wrench,
} from "lucide-react";

type DefectStatus = "REPORTED" | "ACKNOWLEDGED" | "REPAIRED" | "CERTIFIED";

export default function DVIRPage() {
  const { defects, isLoading: defectsLoading, error: defectsError, refetch: refetchDefects, updateDefectStatus } = useDVIR();
  const { items: inspections, loading: inspectionsLoading, error: inspectionsError, refetch: refetchInspections } = useDvirInspections();
  const { execute: submitInspection } = useApiMutation("POST", "/api/v4/eld/dvir");
  const { addToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [inspectionType, setInspectionType] = useState<"PRE_TRIP" | "POST_TRIP">("PRE_TRIP");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<DefectStatus | "ALL">("ALL");
  const [showVehicleSearch, setShowVehicleSearch] = useState(false);

  const loading = defectsLoading && inspectionsLoading;

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (defectsError) return <ErrorState message={defectsError.message} onRetry={refetchDefects} />;

  const filteredDefects = useMemo(() => {
    let result = defects;
    if (filterStatus !== "ALL") {
      result = result.filter((d) => d.status === filterStatus);
    }
    if (searchQuery) {
      result = result.filter(
        (d) =>
          d.component.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return result;
  }, [defects, filterStatus, searchQuery]);

  const filteredHistory = useMemo(() => {
    if (!selectedVehicle) return inspections;
    return inspections
      .filter((h) => h.vehicleNumber === selectedVehicle)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [inspections, selectedVehicle]);

  const uniqueVehicles = useMemo(() => {
    const seen = new Set<string>();
    return inspections.filter((i) => {
      if (seen.has(i.vehicleNumber)) return false;
      seen.add(i.vehicleNumber);
      return true;
    });
  }, [inspections]);

  const criticalDefectsCount = filteredDefects.filter((d) => d.severity === "CRITICAL").length;
  const openDefectsCount     = filteredDefects.filter((d) => d.status !== "CERTIFIED").length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] space-y-6 p-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-[#12121a] border border-[#1e1e2e]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase">Total Defects</span>
            <Wrench className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-white">{defects.length}</p>
          <p className="text-xs text-gray-400 mt-1">{openDefectsCount} open</p>
        </div>

        <div className="p-4 rounded-lg bg-[#12121a] border border-[#1e1e2e]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase">Critical Issues</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-500">{criticalDefectsCount}</p>
          <p className="text-xs text-gray-400 mt-1">Require immediate action</p>
        </div>

        <div className="p-4 rounded-lg bg-[#12121a] border border-[#1e1e2e]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase">Repaired</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-500">
            {defects.filter((d) => d.status === "REPAIRED").length}
          </p>
          <p className="text-xs text-gray-400 mt-1">Awaiting certification</p>
        </div>

        <div className="p-4 rounded-lg bg-[#12121a] border border-[#1e1e2e]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase">Certified</span>
            <CheckCircle className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-500">
            {defects.filter((d) => d.status === "CERTIFIED").length}
          </p>
          <p className="text-xs text-gray-400 mt-1">Resolved and closed</p>
        </div>
      </div>

      {!showForm ? (
        <>
          {/* Active Defects */}
          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-white">Active Defects</CardTitle>
                  <p className="text-xs text-gray-400 mt-1">Track vehicle maintenance issues</p>
                </div>
                <Button variant="primary" className="h-9" onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Inspection
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="Search defects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 text-xs flex-1 bg-[#1a1a2e] border-[#1e1e2e] text-white placeholder-gray-500"
                />

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as DefectStatus | "ALL")}
                  className="h-9 px-3 text-xs rounded-lg bg-[#1a1a2e] border border-[#1e1e2e] text-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="REPORTED">Reported</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                  <option value="REPAIRED">Repaired</option>
                  <option value="CERTIFIED">Certified</option>
                </select>
              </div>

              {defectsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                </div>
              ) : filteredDefects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Wrench className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm font-medium">No defects found</p>
                  <p className="text-xs mt-1">All systems are operating normally</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDefects.map((defect) => (
                    <div
                      key={defect.id}
                      className="p-3 rounded-lg bg-[#1a1a2e] border border-[#1e1e2e] hover:border-blue-500/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-white">{defect.component}</h4>
                            <Badge
                              variant={
                                defect.severity === "CRITICAL"
                                  ? "danger"
                                  : defect.severity === "MAJOR"
                                    ? "warning"
                                    : "info"
                              }
                              className="text-xs"
                            >
                              {defect.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400">{defect.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Vehicle: {defect.vehicleId} • Driver: {defect.driverName}
                          </p>
                        </div>

                        <select
                          value={defect.status}
                          onChange={(e) =>
                            updateDefectStatus({ id: defect.id, status: e.target.value as DefectStatus })
                          }
                          className="h-8 px-2 text-xs rounded bg-[#1a1a2e] border border-[#1e1e2e] text-white"
                        >
                          <option value="REPORTED">Reported</option>
                          <option value="ACKNOWLEDGED">Acknowledged</option>
                          <option value="REPAIRED">Repaired</option>
                          <option value="CERTIFIED">Certified</option>
                        </select>
                      </div>

                      {defect.mechanicApproval && (
                        <div className="text-xs text-emerald-500 pt-2 border-t border-[#1e1e2e]">
                          ✓ Certified by {defect.mechanicApproval.mechanicName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inspection History */}
          <Card className="bg-[#12121a] border-[#1e1e2e]">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-white">Inspection History</CardTitle>
                  <p className="text-xs text-gray-400 mt-1">Past and current vehicle inspections</p>
                </div>
              </div>

              {/* Vehicle selector */}
              <div className="mt-4 relative">
                <button
                  onClick={() => setShowVehicleSearch(!showVehicleSearch)}
                  className="w-full h-9 px-3 rounded-lg border border-[#1e1e2e] bg-[#1a1a2e] text-white text-left flex items-center justify-between hover:bg-[#0a0a0f] transition-colors text-sm"
                >
                  <span>
                    {selectedVehicle ? `Vehicle: ${selectedVehicle}` : "All vehicles"}
                  </span>
                </button>

                {showVehicleSearch && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-[#1a1a2e] border border-[#1e1e2e] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <button
                      onClick={() => { setSelectedVehicle(""); setShowVehicleSearch(false); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs transition-colors border-b border-[#1e1e2e]",
                        !selectedVehicle ? "bg-blue-500/10 text-blue-400" : "text-gray-400 hover:bg-[#0a0a0f]"
                      )}
                    >
                      All vehicles
                    </button>
                    {uniqueVehicles.map((vehicle) => (
                      <button
                        key={vehicle.id}
                        onClick={() => {
                          setSelectedVehicle(vehicle.vehicleNumber);
                          setShowVehicleSearch(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs transition-colors border-b border-[#1e1e2e] last:border-0",
                          selectedVehicle === vehicle.vehicleNumber
                            ? "bg-blue-500/10 text-blue-400"
                            : "text-gray-400 hover:bg-[#0a0a0f]"
                        )}
                      >
                        {vehicle.vehicleNumber}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {inspectionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Calendar className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm font-medium">No inspections yet</p>
                  <p className="text-xs mt-1">
                    {selectedVehicle
                      ? `No inspections recorded for ${selectedVehicle}`
                      : "Schedule the first inspection to get started"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredHistory.map((inspection: InspectionHistory) => (
                    <div
                      key={inspection.id}
                      className="p-3 rounded-lg bg-[#1a1a2e] border border-[#1e1e2e] hover:border-blue-500/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-white">
                              {inspection.type === "PRE_TRIP" ? "📋" : "✓"}{" "}
                              {inspection.type.replace(/_/g, "-")} Inspection
                            </h4>
                            <Badge
                              variant={inspection.status === "PASSED" ? "success" : "danger"}
                              className="text-xs"
                            >
                              {inspection.status === "PASSED" ? "✓ PASSED" : "✗ FAILED"}
                            </Badge>
                          </div>

                          <p className="text-xs text-gray-400">
                            {inspection.driverName} •{" "}
                            {new Date(inspection.date).toLocaleDateString()} at{" "}
                            {new Date(inspection.date).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>

                          {inspection.defectsCount > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-amber-500">
                                {inspection.defectsCount} defect
                                {inspection.defectsCount > 1 ? "s" : ""}
                              </span>
                              {inspection.criticalDefects > 0 && (
                                <span className="text-xs text-red-500">
                                  • {inspection.criticalDefects} critical
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <Button variant="secondary" size="sm" className="h-7 text-xs">
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Form mode */}
          <DVIRForm
            vehicleNumber={selectedVehicle || ""}
            driverId=""
            driverName=""
            inspectionType={inspectionType}
            onSubmit={async (data) => {
              try {
                await submitInspection(data);
                addToast({
                  type: "success",
                  title: "Inspection submitted",
                  message: "DVIR inspection has been recorded.",
                });
                refetchInspections();
              } catch {
                addToast({
                  type: "error",
                  title: "Submission failed",
                  message: "Could not submit inspection. Please try again.",
                });
              }
              setShowForm(false);
            }}
          />

          <div className="flex justify-center">
            <Button variant="secondary" className="h-9" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
