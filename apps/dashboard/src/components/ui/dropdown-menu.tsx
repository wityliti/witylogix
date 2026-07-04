"use client";

import {
  type ReactNode,
  type CSSProperties,
  useRef,
  useState,
  useEffect,
} from "react";
import { cn } from "../../lib/utils";

interface DropdownMenuItemProps {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  className?: string;
  style?: CSSProperties;
  isDangerous?: boolean;
}

interface DropdownMenuGroupProps {
  children: ReactNode;
}

interface DropdownMenuSeparatorProps {
  className?: string;
}

interface DropdownMenuItem {
  label: string;
  onClick?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  separator?: boolean;
}

interface DropdownMenuProps {
  trigger: ReactNode;
  children?: ReactNode;
  /** Shorthand items array - renders simple menu items */
  items?: DropdownMenuItem[];
  align?: "left" | "right" | "center";
  side?: "top" | "bottom";
  className?: string;
  style?: CSSProperties;
}

export function DropdownMenu({
  trigger,
  children,
  items,
  align = "right",
  side = "bottom",
  className,
  style,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const alignmentClass = {
    left: "left-0",
    right: "right-0",
    center: "left-1/2 -translate-x-1/2",
  }[align];

  const sideClass = {
    top: "bottom-full mb-2",
    bottom: "top-full mt-2",
  }[side];

  return (
    <div className={cn("relative inline-block", className)} style={style}>
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer"
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={contentRef}
          className={cn(
            "absolute z-50 min-w-40",
            "bg-wl-bg-elevated border border-wl-border-default rounded-lg",
            "shadow-lg",
            "py-1",
            sideClass,
            alignmentClass,
          )}
          role="menu"
        >
          {items
            ? items.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    item.onClick?.();
                    setIsOpen(false);
                  }}
                  disabled={item.disabled}
                  className="w-full text-left px-4 py-2 text-sm text-wl-text-primary hover:bg-wl-bg-overlay disabled:opacity-50"
                  role="menuitem"
                >
                  {item.icon && <span className="mr-2">{item.icon}</span>}
                  {item.label}
                </button>
              ))
            : children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuTrigger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export function DropdownMenuContent({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  label,
  icon,
  onClick,
  className,
  style,
  isDangerous = false,
}: DropdownMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-4 py-2 text-left text-sm font-medium",
        "flex items-center gap-2",
        "transition-colors duration-fast ease-default",
        "hover:bg-wl-bg-surface",
        isDangerous
          ? "text-wl-danger-400 hover:text-wl-danger-500"
          : "text-wl-text-primary hover:text-wl-primary-400",
        className,
      )}
      style={style}
      role="menuitem"
    >
      {icon && <span className="flex items-center flex-shrink-0">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

export function DropdownMenuGroup({ children }: DropdownMenuGroupProps) {
  return <div role="group">{children}</div>;
}

export function DropdownMenuSeparator({
  className,
}: DropdownMenuSeparatorProps) {
  return (
    <div
      className={cn("my-1 h-px bg-wl-border-subtle", className)}
      role="separator"
    />
  );
}

export function DropdownMenuLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-4 py-2 text-xs font-semibold text-wl-text-secondary uppercase tracking-wider",
        className,
      )}
    >
      {children}
    </div>
  );
}
