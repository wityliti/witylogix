"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { Users, TrendingUp, Truck, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface StatItem {
  label: string;
  value: string | number;
  icon: any;
  color: string;
  trend?: number;
}

interface PartnerStatsWidgetProps extends HTMLAttributes<HTMLDivElement> {
  totalPartners: number;
  activeCouriers: number;
  deliveriesThisMonth: number;
  averageCostPerDelivery: number;
  isLoading?: boolean;
}

const PartnerStatsWidget = forwardRef<
  HTMLDivElement,
  PartnerStatsWidgetProps
>(
  (
    {
      totalPartners,
      activeCouriers,
      deliveriesThisMonth,
      averageCostPerDelivery,
      isLoading = false,
      className,
      ...props
    },
    ref
  ) => {
    const stats: StatItem[] = [
      {
        label: "Total Partners",
        value: totalPartners,
        icon: Users,
        color: "bg-wl-primary-500/20 text-wl-primary-400",
      },
      {
        label: "Active Couriers",
        value: activeCouriers,
        icon: TrendingUp,
        color: "bg-wl-success-500/20 text-wl-success-400",
      },
      {
        label: "Deliveries This Month",
        value: deliveriesThisMonth.toLocaleString(),
        icon: Truck,
        color: "bg-wl-info-500/20 text-wl-info-400",
      },
      {
        label: "Avg Cost/Delivery",
        value: `$${averageCostPerDelivery.toFixed(2)}`,
        icon: DollarSign,
        color: "bg-wl-warning-500/20 text-wl-warning-400",
      },
    ];

    return (
      <div ref={ref} className={cn("grid grid-cols-4 gap-4", className)} {...props}>
        {stats.map((stat, index) => {
          const Icon = stat.icon;

          return (
            <Card key={index} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs uppercase tracking-wider">
                  {stat.label}
                </CardTitle>
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    stat.color
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              {isLoading ? (
                <div className="h-8 bg-wl-bg-surface rounded animate-pulse" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-wl-text-primary">
                    {stat.value}
                  </span>
                  {stat.trend !== undefined && (
                    <span
                      className={cn(
                        "text-sm font-medium",
                        stat.trend >= 0
                          ? "text-wl-success-400"
                          : "text-wl-danger-400"
                      )}
                    >
                      {stat.trend >= 0 ? "+" : ""}{stat.trend}%
                    </span>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  }
);

PartnerStatsWidget.displayName = "PartnerStatsWidget";

export { PartnerStatsWidget };
export type { PartnerStatsWidgetProps };
