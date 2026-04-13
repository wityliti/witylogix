"use client";

import { forwardRef, useState, type HTMLAttributes } from "react";
import {
  ChevronDown,
  Clock,
  MapPin,
  AlertCircle,
  Plus,
  Edit2,
  CheckCircle,
  Wrench as Tool,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PartItem {
  id: string;
  name: string;
  quantity: number;
  cost: number;
  used: boolean;
}

interface TimeLogEntry {
  id: string;
  description: string;
  duration: number; // minutes
  timestamp: string;
}

interface WorkOrderCardProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
  jobNumber: string;
  customer: string;
  address: string;
  type: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "created" | "scheduled" | "dispatched" | "in-progress" | "completed" | "cancelled";
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  scheduledDate: string;
  scheduledTime: string;
  parts?: PartItem[];
  timeLog?: TimeLogEntry[];
  photosCount?: number;
  notes?: string;
  onAssignTechnicianClick?: () => void;
  onRescheduleClick?: () => void;
  onAddNotesClick?: () => void;
  onCompleteClick?: () => void;
  onStatusChange?: (status: string) => void;
}

const priorityConfig = {
  low: { badge: "success", label: "Low" },
  medium: { badge: "info", label: "Medium" },
  high: { badge: "warning", label: "High" },
  urgent: { badge: "danger", label: "Urgent" },
};

const statusStages = [
  "created",
  "scheduled",
  "dispatched",
  "in-progress",
  "completed",
];

