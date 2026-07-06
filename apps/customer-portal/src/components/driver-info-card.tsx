"use client";

import { Phone, Star, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Driver } from "@/types";

interface DriverInfoCardProps {
  driver: Driver | null;
  isConnected: boolean;
}

export function DriverInfoCard({ driver, isConnected }: DriverInfoCardProps) {
  if (!driver) {
    return (
      <div className="section-card">
        <p className="text-sm text-wl-text-secondary">
          Loading driver information...
        </p>
      </div>
    );
  }

  return (
    <div className="section-card space-y-4">
      {/* Driver identity */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center",
              "bg-wl-neutral-800 text-lg flex-shrink-0",
            )}
          >
            {driver.photo && !driver.photo.startsWith("http") ? (
              driver.photo
            ) : (
              <span className="text-sm font-semibold text-wl-text-primary">
                {driver.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
            )}
          </div>
          {/* Connection indicator */}
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-wl-bg-surface",
              isConnected ? "bg-wl-success-500" : "bg-wl-neutral-600",
            )}
          />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-wl-text-primary truncate">
            {driver.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={10}
                  className={cn(
                    i < Math.floor(driver.rating)
                      ? "fill-wl-warning-500 text-wl-warning-500"
                      : "text-wl-neutral-700",
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-wl-text-tertiary">
              {driver.rating.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Vehicle */}
      <div className="text-xs text-wl-text-tertiary">
        {driver.vehicle.color} {driver.vehicle.type} &middot;{" "}
        {driver.vehicle.plate}
      </div>

      {/* Contact buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            window.location.href = `tel:${driver.phone}`;
          }}
          disabled={!isConnected}
          className="btn btn-primary"
        >
          <Phone size={14} />
          Call
        </button>
        <button
          onClick={() => {
            window.location.href = `sms:${driver.phone}`;
          }}
          disabled={!isConnected}
          className="btn btn-secondary"
        >
          <MessageCircle size={14} />
          Text
        </button>
      </div>

      {!isConnected && (
        <p className="text-xs text-wl-warning-500">
          Driver temporarily unavailable
        </p>
      )}
    </div>
  );
}
