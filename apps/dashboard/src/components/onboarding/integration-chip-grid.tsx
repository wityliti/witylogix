"use client";

import { forwardRef, useState, useMemo, type HTMLAttributes } from "react";
import { Search, Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Integration {
  id: string;
  name: string;
  category: string;
  color: string;
}

interface IntegrationCategory {
  category: string;
  integrations: Integration[];
}

const INTEGRATIONS: Integration[] = [
  // ERP
  { id: "sap", name: "SAP", category: "ERP", color: "#0066CC" },
  { id: "oracle", name: "Oracle", category: "ERP", color: "#F80000" },
  {
    id: "microsoft-dynamics",
    name: "Microsoft Dynamics",
    category: "ERP",
    color: "#00A4EF",
  },
  { id: "infor", name: "Infor", category: "ERP", color: "#003366" },
  { id: "epicor", name: "Epicor", category: "ERP", color: "#003D7A" },
  { id: "NetSuite", name: "NetSuite", category: "ERP", color: "#003D7A" },

  // CRM
  { id: "salesforce", name: "Salesforce", category: "CRM", color: "#00A1E0" },
  { id: "hubspot", name: "HubSpot", category: "CRM", color: "#FF7A59" },
  { id: "pipedrive", name: "Pipedrive", category: "CRM", color: "#1EBE6D" },
  { id: "zoho", name: "Zoho CRM", category: "CRM", color: "#0F1F78" },
  {
    id: "ms-dynamics-crm",
    name: "Dynamics 365",
    category: "CRM",
    color: "#00A4EF",
  },

  // Accounting
  {
    id: "quickbooks",
    name: "QuickBooks",
    category: "Accounting",
    color: "#31A54C",
  },
  { id: "xero", name: "Xero", category: "Accounting", color: "#003B61" },
  {
    id: "freshbooks",
    name: "FreshBooks",
    category: "Accounting",
    color: "#1CBDA8",
  },
  { id: "wave", name: "Wave", category: "Accounting", color: "#FFA500" },

  // Warehouse
  {
    id: "oracle-netsuite",
    name: "Oracle WMS",
    category: "Warehouse",
    color: "#F80000",
  },
  {
    id: "manhattan",
    name: "Manhattan",
    category: "Warehouse",
    color: "#003D7A",
  },
  { id: "highjump", name: "HighJump", category: "Warehouse", color: "#004B96" },
  { id: "kinaxis", name: "Kinaxis", category: "Warehouse", color: "#0096D6" },

  // TMS
  { id: "jda", name: "JDA", category: "TMS", color: "#003D7A" },
  { id: "descartes", name: "Descartes", category: "TMS", color: "#004B96" },
  { id: "fourkites", name: "FourKites", category: "TMS", color: "#0066CC" },
  { id: "sensormatic", name: "Sensormatic", category: "TMS", color: "#003D7A" },
];

interface IntegrationChipGridProps extends HTMLAttributes<HTMLDivElement> {
  selected?: string[];
  onSelectionChange?: (selected: string[]) => void;
  maxInitialShow?: number;
}

const IntegrationChipGrid = forwardRef<
  HTMLDivElement,
  IntegrationChipGridProps
>(
  (
    {
      selected = [],
      onSelectionChange,
      maxInitialShow = 4,
      className,
      ...props
    },
    ref,
  ) => {
    const [localSelected, setLocalSelected] = useState(selected);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
      new Set(["ERP", "CRM", "Accounting"]),
    );

    const selectedList = selected.length > 0 ? selected : localSelected;

    const handleToggle = (integrationId: string) => {
      let newSelected: string[];
      if (selectedList.includes(integrationId)) {
        newSelected = selectedList.filter((id) => id !== integrationId);
      } else {
        newSelected = [...selectedList, integrationId];
      }
      setLocalSelected(newSelected);
      onSelectionChange?.(newSelected);
    };

    const toggleCategory = (category: string) => {
      const newExpanded = new Set(expandedCategories);
      if (newExpanded.has(category)) {
        newExpanded.delete(category);
      } else {
        newExpanded.add(category);
      }
      setExpandedCategories(newExpanded);
    };

    // Group integrations by category
    const grouped = useMemo(() => {
      const groups: Record<string, Integration[]> = {};
      INTEGRATIONS.forEach((int) => {
        if (!groups[int.category]) {
          groups[int.category] = [];
        }
        groups[int.category].push(int);
      });

      // Filter by search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        Object.keys(groups).forEach((cat) => {
          groups[cat] = groups[cat].filter(
            (int) =>
              int.name.toLowerCase().includes(query) ||
              int.category.toLowerCase().includes(query),
          );
        });
      }

      return Object.entries(groups)
        .map(([category, integrations]) => ({ category, integrations }))
        .filter((g) => g.integrations.length > 0)
        .sort((a, b) => a.category.localeCompare(b.category));
    }, [searchQuery]);

    return (
      <>
        <style>{`
          @keyframes toggle-scale {
            from {
              transform: scale(0.9);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }
          .chip-toggle-animate {
            animation: toggle-scale 0.15s ease-out;
          }
        `}</style>
        <div ref={ref} className={cn("w-full space-y-6", className)} {...props}>
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-tertiary pointer-events-none" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-10 pr-3 py-2 bg-wl-bg-overlay border rounded-md",
                "text-sm text-wl-text-primary placeholder-wl-text-tertiary",
                "border-wl-border-subtle focus:border-wl-primary-500",
                "focus:outline-none transition-colors duration-base",
              )}
            />
          </div>

          {/* Selection counter */}
          <div className="text-sm font-semibold text-wl-text-secondary tracking-wider">
            {selectedList.length === 0
              ? "No integrations selected"
              : `${selectedList.length} integration${selectedList.length === 1 ? "" : "s"} selected`}
          </div>

          {/* Categories */}
          <div className="space-y-4">
            {grouped.map(({ category, integrations }) => {
              const isExpanded = expandedCategories.has(category);
              const displayCount = isExpanded
                ? integrations.length
                : maxInitialShow;
              const hasMore = integrations.length > maxInitialShow;
              const displayed = integrations.slice(0, displayCount);

              return (
                <div key={category}>
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="flex items-center justify-between w-full mb-3 px-2 py-1"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-wl-text-primary">
                        {category}
                      </h3>
                      <Badge variant="default" className="text-xs px-1.5">
                        {integrations.length}
                      </Badge>
                    </div>
                    {hasMore &&
                      (isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-wl-text-tertiary" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-wl-text-tertiary" />
                      ))}
                  </button>

                  {/* Integration chips */}
                  <div className="flex flex-wrap gap-2">
                    {displayed.map((integration) => {
                      const isSelected = selectedList.includes(integration.id);
                      return (
                        <button
                          key={integration.id}
                          onClick={() => handleToggle(integration.id)}
                          className={cn(
                            "chip-toggle-animate",
                            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
                            "text-xs font-medium transition-all duration-base ease-default",
                            "border-2 focus:outline-none focus:ring-2 focus:ring-wl-primary-500/50",
                            isSelected
                              ? "bg-wl-primary-500/15 border-wl-primary-500 text-wl-primary-400"
                              : "bg-transparent border-wl-border-subtle text-wl-text-secondary hover:border-wl-border-default",
                          )}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: integration.color }}
                            aria-hidden="true"
                          />
                          {integration.name}
                          {isSelected && (
                            <Check
                              className="w-3 h-3 flex-shrink-0"
                              strokeWidth={3}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Show more/less button */}
                  {hasMore && (
                    <button
                      onClick={() => toggleCategory(category)}
                      className="mt-2 text-xs font-semibold text-wl-primary-400 hover:text-wl-primary-300 transition-colors"
                    >
                      {isExpanded
                        ? `Show Less (${integrations.length - maxInitialShow} hidden)`
                        : `Show More (+${integrations.length - maxInitialShow})`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* No results */}
          {grouped.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-wl-text-tertiary">
                No integrations match your search
              </p>
            </div>
          )}
        </div>
      </>
    );
  },
);

IntegrationChipGrid.displayName = "IntegrationChipGrid";

export { IntegrationChipGrid };
export type { IntegrationChipGridProps, Integration };
