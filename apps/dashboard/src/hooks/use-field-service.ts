/**
 * useFieldService — Comprehensive field service management hooks.
 * Provides data for field service overview, work orders, dispatch, technicians, and scheduling.
 */

import { useEffect, useState, useCallback, useMemo } from "react";

/**
 * Work order status enum
 */
export type WorkOrderStatus = "created" | "scheduled" | "dispatched" | "in_progress" | "completed" | "cancelled";
export type WorkOrderPriority = "low" | "medium" | "high" | "urgent";
export type WorkOrderType = "installation" | "maintenance" | "repair" | "inspection";

/**
 * Technician status enum
 */
export type TechnicianStatus = "available" | "on_job" | "break" | "offline";
export type TechnicianSkill = "electrical" | "plumbing" | "hvac" | "appliances" | "general";

/**
 * Work Order data structure
 */
export interface WorkOrder {
  id: string;
  jobNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceType: WorkOrderType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assignedTechId?: string;
  assignedTechName?: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  eta?: string;
  completionTime?: string;
  requiredSkills: TechnicianSkill[];
  notes: string[];
  partsUsed: { name: string; cost: number }[];
  photos: string[];
  signature?: string;
  createdAt: string;
  updatedAt: string;
  preferredDate: string;
  estimatedDuration: number; // in minutes
}

/**
 * Technician data structure
 */
export interface Technician {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: TechnicianStatus;
  currentJobId?: string;
  skillSet: TechnicianSkill[];
  ratings: number;
  jobsCompleted: number;
  latitude: number;
  longitude: number;
  availableFrom?: string;
  currentWorkload: number; // 0-100
  responseTime: number; // in minutes
  location: string;
}

/**
 * Field service overview metrics
 */
export interface FieldServiceOverview {
  activeJobs: number;
  techniciansInField: number;
  completionRate: number;
  avgResponseTime: number;
  totalTechnicians: number;
  jobsCompletedToday: number;
  pendingDispatch: number;
}

/**
 * Job schedule item
 */
export interface ScheduleItem {
  jobId: string;
  technicianId: string;
  technicianName: string;
  startTime: string;
  endTime: string;
  jobNumber: string;
  customerName: string;
  location: string;
  status: WorkOrderStatus;
}

/**
 * SLA metrics
 */
export interface SLAMetrics {
  onTimePercentage: number;
  overdueCount: number;
  totalJobs: number;
  avgCompletionTime: number; // in minutes
}

/**
 * Mock data generators
 */
const TECHNICIANS: Technician[] = [
  {
    id: "tech-1",
    name: "James Mitchell",
    email: "james@witylogix.io",
    phone: "+1 555-0201",
    status: "on_job",
    currentJobId: "wo-001",
    skillSet: ["electrical", "general"],
    ratings: 4.8,
    jobsCompleted: 487,
    latitude: 40.7128,
    longitude: -74.006,
    location: "Downtown",
    currentWorkload: 75,
    responseTime: 12,
  },
  {
    id: "tech-2",
    name: "Sarah Chen",
    email: "sarah@witylogix.io",
    phone: "+1 555-0202",
    status: "available",
    skillSet: ["plumbing", "general"],
    ratings: 4.9,
    jobsCompleted: 512,
    latitude: 40.758,
    longitude: -73.9855,
    location: "Midtown",
    currentWorkload: 30,
    responseTime: 8,
  },
  {
    id: "tech-3",
    name: "Marcus Williams",
    email: "marcus@witylogix.io",
    phone: "+1 555-0203",
    status: "on_job",
    currentJobId: "wo-003",
    skillSet: ["hvac", "general"],
    ratings: 4.7,
    jobsCompleted: 456,
    latitude: 40.6892,
    longitude: -74.0445,
    location: "Brooklyn",
    currentWorkload: 85,
    responseTime: 10,
  },
  {
    id: "tech-4",
    name: "Elena Rodriguez",
    email: "elena@witylogix.io",
    phone: "+1 555-0204",
    status: "break",
    skillSet: ["appliances", "general"],
    ratings: 4.6,
    jobsCompleted: 423,
    latitude: 40.7282,
    longitude: -73.7949,
    location: "Queens",
    currentWorkload: 0,
    responseTime: 15,
  },
  {
    id: "tech-5",
    name: "David Park",
    email: "david@witylogix.io",
    phone: "+1 555-0205",
    status: "available",
    skillSet: ["electrical", "hvac"],
    ratings: 4.8,
    jobsCompleted: 534,
    latitude: 40.8448,
    longitude: -73.8648,
    location: "Upper Manhattan",
    currentWorkload: 20,
    responseTime: 9,
  },
];

