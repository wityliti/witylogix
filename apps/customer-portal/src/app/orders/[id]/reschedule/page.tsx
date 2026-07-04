"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { format, addDays } from "date-fns";
import { ArrowLeft, Calendar, Clock, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PageLoader,
  ErrorMessage,
  Skeleton,
} from "@/components/loading-skeleton";
import { useQuery, useMutation } from "@/lib/use-api";
import { ROUTES } from "@/lib/portal-api";
import type { ApiOrder, ApiTimeSlot } from "@/lib/portal-api";

// ─── Response envelopes ───────────────────────────────────────

interface OrderEnvelope {
  data: ApiOrder;
}

interface SlotsEnvelope {
  data: ApiTimeSlot[];
}

type RescheduleStep = "select-date" | "select-time" | "confirm" | "success";

const STEPS: RescheduleStep[] = [
  "select-date",
  "select-time",
  "confirm",
  "success",
];

// ─── Component ────────────────────────────────────────────────

export default function ReschedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const {
    data: orderEnvelope,
    loading: orderLoading,
    error: orderError,
  } = useQuery<OrderEnvelope>(ROUTES.ORDER(id));

  const { data: slotsEnvelope, loading: slotsLoading } =
    useQuery<SlotsEnvelope>(ROUTES.TIME_SLOTS + "?isActive=true");

  const [step, setStep] = useState<RescheduleStep>("select-date");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const order = orderEnvelope?.data;
  const slots = slotsEnvelope?.data ?? [];

  // Available dates: next 7 days from today
  const availableDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i + 1)),
    [],
  );

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  const { mutate: doReschedule, loading: rescheduling } = useMutation(
    ROUTES.ORDER(id),
    "PATCH",
  );

  const handleNext = async () => {
    if (step === "select-date" && selectedDate) {
      setStep("select-time");
    } else if (step === "select-time" && selectedSlotId) {
      setStep("confirm");
    } else if (step === "confirm") {
      setRescheduleError(null);
      try {
        await doReschedule({
          deliveryDate: selectedDate!.toISOString(),
          timeSlotId: selectedSlotId,
          notes: reason.trim() || undefined,
        });
        setStep("success");
      } catch (err: unknown) {
        setRescheduleError(
          err instanceof Error
            ? err.message
            : "Failed to reschedule. Please try again.",
        );
      }
    }
  };

  const handleBack = () => {
    if (step === "select-time") setStep("select-date");
    else if (step === "confirm") setStep("select-time");
  };

  const isNextDisabled =
    (step === "select-date" && !selectedDate) ||
    (step === "select-time" && !selectedSlotId);

  const stepIndex = STEPS.indexOf(step);

  if (orderLoading) return <PageLoader />;
  if (orderError) {
    return (
      <div className="page-container">
        <Link
          href={`/orders/${id}`}
          className="btn btn-ghost inline-flex items-center gap-2 mb-4"
        >
          <ArrowLeft size={18} />
          Back
        </Link>
        <ErrorMessage message={orderError.message} />
      </div>
    );
  }

  const currentDate = order?.deliveryDate
    ? new Date(order.deliveryDate)
    : new Date();

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/orders/${id}`}
          className="btn btn-ghost p-2"
          aria-label="Back to order"
        >
          <ArrowLeft size={20} className="text-wl-text-primary" />
        </Link>
        <div className="page-header">
          <h1 className="page-title">Reschedule Delivery</h1>
          <p className="page-subtitle">
            Current delivery: {format(currentDate, "PPP")}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-2xl">
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "flex-1 h-2 rounded-full transition-colors duration-fast",
                stepIndex >= i ? "bg-wl-primary-500" : "bg-wl-neutral-700",
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl">
        {step === "select-date" && (
          <div className="section-card stagger-1">
            <div className="flex items-center gap-2 mb-6">
              <Calendar size={24} className="text-wl-primary-500" />
              <h2 className="text-2xl font-bold text-wl-text-primary">
                Select a New Date
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableDates.map((date) => (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    "section-card text-left transition-all duration-fast",
                    selectedDate?.toDateString() === date.toDateString()
                      ? "border-wl-primary-500 bg-wl-bg-elevated"
                      : "hover:border-wl-primary-500/50",
                  )}
                >
                  <p className="font-medium text-wl-text-primary">
                    {format(date, "EEE, MMM d")}
                  </p>
                  <p className="text-xs text-wl-text-tertiary mt-1">
                    {format(date, "PPP")}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "select-time" && (
          <div className="section-card stagger-1">
            <div className="flex items-center gap-2 mb-6">
              <Clock size={24} className="text-wl-primary-500" />
              <h2 className="text-2xl font-bold text-wl-text-primary">
                Select a Time Slot
              </h2>
            </div>

            <p className="text-wl-text-secondary mb-4">
              For {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}
            </p>

            {slotsLoading && (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            )}

            {!slotsLoading && slots.length === 0 && (
              <p className="text-sm text-wl-text-tertiary">
                No time slots available. Please contact support to reschedule.
              </p>
            )}

            {!slotsLoading && slots.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {slots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={cn(
                      "section-card text-center font-medium mono transition-all duration-fast",
                      selectedSlotId === slot.id
                        ? "border-wl-primary-500 bg-wl-bg-elevated text-wl-primary-400"
                        : "text-wl-text-primary hover:border-wl-primary-500/50",
                    )}
                  >
                    <p className="font-semibold">{slot.name}</p>
                    <p className="text-xs text-wl-text-secondary mt-1">
                      {slot.startTime} – {slot.endTime}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "confirm" && (
          <div className="section-card stagger-1">
            <h2 className="text-2xl font-bold text-wl-text-primary mb-6">
              Confirm Reschedule
            </h2>

            <div className="section-card bg-wl-bg-elevated space-y-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="label">Original Date</span>
                <span className="value mono">{format(currentDate, "PPP")}</span>
              </div>
              <div className="border-t border-wl-border-subtle" />
              <div className="flex justify-between items-center">
                <span className="label">New Date</span>
                <span className="value text-wl-primary-400 mono">
                  {selectedDate && format(selectedDate, "PPP")}
                </span>
              </div>
              {selectedSlot && (
                <div className="flex justify-between items-center">
                  <span className="label">New Slot</span>
                  <span className="value text-wl-primary-400 mono">
                    {selectedSlot.name} ({selectedSlot.startTime} –{" "}
                    {selectedSlot.endTime})
                  </span>
                </div>
              )}
            </div>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional: Add a reason for rescheduling…"
              className="input w-full resize-none h-28"
              maxLength={500}
            />

            {rescheduleError && (
              <p className="mt-3 text-sm text-wl-error-500">
                {rescheduleError}
              </p>
            )}
          </div>
        )}

        {step === "success" && (
          <div className="section-card border-l-2 border-wl-success-500 text-center stagger-1">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-wl-success-500/20 flex items-center justify-center">
              <CheckCircle size={32} className="text-wl-success-500" />
            </div>

            <h2 className="text-2xl font-bold text-wl-text-primary mb-2">
              Delivery Rescheduled!
            </h2>
            <p className="text-wl-text-secondary mb-6">
              Your delivery has been rescheduled to{" "}
              {selectedDate && format(selectedDate, "EEEE, MMMM d")}
              {selectedSlot
                ? ` at ${selectedSlot.startTime} – ${selectedSlot.endTime}`
                : ""}
              .
            </p>

            <p className="text-sm text-wl-text-tertiary mb-8">
              You can track your delivery anytime from your orders page.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`/orders/${id}`} className="btn btn-primary">
                Back to Order
              </Link>
              <Link href="/orders" className="btn btn-secondary">
                View All Orders
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {step !== "success" && (
        <div className="flex gap-3 max-w-2xl">
          {step !== "select-date" && (
            <button
              onClick={handleBack}
              disabled={rescheduling}
              className="btn btn-secondary"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={isNextDisabled || rescheduling}
            className={cn(
              "btn btn-primary flex-1",
              (isNextDisabled || rescheduling) &&
                "opacity-50 cursor-not-allowed",
            )}
          >
            {rescheduling ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Rescheduling…
              </>
            ) : step === "confirm" ? (
              "Confirm Reschedule"
            ) : (
              "Continue"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
