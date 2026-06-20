'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

export interface ZoneOverlay {
  id: string;
  openOrders: number;
  drivers: number;
  slaPct: number;
  health: 'good' | 'watch' | 'slipping';
}

export interface OverlaysPayload {
  zones: ZoneOverlay[];
  heatmap: Array<{ lng: number; lat: number; count: number }>;
  hubs: Array<{
    id: string;
    name: string;
    lng: number;
    lat: number;
    type: 'warehouse' | 'store' | 'hub';
  }>;
}

export type OverlayWindow = '1h' | '24h' | '7d';

export interface UseZoneOverlaysResult {
  data: OverlaysPayload | null;
  error: Error | null;
  refetch: () => Promise<void>;
}

// NOTE: the `window` parameter shadows globalThis.window inside this function,
// so we reach for `globalThis.window` when registering the focus listener.
export function useZoneOverlays(window: OverlayWindow): UseZoneOverlaysResult {
  const [data, setData] = useState<OverlaysPayload | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const fetchOverlays = useCallback(async () => {
    try {
      const body = await api.get<OverlaysPayload>(`/api/v4/zones/overlays?window=${window}`);
      setData(body);
      setError(null);
    } catch (e) {
      setError(e as Error);
    }
  }, [window]);

  useEffect(() => {
    void fetchOverlays();
    const onFocus = () => {
      void fetchOverlays();
    };
    globalThis.window.addEventListener('focus', onFocus);
    return () => {
      globalThis.window.removeEventListener('focus', onFocus);
    };
  }, [fetchOverlays]);

  return { data, error, refetch: fetchOverlays };
}
