"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Mail, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [countdown, setCountdown] = useState(60);

  // Countdown timer for resend option
  useEffect(() => {
    if (!isSubmitted) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSubmitted]);

  const validateForm = () => {
    let isValid = true;
    setEmailError("");
    setError("");

    if (!email) {
      setEmailError("Email is required");
      isValid = false;
    } else if (!email.includes("@")) {
      setEmailError("Please enter a valid email");
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 404) {
          throw new Error("Email not found. Please check and try again.");
        } else if (response.status === 429) {
          throw new Error("Too many requests. Please try again later.");
        } else {
          throw new Error(errorData.message || `Failed to send reset email: ${response.status}`);
        }
      }

      // Success - show confirmation screen
      setIsSubmitted(true);
      setCountdown(60);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (countdown > 0) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error("Failed to resend email. Please try again.");
      }

      // Reset countdown
      setCountdown(60);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to resend email.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col gap-6 text-center">
        {/* Success Icon */}
        <div className="flex justify-center animate-in scale-in-95">
          <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 bg-opacity-10 bg-wl-success-500 border-wl-success-500">
            <CheckCircle2 size={36} color="var(--wl-success-500)" />
          </div>
        </div>

        {/* Success Message */}
        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary mb-2">
            Check your email
          </h2>
          <p className="text-sm text-wl-text-tertiary leading-relaxed">
            We&apos;ve sent password reset instructions to{" "}
            <span className="text-wl-text-secondary font-semibold">
              {email}
            </span>
            . Please check your inbox and follow the link to reset your password.
          </p>
        </div>

        {/* Additional Info */}
        <div className="p-4 rounded-lg text-xs text-wl-text-tertiary bg-opacity-5 border border-opacity-15 bg-blue-400 border-blue-400 leading-relaxed">
          Didn&apos;t receive the email? Check your spam folder or resend below.
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-lg bg-opacity-10 border border-opacity-20 text-sm text-wl-danger-400 bg-wl-danger-400 border-wl-danger-400 animate-in">
            {error}
          </div>
        )}

        {/* Resend Button */}
        <button
          onClick={handleResendEmail}
          disabled={isLoading || countdown > 0}
          className={cn(
            "py-3 px-4 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 transition-all border-wl-border-default",
            countdown > 0 ? "bg-wl-bg-surface text-wl-text-muted" : "bg-wl-primary-500 text-wl-text-inverse",
            (isLoading || countdown > 0) && "opacity-60 cursor-not-allowed"
          )}
          onMouseEnter={(e) => {
            if (!isLoading && countdown === 0) {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--wl-primary-600)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(108, 99, 255, 0.25)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading && countdown === 0) {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--wl-primary-500)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Sending...
            </>
          ) : countdown > 0 ? (
            <>Resend in {countdown}s</>
          ) : (
            <>Resend Email</>
          )}
        </button>

        {/* Back to Login */}
        <Link
          href="/login"
          className="py-3 px-4 rounded-lg border border-wl-border-default bg-wl-bg-surface text-wl-text-primary text-sm font-semibold no-underline flex items-center justify-center gap-2 transition-all cursor-pointer hover:border-wl-primary-500 hover:bg-wl-bg-overlay"
        >
          Back to sign in
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Heading */}
      <div>
        <h2 className="text-2xl font-bold text-wl-text-primary mb-1">
          Reset password
        </h2>
        <p className="text-sm text-wl-text-tertiary">
          Enter your email address and we&apos;ll send you a link to reset your password
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Email Field */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="email"
            className="text-sm font-medium text-wl-text-primary"
          >
            Email address
          </label>
          <div className="relative flex items-center">
            <Mail
              size={18}
              className="absolute left-3 text-wl-text-tertiary pointer-events-none"
            />
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError("");
              }}
              disabled={isLoading}
              className={cn(
                "w-full py-3 px-3 pl-11 rounded-lg border text-sm bg-wl-bg-surface text-wl-text-primary transition-all outline-none",
                emailError
                  ? "border-wl-danger-500 border-1.5"
                  : "border-wl-border-default",
                isLoading && "opacity-60"
              )}
              onFocus={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.borderColor = emailError ? "var(--wl-danger-500)" : "var(--wl-primary-500)";
                  e.currentTarget.style.boxShadow = emailError
                    ? "0 0 0 3px rgba(239, 68, 68, 0.1)"
                    : "0 0 0 3px rgba(108, 99, 255, 0.1)";
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = emailError ? "var(--wl-danger-500)" : "1px solid var(--wl-border-default)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
          {emailError && (
            <span className="text-xs text-wl-danger-400">
              {emailError}
            </span>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-lg bg-opacity-10 border border-opacity-20 text-sm text-wl-danger-400 bg-wl-danger-400 border-wl-danger-400 animate-in">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "py-3 px-4 rounded-lg border-none text-wl-text-inverse text-sm font-semibold flex items-center justify-center gap-2 transition-all",
            isLoading && "opacity-80 cursor-not-allowed"
          )}
          style={{
            background: isLoading
              ? "var(--wl-primary-600)"
              : "linear-gradient(135deg, var(--wl-primary-500) 0%, var(--wl-primary-600) 100%)",
            boxShadow: "0 4px 12px rgba(108, 99, 255, 0.25)",
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(108, 99, 255, 0.35)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(108, 99, 255, 0.25)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
            }
          }}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Sending reset link...
            </>
          ) : (
            <>
              Send Reset Link
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Back to Login */}
      <div className="text-center text-sm text-wl-text-tertiary">
        Remember your password?{" "}
        <Link
          href="/login"
          className="text-wl-primary-400 no-underline font-semibold transition-colors hover:text-wl-primary-300"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
