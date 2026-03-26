"use client";

import { forwardRef, useState, type HTMLAttributes } from "react";
import {
  ShoppingCart,
  UtensilsCrossed,
  Stethoscope,
  Truck,
  Wrench,
  Factory,
  Package,
  Store,
  Plus,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IndustryOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const INDUSTRY_OPTIONS: IndustryOption[] = [
  {
    id: "ecommerce",
    label: "E-Commerce",
    description: "Online retail and marketplaces",
    icon: <ShoppingCart className="w-6 h-6" />,
  },
  {
    id: "food",
    label: "Food & Beverage",
    description: "Restaurants and food delivery",
    icon: <UtensilsCrossed className="w-6 h-6" />,
  },
  {
    id: "healthcare",
    label: "Healthcare",
    description: "Medical services and clinics",
    icon: <Stethoscope className="w-6 h-6" />,
  },
  {
    id: "logistics",
    label: "Logistics & 3PL",
    description: "Supply chain and warehousing",
    icon: <Truck className="w-6 h-6" />,
  },
  {
    id: "field-service",
    label: "Field Service",
    description: "On-site service operations",
    icon: <Wrench className="w-6 h-6" />,
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    description: "Production and operations",
    icon: <Factory className="w-6 h-6" />,
  },
  {
    id: "courier",
    label: "Courier",
    description: "Parcel and document delivery",
    icon: <Package className="w-6 h-6" />,
  },
  {
    id: "grocery",
    label: "Grocery",
    description: "Grocery stores and markets",
    icon: <Store className="w-6 h-6" />,
  },
  {
    id: "custom",
    label: "Custom/Other",
    description: "Custom industry type",
    icon: <Plus className="w-6 h-6" />,
  },
];

interface IndustryPickerProps extends HTMLAttributes<HTMLDivElement> {
  value?: string;
  onSelect?: (id: string, label: string) => void;
  customValue?: string;
  onCustomValueChange?: (value: string) => void;
}

const IndustryPicker = forwardRef<HTMLDivElement, IndustryPickerProps>(
  (
    { value, onSelect, customValue = "", onCustomValueChange, className, ...props },
    ref
  ) => {
    const [localSelected, setLocalSelected] = useState(value || "");
    const [localCustom, setLocalCustom] = useState(customValue);

    const selected = value !== undefined ? value : localSelected;
    const custom = customValue !== undefined ? customValue : localCustom;

    const handleSelect = (id: string, label: string) => {
      setLocalSelected(id);
      onSelect?.(id, label);
    };

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalCustom(newValue);
      onCustomValueChange?.(newValue);
    };

    return (
      <>
        <style>{`
          @keyframes scale-in {
            from {
              transform: scale(0.95);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }
          .industry-card-animate {
            animation: scale-in 0.2s ease-default;
          }
        `}</style>
        <div
          ref={ref}
          className={cn(
            "w-full space-y-6",
            className
          )}
          {...props}
        >

        {/* Grid of industry options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {INDUSTRY_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id, option.label)}
              className={cn(
                "relative p-4 rounded-lg border-2 transition-all duration-base ease-default",
                "flex flex-col items-start gap-3 text-left",
                "hover:border-wl-border-default",
                selected === option.id
                  ? "bg-wl-primary-500/10 border-wl-primary-500 industry-card-animate"
                  : "bg-wl-bg-overlay border-wl-border-subtle"
              )}
            >
              {/* Checkmark badge */}
              {selected === option.id && (
                <div className="absolute top-2 right-2 bg-wl-primary-500 rounded-full p-1">
                  <Check className="w-4 h-4 text-wl-text-inverse" strokeWidth={3} />
                </div>
              )}

              {/* Icon */}
              <div
                className={cn(
                  "transition-colors",
                  selected === option.id
                    ? "text-wl-primary-400"
                    : "text-wl-text-secondary"
                )}
              >
                {option.icon}
              </div>

              {/* Label and description */}
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-wl-text-primary">
                  {option.label}
                </h3>
                <p className="text-xs text-wl-text-tertiary mt-1">
                  {option.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Custom input for "Custom/Other" option */}
        {selected === "custom" && (
          <div className="industry-card-animate">
            <label className="block text-sm font-semibold text-wl-text-primary mb-2">
              Specify Your Industry
            </label>
            <input
              type="text"
              value={custom}
              onChange={handleCustomChange}
              placeholder="Enter your industry type..."
              className={cn(
                "w-full px-3 py-2 bg-wl-bg-overlay border rounded-md",
                "text-sm text-wl-text-primary placeholder-wl-text-tertiary",
                "border-wl-border-subtle focus:border-wl-primary-500",
                "focus:outline-none transition-colors duration-base",
                "font-family-sans"
              )}
            />
          </div>
        )}
        </div>
      </>
    );
  }
);

IndustryPicker.displayName = "IndustryPicker";

export { IndustryPicker };
export type { IndustryPickerProps };
