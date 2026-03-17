import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
   ELD HOOKS — Real-time HOS, violations, DVIR, and compliance
   ═══════════════════════════════════════════════════════════ */

// Types
export type DutyStatus = "OFF_DUTY" | "SLEEPER" | "DRIVING" | "ON_DUTY";
export type ViolationType = "HOURS_EXCEEDED" | "NO_BREAK" | "FATIGUE" | "FALSIFIED" | "LOGGED_EDIT";
export type DefectSeverity = "CRITICAL" | "MAJOR" | "MINOR";
export type DefectStatus = "REPORTED" | "ACKNOWLEDGED" | "REPAIRED" | "CERTIFIED";
export type InspectionType = "PRE_TRIP" | "POST_TRIP";
export type InspectionStatus = "PASSED" | "FAILED";

export interface DriverHOS {
  driverId: string;
  driverName: string;
  currentStatus: DutyStatus;
  drivingTimeRemaining: number; // minutes
  onDutyWindowRemaining: number; // minutes (14h window)
  cycleHours: number; // 70h/8d or 60h/7d
  cycleHoursUsed: number;
  breakStatus: "TAKEN" | "REQUIRED" | "NOT_REQUIRED";
  breakTimeRemaining: number; // minutes (30-min break required)
  lastStatusChange: string; // ISO timestamp
  personalConveyance: boolean;
  yardMove: boolean;
}

export interface HosViolation {
  id: string;
  driverId: string;
  driverName: string;
  type: ViolationType;
  severity: "CRITICAL" | "WARNING" | "INFO";
  timestamp: string; // ISO timestamp
  duration: number; // minutes
  resolvedAt?: string; // ISO timestamp
  description: string;
  suggestedAction: string;
}

export interface DvirDefect {
  id: string;
  vehicleId: string;
  component: string; // "tire", "brake", "light", "coupling", "engine", "body", "other"
  description: string;
  severity: DefectSeverity;
  status: DefectStatus;
  reportedAt: string; // ISO timestamp
  photoUrl?: string;
  driverId: string;
  driverName: string;
  mechanicApproval?: {
    mechanicId: string;
    mechanicName: string;
    approvedAt: string;
  };
}

export interface DvirInspection {
  id: string;
  vehicleId: string;
  vehicleNumber: string; // e.g., "WTY-4501"
  type: InspectionType;
  status: InspectionStatus;
  driverId: string;
  driverName: string;
  inspectionDate: string; // ISO timestamp
  items: {
    name: string;
    status: "PASS" | "FAIL" | "N/A";
    notes?: string;
  }[];
  defects: DvirDefect[];
  signatureUrl?: string;
  photos: string[];
}

export interface EldEvent {
  id: string;
  driverId: string;
  driverName: string;
  type: "STATUS_CHANGE" | "VIOLATION" | "EDIT_REQUEST" | "DVIR_COMPLETION";
  timestamp: string; // ISO timestamp
  description: string;
  data?: Record<string, unknown>;
}

export interface FleetCompliance {
  totalDrivers: number;
  compliantDrivers: number;
  compliancePercentage: number;
  activeViolations: number;
  dvirCompletionRate: number; // percentage
  openDefects: number;
  criticalDefects: number;
}

// Mock data generators
const generateMockHOS = (driverId: string, driverName: string): DriverHOS => {
  const statuses: DutyStatus[] = ["OFF_DUTY", "SLEEPER", "DRIVING", "ON_DUTY"];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

  return {
    driverId,
    driverName,
    currentStatus: randomStatus,
    drivingTimeRemaining: Math.floor(Math.random() * 660) + 60, // 1-11 hours
    onDutyWindowRemaining: Math.floor(Math.random() * 840) + 120, // 2-14 hours
    cycleHours: 70,
    cycleHoursUsed: Math.floor(Math.random() * 70),
    breakStatus: Math.random() > 0.5 ? "TAKEN" : "REQUIRED",
    breakTimeRemaining: Math.random() > 0.5 ? 0 : 30,
    lastStatusChange: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    personalConveyance: false,
    yardMove: false,
  };
};

const generateMockViolations = (count: number): HosViolation[] => {
  const violationTypes: ViolationType[] = [
    "HOURS_EXCEEDED",
    "NO_BREAK",
    "FATIGUE",
    "FALSIFIED",
    "LOGGED_EDIT",
  ];
  const violations: HosViolation[] = [];

  for (let i = 0; i < count; i++) {
    const type = violationTypes[Math.floor(Math.random() * violationTypes.length)];
    violations.push({
      id: `vio-${i + 1}`,
      driverId: `drv-${Math.floor(Math.random() * 8) + 1}`,
      driverName: ["Carlos Martinez", "Sofia Lindberg", "Ahmed Khalil"][
        Math.floor(Math.random() * 3)
      ],
      type,
      severity:
        type === "HOURS_EXCEEDED" ? "CRITICAL" : type === "NO_BREAK" ? "WARNING" : "INFO",
      timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      duration: Math.floor(Math.random() * 120) + 15,
      description: `Driver exceeded ${type.replace(/_/g, " ").toLowerCase()} limits`,
      suggestedAction:
        type === "HOURS_EXCEEDED"
          ? "Immediate stop required. Driver must rest."
          : "Schedule 30-minute break before next driving",
    });
  }

  return violations;
};

