"use client";

import { cn } from "@/lib/utils";
import { Check, MapPin, Satellite, Package, Ship, Clipboard, Bell, BarChart3, Calculator, Users, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OnboardingData, Goal } from "../types";

interface GoalsSelectProps {
  data: OnboardingData;
  onToggle: (goal: Goal) => void;
}

const goals: {
  id: Goal;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    id: Goal.ROUTE_OPTIMIZATION,
    label: "Route Optimization",
    description: "Reduce fuel costs and delivery times",
    icon: <MapPin className="w-5 h-5" />,
    color: "from-blue-500 to-blue-600",
  },
  {
    id: Goal.FLEET_TRACKING,
    label: "Fleet Tracking & Telematics",
    description: "Real-time vehicle and driver tracking",
    icon: <Satellite className="w-5 h-5" />,
    color: "from-cyan-500 to-cyan-600",
  },
  {
    id: Goal.LAST_MILE,
    label: "Last-Mile Delivery Management",
    description: "Optimize final delivery to customers",
    icon: <Package className="w-5 h-5" />,
    color: "from-emerald-500 to-emerald-600",
  },
  {
    id: Goal.MULTI_CARRIER,
    label: "Multi-Carrier Shipping",
    description: "Manage multiple shipping providers",
    icon: <Ship className="w-5 h-5" />,
    color: "from-indigo-500 to-indigo-600",
  },
  {
    id: Goal.ORDER_MANAGEMENT,
    label: "Order Management & Fulfillment",
    description: "Streamline order processing",
    icon: <Clipboard className="w-5 h-5" />,
    color: "from-orange-500 to-orange-600",
  },
  {
    id: Goal.NOTIFICATIONS,
    label: "Customer Notifications & Tracking",
    description: "Keep customers informed",
    icon: <Bell className="w-5 h-5" />,
    color: "from-pink-500 to-pink-600",
  },
  {
    id: Goal.ANALYTICS,
    label: "Analytics & Reporting",
    description: "Detailed insights and metrics",
    icon: <BarChart3 className="w-5 h-5" />,
    color: "from-violet-500 to-violet-600",
  },
  {
    id: Goal.ERP_INTEGRATION,
    label: "ERP & Accounting Integration",
    description: "Sync with accounting systems",
    icon: <Calculator className="w-5 h-5" />,
    color: "from-amber-500 to-amber-600",
  },
  {
    id: Goal.DRIVER_MANAGEMENT,
    label: "Driver Management",
    description: "Manage driver documents and ratings",
    icon: <Users className="w-5 h-5" />,
    color: "from-red-500 to-red-600",
  },
  {
    id: Goal.COMPLIANCE,
    label: "Compliance & ELD",
    description: "Ensure regulatory compliance",
    icon: <Shield className="w-5 h-5" />,
    color: "from-green-500 to-green-600",
  },
];

export function GoalsSelect({ data, onToggle }: GoalsSelectProps) {
  const selectedCount = data.goals.length;

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-wl-text-primary m-0">
              What are your primary goals?
            </h2>
            <p className="text-sm text-wl-text-secondary mt-1 m-0">
              Select all that apply. We'll configure features based on your needs.
            </p>
          </div>
          {selectedCount > 0 && (
            <Badge variant="primary">{selectedCount} selected</Badge>
          )}
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {goals.map((goal) => {
          const isSelected = data.goals.includes(goal.id);

          return (
            <button
              key={goal.id}
              onClick={() => onToggle(goal.id)}
              className={cn(
                "relative p-4 rounded-lg border-2 transition-all duration-200",
                "flex flex-col items-start gap-3 cursor-pointer group text-left",
                isSelected
                  ? "border-wl-primary-500 bg-wl-primary-500/10 shadow-lg"
                  : "border-wl-border-default bg-wl-bg-surface hover:border-wl-border-strong hover:bg-wl-bg-overlay"
              )}
            >
              {/* Checkmark */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-wl-primary-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-wl-text-inverse" />
                </div>
              )}

              {/* Icon */}
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center text-wl-text-inverse",
                  `bg-gradient-to-br ${goal.color}`
                )}
              >
                {goal.icon}
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-wl-text-primary m-0">
                  {goal.label}
                </h3>
                <p className="text-xs text-wl-text-tertiary mt-1 m-0">
                  {goal.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Goals Display */}
      {selectedCount > 0 && (
        <div className="p-4 rounded-lg bg-wl-success-500/10 border border-wl-success-400/30 animate-in fade-in">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="text-sm font-semibold text-wl-text-primary m-0 mb-2">
                Selected goals:
              </p>
              <div className="flex flex-wrap gap-2">
                {data.goals.map((goalId) => {
                  const goal = goals.find((g) => g.id === goalId);
                  return goal ? (
                    <Badge
                      key={goalId}
                      variant="primary"
                      className="bg-wl-primary-500/30 text-wl-primary-300 border border-wl-primary-400/40"
                    >
                      {goal.label}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="p-3 rounded-lg bg-wl-bg-overlay border border-wl-border-default text-sm">
        <p className="m-0 text-wl-text-tertiary">
          <span className="font-semibold text-wl-text-primary">UP NEXT:</span>{" "}
          Integrations setup
        </p>
      </div>

      {/* Info Box */}
      <div className="p-4 rounded-lg bg-wl-info-500/10 border border-wl-info-500/20">
        <p className="text-xs text-wl-text-secondary leading-relaxed m-0">
          Don't see a feature you need? You can add custom integrations after
          setup, and we're constantly expanding our feature set.
        </p>
      </div>
    </div>
  );
}
