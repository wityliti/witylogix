"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  ArrowUpDown,
  AlertTriangle,
  TrendingUp,
  Fuel,
  Calendar,
  MapPin,
} from "lucide-react";

interface FuelTransaction {
  id: string;
  date: Date;
  driver: string;
  vehicle: string;
  station: string;
  location: string;
  gallons: number;
  unitPrice: number;
  totalCost: number;
  cardUsed: string;
  mileage: number;
  isFraudAlert?: boolean;
  fraudReason?: string;
}

interface FuelTransactionLogProps {
  transactions?: FuelTransaction[];
  onExport?: (data: FuelTransaction[]) => void;
  className?: string;
}

type SortField = "date" | "cost" | "gallons" | "driver";
type SortDirection = "asc" | "desc";

const defaultTransactions: FuelTransaction[] = [
  {
    id: "txn-001",
    date: new Date("2025-03-12"),
    driver: "James Smith",
    vehicle: "TR-2401",
    station: "Shell - Chicago",
    location: "Chicago, IL",
    gallons: 45.3,
    unitPrice: 3.25,
    totalCost: 147.23,
    cardUsed: "****4521",
    mileage: 285000,
  },
  {
    id: "txn-002",
    date: new Date("2025-03-11"),
    driver: "Maria Garcia",
    vehicle: "TR-2405",
    station: "Pilot Flying J",
    location: "Indianapolis, IN",
    gallons: 52.0,
    unitPrice: 3.18,
    totalCost: 165.36,
    cardUsed: "****3890",
    mileage: 156200,
    isFraudAlert: true,
    fraudReason: "Unusual location for this driver",
  },
  {
    id: "txn-003",
    date: new Date("2025-03-10"),
    driver: "Robert Wilson",
    vehicle: "TR-2312",
    station: "BP - Detroit",
    location: "Detroit, MI",
    gallons: 48.5,
    unitPrice: 3.31,
    totalCost: 160.54,
    cardUsed: "****5678",
    mileage: 312450,
  },
  {
    id: "txn-004",
    date: new Date("2025-03-10"),
    driver: "James Smith",
    vehicle: "TR-2401",
    station: "Speedway",
    location: "Cincinnati, OH",
    gallons: 75.2,
    unitPrice: 3.22,
    totalCost: 242.14,
    cardUsed: "****4521",
    mileage: 285120,
    isFraudAlert: true,
    fraudReason: "Unusually high amount for fuel",
  },
  {
    id: "txn-005",
    date: new Date("2025-03-09"),
    driver: "Maria Garcia",
    vehicle: "TR-2405",
    station: "Sunoco",
    location: "Columbus, OH",
    gallons: 43.8,
    unitPrice: 3.19,
    totalCost: 139.72,
    cardUsed: "****3890",
    mileage: 156340,
  },
];

