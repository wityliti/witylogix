"use client";

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

export type EnvelopeStatus =
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "SIGNED"
  | "COMPLETED"
  | "DECLINED"
  | "VOIDED"
  | "EXPIRED";
export type SignatureFieldType =
  | "SIGNATURE"
  | "INITIAL"
  | "DATE"
  | "CHECKBOX"
  | "TEXT"
  | "RADIOBUTTON"
  | "DROPDOWN";
export type TemplateCategory =
  | "CONTRACT"
  | "NDA"
  | "EMPLOYMENT"
  | "FINANCIAL"
  | "REAL_ESTATE"
  | "HEALTHCARE"
  | "CUSTOM";

export interface Recipient {
  id: string;
  email: string;
  name: string;
  role: "SIGNER" | "CC" | "APPROVER";
  status: "PENDING" | "SENT" | "VIEWED" | "SIGNED" | "DECLINED";
  signedDate?: string;
  signatureImage?: string;
}

export interface Envelope {
  id: string;
  name: string;
  status: EnvelopeStatus;
  sender: {
    id: string;
    name: string;
    email: string;
  };
  recipients: Recipient[];
  documentCount: number;
  createdDate: string;
  sentDate?: string;
  completedDate?: string;
  expiryDate?: string;
  completionRate: number;
  templateId?: string;
}

export interface SigningTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  version: number;
  documentCount: number;
  signatureFields: number;
  usageCount: number;
  lastUsed?: string;
  createdDate: string;
  updatedDate: string;
  isActive: boolean;
}

export interface AuditEvent {
  id: string;
  envelopeId: string;
  timestamp: string;
  action:
    | "CREATED"
    | "SENT"
    | "VIEWED"
    | "SIGNED"
    | "DECLINED"
    | "VOIDED"
    | "SHARED";
  actor: {
    id: string;
    name: string;
    email: string;
  };
  details: Record<string, any>;
}

export interface EsigAnalytics {
  totalEnvelopes: number;
  completedEnvelopes: number;
  pendingEnvelopes: number;
  expiredEnvelopes: number;
  avgCompletionTime: number;
  avgSignersPerEnvelope: number;
  completionRate: number;
  declineRate: number;
}

// ─── HOOKS ──────────────────────────────────────────────────────────

export function useEnvelopes(filters?: ApiFilters): UseApiListResult<Envelope> {
  return useApiList<Envelope>("/api/v4/envelopes", filters);
}

export function useEnvelope(id: string | null): UseApiQueryResult<Envelope> {
  return useApiQuery<Envelope>(id ? `/api/v4/envelopes/${id}` : null);
}

export function useCreateEnvelope(): UseApiMutationResult<Envelope> {
  return useApiMutation<Envelope>("POST", "/api/v4/envelopes");
}

export function useUpdateEnvelope(id: string): UseApiMutationResult<Envelope> {
  return useApiMutation<Envelope>("PATCH", `/api/v4/envelopes/${id}`);
}

export function useDeleteEnvelope(id: string): UseApiMutationResult<void> {
  return useApiMutation<void>("DELETE", `/api/v4/envelopes/${id}`);
}

export function useTemplates(
  filters?: ApiFilters,
): UseApiListResult<SigningTemplate> {
  return useApiList<SigningTemplate>("/api/v4/signing-templates", filters);
}

export function useTemplate(
  id: string | null,
): UseApiQueryResult<SigningTemplate> {
  return useApiQuery<SigningTemplate>(
    id ? `/api/v4/signing-templates/${id}` : null,
  );
}

export function useCreateTemplate(): UseApiMutationResult<SigningTemplate> {
  return useApiMutation<SigningTemplate>("POST", "/api/v4/signing-templates");
}

export function useSigningSession(
  envelopeId: string | null,
): UseApiQueryResult<any> {
  return useApiQuery<any>(
    envelopeId ? `/api/v4/envelopes/${envelopeId}/session` : null,
  );
}

export function useAuditTrail(
  envelopeId: string | null,
): UseApiListResult<AuditEvent> {
  return useApiList<AuditEvent>(
    envelopeId ? `/api/v4/envelopes/${envelopeId}/audit` : null,
  );
}

export function useEsigAnalytics(): UseApiQueryResult<EsigAnalytics> {
  return useApiQuery<EsigAnalytics>("/api/v4/esig/analytics");
}
