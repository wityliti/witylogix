import { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  const navItems = [
    { href: "/design-system/tokens", label: "Design Tokens" },
    { href: "/design-system/components", label: "Components" },
  ];

  return (
    <div className="min-h-screen bg-wl-bg-root text-wl-text-primary">
      {/* Navigation */}
      <nav className="border-b border-wl-border-subtle bg-wl-bg-surface/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-8 h-14">
            <div className="flex items-center gap-1 font-semibold text-sm">
              Design System
            </div>
            <div className="flex items-center gap-1 ml-auto">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    "hover:bg-wl-bg-elevated",
                    "text-wl-text-secondary hover:text-wl-text-primary"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      {children}
    </div>
  );
}
