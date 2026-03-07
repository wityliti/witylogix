"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "primary";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "text-wl-neutral-300 bg-white/6",
  success: "text-wl-success-400 bg-wl-success-bg",
  warning: "text-wl-warning-400 bg-wl-warning-bg",
  danger: "text-wl-danger-400 bg-wl-danger-bg",
  info: "text-wl-info-400 bg-wl-info-bg",
  primary: "text-wl-primary-400 bg-wl-primary-500/12",
};

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, children, variant = "default", dot, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1",
          "text-xs font-semibold",
          "px-2 py-0.5",
          "rounded-full",
          "tracking-wide uppercase",
          "leading-relaxed whitespace-nowrap",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              "bg-current flex-shrink-0"
            )}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

export { Badge };
