'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { type AddressAutocompleteProps, type PlaceDetails, type PlacePrediction } from './types';
import { useGoogleMaps } from './google-maps-provider';

/**
 * Address Autocomplete Component
 * Provides Google Places Autocomplete functionality with keyboard navigation
 */
export function AddressAutocomplete({
  onSelect,
  onInputChange,
  defaultValue = '',
  placeholder = 'Enter address...',
  countryFilter = [],
  types = [],
  disabled = false,
  className,
  debounceMs = 300,
}: AddressAutocompleteProps) {
  const { isLoaded, google } = useGoogleMaps();
  const [inputValue, setInputValue] = useState(defaultValue);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  // Initialize services
  useEffect(() => {
    if (!isLoaded || !google?.maps?.places) {
      return;
    }

    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();

    // Create a temporary map div for PlacesService
    const tempDiv = document.createElement('div');
    const tempMap = new google.maps.Map(tempDiv);
    placesServiceRef.current = new google.maps.places.PlacesService(tempMap);
  }, [isLoaded, google]);

  // Fetch predictions
  const fetchPredictions = useCallback(
    async (input: string) => {
      if (!input || !autocompleteServiceRef.current) {
        setPredictions([]);
        return;
      }

      setIsLoading(true);

      try {
        const restrictions = countryFilter.length > 0 ? { componentRestrictions: { country: countryFilter } } : {};
        const typeRestrictions = types.length > 0 ? { types } : {};

        const response = await autocompleteServiceRef.current.getPlacePredictions({
          input,
          ...restrictions,
          ...typeRestrictions,
        });

        const results: PlacePrediction[] = (response.predictions || []).map((prediction: google.maps.places.AutocompletePrediction) => ({
          placeId: prediction.place_id,
          description: prediction.description,
          mainText: prediction.structured_formatting?.main_text || prediction.description,
          secondaryText: prediction.structured_formatting?.secondary_text,
          types: prediction.types || [],
        }));

        setPredictions(results);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Error fetching predictions:', error);
        setPredictions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [countryFilter, types]
  );

  // Debounced input handler
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    onInputChange?.(value);

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      if (value.length > 0) {
        setIsOpen(true);
        fetchPredictions(value);
      } else {
        setPredictions([]);
        setIsOpen(false);
      }
    }, debounceMs);
  };

  // Handle prediction selection
  const selectPrediction = useCallback(
    async (prediction: PlacePrediction) => {
      if (!placesServiceRef.current) return;

      setIsLoading(true);

      try {
        // Get place details
        const result = await new Promise<google.maps.places.PlaceResult>((resolve, reject) => {
          placesServiceRef.current!.getDetails(
            {
              placeId: prediction.placeId,
              fields: [
                'place_id',
                'formatted_address',
                'geometry',
                'name',
                'type',
                'address_component',
                'adr_address',
                'formatted_phone_number',
                'website',
                'url',
                'utc_offset_minutes',
                'viewport',
              ],
            },
            (place: google.maps.places.PlaceResult | null, status: string) => {
              if (status === (typeof google !== 'undefined' ? google.maps.places.PlacesServiceStatus.OK : 'OK') && place) {
                resolve(place);
              } else {
                reject(new Error(`Failed to get place details: ${status}`));
              }
            }
          );
        });

        const coordinates = result.geometry?.location;
        const details: PlaceDetails = {
          placeId: result.place_id || prediction.placeId,
          formattedAddress: result.formatted_address || prediction.description,
          latitude: coordinates?.lat() || 0,
          longitude: coordinates?.lng() || 0,
          name: result.name,
          types: result.types || prediction.types,
          addressComponents: result.address_components?.map((component) => ({
            longName: component.long_name,
            shortName: component.short_name,
            types: component.types,
          })),
          adrAddress: result.adr_address,
          phone: result.formatted_phone_number,
          website: result.website,
          url: result.url,
          utcOffset: result.utc_offset_minutes,
          viewport: result.geometry?.viewport ? {
            northeast: {
              lat: result.geometry.viewport.getNorthEast().lat(),
              lng: result.geometry.viewport.getNorthEast().lng(),
            },
            southwest: {
              lat: result.geometry.viewport.getSouthWest().lat(),
              lng: result.geometry.viewport.getSouthWest().lng(),
            },
          } : undefined,
        };

        setSelectedPlace(details);
        setSelectedCoordinates({
          lat: details.latitude,
          lng: details.longitude,
        });
        setInputValue(details.formattedAddress);
        setPredictions([]);
        setIsOpen(false);
        onSelect(details);
      } catch (error) {
        console.error('Error selecting prediction:', error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || predictions.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : predictions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < predictions.length) {
          selectPrediction(predictions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setPredictions([]);
        break;
      default:
        break;
    }
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear button handler
  const handleClear = () => {
    setInputValue('');
    setSelectedPlace(null);
    setSelectedCoordinates(null);
    setPredictions([]);
    setIsOpen(false);
    inputRef.current?.focus();
    onInputChange?.('');
  };

  return (
    <div ref={containerRef} className={cn('w-full', className)}>
      <div className="relative">
        {/* Input Field */}
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue.length > 0 && predictions.length > 0 && setIsOpen(true)}
            placeholder={placeholder}
            disabled={disabled || !isLoaded}
            className={cn(
              'w-full px-4 py-2.5 rounded-md',
              'bg-wl-bg-overlay border border-wl-border-default',
              'text-wl-text-primary placeholder-wl-text-secondary',
              'focus:outline-none focus:ring-2 focus:ring-wl-primary-500 focus:border-transparent',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              inputValue && 'pr-10'
            )}
          />

          {/* Clear Button */}
          {inputValue && !disabled && (
            <button
              onClick={handleClear}
              className="absolute right-3 p-1 text-wl-text-secondary hover:text-wl-text-primary transition-colors"
              aria-label="Clear address"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}

          {/* Loading Spinner */}
          {isLoading && (
            <div className="absolute right-3 w-4 h-4">
              <div className="w-4 h-4 border-2 border-wl-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Predictions Dropdown */}
        {isOpen && predictions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-wl-bg-elevated border border-wl-border-default rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
            {predictions.map((prediction, index) => (
              <button
                key={prediction.placeId}
                onClick={() => selectPrediction(prediction)}
                className={cn(
                  'w-full px-4 py-3 text-left transition-colors',
                  'border-b border-wl-border-default last:border-b-0',
                  index === selectedIndex
                    ? 'bg-wl-primary-500/10 text-wl-text-primary'
                    : 'text-wl-text-secondary hover:bg-wl-bg-overlay hover:text-wl-text-primary'
                )}
              >
                <div className="flex items-start gap-2">
                  <svg
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-wl-text-primary">
                      {prediction.mainText}
                    </p>
                    {prediction.secondaryText && (
                      <p className="text-xs text-wl-text-secondary mt-0.5">
                        {prediction.secondaryText}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No Results */}
        {isOpen && inputValue.length > 0 && predictions.length === 0 && !isLoading && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-wl-bg-elevated border border-wl-border-default rounded-md shadow-lg z-50 p-4">
            <p className="text-center text-sm text-wl-text-secondary">No results found</p>
          </div>
        )}
      </div>

      {/* Selected Address Display */}
      {selectedPlace && selectedCoordinates && (
        <div className="mt-3 p-3 bg-wl-primary-500/10 border border-wl-primary-500/20 rounded-md">
          <p className="text-sm font-medium text-wl-text-primary mb-1">
            {selectedPlace.formattedAddress}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-wl-text-secondary">
              {selectedPlace.latitude.toFixed(6)}, {selectedPlace.longitude.toFixed(6)}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
            >
              Change
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
