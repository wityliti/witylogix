"use client";

import { Bell, User, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  customerName?: string;
  onMenuClick?: () => void;
}

export function Header({
  customerName = "John Doe",
  onMenuClick,
}: HeaderProps) {
  const initials = customerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <header
      className={cn(
        "sticky top-0 z-40",
        "bg-wl-bg-root/80 backdrop-blur-md",
        "border-b border-wl-border-subtle",
        "px-4 sm:px-6 lg:px-8",
      )}
    >
      <div className="flex items-center justify-between h-14 gap-4">
        {/* Mobile menu */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 rounded-md hover:bg-wl-bg-elevated transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={20} className="text-wl-text-secondary" />
        </button>

        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <button
            className="relative p-2 rounded-md hover:bg-wl-bg-elevated transition-colors"
            aria-label="Notifications"
          >
            <Bell size={18} className="text-wl-text-secondary" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-wl-primary-500 rounded-full" />
          </button>

          <button
            className={cn(
              "flex items-center gap-2.5 p-1.5 pr-3 rounded-full",
              "hover:bg-wl-bg-elevated transition-colors",
            )}
            aria-label="Profile menu"
          >
            <div
              className={cn(
                "w-7 h-7 rounded-full",
                "bg-wl-neutral-700 flex items-center justify-center",
                "text-xs font-semibold text-wl-text-primary",
              )}
            >
              {initials}
            </div>
            <span className="hidden sm:block text-sm font-medium text-wl-text-primary">
              {customerName}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
