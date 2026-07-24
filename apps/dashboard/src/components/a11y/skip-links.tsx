/**
 * Skip Links Component
 * Navigation shortcuts for keyboard users to jump to main content
 */

import React from "react";
import { cn } from "@/lib/utils";

interface SkipLinksProps {
  mainId?: string;
  navId?: string;
  searchId?: string;
  className?: string;
}

/**
 * Skip Links component - appears only when focused
 * Provides keyboard shortcuts to jump to key page sections
 */
export function SkipLinks({
  mainId = "main-content",
  navId = "main-nav",
  searchId = "search",
  className,
}: SkipLinksProps): React.ReactElement {
  const handleSkipClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetId: string,
  ) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav
      className={cn(
        "absolute top-0 left-0 z-50 pointer-events-none",
        className,
      )}
      aria-label="Skip links"
    >
      <ul className="flex flex-col gap-0 list-none p-0 m-0 pointer-events-auto">
        <li>
          <a
            href={`#${mainId}`}
            onClick={(e) => handleSkipClick(e, mainId)}
            className={cn(
              "inline-block px-3 py-2 bg-wl-primary-600 text-white font-medium " +
                "rounded-0 absolute -top-10 left-0 focus:top-0 " +
                "hover:bg-wl-primary-700 transition-all duration-200 " +
                "focus:outline-none focus:ring-2 focus:ring-wl-primary-700 focus:ring-offset-2",
            )}
          >
            Skip to main content
          </a>
        </li>
        <li>
          <a
            href={`#${navId}`}
            onClick={(e) => handleSkipClick(e, navId)}
            className={cn(
              "inline-block px-3 py-2 bg-wl-primary-600 text-white font-medium " +
                "rounded-0 absolute -top-10 left-40 focus:top-0 " +
                "hover:bg-wl-primary-700 transition-all duration-200 " +
                "focus:outline-none focus:ring-2 focus:ring-wl-primary-700 focus:ring-offset-2",
            )}
          >
            Skip to navigation
          </a>
        </li>
        <li>
          <a
            href={`#${searchId}`}
            onClick={(e) => handleSkipClick(e, searchId)}
            className={cn(
              "inline-block px-3 py-2 bg-wl-primary-600 text-white font-medium " +
                "rounded-0 absolute -top-10 left-80 focus:top-0 " +
                "hover:bg-wl-primary-700 transition-all duration-200 " +
                "focus:outline-none focus:ring-2 focus:ring-wl-primary-700 focus:ring-offset-2",
            )}
          >
            Skip to search
          </a>
        </li>
      </ul>
    </nav>
  );
}

export default SkipLinks;
