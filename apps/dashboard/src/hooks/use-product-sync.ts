"use client";

import { useState } from "react";
import {
  useApiList,
  useApiQuery,
  useApiMutation,
  ApiFilters,
  UseApiQueryResult,
  UseApiListResult,
  UseApiMutationResult,
} from "./use-api";

// ─── TYPES ──────────────────────────────────────────────────────────

export interface Field {
  id: string;
  name: string;
  type: "string" | "number" | "boolean" | "date";
  required: boolean;
  sampleValue?: string;
}

export interface Mapping {
  id: string;
  sourceFieldId: string;
  targetFieldId: string;
  transformer:
    | "direct"
    | "uppercase"
    | "lowercase"
    | "currency"
    | "date"
    | "custom";
  customJS?: string;
}

export interface SyncSchedule {
  id: string;
  platformId: string;
  interval: "realtime" | "5m" | "15m" | "30m" | "1h" | "daily";
  direction: "inbound" | "outbound" | "bidirectional";
  concurrencyLimit: number;
  nextSyncAt: string;
  paused: boolean;
}

export interface SyncJob {
  id: string;
  platformId: string;
  status: "pending" | "running" | "completed" | "failed";
  recordsProcessed: number;
  recordsFailed: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

// ─── HOOKS ──────────────────────────────────────────────────────────

export function useMappings(
  platformId: string,
  filters?: ApiFilters,
): UseApiListResult<Mapping> {
  return useApiList<Mapping>(
    `/api/v4/sync/platforms/${platformId}/mappings`,
    filters,
  );
}

export function useCreateMapping(
  platformId: string,
): UseApiMutationResult<Mapping> {
  return useApiMutation<Mapping>(
    "POST",
    `/api/v4/sync/platforms/${platformId}/mappings`,
  );
}

export function useUpdateMapping(
  platformId: string,
  mappingId: string,
): UseApiMutationResult<Mapping> {
  return useApiMutation<Mapping>(
    "PATCH",
    `/api/v4/sync/platforms/${platformId}/mappings/${mappingId}`,
  );
}

export function useDeleteMapping(
  platformId: string,
  mappingId: string,
): UseApiMutationResult<void> {
  return useApiMutation<void>(
    "DELETE",
    `/api/v4/sync/platforms/${platformId}/mappings/${mappingId}`,
  );
}

export function useSyncScheduleQuery(
  platformId: string,
): UseApiQueryResult<SyncSchedule> {
  return useApiQuery<SyncSchedule>(
    `/api/v4/sync/platforms/${platformId}/schedule`,
  );
}

/** Rich composite hook used by product sync page - returns { schedule, setSchedule } */
export function useSyncSchedule(platformId: string) {
  const queryResult = useApiQuery<SyncSchedule>(
    `/api/v4/sync/platforms/${platformId}/schedule`,
  );
  const updateMutation = useApiMutation<SyncSchedule>(
    "PATCH",
    `/api/v4/sync/platforms/${platformId}/schedule`,
  );
  const [localSchedule, setLocalSchedule] = useState<SyncSchedule | null>(null);

  const schedule = localSchedule ?? queryResult.data;
  const setSchedule = (s: SyncSchedule) => setLocalSchedule(s);

  return {
    schedule,
    setSchedule,
    isLoading: queryResult.loading,
    error: queryResult.error,
    save: async () => {
      if (localSchedule) await updateMutation.execute(localSchedule);
    },
  };
}

/** Rich composite hook for field mappings used by product sync page */
export function useFieldMappings(platformId: string) {
  const listResult = useApiList<Mapping>(
    `/api/v4/sync/platforms/${platformId}/mappings`,
  );
  const createMutation = useApiMutation<Mapping>(
    "POST",
    `/api/v4/sync/platforms/${platformId}/mappings`,
  );
  const deleteMutation = useApiMutation<void>(
    "DELETE",
    `/api/v4/sync/platforms/${platformId}/mappings/:id`,
  );
  const updateMutation = useApiMutation<Mapping>(
    "PATCH",
    `/api/v4/sync/platforms/${platformId}/mappings/:id`,
  );
  const [localMappings, setLocalMappings] = useState<Mapping[] | null>(null);

  const mappings = localMappings ?? listResult.items;

  const addMapping = (sourceFieldId: string, targetFieldId: string) => {
    const newMapping: Mapping = {
      id: `mapping-${Date.now()}`,
      sourceFieldId,
      targetFieldId,
      transformer: "direct",
    };
    setLocalMappings([...(localMappings ?? listResult.items), newMapping]);
  };

  const removeMapping = (id: string) => {
    setLocalMappings(
      (localMappings ?? listResult.items).filter((m) => m.id !== id),
    );
  };

  const updateTransformer = (
    id: string,
    transformer: Mapping["transformer"],
  ) => {
    setLocalMappings(
      (localMappings ?? listResult.items).map((m) =>
        m.id === id ? { ...m, transformer } : m,
      ),
    );
  };

  const autoMapFields = (sourceFields: Field[], targetFields: Field[]) => {
    const autoMapped = sourceFields
      .map((sf) => {
        const match = targetFields.find(
          (tf) => tf.name.toLowerCase() === sf.name.toLowerCase(),
        );
        return match
          ? {
              id: `auto-${sf.id}-${match.id}`,
              sourceFieldId: sf.id,
              targetFieldId: match.id,
              transformer: "direct" as Mapping["transformer"],
            }
          : null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null) as Mapping[];
    setLocalMappings(autoMapped);
  };

  const saveMappings = async (templateName?: string) => {
    const current = localMappings ?? listResult.items;
    await createMutation.execute({ mappings: current, templateName });
    listResult.refetch();
  };

  return {
    mappings,
    addMapping,
    removeMapping,
    updateTransformer,
    autoMapFields,
    saveMappings,
    isLoading: listResult.loading,
    error: listResult.error,
  };
}

export function useUpdateSyncSchedule(
  platformId: string,
): UseApiMutationResult<SyncSchedule> {
  return useApiMutation<SyncSchedule>(
    "PATCH",
    `/api/v4/sync/platforms/${platformId}/schedule`,
  );
}

export function useSyncJobs(
  platformId: string,
  filters?: ApiFilters,
): UseApiListResult<SyncJob> {
  return useApiList<SyncJob>(
    `/api/v4/sync/platforms/${platformId}/jobs`,
    filters,
  );
}

export function useSyncJob(
  platformId: string,
  jobId: string | null,
): UseApiQueryResult<SyncJob> {
  return useApiQuery<SyncJob>(
    jobId ? `/api/v4/sync/platforms/${platformId}/jobs/${jobId}` : null,
  );
}

export interface PreviewResult {
  source: Record<string, unknown>;
  target: Record<string, unknown>;
}

export function useProductPreview(platformId: string, mappings: Mapping[]) {
  const previewMutation = useApiMutation<PreviewResult>(
    "POST",
    `/api/v4/sync/platforms/${platformId}/preview`,
  );
  const [previewProduct, setPreviewProduct] = useState<PreviewResult | null>(
    null,
  );

  const runPreview = async (product: Record<string, unknown>) => {
    const result = await previewMutation.execute({ product, mappings });
    setPreviewProduct(result);
    return result;
  };

  return {
    previewProduct,
    runPreview,
    isLoading: previewMutation.loading,
    error: previewMutation.error,
  };
}
