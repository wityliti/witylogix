"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Package } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Track page — lets customers enter a tracking token to see live delivery status.
 * Navigates to /track/[token] which fetches real data from the API.
 */
export default function TrackPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) {
      setError("Please enter a tracking token or order number.");
      return;
    }
    setError(null);
    router.push(`/track/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Track Delivery</h1>
        <p className="page-subtitle">
          Enter your tracking token to see real-time delivery status
        </p>
      </div>

      <div className="max-w-xl stagger-1">
        <form
          onSubmit={handleSubmit}
          className="section-card flex flex-col gap-4"
        >
          <div>
            <label htmlFor="tracking-token" className="label block mb-2">
              Tracking Token
            </label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-wl-text-tertiary"
              />
              <input
                id="tracking-token"
                type="text"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setError(null);
                }}
                placeholder="Enter tracking token…"
                className={cn(
                  "input w-full pl-9",
                  error && "border-wl-error-500",
                )}
                autoComplete="off"
                autoFocus
              />
            </div>
            {error && <p className="mt-1 text-sm text-wl-error-500">{error}</p>}
            <p className="mt-2 text-xs text-wl-text-tertiary">
              Your tracking token can be found in your delivery confirmation
              email or on your order details page.
            </p>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full sm:w-auto"
          >
            Track My Delivery
          </button>
        </form>

        {/* Tips */}
        <div className="section-card mt-4 stagger-2">
          <div className="flex items-start gap-3">
            <Package
              size={18}
              className="text-wl-primary-500 flex-shrink-0 mt-0.5"
            />
            <div>
              <p className="text-sm font-semibold text-wl-text-primary">
                Where is my token?
              </p>
              <ul className="mt-2 text-sm text-wl-text-secondary space-y-1 list-disc list-inside">
                <li>In your delivery confirmation email</li>
                <li>On the Orders page → View Details → Live Track</li>
                <li>In the SMS notification sent before delivery</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
