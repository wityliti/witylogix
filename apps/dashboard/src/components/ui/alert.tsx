"use client";

import { ReactNode, useState } from "react";
import {
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "info" | "success" | "warning" | "danger";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  description?: string;
  children?: ReactNode;
  onClose?: () => void;
  closeable?: boolean;
  className?: string;
}

const variantConfig: Record<
  AlertVariant,
  { bg: string; border: string; icon: ReactNode; iconColor: string }
> = {
  info: {
    bg: "bg-wl-primary-900/30",
    border: "border-wl-primary-400/30",
    icon: <Info size={20} />,
    iconColor: "text-wl-primary-400",
  },
  success: {
    bg: "bg-wl-success-900/30",
    border: "border-wl-success-400/30",
    icon: <CheckCircle size={20} />,
    iconColor: "text-wl-success-400",
  },
  warning: {
    bg: "bg-wl-warning-900/30",
    border: "border-wl-warning-400/30",
    icon: <AlertTriangle size={20} />,
    iconColor: "text-wl-warning-400",
  },
  danger: {
    bg: "bg-wl-danger-900/30",
    border: "border-wl-danger-400/30",
    icon: <XCircle size={20} />,
    iconColor: "text-wl-danger-400",
  },
};

const Alert = ({
  variant = "info",
  title,
  description,
  children,
  onClose,
  closeable = true,
  className,
}: AlertProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const config = variantConfig[variant];

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "relative flex gap-4 p-4 rounded-md",
        "border",
        config.bg,
        config.border,
        className
      )}
      role="alert"
    >
      <div className={cn("flex-shrink-0 mt-0.5", config.iconColor)}>
        {config.icon}
      </div>

      <div className="flex-1 min-w-0">
        {title && (
          <h3 className="text-sm font-semibold text-wl-text-primary mb-1">
            {title}
          </h3>
        )}
        {description && (
          <p className="text-sm text-wl-text-secondary">{description}</p>
        )}
        {children && <div className="text-sm text-wl-text-secondary mt-2">{children}</div>}
      </div>

      {closeable && (
        <button
          onClick={handleClose}
          className={cn(
            "flex-shrink-0 mt-0.5",
            "text-wl-text-secondary hover:text-wl-text-primary",
            "transition-colors duration-fast ease-default",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wl-primary-500"
          )}
          aria-label="Close alert"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};

export { Alert };
