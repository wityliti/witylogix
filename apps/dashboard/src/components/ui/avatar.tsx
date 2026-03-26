"use client";

import { useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  size?: AvatarSize;
  className?: string;
  children: ReactNode;
}

interface AvatarImageProps {
  src: string;
  alt: string;
  className?: string;
}

interface AvatarFallbackProps {
  name?: string;
  children?: ReactNode;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
};

const Avatar = ({ size = "md", className, children }: AvatarProps) => {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        "rounded-full overflow-hidden",
        "bg-wl-bg-elevated",
        "border border-wl-border-default",
        sizeClasses[size],
        className
      )}
    >
      {children}
    </div>
  );
};

const AvatarImage = ({ src, alt, className }: AvatarImageProps) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (hasError || !isLoaded) {
    return null;
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      onLoad={() => setIsLoaded(true)}
      className={cn(
        "w-full h-full object-cover",
        className
      )}
    />
  );
};

const AvatarFallback = ({
  name,
  children,
  className
}: AvatarFallbackProps) => {
  const getInitials = (nameStr: string) => {
    return nameStr
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      className={cn(
        "w-full h-full flex items-center justify-center",
        "bg-gradient-to-br from-wl-primary-600 to-wl-primary-700",
        "text-wl-text-inverse font-semibold",
        className
      )}
    >
      {children || (name ? getInitials(name) : "?")}
    </div>
  );
};

export { Avatar, AvatarImage, AvatarFallback };
