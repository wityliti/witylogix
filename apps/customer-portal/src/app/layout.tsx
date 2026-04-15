import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "@/styles/globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--wl-font-poppins",
  display: "swap",
});

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
    <html lang="en" className={poppins.variable}>
      <body className="bg-wl-bg-root text-wl-text-primary">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
