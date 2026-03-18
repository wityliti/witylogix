"use client";

import { forwardRef, type ReactNode, type HTMLAttributes, useEffect } from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onOpenChange?.(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;
  return <>{children}</>;
}

function DialogTrigger({ children, asChild }: { children: ReactNode; asChild?: boolean }) {
  return <>{children}</>;
}

const DialogOverlay = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
);
DialogOverlay.displayName = "DialogOverlay";

const DialogContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { children: ReactNode }>(
  ({ className, children, ...props }, ref) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        ref={ref}
        className={cn(
          "bg-[#13131a] border border-white/[0.08] rounded-xl shadow-xl",
          "w-full max-w-lg p-6",
          "shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset]",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  )
);
DialogContent.displayName = "DialogContent";

const DialogHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 mb-4", className)} {...props} />
  )
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center justify-end gap-2 mt-4 pt-4 border-t border-white/[0.06]", className)} {...props} />
  )
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold text-wl-text-primary", className)} {...props} />
  )
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-wl-text-secondary", className)} {...props} />
  )
);
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogTrigger,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
