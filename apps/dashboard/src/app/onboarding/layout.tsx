"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={cn("min-h-screen bg-wl-bg flex flex-col")}>
      {/* Header with Logo */}
      <div className={cn("p-5 p-6 border-b border-wl-border bg-wl-surface")}>
        <div
          className={cn("max-w-5xl mx-auto flex items-center gap-3")}
        >
          <div
            className={cn("w-10 h-10 rounded-md flex items-center justify-center font-bold text-wl-text-inverse text-base")}
            style={{
              background: "linear-gradient(135deg, var(--wl-primary), #8b7dff)",
            }}
          >
            W
          </div>
          <div>
            <h1
              className={cn("text-lg font-bold text-wl-text m-0")}
            >
              Witylogix
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        className={cn("flex-1 flex items-center justify-center p-6")}
      >
        {children}
      </div>
    </div>
  );
}
