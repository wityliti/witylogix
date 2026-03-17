/**
 * Notification Center Layout
 * Provides shared layout for notification pages
 */

import { type ReactNode } from "react";

interface NotificationLayoutProps {
  children: ReactNode;
}

export default function NotificationLayout({
  children,
}: NotificationLayoutProps) {
  return <>{children}</>;
}
