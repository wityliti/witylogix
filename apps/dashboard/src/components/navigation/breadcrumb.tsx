"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface BreadcrumbProps {
  className?: string;
}

export function Breadcrumb({ className }: BreadcrumbProps) {
  const pathname = usePathname();

  // Generate breadcrumb segments from route
  const segments = pathname.split("/").filter(Boolean).slice(0, 3); // Limit to 3 levels

  // Convert segments to readable labels
  const breadcrumbs = segments.map((segment, index) => ({
    label: segment
      .replace(/^\(.*\)/, "") // Remove route groups
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase()),
    href: "/" + segments.slice(0, index + 1).join("/"),
  }));

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav
      className={cn(
        "flex items-center gap-2 text-sm text-wl-text-secondary",
        className,
      )}
      aria-label="Breadcrumb"
    >
      <Link
        href="/"
        className={cn(
          "flex items-center gap-2 hover:text-wl-text-primary transition-colors",
          pathname === "/" && "text-wl-text-primary",
        )}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <path d="M9 22v-10h6v10" />
        </svg>
      </Link>

      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.href} className="flex items-center gap-2">
          <span className="text-wl-text-tertiary">/</span>
          <Link
            href={crumb.href}
            className={cn(
              "hover:text-wl-text-primary transition-colors truncate max-w-[200px]",
              index === breadcrumbs.length - 1 &&
                "text-wl-text-primary pointer-events-none",
            )}
          >
            {crumb.label}
          </Link>
        </div>
      ))}
    </nav>
  );
}
