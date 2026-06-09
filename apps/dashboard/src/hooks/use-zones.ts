'use client';

import { useApiList, useApiMutation, useApiQuery, UseApiMutationResult, UseApiQueryResult } from './use-api';

export interface ZoneBoundary {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface ZoneTimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  priority: number;
  baseRate: number;
  perKmRate: number;
  minOrder: number;
  freeAbove: number | null;
  isActive: boolean;
  boundary: ZoneBoundary | null;
  timeSlots: ZoneTimeSlot[];
  _count: { timeSlots: number };
  ordersToday: number;
}

export interface UseZonesResult {
  zones: DeliveryZone[];
  loading: boolean;
  error: Error | null;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  refetch: () => Promise<void>;
}

export function useZones(filters?: { page?: number; limit?: number }): UseZonesResult {
  const { items, loading, error, pagination, refetch } = useApiList<DeliveryZone>(
    '/api/v4/zones',
    { page: filters?.page ?? 1, limit: filters?.limit ?? 50 },
  );
  return { zones: items, loading, error, pagination, refetch };
}

export function useZone(id: string | null): UseApiQueryResult<{ data: DeliveryZone }> {
  return useApiQuery<{ data: DeliveryZone }>(id ? `/api/v4/zones/${id}` : null);
}

export interface CreateZonePayload {
  name: string;
  baseRate: number;
  perKmRate: number;
  minOrder: number;
  freeAbove?: number | null;
  priority?: number;
  boundary: { latitude: number; longitude: number }[];
}

export function useCreateZone(): UseApiMutationResult<{ data: DeliveryZone }> {
  return useApiMutation<{ data: DeliveryZone }>('POST', '/api/v4/zones');
}

export interface UpdateZonePayload {
  name?: string;
  baseRate?: number;
  perKmRate?: number;
  minOrder?: number;
  freeAbove?: number | null;
  priority?: number;
  isActive?: boolean;
  boundary?: { latitude: number; longitude: number }[];
}

export function useUpdateZone(id: string): UseApiMutationResult<{ data: DeliveryZone }> {
  return useApiMutation<{ data: DeliveryZone }>('PATCH', `/api/v4/zones/${id}`);
}

export function useDeactivateZone(id: string): UseApiMutationResult<{ data: DeliveryZone }> {
  return useApiMutation<{ data: DeliveryZone }>('DELETE', `/api/v4/zones/${id}`);
}
