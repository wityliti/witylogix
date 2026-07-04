"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
  GripVertical,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

type AvailabilityStatus = "available" | "partial" | "busy";
type JobType =
  | "maintenance"
  | "installation"
  | "repair"
  | "inspection"
  | "followup";

interface TimeSlot {
  id: string;
  technician: string;
  startTime: string;
  endTime: string;
  jobType: JobType;
  location: string;
  description: string;
  status: "scheduled" | "completed" | "cancelled";
}

interface TechnicianAvailability {
  technician: string;
  status: AvailabilityStatus;
  bookedSlots: number;
  availableSlots: number;
  totalCapacity: number;
}

interface FieldServiceSchedulerProps {
  week?: Date;
  appointments?: TimeSlot[];
  technicians?: TechnicianAvailability[];
  onQuickAssign?: (jobId: string, technician: string, time: string) => void;
  className?: string;
}

const jobTypeColors: Record<JobType, string> = {
  maintenance: "var(--wl-primary-500)",
  installation: "var(--wl-info-500)",
  repair: "var(--wl-danger-500)",
  inspection: "var(--wl-warning-500)",
  followup: "var(--wl-success-500)",
};

const defaultAppointments: TimeSlot[] = [
  {
    id: "apt-001",
    technician: "John Davis",
    startTime: "09:00",
    endTime: "10:30",
    jobType: "installation",
    location: "123 Main St",
    description: "HVAC System Installation",
    status: "scheduled",
  },
  {
    id: "apt-002",
    technician: "Sarah Wilson",
    startTime: "10:00",
    endTime: "11:00",
    jobType: "repair",
    location: "456 Oak Ave",
    description: "Plumbing Leak Repair",
    status: "scheduled",
  },
  {
    id: "apt-003",
    technician: "John Davis",
    startTime: "13:00",
    endTime: "14:00",
    jobType: "maintenance",
    location: "789 Pine Rd",
    description: "Regular Maintenance Check",
    status: "scheduled",
  },
  {
    id: "apt-004",
    technician: "Mike Chen",
    startTime: "14:00",
    endTime: "15:30",
    jobType: "inspection",
    location: "321 Elm St",
    description: "Safety Inspection",
    status: "scheduled",
  },
];

const defaultTechnicians: TechnicianAvailability[] = [
  {
    technician: "John Davis",
    status: "partial",
    bookedSlots: 2,
    availableSlots: 2,
    totalCapacity: 4,
  },
  {
    technician: "Sarah Wilson",
    status: "available",
    bookedSlots: 1,
    availableSlots: 3,
    totalCapacity: 4,
  },
  {
    technician: "Mike Chen",
    status: "partial",
    bookedSlots: 1,
    availableSlots: 2,
    totalCapacity: 3,
  },
  {
    technician: "Lisa Martinez",
    status: "available",
    bookedSlots: 0,
    availableSlots: 4,
    totalCapacity: 4,
  },
];

