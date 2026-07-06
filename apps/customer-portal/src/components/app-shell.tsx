"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { SidebarNav } from "@/components/sidebar-nav";
import { Header } from "@/components/header";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleMenuClick = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="flex flex-col h-screen lg:flex-row">
      {/* Desktop: always visible sidebar */}
      <div className="hidden lg:block w-60 flex-shrink-0">
        <SidebarNav />
      </div>

      {/* Mobile: overlay sidebar controlled by state */}
      <div className="lg:hidden">
        <SidebarNav isOpen={sidebarOpen} onClose={handleSidebarClose} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={handleMenuClick} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
