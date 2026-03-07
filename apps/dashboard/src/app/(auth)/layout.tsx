import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Witylogix - Sign In",
  description: "Logistics command center authentication",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="wl-noise">
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--wl-space-4)",
            background: "linear-gradient(135deg, #0a0a0c 0%, #1a1a2e 50%, #0a0a0c 100%)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Animated gradient background elements */}
          <div
            style={{
              position: "absolute",
              top: "-50%",
              right: "-20%",
              width: "600px",
              height: "600px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(245, 166, 35, 0.08) 0%, transparent 70%)",
              filter: "blur(80px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-30%",
              left: "-15%",
              width: "500px",
              height: "500px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%)",
              filter: "blur(80px)",
              pointerEvents: "none",
            }}
          />

          {/* Main card container */}
          <div
            style={{
              position: "relative",
              zIndex: 10,
              width: "100%",
              maxWidth: "420px",
            }}
          >
            {/* Logo and branding */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginBottom: "var(--wl-space-8)",
                animation: "wl-fade-in 600ms var(--wl-ease-default) both",
                animationDelay: "100ms",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 56,
                  height: 56,
                  borderRadius: "var(--wl-radius-lg)",
                  background: "linear-gradient(135deg, var(--wl-primary-500) 0%, var(--wl-primary-600) 100%)",
                  marginBottom: "var(--wl-space-4)",
                  boxShadow: "0 8px 24px rgba(245, 166, 35, 0.2)",
                }}
              >
                <span
                  style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    color: "var(--wl-text-inverse)",
                    fontFamily: "var(--wl-font-sans)",
                  }}
                >
                  W
                </span>
              </div>
              <h1
                style={{
                  fontSize: "var(--wl-text-3xl)",
                  fontWeight: 700,
                  color: "var(--wl-text-primary)",
                  marginBottom: "var(--wl-space-1)",
                  fontFamily: "var(--wl-font-sans)",
                  letterSpacing: "-0.02em",
                }}
              >
                Witylogix
              </h1>
              <p
                style={{
                  fontSize: "var(--wl-text-sm)",
                  color: "var(--wl-text-tertiary)",
                  fontFamily: "var(--wl-font-sans)",
                }}
              >
                Delivery logistics command center
              </p>
            </div>

            {/* Auth form card */}
            <div
              style={{
                background: "rgba(17, 17, 20, 0.8)",
                backdropFilter: "blur(16px)",
                border: "1px solid var(--wl-border-subtle)",
                borderRadius: "var(--wl-radius-lg)",
                padding: "var(--wl-space-8)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                animation: "wl-fade-in 600ms var(--wl-ease-default) both",
                animationDelay: "200ms",
              }}
            >
              {children}
            </div>

            {/* Footer */}
            <div
              style={{
                marginTop: "var(--wl-space-8)",
                textAlign: "center",
                fontSize: "var(--wl-text-xs)",
                color: "var(--wl-text-tertiary)",
                fontFamily: "var(--wl-font-sans)",
                animation: "wl-fade-in 600ms var(--wl-ease-default) both",
                animationDelay: "300ms",
              }}
            >
              © 2026 Witylogix. All rights reserved.
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
