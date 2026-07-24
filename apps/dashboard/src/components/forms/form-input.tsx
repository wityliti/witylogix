/**
 * Enhanced text input component
 * Supports multiple input types, icons, password visibility toggle, and formatting
 *
 * @example
 * ```tsx
 * <FormInput
 *   type="email"
 *   prefix={<Mail size={18} />}
 *   placeholder="your@email.com"
 * />
 * ```
 */

"use client";

import {
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  useState,
  useCallback,
  useRef,
} from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { cn } from "@/lib/utils";

type InputType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "tel"
  | "url"
  | "search";

export interface FormInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "prefix"
> {
  /** Input type */
  type?: InputType;
  /** Prefix element (icon or text) */
  prefix?: ReactNode;
  /** Suffix element (icon or text) */
  suffix?: ReactNode;
  /** Show clear button */
  showClear?: boolean;
  /** Auto-format option: 'phone', 'currency', or none */
  autoFormat?: "phone" | "currency" | "none";
  /** Debounce delay in ms for onChange (useful for search) */
  debounceMs?: number;
  /** Whether field has error */
  hasError?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Callback when clear button is clicked */
  onClear?: () => void;
}

/**
 * Format phone number as (XXX) XXX-XXXX
 */
function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

/**
 * Format number as currency with thousand separators
 */
function formatCurrency(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Enhanced text input with icons, formatting, and visibility toggle
 */
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      type = "text",
      prefix,
      suffix,
      showClear = false,
      autoFormat = "none",
      debounceMs = 0,
      hasError = false,
      disabled = false,
      value,
      onChange,
      onClear,
      className,
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const debounceTimeoutRef = useRef<NodeJS.Timeout>();
    const internalValueRef = useRef<string>(String(value || ""));

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        let finalValue = e.target.value;

        // Apply formatting
        if (type === "tel" && autoFormat === "phone") {
          finalValue = formatPhoneNumber(finalValue);
        } else if (type === "number" && autoFormat === "currency") {
          finalValue = formatCurrency(finalValue);
        }

        internalValueRef.current = finalValue;

        // Debounce onChange
        if (debounceMs > 0 && onChange) {
          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
          }
          debounceTimeoutRef.current = setTimeout(() => {
            onChange({
              ...e,
              target: { ...e.target, value: finalValue },
            } as any);
          }, debounceMs);
        } else {
          onChange?.({
            ...e,
            target: { ...e.target, value: finalValue },
          } as any);
        }
      },
      [type, autoFormat, debounceMs, onChange],
    );

    const handleClear = useCallback(() => {
      internalValueRef.current = "";
      onClear?.();
      if (onChange) {
        const event = new Event("change", { bubbles: true });
        onChange({ target: { value: "" } } as any);
      }
    }, [onChange, onClear]);

    const inputType =
      type === "password" && showPassword
        ? "text"
        : type === "password"
          ? "password"
          : type;

    const showPasswordToggle = type === "password";

    return (
      <div className="relative inline-flex items-center w-full">
        {/* Prefix */}
        {prefix && (
          <div className="absolute left-3 flex items-center text-wl-text-secondary pointer-events-none">
            {prefix}
          </div>
        )}

        {/* Input */}
        <input
          ref={ref}
          type={inputType}
          value={internalValueRef.current}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-md",
            "font-family-sans font-normal",
            "bg-wl-bg-surface text-wl-text-primary placeholder-wl-text-tertiary",
            "border transition-colors duration-fast ease-default",
            hasError
              ? "border-wl-danger-400 focus:border-wl-danger-500 focus:ring-1 focus:ring-wl-danger-500/20"
              : "border-wl-border-default hover:border-wl-border-strong focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            prefix && "pl-10",
            (suffix || showPasswordToggle || showClear) && "pr-10",
            className,
          )}
          aria-invalid={hasError}
          {...props}
        />

        {/* Suffix Icons Container */}
        <div className="absolute right-3 flex items-center gap-1 text-wl-text-secondary">
          {/* Clear Button */}
          {showClear && internalValueRef.current && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:text-wl-text-primary transition-colors"
              aria-label="Clear input"
              tabIndex={-1}
            >
              <X size={16} />
            </button>
          )}

          {/* Password Toggle */}
          {showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="p-0.5 hover:text-wl-text-primary transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}

          {/* Custom Suffix */}
          {suffix && !showPasswordToggle && (
            <div className="pointer-events-none">{suffix}</div>
          )}
        </div>
      </div>
    );
  },
);

FormInput.displayName = "FormInput";
