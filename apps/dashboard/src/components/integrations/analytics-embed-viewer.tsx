"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  RefreshCw,
  Maximize2,
  Share2,
  RotateCcw,
  Lock,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";

type Provider = "tableau" | "powerbi" | "looker" | "qlik" | "ga4";
type TokenStatus = "valid" | "expiring" | "expired";

interface AnalyticsEmbedViewerProps {
  embedUrl: string;
  provider: Provider;
  title?: string;
  height?: number;
  onRefreshToken?: () => Promise<void>;
  onShare?: (url: string) => void;
  className?: string;
}

export function AnalyticsEmbedViewer({
  embedUrl,
  provider,
  title = "Analytics Dashboard",
  height = 600,
  onRefreshToken,
  onShare,
  className,
}: AnalyticsEmbedViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("valid");
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [showError, setShowError] = useState(false);

  const getProviderLabel = (): string => {
    const labels: Record<Provider, string> = {
      tableau: "Tableau",
      powerbi: "Power BI",
      looker: "Looker Studio",
      qlik: "Qlik Sense",
      ga4: "Google Analytics 4",
    };
    return labels[provider];
  };

  const getProviderColor = (): string => {
    const colors: Record<Provider, string> = {
      tableau: "var(--wl-primary-500)",
      powerbi: "var(--wl-info-500)",
      looker: "#4285F4",
      qlik: "#74aa92",
      ga4: "#E37400",
    };
    return colors[provider];
  };

  const getTokenStatusColor = (): "success" | "warning" | "danger" => {
    switch (tokenStatus) {
      case "valid":
        return "success";
      case "expiring":
        return "warning";
      case "expired":
        return "danger";
    }
  };

  const getTokenStatusLabel = (): string => {
    switch (tokenStatus) {
      case "valid":
        return "Token Valid";
      case "expiring":
        return "Token Expiring Soon";
      case "expired":
        return "Token Expired";
    }
  };

  const handleRefreshToken = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onRefreshToken?.();
      setTokenStatus("valid");
      setLastRefreshTime(new Date());
    } catch (err) {
      setError("Failed to refresh token. Please try again.");
      setTokenStatus("expired");
      setShowError(true);
    } finally {
      setIsLoading(false);
    }
  }, [onRefreshToken]);

  const handleRetry = useCallback(() => {
    setError(null);
    setShowError(false);
    setIsLoading(true);
    // Simulate retry
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleShare = useCallback(() => {
    const shareUrl = `${window.location.origin}?embed=${encodeURIComponent(embedUrl)}`;
    onShare?.(shareUrl);
    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl);
  }, [embedUrl, onShare]);

  const handleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  return (
    <div
      className={cn(
        "flex flex-col bg-wl-bg-surface border border-wl-border-subtle rounded-lg overflow-hidden",
        isFullscreen && "fixed inset-0 z-50 rounded-none border-0",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-wl-border-subtle bg-wl-bg-overlay">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getProviderColor() }}
          />
          <div>
            <h3 className="text-sm font-semibold text-wl-text-primary">
              {title}
            </h3>
            <p className="text-xs text-wl-text-secondary">
              {getProviderLabel()}
            </p>
          </div>
        </div>

        {/* Token status indicator */}
        <div className="flex items-center gap-2">
          <Badge variant={getTokenStatusColor()} dot>
            {getTokenStatusLabel()}
          </Badge>

          {tokenStatus === "valid" && lastRefreshTime && (
            <div className="text-xs text-wl-text-secondary">
              Updated {lastRefreshTime.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Token refresh warning */}
      {tokenStatus !== "valid" && (
        <div className="px-4 py-3 bg-wl-warning-bg/30 border-b border-wl-warning-400/20 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-wl-warning-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-wl-warning-400">
              {tokenStatus === "expiring"
                ? "Token expiring soon"
                : "Token expired"}
            </p>
            <p className="text-xs text-wl-warning-300 mt-1">
              {tokenStatus === "expiring"
                ? "Refresh your token to maintain uninterrupted access"
                : "Your authentication token has expired. Please refresh it to continue viewing this dashboard."}
            </p>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={handleRefreshToken}
            disabled={isLoading}
            className="flex-shrink-0"
          >
            {isLoading ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Refresh
          </Button>
        </div>
      )}

      {/* Error state */}
      {showError && error && (
        <div className="px-4 py-3 bg-wl-danger-bg/30 border-b border-wl-danger-400/20 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-wl-danger-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-wl-danger-400">{error}</p>
            <p className="text-xs text-wl-danger-300 mt-1">
              The embedded dashboard failed to load. Check your connection and
              try again.
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRetry}
            className="flex-shrink-0 text-wl-danger-400"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 bg-wl-bg-surface/80 flex items-center justify-center z-10 rounded-lg">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-wl-primary-500 mx-auto mb-2" />
            <p className="text-sm text-wl-text-secondary">
              Loading dashboard...
            </p>
          </div>
        </div>
      )}

      {/* Embed container */}
      <div
        className="flex-1 relative bg-wl-bg-surface"
        style={{ minHeight: `${height}px` }}
      >
        <iframe
          src={embedUrl}
          title={title}
          className="w-full h-full border-0"
          allowFullScreen
          style={{ display: isLoading ? "none" : "block" }}
        />

        {/* Fallback message */}
        <div className="hidden absolute inset-0 flex items-center justify-center text-wl-text-secondary text-sm p-8 text-center">
          Unable to load the embedded analytics dashboard. Please check your
          connection and token status.
        </div>
      </div>

      {/* Footer with actions */}
      <div className="flex items-center justify-between p-4 border-t border-wl-border-subtle bg-wl-bg-overlay">
        <div className="flex items-center gap-2 text-xs text-wl-text-secondary">
          <Lock className="w-3 h-3" />
          <span>Secure embedded link</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleShare}
            className="flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefreshToken}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            Refresh Token
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleFullscreen}
            className="flex items-center gap-2"
          >
            <Maximize2 className="w-4 h-4" />
            {isFullscreen ? "Exit" : "Fullscreen"}
          </Button>
        </div>
      </div>
    </div>
  );
}
