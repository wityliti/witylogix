'use client';

/**
 * Zone-specific API hooks for the dashboard
 */

import { useApiMutation, useApiQuery, UseApiQueryResult, UseApiMutationResult } from './use-api';

/**
 * Zone polygon coordinates
 */
export interface ZonePolygon {
  type: 'Polygon';
  coordinates: Array<Array<[number, number]>>;
}

/**
 * Zone type
 */
export interface Zone {
  id: string;
  name: string;
  description?: string;
  code: string;
  status: 'active' | 'inactive' | 'archived';
  polygon: ZonePolygon;
  center: {
    latitude: number;
    longitude: number;
  };
  area: number;
  assignedDriverCount: number;
  activeDeliveries: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Hook to fetch all zones
 * @returns Array of zones
 */
export function useZones(): UseApiQueryResult<Zone[]> {
  return useApiQuery<Zone[]>('/zones');
}

/**
 * Hook to fetch a single zone by ID with full polygon data
 * @param id - Zone ID
 * @returns Single zone with polygon
 */
export function useZone(
  id: string | null,
): UseApiQueryResult<Zone> {
  return useApiQuery<Zone>(id ? `/zones/${id}` : null);
}

/**
 * Hook to create a new zone
 * @returns Mutation to create zone
 */
export function useCreateZone(): UseApiMutationResult<Zone> {
  return useApiMutation<Zone>('POST', '/zones');
}

/**
 * Hook to update an existing zone
 * @param id - Zone ID
 * @returns Mutation to update zone
 */
export function useUpdateZone(
  id: string,
): UseApiMutationResult<Zone> {
  return useApiMutation<Zone>('PATCH', `/zones/${id}`);
}
