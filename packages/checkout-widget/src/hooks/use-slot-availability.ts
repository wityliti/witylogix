/**
 * useSlotAvailability Hook
 * Fetches and manages time slot availability for a given date and zone
 */

import { useState, useCallback, useEffect } from 'react';
import type { SlotAvailability, AvailabilityRequest, DeliveryMethodType } from '../types';

interface UseSlotAvailabilityState {
  data: SlotAvailability | null;
  isLoading: boolean;
  error: Error | null;
}

interface UseSlotAvailabilityOptions {
  apiBaseUrl: string;
  enabled?: boolean;
  refetchInterval?: number; // milliseconds
}

export const useSlotAvailability = (
  zoneId: string,
  startDate: string,
  endDate: string,
  deliveryMethod: DeliveryMethodType,
  options: UseSlotAvailabilityOptions
) => {
  const [state, setState] = useState<UseSlotAvailabilityState>({
    data: null,
    isLoading: true,
    error: null,
  });

  const fetch = useCallback(async () => {
    if (!options.enabled) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const request: AvailabilityRequest = {
        zoneId,
        startDate,
        endDate,
        deliveryMethod,
      };

      const response = await fetch(`${options.apiBaseUrl}/api/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch availability: ${response.statusText}`);
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
  }, [zoneId, startDate, endDate, deliveryMethod, options.apiBaseUrl, options.enabled]);

  useEffect(() => {
    fetch();

    if (options.refetchInterval) {
      const interval = setInterval(fetch, options.refetchInterval);
      return () => clearInterval(interval);
    }
  }, [fetch, options.refetchInterval]);

  return {
    ...state,
    refetch: fetch,
  };
};

/**
 * Batch fetch availability for multiple dates
 */
export const useBatchSlotAvailability = (
  zoneId: string,
  startDate: string,
  endDate: string,
  deliveryMethod: DeliveryMethodType,
  options: UseSlotAvailabilityOptions
) => {
  const [state, setState] = useState<{
    data: Map<string, SlotAvailability>;
    isLoading: boolean;
    error: Error | null;
  }>({
    data: new Map(),
    isLoading: true,
    error: null,
  });

  const fetch = useCallback(async () => {
    if (!options.enabled) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const request: AvailabilityRequest = {
        zoneId,
        startDate,
        endDate,
        deliveryMethod,
      };

      const response = await fetch(`${options.apiBaseUrl}/api/availability/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch batch availability: ${response.statusText}`);
      }

      const data: SlotAvailability[] = await response.json();
      const dataMap = new Map(data.map((slot) => [slot.date.toString(), slot]));

      setState((prev) => ({ ...prev, data: dataMap, isLoading: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Unknown error'),
        isLoading: false,
      }));
    }
  }, [zoneId, startDate, endDate, deliveryMethod, options.apiBaseUrl, options.enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    ...state,
    refetch: fetch,
    getForDate: (date: string) => state.data.get(date) || null,
  };
};
