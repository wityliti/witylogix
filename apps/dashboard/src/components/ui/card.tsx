"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  glow?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, hover, glow, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-[#13131a] border border-white/[0.08] rounded-xl p-5",
          "shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset]",
          "transition-all duration-base ease-default",
          hover && "hover:border-white/[0.14] hover:bg-[#161620] cursor-pointer",
          glow && "shadow-[0_0_20px_rgba(245,166,35,0.12),0_1px_0_0_rgba(255,255,255,0.07)_inset]",
          props.onClick && "cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between mb-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
CardHeader.displayName = "CardHeader";

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "text-sm font-semibold text-wl-text-secondary tracking-wider uppercase m-0",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  )
);
CardTitle.displayName = "CardTitle";

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={className}
      {...props}
    >
      {children}
    </div>
  )
);
CardContent.displayName = "CardContent";

interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        "text-sm text-wl-text-secondary leading-relaxed mt-1",
        className
      )}
      {...props}
    >
      {children}
    </p>
  )
);
CardDescription.displayName = "CardDescription";

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-end gap-2 mt-4 pt-4 border-t border-wl-border-subtle",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
};
