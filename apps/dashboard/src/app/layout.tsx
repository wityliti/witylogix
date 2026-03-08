import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Witylogix Dashboard",
  description: "Delivery logistics command center",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="wl-noise">
        <div className={cn("flex min-h-screen")}>
          <Sidebar />
          <main
            className={cn("flex-1 min-h-screen bg-wl-bg-root")}
            style={{
              marginLeft: "var(--wl-sidebar-width)",
              transition: `margin-left var(--wl-duration-base) var(--wl-ease-default)`,
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
