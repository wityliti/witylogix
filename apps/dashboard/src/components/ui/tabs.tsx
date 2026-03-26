"use client";

import { type ReactNode, type CSSProperties } from "react";
import { cn } from "../../lib/utils";

type TabVariant = "pills" | "underline" | "segment";
type TabSize = "sm" | "md";

interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: TabVariant;
  size?: TabSize;
  style?: CSSProperties;
  className?: string;
}

export function Tabs({
  tabs = [],
  activeTab,
  onChange,
  variant = "pills",
  size = "md",
  style,
  className,
}: TabsProps) {
  if (variant === "pills") {
    return (
      <div
        className={cn("flex gap-2 flex-wrap", className)}
        style={style}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 font-sans font-medium",
                "border rounded-full cursor-pointer transition-all duration-fast ease-default",
                size === "sm" && "px-3 py-2 text-xs",
                size === "md" && "px-4 py-2 text-sm",
                isActive
                  ? "border-wl-primary-500 bg-wl-primary-500/20 text-wl-primary-400"
                  : "border-wl-border-default text-wl-text-secondary hover:border-wl-border-subtle hover:text-wl-text-primary"
              )}
            >
              {tab.icon && <span className="flex items-center">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="text-xs font-semibold text-wl-text-tertiary ml-1">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "underline") {
    return (
      <div className={className} style={style}>
        <div className="flex gap-4 border-b border-wl-border-default relative">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 font-sans",
                  "bg-transparent border-none cursor-pointer padding-relative",
                  "transition-colors duration-fast ease-default",
                  size === "sm" && "px-0 py-3 text-xs",
                  size === "md" && "px-0 py-3 text-sm",
                  isActive
                    ? "font-semibold text-wl-text-primary border-b-2 border-wl-primary-500 -mb-px"
                    : "font-medium text-wl-text-secondary hover:text-wl-text-primary"
                )}
              >
                {tab.icon && <span className="flex items-center">{tab.icon}</span>}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="text-xs font-semibold text-wl-text-tertiary ml-1">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // segment variant
  return (
    <div
      className={cn(
        "inline-flex gap-1 p-1 bg-wl-bg-surface rounded-lg",
        className
      )}
      style={style}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2 font-sans",
              "border-none cursor-pointer transition-all duration-fast ease-default",
              "rounded-md",
              size === "sm" && "px-3 py-2 text-xs",
              size === "md" && "px-4 py-2 text-sm",
              isActive
                ? "bg-wl-bg-elevated font-semibold text-wl-text-primary"
                : "bg-transparent font-medium text-wl-text-secondary hover:text-wl-text-primary"
            )}
          >
            {tab.icon && <span className="flex items-center">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="text-xs font-semibold text-wl-text-tertiary ml-1">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
