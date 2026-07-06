"use client";

import { type ReactNode, type CSSProperties, useRef, useState } from "react";
import { cn } from "../../lib/utils";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content?: string | ReactNode;
  /** Alias for content */
  text?: string | ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

export function Tooltip({
  content,
  text,
  children,
  position = "top",
  delay = 200,
  className,
  style,
}: TooltipProps) {
  const tooltipContent = content ?? text;
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setCoords({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
        setIsVisible(true);
      }
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const positionClasses: Record<TooltipPosition, string> = {
    top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2",
  };

  const arrowPositions: Record<TooltipPosition, string> = {
    top: "bottom-[-4px] left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-wl-bg-elevated",
    bottom:
      "top-[-4px] left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-wl-bg-elevated",
    left: "right-[-4px] top-1/2 -translate-y-1/2 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-wl-bg-elevated",
    right:
      "left-[-4px] top-1/2 -translate-y-1/2 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-wl-bg-elevated",
  };

  return (
    <div
      ref={triggerRef}
      className={cn("relative inline-block", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={style}
    >
      {children}

      {isVisible && (
        <div
          ref={tooltipRef}
          className={cn(
            "fixed z-50 px-3 py-2 text-sm font-medium rounded",
            "bg-wl-bg-elevated text-wl-text-primary",
            "border border-wl-border-default shadow-lg",
            "whitespace-nowrap pointer-events-none",
            positionClasses[position],
          )}
          style={{
            position: "fixed",
            left: coords.x,
            top: coords.y,
            transform:
              position === "top"
                ? "translate(-50%, -100%)"
                : position === "bottom"
                  ? "translate(-50%, 0)"
                  : position === "left"
                    ? "translate(-100%, -50%)"
                    : "translate(0, -50%)",
          }}
        >
          {tooltipContent}

          <div
            className={cn("absolute w-0 h-0", arrowPositions[position])}
            style={{
              borderWidth: "4px",
            }}
          />
        </div>
      )}
    </div>
  );
}

interface TooltipProviderProps {
  children: ReactNode;
}

export function TooltipProvider({ children }: TooltipProviderProps) {
  return <div className="relative">{children}</div>;
}

export function TooltipTrigger({
  children,
  className,
  asChild: _asChild,
}: {
  children: ReactNode;
  className?: string;
  asChild?: boolean;
}) {
  return <div className={className}>{children}</div>;
}

export function TooltipContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
