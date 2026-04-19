import type { Metadata } from "next";
import Link from "next/link";
import { Gauge, Boxes, Server, Plus, Scroll } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Witylogix Cloud — Bench",
  description:
    "Control plane for managed and dedicated Witylogix installations.",
};

const NAV = [
  { href: "/", label: "Overview", icon: Gauge },
  { href: "/tenants", label: "Tenants", icon: Boxes },
  { href: "/installations", label: "Installations", icon: Server },
  { href: "/provision", label: "Provision", icon: Plus },
  { href: "/audit", label: "Audit log", icon: Scroll },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex">
          <aside className="w-60 border-r border-gray-800 bg-[#0f0f17]">
            <div className="p-4 border-b border-gray-800">
              <div className="font-semibold tracking-tight">Witylogix Cloud</div>
              <div className="text-xs text-gray-500 font-mono">bench-web · 0.0.1</div>
            </div>
            <nav className="p-2 space-y-1">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="px-4 pt-6 text-xs text-gray-600">
              Phase 1: internal use only.<br />
              Phase 2: public sign-up.
            </div>
          </aside>
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
