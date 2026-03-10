"use client";

import { ReactNode } from "react";
import { cn } from "../utils/cn";

export interface AddressSuggestionItemProps {
  address: string;
  city: string;
  state: string;
  zipcode: string;
  zoneName?: string;
  isDeliverable?: boolean;
  matchedText?: string;
  onClick?: () => void;
  className?: string;
}

const highlightMatch = (text: string, matchedText: string): ReactNode => {
  if (!matchedText || !text) return text;

  const parts = text.split(new RegExp(`(${matchedText})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === matchedText.toLowerCase() ? (
      <span key={index} className="font-semibold text-wl-primary-600 dark:text-wl-primary-400">
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    )
  );
};

export function AddressSuggestionItem({
  address,
  city,
  state,
  zipcode,
  zoneName,
  isDeliverable = true,
  matchedText,
  onClick,
  className,
}: AddressSuggestionItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border border-wl-border-default",
        "hover:bg-wl-bg-secondary hover:border-wl-primary-500 transition-all",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        !isDeliverable && "opacity-60",
        className
      )}
      disabled={!isDeliverable}
      aria-label={`${address}, ${city}, ${state} ${zipcode}${zoneName ? `, ${zoneName}` : ""}`}
    >
      <div className="space-y-1.5">
        {/* Main address with highlighting */}
        <div className="text-sm font-medium text-wl-text-primary">
          {highlightMatch(address, matchedText || "")}
        </div>

        {/* City, state, zip */}
        <div className="text-xs text-wl-text-tertiary">
          {city}, {state} {zipcode}
        </div>

        {/* Zone and deliverability info */}
        <div className="flex items-center gap-2">
          {zoneName && (
            <span className="text-xs bg-wl-primary-100 text-wl-primary-700 dark:bg-wl-primary-900 dark:text-wl-primary-200 px-2 py-0.5 rounded">
              {zoneName}
            </span>
          )}
          {isDeliverable && (
            <span className="text-xs text-wl-success-600 dark:text-wl-success-400 flex items-center gap-1">
              ✓ Deliverable
            </span>
          )}
          {!isDeliverable && (
            <span className="text-xs text-wl-danger-600 dark:text-wl-danger-400 flex items-center gap-1">
              ✕ Not in zone
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
