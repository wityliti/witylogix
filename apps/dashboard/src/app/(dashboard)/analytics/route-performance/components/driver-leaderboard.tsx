"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ChevronUp,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import type { DriverLeaderboardProps } from "@witylogix/core/analytics";

type SortKey =
  | "compositeScore"
  | "onTimePercentage"
  | "deliveriesCompleted"
  | "customerRatingAvg";

/**
 * Driver Leaderboard Component
 *
 * Sortable table showing driver performance metrics ranked by composite score,
 * on-time percentage, deliveries, and customer rating.
 */
export function DriverLeaderboard({
  data,
  dateRange,
  period,
  onPeriodChange,
  onDriverSelect,
  isLoading,
}: DriverLeaderboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>("compositeScore");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      let aValue = a[sortKey];
      let bValue = b[sortKey];

      // Handle number sorting
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
      }

      return 0;
    });

    return sorted.map((driver, index) => ({
      ...driver,
      rank: index + 1,
    }));
  }, [data, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({
    isActive,
    direction,
  }: {
    isActive: boolean;
    direction: "asc" | "desc";
  }) => {
    if (!isActive) return null;
    return direction === "desc" ? (
      <ChevronDown className="w-4 h-4 ml-1 inline" />
    ) : (
      <ChevronUp className="w-4 h-4 ml-1 inline" />
    );
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Top Drivers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center text-wl-text-secondary">
            Loading leaderboard...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Top Drivers</CardTitle>
          <div className="flex gap-2">
            {["24h", "7d", "30d"].map((p) => (
              <button
                key={p}
                onClick={() => onPeriodChange?.(p as any)}
                className={cn(
                  "px-3 py-1 text-sm rounded-md transition-colors",
                  period === p
                    ? "bg-wl-primary-500 text-white"
                    : "bg-wl-bg-secondary text-wl-text-secondary hover:text-wl-text-primary border border-wl-neutral-800",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-wl-neutral-800">
                <th className="text-left py-3 px-4 text-sm font-semibold text-wl-text-secondary">
                  Rank
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-wl-text-secondary">
                  Driver
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-semibold text-wl-text-secondary cursor-pointer hover:text-wl-text-primary transition-colors"
                  onClick={() => handleSort("deliveriesCompleted")}
                >
                  Deliveries
                  <SortIcon
                    isActive={sortKey === "deliveriesCompleted"}
                    direction={sortDirection}
                  />
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-semibold text-wl-text-secondary cursor-pointer hover:text-wl-text-primary transition-colors"
                  onClick={() => handleSort("onTimePercentage")}
                >
                  On-Time %
                  <SortIcon
                    isActive={sortKey === "onTimePercentage"}
                    direction={sortDirection}
                  />
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-semibold text-wl-text-secondary cursor-pointer hover:text-wl-text-primary transition-colors"
                  onClick={() => handleSort("customerRatingAvg")}
                >
                  Avg Rating
                  <SortIcon
                    isActive={sortKey === "customerRatingAvg"}
                    direction={sortDirection}
                  />
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-semibold text-wl-text-secondary cursor-pointer hover:text-wl-text-primary transition-colors"
                  onClick={() => handleSort("compositeScore")}
                >
                  Score
                  <SortIcon
                    isActive={sortKey === "compositeScore"}
                    direction={sortDirection}
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-wl-text-secondary">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((driver, index) => (
                <tr
                  key={driver.driverId}
                  className="border-b border-wl-neutral-800 hover:bg-wl-bg-secondary transition-colors cursor-pointer"
                  onClick={() => onDriverSelect?.(driver.driverId)}
                >
                  {/* Rank */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {index < 3 ? (
                        <Badge
                          variant={
                            index === 0
                              ? "success"
                              : index === 1
                                ? "info"
                                : "warning"
                          }
                          className="w-6 h-6 flex items-center justify-center rounded-full"
                        >
                          {driver.rank}
                        </Badge>
                      ) : (
                        <span className="text-sm font-semibold text-wl-text-secondary">
                          {driver.rank}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Driver name + avatar */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        {driver.driverAvatarUrl && (
                          <AvatarImage
                            src={driver.driverAvatarUrl}
                            alt={driver.driverName}
                          />
                        )}
                        <AvatarFallback>
                          {driver.driverName
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-wl-text-primary">
                        {driver.driverName}
                      </span>
                    </div>
                  </td>

                  {/* Deliveries */}
                  <td className="py-3 px-4">
                    <span className="text-sm text-wl-text-primary font-medium">
                      {driver.deliveriesCompleted}
                    </span>
                  </td>

                  {/* On-Time % */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-wl-text-primary">
                        {driver.onTimePercentage}%
                      </span>
                      {driver.onTimePercentage >= 95 && (
                        <Badge variant="success" className="text-xs">
                          Excellent
                        </Badge>
                      )}
                    </div>
                  </td>

                  {/* Customer Rating */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-wl-text-primary">
                        {driver.customerRatingAvg}
                      </span>
                      <span className="text-wl-warning-400">★</span>
                    </div>
                  </td>

                  {/* Composite Score */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-wl-bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-wl-success-500 to-wl-primary-500"
                          style={{ width: `${driver.compositeScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-wl-text-primary">
                        {driver.compositeScore}
                      </span>
                    </div>
                  </td>

                  {/* Trend */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      {driver.trend === "up" && (
                        <div className="flex items-center gap-1 text-wl-success-400">
                          <ArrowUpRight className="w-4 h-4" />
                          <span className="text-xs font-medium">
                            {driver.trendValue ? `+${driver.trendValue}%` : ""}
                          </span>
                        </div>
                      )}
                      {driver.trend === "down" && (
                        <div className="flex items-center gap-1 text-wl-danger-400">
                          <ArrowDownRight className="w-4 h-4" />
                          <span className="text-xs font-medium">
                            {driver.trendValue ? `${driver.trendValue}%` : ""}
                          </span>
                        </div>
                      )}
                      {driver.trend === "neutral" && (
                        <span className="text-xs text-wl-text-secondary">
                          —
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sortedData.length === 0 && (
            <div className="text-center py-8 text-wl-text-secondary">
              No driver data available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
