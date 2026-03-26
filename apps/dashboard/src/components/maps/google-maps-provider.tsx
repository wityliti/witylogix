'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type GoogleMapsContextValue, type GoogleMapsProviderProps } from './types';

/**
 * Google Maps Context
 * Provides access to the Google Maps API and loading state
 */
const GoogleMapsContext = createContext<GoogleMapsContextValue | undefined>(undefined);

/**
 * Hook to use Google Maps context
 */
export function useGoogleMaps(): GoogleMapsContextValue {
  const context = useContext(GoogleMapsContext);
  if (!context) {
    throw new Error('useGoogleMaps must be used within GoogleMapsProvider');
  }
  return context;
}

/**
 * Google Maps Provider Component
 * Lazy loads the Google Maps JavaScript API and provides it via context
 */
export function GoogleMapsProvider({
  children,
  apiKey,
  libraries = ['places', 'drawing', 'visualization', 'geometry'],
}: GoogleMapsProviderProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoadingScript, setIsLoadingScript] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google?.maps) {
      setIsLoaded(true);
      setIsLoadingScript(false);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        setIsLoaded(true);
        setIsLoadingScript(false);
      });
      existingScript.addEventListener('error', () => {
        const loadError = new Error('Failed to load Google Maps API');
        setError(loadError);
        setIsLoadingScript(false);
      });
      return;
    }

    // Create and append the script
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.async = true;
    script.defer = true;

    // Build the script URL with libraries
    const librariesParam = libraries.length > 0 ? `&libraries=${libraries.join(',')}` : '';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}${librariesParam}`;

    script.addEventListener('load', () => {
      setIsLoaded(true);
      setIsLoadingScript(false);
    });

    script.addEventListener('error', () => {
      const loadError = new Error('Failed to load Google Maps API');
      setError(loadError);
      setIsLoadingScript(false);
    });

    document.head.appendChild(script);

    return () => {
      // Cleanup: remove event listeners
      script.removeEventListener('load', () => {});
      script.removeEventListener('error', () => {});
    };
  }, [apiKey, libraries]);

  const value: GoogleMapsContextValue = {
    isLoaded,
    isLoadingScript,
    google: window.google,
    error,
  };

  return (
    <GoogleMapsContext.Provider value={value}>
      {isLoadingScript && (
        <div className="flex items-center justify-center h-screen bg-wl-bg-surface">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 mb-3">
              <div className="w-8 h-8 border-2 border-wl-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-wl-text-secondary text-sm">Loading Google Maps...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center h-screen bg-wl-bg-surface">
          <div className="text-center">
            <p className="text-wl-danger-500 font-semibold mb-1">Failed to Load Maps</p>
            <p className="text-wl-text-secondary text-sm">{error.message}</p>
          </div>
        </div>
      )}
      {isLoaded && !error && children}
    </GoogleMapsContext.Provider>
  );
}

// Type augmentation for window.google
declare global {
  interface Window {
    google?: typeof google;
  }
}
