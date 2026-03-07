"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth, User } from "./auth-context";

/* ═══════════════════════════════════════════════════════════
   PROTECTED ROUTE GUARD
   ═══════════════════════════════════════════════════════════ */

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: Array<User["role"]>;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requiredRoles,
  fallback,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      fallback || (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: "var(--wl-bg)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--wl-space-4)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: "2px solid var(--wl-border)",
                borderTopColor: "var(--wl-primary)",
                animation: "spin 1s linear infinite",
              }}
            />
            <p style={{ color: "var(--wl-text)" }}>Loading...</p>
          </div>
        </div>
      )
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    router.push(redirectTo);
    return null;
  }

  // Check role if required
  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    router.push("/unauthorized");
    return null;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
