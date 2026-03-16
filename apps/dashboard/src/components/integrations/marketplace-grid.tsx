"use client";

import { useMemo, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* ═══════════════════════════════════════════════════════════
   MARKETPLACE GRID COMPONENT
   Responsive grid for 125+ integration cards
   ═══════════════════════════════════════════════════════════ */

type Category = string;
type Status = "AVAILABLE" | "CONNECTED" | "COMING_SOON" | "BETA";

export interface IntegrationCardData {
  id: string;
  slug: string;
  name: string;
  category: Category;
  description: string;
  status: Status;
  popular: boolean;
  connected: boolean;
  logo?: string;
}

export interface MarketplaceGridProps {
  items: IntegrationCardData[];
  groupByCategory?: boolean;
  onCardClick?: (provider: IntegrationCardData) => void;
  isLoading?: boolean;
}

/**
 * Virtualized grid component for displaying integration provider cards
 * Handles 125+ cards efficiently with animations
 */
export function MarketplaceGrid({
  items,
  groupByCategory = false,
  onCardClick,
  isLoading = false,
}: MarketplaceGridProps) {
  // Group items by category if needed
  const groupedItems = useMemo(() => {
    if (!groupByCategory) {
      return { "": items };
    }

    const groups: Record<string, IntegrationCardData[]> = {};
    items.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });

    return groups;
  }, [items, groupByCategory]);

  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4")}>
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-8")}>
      {Object.entries(groupedItems).map(([category, categoryItems]) => (
        <div key={category || "all"}>
          {category && groupByCategory && (
            <h3
              className={cn(
                "text-lg font-bold text-wl-text-primary mb-4 capitalize"
              )}
            >
              {category.replace(/_/g, " ")}
            </h3>
          )}

          <div
            className={cn(
              "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            )}
          >
            {categoryItems.map((provider, idx) => (
              <IntegrationCardInner
                key={provider.id}
                provider={provider}
                index={idx}
                onClick={() => onCardClick?.(provider)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface IntegrationCardInnerProps {
  provider: IntegrationCardData;
  index: number;
  onClick?: () => void;
}

function IntegrationCardInner({
  provider,
  index,
  onClick,
}: IntegrationCardInnerProps) {
  const statusVariant =
    provider.status === "CONNECTED"
      ? "success"
      : provider.status === "BETA"
        ? "info"
        : provider.status === "COMING_SOON"
          ? "default"
          : ("primary" as const);

  const animationDelay = `${index * 30}ms`;

  const cardContent = (
    <Card
      className={cn(
        "h-full flex flex-col hover:border-wl-border-strong transition-all wl-animate-in",
        provider.connected && "border-wl-success-400/30",
        onClick && "cursor-pointer"
      )}
      style={{ animationDelay } as React.CSSProperties}
      onClick={onClick}
      hover
    >
      {/* Logo Area */}
      <div
        className={cn(
          "w-full h-24 bg-wl-bg-surface rounded-lg mb-3 flex items-center justify-center"
        )}
      >
        {provider.logo ? (
          <img
            src={provider.logo}
            alt={provider.name}
            className="max-w-12 max-h-12 object-contain"
          />
        ) : (
          <span className="text-3xl">📦</span>
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 flex flex-col")}>
        <div className={cn("flex items-start justify-between gap-2 mb-2")}>
          <div>
            <h3 className={cn("text-sm font-semibold text-wl-text-primary")}>
              {provider.name}
            </h3>
            {provider.popular && (
              <Badge variant="primary" className="text-xs mt-1">
                Popular
              </Badge>
            )}
          </div>
        </div>

        <p className={cn("text-xs text-wl-text-tertiary mb-3 line-clamp-2")}>
          {provider.description}
        </p>

        <Badge variant="default" className="mb-3 w-fit text-xs">
          {provider.category.replace(/_/g, " ")}
        </Badge>

        <Badge
          variant={statusVariant}
          className={cn("mt-auto mb-3 w-fit text-xs")}
        >
          {provider.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Actions */}
      <div className={cn("flex gap-2 w-full")}>
        <Button variant="secondary" size="sm" className="flex-1">
          View Details
        </Button>
        {provider.connected && (
          <Button variant="ghost" size="sm" className="flex-1">
            Manage
          </Button>
        )}
      </div>
    </Card>
  );

  return (
    <Link href={`/integrations/marketplace/${provider.slug}`}>
      {cardContent}
    </Link>
  );
}

/**
 * Skeleton loading card for grid
 */
function SkeletonCard() {
  return (
    <div
      className={cn(
        "bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-5 animate-pulse"
      )}
    >
      <div className={cn("w-full h-24 bg-wl-bg-surface rounded-lg mb-3")} />
      <div className={cn("h-4 bg-wl-bg-surface rounded mb-2 w-3/4")} />
      <div className={cn("h-3 bg-wl-bg-surface rounded mb-4 w-full")} />
      <div className={cn("h-6 bg-wl-bg-surface rounded mb-2 w-20")} />
      <div className={cn("h-8 bg-wl-bg-surface rounded mt-auto")} />
    </div>
  );
}

/**
 * List view item component
 */
export function IntegrationListItem({
  provider,
  index,
  onClick,
}: IntegrationCardInnerProps) {
  const statusVariant =
    provider.status === "CONNECTED"
      ? "success"
      : provider.status === "BETA"
        ? "info"
        : provider.status === "COMING_SOON"
          ? "default"
          : ("primary" as const);

  const animationDelay = `${index * 30}ms`;

  const itemContent = (
    <Card
      className={cn(
        "flex items-center justify-between p-4 hover:border-wl-border-strong transition-all wl-animate-in",
        provider.connected && "border-wl-success-400/30",
        onClick && "cursor-pointer"
      )}
      style={{ animationDelay } as React.CSSProperties}
      onClick={onClick}
    >
      <div className={cn("flex-1 flex items-center gap-4 min-w-0")}>
        <div
          className={cn(
            "w-12 h-12 rounded-lg bg-wl-bg-surface flex items-center justify-center flex-shrink-0"
          )}
        >
          {provider.logo ? (
            <img
              src={provider.logo}
              alt={provider.name}
              className="max-w-8 max-h-8 object-contain"
            />
          ) : (
            <span className="text-xl">📦</span>
          )}
        </div>
        <div className={cn("flex-1 min-w-0")}>
          <h3 className={cn("text-sm font-semibold text-wl-text-primary")}>
            {provider.name}
          </h3>
          <p className={cn("text-xs text-wl-text-tertiary truncate")}>
            {provider.description}
          </p>
          <div className={cn("flex gap-2 mt-2 flex-wrap")}>
            <Badge variant="default" className="text-xs">
              {provider.category.replace(/_/g, " ")}
            </Badge>
            {provider.popular && (
              <Badge variant="primary" className="text-xs">
                Popular
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className={cn("flex items-center gap-3 flex-shrink-0")}>
        <Badge variant={statusVariant}>
          {provider.status.replace(/_/g, " ")}
        </Badge>
        <Button variant="secondary" size="sm">
          View
        </Button>
      </div>
    </Card>
  );

  return (
    <Link href={`/integrations/marketplace/${provider.slug}`}>
      {itemContent}
    </Link>
  );
}
