import type { Metadata } from "next";
import { SidebarNav } from "@/components/sidebar-nav";
import { Header } from "@/components/header";
import { cn } from "@/lib/utils";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Customer Portal - Witylogix",
  description: "Track your deliveries and manage your preferences",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-wl-bg-root text-wl-text-primary">
        <div className={cn("flex flex-col h-screen lg:flex-row")}>
          {/* Sidebar - hidden on mobile, shown on desktop */}
          <div className="hidden lg:block w-64 bg-wl-bg-sidebar border-r border-wl-border-subtle">
            <SidebarNav />
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <Header />

            {/* Page Content */}
            <main className={cn(
              "flex-1 overflow-y-auto",
              "bg-wl-bg-root"
            )}>
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