const generateMockDvirDefects = (count: number): DvirDefect[] => {
  const components = ["tire", "brake", "light", "coupling", "engine", "body", "other"];
  const defects: DvirDefect[] = [];

  for (let i = 0; i < count; i++) {
    defects.push({
      id: `def-${i + 1}`,
      vehicleId: `veh-${Math.floor(Math.random() * 20) + 1}`,
      component: components[Math.floor(Math.random() * components.length)],
      description: `Component defect requiring attention`,
      severity: ["CRITICAL", "MAJOR", "MINOR"][Math.floor(Math.random() * 3)] as DefectSeverity,
      status: ["REPORTED", "ACKNOWLEDGED", "REPAIRED", "CERTIFIED"][
        Math.floor(Math.random() * 4)
      ] as DefectStatus,
      reportedAt: new Date(Date.now() - Math.random() * 604800000).toISOString(),
      driverId: `drv-${Math.floor(Math.random() * 8) + 1}`,
      driverName: ["Carlos Martinez", "Sofia Lindberg", "Ahmed Khalil"][
        Math.floor(Math.random() * 3)
      ],
    });
  }

  return defects;
};

const generateMockEldEvents = (count: number): EldEvent[] => {
  const eventTypes: Array<EldEvent["type"]> = [
    "STATUS_CHANGE",
    "VIOLATION",
    "EDIT_REQUEST",
    "DVIR_COMPLETION",
  ];
  const events: EldEvent[] = [];

  for (let i = 0; i < count; i++) {
    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    events.push({
      id: `evt-${i + 1}`,
      driverId: `drv-${Math.floor(Math.random() * 8) + 1}`,
      driverName: ["Carlos Martinez", "Sofia Lindberg", "Ahmed Khalil", "Lisa Thompson"][
        Math.floor(Math.random() * 4)
      ],
      type,
      timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      description:
        type === "STATUS_CHANGE"
          ? "Changed duty status from DRIVING to ON_DUTY"
          : type === "VIOLATION"
            ? "Exceeded maximum driving hours"
            : type === "EDIT_REQUEST"
              ? "Requested log edit for 2 hours"
              : "Completed pre-trip inspection",
    });
  }

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};

// Hooks
export const useDriverHOS = (driverId?: string) => {
  const [hos, setHos] = useState<DriverHOS | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      if (driverId) {
        setHos(generateMockHOS(driverId, "Selected Driver"));
      } else {
        setHos(generateMockHOS("drv-1", "Carlos Martinez"));
      }
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [driverId]);

  const updateHOS = useCallback((updatedHos: DriverHOS) => {
    setHos(updatedHos);
  }, []);

  return { hos, isLoading, updateHOS };
};

export const useViolations = (driverId?: string, limit = 10) => {
  const [violations, setViolations] = useState<HosViolation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      let allViolations = generateMockViolations(15);
      if (driverId) {
        allViolations = allViolations.filter((v) => v.driverId === driverId);
      }
      setViolations(allViolations.slice(0, limit));
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [driverId, limit]);

  return { violations, isLoading };
};

export const useDVIR = () => {
  const [defects, setDefects] = useState<DvirDefect[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setDefects(generateMockDvirDefects(8));
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const addDefect = useCallback((defect: DvirDefect) => {
    setDefects((prev) => [defect, ...prev]);
  }, []);

  const updateDefectStatus = useCallback((defectId: string, status: DefectStatus) => {
    setDefects((prev) =>
      prev.map((d) => (d.id === defectId ? { ...d, status } : d))
    );
  }, []);

  return { defects, isLoading, addDefect, updateDefectStatus };
};

export const useELDEvents = (limit = 20) => {
  const [events, setEvents] = useState<EldEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setEvents(generateMockEldEvents(limit));
      setIsLoading(false);
    }, 300);

    const pollInterval = setInterval(() => {
      setEvents((prev) => {
        const newEvents = generateMockEldEvents(1);
        return [...newEvents, ...prev].slice(0, limit);
      });
    }, 30000); // Poll every 30s

    return () => {
      clearTimeout(timer);
      clearInterval(pollInterval);
    };
  }, [limit]);

  return { events, isLoading };
};

export const useFleetCompliance = () => {
  const [compliance, setCompliance] = useState<FleetCompliance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      const totalDrivers = 8;
      const compliantDrivers = Math.floor(totalDrivers * 0.875); // 87.5%
      setCompliance({
        totalDrivers,
        compliantDrivers,
        compliancePercentage: 87.5,
        activeViolations: 5,
        dvirCompletionRate: 92.3,
        openDefects: 3,
        criticalDefects: 1,
      });
      setIsLoading(false);
    }, 300);

    const pollInterval = setInterval(() => {
      setCompliance((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          compliancePercentage: Math.max(
            70,
            prev.compliancePercentage + (Math.random() - 0.5) * 2
          ),
          activeViolations: Math.max(0, prev.activeViolations + Math.floor(Math.random() * 3) - 1),
        };
      });
    }, 10000); // Poll every 10s

    return () => {
      clearTimeout(timer);
      clearInterval(pollInterval);
    };
  }, []);

  return { compliance, isLoading };
};
