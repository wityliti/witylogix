import type { Metadata } from "next";
import { SidebarNav } from "@/components/sidebar-nav";
import { Header } from "@/components/header";
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
        <div className="flex flex-col h-screen lg:flex-row">
          <div className="hidden lg:block w-60 flex-shrink-0">
            <SidebarNav />
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
