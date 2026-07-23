"use client";

import { forwardRef, useState, type HTMLAttributes } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CalendarJob {
  id: string;
  technicianId: string;
  technicianName: string;
  customerId: string;
  customerName: string;
  address: string;
  type: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "scheduled" | "dispatched" | "in-progress" | "completed" | "cancelled";
  startTime: string; // ISO string
  endTime: string; // ISO string
  color?: string; // For custom technician colors
}

interface JobCalendarProps extends HTMLAttributes<HTMLDivElement> {
  jobs: CalendarJob[];
  startDate?: Date;
  onJobClick?: (job: CalendarJob) => void;
  onJobReschedule?: (jobId: string, newTime: { start: string; end: string }) => void;
  onTimeSlotClick?: (time: Date, technicianId?: string) => void;
  technicianColors?: Record<string, string>;
}

interface TooltipState {
  visible: boolean;
  job: CalendarJob | null;
  x: number;
  y: number;
}

const priorityConfig = {
  low: { color: "bg-wl-success-500/20 text-wl-success-400", label: "Low" },
  medium: { color: "bg-wl-info-500/20 text-wl-info-400", label: "Medium" },
  high: { color: "bg-wl-warning-500/20 text-wl-warning-400", label: "High" },
  urgent: { color: "bg-wl-danger-500/20 text-wl-danger-400", label: "Urgent" },
};

