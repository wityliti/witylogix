import { ReactNode } from "react";
import DashboardLayoutClient from "./dashboard-layout-client";

// All dashboard pages require authentication — disable static prerendering
export const dynamic = "force-dynamic";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
