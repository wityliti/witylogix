"use client";

import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbProps {
  children: ReactNode;
  className?: string;
}

interface BreadcrumbItemProps {
  children: ReactNode;
  isCurrentPage?: boolean;
  className?: string;
}

interface BreadcrumbLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

interface BreadcrumbSeparatorProps {
  className?: string;
}

const Breadcrumb = ({ children, className }: BreadcrumbProps) => {
  return (
    <nav
      className={cn(
        "flex items-center gap-2",
        "text-sm",
        className
      )}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center gap-2">
        {children}
      </ol>
    </nav>
  );
};

const BreadcrumbItem = ({
  children,
  isCurrentPage = false,
  className
}: BreadcrumbItemProps) => {
  return (
    <li
      className={cn(
        "flex items-center gap-2",
        isCurrentPage && "text-wl-text-primary font-medium",
        !isCurrentPage && "text-wl-text-secondary",
        className
      )}
      aria-current={isCurrentPage ? "page" : undefined}
    >
      {children}
    </li>
  );
};

const BreadcrumbLink = ({
  href,
  children,
  className
}: BreadcrumbLinkProps) => {
  return (
    <a
      href={href}
      className={cn(
        "text-wl-primary-400 hover:text-wl-primary-300",
        "transition-colors duration-fast ease-default",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wl-primary-500",
        className
      )}
    >
      {children}
    </a>
  );
};

const BreadcrumbSeparator = ({ className }: BreadcrumbSeparatorProps) => {
  return (
    <span className={cn("text-wl-border-default", className)}>
      <ChevronRight size={16} />
    </span>
  );
};

export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
};
