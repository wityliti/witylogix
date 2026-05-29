'use client';
import { useEffect, useState, useCallback } from 'react';
import type { FeatureCollection } from 'geojson';

export interface UseZonesGeoJsonResult {
  data: FeatureCollection | null;
  error: Error | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useZonesGeoJson(): UseZonesGeoJsonResult {
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v4/zones?format=geojson');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as FeatureCollection;
      setData(body);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchZones();
  }, [fetchZones]);

  return { data, error, loading, refetch: fetchZones };
}
