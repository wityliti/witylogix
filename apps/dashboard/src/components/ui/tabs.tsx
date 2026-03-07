"use client";

import { type ReactNode, type CSSProperties } from "react";

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
}

const sizeStyles: Record<TabSize, CSSProperties> = {
  sm: {
    fontSize: "var(--wl-text-xs)",
    padding: "var(--wl-space-2) var(--wl-space-3)",
  },
  md: {
    fontSize: "var(--wl-text-sm)",
    padding: "var(--wl-space-2) var(--wl-space-4)",
  },
};

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = "pills",
  size = "md",
  style,
}: TabsProps) {
  if (variant === "pills") {
    return (
      <div
        style={{
          display: "flex",
          gap: "var(--wl-space-2)",
          flexWrap: "wrap",
          ...style,
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--wl-space-2)",
                fontFamily: "var(--wl-font-sans)",
                fontWeight: 500,
                border: "1px solid",
                borderColor: isActive ? "var(--wl-primary-500)" : "var(--wl-border-default)",
                background: isActive
                  ? "rgba(245, 166, 35, 0.12)"
                  : "transparent",
                color: isActive ? "var(--wl-primary-400)" : "var(--wl-text-secondary)",
                borderRadius: "var(--wl-radius-full)",
                cursor: "pointer",
                transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
                ...sizeStyles[size],
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = "var(--wl-border-subtle)";
                  e.currentTarget.style.color = "var(--wl-text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = "var(--wl-border-default)";
                  e.currentTarget.style.color = "var(--wl-text-secondary)";
                }
              }}
            >
              {tab.icon && <span style={{ display: "flex", alignItems: "center" }}>{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    fontSize: "var(--wl-text-xs)",
                    fontWeight: 600,
                    color: "var(--wl-text-tertiary)",
                    marginLeft: "var(--wl-space-1)",
                  }}
                >
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
      <div style={{ ...style }}>
        <div
          style={{
            display: "flex",
            gap: "var(--wl-space-4)",
            borderBottom: "1px solid var(--wl-border-default)",
            position: "relative",
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--wl-space-2)",
                  fontFamily: "var(--wl-font-sans)",
                  fontWeight: isActive ? 600 : 500,
                  background: "transparent",
                  border: "none",
                  color: isActive ? "var(--wl-text-primary)" : "var(--wl-text-secondary)",
                  cursor: "pointer",
                  padding: "var(--wl-space-3) 0",
                  position: "relative",
                  transition: `color var(--wl-duration-fast) var(--wl-ease-default)`,
                  ...sizeStyles[size],
                  borderBottom: isActive ? "2px solid var(--wl-primary-500)" : "none",
                  marginBottom: "-1px",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = "var(--wl-text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = "var(--wl-text-secondary)";
                  }
                }}
              >
                {tab.icon && <span style={{ display: "flex", alignItems: "center" }}>{tab.icon}</span>}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      fontWeight: 600,
                      color: "var(--wl-text-tertiary)",
                      marginLeft: "var(--wl-space-1)",
                    }}
                  >
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
      style={{
        display: "inline-flex",
        gap: "var(--wl-space-1)",
        padding: "var(--wl-space-1)",
        background: "var(--wl-bg-surface)",
        borderRadius: "var(--wl-radius-lg)",
        ...style,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--wl-space-2)",
              fontFamily: "var(--wl-font-sans)",
              fontWeight: isActive ? 600 : 500,
              background: isActive ? "var(--wl-bg-elevated)" : "transparent",
              border: "none",
              color: isActive ? "var(--wl-text-primary)" : "var(--wl-text-secondary)",
              cursor: "pointer",
              transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
              borderRadius: "var(--wl-radius-md)",
              ...sizeStyles[size],
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = "var(--wl-text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = "var(--wl-text-secondary)";
              }
            }}
          >
            {tab.icon && <span style={{ display: "flex", alignItems: "center" }}>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                style={{
                  fontSize: "var(--wl-text-xs)",
                  fontWeight: 600,
                  color: "var(--wl-text-tertiary)",
                  marginLeft: "var(--wl-space-1)",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