const statusConfig = {
  scheduled: "Scheduled",
  dispatched: "Dispatched",
  "in-progress": "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const JobCalendar = forwardRef<HTMLDivElement, JobCalendarProps>(
  (
    {
      jobs,
      startDate = new Date(),
      onJobClick,
      onJobReschedule,
      onTimeSlotClick,
      technicianColors = {},
      className,
      ...props
    },
    ref
  ) => {
    const [tooltip, setTooltip] = useState<TooltipState>({
      visible: false,
      job: null,
      x: 0,
      y: 0,
    });
    const [draggedJob, setDraggedJob] = useState<CalendarJob | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date(startDate));

    // Get week start (Sunday)
    const weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const days = Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      return date;
    });

    // Get unique technicians
    const technicians = Array.from(
      new Map(jobs.map((j) => [j.technicianId, j.technicianName])).entries()
    );

    // Get time slots (0-23 hours)
    const hours = Array.from({ length: 24 }, (_, i) => i);

    // Filter jobs for this week and sort by technician
    const weekJobs = jobs.filter((job) => {
      const jobDate = new Date(job.startTime);
      return jobDate >= weekStart && jobDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    });

    const getDefaultColor = (index: number): string => {
      const colors = [
        "var(--wl-info-500)",
        "var(--wl-success-500)",
        "var(--wl-warning-500)",
        "var(--wl-danger-500)",
        "var(--wl-chart-purple)",
        "var(--wl-chart-teal)",
      ];
      return colors[index % colors.length];
    };

    const getTechnicianColor = (technicianId: string, name: string): string => {
      if (technicianColors[technicianId]) return technicianColors[technicianId];
      const index = technicians.findIndex((t) => t[0] === technicianId);
      return getDefaultColor(index);
    };

    const getJobPosition = (job: CalendarJob) => {
      const jobDate = new Date(job.startTime);
      const dayIndex = days.findIndex(
        (d) =>
          d.getFullYear() === jobDate.getFullYear() &&
          d.getMonth() === jobDate.getMonth() &&
          d.getDate() === jobDate.getDate()
      );

      const startHour = jobDate.getHours() + jobDate.getMinutes() / 60;
      const endHour = new Date(job.endTime).getHours() + new Date(job.endTime).getMinutes() / 60;
      const duration = endHour - startHour;

      return { dayIndex, startHour, duration };
    };

    const handlePrevWeek = () => {
      setCurrentDate((prev) => {
        const newDate = new Date(prev);
        newDate.setDate(newDate.getDate() - 7);
        return newDate;
      });
    };

    const handleNextWeek = () => {
      setCurrentDate((prev) => {
        const newDate = new Date(prev);
        newDate.setDate(newDate.getDate() + 7);
        return newDate;
      });
    };

    return (
      <Card ref={ref} className={cn("p-6 space-y-4", className)} {...props}>
        {/* Header with navigation */}
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-wl-text-primary">
            Week of {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevWeek}
              className="p-1.5 rounded hover:bg-wl-bg-surface transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-2 py-1 text-xs font-medium rounded bg-wl-primary-500/20 text-wl-primary-400 hover:bg-wl-primary-500/30 transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNextWeek}
              className="p-1.5 rounded hover:bg-wl-bg-surface transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Day headers */}
            <div className="grid" style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }}>
              <div className="py-2 px-2 font-semibold text-xs text-wl-text-secondary border-b border-wl-border-subtle" />
              {days.map((day, i) => (
                <div
                  key={i}
                  className={cn(
                    "py-2 px-1 font-semibold text-xs text-center border-b border-wl-border-subtle",
                    day.toDateString() === new Date().toDateString()
                      ? "bg-wl-primary-500/10 text-wl-primary-400"
                      : "text-wl-text-secondary"
                  )}
                >
                  <div>{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
                  <div className="text-sm font-semibold">{day.getDate()}</div>
                </div>
              ))}

              {/* Time slots and jobs */}
              {hours.map((hour) => (
                <div key={`row-${hour}`} className="contents">
                  {/* Hour label */}
                  <div className="py-1 px-2 text-xs text-wl-text-secondary border-b border-wl-border-subtle border-r border-r-wl-border-subtle sticky left-0 bg-wl-bg-elevated">
                    {hour.toString().padStart(2, "0")}:00
                  </div>

                  {/* Day cells */}
                  {days.map((day, dayIdx) => (
                    <div
                      key={`cell-${hour}-${dayIdx}`}
                      className={cn(
                        "relative min-h-16 border-b border-wl-border-subtle border-r border-r-wl-border-subtle p-1",
                        hour === 0 && "border-t border-t-wl-border-subtle"
                      )}
                      style={{
                        backgroundColor:
                          hour % 2 === 0 ? "transparent" : "var(--wl-bg-surface)",
                      }}
                      onClick={() => onTimeSlotClick?.(new Date(day.getTime() + hour * 60 * 60 * 1000))}
                    >
                      {/* Jobs in this hour */}
                      {weekJobs
                        .filter((job) => {
                          const jobDate = new Date(job.startTime);
                          const jobHour = jobDate.getHours();
                          const jobDayIdx = days.findIndex(
                            (d) =>
                              d.getFullYear() === jobDate.getFullYear() &&
                              d.getMonth() === jobDate.getMonth() &&
                              d.getDate() === jobDate.getDate()
                          );
                          return jobDayIdx === dayIdx && jobHour === hour;
                        })
                        .map((job) => {
                          const jobStartTime = new Date(job.startTime);
                          const jobEndTime = new Date(job.endTime);
                          const minutes = Math.ceil(
                            (jobEndTime.getTime() - jobStartTime.getTime()) / (1000 * 60)
                          );
                          const height = Math.max(16, (minutes / 60) * 64);

                          return (
                            <div
                              key={job.id}
                              className={cn(
                                "absolute inset-x-0.5 rounded p-0.5 text-xs font-medium text-wl-text-primary cursor-move hover:shadow-md transition-shadow",
                                job.status === "completed"
                                  ? "opacity-50"
                                  : job.status === "cancelled"
                                    ? "opacity-40 line-through"
                                    : ""
                              )}
                              style={{
                                backgroundColor: getTechnicianColor(
                                  job.technicianId,
                                  job.technicianName
                                ),
                                top: `${((jobStartTime.getMinutes() / 60) * 64)}px`,
                                height: `${height}px`,
                              }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTooltip({
                                  visible: true,
                                  job,
                                  x: rect.left,
                                  y: rect.top,
                                });
                              }}
                              onMouseLeave={() =>
                                setTooltip({ ...tooltip, visible: false })
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                onJobClick?.(job);
                              }}
                              draggable
                              onDragStart={() => setDraggedJob(job)}
                              onDragEnd={() => setDraggedJob(null)}
                            >
                              <div className="truncate font-semibold">
                                {job.type}
                              </div>
                              <div className="truncate text-xs opacity-90">
                                {job.customerName}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {tooltip.visible && tooltip.job && (
          <div
            className="fixed bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-3 shadow-lg text-sm z-50 max-w-xs pointer-events-none"
            style={{
              left: Math.min(tooltip.x + 10, window.innerWidth - 300),
              top: tooltip.y - 120,
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-semibold text-wl-text-primary">
                  {tooltip.job.type}
                </p>
                <p className="text-xs text-wl-text-secondary">
                  {tooltip.job.customerName}
                </p>
              </div>
              <Badge variant={priorityConfig[tooltip.job.priority].label as any} className="text-xs">
                {priorityConfig[tooltip.job.priority].label}
              </Badge>
            </div>

            <div className="space-y-1 text-xs text-wl-text-secondary">
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3" />
                {new Date(tooltip.job.startTime).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                -{" "}
                {new Date(tooltip.job.endTime).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3" />
                {tooltip.job.address}
              </div>
              <p>
                Technician: {tooltip.job.technicianName}
              </p>
              <p>
                Status: {statusConfig[tooltip.job.status]}
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="pt-2 border-t border-wl-border-subtle">
          <p className="text-xs font-semibold text-wl-text-secondary mb-2">
            Technicians
          </p>
          <div className="flex flex-wrap gap-3">
            {technicians.map(([id, name]) => (
              <div key={id} className="flex items-center gap-2 text-xs">
                <div
                  className="w-3 h-3 rounded"
                  style={{
                    backgroundColor: getTechnicianColor(id, name),
                  }}
                />
                <span className="text-wl-text-secondary">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }
);

JobCalendar.displayName = "JobCalendar";

export { JobCalendar };
export type { JobCalendarProps, CalendarJob };
