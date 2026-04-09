import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
