"use client";

import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between",
        "px-6 py-5",
        "border-b border-wl-border-subtle",
        "bg-wl-bg-surface backdrop-blur-sm",
        "sticky top-0 z-40"
      )}
    >
      <div>
        <h1
          className={cn(
            "text-xl font-bold",
            "text-wl-text-primary",
            "m-0",
            "tracking-tighter"
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={cn(
              "text-sm",
              "text-wl-text-tertiary",
              "mt-0.5 mb-0"
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3">
          {actions}
        </div>
      )}
    </header>
  );
}
