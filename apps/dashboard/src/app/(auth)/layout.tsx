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
          className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0a0a0c 0%, #1a1a2e 50%, #0a0a0c 100%)",
          }}
        >
          {/* Animated gradient background elements */}
          <div
            className="absolute -top-1/2 -right-1/5 w-96 h-96 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(245, 166, 35, 0.08) 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
          <div
            className="absolute -bottom-2/5 -left-1/4 w-96 h-96 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />

          {/* Main card container */}
          <div className="relative z-10 w-full max-w-sm">
            {/* Logo and branding */}
            <div
              className="flex flex-col items-center mb-8 animate-in fade-in"
              style={{
                animation: "wl-fade-in 600ms var(--wl-ease-default) both",
                animationDelay: "100ms",
              }}
            >
              <div
                className="flex items-center justify-center w-14 h-14 rounded-lg mb-4"
                style={{
                  background: "linear-gradient(135deg, var(--wl-primary-500) 0%, var(--wl-primary-600) 100%)",
                  boxShadow: "0 8px 24px rgba(245, 166, 35, 0.2)",
                }}
              >
                <span className="text-2xl font-bold text-wl-text-inverse">
                  W
                </span>
              </div>
              <h1 className="text-3xl font-bold text-wl-text-primary mb-1" style={{ letterSpacing: "-0.02em" }}>
                Witylogix
              </h1>
              <p className="text-sm text-wl-text-tertiary">
                Delivery logistics command center
              </p>
            </div>

            {/* Auth form card */}
            <div
              className="rounded-lg border border-wl-border-subtle p-8 backdrop-blur-lg"
              style={{
                background: "rgba(17, 17, 20, 0.8)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                animation: "wl-fade-in 600ms var(--wl-ease-default) both",
                animationDelay: "200ms",
              }}
            >
              {children}
            </div>

            {/* Footer */}
            <div
              className="mt-8 text-center text-xs text-wl-text-tertiary animate-in fade-in"
              style={{
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
