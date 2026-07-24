"use client";

import { useMemo, useState } from "react";
import { format, isAfter, isBefore, parseISO } from "date-fns";
import { Calendar, MapPin, Package, Star } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { RatingStars } from "@/components/rating-stars";
import {
  OrderListSkeleton,
  ErrorMessage,
  EmptyState,
} from "@/components/loading-skeleton";
import { useQuery } from "@/lib/use-api";
import type { ApiOrder } from "@/lib/portal-api";
import { ROUTES, getStatusLabel, getStatusVariant } from "@/lib/portal-api";

// ─── Paginated response ───────────────────────────────────────

interface PaginatedOrders {
  data: ApiOrder[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Date range filter options ────────────────────────────────

type DateRange = "all" | "7d" | "30d" | "90d";

const DATE_RANGES: { id: DateRange; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
];

function cutoffForRange(range: DateRange): Date | null {
  if (range === "all") return null;
  const now = new Date();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

// ─── Component ────────────────────────────────────────────────

export default function DeliveriesPage() {
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [ratingFilter, setRatingFilter] = useState<"all" | "rated" | "unrated">(
    "all",
  );

  // Fetch delivered orders only
  const { data, loading, error, refetch } = useQuery<PaginatedOrders>(
    `${ROUTES.ORDERS}?status=DELIVERED&limit=100&sortBy=createdAt&sortOrder=desc`,
  );

  const deliveries = useMemo(() => data?.data ?? [], [data]);

  const filtered = useMemo(() => {
    let result = deliveries;

    const cutoff = cutoffForRange(dateRange);
    if (cutoff) {
      result = result.filter((d) => {
        const deliveredAt = d.actualDelivery ?? d.proofOfDelivery?.deliveredAt;
        if (!deliveredAt) return false;
        return isAfter(new Date(deliveredAt), cutoff);
      });
    }

    if (ratingFilter === "rated") {
      // POD with recipientName treated as "rated" proxy — real rating model TBD
      result = result.filter((d) => d.proofOfDelivery?.recipientName);
    } else if (ratingFilter === "unrated") {
      result = result.filter((d) => !d.proofOfDelivery?.recipientName);
    }

    return result;
  }, [deliveries, dateRange, ratingFilter]);

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Delivery History</h1>
        <p className="page-subtitle">
          {data
            ? `${data.pagination.total} completed delivery${data.pagination.total !== 1 ? "ies" : ""}`
            : "Your past delivered orders"}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 stagger-1">
        <div className="flex gap-2 flex-wrap">
          {DATE_RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setDateRange(r.id)}
              className={cn(
                "btn btn-sm",
                dateRange === r.id ? "btn-primary" : "btn-ghost",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(["all", "rated", "unrated"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setRatingFilter(v)}
              className={cn(
                "btn btn-sm",
                ratingFilter === v ? "btn-primary" : "btn-ghost",
              )}
            >
              {v === "all" ? "All" : v === "rated" ? "Rated" : "Unrated"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="stagger-2">
        {loading && <OrderListSkeleton count={4} />}

        {!loading && error && (
          <ErrorMessage message={error.message} onRetry={refetch} />
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={<Package size={24} />}
            title="No deliveries found"
            description={
              dateRange !== "all"
                ? "No deliveries in the selected time range."
                : "Your completed deliveries will appear here."
            }
          />
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-4">
            {filtered.map((delivery) => {
              const deliveredAt =
                delivery.actualDelivery ??
                delivery.proofOfDelivery?.deliveredAt;
              const orderNumber =
                delivery.externalOrderNumber ??
                `#${delivery.id.slice(-8).toUpperCase()}`;

              return (
                <div
                  key={delivery.id}
                  className="section-card hover:border-wl-primary-500/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-wl-text-primary mono">
                        {orderNumber}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 text-sm text-wl-text-secondary">
                        <MapPin
                          size={12}
                          className="flex-shrink-0 text-wl-text-tertiary"
                        />
                        <span>
                          {delivery.addressLine1}, {delivery.city}
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "status-badge flex-shrink-0",
                        getStatusVariant(delivery.status) === "complete" &&
                          "status-complete",
                        getStatusVariant(delivery.status) === "error" &&
                          "status-error",
                        getStatusVariant(delivery.status) === "warn" &&
                          "status-warn",
                        getStatusVariant(delivery.status) === "default" &&
                          "status-default",
                      )}
                    >
                      {getStatusLabel(delivery.status)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-wl-text-tertiary">
                    {deliveredAt && (
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        <span>
                          Delivered {format(new Date(deliveredAt), "PPP")}
                        </span>
                      </div>
                    )}
                    {delivery.totalPrice != null && (
                      <span className="mono font-medium text-wl-text-secondary">
                        ${delivery.totalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {delivery.driver && (
                    <p className="mt-2 text-xs text-wl-text-tertiary">
                      Driver:{" "}
                      <span className="text-wl-text-secondary">
                        {delivery.driver.name}
                      </span>
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-wl-border-subtle">
                    <Link
                      href={`/orders/${delivery.id}`}
                      className="btn btn-ghost text-sm"
                    >
                      View Details
                    </Link>
                    {delivery.status === "DELIVERED" &&
                      !delivery.proofOfDelivery?.recipientName && (
                        <Link
                          href={`/orders/${delivery.id}/rate`}
                          className="btn btn-primary text-sm"
                        >
                          <Star size={14} />
                          Rate Delivery
                        </Link>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
