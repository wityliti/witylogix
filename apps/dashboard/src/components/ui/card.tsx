"use client";

import { forwardRef, type HTMLAttributes, type ReactNode, useEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  glow?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, hover, glow, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-[#13131a] border border-white/[0.08] rounded-xl p-5",
          "shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset]",
          "transition-all duration-base ease-default",
          hover && "hover:border-white/[0.14] hover:bg-[#161620] cursor-pointer",
          glow && "shadow-[0_0_20px_rgba(245,166,35,0.12),0_1px_0_0_rgba(255,255,255,0.07)_inset]",
          props.onClick && "cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

// MetricCard - animated counter card with optional trend
export interface MetricCardProps {
  value: number;
  label: string;
  trend?: {
    value: number;
    label: string;
  };
  icon?: ReactNode;
  accentColor?: string;
  className?: string;
  animated?: boolean;
  format?: (val: number) => string;
}

export function MetricCard({
  value,
  label,
  trend,
  icon,
  accentColor = "var(--wl-primary-500)",
  className,
  animated = true,
  format,
}: MetricCardProps) {
  const counterRef = useRef<HTMLDivElement>(null);
  const isTrendPositive = trend && trend.value >= 0;

  useEffect(() => {
    if (!animated || !counterRef.current) return;

    const target = value;
    const duration = 1000;
    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentValue = Math.floor(startValue + (target - startValue) * progress);

      if (counterRef.current) {
        counterRef.current.textContent = format ? format(currentValue) : currentValue.toString();
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [value, animated, format]);

  const formattedValue = format ? format(value) : value.toString();

  return (
    <div
      className={cn(
        "bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-5",
        "relative overflow-hidden",
        className
      )}
    >
      {/* Accent top line */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
        }}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <span className="text-sm font-medium text-wl-text-secondary tracking-wider">
          {label}
        </span>
        {icon && (
          <span
            className="flex items-center opacity-70"
            style={{ color: accentColor }}
          >
            {icon}
          </span>
        )}
      </div>

      {/* Main value with animation counter */}
      <div className="space-y-2">
        <div
          ref={counterRef}
          className="text-4xl font-bold text-wl-text-primary leading-tight font-mono -tracking-wider"
        >
          {formattedValue}
        </div>

        {/* Trend indicator */}
        {trend && (
          <div className="flex items-center gap-2 pt-2">
            <span
              className={cn(
                "text-sm font-semibold font-mono flex items-center gap-1",
                isTrendPositive ? "text-wl-success-500" : "text-wl-danger-500"
              )}
            >
              {isTrendPositive ? "↑" : "↓"}
              {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-wl-text-tertiary">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// StatCard - simple stat display card with optional change indicator
export interface StatCardProps {
  label: string;
  value: string | number;
  change?: { value: number; label: string };
  icon?: ReactNode;
  accentColor?: string;
  style?: CSSProperties;
  className?: string;
  index?: number;
}

export function StatCard({
  label,
  value,
  change,
  icon,
  accentColor = "var(--wl-primary-500)",
  style,
  className,
  index = 0,
}: StatCardProps) {
  const isPositive = change && change.value >= 0;

  return (
    <div
      className={cn(
        "wl-animate-in bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-5",
        "relative overflow-hidden",
        className
      )}
      style={{
        animationDelay: `${index * 80}ms`,
        ...style,
      }}
    >
      {/* Accent top line */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
        }}
      />

      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-wl-text-secondary tracking-wider">
          {label}
        </span>
        {icon && (
          <span
            className="flex items-center opacity-70"
            style={{ color: accentColor }}
          >
            {icon}
          </span>
        )}
      </div>

      <div className="text-3xl font-bold text-wl-text-primary leading-tight font-mono -tracking-wider">
        {value}
      </div>

      {change && (
        <div className="flex items-center gap-1 mt-2">
          <span
            className={cn(
              "text-xs font-semibold font-mono",
              isPositive ? "text-wl-success-400" : "text-wl-danger-400"
            )}
          >
            {isPositive ? "+" : ""}
            {change.value}%
          </span>
          <span className="text-xs text-wl-text-tertiary">
            {change.label}
          </span>
        </div>
      )}
    </div>
  );
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between mb-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
CardHeader.displayName = "CardHeader";

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "text-sm font-semibold text-wl-text-secondary tracking-wider uppercase m-0",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  )
);
CardTitle.displayName = "CardTitle";

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={className}
      {...props}
    >
      {children}
    </div>
  )
);
CardContent.displayName = "CardContent";

interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        "text-sm text-wl-text-secondary leading-relaxed mt-1",
        className
      )}
      {...props}
    >
      {children}
    </p>
  )
);
CardDescription.displayName = "CardDescription";

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-end gap-2 mt-4 pt-4 border-t border-wl-border-subtle",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
};
