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
        <div className="flex items-center justify-center min-h-screen bg-wl-bg-root">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-wl-border-default animate-spin"
              style={{ borderTopColor: "var(--wl-primary-500)" }}
            />
            <p className="text-wl-text-secondary text-sm">Loading...</p>
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
