"use client";

import { forwardRef, useState, type HTMLAttributes } from "react";
import {
  TrendingUp,
  Users,
  Zap,
  BarChart3,
  MapPin,
  AlertCircle,
  Clock,
  Shield,
  Award,
  Target,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GoalOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    id: "revenue",
    label: "Increase Revenue",
    description: "Boost sales and profitability",
    icon: <TrendingUp className="w-6 h-6" />,
  },
  {
    id: "efficiency",
    label: "Improve Efficiency",
    description: "Optimize operations and reduce costs",
    icon: <Zap className="w-6 h-6" />,
  },
  {
    id: "visibility",
    label: "Real-time Visibility",
    description: "Track assets and operations in real-time",
    icon: <MapPin className="w-6 h-6" />,
  },
  {
    id: "analytics",
    label: "Better Analytics",
    description: "Data-driven decision making",
    icon: <BarChart3 className="w-6 h-6" />,
  },
  {
    id: "customer",
    label: "Enhance Customer Experience",
    description: "Improve service quality and satisfaction",
    icon: <Users className="w-6 h-6" />,
  },
  {
    id: "compliance",
    label: "Ensure Compliance",
    description: "Meet regulatory requirements",
    icon: <Shield className="w-6 h-6" />,
  },
  {
    id: "speed",
    label: "Faster Operations",
    description: "Accelerate delivery and response times",
    icon: <Clock className="w-6 h-6" />,
  },
  {
    id: "risk",
    label: "Reduce Risks",
    description: "Minimize operational and financial risks",
    icon: <AlertCircle className="w-6 h-6" />,
  },
  {
    id: "growth",
    label: "Scale Operations",
    description: "Support business growth seamlessly",
    icon: <Award className="w-6 h-6" />,
  },
  {
    id: "integration",
    label: "Better Integration",
    description: "Connect systems and reduce silos",
    icon: <Target className="w-6 h-6" />,
  },
];

interface GoalSelectorProps extends HTMLAttributes<HTMLDivElement> {
  value?: string[];
  onSelectionChange?: (selected: string[]) => void;
  minSelection?: number;
  showError?: boolean;
}

const GoalSelector = forwardRef<HTMLDivElement, GoalSelectorProps>(
  (
    {
      value = [],
      onSelectionChange,
      minSelection = 1,
      showError = false,
      className,
      ...props
    },
    ref,
  ) => {
    const [localSelected, setLocalSelected] = useState(value);
    const [touched, setTouched] = useState(false);

    const selected = value.length > 0 ? value : localSelected;

    const handleToggle = (id: string) => {
      let newSelected: string[];
      if (selected.includes(id)) {
        newSelected = selected.filter((s) => s !== id);
      } else {
        newSelected = [...selected, id];
      }
      setLocalSelected(newSelected);
      setTouched(true);
      onSelectionChange?.(newSelected);
    };

    const isValid = selected.length >= minSelection;
    const shouldShowError = showError && touched && !isValid;

    return (
      <>
        <style>{`
          @keyframes select-scale {
            from {
              transform: scale(0.95);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }
          .goal-select-animate {
            animation: select-scale 0.2s ease-out;
          }
        `}</style>
        <div ref={ref} className={cn("w-full space-y-4", className)} {...props}>
          {/* Selection counter */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-wl-text-primary">
              Select Your Primary Goals
            </label>
            {selected.length > 0 && (
              <div className="px-2.5 py-1 bg-wl-primary-500/12 border border-wl-primary-500/30 rounded-full text-xs font-semibold text-wl-primary-400">
                {selected.length} selected
              </div>
            )}
          </div>

          {/* Goals grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {GOAL_OPTIONS.map((goal) => {
              const isSelected = selected.includes(goal.id);
              return (
                <button
                  key={goal.id}
                  onClick={() => handleToggle(goal.id)}
                  className={cn(
                    "relative p-4 rounded-lg border-2 transition-all duration-base ease-default",
                    "flex flex-col items-start gap-2 text-left",
                    "hover:border-wl-border-default",
                    isSelected
                      ? "bg-wl-primary-500/10 border-wl-primary-500 goal-select-animate"
                      : "bg-wl-bg-overlay border-wl-border-subtle",
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "transition-colors",
                      isSelected
                        ? "text-wl-primary-400"
                        : "text-wl-text-secondary",
                    )}
                  >
                    {goal.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-wl-text-primary">
                      {goal.label}
                    </h3>
                    <p className="text-xs text-wl-text-tertiary mt-1">
                      {goal.description}
                    </p>
                  </div>

                  {/* Checkmark */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-wl-primary-500 rounded-full p-1">
                      <Check
                        className="w-4 h-4 text-wl-text-inverse"
                        strokeWidth={3}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Validation message */}
          {shouldShowError && (
            <div className="px-3 py-2 bg-wl-danger-bg border border-wl-danger-500/30 rounded-md flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-wl-danger-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-wl-danger-400">
                Please select at least {minSelection} goal
                {minSelection === 1 ? "" : "s"} to continue
              </p>
            </div>
          )}
        </div>
      </>
    );
  },
);

GoalSelector.displayName = "GoalSelector";

export { GoalSelector };
export type { GoalSelectorProps };
