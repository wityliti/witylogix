"use client";

import { forwardRef, type HTMLAttributes } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface PaginationProps extends HTMLAttributes<HTMLDivElement> {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  totalItems?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
}

const Pagination = forwardRef<HTMLDivElement, PaginationProps>(
  (
    {
      currentPage,
      totalPages,
      onPageChange,
      pageSize = 10,
      totalItems,
      onPageSizeChange,
      pageSizeOptions = [5, 10, 20, 50],
      showPageSizeSelector = true,
      className,
      ...props
    },
    ref
  ) => {
    // Calculate visible page numbers
    const getPageNumbers = (): (number | string)[] => {
      const delta = 2; // Number of pages to show around current page
      const range: (number | string)[] = [];

      // Always show first page
      range.push(1);

      // Add ellipsis and pages before current
      if (currentPage - delta > 2) {
        range.push("...");
      }

      for (
        let i = Math.max(2, currentPage - delta);
        i <= Math.min(totalPages - 1, currentPage + delta);
        i++
      ) {
        range.push(i);
      }

      // Add ellipsis and pages after current
      if (currentPage + delta < totalPages - 1) {
        range.push("...");
      }

      // Always show last page (if more than 1 page)
      if (totalPages > 1) {
        range.push(totalPages);
      }

      return range;
    };

    // Calculate item range
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems || currentPage * pageSize);

    const pageNumbers = getPageNumbers();

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-4 items-center justify-between",
          "py-4 px-4",
          className
        )}
        {...props}
      >
        {/* Top Section: Page Size Selector and Info */}
        <div className="flex items-center justify-between w-full gap-4">
          {showPageSizeSelector && (
            <div className="flex items-center gap-2">
              <label htmlFor="page-size" className="text-sm text-wl-text-secondary">
                Show
              </label>
              <select
                id="page-size"
                value={pageSize}
                onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
                className={cn(
                  "bg-wl-bg-surface text-wl-text-primary",
                  "border border-wl-border-default rounded-md",
                  "px-3 py-1.5 text-sm",
                  "transition-all duration-fast ease-default",
                  "focus:border-wl-primary-500 outline-none",
                  "cursor-pointer"
                )}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="text-sm text-wl-text-secondary">per page</span>
            </div>
          )}

          {totalItems && (
            <div className="text-sm text-wl-text-secondary">
              Showing {startItem} to {endItem} of {totalItems} items
            </div>
          )}
        </div>

        {/* Bottom Section: Page Navigation */}
        <div className="flex items-center justify-center gap-1">
          {/* First Page Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            aria-label="First page"
            className="px-2"
          >
            <ChevronsLeft className="w-4 h-4" />
          </Button>

          {/* Previous Page Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            aria-label="Previous page"
            className="px-2"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          {/* Page Numbers */}
          <div className="flex items-center gap-1 mx-2">
            {pageNumbers.map((page, index) => {
              if (page === "...") {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="text-wl-text-secondary px-2 py-1"
                  >
                    ...
                  </span>
                );
              }

              const pageNum = page as number;
              const isActive = pageNum === currentPage;

              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={cn(
                    "min-w-10 h-10 rounded-md text-sm font-medium",
                    "transition-all duration-fast ease-default",
                    "flex items-center justify-center",
                    isActive
                      ? "bg-wl-primary-500 text-wl-text-inverse font-semibold"
                      : "text-wl-text-primary hover:bg-wl-bg-surface border border-transparent hover:border-wl-border-default",
                    !isActive && "cursor-pointer"
                  )}
                  aria-label={`Page ${pageNum}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next Page Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            aria-label="Next page"
            className="px-2"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          {/* Last Page Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            aria-label="Last page"
            className="px-2"
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }
);

Pagination.displayName = "Pagination";

export { Pagination };
