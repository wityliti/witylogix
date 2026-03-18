"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={cn("min-h-screen flex relative overflow-hidden")}>
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, #0a0a0c 0%, #1a1a2e 50%, #0a0a0c 100%)",
        }}
      />

      {/* Animated gradient elements */}
      <div
        className="absolute -top-1/2 -right-1/5 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(245, 166, 35, 0.08) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div
        className="absolute -bottom-2/5 -left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Left Panel - Illustration */}
      <div
        className={cn(
          "hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-8 relative z-10"
        )}
      >
        <div className="w-full max-w-md flex flex-col items-center gap-8">
          {/* Witylogix Logo & Branding */}
          <div className="flex flex-col items-center gap-3 mb-8 animate-in fade-in"
            style={{
              animation: "wl-fade-in 600ms var(--wl-ease-default) both",
              animationDelay: "100ms",
            }}
          >
            <div
              className="flex items-center justify-center w-16 h-16 rounded-lg"
              style={{
                background:
                  "linear-gradient(135deg, var(--wl-primary-500) 0%, var(--wl-primary-600) 100%)",
                boxShadow: "0 8px 24px rgba(245, 166, 35, 0.2)",
              }}
            >
              <span className="text-3xl font-bold text-wl-text-inverse">W</span>
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-wl-text-primary m-0">
                Witylogix
              </h1>
              <p className="text-sm text-wl-text-secondary mt-1 m-0">
                Delivery logistics command center
              </p>
            </div>
          </div>

          {/* Animated Route Illustration */}
          <div
            className="relative w-full aspect-square rounded-lg overflow-hidden"
            style={{
              animation: "wl-fade-in 600ms var(--wl-ease-default) both",
              animationDelay: "200ms",
            }}
          >
            {/* SVG Map Illustration */}
            <svg
              viewBox="0 0 400 400"
              className="w-full h-full"
              style={{
                background:
                  "linear-gradient(135deg, rgba(17, 17, 20, 0.4) 0%, rgba(31, 31, 38, 0.6) 100%)",
              }}
            >
              {/* Grid background */}
              <defs>
                <pattern
                  id="grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="rgba(245, 166, 35, 0.08)"
                    strokeWidth="1"
                  />
                </pattern>
                <linearGradient
                  id="routeGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="rgba(245, 166, 35, 0.6)" />
                  <stop offset="100%" stopColor="rgba(59, 130, 246, 0.4)" />
                </linearGradient>
              </defs>

              {/* Grid */}
              <rect width="400" height="400" fill="url(#grid)" />

              {/* Route lines */}
              <path
                d="M 80 320 L 140 260 L 200 200 L 280 140 L 340 80"
                stroke="url(#routeGradient)"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: "dash 8s ease-in-out infinite",
                  strokeDasharray: "500",
                  strokeDashoffset: "0",
                }}
              />

              {/* Waypoint circles */}
              {[
                { x: 80, y: 320 },
                { x: 140, y: 260 },
                { x: 200, y: 200 },
                { x: 280, y: 140 },
                { x: 340, y: 80 },
              ].map((point, idx) => (
                <g key={idx}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="8"
                    fill="rgba(245, 166, 35, 0.3)"
                    style={{
                      animation: `pulse 2s ease-in-out ${idx * 0.3}s infinite`,
                    }}
                  />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill="var(--wl-primary-500)"
                  />
                </g>
              ))}

              {/* Truck icon */}
              <g transform="translate(200, 200)">
                <rect
                  x="-16"
                  y="-8"
                  width="32"
                  height="16"
                  rx="3"
                  fill="var(--wl-primary-500)"
                  style={{
                    animation: "moveRoute 8s ease-in-out infinite",
                  }}
                />
              </g>
            </svg>

            {/* Overlay gradient */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, transparent 0%, rgba(10, 10, 12, 0.4) 100%)",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Description */}
          <div className="text-center">
            <p className="text-sm text-wl-text-secondary leading-relaxed m-0">
              Set up your logistics command center in minutes. Manage routes,
              track fleet, and optimize deliveries.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form Content */}
      <div
        className={cn(
          "w-full lg:w-1/2 flex flex-col items-center justify-center p-6 lg:p-8 relative z-10"
        )}
      >
        <div className="w-full max-w-xl">{children}</div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes wl-fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes dash {
          0% {
            stroke-dashoffset: 500;
          }
          50% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -500;
          }
        }

        @keyframes pulse {
          0%, 100% {
            r: 8;
            opacity: 1;
          }
          50% {
            r: 14;
            opacity: 0.5;
          }
        }

        @keyframes moveRoute {
          0% {
            transform: translate(-150px, -100px);
          }
          25% {
            transform: translate(-50px, -50px);
          }
          50% {
            transform: translate(30px, 0px);
          }
          75% {
            transform: translate(100px, -50px);
          }
          100% {
            transform: translate(160px, -120px);
          }
        }

        .animate-in {
          animation: wl-fade-in 600ms var(--wl-ease-default) both;
        }

        .fade-in {
          animation: wl-fade-in 300ms var(--wl-ease-default);
        }
      `}</style>
    </div>
  );
}
