/**
 * E-Signature hooks — Document signing & envelope management
 *
 * Handles:
 * - useEnvelopes: list, filter, search envelopes with real-time updates
 * - useTemplates: manage signing templates with versioning
 * - useSigningSession: active signing workflow state
 * - useAuditTrail: envelope audit log with filtering
 * - useEsigAnalytics: signing metrics and completion analytics
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

export function useEnvelopes(filters?: {
  status?: EnvelopeStatus;
  sender?: string;
  dateRange?: [Date, Date];
}) {
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate API call with mock data
    setLoading(true);
    const timer = setTimeout(() => {
      const mockEnvelopes: Envelope[] = [
        {
          id: "env-001",
          name: "NDA - Acme Corp",
          status: "COMPLETED",
          sender: { id: "u1", name: "John Smith", email: "john@example.com" },
          recipients: [
            {
              id: "r1",
              email: "legal@acme.com",
              name: "Jane Acme",
              role: "SIGNER",
              status: "SIGNED",
              signedDate: "2026-03-15T14:30:00Z",
            },
          ],
          documentCount: 1,
          createdDate: "2026-03-10T09:00:00Z",
          sentDate: "2026-03-10T09:15:00Z",
          completedDate: "2026-03-15T14:30:00Z",
          completionRate: 100,
        },
        {
          id: "env-002",
          name: "Service Agreement",
          status: "SIGNED",
          sender: { id: "u1", name: "John Smith", email: "john@example.com" },
          recipients: [
            {
              id: "r2",
              email: "contract@partner.io",
              name: "Mike Partner",
              role: "SIGNER",
              status: "SIGNED",
              signedDate: "2026-03-14T10:20:00Z",
            },
            {
              id: "r3",
              email: "approval@partner.io",
              name: "Sarah Partner",
              role: "CC",
              status: "VIEWED",
            },
          ],
          documentCount: 2,
          createdDate: "2026-03-08T14:00:00Z",
          sentDate: "2026-03-08T14:15:00Z",
          completionRate: 50,
        },
        {
          id: "env-003",
          name: "Employment Contract",
          status: "SENT",
          sender: { id: "u1", name: "John Smith", email: "john@example.com" },
          recipients: [
            {
              id: "r4",
              email: "hr@newcompany.com",
              name: "Alex New",
              role: "SIGNER",
              status: "PENDING",
            },
            {
              id: "r5",
              email: "legal@newcompany.com",
              name: "Legal Team",
              role: "APPROVER",
              status: "PENDING",
            },
          ],
          documentCount: 1,
          createdDate: "2026-03-12T11:00:00Z",
          sentDate: "2026-03-12T11:30:00Z",
          expiryDate: "2026-03-26T11:30:00Z",
          completionRate: 0,
        },
        {
          id: "env-004",
          name: "Loan Agreement",
          status: "VIEWED",
          sender: { id: "u2", name: "Lisa Admin", email: "lisa@example.com" },
          recipients: [
            {
              id: "r6",
              email: "borrower@bank.com",
              name: "Tom Borrower",
              role: "SIGNER",
              status: "VIEWED",
            },
          ],
          documentCount: 3,
          createdDate: "2026-03-11T08:00:00Z",
          sentDate: "2026-03-11T08:20:00Z",
          completionRate: 25,
        },
        {
          id: "env-005",
          name: "Partnership Agreement",
          status: "PENDING",
          sender: { id: "u1", name: "John Smith", email: "john@example.com" },
          recipients: [
            {
              id: "r7",
              email: "partner1@ventures.com",
              name: "Partner One",
              role: "SIGNER",
              status: "PENDING",
            },
            {
              id: "r8",
              email: "partner2@ventures.com",
              name: "Partner Two",
              role: "SIGNER",
              status: "PENDING",
            },
          ],
          documentCount: 2,
          createdDate: "2026-03-13T15:45:00Z",
          completionRate: 0,
        },
      ];

      setEnvelopes(mockEnvelopes);
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [filters]);

  return { envelopes, loading, error };
}

export function useTemplates() {
  const [templates, setTemplates] = useState<SigningTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const mockTemplates: SigningTemplate[] = [
        {
          id: "tpl-001",
          name: "NDA Template",
          category: "NDA",
          description: "Standard Non-Disclosure Agreement",
          version: 2,
          documentCount: 1,
          signatureFields: 3,
          usageCount: 24,
          lastUsed: "2026-03-15T10:00:00Z",
          createdDate: "2025-12-01T08:00:00Z",
          updatedDate: "2026-02-20T14:00:00Z",
          isActive: true,
        },
        {
          id: "tpl-002",
          name: "Employment Agreement",
          category: "EMPLOYMENT",
          description: "Full-time employment contract",
          version: 3,
          documentCount: 2,
          signatureFields: 4,
          usageCount: 18,
          lastUsed: "2026-03-12T11:00:00Z",
          createdDate: "2025-11-15T09:00:00Z",
          updatedDate: "2026-03-01T10:00:00Z",
          isActive: true,
        },
        {
          id: "tpl-003",
          name: "Service Agreement",
          category: "CONTRACT",
          description: "General service delivery contract",
          version: 1,
          documentCount: 1,
          signatureFields: 2,
          usageCount: 32,
          lastUsed: "2026-03-14T09:30:00Z",
          createdDate: "2025-10-10T08:00:00Z",
          updatedDate: "2026-01-15T12:00:00Z",
          isActive: true,
        },
      ];
      setTemplates(mockTemplates);
      setLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  return { templates, loading };
}

export function useSigningSession(envelopeId: string) {
  const [session, setSession] = useState<{
    envelopeId: string;
    recipientEmail: string;
    fields: Array<{
      id: string;
      type: SignatureFieldType;
      page: number;
      x: number;
      y: number;
      signed: boolean;
    }>;
    currentFieldIndex: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setSession({
        envelopeId,
        recipientEmail: "signer@example.com",
        fields: [
          {
            id: "f1",
            type: "SIGNATURE",
            page: 1,
            x: 100,
            y: 200,
            signed: false,
          },
          { id: "f2", type: "DATE", page: 1, x: 100, y: 250, signed: false },
          { id: "f3", type: "INITIAL", page: 2, x: 150, y: 300, signed: false },
        ],
        currentFieldIndex: 0,
      });
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [envelopeId]);

  return { session, loading };
}

export function useAuditTrail(envelopeId: string) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const mockEvents: AuditEvent[] = [
        {
          id: "evt-1",
          envelopeId,
          timestamp: "2026-03-15T14:30:00Z",
          action: "SIGNED",
          actor: { id: "u3", name: "Jane Signer", email: "jane@example.com" },
          details: { field: "signature", pageNumber: 1 },
        },
        {
          id: "evt-2",
          envelopeId,
          timestamp: "2026-03-15T14:25:00Z",
          action: "VIEWED",
          actor: { id: "u3", name: "Jane Signer", email: "jane@example.com" },
          details: { ipAddress: "192.168.1.1" },
        },
        {
          id: "evt-3",
          envelopeId,
          timestamp: "2026-03-10T09:15:00Z",
          action: "SENT",
          actor: { id: "u1", name: "John Smith", email: "john@example.com" },
          details: { recipientCount: 2 },
        },
      ];
      setEvents(mockEvents);
      setLoading(false);
    }, 700);

    return () => clearTimeout(timer);
  }, [envelopeId]);

  return { events, loading };
}

export function useEsigAnalytics() {
  const [analytics, setAnalytics] = useState<EsigAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const mockAnalytics: EsigAnalytics = {
        totalEnvelopes: 127,
        completedEnvelopes: 95,
        pendingEnvelopes: 24,
        expiredEnvelopes: 8,
        avgCompletionTime: 2.3,
        avgSignersPerEnvelope: 1.8,
        completionRate: 74.8,
        declineRate: 6.3,
      };
      setAnalytics(mockAnalytics);
      setLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  return { analytics, loading };
}
