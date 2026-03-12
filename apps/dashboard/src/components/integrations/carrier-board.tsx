"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Truck,
  DollarSign,
  Weight,
  Route,
  Filter,
  X,
  TrendingUp,
  ChevronRight,
} from "lucide-react";

type EquipmentType = "53ft Dry Van" | "48ft Dry Van" | "Flatbed" | "Reefer" | "Power Only" | "Tanker";

interface FreightLoad {
  id: string;
  origin: string;
  destination: string;
  distance: number;
  rate: number;
  weight: number;
  weightUnit: string;
  equipmentType: EquipmentType;
  deadheadMiles: number;
  postedTime: Date;
  expiresAt: Date;
  companyName: string;
  isPremium?: boolean;
}

interface CarrierBoardProps {
  loads?: FreightLoad[];
  onQuickMatch?: (loadId: string) => void;
  className?: string;
}

const defaultLoads: FreightLoad[] = [
  {
    id: "load-001",
    origin: "Chicago, IL",
    destination: "Dallas, TX",
    distance: 920,
    rate: 2300,
    weight: 45000,
    weightUnit: "lbs",
    equipmentType: "53ft Dry Van",
    deadheadMiles: 120,
    postedTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 22 * 60 * 60 * 1000),
    companyName: "Premium Logistics Inc",
    isPremium: true,
  },
  {
    id: "load-002",
    origin: "Los Angeles, CA",
    destination: "Denver, CO",
    distance: 1010,
    rate: 2100,
    weight: 42000,
    weightUnit: "lbs",
    equipmentType: "48ft Dry Van",
    deadheadMiles: 85,
    postedTime: new Date(Date.now() - 45 * 60 * 1000),
    expiresAt: new Date(Date.now() + 23.25 * 60 * 60 * 1000),
    companyName: "FastFreight Solutions",
  },
  {
    id: "load-003",
    origin: "Houston, TX",
    destination: "Nashville, TN",
    distance: 650,
    rate: 1850,
    weight: 48000,
    weightUnit: "lbs",
    equipmentType: "53ft Dry Van",
    deadheadMiles: 210,
    postedTime: new Date(Date.now() - 15 * 60 * 1000),
    expiresAt: new Date(Date.now() + 24.75 * 60 * 60 * 1000),
    companyName: "TransAmerica Freight",
  },
  {
    id: "load-004",
    origin: "Atlanta, GA",
    destination: "Miami, FL",
    distance: 660,
    rate: 1950,
    weight: 35000,
    weightUnit: "lbs",
    equipmentType: "Reefer",
    deadheadMiles: 45,
    postedTime: new Date(Date.now() - 30 * 60 * 1000),
    expiresAt: new Date(Date.now() + 23.5 * 60 * 60 * 1000),
    companyName: "ColdChain Logistics",
  },
  {
    id: "load-005",
    origin: "Seattle, WA",
    destination: "Portland, OR",
    distance: 170,
    rate: 850,
    weight: 38000,
    weightUnit: "lbs",
    equipmentType: "53ft Dry Van",
    deadheadMiles: 0,
    postedTime: new Date(Date.now() - 5 * 60 * 1000),
    expiresAt: new Date(Date.now() + 24.92 * 60 * 60 * 1000),
    companyName: "ShortHaul Express",
  },
  {
    id: "load-006",
    origin: "Phoenix, AZ",
    destination: "Las Vegas, NV",
    distance: 285,
    rate: 1100,
    weight: 44000,
    weightUnit: "lbs",
    equipmentType: "Flatbed",
    deadheadMiles: 60,
    postedTime: new Date(Date.now() - 20 * 60 * 1000),
    expiresAt: new Date(Date.now() + 23.67 * 60 * 60 * 1000),
    companyName: "HeavyLoad Transport",
  },
];

type FilterKey = "equipment" | "rateRange";

