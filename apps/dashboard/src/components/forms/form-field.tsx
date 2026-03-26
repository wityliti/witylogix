/**
 * Form field wrapper component
 * Provides consistent styling and accessibility for form fields with labels, errors, and helper text
 *
 * @example
 * ```tsx
 * <FormField label="Email" required error={error} helperText="We'll never share your email">
 *   <input type="email" />
 * </FormField>
 * ```
 */

"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FormFieldVariant = "default" | "inline" | "floating-label";

interface FormFieldProps {
  /** Field label text */
  label?: string;
  /** Whether field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Helper text to display below the field */
  helperText?: string;
  /** Character count (for text inputs) */
  characterCount?: { current: number; max: number };
  /** Form field variant */
  variant?: FormFieldVariant;
  /** Child form input element */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Field ID for label association */
  id?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Form field wrapper with label, error message, and helper text
 * Provides consistent styling and accessibility across form fields
 */
export function FormField({
  label,
  required = false,
  error,
  helperText,
  characterCount,
  variant = "default",
  children,
  className,
  id,
  disabled = false,
}: FormFieldProps) {
  const fieldId = id || `field-${Math.random().toString(36).substr(2, 9)}`;
  const hasError = !!error;

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        variant === "inline" && "flex-row items-center",
        variant === "floating-label" && "relative",
        className
      )}
    >
      {/* Label */}
      {label && (
        <label
          htmlFor={fieldId}
          className={cn(
            "text-sm font-medium",
            hasError ? "text-wl-danger-400" : "text-wl-text-primary",
            disabled && "opacity-50"
          )}
        >
          {label}
          {required && (
            <span className="ml-1 text-wl-danger-400" aria-label="required">
              *
            </span>
          )}
        </label>
      )}

      {/* Input wrapper */}
      <div className="flex flex-col gap-1">
        <div
          className={cn(
            variant === "floating-label" && "relative",
            "flex items-center"
          )}
        >
          {children}
        </div>

        {/* Character count */}
        {characterCount && (
          <div className="flex justify-end">
            <span
              className={cn(
                "text-xs",
                characterCount.current > characterCount.max * 0.9
                  ? "text-wl-warning-400"
                  : "text-wl-text-tertiary"
              )}
            >
              {characterCount.current} / {characterCount.max}
            </span>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-1.5 text-xs text-wl-danger-400 animate-in fade-in-50 slide-in-from-top-1"
          aria-describedby={`${fieldId}-error`}
        >
          <svg
            className="w-3.5 h-3.5 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm.464-4.464a1 1 0 111.414-1.414L11 6.586V4a1 1 0 112 0v4a1 1 0 01-1.414 1.414L10 7.414v2.172z"
              clipRule="evenodd"
            />
          </svg>
          <span id={`${fieldId}-error`}>{error}</span>
        </div>
      )}

      {/* Helper text */}
      {helperText && !error && (
        <p
          className="text-xs text-wl-text-tertiary"
          aria-describedby={`${fieldId}-helper`}
          id={`${fieldId}-helper`}
        >
          {helperText}
        </p>
      )}
    </div>
  );
}
