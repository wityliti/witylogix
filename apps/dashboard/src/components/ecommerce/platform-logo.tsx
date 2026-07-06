"use client";

import { forwardRef, type SVGProps } from "react";
import { cn } from "@/lib/utils";

type Platform =
  | "shopify"
  | "woocommerce"
  | "bigcommerce"
  | "magento"
  | "etsy"
  | "ebay"
  | "square"
  | "amazon";

type LogoSize = "sm" | "md" | "lg";

interface PlatformLogoProps extends SVGProps<SVGSVGElement> {
  /** E-commerce platform identifier */
  platform: Platform;
  /** Logo size */
  size?: LogoSize;
  /** Show initials fallback if logo unavailable */
  showFallback?: boolean;
}

const platformConfig: Record<
  Platform,
  {
    name: string;
    initials: string;
    bgColor: string;
    textColor: string;
  }
> = {
  shopify: {
    name: "Shopify",
    initials: "SH",
    bgColor: "bg-green-600",
    textColor: "text-white",
  },
  woocommerce: {
    name: "WooCommerce",
    initials: "WC",
    bgColor: "bg-purple-600",
    textColor: "text-white",
  },
  bigcommerce: {
    name: "BigCommerce",
    initials: "BC",
    bgColor: "bg-blue-600",
    textColor: "text-white",
  },
  magento: {
    name: "Magento",
    initials: "MG",
    bgColor: "bg-orange-600",
    textColor: "text-white",
  },
  etsy: {
    name: "Etsy",
    initials: "ET",
    bgColor: "bg-yellow-500",
    textColor: "text-white",
  },
  ebay: {
    name: "eBay",
    initials: "EB",
    bgColor: "bg-red-600",
    textColor: "text-white",
  },
  square: {
    name: "Square",
    initials: "SQ",
    bgColor: "bg-wl-bg-overlay",
    textColor: "text-white",
  },
  amazon: {
    name: "Amazon",
    initials: "AM",
    bgColor: "bg-amber-600",
    textColor: "text-white",
  },
};

const sizeClasses: Record<LogoSize, string> = {
  sm: "w-5 h-5 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-12 h-12 text-base",
};

const ShopifyLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.5 2h-13c-.3 0-.5.2-.5.5v19c0 .3.2.5.5.5h13c.3 0 .5-.2.5-.5v-19c0-.3-.2-.5-.5-.5z" />
  </svg>
);

const WooCommerceLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
  </svg>
);

const BigCommerceLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);

const MagentoLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15h-2V9h2v8zm4 0h-2V7h2v10z" />
  </svg>
);

const EtsyLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M6 6h12v2H6V6zm0 4h12v2H6v-2zm0 4h12v2H6v-2z" />
  </svg>
);

const EBayLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M3 3h18v18H3z" />
  </svg>
);

const SquareLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="2" />
  </svg>
);

const AmazonLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M6 8h12v8H6z" />
  </svg>
);

const logoComponents: Record<
  Platform,
  React.ComponentType<SVGProps<SVGSVGElement>>
> = {
  shopify: ShopifyLogo,
  woocommerce: WooCommerceLogo,
  bigcommerce: BigCommerceLogo,
  magento: MagentoLogo,
  etsy: EtsyLogo,
  ebay: EBayLogo,
  square: SquareLogo,
  amazon: AmazonLogo,
};

/**
 * Platform logo component displaying e-commerce platform branding
 *
 * @example
 * ```tsx
 * <PlatformLogo platform="shopify" size="md" />
 * <PlatformLogo platform="woocommerce" size="lg" />
 * <PlatformLogo platform="amazon" size="sm" />
 * ```
 */
const PlatformLogo = forwardRef<SVGSVGElement, PlatformLogoProps>(
  (
    { platform, size = "md", showFallback = true, className, ...props },
    ref,
  ) => {
    const config = platformConfig[platform];
    const LogoComponent = logoComponents[platform];

    if (showFallback) {
      return (
        <div
          className={cn(
            "inline-flex items-center justify-center",
            "rounded-lg font-semibold",
            sizeClasses[size],
            config.bgColor,
            config.textColor,
            "transition-all duration-200 ease-default",
            className,
          )}
          title={config.name}
          aria-label={`${config.name} logo`}
        >
          <span className="flex items-center justify-center font-mono">
            {config.initials}
          </span>
        </div>
      );
    }

    return (
      <LogoComponent
        className={cn(
          sizeClasses[size],
          config.textColor,
          "transition-all duration-200 ease-default",
          className,
        )}
        aria-label={`${config.name} logo`}
        {...props}
      />
    );
  },
);

PlatformLogo.displayName = "PlatformLogo";

export { PlatformLogo };
export type { Platform, LogoSize };