export function FuelTransactionLog({
  transactions = defaultTransactions,
  onExport,
  className,
}: FuelTransactionLogProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");

  // Sorting and filtering
  const sortedTransactions = useMemo(() => {
    let sorted = [...transactions];

    // Filter by date range
    if (dateRangeStart || dateRangeEnd) {
      sorted = sorted.filter((txn) => {
        const txnDate = txn.date.getTime();
        if (dateRangeStart) {
          const start = new Date(dateRangeStart).getTime();
          if (txnDate < start) return false;
        }
        if (dateRangeEnd) {
          const end = new Date(dateRangeEnd).getTime();
          if (txnDate > end) return false;
        }
        return true;
      });
    }

    // Sort
    sorted.sort((a, b) => {
      let aVal: number | string = "";
      let bVal: number | string = "";

      switch (sortField) {
        case "date":
          aVal = a.date.getTime();
          bVal = b.date.getTime();
          break;
        case "cost":
          aVal = a.totalCost;
          bVal = b.totalCost;
          break;
        case "gallons":
          aVal = a.gallons;
          bVal = b.gallons;
          break;
        case "driver":
          aVal = a.driver;
          bVal = b.driver;
          break;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      return sortDirection === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    return sorted;
  }, [transactions, sortField, sortDirection, dateRangeStart, dateRangeEnd]);

  // Calculations
  const totals = useMemo(() => {
    return {
      totalCost: sortedTransactions.reduce((sum, t) => sum + t.totalCost, 0),
      totalGallons: sortedTransactions.reduce((sum, t) => sum + t.gallons, 0),
      avgMpg:
        sortedTransactions.length > 0
          ? (
              sortedTransactions.reduce(
                (sum, t) => sum + t.mileage / t.gallons,
                0,
              ) / sortedTransactions.length
            ).toFixed(2)
          : "0.00",
      fraudCount: sortedTransactions.filter((t) => t.isFraudAlert).length,
    };
  }, [sortedTransactions]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleExport = () => {
    onExport?.(sortedTransactions);

    // Generate CSV
    const headers = [
      "Date",
      "Driver",
      "Vehicle",
      "Station",
      "Gallons",
      "Cost",
      "Card",
      "Fraud Alert",
    ];
    const rows = sortedTransactions.map((t) => [
      t.date.toLocaleDateString(),
      t.driver,
      t.vehicle,
      t.station,
      t.gallons.toFixed(2),
      `$${t.totalCost.toFixed(2)}`,
      t.cardUsed,
      t.isFraudAlert ? "⚠️" : "✓",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fuel-transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-wl-bg-surface border border-wl-border-subtle rounded-lg overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-wl-border-subtle bg-wl-bg-overlay">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-wl-text-primary flex items-center gap-2">
              <Fuel className="w-5 h-5 text-wl-primary-500" />
              Fuel Transaction Log
            </h3>
            <p className="text-xs text-wl-text-secondary mt-1">
              {sortedTransactions.length} transactions
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-wl-border-subtle bg-wl-bg-overlay flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs text-wl-text-secondary block mb-2">
            From Date
          </label>
          <input
            type="date"
            value={dateRangeStart}
            onChange={(e) => setDateRangeStart(e.target.value)}
            className="w-full px-3 py-2 bg-wl-bg-surface border border-wl-border-subtle rounded text-sm text-wl-text-primary focus:outline-none focus:border-wl-primary-500"
          />
        </div>

        <div className="flex-1">
          <label className="text-xs text-wl-text-secondary block mb-2">
            To Date
          </label>
          <input
            type="date"
            value={dateRangeEnd}
            onChange={(e) => setDateRangeEnd(e.target.value)}
            className="w-full px-3 py-2 bg-wl-bg-surface border border-wl-border-subtle rounded text-sm text-wl-text-primary focus:outline-none focus:border-wl-primary-500"
          />
        </div>

        {(dateRangeStart || dateRangeEnd) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateRangeStart("");
              setDateRangeEnd("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 p-4 border-b border-wl-border-subtle bg-wl-bg-overlay">
        <div className="p-3 bg-wl-bg-surface rounded-lg">
          <p className="text-xs text-wl-text-secondary mb-1">Total Cost</p>
          <p className="text-lg font-bold text-wl-text-primary">
            $
            {totals.totalCost.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="p-3 bg-wl-bg-surface rounded-lg">
          <p className="text-xs text-wl-text-secondary mb-1">Total Gallons</p>
          <p className="text-lg font-bold text-wl-text-primary">
            {totals.totalGallons.toLocaleString("en-US", {
              maximumFractionDigits: 1,
            })}
          </p>
        </div>

        <div className="p-3 bg-wl-bg-surface rounded-lg">
          <p className="text-xs text-wl-text-secondary mb-1">Avg MPG</p>
          <p className="text-lg font-bold text-wl-success-400">
            {totals.avgMpg}
          </p>
        </div>

        <div className="p-3 bg-wl-bg-surface rounded-lg">
          <p className="text-xs text-wl-text-secondary mb-1">Fraud Alerts</p>
          <p className="text-lg font-bold text-wl-danger-400">
            {totals.fraudCount}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-wl-border-subtle bg-wl-bg-overlay">
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort("date")}
                  className="flex items-center gap-1 text-xs font-semibold text-wl-text-secondary hover:text-wl-text-primary transition-colors"
                >
                  Date
                  {sortField === "date" && <ArrowUpDown className="w-3 h-3" />}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort("driver")}
                  className="flex items-center gap-1 text-xs font-semibold text-wl-text-secondary hover:text-wl-text-primary transition-colors"
                >
                  Driver
                  {sortField === "driver" && (
                    <ArrowUpDown className="w-3 h-3" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-wl-text-secondary">
                Vehicle
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-wl-text-secondary">
                Station
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort("gallons")}
                  className="flex items-center gap-1 text-xs font-semibold text-wl-text-secondary hover:text-wl-text-primary transition-colors"
                >
                  Gallons
                  {sortField === "gallons" && (
                    <ArrowUpDown className="w-3 h-3" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort("cost")}
                  className="flex items-center gap-1 text-xs font-semibold text-wl-text-secondary hover:text-wl-text-primary transition-colors"
                >
                  Cost
                  {sortField === "cost" && <ArrowUpDown className="w-3 h-3" />}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-wl-text-secondary">
                Card
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-wl-text-secondary">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedTransactions.map((txn, idx) => (
              <tr
                key={txn.id}
                className={cn(
                  "border-b border-wl-border-subtle hover:bg-wl-bg-overlay/50 transition-colors",
                  txn.isFraudAlert && "bg-wl-danger-bg/10",
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-wl-text-secondary" />
                    <span className="text-sm text-wl-text-primary font-medium">
                      {txn.date.toLocaleDateString()}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-wl-text-primary">
                  {txn.driver}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="default">{txn.vehicle}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-wl-text-secondary flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-wl-text-primary">
                      {txn.station}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-wl-text-primary">
                  {txn.gallons.toFixed(1)} gal
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-wl-text-primary">
                  ${txn.totalCost.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm text-wl-text-secondary font-mono">
                  {txn.cardUsed}
                </td>
                <td className="px-4 py-3">
                  {txn.isFraudAlert ? (
                    <Badge
                      variant="danger"
                      dot
                      className="flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      Alert
                    </Badge>
                  ) : (
                    <Badge variant="success" dot>
                      Normal
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {sortedTransactions.length === 0 && (
        <div className="p-8 text-center text-wl-text-secondary">
          <p>No transactions found for the selected date range.</p>
        </div>
      )}
    </div>
  );
}
