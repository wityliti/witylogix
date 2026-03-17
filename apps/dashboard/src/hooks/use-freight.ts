"use client";

import { useState, useCallback, useEffect, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════
   FREIGHT MANAGEMENT HOOKS
   ═══════════════════════════════════════════════════════════ */

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

// Mock data generators
const generateMockLoads = (): FreightLoad[] => {
  const origins = [
    { city: "Los Angeles", state: "CA" },
    { city: "Long Beach", state: "CA" },
    { city: "Chicago", state: "IL" },
    { city: "Dallas", state: "TX" },
    { city: "Atlanta", state: "GA" },
    { city: "Memphis", state: "TN" },
  ];
  const destinations = [
    { city: "New York", state: "NY" },
    { city: "Los Angeles", state: "CA" },
    { city: "Houston", state: "TX" },
    { city: "Miami", state: "FL" },
    { city: "Seattle", state: "WA" },
    { city: "Denver", state: "CO" },
  ];
  const modes: Array<"FTL" | "LTL" | "Intermodal"> = ["FTL", "LTL", "Intermodal"];
  const statuses: Array<"Available" | "Booked" | "In-Transit" | "Delivered" | "Exception"> = [
    "Available",
    "Booked",
    "In-Transit",
    "Delivered",
    "Exception",
  ];
  const carriers = ["ABC Trucking", "XYZ Logistics", "Prime Transport", "Swift Haul", "Golden State Freight"];

  return Array.from({ length: 50 }, (_, i) => {
    const origin = origins[i % origins.length];
    const dest = destinations[(i + 1) % destinations.length];
    const mode = modes[i % modes.length];
    const weight = mode === "FTL" ? 40000 + Math.random() * 20000 : 5000 + Math.random() * 15000;
    const baseRate = 1.5 + Math.random() * 2.5;
    const rate = Math.round(weight * baseRate) / 100;

    return {
      id: `load-${1000 + i}`,
      loadNumber: `LDG${String(10000 + i).slice(-5)}`,
      origin: `${origin.city}, ${origin.state}`,
      destination: `${dest.city}, ${dest.state}`,
      originCity: origin.city,
      originState: origin.state,
      destCity: dest.city,
      destState: dest.state,
      mode,
      weight,
      pallets: Math.floor(weight / 500),
      rate,
      carrier: i % 5 === 0 ? null : carriers[i % carriers.length],
      carrierDot: i % 5 === 0 ? null : `${100000 + i}`,
      status: statuses[i % statuses.length],
      pickupDate: new Date(Date.now() + Math.random() * 86400000 * 2).toISOString(),
      deliveryDate: new Date(Date.now() + Math.random() * 86400000 * 10).toISOString(),
      createdAt: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
      documents: i % 3 === 0 ? ["bill_of_lading.pdf", "bol_signed.pdf"] : [],
    };
  });
};

const generateMockRates = (): FreightRate[] => {
  const lanes = [
    { from: "Los Angeles, CA", to: "New York, NY" },
    { from: "Dallas, TX", to: "Atlanta, GA" },
    { from: "Chicago, IL", to: "Houston, TX" },
  ];
  const carriers = ["ABC Trucking", "XYZ Logistics", "Prime Transport", "Swift Haul"];

  return lanes.flatMap((lane, idx) =>
    carriers.map((carrier, cidx) => ({
      id: `rate-${idx}-${cidx}`,
      laneId: `lane-${idx}`,
      origin: lane.from,
      destination: lane.to,
      contracted: 2000 + Math.random() * 500,
      spot: 2200 + Math.random() * 600,
      marketBench: 2100 + Math.random() * 550,
      carrier,
      carrierDot: `${100000 + cidx}`,
      equipment: "53' Dry Van",
      validFrom: new Date(Date.now() - 86400000 * 30).toISOString(),
      validTo: new Date(Date.now() + 86400000 * 60).toISOString(),
      volume: 100 + Math.random() * 200,
      mode: "FTL",
    }))
  );
};

const generateMockCarriers = (): Carrier[] => {
  const names = ["ABC Trucking", "XYZ Logistics", "Prime Transport", "Swift Haul", "Golden State Freight"];
  return names.map((name, i) => ({
    id: `carrier-${i}`,
    name,
    dot: `${100000 + i}`,
    mc: `${200000 + i}`,
    rating: 3.5 + Math.random() * 1.5,
    safetyRating: 80 + Math.random() * 20,
    loadVolume: 100 + Math.random() * 500,
    onTimeRate: 90 + Math.random() * 9.9,
    insuranceExpiry: new Date(Date.now() + 86400000 * 180).toISOString(),
    operatingAuthority: "Active",
    complianceScore: 85 + Math.random() * 15,
    scoreHistory: Array.from({ length: 12 }, (_, idx) => ({
      date: new Date(Date.now() - 86400000 * 30 * (11 - idx)).toISOString(),
      score: 80 + Math.random() * 20,
    })),
  }));
};

const generateMockAudits = (): FreightAudit[] => {
  const categories: Array<"Rate" | "Compliance" | "Documentation" | "Safety"> = [
    "Rate",
    "Compliance",
    "Documentation",
    "Safety",
  ];
  const severities: Array<"Low" | "Medium" | "High"> = ["Low", "Medium", "High"];

  return Array.from({ length: 20 }, (_, i) => ({
    id: `audit-${i}`,
    loadId: `load-${1000 + i}`,
    auditDate: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
    findings: [
      "Carrier overcharges on fuel surcharge",
      "Missing insurance documentation",
      "Rate exceeds market benchmark by 8%",
      "Safety compliance gap",
    ][i % 4],
    severity: severities[i % severities.length],
    savings: 100 + Math.random() * 500,
    category: categories[i % categories.length],
  }));
};

const generateMockLaneAnalytics = (): LaneAnalytics[] => {
  return [
    {
      laneId: "lane-0",
      origin: "Los Angeles, CA",
      destination: "New York, NY",
      avgRate: 2150,
      minRate: 1950,
      maxRate: 2450,
      volumeYTD: 450,
      trendPercent: 3.2,
      carriers: ["ABC Trucking", "Prime Transport"],
    },
    {
      laneId: "lane-1",
      origin: "Dallas, TX",
      destination: "Atlanta, GA",
      avgRate: 1800,
      minRate: 1650,
      maxRate: 2000,
      volumeYTD: 320,
      trendPercent: -2.1,
      carriers: ["XYZ Logistics", "Swift Haul"],
    },
    {
      laneId: "lane-2",
      origin: "Chicago, IL",
      destination: "Houston, TX",
      avgRate: 1650,
      minRate: 1450,
      maxRate: 1900,
      volumeYTD: 580,
      trendPercent: 5.8,
      carriers: ["Golden State Freight", "ABC Trucking"],
    },
  ];
};

// Hook: useFreightLoads
export function useFreightLoads(pageSize = 20) {
  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({
    origin: "",
    destination: "",
    mode: "" as "" | "FTL" | "LTL" | "Intermodal",
    status: "" as "" | "Available" | "Booked" | "In-Transit" | "Delivered" | "Exception",
    startDate: "",
    endDate: "",
    carrier: "",
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoads(generateMockLoads());
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    let result = loads;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.loadNumber.toLowerCase().includes(q) ||
          l.origin.toLowerCase().includes(q) ||
          l.destination.toLowerCase().includes(q) ||
          (l.carrier?.toLowerCase().includes(q) ?? false)
      );
    }

    if (filters.origin) result = result.filter((l) => l.originCity.toLowerCase().includes(filters.origin.toLowerCase()));
    if (filters.destination) result = result.filter((l) => l.destCity.toLowerCase().includes(filters.destination.toLowerCase()));
    if (filters.mode) result = result.filter((l) => l.mode === filters.mode);
    if (filters.status) result = result.filter((l) => l.status === filters.status);
    if (filters.carrier) result = result.filter((l) => l.carrier?.toLowerCase().includes(filters.carrier.toLowerCase()));

    return result;
  }, [loads, search, filters]);

  const paged = useMemo(() => {
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return {
    loads: paged,
    totalCount: filtered.length,
    page,
    setPage,
    filters,
    setFilters,
    search,
    setSearch,
    loading,
  };
}

// Hook: useFreightRates
export function useFreightRates() {
  const [rates, setRates] = useState<FreightRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLane, setSelectedLane] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setRates(generateMockRates());
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return { rates, loading, selectedLane, setSelectedLane };
}

