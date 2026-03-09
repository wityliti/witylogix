"use client";

import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SwitchSize = "sm" | "md";

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  size?: SwitchSize;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

const sizeClasses: Record<SwitchSize, { track: string; thumb: string }> = {
  sm: {
    track: "w-9 h-5",
    thumb: "w-4 h-4 after:h-4 after:w-4",
  },
  md: {
    track: "w-11 h-6",
    thumb: "w-5 h-5 after:h-5 after:w-5",
  },
};

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      size = "md",
      checked = false,
      onChange,
      disabled = false,
      className,
      ...props
    },
    ref
  ) => {
    const sizes = sizeClasses[size];

    return (
      <label
        className={cn(
          "inline-flex items-center cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          className="hidden"
          {...props}
        />
        <div
          className={cn(
            "relative inline-flex",
            sizes.track,
            "rounded-full transition-colors duration-fast ease-default",
            checked
              ? "bg-wl-primary-500 hover:bg-wl-primary-600"
              : "bg-wl-bg-overlay hover:bg-wl-border-strong"
          )}
        >
          <div
            className={cn(
              "absolute top-0.5 left-0.5",
              sizes.thumb,
              "rounded-full bg-wl-text-inverse",
              "transition-transform duration-fast ease-default",
              checked && `translate-x-${size === "sm" ? "4" : "5"}`
            )}
            style={checked ? { transform: `translateX(${size === "sm" ? "16px" : "20px"})` } : {}}
          />
        </div>
      </label>
    );
  }
);

Switch.displayName = "Switch";

export { Switch };
