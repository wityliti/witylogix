"use client";

import { useState, forwardRef, type HTMLAttributes } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type SortField =
  | "name"
  | "baseRate"
  | "perKmRate"
  | "surcharge"
  | "minCharge"
  | "estimatedTime";
type SortOrder = "asc" | "desc";

interface RateItem {
  id: string;
  courierName: string;
  baseRate: number;
  perKmRate: number;
  surcharge: number;
  minCharge: number;
  estimatedDeliveryTime: string;
}

interface CourierRateTableProps extends HTMLAttributes<HTMLDivElement> {
  rates: RateItem[];
  isLoading?: boolean;
}

const CourierRateTable = forwardRef<HTMLDivElement, CourierRateTableProps>(
  ({ rates, isLoading = false, className, ...props }, ref) => {
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

    const sortedRates = [...rates].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "name":
          aValue = a.courierName;
          bValue = b.courierName;
          break;
        case "baseRate":
          aValue = a.baseRate;
          bValue = b.baseRate;
          break;
        case "perKmRate":
          aValue = a.perKmRate;
          bValue = b.perKmRate;
          break;
        case "surcharge":
          aValue = a.surcharge;
          bValue = b.surcharge;
          break;
        case "minCharge":
          aValue = a.minCharge;
          bValue = b.minCharge;
          break;
        case "estimatedTime":
          aValue = parseInt(a.estimatedDeliveryTime);
          bValue = parseInt(b.estimatedDeliveryTime);
          break;
        default:
          return 0;
      }

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) {
        return sortOrder === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortOrder === "asc" ? 1 : -1;
      }
      return 0;
    });

    const SortIcon = ({ field }: { field: SortField }) => {
      if (sortField !== field) {
        return <ArrowUpDown className="w-4 h-4 text-wl-text-secondary" />;
      }
      return sortOrder === "asc" ? (
        <ArrowUp className="w-4 h-4 text-wl-primary-400" />
      ) : (
        <ArrowDown className="w-4 h-4 text-wl-primary-400" />
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
        className="flex items-center gap-2 hover:text-wl-text-primary transition-colors"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
          {label}
        </span>
        <SortIcon field={field} />
      </button>
    );

    return (
      <Card ref={ref} className={className} {...props}>
        <CardHeader>
          <CardTitle>Courier Rate Comparison</CardTitle>
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
          ) : sortedRates.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-wl-text-secondary">
                No rates available
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-wl-border-subtle">
                    <th className="px-4 py-3 text-left">
                      <SortHeader field="name" label="Courier" />
                    </th>
                    <th className="px-4 py-3 text-right">
                      <SortHeader field="baseRate" label="Base Rate" />
                    </th>
                    <th className="px-4 py-3 text-right">
                      <SortHeader field="perKmRate" label="Per KM" />
                    </th>
                    <th className="px-4 py-3 text-right">
                      <SortHeader field="surcharge" label="Surcharge" />
                    </th>
                    <th className="px-4 py-3 text-right">
                      <SortHeader field="minCharge" label="Min Charge" />
                    </th>
                    <th className="px-4 py-3 text-right">
                      <SortHeader field="estimatedTime" label="Est. Time" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wl-border-subtle">
                  {sortedRates.map((rate) => (
                    <tr
                      key={rate.id}
                      className="hover:bg-wl-bg-surface/50 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <span className="font-semibold text-wl-text-primary">
                          {rate.courierName}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-wl-text-primary">
                        ${rate.baseRate.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-right text-wl-text-primary">
                        ${rate.perKmRate.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-right text-wl-text-primary">
                        ${rate.surcharge.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-right text-wl-text-primary">
                        ${rate.minCharge.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="inline-flex items-center px-2.5 py-1 rounded bg-wl-info-500/20 text-wl-info-400 text-xs font-medium">
                          {rate.estimatedDeliveryTime}
                        </span>
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
  },
);

CourierRateTable.displayName = "CourierRateTable";

export { CourierRateTable };
export type { CourierRateTableProps, RateItem };
