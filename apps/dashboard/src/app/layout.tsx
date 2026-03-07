import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/sidebar";
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
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
          }}
        >
          <Sidebar />
          <main
            style={{
              flex: 1,
              marginLeft: "var(--wl-sidebar-width)",
              minHeight: "100vh",
              background: "var(--wl-bg-root)",
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
