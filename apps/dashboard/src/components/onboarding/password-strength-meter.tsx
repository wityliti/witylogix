"use client";

import { forwardRef, useState, type HTMLAttributes } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordStrengthMeterProps extends HTMLAttributes<HTMLDivElement> {
  password?: string;
  onPasswordChange?: (password: string) => void;
  showInput?: boolean;
  showRequirements?: boolean;
}

interface RequirementCheck {
  id: string;
  label: string;
  check: (password: string) => boolean;
}

const REQUIREMENTS: RequirementCheck[] = [
  {
    id: "length",
    label: "8+ characters",
    check: (pwd) => pwd.length >= 8,
  },
  {
    id: "uppercase",
    label: "Uppercase letter",
    check: (pwd) => /[A-Z]/.test(pwd),
  },
  {
    id: "lowercase",
    label: "Lowercase letter",
    check: (pwd) => /[a-z]/.test(pwd),
  },
  {
    id: "number",
    label: "Number",
    check: (pwd) => /[0-9]/.test(pwd),
  },
  {
    id: "special",
    label: "Special character",
    check: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
  },
];

const getStrengthLevel = (password: string): { level: 0 | 1 | 2 | 3 | 4; label: string } => {
  const metRequirements = REQUIREMENTS.filter((req) =>
    req.check(password)
  ).length;

  if (metRequirements === 0) {
    return { level: 0, label: "Very Weak" };
  } else if (metRequirements <= 1) {
    return { level: 1, label: "Weak" };
  } else if (metRequirements <= 2) {
    return { level: 2, label: "Fair" };
  } else if (metRequirements <= 3) {
    return { level: 3, label: "Strong" };
  } else {
    return { level: 4, label: "Very Strong" };
  }
};

const getStrengthColor = (
  level: 0 | 1 | 2 | 3 | 4
): {
  bg: string;
  text: string;
  segments: string[];
} => {
  switch (level) {
    case 0:
      return {
        bg: "bg-wl-danger-bg",
        text: "text-wl-danger-400",
        segments: ["bg-wl-danger-500"],
      };
    case 1:
      return {
        bg: "bg-wl-danger-bg",
        text: "text-wl-danger-400",
        segments: ["bg-wl-danger-500", "bg-wl-border-subtle", "bg-wl-border-subtle", "bg-wl-border-subtle"],
      };
    case 2:
      return {
        bg: "bg-wl-warning-bg",
        text: "text-wl-warning-400",
        segments: ["bg-wl-warning-500", "bg-wl-warning-500", "bg-wl-border-subtle", "bg-wl-border-subtle"],
      };
    case 3:
      return {
        bg: "bg-yellow-900/20",
        text: "text-yellow-400",
        segments: ["bg-yellow-500", "bg-yellow-500", "bg-yellow-500", "bg-wl-border-subtle"],
      };
    case 4:
      return {
        bg: "bg-wl-success-bg",
        text: "text-wl-success-400",
        segments: ["bg-wl-success-500", "bg-wl-success-500", "bg-wl-success-500", "bg-wl-success-500"],
      };
  }
};

const PasswordStrengthMeter = forwardRef<HTMLDivElement, PasswordStrengthMeterProps>(
  ({
    password = "",
    onPasswordChange,
    showInput = false,
    showRequirements = true,
    className,
    ...props
  }, ref) => {
    const [localPassword, setLocalPassword] = useState(password);
    const currentPassword = onPasswordChange ? password : localPassword;

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalPassword(value);
      onPasswordChange?.(value);
    };

    const { level, label } = getStrengthLevel(currentPassword);
    const colorInfo = getStrengthColor(level);

    const metRequirements = REQUIREMENTS.filter((req) =>
      req.check(currentPassword)
    );

    return (
      <>
        <div
          ref={ref}
          className={cn(
            "w-full space-y-4",
            className
          )}
          {...props}
        >
        {/* Password input */}
        {showInput && (
          <div>
            <label className="block text-sm font-semibold text-wl-text-primary mb-2">
              Password
            </label>
            <input
              type="password"
              value={localPassword}
              onChange={handlePasswordChange}
              placeholder="Enter your password"
              className={cn(
                "w-full px-3 py-2 bg-wl-bg-overlay border-2 rounded-md",
                "text-sm text-wl-text-primary placeholder-wl-text-tertiary",
                "focus:outline-none transition-colors duration-base",
                currentPassword
                  ? `border-${colorInfo.text.split("-")[1]}-${colorInfo.text.split("-")[2]}`
                  : "border-wl-border-subtle focus:border-wl-primary-500"
              )}
            />
          </div>
        )}

        {/* Strength bar */}
        {currentPassword && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-wl-text-secondary">
                Password Strength
              </label>
              <span className={cn("text-xs font-semibold", colorInfo.text)}>
                {label}
              </span>
            </div>

            {/* 4-segment bar */}
            <div className="flex gap-1.5">
              {colorInfo.segments.map((segment, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 h-2 rounded-full transition-all duration-base",
                    segment
                  )}
                />
              ))}
            </div>
          </div>
        )}

        {/* Requirements checklist */}
        {showRequirements && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-wl-text-secondary">
              Password Requirements
            </label>
            <div className="space-y-1.5">
              {REQUIREMENTS.map((req) => {
                const isMet = req.check(currentPassword);
                return (
                  <div
                    key={req.id}
                    className="flex items-center gap-2 text-xs transition-opacity duration-base"
                  >
                    {isMet ? (
                      <Check className="w-4 h-4 text-wl-success-400 flex-shrink-0" strokeWidth={3} />
                    ) : (
                      <X className="w-4 h-4 text-wl-text-tertiary flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        "transition-colors",
                        isMet ? "text-wl-success-400" : "text-wl-text-tertiary"
                      )}
                    >
                      {req.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Info text */}
        {currentPassword && metRequirements.length < REQUIREMENTS.length && (
          <p className="text-xs text-wl-text-tertiary">
            {REQUIREMENTS.length - metRequirements.length} more requirement
            {REQUIREMENTS.length - metRequirements.length === 1 ? "" : "s"} to go
          </p>
        )}
        </div>
      </>
    );
  }
);

PasswordStrengthMeter.displayName = "PasswordStrengthMeter";

export { PasswordStrengthMeter };
export type { PasswordStrengthMeterProps };
