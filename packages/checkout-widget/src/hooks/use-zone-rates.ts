/**
 * useZoneRates Hook
 * Fetches and manages zone-based delivery rates
 */

import { useState, useCallback, useEffect } from 'react';
import type { ZoneRate, RateRequest } from '../types';

interface UseZoneRatesState {
  data: ZoneRate | null;
  isLoading: boolean;
  error: Error | null;
}

interface UseZoneRatesOptions {
  apiBaseUrl: string;
  enabled?: boolean;
}

export const useZoneRates = (
  zoneId: string,
  orderValue: number,
  options: UseZoneRatesOptions,
  weight?: number
) => {
  const [state, setState] = useState<UseZoneRatesState>({
    data: null,
    isLoading: true,
    error: null,
  });

  const fetch = useCallback(async () => {
    if (!options.enabled || !zoneId) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const request: RateRequest = {
        zoneId,
        orderValue,
        estimatedWeight: weight,
        deliveryMethod: 'standard', // Could be parameterized
      };

      const response = await fetch(`${options.apiBaseUrl}/api/rates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch rates: ${response.statusText}`);
      }

      const data = await response.json();
      setState((prev) => ({ ...prev, data, isLoading: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Unknown error'),
        isLoading: false,
      }));
    }
  }, [zoneId, orderValue, weight, options.apiBaseUrl, options.enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    ...state,
    refetch: fetch,
  };
};

/**
 * Batch fetch rates for multiple zones
 */
export const useBatchZoneRates = (
  zoneIds: string[],
  orderValue: number,
  options: UseZoneRatesOptions,
  weight?: number
) => {
  const [state, setState] = useState<{
    data: Map<string, ZoneRate>;
    isLoading: boolean;
    error: Error | null;
  }>({
    data: new Map(),
    isLoading: true,
    error: null,
  });

  const fetch = useCallback(async () => {
    if (!options.enabled || zoneIds.length === 0) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch(`${options.apiBaseUrl}/api/rates/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zoneIds,
          orderValue,
          estimatedWeight: weight,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch batch rates: ${response.statusText}`);
      }

      const data: ZoneRate[] = await response.json();
      const dataMap = new Map(data.map((rate) => [rate.zoneId, rate]));

      setState((prev) => ({ ...prev, data: dataMap, isLoading: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Unknown error'),
        isLoading: false,
      }));
    }
  }, [zoneIds, orderValue, weight, options.apiBaseUrl, options.enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    ...state,
    refetch: fetch,
    getForZone: (zoneId: string) => state.data.get(zoneId) || null,
  };
};
