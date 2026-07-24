"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  logo?: React.ReactNode;
  title?: string;
  onMenuClick?: () => void;
  rightActions?: React.ReactNode;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
  className?: string;
}

/**
 * Mobile header component with hamburger menu, logo, and action buttons
 *
 * Features:
 * - Hamburger menu button
 * - Centered logo/title
 * - Action buttons (notifications, profile)
 * - Expandable search
 * - Sticky positioning with backdrop blur
 * - Safe area insets for notched devices
 *
 * @example
 * <MobileHeader
 *   title="Dashboard"
 *   onMenuClick={() => setSidebarOpen(!open)}
 *   rightActions={<NotificationBell />}
 * />
 */
export function MobileHeader({
  logo,
  title = "Witylogix",
  onMenuClick,
  rightActions,
  showSearch = false,
  onSearch,
  className,
}: MobileHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40",
        "w-full",
        "bg-wl-bg-surface/80 backdrop-blur-md",
        "border-b border-wl-border-subtle",
        "safe-area-inset-top",
        className,
      )}
    >
      <div
        className={cn("flex items-center justify-between", "px-4 py-3", "h-14")}
      >
        {/* Hamburger Menu Button */}
        <button
          onClick={onMenuClick}
          aria-label="Toggle menu"
          className={cn(
            "flex items-center justify-center",
            "w-10 h-10",
            "-ml-2",
            "rounded-md",
            "transition-colors duration-200",
            "text-wl-text-secondary hover:text-wl-text-primary",
            "hover:bg-wl-bg-elevated",
          )}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Center Logo/Title */}
        <div className="flex-1 flex items-center justify-center min-w-0">
          {isSearchOpen ? (
            <SearchInput
              value={searchQuery}
              onChange={handleSearch}
              onClose={() => setIsSearchOpen(false)}
            />
          ) : (
            <div className="flex items-center gap-2">
              {logo && (
                <div className="w-6 h-6 flex items-center justify-center">
                  {logo}
                </div>
              )}
              <span
                className={cn(
                  "text-sm font-semibold",
                  "text-wl-text-primary",
                  "truncate",
                )}
              >
                {title}
              </span>
            </div>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          {showSearch && (
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              aria-label="Search"
              className={cn(
                "flex items-center justify-center",
                "w-10 h-10",
                "-mr-2",
                "rounded-md",
                "transition-colors duration-200",
                "text-wl-text-secondary hover:text-wl-text-primary",
                "hover:bg-wl-bg-elevated",
              )}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          )}
          {rightActions}
        </div>
      </div>
    </header>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

/**
 * Expandable search input component
 */
function SearchInput({ value, onChange, onClose }: SearchInputProps) {
  return (
    <div className="flex-1 flex items-center gap-2">
      <input
        autoFocus
        type="text"
        placeholder="Search..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "flex-1",
          "px-3 py-1.5",
          "bg-wl-bg-elevated",
          "border border-wl-border-default",
          "rounded-md",
          "text-sm",
          "text-wl-text-primary placeholder:text-wl-text-tertiary",
          "focus:outline-none focus:border-wl-primary-500",
        )}
      />
      <button
        onClick={onClose}
        aria-label="Close search"
        className={cn(
          "flex items-center justify-center",
          "w-8 h-8",
          "rounded-md",
          "transition-colors duration-200",
          "text-wl-text-secondary hover:text-wl-text-primary",
          "hover:bg-wl-bg-overlay",
        )}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

interface NotificationBellProps {
  count?: number;
  onClick?: () => void;
}

/**
 * Notification bell button for mobile header
 *
 * @example
 * <NotificationBell count={3} onClick={() => openNotifications()} />
 */
export function NotificationBell({ count, onClick }: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      aria-label={`Notifications${count ? ` (${count})` : ""}`}
      className={cn(
        "relative",
        "flex items-center justify-center",
        "w-10 h-10",
        "-mr-2",
        "rounded-md",
        "transition-colors duration-200",
        "text-wl-text-secondary hover:text-wl-text-primary",
        "hover:bg-wl-bg-elevated",
      )}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      {count && count > 0 && (
        <span
          className={cn(
            "absolute top-1 right-1",
            "px-1.5 py-0.5",
            "rounded-full",
            "text-xs font-bold",
            "bg-wl-danger-500 text-white",
            "min-w-max",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

interface ProfileButtonProps {
  avatar?: React.ReactNode;
  onClick?: () => void;
}

/**
 * Profile button for mobile header
 *
 * @example
 * <ProfileButton avatar={<img src="avatar.jpg" />} onClick={openProfile} />
 */
export function ProfileButton({ avatar, onClick }: ProfileButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Profile menu"
      className={cn(
        "flex items-center justify-center",
        "w-10 h-10",
        "-mr-2",
        "rounded-md",
        "overflow-hidden",
        "transition-colors duration-200",
        "hover:bg-wl-bg-elevated",
        "border border-wl-border-subtle",
      )}
    >
      {avatar || (
        <svg
          className="w-5 h-5 text-wl-text-secondary"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      )}
    </button>
  );
}
