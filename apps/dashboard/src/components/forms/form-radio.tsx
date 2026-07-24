/**
 * Enhanced radio button component
 * Supports single radio, radio groups, and card-style options
 *
 * @example
 * ```tsx
 * <FormRadioGroup
 *   options={[{ value: '1', label: 'Option 1' }]}
 *   value="1"
 * />
 * ```
 */

"use client";

import { InputHTMLAttributes, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface RadioOption {
  value: string | number;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface FormRadioGroupProps {
  /** Radio options */
  options: RadioOption[];
  /** Selected value */
  value?: string | number;
  /** Callback when value changes */
  onChange?: (value: string | number) => void;
  /** Layout direction */
  layout?: "vertical" | "horizontal";
  /** Card-style display */
  cardStyle?: boolean;
  /** Whether field has error */
  hasError?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Field name for form submission */
  name?: string;
}

/**
 * Single radio button
 */
export function FormRadio({
  option,
  selected,
  onChange,
  disabled = false,
  name,
  cardStyle = false,
}: {
  option: RadioOption;
  selected: boolean;
  onChange: () => void;
  disabled?: boolean;
  name?: string;
  cardStyle?: boolean;
}) {
  const radioId = `radio-${option.value}-${Math.random().toString(36).substr(2, 9)}`;

  if (cardStyle) {
    return (
      <label
        htmlFor={radioId}
        className={cn(
          "relative flex items-start gap-3 p-4 rounded-lg",
          "border-2 transition-all duration-fast",
          "cursor-pointer",
          selected
            ? "border-wl-primary-500 bg-wl-primary-500/10"
            : "border-wl-border-default bg-wl-bg-surface hover:border-wl-border-strong",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        )}
      >
        <input
          id={radioId}
          type="radio"
          name={name}
          value={option.value}
          checked={selected}
          onChange={onChange}
          disabled={disabled}
          className="sr-only"
        />

        {/* Custom radio circle */}
        <div
          className={cn(
            "relative inline-flex items-center justify-center",
            "w-5 h-5 rounded-full flex-shrink-0 mt-0.5",
            "border-2 transition-colors duration-fast",
            selected
              ? "border-wl-primary-500 bg-wl-primary-500"
              : "border-wl-border-default bg-wl-bg-surface",
          )}
        >
          {selected && (
            <div className="w-2 h-2 rounded-full bg-wl-text-inverse" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium",
              selected && "text-wl-primary-500",
            )}
          >
            {option.label}
          </p>
          {option.description && (
            <p className="text-xs text-wl-text-tertiary mt-0.5">
              {option.description}
            </p>
          )}
        </div>
      </label>
    );
  }

  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        id={radioId}
        type="radio"
        name={name}
        value={option.value}
        checked={selected}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />

      {/* Custom radio circle */}
      <div
        className={cn(
          "relative inline-flex items-center justify-center",
          "w-5 h-5 rounded-full flex-shrink-0",
          "border-2 transition-colors duration-fast",
          selected
            ? "border-wl-primary-500 bg-wl-primary-500"
            : "border-wl-border-default bg-wl-bg-surface hover:border-wl-primary-400",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        )}
      >
        {selected && (
          <div className="w-2 h-2 rounded-full bg-wl-text-inverse" />
        )}
      </div>

      {/* Label */}
      <span
        className={cn(
          "text-sm font-medium",
          selected ? "text-wl-text-primary" : "text-wl-text-primary",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {option.label}
      </span>
    </label>
  );
}

/**
 * Radio group with multiple options
 */
export function FormRadioGroup({
  options,
  value,
  onChange,
  layout = "vertical",
  cardStyle = false,
  hasError = false,
  disabled = false,
  name = `radio-group-${Math.random().toString(36).substr(2, 9)}`,
}: FormRadioGroupProps) {
  return (
    <div
      className={cn(
        "flex gap-3",
        layout === "vertical" ? "flex-col" : "flex-row flex-wrap",
        cardStyle && "flex-col",
      )}
      role="radiogroup"
      aria-invalid={hasError}
    >
      {options.map((option) => (
        <FormRadio
          key={option.value}
          option={option}
          selected={value === option.value}
          onChange={() => onChange?.(option.value)}
          disabled={disabled || option.disabled}
          name={name}
          cardStyle={cardStyle}
        />
      ))}
    </div>
  );
}
