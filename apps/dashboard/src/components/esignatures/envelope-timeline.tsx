"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CheckCircle2Icon,
  SendIcon,
  EyeIcon,
  FileCheckIcon,
  PackageIcon,
  ChevronDownIcon,
  ClockIcon,
} from "lucide-react";

interface TimelineEvent {
  id: string;
  type: "created" | "sent" | "viewed" | "signed" | "completed";
  timestamp: Date;
  description: string;
  signer?: {
    name: string;
    email: string;
    initials: string;
  };
  ipAddress?: string;
  details?: string;
}

interface EnvelopeTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

const getIcon = (type: TimelineEvent["type"]) => {
  switch (type) {
    case "created":
      return PackageIcon;
    case "sent":
      return SendIcon;
    case "viewed":
      return EyeIcon;
    case "signed":
      return FileCheckIcon;
    case "completed":
      return CheckCircle2Icon;
  }
};

const getStatusColor = (
  type: TimelineEvent["type"],
): "success" | "info" | "warning" | "default" => {
  switch (type) {
    case "completed":
    case "signed":
      return "success";
    case "viewed":
    case "sent":
      return "info";
    case "created":
      return "default";
  }
};

const TimelineEventItem = ({
  event,
  isLast,
}: {
  event: TimelineEvent;
  isLast: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const Icon = getIcon(event.type);

  return (
    <div className="relative">
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-2">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              "border-2 bg-wl-bg-overlay",
              event.type === "completed" || event.type === "signed"
                ? "border-wl-success-400 text-wl-success-400"
                : "border-wl-primary-400 text-wl-primary-400",
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
          {!isLast && (
            <div className="w-0.5 h-12 bg-wl-border-default flex-1" />
          )}
        </div>

        <div className="flex-1 pb-6 pt-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-wl-text-primary">
                  {event.description}
                </h4>
                <Badge variant={getStatusColor(event.type)}>{event.type}</Badge>
              </div>
              <p className="text-xs text-wl-text-tertiary">
                {event.timestamp.toLocaleDateString()} at{" "}
                {event.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            {(event.details || event.ipAddress) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="gap-1"
              >
                <ChevronDownIcon
                  className={cn(
                    "w-4 h-4 transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </Button>
            )}
          </div>

          {event.signer && (
            <div className="mt-3 flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold",
                  "bg-wl-primary-500/20 text-wl-primary-400",
                )}
              >
                {event.signer.initials}
              </div>
              <div className="text-sm">
                <p className="font-medium text-wl-text-primary">
                  {event.signer.name}
                </p>
                <p className="text-xs text-wl-text-tertiary">
                  {event.signer.email}
                </p>
              </div>
            </div>
          )}

          {expanded && (event.details || event.ipAddress) && (
            <div className="mt-3 p-3 bg-wl-bg-overlay rounded-lg border border-wl-border-default text-sm">
              {event.details && (
                <p className="text-wl-text-secondary mb-2">{event.details}</p>
              )}
              {event.ipAddress && (
                <p className="text-xs text-wl-text-tertiary">
                  IP Address: {event.ipAddress}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EnvelopeTimeline = ({
  events = [],
  className,
}: EnvelopeTimelineProps) => {
  if (events.length === 0) {
    return (
      <Card className={cn("w-full p-6", className)}>
        <h3 className="text-lg font-semibold text-wl-text-primary mb-2">
          Envelope Status Timeline
        </h3>
        <div className="text-sm text-wl-text-secondary text-center py-8">
          No timeline events yet.
        </div>
      </Card>
    );
  }

  const sortedEvents = [...events].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  const completionPercentage =
    sortedEvents.length > 0
      ? Math.round(
          (sortedEvents.filter(
            (e) => e.type === "signed" || e.type === "completed",
          ).length /
            sortedEvents.length) *
            100,
        )
      : 0;

  if (sortedEvents.length === 0) {
    return (
      <Card className={cn("w-full p-6", className)}>
        <h3 className="text-lg font-semibold text-wl-text-primary mb-4">
          Envelope Status Timeline
        </h3>
        <div className="flex flex-col items-center py-8 text-wl-text-tertiary">
          <ClockIcon className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No timeline events yet</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full p-6", className)}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-wl-text-primary mb-2">
          Envelope Status Timeline
        </h3>
        <div className="w-full bg-wl-bg-overlay rounded-full h-2">
          <div
            className="bg-gradient-to-r from-wl-primary-500 to-wl-success-400 h-2 rounded-full transition-all"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        <p className="text-xs text-wl-text-tertiary mt-2">
          {completionPercentage}% complete
        </p>
      </div>

      <div className="space-y-0">
        {sortedEvents.map((event, index) => (
          <TimelineEventItem
            key={event.id}
            event={event}
            isLast={index === sortedEvents.length - 1}
          />
        ))}
      </div>
    </Card>
  );
};

export { EnvelopeTimeline };
export type { TimelineEvent, EnvelopeTimelineProps };
