'use client';

import { useApiList, useApiQuery, ApiFilters, UseApiListResult, UseApiQueryResult } from './use-api';

// Types
export interface FreightLoad {
  id: string;
  loadNumber: string;
  origin: string;
  destination: string;
  originCity: string;
  originState: string;
  destCity: string;
  destState: string;
  mode: "FTL" | "LTL" | "Intermodal";
  weight: number;
  pallets: number;
  rate: number;
  carrier: string | null;
  carrierDot: string | null;
  status: "Available" | "Booked" | "In-Transit" | "Delivered" | "Exception";
  pickupDate: string;
  deliveryDate: string;
  createdAt: string;
  documents: string[];
}

export interface FreightRate {
  id: string;
  laneId: string;
  origin: string;
  destination: string;
  contracted: number;
  spot: number;
  marketBench: number;
  carrier: string;
  carrierDot: string;
  equipment: string;
  validFrom: string;
  validTo: string;
  volume: number;
  mode: string;
}

export interface Carrier {
  id: string;
  name: string;
  dot: string;
  mc: string;
  rating: number;
  safetyRating: number;
  loadVolume: number;
  onTimeRate: number;
  insuranceExpiry: string;
  operatingAuthority: "Active" | "Inactive" | "Suspended";
  complianceScore: number;
  scoreHistory: Array<{ date: string; score: number }>;
}

export interface FreightAudit {
  id: string;
  loadId: string;
  auditDate: string;
  findings: string;
  severity: "Low" | "Medium" | "High";
  savings: number;
  category: "Rate" | "Compliance" | "Documentation" | "Safety";
}

export interface LaneAnalytics {
  laneId: string;
  origin: string;
  destination: string;
  avgRate: number;
  minRate: number;
  maxRate: number;
  volumeYTD: number;
  trendPercent: number;
  carriers: string[];
}

export function useFreightLoads(filters?: ApiFilters): UseApiListResult<FreightLoad> {
  return useApiList<FreightLoad>('/api/v4/freight/loads', filters);
}

export function useFreightLoadDetail(id: string | null): UseApiQueryResult<FreightLoad> {
  return useApiQuery<FreightLoad>(id ? `/api/v4/freight/loads/${id}` : null);
}

export function useFreightRates(filters?: ApiFilters): UseApiListResult<FreightRate> {
  return useApiList<FreightRate>('/api/v4/freight/rates', filters);
}

export function useLaneAnalytics(filters?: ApiFilters): UseApiListResult<LaneAnalytics> {
  return useApiList<LaneAnalytics>('/api/v4/freight/lane-analytics', filters);
}

export function useCarrierScorecard(filters?: ApiFilters): UseApiListResult<Carrier> {
  return useApiList<Carrier>('/api/v4/freight/carriers', filters);
}

export function useCarrierDetail(id: string | null): UseApiQueryResult<Carrier> {
  return useApiQuery<Carrier>(id ? `/api/v4/freight/carriers/${id}` : null);
}

export function useFreightAudit(filters?: ApiFilters): UseApiListResult<FreightAudit> {
  return useApiList<FreightAudit>('/api/v4/freight/audits', filters);
}