const WORK_ORDERS: WorkOrder[] = [
  {
    id: "wo-001",
    jobNumber: "JOB-2024-001",
    customerId: "cust-101",
    customerName: "John Anderson",
    customerPhone: "+1 555-1001",
    serviceType: "installation",
    priority: "high",
    status: "in_progress",
    assignedTechId: "tech-1",
    assignedTechName: "James Mitchell",
    description: "Install new HVAC system",
    location: "123 Main St, New York, NY",
    latitude: 40.7128,
    longitude: -74.006,
    eta: "2:30 PM",
    requiredSkills: ["hvac"],
    notes: ["Customer prefers afternoon", "Unit needs refrigerant"],
    partsUsed: [],
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferredDate: "2024-03-17",
    estimatedDuration: 180,
  },
  {
    id: "wo-002",
    jobNumber: "JOB-2024-002",
    customerId: "cust-102",
    customerName: "Sarah Johnson",
    customerPhone: "+1 555-1002",
    serviceType: "maintenance",
    priority: "medium",
    status: "scheduled",
    description: "Annual AC maintenance and filter replacement",
    location: "456 Oak Ave, New York, NY",
    latitude: 40.758,
    longitude: -73.9855,
    requiredSkills: ["hvac", "general"],
    notes: [],
    partsUsed: [],
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferredDate: "2024-03-18",
    estimatedDuration: 60,
  },
  {
    id: "wo-003",
    jobNumber: "JOB-2024-003",
    customerId: "cust-103",
    customerName: "Michael Brown",
    customerPhone: "+1 555-1003",
    serviceType: "repair",
    priority: "urgent",
    status: "in_progress",
    assignedTechId: "tech-3",
    assignedTechName: "Marcus Williams",
    description: "Furnace not heating properly - urgent repair",
    location: "789 Elm Rd, Brooklyn, NY",
    latitude: 40.6892,
    longitude: -74.0445,
    eta: "1:00 PM",
    requiredSkills: ["hvac"],
    notes: ["Temperature 55F inside", "No pilot light"],
    partsUsed: [],
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferredDate: "2024-03-17",
    estimatedDuration: 120,
  },
  {
    id: "wo-004",
    jobNumber: "JOB-2024-004",
    customerId: "cust-104",
    customerName: "Patricia Miller",
    customerPhone: "+1 555-1004",
    serviceType: "installation",
    priority: "medium",
    status: "dispatched",
    assignedTechId: "tech-2",
    assignedTechName: "Sarah Chen",
    description: "Install new hot water heater",
    location: "321 Pine Ln, Manhattan, NY",
    latitude: 40.7282,
    longitude: -73.7949,
    eta: "3:45 PM",
    requiredSkills: ["plumbing"],
    notes: ["40-gallon tank", "Gas connection required"],
    partsUsed: [],
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferredDate: "2024-03-17",
    estimatedDuration: 150,
  },
  {
    id: "wo-005",
    jobNumber: "JOB-2024-005",
    customerId: "cust-105",
    customerName: "James Taylor",
    customerPhone: "+1 555-1005",
    serviceType: "inspection",
    priority: "low",
    status: "created",
    description: "Home inspection for new purchase",
    location: "555 Maple Dr, Queens, NY",
    latitude: 40.7446,
    longitude: -73.9485,
    requiredSkills: ["general"],
    notes: [],
    partsUsed: [],
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferredDate: "2024-03-20",
    estimatedDuration: 120,
  },
  {
    id: "wo-006",
    jobNumber: "JOB-2024-006",
    customerId: "cust-106",
    customerName: "Emily Davis",
    customerPhone: "+1 555-1006",
    serviceType: "repair",
    priority: "high",
    status: "completed",
    assignedTechId: "tech-1",
    assignedTechName: "James Mitchell",
    description: "Broken electrical outlet replacement",
    location: "888 Cedar St, Manhattan, NY",
    latitude: 40.7489,
    longitude: -73.968,
    completionTime: "11:30 AM",
    requiredSkills: ["electrical"],
    notes: ["Outlet was overloaded", "Upgraded circuit breaker"],
    partsUsed: [{ name: "GFCI Outlet", cost: 45 }, { name: "Wire", cost: 15 }],
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferredDate: "2024-03-17",
    estimatedDuration: 45,
  },
];

