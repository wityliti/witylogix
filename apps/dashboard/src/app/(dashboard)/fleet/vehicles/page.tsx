"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Truck,
  Plus,
  ChevronRight,
  Gauge,
  AlertTriangle,
  Edit2,
  Eye,
} from "lucide-react";
import {
  useVehicles,
  useVehicleDetail,
  VEHICLE_TYPES,
  VEHICLE_STATUSES,
  FUEL_TYPES,
  type Vehicle,
} from "@/hooks/use-fleet";

/* ═══════════════════════════════════════════════════════════
   VEHICLES PAGE — Vehicle Inventory & Management
   ═══════════════════════════════════════════════════════════ */

const getStatusColor = (status: string): "default" | "success" | "warning" | "danger" | "info" | "primary" => {
  const map: Record<string, "default" | "success" | "warning" | "danger" | "info" | "primary"> = {
    active: "success",
    maintenance: "warning",
    retired: "danger",
    idle: "info",
  };
  return map[status] || "default";
};

const getHealthColor = (score: number): "default" | "success" | "warning" | "danger" | "info" | "primary" => {
  if (score >= 90) return "success";
  if (score >= 75) return "warning";
  return "danger";
};

const formatMileage = (mileage: number): string => {
  return new Intl.NumberFormat("en-US").format(mileage);
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

interface VehicleDrawerProps {
  vehicle: Vehicle;
  onClose: () => void;
}

function VehicleDetailDrawer({ vehicle, onClose }: VehicleDrawerProps) {
  const [activeTab, setActiveTab] = useState<"specs" | "history" | "maintenance" | "costs">("specs");

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div
        className="flex-1 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="w-full max-w-lg bg-wl-bg-base border-l border-wl-border-subtle overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-wl-bg-base border-b border-wl-border-subtle p-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-wl-text-primary">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h2>
            <p className="text-sm text-wl-text-secondary">{vehicle.licensePlate}</p>
          </div>
          <button
            onClick={onClose}
            className="text-wl-text-tertiary hover:text-wl-text-primary transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-wl-border-subtle px-6">
          <div className="flex gap-0">
            {(["specs", "history", "maintenance", "costs"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-3 text-xs font-semibold border-b-2 transition-colors",
                  activeTab === tab
                    ? "border-wl-primary-500 text-wl-primary-500"
                    : "border-transparent text-wl-text-secondary hover:text-wl-text-primary"
                )}
              >
                {tab === "specs" && "Specifications"}
                {tab === "history" && "Assignment History"}
                {tab === "maintenance" && "Maintenance"}
                {tab === "costs" && "Cost Breakdown"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-6">
          {activeTab === "specs" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-wl-text-tertiary">VIN</p>
                  <p className="text-sm font-medium text-wl-text-primary font-mono">{vehicle.vin}</p>
                </div>
                <div>
                  <p className="text-xs text-wl-text-tertiary">License Plate</p>
                  <p className="text-sm font-medium text-wl-text-primary">{vehicle.licensePlate}</p>
                </div>
                <div>
                  <p className="text-xs text-wl-text-tertiary">Type</p>
                  <p className="text-sm font-medium text-wl-text-primary capitalize">{vehicle.type}</p>
                </div>
                <div>
                  <p className="text-xs text-wl-text-tertiary">Fuel Type</p>
                  <p className="text-sm font-medium text-wl-text-primary capitalize">{vehicle.fuelType}</p>
                </div>
                <div>
                  <p className="text-xs text-wl-text-tertiary">Mileage</p>
                  <p className="text-sm font-medium text-wl-text-primary">{formatMileage(vehicle.mileage)} mi</p>
                </div>
                <div>
                  <p className="text-xs text-wl-text-tertiary">Health Score</p>
                  <Badge variant={getHealthColor(vehicle.healthScore)}>
                    {vehicle.healthScore}/100
                  </Badge>
                </div>
              </div>

              <div className="border-t border-wl-border-subtle pt-4">
                <p className="text-xs font-semibold text-wl-text-secondary mb-3">Registration & Insurance</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-wl-text-tertiary">Registration Expires</p>
                    <p className="text-sm font-medium text-wl-text-primary">{vehicle.registrationExpiry}</p>
                  </div>
                  <div>
                    <p className="text-xs text-wl-text-tertiary">Insurance Expires</p>
                    <p className="text-sm font-medium text-wl-text-primary">{vehicle.insuranceExpiry}</p>
                  </div>
                  <div>
                    <p className="text-xs text-wl-text-tertiary">Insurance Provider</p>
                    <p className="text-sm font-medium text-wl-text-primary">{vehicle.insuranceProvider}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-3">
              {vehicle.assignedDriver ? (
                <div className="p-3 bg-wl-bg-overlay rounded-md">
                  <p className="text-xs text-wl-text-tertiary mb-1">Currently Assigned</p>
                  <p className="text-sm font-semibold text-wl-text-primary">{vehicle.assignedDriver}</p>
                </div>
              ) : (
                <div className="p-3 bg-wl-bg-overlay rounded-md text-wl-text-secondary text-sm">
                  Not currently assigned to any driver
                </div>
              )}
            </div>
          )}

          {activeTab === "maintenance" && (
            <div className="space-y-3">
              <div className="p-3 bg-wl-bg-overlay rounded-md">
                <p className="text-xs text-wl-text-tertiary mb-1">Last Maintenance</p>
                <p className="text-sm font-medium text-wl-text-primary">{vehicle.lastMaintenanceDate}</p>
              </div>
              <div className="p-3 bg-wl-bg-overlay rounded-md">
                <p className="text-xs text-wl-text-tertiary mb-1">Next Scheduled</p>
                <p className="text-sm font-medium text-wl-text-primary">{vehicle.nextMaintenanceDate}</p>
              </div>
            </div>
          )}

          {activeTab === "costs" && (
            <div className="space-y-3">
              <div className="p-3 bg-wl-bg-overlay rounded-md">
                <p className="text-xs text-wl-text-tertiary mb-1">Purchase Price</p>
                <p className="text-sm font-semibold text-wl-text-primary">
                  {formatCurrency(vehicle.purchasePrice)}
                </p>
              </div>
              <div className="p-3 bg-wl-bg-overlay rounded-md">
                <p className="text-xs text-wl-text-tertiary mb-1">Purchased</p>
                <p className="text-sm font-medium text-wl-text-primary">{vehicle.purchaseDate}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-wl-border-subtle p-4 flex gap-2">
          <Button variant="secondary" className="flex-1">
            Edit Vehicle
          </Button>
          <Button variant="primary" className="flex-1">
            Schedule Maintenance
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function VehiclesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [fuelTypeFilter, setFuelTypeFilter] = useState<string | null>(null);
  const [ageRangeFilter, setAgeRangeFilter] = useState<[number, number] | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "health" | "mileage">("name");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const pageSize = 10;

  // Get vehicles with filters
  const allVehicles = useVehicles({
    search: searchQuery,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    fuelType: fuelTypeFilter || undefined,
    ageRange: ageRangeFilter || undefined,
  });

  // Sort vehicles
  const sortedVehicles = useMemo(() => {
    const items = [...allVehicles];
    switch (sortBy) {
      case "health":
        return items.sort((a, b) => b.healthScore - a.healthScore);
      case "mileage":
        return items.sort((a, b) => b.mileage - a.mileage);
      default:
        return items.sort((a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`));
    }
  }, [allVehicles, sortBy]);

  const paginatedVehicles = sortedVehicles.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(sortedVehicles.length / pageSize);

  const selectedVehicle = selectedVehicleId
    ? useVehicleDetail(selectedVehicleId)
    : null;

  return (
    <>
      <Header
        title="Vehicle Inventory"
        subtitle={`${sortedVehicles.length} vehicles • ${sortedVehicles.filter((v) => v.status === "active").length} active`}
        actions={
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4 mr-2" />
            Add Vehicle
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Filters Bar */}
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-4">
              {/* Search */}
              <input
                type="text"
                placeholder="Search by make, model, VIN, or license plate..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full p-2 px-4 bg-wl-bg-base border border-wl-border-default rounded-md text-wl-text-primary text-sm outline-none"
              />

              {/* Filter Pills */}
              <div className="flex gap-2 flex-wrap">
                {/* Type Filter */}
                <select
                  value={typeFilter || ""}
                  onChange={(e) => {
                    setTypeFilter(e.target.value || null);
                    setCurrentPage(1);
                  }}
                  className="p-2 px-3 bg-wl-bg-base border border-wl-border-default rounded-md text-wl-text-primary text-sm outline-none"
                >
                  <option value="">All Types</option>
                  {VEHICLE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter || ""}
                  onChange={(e) => {
                    setStatusFilter(e.target.value || null);
                    setCurrentPage(1);
                  }}
                  className="p-2 px-3 bg-wl-bg-base border border-wl-border-default rounded-md text-wl-text-primary text-sm outline-none"
                >
                  <option value="">All Statuses</option>
                  {VEHICLE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>

                {/* Fuel Type Filter */}
                <select
                  value={fuelTypeFilter || ""}
                  onChange={(e) => {
                    setFuelTypeFilter(e.target.value || null);
                    setCurrentPage(1);
                  }}
                  className="p-2 px-3 bg-wl-bg-base border border-wl-border-default rounded-md text-wl-text-primary text-sm outline-none"
                >
                  <option value="">All Fuels</option>
                  {FUEL_TYPES.map((fuel) => (
                    <option key={fuel} value={fuel}>
                      {fuel.charAt(0).toUpperCase() + fuel.slice(1)}
                    </option>
                  ))}
                </select>

                {/* Age Range Filter */}
                <select
                  value={ageRangeFilter ? `${ageRangeFilter[0]}-${ageRangeFilter[1]}` : ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [min, max] = e.target.value.split("-").map(Number);
                      setAgeRangeFilter([min, max]);
                    } else {
                      setAgeRangeFilter(null);
                    }
                    setCurrentPage(1);
                  }}
                  className="p-2 px-3 bg-wl-bg-base border border-wl-border-default rounded-md text-wl-text-primary text-sm outline-none"
                >
                  <option value="">All Ages</option>
                  <option value="0-2">0-2 years</option>
                  <option value="2-5">2-5 years</option>
                  <option value="5-10">5-10 years</option>
                  <option value="10-20">10+ years</option>
                </select>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="p-2 px-3 bg-wl-bg-base border border-wl-border-default rounded-md text-wl-text-primary text-sm outline-none"
                >
                  <option value="name">Sort by Name</option>
                  <option value="health">Sort by Health Score</option>
                  <option value="mileage">Sort by Mileage</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehicles Table */}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-wl-border-subtle bg-wl-bg-overlay">
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">
                    Vehicle
                  </th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">
                    VIN
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    Mileage
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    Driver
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    Health
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    Status
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedVehicles.map((vehicle, idx) => (
                  <tr
                    key={vehicle.id}
                    className={cn(
                      "border-b border-wl-border-subtle transition-colors hover:bg-wl-bg-overlay",
                      idx % 2 === 0 ? "bg-transparent" : "bg-wl-bg-overlay"
                    )}
                  >
                    <td className="p-3 px-4 text-wl-text-primary font-semibold">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-md bg-wl-primary-500 bg-opacity-10 flex items-center justify-center text-wl-primary-500">
                          <Truck className="w-4 h-4" />
                        </div>
                        <div>
                          <p>
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </p>
                          <p className="text-xs text-wl-text-tertiary">{vehicle.licensePlate}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 px-4 text-wl-text-tertiary text-xs font-mono">
                      {vehicle.vin.slice(-8)}
                    </td>
                    <td className="p-3 px-4 text-center text-wl-text-primary font-medium">
                      {formatMileage(vehicle.mileage)}
                    </td>
                    <td className="p-3 px-4 text-center text-wl-text-secondary text-xs">
                      {vehicle.assignedDriver || "—"}
                    </td>
                    <td className="p-3 px-4 text-center">
                      <Badge variant={getHealthColor(vehicle.healthScore)}>
                        {vehicle.healthScore}
                      </Badge>
                    </td>
                    <td className="p-3 px-4 text-center">
                      <Badge variant={getStatusColor(vehicle.status)}>
                        {vehicle.status}
                      </Badge>
                    </td>
                    <td className="p-3 px-4 text-center">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => setSelectedVehicleId(vehicle.id)}
                          className="p-1.5 hover:bg-wl-bg-overlay rounded-md transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-wl-text-secondary" />
                        </button>
                        <button
                          className="p-1.5 hover:bg-wl-bg-overlay rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4 text-wl-text-secondary" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t border-wl-border-subtle bg-wl-bg-overlay text-sm text-wl-text-secondary">
            <div>
              Showing {paginatedVehicles.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(currentPage * pageSize, sortedVehicles.length)} of {sortedVehicles.length}
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
      </div>

      {/* Vehicle Detail Drawer */}
      {selectedVehicle && (
        <VehicleDetailDrawer
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicleId(null)}
        />
      )}
    </>
  );
}
