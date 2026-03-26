"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, Calendar, MapPin, Truck, DollarSign } from "lucide-react";

interface FreightQuoteCardProps {
  carrierId: string;
  carrierName: string;
  carrierLogoUrl?: string;
  rate: number;
  currency?: string;
  transitDays: number;
  pickupDate: Date;
  deliveryDate: Date;
  equipmentType: string;
  distance: number;
  distanceUnit?: string;
  rateComparison?: {
    marketAverage: number;
    difference: number; // negative = cheaper
  };
  origin: string;
  destination: string;
  onQuickBook?: (carrierId: string) => void;
  className?: string;
}

export function FreightQuoteCard({
  carrierId,
  carrierName,
  carrierLogoUrl,
  rate,
  currency = "USD",
  transitDays,
  pickupDate,
  deliveryDate,
  equipmentType,
  distance,
  distanceUnit = "mi",
  rateComparison,
  origin,
  destination,
  onQuickBook,
  className,
}: FreightQuoteCardProps) {
  const isBelow = rateComparison && rateComparison.difference < 0;
  const isBelowMarket = isBelow && rateComparison;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  };

  const getComparisonLabel = () => {
    if (!rateComparison) return null;
    const percentage = Math.round((Math.abs(rateComparison.difference) / rateComparison.marketAverage) * 100);
    return isBelowMarket ? `${percentage}% below market` : `${percentage}% above market`;
  };

  return (
    <div
      className={cn(
        "flex flex-col border border-wl-border-subtle rounded-lg bg-wl-bg-surface overflow-hidden transition-all duration-200 hover:border-wl-border-default hover:shadow-md",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-wl-border-subtle bg-wl-bg-overlay">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            {/* Carrier Logo */}
            {carrierLogoUrl ? (
              <img
                src={carrierLogoUrl}
                alt={carrierName}
                className="w-10 h-10 rounded-md object-cover bg-wl-surface"
              />
            ) : (
              <div className="w-10 h-10 rounded-md bg-gradient-to-br from-wl-primary-500/20 to-wl-primary-600/20 border border-wl-primary-500/30 flex items-center justify-center">
                <Truck className="w-5 h-5 text-wl-primary-500" />
              </div>
            )}

            {/* Carrier name and quote ID */}
            <div>
              <h3 className="text-sm font-semibold text-wl-text-primary">{carrierName}</h3>
              <p className="text-xs text-wl-text-secondary">Quote #{carrierId.slice(0, 8)}</p>
            </div>
          </div>

          {/* Rate comparison badge */}
          {rateComparison && (
            <Badge variant={isBelowMarket ? "success" : "warning"} className="flex-shrink-0">
              {isBelowMarket ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <TrendingUp className="w-3 h-3" />
              )}
              {getComparisonLabel()}
            </Badge>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="p-4 space-y-4">
        {/* Rate section */}
        <div>
          <p className="text-xs text-wl-text-secondary mb-2">Total Rate</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-wl-text-primary">
              {rate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-sm text-wl-text-secondary">{currency}</span>
          </div>
          {rateComparison && (
            <p className="text-xs text-wl-text-secondary mt-1">
              Market avg: ${rateComparison.marketAverage.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
          )}
        </div>

        {/* Transit and dates */}
        <div className="grid grid-cols-2 gap-4 p-3 bg-wl-bg-overlay rounded-lg">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-wl-text-secondary" />
              <p className="text-xs text-wl-text-secondary">Pickup</p>
            </div>
            <p className="text-sm font-semibold text-wl-text-primary">{formatDate(pickupDate)}</p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-wl-text-secondary" />
              <p className="text-xs text-wl-text-secondary">Delivery</p>
            </div>
            <p className="text-sm font-semibold text-wl-text-primary">{formatDate(deliveryDate)}</p>
          </div>
        </div>

        {/* Route info */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-wl-primary-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-wl-text-secondary">Origin</p>
              <p className="text-sm text-wl-text-primary font-medium">{origin}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-wl-primary-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-wl-text-secondary">Destination</p>
              <p className="text-sm text-wl-text-primary font-medium">{destination}</p>
            </div>
          </div>
        </div>

        {/* Equipment and distance */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-wl-bg-overlay rounded-lg">
          <div>
            <p className="text-xs text-wl-text-secondary mb-1">Equipment</p>
            <Badge variant="default" className="text-xs">
              {equipmentType}
            </Badge>
          </div>

          <div>
            <p className="text-xs text-wl-text-secondary mb-1">Distance</p>
            <p className="text-sm font-semibold text-wl-text-primary">
              {distance.toLocaleString()} {distanceUnit}
            </p>
          </div>
        </div>

        {/* Cost breakdown hint */}
        <div className="p-2 bg-wl-info-bg/30 rounded-lg border border-wl-info-400/20">
          <div className="flex items-center gap-2 text-xs text-wl-info-400">
            <DollarSign className="w-3 h-3 flex-shrink-0" />
            <span>${(rate / distance).toFixed(2)}/mi rate</span>
          </div>
        </div>
      </div>

      {/* Footer action */}
      <div className="p-4 border-t border-wl-border-subtle bg-wl-bg-overlay">
        <Button
          variant="primary"
          size="md"
          onClick={() => onQuickBook?.(carrierId)}
          className="w-full"
        >
          Quick Book
        </Button>
      </div>
    </div>
  );
}
