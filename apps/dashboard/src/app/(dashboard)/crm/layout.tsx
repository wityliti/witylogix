"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CrmLayoutProps {
  children: ReactNode;
}

export default function CrmLayout({ children }: CrmLayoutProps) {
  return (
    <div className={cn("flex flex-col min-h-screen", "bg-wl-bg-root")}>
      {children}
    </div>
  );
}
