"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

type InputSize = "sm" | "md" | "lg";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  size?: InputSize;
}

const sizeClasses: Record<InputSize, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-4 py-3 text-base",
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      icon,
      size = "md",
      disabled,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-sm font-semibold text-wl-text-primary">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {icon && (
            <span className="absolute left-3 flex items-center text-wl-text-secondary pointer-events-none">
              {icon}
            </span>
          )}

          <input
            ref={ref}
            className={cn(
              "w-full font-sans bg-wl-bg-surface text-wl-text-primary",
              "border rounded-md outline-none",
              "transition-all duration-fast ease-default",
              error
                ? "border-wl-danger-400 focus:border-wl-danger-500"
                : isFocused
                  ? "border-wl-primary-500"
                  : "border-wl-border-default focus:border-wl-primary-500",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              icon && "pl-10",
              sizeClasses[size],
              className
            )}
            disabled={disabled}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
          />
        </div>

        {error && (
          <span className="text-xs text-wl-danger-400">
            {error}
          </span>
        )}

        {hint && !error && (
          <span className="text-xs text-wl-text-tertiary">
            {hint}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      disabled,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-sm font-semibold text-wl-text-primary">
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          className={cn(
            "w-full font-sans bg-wl-bg-surface text-wl-text-primary",
            "border rounded-md outline-none",
            "px-4 py-3 text-sm",
            "transition-all duration-fast ease-default",
            error
              ? "border-wl-danger-400 focus:border-wl-danger-500"
              : isFocused
                ? "border-wl-primary-500"
                : "border-wl-border-default focus:border-wl-primary-500",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "resize-vertical min-h-20",
            className
          )}
          disabled={disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {error && (
          <span className="text-xs text-wl-danger-400">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export { Input, Textarea };
