"use client";

import { forwardRef, useState, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SelectSize = "sm" | "md" | "lg";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  size?: SelectSize;
}

const sizeClasses: Record<SelectSize, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-4 py-3 text-base",
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      options,
      placeholder,
      error,
      disabled = false,
      size = "md",
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const handleFocus = (e: React.FocusEvent<HTMLSelectElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLSelectElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-sm font-semibold text-wl-text-primary">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            ref={ref}
            className={cn(
              "w-full font-sans bg-wl-bg-surface text-wl-text-primary",
              "border rounded-md outline-none appearance-none",
              "transition-all duration-fast ease-default",
              error
                ? "border-wl-danger-400 focus:border-wl-danger-500"
                : isFocused
                  ? "border-wl-primary-500"
                  : "border-wl-border-default focus:border-wl-primary-500",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              "pr-10",
              sizeClasses[size],
              className
            )}
            disabled={disabled}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <svg
            className="absolute right-3 w-4 h-4 text-wl-text-secondary pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {error && (
          <span className="text-xs text-wl-danger-400">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select };
