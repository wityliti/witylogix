"use client";

import { forwardRef, useState, useEffect, type HTMLAttributes } from "react";
import {
  MapPin,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TechnicianJob {
  id: string;
  type: string;
  customer: string;
  address: string;
  eta: string; // minutes
}

interface TechnicianMarkerProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
  name: string;
  avatar?: string;
  status: "available" | "busy" | "offline";
  latitude: number;
  longitude: number;
  currentJob?: TechnicianJob;
  nextJob?: TechnicianJob;
  skills?: string[];
  currentEta?: number; // minutes
  distanceTraveled?: number; // km
  onMarkerClick?: (technicianId: string) => void;
  useAnimation?: boolean;
}

const statusConfig = {
  available: {
    ring: "ring-wl-success-400",
    bg: "bg-wl-success-400",
    label: "Available",
    dot: true,
  },
  busy: {
    ring: "ring-wl-warning-400",
    bg: "bg-wl-warning-400",
    label: "Busy",
    dot: true,
  },
  offline: {
    ring: "ring-wl-text-secondary",
    bg: "bg-wl-text-secondary",
    label: "Offline",
    dot: false,
  },
};

const TechnicianMarker = forwardRef<HTMLDivElement, TechnicianMarkerProps>(
  (
    {
      id,
      name,
      avatar,
      status,
      latitude,
      longitude,
      currentJob,
      nextJob,
      skills = [],
      currentEta,
      distanceTraveled,
      onMarkerClick,
      useAnimation = true,
      className,
      ...props
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isPulsing, setIsPulsing] = useState(status === "busy");

    useEffect(() => {
      setIsPulsing(status === "busy" && useAnimation);
    }, [status, useAnimation]);

    const statusInfo = statusConfig[status];

    // Get initials for avatar
    const getInitials = (fullName: string): string => {
      return fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase();
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative group cursor-pointer transition-all",
          className
        )}
        onClick={() => onMarkerClick?.(id)}
        {...props}
      >
        {/* Map Marker */}
        <div
          className={cn(
            "relative w-12 h-12 rounded-full border-2 transition-all",
            statusInfo.ring,
            isHovered && "scale-110 shadow-lg"
          )}
        >
          {/* Pulsing animation for en-route */}
          {isPulsing && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-wl-warning-400 animate-pulse" />
              <div
                className="absolute inset-0 rounded-full border-2 border-wl-warning-400"
                style={{
                  animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
                }}
              />
            </>
          )}

          {/* Avatar */}
          <div
            className={cn(
              "w-full h-full rounded-full flex items-center justify-center font-semibold text-sm text-wl-text-secondary",
              status === "available"
                ? "bg-wl-success-500"
                : status === "busy"
                  ? "bg-wl-warning-500"
                  : "bg-wl-text-secondary"
            )}
          >
            {avatar ? (
              <img
                src={avatar}
                alt={name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              getInitials(name)
            )}
          </div>

          {/* Status dot */}
          <div
            className={cn(
              "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-wl-bg-elevated",
              statusInfo.bg,
              statusInfo.dot && "animate-pulse"
            )}
          />
        </div>

        {/* Hover Popup */}
        {isHovered && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 pointer-events-none">
            <Card className="shadow-2xl w-64 pointer-events-auto">
              <div className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-wl-text-primary">
                      {name}
                    </h4>
                    <Badge
                      variant={
                        status === "available"
                          ? "success"
                          : status === "busy"
                            ? "warning"
                            : "default"
                      }
                      className="text-xs mt-1"
                    >
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <div className="text-right text-xs text-wl-text-secondary">
                    <p>{latitude.toFixed(4)}°</p>
                    <p>{longitude.toFixed(4)}°</p>
                  </div>
                </div>

                {/* Current Job */}
                {currentJob && (
                  <div className="p-2 rounded-md bg-wl-bg-surface space-y-1">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3 h-3 text-wl-warning-400 flex-shrink-0" />
                      <p className="text-xs font-semibold text-wl-text-primary">
                        Current Job
                      </p>
                    </div>
                    <p className="text-xs text-wl-text-secondary">
                      {currentJob.type}
                    </p>
                    <p className="text-xs font-medium text-wl-text-primary">
                      {currentJob.customer}
                    </p>
                    <p className="text-xs text-wl-text-secondary truncate">
                      {currentJob.address}
                    </p>
                    {currentEta && (
                      <div className="flex items-center gap-1 pt-1 text-xs text-wl-warning-400">
                        <Clock className="w-3 h-3" />
                        ETA: {currentEta} min
                      </div>
                    )}
                  </div>
                )}

                {/* Next Assignment */}
                {nextJob && (
                  <div className="p-2 rounded-md bg-wl-bg-surface space-y-1">
                    <p className="text-xs font-semibold text-wl-text-secondary">
                      Next Assignment
                    </p>
                    <p className="text-xs text-wl-text-primary">
                      {nextJob.type}
                    </p>
                    <p className="text-xs text-wl-text-secondary truncate">
                      {nextJob.address}
                    </p>
                  </div>
                )}

                {/* Skills */}
                {skills.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-wl-text-secondary">
                      Skills
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {skills.slice(0, 4).map((skill) => (
                        <Badge
                          key={skill}
                          variant="info"
                          className="text-xs py-0.5"
                        >
                          {skill}
                        </Badge>
                      ))}
                      {skills.length > 4 && (
                        <Badge variant="default" className="text-xs py-0.5">
                          +{skills.length - 4}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Stats */}
                {distanceTraveled !== undefined && (
                  <div className="pt-2 border-t border-wl-border-subtle">
                    <p className="text-xs text-wl-text-secondary">
                      Distance traveled today: {distanceTraveled.toFixed(1)} km
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Trigger hover */}
        <div
          className="absolute inset-0 -m-4 rounded-full"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
      </div>
    );
  }
);

TechnicianMarker.displayName = "TechnicianMarker";

export { TechnicianMarker };
export type { TechnicianMarkerProps, TechnicianJob };
