"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Wrench,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
} from "lucide-react";
import {
  useMaintenanceSchedule,
  useMaintenanceCalendar,
  useVehicles,
  MAINTENANCE_TYPES,
  type MaintenanceEvent,
} from "@/hooks/use-fleet";

/* ═══════════════════════════════════════════════════════════
   MAINTENANCE PAGE — Maintenance Calendar & Scheduling
   ═══════════════════════════════════════════════════════════ */

const getStatusColor = (status: string): "default" | "success" | "warning" | "danger" | "info" | "primary" => {
  const map: Record<string, "default" | "success" | "warning" | "danger" | "info" | "primary"> = {
    scheduled: "info",
    "in-progress": "warning",
    completed: "success",
    overdue: "danger",
  };
  return map[status] || "default";
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

const getDaysUntil = (dateStr: string): number => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export default function MaintenancePage() {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterVehicleId, setFilterVehicleId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const vehicles = useVehicles();
  const allMaintenance = useMaintenanceSchedule(filterVehicleId || undefined);
  const calendarMaintenance = useMaintenanceCalendar(currentMonth.getFullYear(), currentMonth.getMonth());

  const pageSize = 10;

  // Filter maintenance
  const filteredMaintenance = useMemo(() => {
    let result = [...allMaintenance];

    if (filterType) {
      result = result.filter((m) => m.type === filterType);
    }

    if (filterStatus) {
      result = result.filter((m) => m.status === filterStatus);
    }

    // Sort: overdue first, then by date
    result.sort((a, b) => {
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (a.status !== "overdue" && b.status === "overdue") return 1;
      return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    });

    return result;
  }, [allMaintenance, filterType, filterStatus]);

  const paginatedMaintenance = filteredMaintenance.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredMaintenance.length / pageSize);

  // Get counts by status
  const statusCounts = useMemo(() => {
    return {
      overdue: allMaintenance.filter((m) => m.status === "overdue").length,
      scheduled: allMaintenance.filter((m) => m.status === "scheduled").length,
      inProgress: allMaintenance.filter((m) => m.status === "in-progress").length,
      completed: allMaintenance.filter((m) => m.status === "completed").length,
    };
  }, [allMaintenance]);

  const overdueMaintenance = allMaintenance.filter((m) => m.status === "overdue");
  const upcomingMaintenance = allMaintenance
    .filter((m) => m.status === "scheduled")
    .slice(0, 5);

  return (
    <>
      <Header
        title="Maintenance Management"
        subtitle={`${filteredMaintenance.length} events • ${statusCounts.overdue} overdue`}
        actions={
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4 mr-2" />
            Schedule Maintenance
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-wl-text-primary">{statusCounts.scheduled}</p>
                <p className="text-xs text-wl-text-secondary mt-1">Scheduled</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-wl-warning-500">{statusCounts.inProgress}</p>
                <p className="text-xs text-wl-text-secondary mt-1">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-wl-success-500">{statusCounts.completed}</p>
                <p className="text-xs text-wl-text-secondary mt-1">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-wl-danger-500 border-2">
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-wl-danger-500">{statusCounts.overdue}</p>
                <p className="text-xs text-wl-text-secondary mt-1">Overdue</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Alerts */}
        {overdueMaintenance.length > 0 && (
          <Card className="border-wl-danger-500 border-2">
            <CardHeader>
              <CardTitle className="text-sm text-wl-danger-500">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                Overdue Maintenance ({overdueMaintenance.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overdueMaintenance.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-wl-danger-500 bg-opacity-10 rounded-md"
                  >
                    <div>
                      <p className="text-sm font-medium text-wl-text-primary">
                        {item.type.replace("-", " ").toUpperCase()}
                      </p>
                      <p className="text-xs text-wl-text-secondary">
                        {vehicles.find((v) => v.id === item.vehicleId)?.make}{" "}
                        {vehicles.find((v) => v.id === item.vehicleId)?.model} • Due{" "}
                        {formatDate(item.scheduledDate)}
                      </p>
                    </div>
                    <Button variant="danger" size="sm">
                      Action
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-2 flex-wrap items-center">
              {/* View Mode Toggle */}
              <div className="flex gap-1 mr-auto">
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "px-3 py-2 text-xs font-medium rounded-md transition-colors",
                    viewMode === "list"
                      ? "bg-wl-primary-500 text-wl-text-inverse"
                      : "bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary"
                  )}
                >
                  List View
                </button>
                <button
                  onClick={() => setViewMode("calendar")}
                  className={cn(
                    "px-3 py-2 text-xs font-medium rounded-md transition-colors",
                    viewMode === "calendar"
                      ? "bg-wl-primary-500 text-wl-text-inverse"
                      : "bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary"
                  )}
                >
                  Calendar
                </button>
              </div>

              {/* Vehicle Filter */}
              <select
                value={filterVehicleId || ""}
                onChange={(e) => {
                  setFilterVehicleId(e.target.value || null);
                  setCurrentPage(1);
                }}
                className="p-2 px-3 bg-wl-bg-base border border-wl-border-default rounded-md text-wl-text-primary text-sm outline-none"
              >
                <option value="">All Vehicles</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.year} {v.make} {v.model}
                  </option>
                ))}
              </select>

              {/* Type Filter */}
              <select
                value={filterType || ""}
                onChange={(e) => {
                  setFilterType(e.target.value || null);
                  setCurrentPage(1);
                }}
                className="p-2 px-3 bg-wl-bg-base border border-wl-border-default rounded-md text-wl-text-primary text-sm outline-none"
              >
                <option value="">All Types</option>
                {MAINTENANCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace("-", " ").charAt(0).toUpperCase() + type.replace("-", " ").slice(1)}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus || ""}
                onChange={(e) => {
                  setFilterStatus(e.target.value || null);
                  setCurrentPage(1);
                }}
                className="p-2 px-3 bg-wl-bg-base border border-wl-border-default rounded-md text-wl-text-primary text-sm outline-none"
              >
                <option value="">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {viewMode === "list" ? (
          <>
            {/* Maintenance List */}
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-wl-border-subtle bg-wl-bg-overlay">
                      <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">
                        Type
                      </th>
                      <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">
                        Vehicle
                      </th>
                      <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                        Scheduled
                      </th>
                      <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                        Due In
                      </th>
                      <th className="p-3 px-4 text-right font-semibold text-wl-text-secondary">
                        Cost
                      </th>
                      <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                        Vendor
                      </th>
                      <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMaintenance.map((item, idx) => {
                      const vehicle = vehicles.find((v) => v.id === item.vehicleId);
                      const daysUntil = getDaysUntil(item.scheduledDate);
                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            "border-b border-wl-border-subtle transition-colors hover:bg-wl-bg-overlay",
                            idx % 2 === 0 ? "bg-transparent" : "bg-wl-bg-overlay"
                          )}
                        >
                          <td className="p-3 px-4 text-wl-text-primary font-semibold capitalize">
                            {item.type.replace("-", " ")}
                          </td>
                          <td className="p-3 px-4 text-wl-text-secondary text-xs">
                            {vehicle?.make} {vehicle?.model}
                          </td>
                          <td className="p-3 px-4 text-center text-wl-text-secondary text-xs">
                            {formatDate(item.scheduledDate)}
                          </td>
                          <td className="p-3 px-4 text-center text-wl-text-secondary text-xs">
                            {item.status === "overdue" ? (
                              <span className="text-wl-danger-500 font-semibold">Overdue</span>
                            ) : item.status === "completed" ? (
                              <span className="text-wl-success-500 font-semibold">Done</span>
                            ) : daysUntil === 0 ? (
                              <span className="text-wl-warning-500 font-semibold">Today</span>
                            ) : daysUntil === 1 ? (
                              <span className="text-wl-warning-500 font-semibold">Tomorrow</span>
                            ) : (
                              `${daysUntil} days`
                            )}
                          </td>
                          <td className="p-3 px-4 text-right text-wl-text-primary font-medium">
                            {formatCurrency(item.actualCost || item.estimatedCost)}
                          </td>
                          <td className="p-3 px-4 text-center text-wl-text-secondary text-xs">
                            {item.vendor}
                          </td>
                          <td className="p-3 px-4 text-center">
                            <Badge variant={getStatusColor(item.status)}>
                              {item.status === "in-progress" ? "In Progress" : item.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t border-wl-border-subtle bg-wl-bg-overlay text-sm text-wl-text-secondary">
                <div>
                  Showing {paginatedMaintenance.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
                  {Math.min(currentPage * pageSize, filteredMaintenance.length)} of {filteredMaintenance.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="px-3 py-1 flex items-center">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </Card>
          </>
        ) : (
          <>
            {/* Calendar View */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
                      }
                    >
                      ← Prev
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setCurrentMonth(new Date())}>
                      Today
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
                      }
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {calendarMaintenance.length > 0 ? (
                    calendarMaintenance.map((item) => {
                      const vehicle = vehicles.find((v) => v.id === item.vehicleId);
                      return (
                        <div
                          key={item.id}
                          className="p-4 bg-wl-bg-overlay rounded-md border-l-4 border-wl-primary-500"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold text-wl-text-primary">
                                {item.type.replace("-", " ").toUpperCase()}
                              </p>
                              <p className="text-xs text-wl-text-secondary mt-1">
                                {vehicle?.make} {vehicle?.model}
                              </p>
                              <p className="text-xs text-wl-text-tertiary mt-1">{item.vendor}</p>
                            </div>
                            <div className="text-right">
                              <Badge variant={getStatusColor(item.status)}>
                                {item.status === "in-progress" ? "In Progress" : item.status}
                              </Badge>
                              <p className="text-sm font-semibold text-wl-text-primary mt-2">
                                {formatCurrency(item.actualCost || item.estimatedCost)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-wl-text-secondary text-center py-8">
                      No maintenance scheduled for this month
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Upcoming Maintenance Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Upcoming This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingMaintenance.length > 0 ? (
                upcomingMaintenance.map((item) => {
                  const vehicle = vehicles.find((v) => v.id === item.vehicleId);
                  const daysUntil = getDaysUntil(item.scheduledDate);
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-wl-bg-overlay rounded-md">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-wl-info-500 bg-opacity-10 flex items-center justify-center text-wl-info-500">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-wl-text-primary">
                            {item.type.replace("-", " ").toUpperCase()}
                          </p>
                          <p className="text-xs text-wl-text-secondary">
                            {vehicle?.make} {vehicle?.model} · {formatDate(item.scheduledDate)}
                          </p>
                        </div>
                      </div>
                      {daysUntil <= 3 && (
                        <Badge variant="warning">
                          <Clock className="w-3 h-3 mr-1" />
                          {daysUntil} days
                        </Badge>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-wl-text-secondary text-center py-4">
                  No maintenance scheduled for this week
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
