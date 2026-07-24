"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mail, Check, AlertCircle, Loader } from "lucide-react";
import type { OnboardingData } from "../types";

interface VerifyEmailProps {
  data: OnboardingData;
  /** Shown in copy; prefer progress email, else auth user email */
  displayEmail: string;
  token: string | null;
  /** Base URL including `/api/v4` */
  apiBaseUrl: string;
  onVerified: (data: OnboardingData) => void;
}

export function VerifyEmail({
  data,
  displayEmail,
  token,
  apiBaseUrl,
  onVerified,
}: VerifyEmailProps) {
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [verified, setVerified] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendTimer <= 0) return;

    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }
    if (!token) {
      setError("Session expired. Please sign in again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${apiBaseUrl}/onboarding/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: fullCode }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        setError(
          json.message ||
            json.error ||
            "Invalid or expired code. Request a new code or try again.",
        );
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      setVerified(true);
      setTimeout(() => {
        onVerified({
          ...data,
          verificationCode: fullCode,
          emailVerified: true,
        });
      }, 800);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!token || resendTimer > 0 || resending) return;

    setResending(true);
    setError("");

    try {
      const res = await fetch(`${apiBaseUrl}/onboarding/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: "{}",
      });

      const json = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        setError(
          json.message ||
            json.error ||
            "Could not resend verification email. Try again later.",
        );
        return;
      }

      setResendTimer(60);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 py-4">
      <div className="flex flex-col gap-3">
        <div
          className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center",
            verified ? "bg-wl-success-500/20" : "bg-wl-primary-500/20",
          )}
        >
          {verified ? (
            <Check className="w-6 h-6 text-wl-success-400" />
          ) : (
            <Mail className="w-6 h-6 text-wl-primary-400" />
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold text-wl-text-primary m-0">
            Verify your email
          </h2>
          <p className="text-sm text-wl-text-secondary mt-1 m-0">
            We&apos;ve sent a 6-digit code to{" "}
            <span className="font-semibold text-wl-text-primary">
              {displayEmail || "your email"}
            </span>
          </p>
        </div>
      </div>

      {!verified && (
        <div className="flex flex-col gap-6">
          <div className="flex gap-2 justify-center">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={loading || resending}
                className={cn(
                  "w-12 h-14 rounded-lg text-center text-xl font-bold",
                  "border-2 transition-all duration-200",
                  "bg-wl-bg-surface",
                  error
                    ? "border-wl-danger-400 text-wl-danger-400"
                    : digit
                      ? "border-wl-primary-500 text-wl-text-primary"
                      : "border-wl-border-default text-wl-text-secondary hover:border-wl-border-strong",
                  "focus:border-wl-primary-500 focus:outline-none",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              />
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-wl-danger-bg border border-wl-danger-400/30">
              <AlertCircle className="w-4 h-4 text-wl-danger-400 flex-shrink-0" />
              <span className="text-sm text-wl-danger-400">{error}</span>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            onClick={handleVerify}
            disabled={loading || resending || code.join("").length !== 6}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Email"
            )}
          </Button>

          <div className="flex flex-col items-center gap-3">
            <span className="text-sm text-wl-text-tertiary">
              Didn&apos;t receive the code?
            </span>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendTimer > 0 || resending || loading}
              className={cn(
                "text-sm font-semibold transition-all",
                resendTimer > 0 || resending
                  ? "text-wl-text-tertiary cursor-not-allowed"
                  : "text-wl-primary-500 hover:text-wl-primary-400 cursor-pointer",
              )}
            >
              {resending
                ? "Sending..."
                : resendTimer > 0
                  ? `Resend code in ${resendTimer}s`
                  : "Resend code"}
            </button>
          </div>
        </div>
      )}

      {verified && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="relative w-20 h-20 rounded-full bg-wl-success-500/20 flex items-center justify-center">
            <Check className="w-10 h-10 text-wl-success-400" />
            <div
              className="absolute inset-0 rounded-full border-2 border-wl-success-400/30 animate-pulse"
              style={{
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-wl-text-primary m-0">
              Email verified successfully!
            </p>
            <p className="text-sm text-wl-text-secondary mt-2 m-0">
              Moving to next step...
            </p>
          </div>
        </div>
      )}

      <div className="p-4 rounded-lg bg-wl-primary-500/10 border border-wl-primary-500/20">
        <p className="text-xs text-wl-text-secondary leading-relaxed m-0">
          Check your spam folder if you don&apos;t see the email within a few
          minutes. You can request a new verification code above.
        </p>
      </div>
    </div>
  );
}
