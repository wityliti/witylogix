/**
 * Enhanced textarea component
 * Supports auto-resize, character/word count, and markdown preview
 *
 * @example
 * ```tsx
 * <FormTextarea
 *   maxLength={500}
 *   showCharacterCount
 *   placeholder="Enter your message"
 * />
 * ```
 */

"use client";

import { forwardRef, TextareaHTMLAttributes, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Whether to show character count */
  showCharacterCount?: boolean;
  /** Whether to show word count */
  showWordCount?: boolean;
  /** Auto-resize textarea height to content */
  autoResize?: boolean;
  /** Minimum rows (default: 3) */
  minRows?: number;
  /** Maximum rows (default: 10) */
  maxRows?: number;
  /** Whether field has error */
  hasError?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * Enhanced textarea with auto-resize and character/word count
 */
export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  (
    {
      showCharacterCount = false,
      showWordCount = false,
      autoResize = true,
      minRows = 3,
      maxRows = 10,
      hasError = false,
      disabled = false,
      value,
      onChange,
      maxLength,
      className,
      rows,
      ...props
    },
    ref
  ) => {
    const [textValue, setTextValue] = useState<string>(String(value || ""));
    const [height, setHeight] = useState<string>("auto");

    /**
     * Calculate textarea height based on content
     */
    const updateHeight = useCallback((val: string) => {
      const textarea = document.createElement("textarea");
      textarea.style.visibility = "hidden";
      textarea.style.position = "fixed";
      textarea.style.height = "auto";
      textarea.value = val;
      document.body.appendChild(textarea);

      const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight);
      const lines = Math.ceil(textarea.scrollHeight / lineHeight);
      const boundedLines = Math.max(minRows, Math.min(lines, maxRows));

      setHeight(`${boundedLines * lineHeight}px`);
      document.body.removeChild(textarea);
    }, [minRows, maxRows]);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setTextValue(newValue);

        if (autoResize) {
          updateHeight(newValue);
        }

        onChange?.(e);
      },
      [autoResize, updateHeight, onChange]
    );

    /**
     * Update height on mount and when props change
     */
    useEffect(() => {
      if (autoResize) {
        updateHeight(textValue);
      }
    }, [autoResize, updateHeight, textValue]);

    const charCount = textValue.length;
    const wordCount = countWords(textValue);

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {/* Textarea */}
        <textarea
          ref={ref}
          value={textValue}
          onChange={handleChange}
          disabled={disabled}
          maxLength={maxLength}
          rows={rows || minRows}
          style={autoResize ? { height, resize: "none" } : {}}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-md",
            "font-family-sans font-normal",
            "bg-wl-bg-surface text-wl-text-primary placeholder-wl-text-tertiary",
            "border transition-colors duration-fast ease-default",
            hasError
              ? "border-wl-danger-400 focus:border-wl-danger-500 focus:ring-1 focus:ring-wl-danger-500/20"
              : "border-wl-border-default hover:border-wl-border-strong focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "focus-visible:outline-none",
            className
          )}
          aria-invalid={hasError}
          {...props}
        />

        {/* Counter */}
        {(showCharacterCount || showWordCount) && (
          <div className="flex justify-between items-center text-xs text-wl-text-tertiary">
            <div className="flex gap-2">
              {showWordCount && <span>{wordCount} words</span>}
              {showCharacterCount && (
                <span
                  className={cn(
                    maxLength && charCount > maxLength * 0.9 && "text-wl-warning-400"
                  )}
                >
                  {charCount}
                  {maxLength && ` / ${maxLength}`}
                  {maxLength ? " characters" : ""}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

FormTextarea.displayName = "FormTextarea";
