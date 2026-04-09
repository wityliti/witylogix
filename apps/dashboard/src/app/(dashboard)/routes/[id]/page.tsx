"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";

interface Stop {
  id: string;
  orderId: string;
  address: string;
  timeWindow: { start: string; end: string };
  priority: "low" | "medium" | "high";
  status: "PENDING" | "ARRIVED" | "COMPLETED" | "FAILED";
  eta: string;
  actualTime?: string;
  completedAt?: string;
}

interface Route {
  id: string;
  name: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  driver: { id: string; name: string; phone: string };
  vehicle: { id: string; name: string; capacity: string };
  date: string;
  stops: Stop[];
  startTime?: string;
  endTime?: string;
  currentLocation: { lat: number; lng: number };
}

export default function RouteDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: route, loading, error, refetch } = useApiQuery<Route>(
    id ? `/api/v4/routes/${id}` : null
  );
  const { execute: updateStatus } = useApiMutation<Route>("PATCH", `/api/v4/routes/${id}`);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-6">
        <ErrorState message={error.message} onRetry={refetch} />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-6">
        <div className="text-center text-gray-400">Route not found</div>
      </div>
    );
  }

  const completedStops = route.stops.filter((s) => s.status === "COMPLETED").length;
  const totalStops = route.stops.length;
  const onTimeCount = route.stops
    .filter((s) => s.status === "COMPLETED" && s.completedAt && s.actualTime)
    .filter((s) => {
      if (!s.completedAt || !s.timeWindow) return false;
      const completedTime = new Date(`${route.date}T${s.completedAt}`);
      const windowEnd = new Date(`${route.date}T${s.timeWindow.end}`);
      return completedTime <= windowEnd;
    }).length;
  const onTimePercent = totalStops > 0 ? Math.round((onTimeCount / completedStops) * 100) : 0;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "#ff6b6b";
      case "medium":
        return "#ffd93d";
      case "low":
        return "#6bcf7f";
      default:
        return "#8888a0";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "#6bcf7f";
      case "ARRIVED":
        return "#4ecdc4";
      case "PENDING":
        return "#8888a0";
      case "FAILED":
        return "#ff6b6b";
      default:
        return "#8888a0";
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6 text-white">
      <div className="mb-8 flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-white mb-2">{route.name}</h1>
          <div className="flex gap-4 mt-2 text-sm text-gray-400">
            <div className="flex items-center gap-1.5">
              <Badge variant="default">{route.status}</Badge>
              {route.date}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary">Edit Route</Button>
          <Button variant="primary">Start Route</Button>
        </div>
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-6 mb-6">
        <div>
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-white">Route Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-96 bg-[#12121a] border border-[#1e1e2e] rounded-lg flex items-center justify-center relative overflow-hidden">
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 800 400"
                  className="absolute top-0 left-0"
                >
                  <defs>
                    <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6C63FF" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#6C63FF" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>

                  {route.stops.length > 1 && (
                    <polyline
                      points={route.stops
                        .map((_, idx) => {
                          const x = 50 + (idx / (route.stops.length - 1)) * 700;
                          const y = 150 + Math.sin(idx * 0.5) * 50;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                      fill="none"
                      stroke="#6C63FF"
                      strokeWidth="2"
                      opacity="0.5"
                    />
                  )}

                  {route.stops.map((stop, idx) => {
                    const x = 50 + (idx / Math.max(route.stops.length - 1, 1)) * 700;
                    const y = 150 + Math.sin(idx * 0.5) * 50;
                    const statusColor = getStatusColor(stop.status);
                    return (
                      <g key={stop.id}>
                        <circle cx={x} cy={y} r="14" fill={statusColor} opacity="0.9" />
                        <text
                          x={x}
                          y={y}
                          textAnchor="middle"
                          dy="0.3em"
                          fontSize="11"
                          fontWeight="bold"
                          fill="white"
                        >
                          {idx + 1}
                        </text>
                      </g>
                    );
                  })}

                  <circle
                    cx="200"
                    cy="180"
                    r="8"
                    fill="#00d4ff"
                    opacity="0.8"
                    stroke="white"
                    strokeWidth="2"
                  />
                  <text
                    x="200"
                    y="210"
                    textAnchor="middle"
                    fontSize="12"
                    fill="#00d4ff"
                    fontWeight="bold"
                  >
                    Driver
                  </text>
                </svg>
                <div className="absolute bottom-4 right-4 text-xs text-gray-400">
                  Lat: {route.currentLocation.lat}, Lng: {route.currentLocation.lng}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6 bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-white">Route Progress Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative pl-8">
                {route.stops.map((stop, idx) => (
                  <div key={stop.id} className={cn("mb-5 pb-5", idx < route.stops.length - 1 && "border-b border-[#1e1e2e]")}>
                    {idx < route.stops.length - 1 && (
                      <div className="absolute left-2 top-5 w-1 bg-[#1e1e2e]" style={{ height: "calc(100% + 20px)" }} />
                    )}
                    <div
                      className="absolute left-0 top-0 w-5 h-5 rounded-full bg-blue-500 border-4 border-[#0a0a0f] flex items-center justify-center"
                      style={{ backgroundColor: getStatusColor(stop.status) }}
                    />
                    <div className="pt-1">
                      <div className="text-xs text-gray-400">{stop.eta}</div>
                      <div className="text-sm font-semibold text-white mt-1">{stop.orderId}</div>
                      <div className="text-xs text-gray-400 mt-1">{stop.address}</div>
                      <div className="flex gap-3 mt-1 text-xs text-gray-400">
                        <span>ETA: {stop.eta}</span>
                        {stop.actualTime && <span>Arrived: {stop.actualTime}</span>}
                        {stop.completedAt && <span>Completed: {stop.completedAt}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-white">Route Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-md bg-[#0a0a0f] border border-[#1e1e2e] text-center">
                  <div className="text-xl font-bold text-blue-500 mb-1">
                    {completedStops}/{totalStops}
                  </div>
                  <div className="text-xs text-gray-400">Stops Completed</div>
                </div>
                <div className="p-3 rounded-md bg-[#0a0a0f] border border-[#1e1e2e] text-center">
                  <div className="text-xl font-bold text-blue-500 mb-1">{onTimePercent}%</div>
                  <div className="text-xs text-gray-400">On-Time Deliveries</div>
                </div>
                <div className="p-3 rounded-md bg-[#0a0a0f] border border-[#1e1e2e] text-center">
                  <div className="text-xl font-bold text-blue-500 mb-1">12min</div>
                  <div className="text-xs text-gray-400">Avg Stop Time</div>
                </div>
                <div className="p-3 rounded-md bg-[#0a0a0f] border border-[#1e1e2e] text-center">
                  <div className="text-xl font-bold text-blue-500 mb-1">18.5km</div>
                  <div className="text-xs text-gray-400">Total Distance</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-white">Driver Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-3 rounded-md bg-[#12121a] border border-[#1e1e2e]">
                <div className="text-sm font-semibold text-white mb-2">{route.driver.name}</div>
                <div className="flex flex-col gap-1.5 text-xs text-gray-400">
                  <div>
                    <strong>Phone:</strong> {route.driver.phone}
                  </div>
                  <div>
                    <strong>Vehicle:</strong> {route.vehicle.name}
                  </div>
                  <div>
                    <strong>Capacity:</strong> {route.vehicle.capacity}
                  </div>
                  {route.startTime && (
                    <div>
                      <strong>Start Time:</strong> {route.startTime}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <Button variant="primary" className="w-full">
                  Resume Route
                </Button>
                <Button variant="secondary" className="w-full">
                  Pause
                </Button>
                <Button variant="secondary" className="w-full">
                  Reassign Driver
                </Button>
                <Button variant="secondary" className="w-full">
                  Complete Route
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6 bg-[#12121a] border border-[#1e1e2e]">
        <CardHeader>
          <CardTitle className="text-white">Stop Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {route.stops.map((stop, idx) => (
              <div
                key={stop.id}
                className={cn(
                  "p-4 rounded-md bg-[#12121a] border flex items-center gap-3 transition-all",
                  stop.status === "ARRIVED" ? "border-blue-500" : "border-[#1e1e2e]"
                )}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getStatusColor(stop.status) }}
                />
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="text-white font-semibold text-sm">
                        {idx + 1}. {stop.orderId}
                      </span>
                      <Badge className="ml-2">{stop.status}</Badge>
                    </div>
                    <Badge>{stop.priority.toUpperCase()}</Badge>
                  </div>
                  <p className="text-gray-400 text-xs my-1">
                    {stop.address}
                  </p>
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>Window: {stop.timeWindow.start} - {stop.timeWindow.end}</span>
                    <span>ETA: {stop.eta}</span>
                    {stop.actualTime && <span>Arrived: {stop.actualTime}</span>}
                    {stop.completedAt && <span>Completed: {stop.completedAt}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 mt-6">
        <Button variant="secondary">Back to Routes</Button>
        <div className="flex gap-3 ml-auto">
          <Button variant="secondary">Contact Driver</Button>
          <Button variant="primary">Update Status</Button>
        </div>
      </div>
    </div>
  );
}
