"use client";

import { forwardRef, useState, useRef, useEffect, type InputHTMLAttributes, type ReactNode } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  emptyMessage?: string;
  disabled?: boolean;
}

const fuzzySearch = (query: string, options: ComboboxOption[]): ComboboxOption[] => {
  if (!query) return options;

  const queryLower = query.toLowerCase();
  return options.filter((option) =>
    option.label.toLowerCase().includes(queryLower)
  );
};

const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = "Select an option...",
      searchable = true,
      clearable = true,
      emptyMessage = "No options found",
      disabled = false,
      className,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredOptions = fuzzySearch(searchQuery, options);
    const selectedOption = options.find((opt) => opt.value === value);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen && e.key !== "ArrowDown" && e.key !== "Enter") return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            setHighlightedIndex((prev) =>
              prev < filteredOptions.length - 1 ? prev + 1 : prev
            );
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (isOpen && filteredOptions[highlightedIndex]) {
            selectOption(filteredOptions[highlightedIndex]);
          } else {
            setIsOpen(true);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setSearchQuery("");
          break;
        default:
          break;
      }
    };

    const selectOption = (option: ComboboxOption) => {
      onChange?.(option.value);
      setIsOpen(false);
      setSearchQuery("");
      setHighlightedIndex(0);
      inputRef.current?.blur();
    };

    const handleClear = () => {
      onChange?.("");
      setSearchQuery("");
      setIsOpen(false);
      inputRef.current?.focus();
    };

    return (
      <div ref={containerRef} className="relative w-full">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-secondary pointer-events-none" />
          <input
            ref={ref || inputRef}
            type="text"
            placeholder={selectedOption ? selectedOption.label : placeholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className={cn(
              "w-full px-4 py-2 pl-10 pr-10",
              "bg-wl-bg-surface text-wl-text-primary",
              "border rounded-md outline-none",
              "text-sm font-sans",
              "transition-all duration-fast ease-default",
              "border-wl-border-default focus:border-wl-primary-500",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              className
            )}
            {...props}
          />

          {clearable && selectedOption && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={disabled}
              className="absolute right-0 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4" />
            </Button>
          )}

          {!clearable && (
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-secondary pointer-events-none" />
          )}
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-wl-bg-surface border border-wl-border-default rounded-md shadow-lg max-h-64 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              <ul className="py-1">
                {filteredOptions.map((option, index) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => selectOption(option)}
                      className={cn(
                        "w-full text-left px-4 py-2",
                        "text-sm font-sans transition-colors duration-fast",
                        highlightedIndex === index
                          ? "bg-wl-primary-500/20 text-wl-primary-400"
                          : "text-wl-text-primary hover:bg-wl-bg-overlay",
                        value === option.value && "font-semibold text-wl-primary-400"
                      )}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      {option.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-wl-text-tertiary">
                {emptyMessage}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

Combobox.displayName = "Combobox";

export { Combobox };
