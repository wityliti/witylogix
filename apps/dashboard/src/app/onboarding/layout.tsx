"use client";

import type { ReactNode } from "react";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--wl-bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header with Logo */}
      <div
        style={{
          padding: "var(--wl-space-5) var(--wl-space-6)",
          borderBottom: "1px solid var(--wl-border)",
          background: "var(--wl-surface)",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: "var(--wl-space-3)",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              background: "linear-gradient(135deg, var(--wl-primary), #8b7dff)",
              borderRadius: "var(--wl-radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              color: "var(--wl-text-inverse)",
              fontSize: "var(--wl-text-base)",
            }}
          >
            W
          </div>
          <div>
            <h1
              style={{
                fontSize: "var(--wl-text-lg)",
                fontWeight: 700,
                color: "var(--wl-text)",
                margin: 0,
              }}
            >
              Witylogix
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--wl-space-6)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
