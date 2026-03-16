import { type ReactNode } from "react";

interface TrackingLayoutProps {
  children: ReactNode;
}

/**
 * Tracking Layout
 *
 * Simple wrapper layout for the tracking page.
 * Provides context and structure for live delivery tracking.
 */
export default function TrackingLayout({ children }: TrackingLayoutProps) {
  return <>{children}</>;
}