/**
 * Hook: useFieldServiceOverview
 * Returns overview metrics for field service dashboard
 */
export function useFieldServiceOverview(): FieldServiceOverview & { isLoading: boolean } {
  const [overview, setOverview] = useState<FieldServiceOverview & { isLoading: boolean }>({
    activeJobs: 0,
    techniciansInField: 0,
    completionRate: 0,
    avgResponseTime: 0,
    totalTechnicians: 0,
    jobsCompletedToday: 0,
    pendingDispatch: 0,
    isLoading: true,
  });

  useEffect(() => {
    // Simulate API call with mock data
    const timer = setTimeout(() => {
      const activeJobs = WORK_ORDERS.filter((w) => ["in_progress", "dispatched"].includes(w.status)).length;
      const inProgress = WORK_ORDERS.filter((w) => w.status === "in_progress").length;
      const completed = WORK_ORDERS.filter((w) => w.status === "completed").length;
      const total = WORK_ORDERS.length;
      const techsInField = TECHNICIANS.filter((t) => t.status === "on_job").length;
      const avgResponse = Math.round(TECHNICIANS.reduce((sum, t) => sum + t.responseTime, 0) / TECHNICIANS.length);

      setOverview({
        activeJobs,
        techniciansInField: techsInField,
        completionRate: Math.round((completed / total) * 100),
        avgResponseTime: avgResponse,
        totalTechnicians: TECHNICIANS.length,
        jobsCompletedToday: completed,
        pendingDispatch: WORK_ORDERS.filter((w) => w.status === "created").length,
        isLoading: false,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  return overview;
}

/**
 * Hook: useWorkOrders
 * Returns filtered work orders with pagination
 */
export function useWorkOrders(
  filters?: {
    status?: WorkOrderStatus;
    priority?: WorkOrderPriority;
    type?: WorkOrderType;
    dateRange?: { start: string; end: string };
    searchTerm?: string;
  }
): { orders: WorkOrder[]; total: number; isLoading: boolean } {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      let result = [...WORK_ORDERS];

      if (filters?.status) {
        result = result.filter((o) => o.status === filters.status);
      }

      if (filters?.priority) {
        result = result.filter((o) => o.priority === filters.priority);
      }

      if (filters?.type) {
        result = result.filter((o) => o.serviceType === filters.type);
      }

      if (filters?.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        result = result.filter(
          (o) =>
            o.jobNumber.toLowerCase().includes(term) ||
            o.customerName.toLowerCase().includes(term) ||
            o.description.toLowerCase().includes(term)
        );
      }

      setOrders(result);
      setIsLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [filters]);

  return { orders, total: orders.length, isLoading };
}

/**
 * Hook: useTechnicians
 * Returns technician data
 */
export function useTechnicians(
  filters?: { status?: TechnicianStatus; skill?: TechnicianSkill }
): { technicians: Technician[]; isLoading: boolean } {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      let result = [...TECHNICIANS];

      if (filters?.status) {
        result = result.filter((t) => t.status === filters.status);
      }

      if (filters?.skill) {
        result = result.filter((t) => t.skillSet.includes(filters.skill));
      }

      setTechnicians(result);
      setIsLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [filters]);

  return { technicians, isLoading };
}

/**
 * Hook: useDispatchMap
 * Returns data for dispatch map (technicians and jobs with locations)
 */
export function useDispatchMap(): {
  technicians: Technician[];
  jobs: WorkOrder[];
  isLoading: boolean;
} {
  const [data, setData] = useState<{ technicians: Technician[]; jobs: WorkOrder[]; isLoading: boolean }>({
    technicians: [],
    jobs: [],
    isLoading: true,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setData({
        technicians: TECHNICIANS,
        jobs: WORK_ORDERS.filter((w) => !["completed", "cancelled"].includes(w.status)),
        isLoading: false,
      });
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  return data;
}

/**
 * Hook: useJobSchedule
 * Returns schedule items for today
 */
export function useJobSchedule(): { schedule: ScheduleItem[]; isLoading: boolean } {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      const items: ScheduleItem[] = WORK_ORDERS.filter((w) => w.assignedTechId).map((w) => ({
        jobId: w.id,
        technicianId: w.assignedTechId!,
        technicianName: w.assignedTechName!,
        startTime: "9:00 AM", // Mock time
        endTime: "11:00 AM", // Mock time
        jobNumber: w.jobNumber,
        customerName: w.customerName,
        location: w.location,
        status: w.status,
      }));

      setSchedule(items.sort((a, b) => a.startTime.localeCompare(b.startTime)));
      setIsLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  return { schedule, isLoading };
}

/**
 * Hook: useSLAMetrics
 * Returns SLA compliance metrics
 */
export function useSLAMetrics(): SLAMetrics & { isLoading: boolean } {
  const [metrics, setMetrics] = useState<SLAMetrics & { isLoading: boolean }>({
    onTimePercentage: 0,
    overdueCount: 0,
    totalJobs: 0,
    avgCompletionTime: 0,
    isLoading: true,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      const completed = WORK_ORDERS.filter((w) => w.status === "completed");
      const total = WORK_ORDERS.length;

      setMetrics({
        onTimePercentage: 92,
        overdueCount: 2,
        totalJobs: total,
        avgCompletionTime: 95,
        isLoading: false,
      });
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  return metrics;
}

/**
 * Hook: useWorkOrderDetail
 * Returns detailed work order data
 */
export function useWorkOrderDetail(jobId: string): { order: WorkOrder | null; isLoading: boolean } {
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      const found = WORK_ORDERS.find((w) => w.id === jobId);
      setOrder(found || null);
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [jobId]);

  return { order, isLoading };
}

/**
 * Hook: useAutoAssign
 * Suggests and assigns nearest available technician with matching skills
 */
export function useAutoAssign(): {
  suggestAssignment: (jobId: string) => Promise<{ techId: string; techName: string } | null>;
  isLoading: boolean;
} {
  const [isLoading, setIsLoading] = useState(false);

  const suggestAssignment = useCallback(async (jobId: string) => {
    setIsLoading(true);
    return new Promise((resolve) => {
      setTimeout(() => {
        const job = WORK_ORDERS.find((w) => w.id === jobId);
        if (!job) {
          setIsLoading(false);
          resolve(null);
          return;
        }

        // Find available technician with matching skills
        const suitable = TECHNICIANS.filter(
          (t) =>
            t.status === "available" &&
            job.requiredSkills.some((skill) => t.skillSet.includes(skill))
        ).sort((a, b) => a.currentWorkload - b.currentWorkload);

        if (suitable.length > 0) {
          const assigned = suitable[0];
          setIsLoading(false);
          resolve({ techId: assigned.id, techName: assigned.name });
        } else {
          setIsLoading(false);
          resolve(null);
        }
      }, 500);
    });
  }, []);

  return { suggestAssignment, isLoading };
}
