'use client';

import { useApiList, useApiQuery, useApiMutation, ApiFilters, UseApiQueryResult, UseApiListResult, UseApiMutationResult } from './use-api';

// ─── TYPES ──────────────────────────────────────────────────────────

export interface Field {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required: boolean;
  sampleValue?: string;
}

export interface Mapping {
  id: string;
  sourceFieldId: string;
  targetFieldId: string;
  transformer: 'direct' | 'uppercase' | 'lowercase' | 'currency' | 'date' | 'custom';
  customJS?: string;
}

export interface SyncSchedule {
  id: string;
  platformId: string;
  interval: 'realtime' | '5m' | '15m' | '30m' | '1h' | 'daily';
  direction: 'inbound' | 'outbound' | 'bidirectional';
  concurrencyLimit: number;
  nextSyncAt: string;
  paused: boolean;
}

export interface SyncJob {
  id: string;
  platformId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsFailed: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

// ─── HOOKS ──────────────────────────────────────────────────────────

export function useMappings(platformId: string, filters?: ApiFilters): UseApiListResult<Mapping> {
  return useApiList<Mapping>(`/api/v4/sync/platforms/${platformId}/mappings`, filters);
}

export function useCreateMapping(platformId: string): UseApiMutationResult<Mapping> {
  return useApiMutation<Mapping>('POST', `/api/v4/sync/platforms/${platformId}/mappings`);
}

export function useUpdateMapping(platformId: string, mappingId: string): UseApiMutationResult<Mapping> {
  return useApiMutation<Mapping>('PATCH', `/api/v4/sync/platforms/${platformId}/mappings/${mappingId}`);
}

export function useDeleteMapping(platformId: string, mappingId: string): UseApiMutationResult<void> {
  return useApiMutation<void>('DELETE', `/api/v4/sync/platforms/${platformId}/mappings/${mappingId}`);
}

export function useSyncSchedule(platformId: string): UseApiQueryResult<SyncSchedule> {
  return useApiQuery<SyncSchedule>(`/api/v4/sync/platforms/${platformId}/schedule`);
}

export function useUpdateSyncSchedule(platformId: string): UseApiMutationResult<SyncSchedule> {
  return useApiMutation<SyncSchedule>('PATCH', `/api/v4/sync/platforms/${platformId}/schedule`);
}

export function useSyncJobs(platformId: string, filters?: ApiFilters): UseApiListResult<SyncJob> {
  return useApiList<SyncJob>(`/api/v4/sync/platforms/${platformId}/jobs`, filters);
}

export function useSyncJob(platformId: string, jobId: string | null): UseApiQueryResult<SyncJob> {
  return useApiQuery<SyncJob>(jobId ? `/api/v4/sync/platforms/${platformId}/jobs/${jobId}` : null);
}
