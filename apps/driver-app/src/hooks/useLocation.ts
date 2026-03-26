import { useState, useCallback, useEffect } from 'react';

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export const useLocation = () => {
  const [lastKnownLocation, setLastKnownLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<NodeJS.Timeout | null>(null);

  const getCurrentPosition = useCallback(async (): Promise<Location> => {
    setLoading(true);
    setError(null);

    try {
      return new Promise((resolve, reject) => {
        // Mock implementation - in production, use react-native-geolocation-service or similar
        const mockLocation: Location = {
          latitude: 37.7749 + (Math.random() - 0.5) * 0.01,
          longitude: -122.4194 + (Math.random() - 0.5) * 0.01,
          accuracy: Math.random() * 20,
          altitude: 50,
          heading: Math.random() * 360,
          speed: Math.random() * 15,
        };

        setLastKnownLocation(mockLocation);
        setLoading(false);
        resolve(mockLocation);
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      setLoading(false);
      throw err;
    }
  }, []);

  const watchPosition = useCallback(
    (callback?: (location: Location) => void, interval: number = 5000) => {
      // Clear existing watch if any
      if (watchId) {
        clearInterval(watchId);
      }

      // Mock implementation - updates location every `interval` milliseconds
      const id = setInterval(async () => {
        try {
          const location = await getCurrentPosition();
          callback?.(location);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Location update failed';
          setError(errorMessage);
        }
      }, interval);

      setWatchId(id);
      return id;
    },
    [getCurrentPosition, watchId]
  );

  const clearWatch = useCallback(() => {
    if (watchId) {
      clearInterval(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId) {
        clearInterval(watchId);
      }
    };
  }, [watchId]);

  return {
    lastKnownLocation,
    loading,
    error,
    getCurrentPosition,
    watchPosition,
    clearWatch,
  };
};
