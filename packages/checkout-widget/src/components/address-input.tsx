/**
 * AddressInput Component
 * Address autocomplete with zone validation
 */

import React, { useState, useRef, useEffect } from "react";
import { MapPin, AlertCircle, Loader, Check } from "lucide-react";
import { useAddressAutocomplete } from "../hooks/use-address-validation";
import type { AddressValidation } from "../types";
import clsx from "clsx";

interface AddressInputProps {
  apiBaseUrl: string;
  onAddressSelect: (address: AddressValidation) => void;
  onZoneDetect?: (zoneId: string, zoneName: string) => void;
  isLoading?: boolean;
  compact?: boolean;
}

export const AddressInput: React.FC<AddressInputProps> = ({
  apiBaseUrl,
  onAddressSelect,
  onZoneDetect,
  isLoading: externalLoading = false,
  compact = false,
}) => {
  const [query, setQuery] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [selectedAddress, setSelectedAddress] =
    useState<AddressValidation | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const {
    suggestions,
    isLoading,
    error,
    selectedAddress: autocompleteAddress,
    search,
    selectAddress,
    reset,
  } = useAddressAutocomplete({
    apiBaseUrl,
    debounceMs: 300,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (value.length >= 3) {
      search(value);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleZipcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
    setZipcode(value);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);

    // Validate address with zipcode
    try {
      const response = await fetch(`${apiBaseUrl}/api/address/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: suggestion,
          zipcode: zipcode,
        }),
      });

      if (!response.ok) {
        throw new Error("Address validation failed");
      }

      const address: AddressValidation = await response.json();
      setSelectedAddress(address);
      selectAddress(address);
      onAddressSelect(address);

      if (address.zoneId && address.zoneName && onZoneDetect) {
        onZoneDetect(address.zoneId, address.zoneName);
      }
    } catch (err) {
      console.error("Address validation error:", err);
    }
  };

  const handleClear = () => {
    setQuery("");
    setZipcode("");
    setSelectedAddress(null);
    reset();
  };

  const isValid = selectedAddress && selectedAddress.valid;
  const showError = selectedAddress && !selectedAddress.valid;
  const isLoadingState = isLoading || externalLoading;

  return (
    <div className={clsx("wl-w-full wl-space-y-4", { "wl-max-w-md": compact })}>
      {/* Address input */}
      <div className="wl-space-y-2">
        <label className="wl-block wl-text-sm wl-font-medium wl-text-wl-foreground">
          Delivery address
        </label>
        <div className="wl-relative">
          <div className="wl-absolute wl-left-3 wl-top-1/2 wl-transform wl--translate-y-1/2 wl-text-wl-muted-foreground">
            <MapPin className="wl-w-5 wl-h-5" />
          </div>
          <input
            type="text"
            value={query}
            onChange={handleAddressChange}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Enter your address..."
            className={clsx(
              "wl-w-full wl-pl-10 wl-pr-4 wl-py-2 wl-rounded-lg wl-border-2 wl-transition-colors",
              "wl-bg-wl-background wl-text-wl-foreground wl-placeholder-wl-muted-foreground",
              {
                "wl-border-wl-success wl-focus:border-wl-success wl-focus:ring-2 wl-focus:ring-wl-success/20":
                  isValid,
                "wl-border-wl-destructive wl-focus:border-wl-destructive wl-focus:ring-2 wl-focus:ring-wl-destructive/20":
                  showError,
                "wl-border-wl-border wl-focus:border-wl-accent wl-focus:ring-2 wl-focus:ring-wl-accent/20":
                  !isValid && !showError,
                "wl-opacity-50 wl-cursor-not-allowed": isLoadingState,
              },
            )}
            disabled={isLoadingState}
            aria-label="Delivery address"
            autoComplete="off"
          />

          {/* Loading indicator */}
          {isLoadingState && (
            <div className="wl-absolute wl-right-3 wl-top-1/2 wl-transform wl--translate-y-1/2">
              <Loader className="wl-w-5 wl-h-5 wl-text-wl-muted-foreground wl-animate-spin" />
            </div>
          )}

          {/* Success indicator */}
          {isValid && !isLoadingState && (
            <div className="wl-absolute wl-right-3 wl-top-1/2 wl-transform wl--translate-y-1/2">
              <Check className="wl-w-5 wl-h-5 wl-text-wl-success" />
            </div>
          )}

          {/* Clear button */}
          {query && !isLoadingState && (
            <button
              onClick={handleClear}
              className="wl-absolute wl-right-3 wl-top-1/2 wl-transform wl--translate-y-1/2 wl-text-wl-muted-foreground wl-hover:text-wl-foreground"
              aria-label="Clear address"
            >
              ✕
            </button>
          )}

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="wl-absolute wl-top-full wl-left-0 wl-right-0 wl-mt-2 wl-bg-wl-background wl-border wl-border-wl-border wl-rounded-lg wl-shadow-lg wl-z-50 wl-max-h-64 wl-overflow-y-auto"
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion}-${index}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={clsx(
                    "wl-w-full wl-px-4 wl-py-3 wl-text-left wl-hover:bg-wl-accent/10 wl-transition-colors",
                    "wl-border-b wl-border-wl-border last:wl-border-b-0",
                    "wl-focus:bg-wl-accent/10 wl-focus:outline-none",
                  )}
                  type="button"
                >
                  <div className="wl-flex wl-items-center wl-gap-2">
                    <MapPin className="wl-w-4 wl-h-4 wl-text-wl-muted-foreground wl-flex-shrink-0" />
                    <span className="wl-text-sm wl-text-wl-foreground">
                      {suggestion}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zipcode input */}
      <div className="wl-space-y-2">
        <label className="wl-block wl-text-sm wl-font-medium wl-text-wl-foreground">
          Zipcode
        </label>
        <input
          type="text"
          value={zipcode}
          onChange={handleZipcodeChange}
          placeholder="e.g., 10001"
          className={clsx(
            "wl-w-full wl-px-4 wl-py-2 wl-rounded-lg wl-border-2 wl-transition-colors",
            "wl-bg-wl-background wl-text-wl-foreground wl-placeholder-wl-muted-foreground",
            {
              "wl-border-wl-success wl-focus:border-wl-success wl-focus:ring-2 wl-focus:ring-wl-success/20":
                isValid,
              "wl-border-wl-destructive wl-focus:border-wl-destructive wl-focus:ring-2 wl-focus:ring-wl-destructive/20":
                showError,
              "wl-border-wl-border wl-focus:border-wl-accent wl-focus:ring-2 wl-focus:ring-wl-accent/20":
                !isValid && !showError,
            },
          )}
          aria-label="Zipcode"
          disabled={isLoadingState}
        />
      </div>

      {/* Error message */}
      {showError && selectedAddress?.message && (
        <div className="wl-p-3 wl-bg-wl-destructive/10 wl-border wl-border-wl-destructive/30 wl-rounded-lg wl-flex wl-items-start wl-gap-2">
          <AlertCircle className="wl-w-5 wl-h-5 wl-text-wl-destructive wl-flex-shrink-0 wl-mt-0.5" />
          <div>
            <p className="wl-text-sm wl-font-medium wl-text-wl-destructive">
              Address not valid
            </p>
            <p className="wl-text-sm wl-text-wl-destructive/80">
              {selectedAddress.message}
            </p>
          </div>
        </div>
      )}

      {/* Success message */}
      {isValid && selectedAddress && (
        <div className="wl-p-3 wl-bg-wl-success/10 wl-border wl-border-wl-success/30 wl-rounded-lg wl-flex wl-items-start wl-gap-2">
          <Check className="wl-w-5 wl-h-5 wl-text-wl-success wl-flex-shrink-0 wl-mt-0.5" />
          <div>
            <p className="wl-text-sm wl-font-medium wl-text-wl-success">
              {selectedAddress.message || "We deliver to your area!"}
            </p>
            <p className="wl-text-xs wl-text-wl-success/80 wl-mt-1">
              Zone: {selectedAddress.zoneName}
            </p>
          </div>
        </div>
      )}

      {/* API error message */}
      {error && (
        <div className="wl-p-3 wl-bg-wl-destructive/10 wl-border wl-border-wl-destructive/30 wl-rounded-lg wl-flex wl-items-start wl-gap-2">
          <AlertCircle className="wl-w-5 wl-h-5 wl-text-wl-destructive wl-flex-shrink-0 wl-mt-0.5" />
          <p className="wl-text-sm wl-text-wl-destructive">{error.message}</p>
        </div>
      )}
    </div>
  );
};