export function FieldServiceScheduler({
  week = new Date(),
  appointments = defaultAppointments,
  technicians = defaultTechnicians,
  onQuickAssign,
  className,
}: FieldServiceSchedulerProps) {
  const [hoveredAppointment, setHoveredAppointment] = useState<string | null>(
    null,
  );
  const [weekOffset, setWeekOffset] = useState(0);

  const currentWeekStart = useMemo(() => {
    const date = new Date(week);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setDate(date.getDate() + weekOffset * 7);
    return date;
  }, [week, weekOffset]);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  }, [currentWeekStart]);

  const timeSlots = [
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
  ];

  const getAppointmentsForTechAndDay = (tech: string, day: Date) => {
    return appointments.filter((apt) => {
      const aptDate = new Date();
      const [hours, minutes] = apt.startTime.split(":").map(Number);
      aptDate.setHours(hours, minutes, 0, 0);
      return (
        apt.technician === tech &&
        aptDate.getFullYear() === day.getFullYear() &&
        aptDate.getMonth() === day.getMonth() &&
        aptDate.getDate() === day.getDate()
      );
    });
  };

  const getConflicts = (): string[] => {
    const conflicts: string[] = [];
    for (let i = 0; i < appointments.length; i++) {
      for (let j = i + 1; j < appointments.length; j++) {
        const apt1 = appointments[i];
        const apt2 = appointments[j];
        if (apt1.technician === apt2.technician) {
          const t1Start = parseInt(apt1.startTime.split(":")[0]);
          const t1End = parseInt(apt1.endTime.split(":")[0]);
          const t2Start = parseInt(apt2.startTime.split(":")[0]);
          const t2End = parseInt(apt2.endTime.split(":")[0]);
          if (!(t1End <= t2Start || t2End <= t1Start)) {
            conflicts.push(apt1.id);
            conflicts.push(apt2.id);
          }
        }
      }
    }
    return conflicts;
  };

  const conflictIds = getConflicts();

  return (
    <div
      className={cn(
        "flex flex-col bg-wl-bg-surface border border-wl-border-subtle rounded-lg overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-wl-border-subtle bg-wl-bg-overlay">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-wl-text-primary">
              Weekly Schedule
            </h3>
            <p className="text-xs text-wl-text-secondary mt-1">
              Technician assignments and availability
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset(weekOffset - 1)}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </Button>

            <span className="text-sm font-medium text-wl-text-primary px-3">
              {currentWeekStart.toLocaleDateString()} -{" "}
              {new Date(
                currentWeekStart.getTime() + 4 * 24 * 60 * 60 * 1000,
              ).toLocaleDateString()}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset(weekOffset + 1)}
              className="flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Technician availability bar */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-wl-text-secondary uppercase">
            Technician Availability
          </p>
          <div className="grid grid-cols-4 gap-2">
            {technicians.map((tech) => (
              <div
                key={tech.technician}
                className={cn(
                  "p-2 rounded-lg border text-xs",
                  tech.status === "available"
                    ? "border-wl-success-400/20 bg-wl-success-bg/20"
                    : tech.status === "partial"
                      ? "border-wl-warning-400/20 bg-wl-warning-bg/20"
                      : "border-wl-danger-400/20 bg-wl-danger-bg/20",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-wl-text-primary">
                    {tech.technician}
                  </span>
                  {tech.status === "available" && (
                    <CheckCircle2 className="w-3 h-3 text-wl-success-400" />
                  )}
                  {tech.status === "partial" && (
                    <AlertCircle className="w-3 h-3 text-wl-warning-400" />
                  )}
                </div>
                <div className="text-wl-text-secondary">
                  {tech.bookedSlots}/{tech.totalCapacity} booked
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Time conflict warning */}
      {conflictIds.length > 0 && (
        <div className="px-4 py-3 bg-wl-warning-bg/30 border-b border-wl-warning-400/20 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-wl-warning-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-wl-warning-400">
              Time conflicts detected
            </p>
            <p className="text-xs text-wl-warning-300">
              {conflictIds.length} appointment(s) have overlapping times.
              Reschedule to resolve.
            </p>
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-wl-bg-overlay border-b border-wl-border-subtle">
              <th className="px-4 py-3 text-left text-xs font-semibold text-wl-text-secondary w-24">
                Time
              </th>
              {weekDays.map((day) => (
                <th
                  key={day.toISOString()}
                  className="px-4 py-3 text-center text-xs font-semibold text-wl-text-secondary border-l border-wl-border-subtle"
                >
                  <div>
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div className="text-wl-text-secondary mt-1">
                    {day.getDate()}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {timeSlots.map((slot) => (
              <tr key={slot} className="border-b border-wl-border-subtle">
                <td className="px-4 py-2 text-xs font-medium text-wl-text-secondary bg-wl-bg-overlay">
                  {slot}
                </td>

                {weekDays.map((day) => (
                  <td
                    key={`${day.toISOString()}-${slot}`}
                    className="px-2 py-2 border-l border-wl-border-subtle bg-wl-bg-surface hover:bg-wl-border-subtle/20 transition-colors"
                  >
                    <div className="min-h-12 space-y-1">
                      {technicians.map((tech) => {
                        const dayAppts = getAppointmentsForTechAndDay(
                          tech.technician,
                          day,
                        );
                        const techApts = dayAppts.filter((apt) => {
                          const [h] = apt.startTime.split(":").map(Number);
                          return h === parseInt(slot);
                        });

                        return techApts.length > 0
                          ? techApts.map((apt) => (
                              <div
                                key={apt.id}
                                onMouseEnter={() =>
                                  setHoveredAppointment(apt.id)
                                }
                                onMouseLeave={() => setHoveredAppointment(null)}
                                className={cn(
                                  "p-1.5 rounded text-xs cursor-move transition-all duration-200 group",
                                  "flex items-center gap-1",
                                  conflictIds.includes(apt.id)
                                    ? "bg-wl-danger-bg/50 border border-wl-danger-400/50 text-wl-danger-400"
                                    : "text-white border border-transparent hover:border-current/50",
                                  hoveredAppointment === apt.id &&
                                    "shadow-md ring-1 ring-wl-primary-400",
                                )}
                                style={{
                                  backgroundColor: conflictIds.includes(apt.id)
                                    ? undefined
                                    : jobTypeColors[apt.jobType],
                                }}
                              >
                                <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                                <span className="font-medium truncate flex-1">
                                  {apt.description}
                                </span>
                              </div>
                            ))
                          : null;
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend and quick actions */}
      <div className="p-4 border-t border-wl-border-subtle bg-wl-bg-overlay space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            {Object.entries(jobTypeColors).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-wl-text-secondary capitalize">
                  {type}
                </span>
              </div>
            ))}
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            Quick Assign
          </Button>
        </div>
      </div>
    </div>
  );
}
