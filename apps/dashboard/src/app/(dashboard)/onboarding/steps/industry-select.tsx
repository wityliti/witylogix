"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Plus } from "lucide-react";
import {
  ShoppingBag,
  UtensilsCrossed,
  Heart,
  Truck,
  Wrench,
  Factory,
  Package,
  Leaf,
} from "lucide-react";
import type { OnboardingData } from "../types";
import { Industry } from "../types";

interface IndustrySelectProps {
  data: OnboardingData;
  onSelect: (industry: Industry, custom?: string) => void;
}

const industries: {
  id: Industry;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    id: Industry.ECOMMERCE,
    label: "E-Commerce & Retail",
    icon: <ShoppingBag className="w-5 h-5" />,
    color: "from-blue-500 to-blue-600",
  },
  {
    id: Industry.FOOD_BEVERAGE,
    label: "Food & Beverage",
    icon: <UtensilsCrossed className="w-5 h-5" />,
    color: "from-orange-500 to-orange-600",
  },
  {
    id: Industry.HEALTHCARE,
    label: "Healthcare & Pharma",
    icon: <Heart className="w-5 h-5" />,
    color: "from-red-500 to-red-600",
  },
  {
    id: Industry.LOGISTICS,
    label: "Logistics & 3PL",
    icon: <Truck className="w-5 h-5" />,
    color: "from-amber-500 to-amber-600",
  },
  {
    id: Industry.FIELD_SERVICE,
    label: "Field Service",
    icon: <Wrench className="w-5 h-5" />,
    color: "from-slate-500 to-slate-600",
  },
  {
    id: Industry.MANUFACTURING,
    label: "Manufacturing",
    icon: <Factory className="w-5 h-5" />,
    color: "from-indigo-500 to-indigo-600",
  },
  {
    id: Industry.COURIER,
    label: "Courier & Last-Mile",
    icon: <Package className="w-5 h-5" />,
    color: "from-green-500 to-green-600",
  },
  {
    id: Industry.GROCERY,
    label: "Grocery & Fresh",
    icon: <Leaf className="w-5 h-5" />,
    color: "from-lime-500 to-lime-600",
  },
];

export function IndustrySelect({ data, onSelect }: IndustrySelectProps) {
  const [customOpen, setCustomOpen] = useState(data.industry === Industry.CUSTOM);
  const [customValue, setCustomValue] = useState(data.industryCustom || "");

  const handleSelectIndustry = (industry: Industry) => {
    setCustomOpen(false);
    onSelect(industry);
  };

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      onSelect(Industry.CUSTOM, customValue);
    }
  };

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-wl-text-primary m-0">
          What industry are you in?
        </h2>
        <p className="text-sm text-wl-text-secondary m-0">
          We'll tailor your workspace to your industry and provide relevant
          features.
        </p>
      </div>

      {/* Industry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {industries.map((industry) => {
          const isSelected = data.industry === industry.id;

          return (
            <button
              key={industry.id}
              onClick={() => handleSelectIndustry(industry.id)}
              className={cn(
                "relative p-4 rounded-lg border-2 transition-all duration-200",
                "flex flex-col items-start gap-3 cursor-pointer group",
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
                  `bg-gradient-to-br ${industry.color}`
                )}
              >
                {industry.icon}
              </div>

              {/* Label */}
              <span className="font-semibold text-sm text-wl-text-primary">
                {industry.label}
              </span>
            </button>
          );
        })}

        {/* Custom Option */}
        <button
          onClick={() => setCustomOpen(!customOpen)}
          className={cn(
            "relative p-4 rounded-lg border-2 transition-all duration-200",
            "flex flex-col items-start gap-3 cursor-pointer group",
            customOpen || data.industry === Industry.CUSTOM
              ? "border-wl-primary-500 bg-wl-primary-500/10"
              : "border-wl-border-default bg-wl-bg-surface hover:border-wl-border-strong hover:bg-wl-bg-overlay"
          )}
        >
          {(customOpen || data.industry === Industry.CUSTOM) && (
            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-wl-primary-500 flex items-center justify-center">
              <Check className="w-3 h-3 text-wl-text-inverse" />
            </div>
          )}

          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-wl-primary-500 to-wl-primary-600 text-wl-text-inverse">
            <Plus className="w-5 h-5" />
          </div>

          <span className="font-semibold text-sm text-wl-text-primary">
            Custom/Other
          </span>
        </button>
      </div>

      {/* Custom Input */}
      {customOpen && (
        <div className="p-4 rounded-lg bg-wl-bg-overlay border border-wl-border-default animate-in fade-in">
          <label className="block text-sm font-semibold text-wl-text-primary mb-2">
            Tell us your industry
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g., Construction, Utilities..."
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCustomSubmit();
                }
              }}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg text-sm",
                "bg-wl-bg-surface border border-wl-border-default",
                "text-wl-text-primary placeholder:text-wl-text-tertiary",
                "focus:border-wl-primary-500 focus:outline-none",
                "transition-all duration-200"
              )}
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customValue.trim()}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                "bg-wl-primary-500 text-wl-text-inverse",
                "hover:bg-wl-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Selected Industry Display */}
      {data.industry && data.industry !== Industry.CUSTOM && (
        <div className="p-4 rounded-lg bg-wl-success-500/10 border border-wl-success-400/30 animate-in fade-in">
          <p className="text-sm text-wl-text-primary m-0">
            <span className="font-semibold">Selected:</span>
            {industries.find((i) => i.id === data.industry)?.label}
          </p>
        </div>
      )}

      {data.industry === Industry.CUSTOM && data.industryCustom && (
        <div className="p-4 rounded-lg bg-wl-success-500/10 border border-wl-success-400/30 animate-in fade-in">
          <p className="text-sm text-wl-text-primary m-0">
            <span className="font-semibold">Selected:</span> {data.industryCustom}
          </p>
        </div>
      )}
    </div>
  );
}
