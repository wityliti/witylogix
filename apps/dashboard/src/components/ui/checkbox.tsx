"use client";

import { forwardRef, InputHTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  error?: boolean;
  errorMessage?: string;
  indeterminate?: boolean;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      error = false,
      errorMessage,
      indeterminate = false,
      disabled = false,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label
          htmlFor={checkboxId}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div
            className={cn(
              "relative inline-flex items-center justify-center",
              "w-5 h-5 rounded-md",
              "transition-colors duration-fast ease-default",
              "border-2",
              error
                ? "border-wl-danger-400 bg-wl-danger-bg"
                : props.checked || indeterminate
                  ? "border-wl-primary-500 bg-wl-primary-500"
                  : "border-wl-border-default bg-wl-bg-surface",
              "group-hover:border-wl-primary-400",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <input
              ref={ref}
              id={checkboxId}
              type="checkbox"
              disabled={disabled}
              className="absolute w-full h-full opacity-0 cursor-pointer"
              {...props}
            />
            {(props.checked || indeterminate) && (
              <Check
                size={16}
                className="text-wl-text-inverse pointer-events-none"
                strokeWidth={3}
              />
            )}
          </div>
          {label && (
            <span
              className={cn(
                "text-sm font-medium",
                error ? "text-wl-danger-400" : "text-wl-text-primary"
              )}
            >
              {label}
            </span>
          )}
        </label>
        {error && errorMessage && (
          <span className="text-xs text-wl-danger-400 ml-8">
            {errorMessage}
          </span>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
