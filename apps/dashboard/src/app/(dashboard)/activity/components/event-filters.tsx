"use client";

import { useState } from "react";
import { ChevronDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterState {
  types: string[];
  severities: string[];
  startDate: Date | null;
  endDate: Date | null;
  userId: string | null;
}

interface FilterState {
  types: string[];
  severities: string[];
  startDate: Date | null;
  endDate: Date | null;
  userId: string | null;
}

interface FilterState {
  types: string[];
  severities: string[];
  startDate: Date | null;
  endDate: Date | null;
  userId: string | null;
}

interface EventFiltersProps {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  users?: { id: string; name: string }[];
}

const EVENT_TYPES = [
  { id: "order", label: "Order", icon: "📦" },
  { id: "shipment", label: "Shipment", icon: "🚚" },
  { id: "driver", label: "Driver", icon: "👤" },
  { id: "system", label: "System", icon: "⚡" },
  { id: "webhook", label: "Webhook", icon: "🔗" },
  { id: "workflow", label: "Workflow", icon: "🔄" },
];

const SEVERITY_LEVELS = [
  { id: "info", label: "Info", color: "var(--wl-info-400)" },
  { id: "success", label: "Success", color: "var(--wl-success-400)" },
  { id: "warning", label: "Warning", color: "var(--wl-warning-400)" },
  { id: "error", label: "Error", color: "var(--wl-danger-400)" },
];

export function EventFilters({
  filters,
  setFilters,
  users = [],
}: EventFiltersProps) {
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showSeverityDropdown, setShowSeverityDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [dateMode, setDateMode] = useState<"start" | "end">("start");

  const { items: users, loading: usersLoading } = useApiList<{ id: string; name: string }>(
    '/api/v4/users?limit=100'
  );

  const handleTypeToggle = (typeId: string) => {
    setFilters({
      ...filters,
      types: filters.types.includes(typeId)
        ? filters.types.filter((t) => t !== typeId)
        : [...filters.types, typeId],
    });
  };

  const handleSeverityToggle = (severity: string) => {
    setFilters({
      ...filters,
      severities: filters.severities.includes(severity)
        ? filters.severities.filter((s) => s !== severity)
        : [...filters.severities, severity],
    });
  };

  const handleDateChange = (date: string) => {
    const selectedDate = new Date(date);
    if (dateMode === "start") {
      setFilters({ ...filters, startDate: selectedDate });
      setDateMode("end");
    } else {
      setFilters({ ...filters, endDate: selectedDate });
      setShowDatePicker(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    setFilters({ ...filters, userId: filters.userId === userId ? null : userId });
    setShowUserDropdown(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Event type filter */}
      <div className="relative">
        <button
          onClick={() => setShowTypeDropdown(!showTypeDropdown)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md border",
            "text-sm font-medium transition-all duration-200",
            "bg-wl-bg-surface border-wl-border-subtle",
            "hover:border-wl-border-default hover:bg-wl-bg-elevated",
            showTypeDropdown && "border-wl-primary-500 bg-wl-bg-elevated"
          )}
        >
          <span>Event Type</span>
          {filters.types.length > 0 && (
            <span className="text-xs bg-wl-primary-500/20 text-wl-primary-400 px-1.5 py-0.5 rounded-md">
              {filters.types.length}
            </span>
          )}
          <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", showTypeDropdown && "rotate-180")} />
        </button>

        {showTypeDropdown && (
          <div className="absolute top-full left-0 mt-2 bg-wl-bg-elevated border border-wl-border-subtle rounded-md shadow-lg z-40 w-48">
            <div className="p-3 space-y-2">
              {EVENT_TYPES.map((type) => (
                <label key={type.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-wl-bg-surface cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={filters.types.includes(type.id)}
                    onChange={() => handleTypeToggle(type.id)}
                    className="w-4 h-4 rounded accent-wl-primary-500 cursor-pointer"
                  />
                  <span className="text-sm text-wl-text-primary">{type.icon}</span>
                  <span className="text-sm text-wl-text-primary">{type.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Severity filter */}
      <div className="relative">
        <button
          onClick={() => setShowSeverityDropdown(!showSeverityDropdown)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md border",
            "text-sm font-medium transition-all duration-200",
            "bg-wl-bg-surface border-wl-border-subtle",
            "hover:border-wl-border-default hover:bg-wl-bg-elevated",
            showSeverityDropdown && "border-wl-primary-500 bg-wl-bg-elevated"
          )}
        >
          <span>Severity</span>
          {filters.severities.length > 0 && (
            <span className="text-xs bg-wl-warning-500/20 text-wl-warning-400 px-1.5 py-0.5 rounded-md">
              {filters.severities.length}
            </span>
          )}
          <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", showSeverityDropdown && "rotate-180")} />
        </button>

        {showSeverityDropdown && (
          <div className="absolute top-full left-0 mt-2 bg-wl-bg-elevated border border-wl-border-subtle rounded-md shadow-lg z-40 w-48">
            <div className="p-3 space-y-2">
              {SEVERITY_LEVELS.map((level) => (
                <label key={level.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-wl-bg-surface cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={filters.severities.includes(level.id)}
                    onChange={() => handleSeverityToggle(level.id)}
                    className="w-4 h-4 rounded accent-wl-primary-500 cursor-pointer"
                  />
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: level.color }} />
                  <span className="text-sm text-wl-text-primary">{level.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Date range filter */}
      <div className="relative">
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md border",
            "text-sm font-medium transition-all duration-200",
            "bg-wl-bg-surface border-wl-border-subtle",
            "hover:border-wl-border-default hover:bg-wl-bg-elevated",
            showDatePicker && "border-wl-primary-500 bg-wl-bg-elevated",
            (filters.startDate || filters.endDate) && "border-wl-primary-500/50"
          )}
        >
          <Calendar className="w-4 h-4" />
          <span>Date Range</span>
          {(filters.startDate || filters.endDate) && (
            <span className="text-xs bg-wl-primary-500/20 text-wl-primary-400 px-1.5 py-0.5 rounded-md">
              {filters.startDate && filters.endDate ? "2" : "1"}
            </span>
          )}
          <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", showDatePicker && "rotate-180")} />
        </button>

        {showDatePicker && (
          <div className="absolute top-full left-0 mt-2 bg-wl-bg-elevated border border-wl-border-subtle rounded-md shadow-lg z-40 w-56 p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2">
                {dateMode === "start" ? "Start Date" : "End Date"}
              </p>
              <input
                type="date"
                value={
                  dateMode === "start"
                    ? filters.startDate?.toISOString().split("T")[0] || ""
                    : filters.endDate?.toISOString().split("T")[0] || ""
                }
                onChange={(e) => handleDateChange(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-md border text-sm",
                  "bg-wl-bg-surface border-wl-border-subtle text-wl-text-primary",
                  "focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/20"
                )}
              />
            </div>

            {filters.startDate && filters.endDate && (
              <div className="pt-2 border-t border-wl-border-subtle">
                <p className="text-xs text-wl-text-secondary mb-2">Selected range:</p>
                <p className="text-sm text-wl-text-primary">
                  {filters.startDate.toLocaleDateString()} to {filters.endDate.toLocaleDateString()}
                </p>
                <button
                  onClick={() => {
                    setFilters({ ...filters, startDate: null, endDate: null });
                    setShowDatePicker(false);
                    setDateMode("start");
                  }}
                  className="text-xs text-wl-danger-400 hover:text-wl-danger-300 mt-2 font-medium"
                >
                  Clear dates
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User filter — only shown when users are available */}
      {users.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md border",
              "text-sm font-medium transition-all duration-200",
              "bg-wl-bg-surface border-wl-border-subtle",
              "hover:border-wl-border-default hover:bg-wl-bg-elevated",
              showUserDropdown && "border-wl-primary-500 bg-wl-bg-elevated",
              filters.userId && "border-wl-primary-500/50"
            )}
          >
            <span>User</span>
            {filters.userId && (
              <span className="text-xs bg-wl-primary-500/20 text-wl-primary-400 px-1.5 py-0.5 rounded-md">1</span>
            )}
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", showUserDropdown && "rotate-180")} />
          </button>

        {showUserDropdown && (
          <div className="absolute top-full left-0 mt-2 bg-wl-bg-elevated border border-wl-border-subtle rounded-md shadow-lg z-40 w-48">
            <div className="p-3 space-y-2">
              {users.map((user) => (
                <label key={user.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-wl-bg-surface cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="user"
                    checked={filters.userId === user.id}
                    onChange={() => handleUserSelect(user.id)}
                    className="w-4 h-4 rounded-full accent-wl-primary-500 cursor-pointer"
                  />
                  <span className="text-sm text-wl-text-primary">
                    {user.name}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
