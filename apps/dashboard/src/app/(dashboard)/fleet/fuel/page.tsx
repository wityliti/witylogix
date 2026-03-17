"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import {
  Fuel,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  AlertCircle,
  Eye,
  Edit2,
  Lock,
  Unlock,
} from "lucide-react";
import {
  useFuelAnalytics,
  useFuelTransactions,
  useVehicles,
  useFleetCosts,
} from "@/hooks/use-fleet";

/* ═══════════════════════════════════════════════════════════
   FUEL PAGE — Fuel Analytics & Card Management
   ═══════════════════════════════════════════════════════════ */

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function FuelPage() {
  const [filterVehicleId, setFilterVehicleId] = useState<string | null>(null);
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "amount" | "mpg">("date");
  const [currentPage, setCurrentPage] = useState(1);

  const vehicles = useVehicles();
  const analytics = useFuelAnalytics();
  const costs = useFleetCosts();
  const transactions = useFuelTransactions({
    vehicleId: filterVehicleId || undefined,
    flaggedOnly: filterFlaggedOnly,
  });

  const pageSize = 10;

  // Sort transactions
  const sortedTransactions = useMemo(() => {
    const items = [...transactions];
    switch (sortBy) {
      case "amount":
        return items.sort((a, b) => b.amount - a.amount);
      case "mpg":
        return items.sort((a, b) => b.mpg - a.mpg);
      default:
        return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  }, [transactions, sortBy]);

  const paginatedTransactions = sortedTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(sortedTransactions.length / pageSize);

  return (
    <>
      <Header
        title="Fuel Management"
        subtitle={`${transactions.length} transactions • ${analytics.anomalies.length} anomalies detected`}
        actions={
          <Button variant="primary" size="md">
            Manage Fuel Cards
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <StatCard
            label="Total Fuel Spend"
            value={formatCurrency(analytics.totalSpend)}
            change={{ value: 8.5, label: "vs last month" }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Average MPG"
            value={`${analytics.avgMpg}`}
            change={{ value: -2.1, label: "efficiency decline" }}
            accentColor="var(--wl-warning-500)"
            index={1}
          />
          <StatCard
            label="Avg Price/Gallon"
            value={formatCurrency(analytics.pricePerGallon)}
            change={{ value: 3.2, label: "increase" }}
            accentColor="var(--wl-danger-400)"
            index={2}
          />
          <StatCard
            label="Idle Time"
            value={`${analytics.idleTimePercent}%`}
            change={{ value: -1.5, label: "improvement" }}
            accentColor="var(--wl-info-500)"
            index={3}
          />
        </div>

        {/* Anomaly Alerts */}
        {analytics.anomalies.length > 0 && (
          <Card className="border-wl-danger-500 border-2">
            <CardHeader>
              <CardTitle className="text-sm text-wl-danger-500">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                Fuel Anomalies Detected ({analytics.anomalies.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.anomalies.slice(0, 3).map((anomaly) => {
                  const vehicle = vehicles.find((v) => v.id === anomaly.vehicleId);
                  return (
                    <div
                      key={anomaly.id}
                      className="flex items-center justify-between p-3 bg-wl-danger-500 bg-opacity-10 rounded-md"
                    >
                      <div>
                        <p className="text-sm font-medium text-wl-text-primary">
                          {vehicle?.make} {vehicle?.model}
                        </p>
                        <p className="text-xs text-wl-text-secondary">
                          {formatCurrency(anomaly.amount)} • {anomaly.gallons.toFixed(1)} gal •{" "}
                          {formatDate(anomaly.date)}
                        </p>
                      </div>
                      <Button variant="danger" size="sm">
                        Review
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Consumers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Top Fuel Consumers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.topConsumers.map((item, idx) => {
                  const vehicle = vehicles.find((v) => v.id === item.vehicleId);
                  const maxSpend = analytics.topConsumers[0].spend;
                  const percentage = (item.spend / maxSpend) * 100;

                  return (
                    <div key={item.vehicleId}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-wl-text-primary">
                          {idx + 1}. {vehicle?.make} {vehicle?.model}
                        </p>
                        <p className="text-xs font-semibold text-wl-text-secondary">
                          {formatCurrency(item.spend)}
                        </p>
                      </div>
                      <div className="h-2 bg-wl-bg-overlay rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-wl-primary-500 to-wl-primary-600 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-wl-text-secondary mb-1">Fuel Spend</p>
                  <p className="text-lg font-bold text-wl-text-primary">
                    {formatCurrency(costs.fuelSpend)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-wl-text-secondary mb-1">Maintenance</p>
                  <p className="text-lg font-bold text-wl-text-primary">
                    {formatCurrency(costs.maintenanceSpend)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-wl-text-secondary mb-1">Insurance (Monthly)</p>
                  <p className="text-lg font-bold text-wl-text-primary">
                    {formatCurrency(costs.insuranceMonthly)}
                  </p>
                </div>
                <div className="border-t border-wl-border-subtle pt-3">
                  <p className="text-xs text-wl-text-secondary mb-1">Avg per Vehicle</p>
                  <p className="text-lg font-bold text-wl-primary-500">
                    {formatCurrency(costs.avgCostPerVehicle)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fuel Cards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Fuel Cards Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-wl-bg-overlay rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-wl-text-primary">Shell ****1234</p>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <p className="text-xs text-wl-text-secondary">
                    Daily: {formatCurrency(500)} • Monthly: {formatCurrency(10000)}
                  </p>
                </div>
                <div className="p-3 bg-wl-bg-overlay rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-wl-text-primary">Chevron ****5678</p>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <p className="text-xs text-wl-text-secondary">
                    Daily: {formatCurrency(600)} • Monthly: {formatCurrency(12000)}
                  </p>
                </div>
                <div className="p-3 bg-wl-bg-overlay rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-wl-text-primary">Shell ****9012</p>
                    <Badge variant="danger">Blocked</Badge>
                  </div>
                  <p className="text-xs text-wl-text-secondary">
                    Daily: {formatCurrency(300)} • Monthly: {formatCurrency(6000)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Filter */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-2 flex-wrap items-center">
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

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="p-2 px-3 bg-wl-bg-base border border-wl-border-default rounded-md text-wl-text-primary text-sm outline-none"
              >
                <option value="date">Sort by Date</option>
                <option value="amount">Sort by Amount</option>
                <option value="mpg">Sort by MPG</option>
              </select>

              {/* Anomaly Filter */}
              <button
                onClick={() => {
                  setFilterFlaggedOnly(!filterFlaggedOnly);
                  setCurrentPage(1);
                }}
                className={cn(
                  "p-2 px-3 rounded-md border text-xs font-semibold cursor-pointer transition-all",
                  filterFlaggedOnly
                    ? "bg-wl-danger-500 text-wl-text-inverse border-wl-danger-500"
                    : "bg-transparent text-wl-text-secondary border-wl-border-default hover:text-wl-text-primary"
                )}
              >
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />
                Anomalies Only
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-wl-border-subtle bg-wl-bg-overlay">
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">
                    Date
                  </th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">
                    Vehicle
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    Station
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    Gallons
                  </th>
                  <th className="p-3 px-4 text-right font-semibold text-wl-text-secondary">
                    Amount
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    Price/Gal
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    MPG
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((tx, idx) => {
                  const vehicle = vehicles.find((v) => v.id === tx.vehicleId);
                  return (
                    <tr
                      key={tx.id}
                      className={cn(
                        "border-b border-wl-border-subtle transition-colors hover:bg-wl-bg-overlay",
                        idx % 2 === 0 ? "bg-transparent" : "bg-wl-bg-overlay"
                      )}
                    >
                      <td className="p-3 px-4 text-wl-text-secondary text-xs">
                        {formatDate(tx.date)}
                      </td>
                      <td className="p-3 px-4 text-wl-text-primary font-semibold">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-wl-primary-500 bg-opacity-10 flex items-center justify-center text-wl-primary-500 text-xs">
                            <Fuel className="w-3 h-3" />
                          </div>
                          <div>
                            <p className="text-sm">
                              {vehicle?.year} {vehicle?.make} {vehicle?.model}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 px-4 text-center text-wl-text-secondary text-xs">
                        {tx.station}
                      </td>
                      <td className="p-3 px-4 text-center text-wl-text-primary font-medium">
                        {tx.gallons.toFixed(1)}
                      </td>
                      <td className="p-3 px-4 text-right text-wl-text-primary font-semibold">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="p-3 px-4 text-center text-wl-text-secondary text-xs">
                        {formatCurrency(tx.price)}
                      </td>
                      <td className="p-3 px-4 text-center">
                        <Badge variant={tx.mpg >= 20 ? "success" : tx.mpg >= 15 ? "warning" : "danger"}>
                          {tx.mpg.toFixed(1)}
                        </Badge>
                      </td>
                      <td className="p-3 px-4 text-center">
                        {tx.flagged ? (
                          <Badge variant="danger">Anomaly</Badge>
                        ) : (
                          <Badge variant="success">Normal</Badge>
                        )}
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
              Showing {paginatedTransactions.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(currentPage * pageSize, sortedTransactions.length)} of {sortedTransactions.length}
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
    </>
  );
}
