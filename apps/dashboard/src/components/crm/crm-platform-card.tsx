"use client";

import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CrmPlatform {
  id: string;
  name: string;
  description: string;
  logo: string;
  isConnected: boolean;
  connectionStatus?: "connected" | "error" | "pending";
}

interface CrmPlatformCardProps {
  platform: CrmPlatform;
  onSelect: (platformId: string) => void;
  isSelected?: boolean;
}

const getPlatformIcon = (platformId: string): React.ReactNode => {
  const icons: Record<string, string> = {
    salesforce: "☁️",
    hubspot: "🎯",
    zoho: "🔷",
    pipedrive: "📈",
    "ms-dynamics": "💼",
  };

  return icons[platformId] || "🔗";
};

const getPlatformColor = (
  platformId: string,
): "primary" | "success" | "warning" | "danger" | "info" => {
  const colors: Record<
    string,
    "primary" | "success" | "warning" | "danger" | "info"
  > = {
    salesforce: "primary",
    hubspot: "info",
    zoho: "warning",
    pipedrive: "success",
    "ms-dynamics": "danger",
  };

  return colors[platformId] || "primary";
};

const CrmPlatformCard = memo(function CrmPlatformCard({
  platform,
  onSelect,
  isSelected = false,
}: CrmPlatformCardProps) {
  const handleClick = useCallback(() => {
    onSelect(platform.id);
  }, [platform.id, onSelect]);

  return (
    <Card
      hover
      className={cn(
        "flex flex-col p-6",
        "transition-all duration-base ease-default",
        isSelected &&
          "border-wl-primary-400 shadow-lg shadow-wl-primary-500/20",
      )}
      onClick={handleClick}
    >
      {/* Icon and Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="text-4xl">{getPlatformIcon(platform.id)}</div>
        {isSelected && (
          <div
            className={cn(
              "w-5 h-5 rounded-full",
              "bg-wl-primary-500 flex items-center justify-center",
              "flex-shrink-0",
            )}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        )}
      </div>

      {/* Platform Name */}
      <h3 className={cn("text-lg font-bold text-wl-text-primary mb-1")}>
        {platform.name}
      </h3>

      {/* Description */}
      <p
        className={cn(
          "text-sm text-wl-text-tertiary mb-4 flex-1 leading-relaxed",
        )}
      >
        {platform.description}
      </p>

      {/* Status Badge */}
      <div className="flex items-center gap-2 mb-4">
        {platform.isConnected && (
          <Badge
            variant="success"
            dot
            className={cn("text-xs", "whitespace-nowrap")}
          >
            Connected
          </Badge>
        )}
        {platform.connectionStatus === "error" && (
          <Badge
            variant="danger"
            dot
            className={cn("text-xs", "whitespace-nowrap")}
          >
            Error
          </Badge>
        )}
        {platform.connectionStatus === "pending" && (
          <Badge
            variant="warning"
            dot
            className={cn("text-xs", "whitespace-nowrap")}
          >
            Pending
          </Badge>
        )}
        {!platform.isConnected && !platform.connectionStatus && (
          <Badge
            variant="default"
            className={cn("text-xs", "whitespace-nowrap")}
          >
            Not Connected
          </Badge>
        )}
      </div>

      {/* Action Button */}
      <Button
        variant="secondary"
        size="sm"
        onClick={handleClick}
        className={cn("w-full", isSelected && "opacity-75")}
      >
        {platform.isConnected ? "Reconfigure" : "Connect"}
      </Button>
    </Card>
  );
});

export { CrmPlatformCard };
export type { CrmPlatform as CrmPlatformType };
