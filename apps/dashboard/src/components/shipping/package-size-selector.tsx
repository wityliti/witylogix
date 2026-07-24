"use client";

import { forwardRef, useState, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Box } from "lucide-react";

interface PackageDimensions {
  length: number;
  width: number;
  height: number;
  weight: number;
}

interface PackagePreset {
  id: string;
  name: string;
  dimensions: PackageDimensions;
  icon?: React.ReactNode;
}

type UnitSystem = "imperial" | "metric";

interface PackageSizeSelectorProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  /** Current package dimensions */
  value: PackageDimensions;
  /** Callback when dimensions change */
  onChange: (dimensions: PackageDimensions) => void;
  /** Custom presets (optional) */
  presets?: PackagePreset[];
  /** Default unit system */
  defaultUnits?: UnitSystem;
}

const defaultPresets: PackagePreset[] = [
  {
    id: "letter",
    name: "Letter/Envelope",
    dimensions: { length: 11.5, width: 8.5, height: 0.25, weight: 0.1 },
    icon: "📮",
  },
  {
    id: "small-box",
    name: "Small Box",
    dimensions: { length: 8, width: 6, height: 4, weight: 1 },
    icon: "📦",
  },
  {
    id: "medium-box",
    name: "Medium Box",
    dimensions: { length: 12, width: 9, height: 8, weight: 3 },
    icon: "📫",
  },
  {
    id: "large-box",
    name: "Large Box",
    dimensions: { length: 18, width: 14, height: 12, weight: 5 },
    icon: "📦",
  },
];

/**
 * Package size selector component with preset sizes and custom dimensions
 *
 * Provides visual preset buttons and editable input fields for custom dimensions.
 * Supports both imperial (in/lb) and metric (cm/kg) units.
 *
 * @example
 * ```tsx
 * <PackageSizeSelector
 *   value={dimensions}
 *   onChange={setDimensions}
 *   defaultUnits="imperial"
 * />
 * ```
 */
const PackageSizeSelector = forwardRef<
  HTMLDivElement,
  PackageSizeSelectorProps
>(
  (
    {
      value,
      onChange,
      presets = defaultPresets,
      defaultUnits = "imperial",
      className,
      ...props
    },
    ref,
  ) => {
    const [isCustom, setIsCustom] = useState(false);
    const [units, setUnits] = useState<UnitSystem>(defaultUnits);

    const handlePresetSelect = (preset: PackagePreset) => {
      onChange(preset.dimensions);
      setIsCustom(false);
    };

    const handleDimensionChange = (
      key: keyof PackageDimensions,
      newValue: string,
    ) => {
      const numValue = parseFloat(newValue) || 0;
      onChange({
        ...value,
        [key]: numValue,
      });
    };

    const toggleUnits = () => {
      setUnits(units === "imperial" ? "metric" : "imperial");
    };

    const lengthLabel = units === "imperial" ? "Length (in)" : "Length (cm)";
    const widthLabel = units === "imperial" ? "Width (in)" : "Width (cm)";
    const heightLabel = units === "imperial" ? "Height (in)" : "Height (cm)";
    const weightLabel = units === "imperial" ? "Weight (lb)" : "Weight (kg)";

    return (
      <div ref={ref} className={cn("space-y-4", className)} {...props}>
        {/* Presets */}
        <div>
          <h4 className="text-sm font-semibold text-wl-text-primary mb-3">
            Package Presets
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                className={cn(
                  "relative p-3 rounded-lg border transition-all duration-200",
                  "flex flex-col items-center justify-center gap-2",
                  "cursor-pointer",
                  !isCustom &&
                    value.length === preset.dimensions.length &&
                    value.width === preset.dimensions.width &&
                    value.height === preset.dimensions.height
                    ? "border-wl-primary-500 bg-wl-primary-500/8 ring-1 ring-wl-primary-500"
                    : "border-wl-border-subtle bg-wl-bg-elevated hover:border-wl-border-default",
                )}
              >
                <span className="text-2xl">{preset.icon}</span>
                <span className="text-xs font-medium text-wl-text-primary text-center">
                  {preset.name}
                </span>
                <span className="text-xs text-wl-text-tertiary">
                  {preset.dimensions.length}×{preset.dimensions.width}×
                  {preset.dimensions.height}
                </span>
              </button>
            ))}

            {/* Custom preset option */}
            <button
              onClick={() => setIsCustom(true)}
              className={cn(
                "p-3 rounded-lg border transition-all duration-200",
                "flex flex-col items-center justify-center gap-2",
                "cursor-pointer",
                isCustom
                  ? "border-wl-primary-500 bg-wl-primary-500/8 ring-1 ring-wl-primary-500"
                  : "border-wl-border-subtle bg-wl-bg-elevated hover:border-wl-border-default",
              )}
            >
              <Box size={24} className="text-wl-text-secondary" />
              <span className="text-xs font-medium text-wl-text-primary text-center">
                Custom
              </span>
            </button>
          </div>
        </div>

        {/* Custom dimensions input */}
        {isCustom && (
          <div className="space-y-4 p-4 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle">
            {/* Unit toggle */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleUnits}
                className="text-xs"
              >
                {units === "imperial"
                  ? "Switch to Metric"
                  : "Switch to Imperial"}
              </Button>
            </div>

            {/* Dimension inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-wl-text-secondary mb-1">
                  {lengthLabel}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={value.length}
                  onChange={(e) =>
                    handleDimensionChange("length", e.target.value)
                  }
                  placeholder="Length"
                  className="text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-wl-text-secondary mb-1">
                  {widthLabel}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={value.width}
                  onChange={(e) =>
                    handleDimensionChange("width", e.target.value)
                  }
                  placeholder="Width"
                  className="text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-wl-text-secondary mb-1">
                  {heightLabel}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={value.height}
                  onChange={(e) =>
                    handleDimensionChange("height", e.target.value)
                  }
                  placeholder="Height"
                  className="text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-wl-text-secondary mb-1">
                  {weightLabel}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={value.weight}
                  onChange={(e) =>
                    handleDimensionChange("weight", e.target.value)
                  }
                  placeholder="Weight"
                  className="text-sm"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="pt-3 border-t border-wl-border-subtle">
              <p className="text-xs text-wl-text-secondary">
                {value.length}×{value.width}×{value.height}{" "}
                {units === "imperial" ? "in" : "cm"}, {value.weight}{" "}
                {units === "imperial" ? "lb" : "kg"}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  },
);

PackageSizeSelector.displayName = "PackageSizeSelector";

export { PackageSizeSelector };
export type { PackageDimensions, PackagePreset, UnitSystem };
