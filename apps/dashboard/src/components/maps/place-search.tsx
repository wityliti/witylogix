'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type PlaceSearchProps, type PlaceSearchResult } from './types';
import { useGoogleMaps } from './google-maps-provider';

/**
 * Place Search Component
 * Allows searching for places near a map center with category filtering
 */
export function PlaceSearch({
  onResultSelect,
  categoryFilter = 'addresses',
  mapCenter = { lat: 37.7749, lng: -122.4194 },
  searchRadius = 5000, // 5km default
  showRecentSearches = true,
  className,
}: PlaceSearchProps) {
  const { isLoaded, google } = useGoogleMaps();
  const [searchInput, setSearchInput] = useState('');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const placeServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  // Initialize PlacesService
  useEffect(() => {
    if (!isLoaded || !google?.maps?.places) return;

    // Create a temporary map div for PlacesService
    const tempDiv = document.createElement('div');
    const tempMap = new google.maps.Map(tempDiv);
    placeServiceRef.current = new google.maps.places.PlacesService(tempMap);

    // Load recent searches from localStorage
    const saved = localStorage.getItem('placeSearchHistory');
    if (saved) {
      setRecentSearches(JSON.parse(saved).slice(0, 5));
    }
  }, [isLoaded, google]);

  // Search for places
  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || !placeServiceRef.current || !google?.maps) {
        return;
      }

      setIsLoading(true);

      try {
        const request = {
          query,
          location: new google.maps.LatLng(mapCenter.lat, mapCenter.lng),
          radius: searchRadius,
          type: categoryFilter,
        };

        const results = await new Promise<google.maps.places.PlaceResult[]>((resolve, reject) => {
          placeServiceRef.current!.textSearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              resolve(results);
            } else {
              reject(new Error(`Search failed: ${status}`));
            }
          });
        });

        // Convert results
        const searchResults: PlaceSearchResult[] = results
          .slice(0, 10)
          .map((result) => {
            const gmaps = google as typeof globalThis.google;
            const distance =
              gmaps.maps.geometry.spherical.computeDistanceBetween(
                new gmaps.maps.LatLng(mapCenter.lat, mapCenter.lng),
                result.geometry?.location || new gmaps.maps.LatLng(0, 0)
              ) || 0;

            return {
              placeId: result.place_id || '',
              name: result.name || '',
              address: result.formatted_address || '',
              latitude: result.geometry?.location?.lat() || 0,
              longitude: result.geometry?.location?.lng() || 0,
              distance: Math.round(distance),
              types: result.types || [],
            };
          });

        setResults(searchResults);
        setIsOpen(true);

        // Save to recent searches
        const updatedRecent = [query, ...recentSearches.filter((s) => s !== query)].slice(0, 5);
        setRecentSearches(updatedRecent);
        localStorage.setItem('placeSearchHistory', JSON.stringify(updatedRecent));
      } catch (error) {
        console.error('Error searching places:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [mapCenter, searchRadius, categoryFilter, recentSearches]
  );

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);

    if (value.length > 2) {
      performSearch(value);
    } else {
      setResults([]);
    }
  };

  // Handle result selection
  const handleSelectResult = (result: PlaceSearchResult) => {
    onResultSelect(result);
    setSearchInput('');
    setResults([]);
    setIsOpen(false);
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format distance display
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Get category label
  const getCategoryLabel = (): string => {
    switch (categoryFilter) {
      case 'addresses':
        return 'Addresses';
      case 'establishments':
        return 'Establishments';
      case 'geocode':
        return 'Geocodes';
      default:
        return 'All';
    }
  };

  return (
    <div ref={containerRef} className={cn('w-full', className)}>
      <div className="space-y-3">
        {/* Search Input */}
        <div>
          <label className="text-xs font-semibold text-wl-text-secondary uppercase block mb-2">
            Search Places
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={handleSearchChange}
              onFocus={() => results.length > 0 && setIsOpen(true)}
              placeholder="Search for places, addresses, landmarks..."
              disabled={!isLoaded}
              className={cn(
                'w-full px-4 py-2.5 rounded-md',
                'bg-wl-bg-overlay border border-wl-border-default',
                'text-wl-text-primary placeholder-wl-text-secondary',
                'focus:outline-none focus:ring-2 focus:ring-wl-primary-500 focus:border-transparent',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            />

            {/* Loading Spinner */}
            {isLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4">
                <div className="w-4 h-4 border-2 border-wl-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Clear Button */}
            {searchInput && !isLoading && (
              <button
                onClick={() => {
                  setSearchInput('');
                  setResults([]);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-wl-text-secondary hover:text-wl-text-primary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Results Dropdown */}
        {isOpen && results.length > 0 && (
          <div className="bg-wl-bg-elevated border border-wl-border-default rounded-md shadow-lg max-h-96 overflow-y-auto z-50">
            {results.map((result) => (
              <button
                key={result.placeId}
                onClick={() => handleSelectResult(result)}
                className={cn(
                  'w-full px-4 py-3 text-left transition-colors',
                  'border-b border-wl-border-default last:border-b-0',
                  'hover:bg-wl-bg-overlay hover:text-wl-text-primary',
                  'text-wl-text-secondary'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <svg
                    className="w-4 h-4 mt-0.5 flex-shrink-0 text-wl-primary-500"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
                  </svg>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-wl-text-primary">{result.name}</p>
                    <p className="text-xs text-wl-text-secondary mt-1 line-clamp-1">{result.address}</p>
                    {result.distance !== undefined && (
                      <p className="text-xs text-wl-text-secondary mt-0.5">
                        {formatDistance(result.distance)} away
                      </p>
                    )}
                  </div>

                  {/* Distance Badge */}
                  {result.distance !== undefined && (
                    <Badge variant="default" className="flex-shrink-0">
                      {formatDistance(result.distance)}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No Results */}
        {isOpen && searchInput.length > 2 && results.length === 0 && !isLoading && (
          <div className="bg-wl-bg-elevated border border-wl-border-default rounded-md shadow-lg p-4 z-50">
            <p className="text-center text-sm text-wl-text-secondary">No places found</p>
          </div>
        )}

        {/* Recent Searches */}
        {showRecentSearches && !searchInput && recentSearches.length > 0 && isOpen && (
          <div className="bg-wl-bg-elevated border border-wl-border-default rounded-md shadow-lg z-50">
            <div className="p-4 border-b border-wl-border-default">
              <p className="text-xs font-semibold text-wl-text-secondary uppercase mb-3">
                Recent Searches
              </p>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search) => (
                  <button
                    key={search}
                    onClick={() => {
                      setSearchInput(search);
                      performSearch(search);
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-wl-bg-surface text-wl-text-secondary hover:text-wl-text-primary hover:bg-wl-bg-overlay border border-wl-border-default transition-colors"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category Filter Info */}
      <div className="mt-3 text-xs text-wl-text-secondary flex items-center gap-2">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
        </svg>
        Searching: <span className="font-medium text-wl-text-primary">{getCategoryLabel()}</span>
      </div>
    </div>
  );
}
