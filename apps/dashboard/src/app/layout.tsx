import type { Metadata } from "next";
import "@/styles/globals.css";
import { AuthProvider } from "@/lib/auth-context";

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
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
