"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardPresetLayout {
  id: string;
  title: string;
  description: string;
  svgPreview: string;
}

const DASHBOARD_PRESETS: DashboardPresetLayout[] = [
  {
    id: "analytics-focus",
    title: "Analytics Focus",
    description: "Large charts and KPI cards with detailed analytics",
    svgPreview: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="30" height="100" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.5)"/>
      <rect x="50" y="30" width="30" height="80" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.5)"/>
      <rect x="90" y="20" width="30" height="90" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.5)"/>
      <rect x="130" y="40" width="30" height="70" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.5)"/>
      <rect x="170" y="25" width="20" height="85" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.5)"/>
    </svg>`,
  },
  {
    id: "table-heavy",
    title: "Table Heavy",
    description: "Data tables with sorting and filtering options",
    svgPreview: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
      <line x1="10" y1="15" x2="190" y2="15" stroke="rgba(59,130,246,0.5)" stroke-width="1"/>
      <line x1="10" y1="30" x2="190" y2="30" stroke="rgba(59,130,246,0.3)" stroke-width="1"/>
      <line x1="10" y1="45" x2="190" y2="45" stroke="rgba(59,130,246,0.3)" stroke-width="1"/>
      <line x1="10" y1="60" x2="190" y2="60" stroke="rgba(59,130,246,0.3)" stroke-width="1"/>
      <line x1="10" y1="75" x2="190" y2="75" stroke="rgba(59,130,246,0.3)" stroke-width="1"/>
      <line x1="10" y1="90" x2="190" y2="90" stroke="rgba(59,130,246,0.3)" stroke-width="1"/>
      <line x1="10" y1="105" x2="190" y2="105" stroke="rgba(59,130,246,0.3)" stroke-width="1"/>
    </svg>`,
  },
  {
    id: "map-centric",
    title: "Map Centric",
    description: "Interactive map with location data",
    svgPreview: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
      <circle cx="80" cy="50" r="40" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.4)"/>
      <circle cx="60" cy="40" r="3" fill="rgba(239,68,68,0.8)"/>
      <circle cx="100" cy="60" r="3" fill="rgba(34,197,94,0.8)"/>
      <circle cx="75" cy="75" r="3" fill="rgba(59,130,246,0.8)"/>
      <circle cx="150" cy="50" r="15" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.4)"/>
    </svg>`,
  },
  {
    id: "sidebar-layout",
    title: "Sidebar Layout",
    description: "Left sidebar navigation with main content area",
    svgPreview: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="30" height="100" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.5)"/>
      <rect x="50" y="10" width="140" height="25" fill="rgba(59,130,246,0.1)" stroke="rgba(59,130,246,0.3)"/>
      <rect x="50" y="45" width="140" height="55" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.4)"/>
    </svg>`,
  },
  {
    id: "minimal-cards",
    title: "Minimal Cards",
    description: "Clean card layout with essential metrics",
    svgPreview: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="40" height="50" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.4)"/>
      <rect x="60" y="10" width="40" height="50" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.4)"/>
      <rect x="110" y="10" width="40" height="50" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.4)"/>
      <rect x="160" y="10" width="30" height="50" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.4)"/>
      <rect x="10" y="70" width="180" height="40" fill="rgba(59,130,246,0.1)" stroke="rgba(59,130,246,0.3)"/>
    </svg>`,
  },
  {
    id: "full-width-chart",
    title: "Full Width Chart",
    description: "Large chart spanning entire width",
    svgPreview: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
      <polyline points="10,80 40,50 70,60 100,30 130,45 160,20 190,35" fill="none" stroke="rgba(59,130,246,0.6)" stroke-width="2"/>
      <polyline points="10,80 40,50 70,60 100,30 130,45 160,20 190,35" fill="rgba(59,130,246,0.1)" opacity="0.3"/>
      <line x1="10" y1="100" x2="190" y2="100" stroke="rgba(59,130,246,0.3)" stroke-width="1"/>
    </svg>`,
  },
  {
    id: "grid-layout",
    title: "Grid Layout",
    description: "Multi-column grid with flexible widgets",
    svgPreview: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="45" height="50" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.4)"/>
      <rect x="65" y="10" width="45" height="50" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.4)"/>
      <rect x="120" y="10" width="70" height="50" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.4)"/>
      <rect x="10" y="70" width="45" height="40" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.4)"/>
      <rect x="65" y="70" width="125" height="40" fill="rgba(59,130,246,0.1)" stroke="rgba(59,130,246,0.3)"/>
    </svg>`,
  },
  {
    id: "kpi-dashboard",
    title: "KPI Dashboard",
    description: "Key performance indicators focus",
    svgPreview: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="35" height="40" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.4)"/>
      <text x="28" y="35" font-size="20" font-weight="bold" text-anchor="middle" fill="rgba(34,197,94,0.6)">+42%</text>
      <rect x="55" y="10" width="35" height="40" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.4)"/>
      <text x="73" y="35" font-size="20" font-weight="bold" text-anchor="middle" fill="rgba(59,130,246,0.6)">$8.2K</text>
      <rect x="100" y="10" width="35" height="40" fill="rgba(249,115,22,0.15)" stroke="rgba(249,115,22,0.4)"/>
      <text x="118" y="35" font-size="20" font-weight="bold" text-anchor="middle" fill="rgba(249,115,22,0.6)">98%</text>
      <rect x="145" y="10" width="45" height="40" fill="rgba(168,85,247,0.15)" stroke="rgba(168,85,247,0.4)"/>
      <text x="168" y="35" font-size="16" font-weight="bold" text-anchor="middle" fill="rgba(168,85,247,0.6)">234</text>
      <rect x="10" y="60" width="180" height="50" fill="rgba(59,130,246,0.1)" stroke="rgba(59,130,246,0.3)"/>
    </svg>`,
  },
  {
    id: "ops-dashboard",
    title: "Operations",
    description: "Real-time operational metrics",
    svgPreview: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="30" r="15" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.4)" stroke-width="2"/>
      <circle cx="50" cy="30" r="8" fill="rgba(59,130,246,0.3)"/>
      <circle cx="130" cy="30" r="15" fill="rgba(239,68,68,0.15)" stroke="rgba(239,68,68,0.4)" stroke-width="2"/>
      <circle cx="130" cy="30" r="8" fill="rgba(239,68,68,0.3)"/>
      <rect x="10" y="60" width="180" height="50" fill="rgba(59,130,246,0.1)" stroke="rgba(59,130,246,0.3)"/>
    </svg>`,
  },
  {
    id: "custom-layout",
    title: "Custom Layout",
    description: "Fully customizable dashboard",
    svgPreview: `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
      <g stroke="rgba(59,130,246,0.4)" stroke-width="1" fill="none">
        <rect x="10" y="10" width="50" height="50"/>
        <rect x="70" y="10" width="50" height="50"/>
        <rect x="130" y="10" width="60" height="50"/>
        <rect x="10" y="70" width="30" height="40"/>
        <rect x="50" y="70" width="70" height="40"/>
        <rect x="130" y="70" width="60" height="40"/>
      </g>
      <circle cx="100" cy="60" r="20" fill="rgba(59,130,246,0.2)"/>
    </svg>`,
  },
];

interface DashboardPreviewCardProps extends Omit<
  HTMLAttributes<HTMLButtonElement>,
  "onSelect"
> {
  preset: DashboardPresetLayout;
  selected?: boolean;
  onPresetSelect?: (id: string) => void;
}

const DashboardPreviewCard = forwardRef<
  HTMLButtonElement,
  DashboardPreviewCardProps
>(({ preset, selected = false, onPresetSelect, className, ...props }, ref) => {
  return (
    <>
      <style>{`
          @keyframes float-up {
            from {
              transform: translateY(0);
            }
            to {
              transform: translateY(-4px);
            }
          }
          .preview-hover:hover {
            animation: float-up 0.3s ease-out forwards;
          }
          .preview-glow {
            box-shadow: 0 0 24px rgba(59, 130, 246, 0.4), 0 0 16px rgba(59, 130, 246, 0.2);
          }
        `}</style>
      <button
        ref={ref}
        onClick={() => onPresetSelect?.(preset.id)}
        className={cn(
          "relative flex flex-col gap-3 p-4 rounded-lg border-2 transition-all duration-base ease-default",
          "bg-wl-bg-overlay text-left preview-hover",
          selected
            ? "border-wl-primary-500 bg-wl-primary-500/10 preview-glow"
            : "border-wl-border-subtle hover:border-wl-border-default",
        )}
        {...props}
      >
        {/* Checkmark badge */}
        {selected && (
          <div className="absolute top-3 right-3 bg-wl-primary-500 rounded-full p-1 z-10">
            <Check className="w-4 h-4 text-wl-text-inverse" strokeWidth={3} />
          </div>
        )}

        {/* SVG Preview */}
        <div className="w-full aspect-video bg-wl-bg-surface rounded border border-wl-border-subtle overflow-hidden p-2">
          <div
            dangerouslySetInnerHTML={{ __html: preset.svgPreview }}
            className="w-full h-full"
          />
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-wl-text-primary">
          {preset.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-wl-text-tertiary leading-relaxed">
          {preset.description}
        </p>
      </button>
    </>
  );
});

DashboardPreviewCard.displayName = "DashboardPreviewCard";

interface DashboardPreviewGridProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onSelect"
> {
  selected?: string;
  onPresetSelect?: (id: string) => void;
}

const DashboardPreviewGrid = forwardRef<
  HTMLDivElement,
  DashboardPreviewGridProps
>(({ selected, onPresetSelect, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
        className,
      )}
      {...props}
    >
      {DASHBOARD_PRESETS.map((preset) => (
        <DashboardPreviewCard
          key={preset.id}
          preset={preset}
          selected={selected === preset.id}
          onPresetSelect={onPresetSelect}
        />
      ))}
    </div>
  );
});

DashboardPreviewGrid.displayName = "DashboardPreviewGrid";

export { DashboardPreviewCard, DashboardPreviewGrid, DASHBOARD_PRESETS };
export type { DashboardPreviewCardProps, DashboardPresetLayout };
