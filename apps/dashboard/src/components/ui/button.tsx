"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  href?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: cn(
    "bg-gradient-to-br from-wl-primary-500 to-wl-primary-600",
    "text-wl-text-inverse",
    "border border-wl-primary-600",
    "font-semibold",
    "hover:from-wl-primary-600 hover:to-wl-primary-700",
    "hover:shadow-md",
    "active:shadow-sm"
  ),
  secondary: cn(
    "bg-wl-bg-overlay text-wl-text-primary",
    "border border-wl-border-default",
    "font-medium",
    "hover:bg-wl-bg-elevated hover:border-wl-border-strong",
    "active:bg-wl-bg-elevated"
  ),
  ghost: cn(
    "bg-transparent text-wl-text-secondary",
    "border border-transparent",
    "font-medium",
    "hover:text-wl-text-primary hover:bg-wl-bg-overlay",
    "active:bg-wl-bg-surface"
  ),
  danger: cn(
    "bg-wl-danger-bg text-wl-danger-400",
    "border border-wl-danger-400/20",
    "font-semibold",
    "hover:bg-wl-danger-500/20 hover:border-wl-danger-500/30 hover:text-wl-danger-500",
    "active:bg-wl-danger-500/30"
  ),
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1 text-xs rounded-sm",
  md: "px-4 py-2 text-sm rounded-md",
  lg: "px-5 py-3 text-base rounded-md",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      className,
      disabled,
      href,
      ...props
    },
    ref
  ) => {
    const baseClassName = cn(
      "inline-flex items-center justify-center gap-2",
      "cursor-pointer font-family-sans",
      "transition-all duration-fast ease-default",
      "tracking-wider leading-snug whitespace-nowrap",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wl-primary-500",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      variantClasses[variant],
      sizeClasses[size],
      className
    );

    if (href) {
      return (
        <Link href={href} className={baseClassName}>
          {props.children}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        className={baseClassName}
        disabled={disabled}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
