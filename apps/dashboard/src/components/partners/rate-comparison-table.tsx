"use client";

import { useState, forwardRef, useMemo, type HTMLAttributes } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type SortField =
  | "courier"
  | "baseRate"
  | "perKm"
  | "perKg"
  | "minCharge"
  | "estTime"
  | "coverage"
  | "rating";
type SortOrder = "asc" | "desc";

interface RateComparisonItem {
  id: string;
  courierName: string;
  baseRate: number;
  perKmRate: number;
  perKgRate: number;
  minCharge: number;
  estimatedTime: string; // e.g., "2-4 hours"
  coverage: string[]; // e.g., ["Delhi", "NCR"]
  rating: number; // 0-5
}

interface RateComparisonTableProps extends HTMLAttributes<HTMLDivElement> {
  items: RateComparisonItem[];
  isLoading?: boolean;
}

const RateComparisonTable = forwardRef<
  HTMLDivElement,
  RateComparisonTableProps
>(({ items, isLoading = false, className, ...props }, ref) => {
  const [sortField, setSortField] = useState<SortField>("baseRate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "courier":
          aValue = a.courierName.toLowerCase();
          bValue = b.courierName.toLowerCase();
          break;
        case "baseRate":
          aValue = a.baseRate;
          bValue = b.baseRate;
          break;
        case "perKm":
          aValue = a.perKmRate;
          bValue = b.perKmRate;
          break;
        case "perKg":
          aValue = a.perKgRate;
          bValue = b.perKgRate;
          break;
        case "minCharge":
          aValue = a.minCharge;
          bValue = b.minCharge;
          break;
        case "estTime":
          aValue = parseInt(a.estimatedTime);
          bValue = parseInt(b.estimatedTime);
          break;
        case "coverage":
          aValue = a.coverage.length;
          bValue = b.coverage.length;
          break;
        case "rating":
          aValue = a.rating;
          bValue = b.rating;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortOrder === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortOrder === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [items, sortField, sortOrder]);

  // Find best values for highlighting
  const getBestValue = (field: SortField): number | string | null => {
    if (items.length === 0) return null;

    switch (field) {
      case "baseRate":
        return Math.min(...items.map((i) => i.baseRate));
      case "perKm":
        return Math.min(...items.map((i) => i.perKmRate));
      case "perKg":
        return Math.min(...items.map((i) => i.perKgRate));
      case "minCharge":
        return Math.min(...items.map((i) => i.minCharge));
      case "estTime":
        return Math.min(...items.map((i) => parseInt(i.estimatedTime)));
      case "coverage":
        return Math.max(...items.map((i) => i.coverage.length));
      case "rating":
        return Math.max(...items.map((i) => i.rating));
      default:
        return null;
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-wl-text-secondary" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 text-wl-primary-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-wl-primary-400" />
    );
  };

  const SortHeader = ({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-wl-text-primary transition-colors whitespace-nowrap"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
        {label}
      </span>
      <SortIcon field={field} />
    </button>
  );

  const isBestValue = (field: SortField, value: any): boolean => {
    const best = getBestValue(field);
    if (best === null) return false;

    switch (field) {
      case "baseRate":
      case "perKm":
      case "perKg":
      case "minCharge":
        return value === best;
      case "estTime":
        return parseInt(value) === best;
      case "coverage":
        return value === best;
      case "rating":
        return value === best;
      default:
        return false;
    }
  };

  return (
    <Card ref={ref} className={className} {...props}>
      <CardHeader>
        <CardTitle>Rate Comparison</CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-wl-bg-surface rounded animate-pulse"
              />
            ))}
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-wl-text-secondary">
              No comparison data available
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-wl-border-subtle">
                  <th className="px-4 py-3 text-left min-w-max">
                    <SortHeader field="courier" label="Courier" />
                  </th>
                  <th className="px-4 py-3 text-right min-w-max">
                    <SortHeader field="baseRate" label="Base Rate" />
                  </th>
                  <th className="px-4 py-3 text-right min-w-max">
                    <SortHeader field="perKm" label="Per KM" />
                  </th>
                  <th className="px-4 py-3 text-right min-w-max">
                    <SortHeader field="perKg" label="Per KG" />
                  </th>
                  <th className="px-4 py-3 text-right min-w-max">
                    <SortHeader field="minCharge" label="Min Charge" />
                  </th>
                  <th className="px-4 py-3 text-right min-w-max">
                    <SortHeader field="estTime" label="Est. Time" />
                  </th>
                  <th className="px-4 py-3 text-right min-w-max">
                    <SortHeader field="coverage" label="Coverage" />
                  </th>
                  <th className="px-4 py-3 text-right min-w-max">
                    <SortHeader field="rating" label="Rating" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wl-border-subtle">
                {sortedItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-wl-bg-surface/50 transition-colors"
                  >
                    <td className="px-4 py-4 font-semibold text-wl-text-primary whitespace-nowrap">
                      {item.courierName}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-4 text-right font-medium",
                        isBestValue("baseRate", item.baseRate)
                          ? "text-wl-success-400 bg-wl-success-500/10"
                          : "text-wl-text-primary",
                      )}
                    >
                      ${item.baseRate.toFixed(2)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-4 text-right font-medium",
                        isBestValue("perKm", item.perKmRate)
                          ? "text-wl-success-400 bg-wl-success-500/10"
                          : "text-wl-text-primary",
                      )}
                    >
                      ${item.perKmRate.toFixed(2)}/km
                    </td>
                    <td
                      className={cn(
                        "px-4 py-4 text-right font-medium",
                        isBestValue("perKg", item.perKgRate)
                          ? "text-wl-success-400 bg-wl-success-500/10"
                          : "text-wl-text-primary",
                      )}
                    >
                      ${item.perKgRate.toFixed(2)}/kg
                    </td>
                    <td
                      className={cn(
                        "px-4 py-4 text-right font-medium",
                        isBestValue("minCharge", item.minCharge)
                          ? "text-wl-success-400 bg-wl-success-500/10"
                          : "text-wl-text-primary",
                      )}
                    >
                      ${item.minCharge.toFixed(2)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-4 text-right font-medium",
                        isBestValue("estTime", item.estimatedTime)
                          ? "text-wl-success-400 bg-wl-success-500/10"
                          : "text-wl-text-primary",
                      )}
                    >
                      {item.estimatedTime}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-4 text-right font-medium",
                        isBestValue("coverage", item.coverage.length)
                          ? "text-wl-success-400 bg-wl-success-500/10"
                          : "text-wl-text-primary",
                      )}
                    >
                      {item.coverage.length} areas
                    </td>
                    <td
                      className={cn(
                        "px-4 py-4 text-right font-medium",
                        isBestValue("rating", item.rating)
                          ? "text-wl-success-400 bg-wl-success-500/10"
                          : "text-wl-text-primary",
                      )}
                    >
                      {item.rating.toFixed(1)}★
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

RateComparisonTable.displayName = "RateComparisonTable";

export { RateComparisonTable };
export type { RateComparisonTableProps, RateComparisonItem };
