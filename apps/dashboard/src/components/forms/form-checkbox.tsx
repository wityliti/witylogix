/**
 * Enhanced checkbox component
 * Supports single checkbox, checkbox groups, and indeterminate state
 *
 * @example
 * ```tsx
 * <FormCheckbox label="I agree" />
 *
 * <FormCheckboxGroup
 *   options={[{ value: '1', label: 'Option 1' }]}
 *   value={['1']}
 * />
 * ```
 */

"use client";

import { forwardRef, InputHTMLAttributes, useState, useCallback } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface FormCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Checkbox label */
  label?: string;
  /** Indeterminate state (renders minus icon) */
  indeterminate?: boolean;
  /** Whether field has error */
  hasError?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
}

interface FormCheckboxGroupProps {
  /** Checkbox options */
  options: CheckboxOption[];
  /** Selected values */
  value?: (string | number)[];
  /** Whether to show select all option */
  showSelectAll?: boolean;
  /** Callback when values change */
  onChange?: (values: (string | number)[]) => void;
  /** Whether field has error */
  hasError?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Layout direction */
  layout?: "vertical" | "horizontal";
}

/**
 * Single checkbox with label and indeterminate state
 */
export const FormCheckbox = forwardRef<HTMLInputElement, FormCheckboxProps>(
  (
    {
      label,
      indeterminate = false,
      hasError = false,
      disabled = false,
      checked,
      onChange,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={cn("flex items-center gap-3", className)}>
        {/* Hidden input */}
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only"
          aria-invalid={hasError}
          {...props}
        />

        {/* Custom checkbox */}
        <label
          htmlFor={checkboxId}
          className={cn(
            "relative inline-flex items-center justify-center",
            "w-5 h-5 rounded-md flex-shrink-0",
            "border-2 transition-colors duration-fast ease-default",
            "cursor-pointer",
            hasError
              ? "border-wl-danger-400 bg-wl-danger-bg"
              : checked || indeterminate
                ? "border-wl-primary-500 bg-wl-primary-500"
                : "border-wl-border-default bg-wl-bg-surface",
            "hover:border-wl-primary-400",
            disabled && "opacity-50 cursor-not-allowed pointer-events-none"
          )}
        >
          {indeterminate && (
            <Minus size={14} className="text-wl-text-inverse pointer-events-none" />
          )}
          {checked && !indeterminate && (
            <Check size={14} className="text-wl-text-inverse pointer-events-none" />
          )}
        </label>

        {/* Label */}
        {label && (
          <label
            htmlFor={checkboxId}
            className={cn(
              "text-sm font-medium cursor-pointer select-none",
              hasError ? "text-wl-danger-400" : "text-wl-text-primary",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

FormCheckbox.displayName = "FormCheckbox";

/**
 * Checkbox group with multiple options
 */
export function FormCheckboxGroup({
  options,
  value = [],
  showSelectAll = false,
  onChange,
  hasError = false,
  disabled = false,
  layout = "vertical",
}: FormCheckboxGroupProps) {
  const [selectAllIndeterminate, setSelectAllIndeterminate] = useState(false);

  /**
   * Check if all options are selected
   */
  const allSelected = options.every((opt) => value.includes(opt.value));

  /**
   * Check if some options are selected
   */
  const someSelected = options.some((opt) => value.includes(opt.value));

  /**
   * Handle select all change
   */
  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      onChange?.([]);
    } else {
      onChange?.(options.map((opt) => opt.value));
    }
  }, [allSelected, options, onChange]);

  /**
   * Handle individual option change
   */
  const handleOptionChange = useCallback(
    (optionValue: string | number, checked: boolean) => {
      const newValues = checked
        ? [...value, optionValue]
        : value.filter((v) => v !== optionValue);
      onChange?.(newValues);
    },
    [value, onChange]
  );

  return (
    <div className={cn("flex flex-col gap-3")}>
      {/* Select all option */}
      {showSelectAll && (
        <FormCheckbox
          label="Select All"
          checked={allSelected}
          indeterminate={someSelected && !allSelected}
          onChange={() => handleSelectAll()}
          disabled={disabled}
          hasError={hasError}
        />
      )}

      {/* Checkbox options */}
      <div
        className={cn(
          "flex gap-3",
          layout === "vertical" ? "flex-col" : "flex-row flex-wrap"
        )}
      >
        {options.map((option) => (
          <FormCheckbox
            key={option.value}
            label={option.label}
            checked={value.includes(option.value)}
            onChange={(e) => handleOptionChange(option.value, e.target.checked)}
            disabled={disabled || option.disabled}
            hasError={hasError}
          />
        ))}
      </div>
    </div>
  );
}