const statusLabels = {
  created: "Created",
  scheduled: "Scheduled",
  dispatched: "Dispatched",
  "in-progress": "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const WorkOrderCard = forwardRef<HTMLDivElement, WorkOrderCardProps>(
  (
    {
      id,
      jobNumber,
      customer,
      address,
      type,
      priority,
      status,
      assignedTechnicianId,
      assignedTechnicianName,
      scheduledDate,
      scheduledTime,
      parts = [],
      timeLog = [],
      photosCount = 0,
      notes,
      onAssignTechnicianClick,
      onRescheduleClick,
      onAddNotesClick,
      onCompleteClick,
      onStatusChange,
      className,
      ...props
    },
    ref
  ) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const priorityInfo = priorityConfig[priority];
    const statusIndex = statusStages.indexOf(status);
    const progress = statusIndex >= 0 ? ((statusIndex + 1) / statusStages.length) * 100 : 0;

    const totalPartsCost = parts.reduce((sum, p) => sum + p.cost * p.quantity, 0);
    const totalTimeMinutes = timeLog.reduce((sum, t) => sum + t.duration, 0);

    return (
      <Card
        ref={ref}
        className={cn(
          "space-y-4 transition-all",
          status === "completed" && "opacity-75",
          status === "cancelled" && "opacity-50 line-through",
          className
        )}
        {...props}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-wl-text-primary">
              #{jobNumber}
            </h3>
            <p className="text-xs text-wl-text-secondary font-medium mt-1">
              {customer}
            </p>
            <p className="text-xs text-wl-text-secondary">
              {type}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={priorityInfo.badge as any}>
              {priorityInfo.label}
            </Badge>
            <Badge variant="default" className="text-xs">
              {statusLabels[status as keyof typeof statusLabels]}
            </Badge>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-start gap-2 p-3 rounded-md bg-wl-bg-surface">
          <MapPin className="w-4 h-4 text-wl-primary-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-wl-text-primary truncate">{address}</p>
            <p className="text-xs text-wl-text-secondary">
              {scheduledDate} at {scheduledTime}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-wl-text-secondary">Progress</span>
            <span className="text-wl-text-primary font-medium">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-2 bg-wl-bg-surface rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                progress === 100
                  ? "bg-wl-success-400"
                  : progress >= 75
                    ? "bg-wl-warning-400"
                    : "bg-wl-primary-400"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Stage indicators */}
          <div className="flex justify-between text-xs text-wl-text-secondary pt-1">
            {statusStages.map((stage, idx) => (
              <div
                key={stage}
                className={cn(
                  "flex items-center gap-1",
                  idx <= statusIndex && "text-wl-primary-400 font-medium"
                )}
              >
                {idx <= statusIndex ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-wl-border-subtle" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Assigned technician */}
        <div className="flex items-center justify-between p-2 rounded-md bg-wl-bg-surface">
          <div className="text-xs">
            {assignedTechnicianName ? (
              <>
                <p className="text-wl-text-secondary">Assigned to</p>
                <p className="text-wl-text-primary font-medium">
                  {assignedTechnicianName}
                </p>
              </>
            ) : (
              <p className="text-wl-text-secondary">Unassigned</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAssignTechnicianClick}
            className="text-xs"
          >
            {assignedTechnicianName ? "Change" : "Assign"}
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRescheduleClick}
            className="text-xs flex-1"
          >
            <Clock className="w-3 h-3 mr-1" />
            Reschedule
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onAddNotesClick}
            className="text-xs flex-1"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Notes
          </Button>
          {status !== "completed" && status !== "cancelled" && (
            <Button
              variant="primary"
              size="sm"
              onClick={onCompleteClick}
              className="text-xs flex-1"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Complete
            </Button>
          )}
        </div>

        {/* Expandable section */}
        {(parts.length > 0 || timeLog.length > 0 || photosCount > 0 || notes) && (
          <>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center justify-between w-full text-sm text-wl-text-primary hover:text-wl-primary-400 transition-colors pt-2 border-t border-wl-border-subtle"
            >
              <span className="font-medium">Details</span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform",
                  isExpanded && "transform rotate-180"
                )}
              />
            </button>

            {isExpanded && (
              <div className="space-y-3 pt-3">
                {/* Parts List */}
                {parts.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Tool className="w-4 h-4 text-wl-primary-400" />
                      <h4 className="text-xs font-semibold text-wl-text-primary">
                        Parts ({parts.length})
                      </h4>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {parts.map((part) => (
                        <div
                          key={part.id}
                          className={cn(
                            "flex items-center justify-between text-xs p-2 rounded bg-wl-bg-surface",
                            part.used && "opacity-60 line-through"
                          )}
                        >
                          <div>
                            <p className="text-wl-text-primary">{part.name}</p>
                            <p className="text-wl-text-secondary">
                              Qty: {part.quantity}
                            </p>
                          </div>
                          <p className="text-wl-text-primary font-medium">
                            ${(part.cost * part.quantity).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-wl-text-secondary text-right">
                      Total: ${totalPartsCost.toFixed(2)}
                    </p>
                  </div>
                )}

                {/* Time Log */}
                {timeLog.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-wl-text-primary">
                      Time Log ({timeLog.length} entries)
                    </h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {timeLog.map((entry) => (
                        <div
                          key={entry.id}
                          className="text-xs p-2 rounded bg-wl-bg-surface"
                        >
                          <p className="text-wl-text-primary">
                            {entry.description}
                          </p>
                          <p className="text-wl-text-secondary">
                            {entry.duration} min •{" "}
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-wl-text-secondary text-right">
                      Total: {totalTimeMinutes} min ({(totalTimeMinutes / 60).toFixed(1)}h)
                    </p>
                  </div>
                )}

                {/* Photos */}
                {photosCount > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-wl-primary-400" />
                      <h4 className="text-xs font-semibold text-wl-text-primary">
                        Photos ({photosCount})
                      </h4>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: Math.min(photosCount, 4) }).map(
                        (_, idx) => (
                          <div
                            key={idx}
                            className="aspect-square rounded bg-wl-bg-surface flex items-center justify-center text-xs text-wl-text-secondary"
                          >
                            {idx + 1}
                          </div>
                        )
                      )}
                      {photosCount > 4 && (
                        <div className="aspect-square rounded bg-wl-bg-surface flex items-center justify-center text-xs font-medium text-wl-text-primary">
                          +{photosCount - 4}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {notes && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-wl-text-primary">
                      Notes
                    </h4>
                    <p className="text-xs text-wl-text-secondary p-2 rounded bg-wl-bg-surface">
                      {notes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Card>
    );
  }
);

WorkOrderCard.displayName = "WorkOrderCard";

export { WorkOrderCard };
export type { WorkOrderCardProps, PartItem, TimeLogEntry };