// Hook: useLaneAnalytics
export function useLaneAnalytics() {
  const [analytics, setAnalytics] = useState<LaneAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setAnalytics(generateMockLaneAnalytics());
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return { analytics, loading };
}

// Hook: useCarrierScorecard
export function useCarrierScorecard() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setCarriers(generateMockCarriers());
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return { carriers, loading };
}

// Hook: useFreightAudit
export function useFreightAudit() {
  const [audits, setAudits] = useState<FreightAudit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setAudits(generateMockAudits());
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const totalSavings = useMemo(() => audits.reduce((sum, a) => sum + a.savings, 0), [audits]);

  return { audits, loading, totalSavings };
}

// Hook: useFMCSALookup
export function useFMCSALookup(query: string) {
  const [results, setResults] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      const timer = setTimeout(() => {
        const allCarriers = generateMockCarriers();
        const filtered = allCarriers.filter(
          (c) => c.dot.includes(q) || c.mc.includes(q) || c.name.toLowerCase().includes(q.toLowerCase())
        );
        setResults(filtered);
        setLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    },
    []
  );

  useEffect(() => {
    const cleanup = search(query);
    return cleanup;
  }, [query, search]);

  return { results, loading };
}

// Hook: useRateCalculator
export function useRateCalculator() {
  const [calculation, setCalculation] = useState<{
    origin: string;
    destination: string;
    weight: number;
    class: string;
    equipment: string;
    estimatedRate: number;
  } | null>(null);

  const calculate = useCallback(
    (origin: string, destination: string, weight: number, freightClass: string, equipment: string) => {
      // Simple calculation: base rate + weight factor + distance estimate
      const baseRate = 1.8;
      const weightFactor = weight > 20000 ? 0.8 : weight > 10000 ? 1.0 : 1.2;
      const classMultiplier = freightClass === "LTL" ? 1.5 : 1.0;
      const estimatedRate = Math.round((baseRate * weight * weightFactor * classMultiplier) / 100) * 100;

      setCalculation({
        origin,
        destination,
        weight,
        class: freightClass,
        equipment,
        estimatedRate,
      });

      return estimatedRate;
    },
    []
  );

  return { calculation, calculate };
}