export function CarrierBoard({
  loads = defaultLoads,
  onQuickMatch,
  className,
}: CarrierBoardProps) {
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});

  const equipmentTypes = useMemo(
    () => [...new Set(loads.map((l) => l.equipmentType))],
    [loads]
  );

  const filteredLoads = useMemo(() => {
    return loads.filter((load) => {
      // Equipment filter
      if (selectedFilters.equipment && selectedFilters.equipment.length > 0) {
        if (!selectedFilters.equipment.includes(load.equipmentType)) return false;
      }

      // Rate range filter
      if (selectedFilters.rateRange && selectedFilters.rateRange.length > 0) {
        const rate = load.rate;
        const matches = selectedFilters.rateRange.some((range) => {
          if (range === "under1500") return rate < 1500;
          if (range === "1500to2000") return rate >= 1500 && rate < 2000;
          if (range === "2000plus") return rate >= 2000;
          return false;
        });
        if (!matches) return false;
      }

      return true;
    });
  }, [loads, selectedFilters]);

  const toggleFilter = (key: FilterKey, value: string) => {
    setSelectedFilters((prev) => {
      const current = prev[key] || [];
      const newFilters = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];

      return {
        ...prev,
        [key]: newFilters,
      };
    });
  };

  const clearFilters = () => {
    setSelectedFilters({});
  };

  const activeFilterCount = Object.values(selectedFilters).flat().length;

  const getExpiresSoon = (expiresAt: Date): boolean => {
    const hoursUntilExpire = (expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    return hoursUntilExpire < 4;
  };

  const getTimeAgo = (date: Date): string => {
    const minutes = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-wl-bg-surface border border-wl-border-subtle rounded-lg overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-wl-border-subtle bg-wl-bg-overlay">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-wl-text-primary flex items-center gap-2">
              <Truck className="w-5 h-5 text-wl-primary-500" />
              Available Loads
            </h3>
            <p className="text-xs text-wl-text-secondary mt-1">
              {filteredLoads.length} of {loads.length} loads available
            </p>
          </div>

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Filter chips */}
        <div className="space-y-3">
          {/* Equipment filter */}
          <div>
            <p className="text-xs font-semibold text-wl-text-secondary uppercase mb-2 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Equipment Type
            </p>
            <div className="flex flex-wrap gap-2">
              {equipmentTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleFilter("equipment", type)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-all",
                    (selectedFilters.equipment || []).includes(type)
                      ? "bg-wl-primary-500 text-white border border-wl-primary-600"
                      : "bg-wl-bg-surface border border-wl-border-subtle text-wl-text-secondary hover:border-wl-border-default"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Rate range filter */}
          <div>
            <p className="text-xs font-semibold text-wl-text-secondary uppercase mb-2 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Rate Range
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "under1500", label: "Under $1,500" },
                { key: "1500to2000", label: "$1,500 - $2,000" },
                { key: "2000plus", label: "$2,000+" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleFilter("rateRange", key)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-all",
                    (selectedFilters.rateRange || []).includes(key)
                      ? "bg-wl-primary-500 text-white border border-wl-primary-600"
                      : "bg-wl-bg-surface border border-wl-border-subtle text-wl-text-secondary hover:border-wl-border-default"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loads grid */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {filteredLoads.length > 0 ? (
          filteredLoads.map((load) => (
            <div
              key={load.id}
              className="group border border-wl-border-subtle rounded-lg bg-wl-bg-overlay hover:border-wl-primary-500 hover:shadow-md transition-all overflow-hidden"
            >
              <div className="p-4 space-y-3">
                {/* Header with premium badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1">
                    <Truck className="w-4 h-4 text-wl-primary-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-wl-text-primary">
                          {load.origin} → {load.destination}
                        </h4>
                        {load.isPremium && (
                          <Badge variant="primary" className="text-xs">
                            Premium
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-wl-text-secondary">{load.companyName}</p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-wl-primary-500">${load.rate}</p>
                    <p className="text-xs text-wl-text-secondary">Posted {getTimeAgo(load.postedTime)}</p>
                  </div>
                </div>

                {/* Route info */}
                <div className="flex items-center gap-2 text-xs text-wl-text-secondary">
                  <Route className="w-3.5 h-3.5 text-wl-primary-400" />
                  <span>{load.distance} miles</span>
                  {load.deadheadMiles > 0 && (
                    <>
                      <span className="text-wl-border-subtle">•</span>
                      <span>{load.deadheadMiles} mi deadhead</span>
                    </>
                  )}
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-3 gap-3 py-3 border-t border-b border-wl-border-subtle">
                  <div>
                    <p className="text-xs text-wl-text-secondary mb-1">Equipment</p>
                    <Badge variant="default" className="text-xs">
                      {load.equipmentType}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-xs text-wl-text-secondary mb-1">Weight</p>
                    <p className="text-sm font-semibold text-wl-text-primary">
                      {(load.weight / 1000).toFixed(1)}K {load.weightUnit}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-wl-text-secondary mb-1">Rate/Mile</p>
                    <p className="text-sm font-semibold text-wl-text-primary">
                      ${(load.rate / load.distance).toFixed(2)}/mi
                    </p>
                  </div>
                </div>

                {/* Footer with actions */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    {getExpiresSoon(load.expiresAt) && (
                      <Badge variant="warning" className="text-xs flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Expires soon
                      </Badge>
                    )}
                    <p className="text-xs text-wl-text-secondary">
                      Expires in {Math.floor((load.expiresAt.getTime() - new Date().getTime()) / (1000 * 60))} min
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onQuickMatch?.(load.id)}
                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Quick Match
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-48 text-center text-wl-text-secondary">
            <div>
              <Truck className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No loads match your filters</p>
              <p className="text-xs mt-1">Try adjusting your filter criteria</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
