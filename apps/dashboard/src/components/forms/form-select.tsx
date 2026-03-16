/**
 * Enhanced select component
 * Supports single/multi-select, searchable dropdown, and async options
 *
 * @example
 * ```tsx
 * <FormSelect
 *   options={[{ value: '1', label: 'Option 1' }]}
 *   isMulti
 *   isClearable
 *   placeholder="Select options..."
 * />
 * ```
 */

"use client";

import { forwardRef, SelectHTMLAttributes, useState, useCallback, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  group?: string;
}

interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "value"> {
  /** Options to display */
  options: SelectOption[];
  /** Selected value(s) */
  value?: string | number | (string | number)[];
  /** Whether select accepts multiple values */
  isMulti?: boolean;
  /** Whether select is clearable */
  isClearable?: boolean;
  /** Whether select is searchable */
  isSearchable?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether field has error */
  hasError?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Callback when value changes */
  onChange?: (value: string | number | (string | number)[] | null) => void;
  /** Custom option rendering */
  renderOption?: (option: SelectOption) => React.ReactNode;
  /** Async option loading */
  loadOptions?: (searchTerm: string) => Promise<SelectOption[]>;
  /** Loading state text */
  loadingText?: string;
}

/**
 * Enhanced select component with multi-select, search, and async options
 */
export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  (
    {
      options: initialOptions = [],
      value,
      isMulti = false,
      isClearable = false,
      isSearchable = false,
      placeholder = "Select...",
      hasError = false,
      disabled = false,
      onChange,
      renderOption,
      loadOptions,
      loadingText = "Loading...",
      className,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [options, setOptions] = useState<SelectOption[]>(initialOptions);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedValues, setSelectedValues] = useState<(string | number)[]>(
      isMulti ? (Array.isArray(value) ? value : []) : []
    );

    /**
     * Load async options
     */
    useEffect(() => {
      if (loadOptions && isOpen) {
        setIsLoading(true);
        loadOptions(searchTerm).then((loaded) => {
          setOptions(loaded);
          setIsLoading(false);
        });
      } else {
        setOptions(initialOptions);
      }
    }, [searchTerm, isOpen, loadOptions, initialOptions]);

    /**
     * Handle option selection
     */
    const handleSelect = useCallback(
      (optionValue: string | number) => {
        if (isMulti) {
          const newValues = selectedValues.includes(optionValue)
            ? selectedValues.filter((v) => v !== optionValue)
            : [...selectedValues, optionValue];
          setSelectedValues(newValues);
          onChange?.(newValues);
        } else {
          setSelectedValues([optionValue]);
          onChange?.(optionValue);
          setIsOpen(false);
        }
      },
      [isMulti, selectedValues, onChange]
    );

    /**
     * Handle clear
     */
    const handleClear = useCallback(() => {
      setSelectedValues([]);
      onChange?.(isMulti ? [] : null);
    }, [isMulti, onChange]);

    /**
     * Get display labels for selected values
     */
    const getSelectedLabels = () => {
      return selectedValues
        .map((val) => options.find((opt) => opt.value === val)?.label)
        .filter(Boolean);
    };

    /**
     * Filter options based on search term
     */
    const filteredOptions = options.filter((opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    /**
     * Group options by group field
     */
    const groupedOptions = filteredOptions.reduce(
      (acc, opt) => {
        const group = opt.group || "default";
        if (!acc[group]) acc[group] = [];
        acc[group].push(opt);
        return acc;
      },
      {} as Record<string, SelectOption[]>
    );

    const selectedLabels = getSelectedLabels();

    return (
      <div className="relative w-full">
        {/* Select Button */}
        <button
          ref={ref as any}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-md text-left",
            "font-family-sans font-normal",
            "bg-wl-bg-surface text-wl-text-primary placeholder-wl-text-tertiary",
            "border transition-all duration-fast ease-default",
            "flex items-center justify-between",
            hasError
              ? "border-wl-danger-400 focus:border-wl-danger-500"
              : "border-wl-border-default hover:border-wl-border-strong focus:border-wl-primary-500",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "focus:ring-1",
            hasError ? "focus:ring-wl-danger-500/20" : "focus:ring-wl-primary-500/20",
            className
          )}
          aria-invalid={hasError}
          aria-expanded={isOpen}
          {...props}
        >
          {/* Selected Values or Placeholder */}
          <div className="flex items-center gap-1 flex-wrap">
            {selectedLabels.length > 0 ? (
              isMulti ? (
                <div className="flex gap-1 flex-wrap">
                  {selectedLabels.map((label, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-wl-primary-500/20 text-wl-primary-500 rounded text-xs"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : (
                <span>{selectedLabels[0]}</span>
              )
            ) : (
              <span className="text-wl-text-tertiary">{placeholder}</span>
            )}
          </div>

          {/* Icons */}
          <div className="flex items-center gap-1">
            {isClearable && selectedLabels.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="p-0.5 hover:text-wl-text-primary transition-colors"
                aria-label="Clear selection"
              >
                <X size={16} />
              </button>
            )}
            <ChevronDown
              size={16}
              className={cn("transition-transform", isOpen && "rotate-180")}
            />
          </div>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-wl-bg-surface border border-wl-border-default rounded-md shadow-lg">
            {/* Search Input */}
            {isSearchable && (
              <div className="p-2 border-b border-wl-border-default">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "w-full px-2 py-1 text-sm rounded",
                    "bg-wl-bg-overlay border border-wl-border-default",
                    "text-wl-text-primary placeholder-wl-text-tertiary",
                    "focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/20"
                  )}
                  autoFocus
                />
              </div>
            )}

            {/* Options List */}
            <div className="max-h-56 overflow-y-auto">
              {isLoading ? (
                <div className="px-3 py-2 text-sm text-wl-text-tertiary">{loadingText}</div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-wl-text-tertiary">No options</div>
              ) : (
                Object.entries(groupedOptions).map(([group, groupOpts]) => (
                  <div key={group}>
                    {group !== "default" && (
                      <div className="px-3 py-1.5 text-xs font-semibold text-wl-text-tertiary bg-wl-bg-overlay">
                        {group}
                      </div>
                    )}
                    {groupOpts.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSelect(option.value)}
                        disabled={option.disabled}
                        className={cn(
                          "w-full px-3 py-2 text-sm text-left",
                          "transition-colors duration-fast",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          selectedValues.includes(option.value)
                            ? "bg-wl-primary-500/20 text-wl-primary-500"
                            : "hover:bg-wl-bg-overlay text-wl-text-primary"
                        )}
                      >
                        {renderOption ? renderOption(option) : option.label}
                        {isMulti && selectedValues.includes(option.value) && (
                          <span className="ml-2">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

FormSelect.displayName = "FormSelect";
