"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Breadcrumb } from "./breadcrumb";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: boolean;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumb = true,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "bg-[#0f0f14]/60 border-b border-white/[0.06]",
        "px-6 py-5",
        className
      )}
    >
      {breadcrumb && <Breadcrumb className="mb-4" />}

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1
            className={cn(
              "text-2xl font-bold text-wl-text-primary",
              "tracking-tight leading-tight"
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-wl-text-secondary mt-1 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
