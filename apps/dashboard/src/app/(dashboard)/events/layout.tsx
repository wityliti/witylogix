"use client";

import { ReactNode } from "react";
import { Header } from "@/components/layout/header";

interface EventsLayoutProps {
  children: ReactNode;
}

export default function EventsLayout({ children }: EventsLayoutProps) {
  return (
    <div className="w-full">
      <Header
        title="Event Log Viewer"
        subtitle="Monitor real-time events and activities across your system"
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
