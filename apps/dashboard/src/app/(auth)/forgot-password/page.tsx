"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Mail, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

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
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-6)", textAlign: "center" }}>
        {/* Success Icon */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            animation: "wl-scale-in 600ms var(--wl-ease-spring) both",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.1)",
              border: "2px solid var(--wl-success-500)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle2 size={36} color="var(--wl-success-500)" />
          </div>
        </div>

        {/* Success Message */}
        <div>
          <h2
            style={{
              fontSize: "var(--wl-text-2xl)",
              fontWeight: 700,
              color: "var(--wl-text-primary)",
              marginBottom: "var(--wl-space-2)",
              fontFamily: "var(--wl-font-sans)",
            }}
          >
            Check your email
          </h2>
          <p
            style={{
              fontSize: "var(--wl-text-sm)",
              color: "var(--wl-text-tertiary)",
              fontFamily: "var(--wl-font-sans)",
              lineHeight: 1.6,
            }}
          >
            We&apos;ve sent password reset instructions to{" "}
            <span
              style={{
                color: "var(--wl-text-secondary)",
                fontWeight: 600,
              }}
            >
              {email}
            </span>
            . Please check your inbox and follow the link to reset your password.
          </p>
        </div>

        {/* Additional Info */}
        <div
          style={{
            padding: "var(--wl-space-4)",
            borderRadius: "var(--wl-radius-lg)",
            background: "rgba(59, 130, 246, 0.05)",
            border: "1px solid rgba(59, 130, 246, 0.15)",
            fontSize: "var(--wl-text-xs)",
            color: "var(--wl-text-tertiary)",
            fontFamily: "var(--wl-font-sans)",
            lineHeight: 1.6,
          }}
        >
          Didn&apos;t receive the email? Check your spam folder or resend below.
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: "var(--wl-space-3)",
              borderRadius: "var(--wl-radius-lg)",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              fontSize: "var(--wl-text-sm)",
              color: "var(--wl-danger-400)",
              fontFamily: "var(--wl-font-sans)",
              animation: "wl-fade-in 300ms var(--wl-ease-default) both",
            }}
          >
            {error}
          </div>
        )}

        {/* Resend Button */}
        <button
          onClick={handleResendEmail}
          disabled={isLoading || countdown > 0}
          style={{
            padding: "var(--wl-space-3) var(--wl-space-4)",
            borderRadius: "var(--wl-radius-lg)",
            border: "1px solid var(--wl-border-default)",
            background: countdown > 0 ? "var(--wl-bg-surface)" : "var(--wl-primary-500)",
            color: countdown > 0 ? "var(--wl-text-muted)" : "var(--wl-text-inverse)",
            fontSize: "var(--wl-text-sm)",
            fontWeight: 600,
            fontFamily: "var(--wl-font-sans)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--wl-space-2)",
            transition: "all var(--wl-duration-fast) var(--wl-ease-default)",
            cursor: isLoading || countdown > 0 ? "not-allowed" : "pointer",
            opacity: isLoading || countdown > 0 ? 0.6 : 1,
          }}
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
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
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
          style={{
            padding: "var(--wl-space-3) var(--wl-space-4)",
            borderRadius: "var(--wl-radius-lg)",
            border: "1px solid var(--wl-border-default)",
            background: "var(--wl-bg-surface)",
            color: "var(--wl-text-primary)",
            fontSize: "var(--wl-text-sm)",
            fontWeight: 600,
            fontFamily: "var(--wl-font-sans)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--wl-space-2)",
            transition: "all var(--wl-duration-fast) var(--wl-ease-default)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--wl-primary-500)";
            (e.currentTarget as HTMLAnchorElement).style.background = "var(--wl-bg-overlay)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--wl-border-default)";
            (e.currentTarget as HTMLAnchorElement).style.background = "var(--wl-bg-surface)";
          }}
        >
          Back to sign in
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-6)" }}>
      {/* Heading */}
      <div>
        <h2
          style={{
            fontSize: "var(--wl-text-2xl)",
            fontWeight: 700,
            color: "var(--wl-text-primary)",
            marginBottom: "var(--wl-space-1)",
            fontFamily: "var(--wl-font-sans)",
          }}
        >
          Reset password
        </h2>
        <p
          style={{
            fontSize: "var(--wl-text-sm)",
            color: "var(--wl-text-tertiary)",
            fontFamily: "var(--wl-font-sans)",
          }}
        >
          Enter your email address and we&apos;ll send you a link to reset your password
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-4)" }}>
        {/* Email Field */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-2)" }}>
          <label
            htmlFor="email"
            style={{
              fontSize: "var(--wl-text-sm)",
              fontWeight: 500,
              color: "var(--wl-text-primary)",
              fontFamily: "var(--wl-font-sans)",
            }}
          >
            Email address
          </label>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Mail
              size={18}
              style={{
                position: "absolute",
                left: "var(--wl-space-3)",
                color: "var(--wl-text-tertiary)",
                pointerEvents: "none",
              }}
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
              style={{
                width: "100%",
                padding: "var(--wl-space-3) var(--wl-space-3) var(--wl-space-3) 44px",
                borderRadius: "var(--wl-radius-lg)",
                border: emailError ? "1.5px solid var(--wl-danger-500)" : "1px solid var(--wl-border-default)",
                background: "var(--wl-bg-surface)",
                color: "var(--wl-text-primary)",
                fontSize: "var(--wl-text-sm)",
                fontFamily: "var(--wl-font-sans)",
                transition: "all var(--wl-duration-fast) var(--wl-ease-default)",
                outline: "none",
                opacity: isLoading ? 0.6 : 1,
              }}
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
            <span
              style={{
                fontSize: "var(--wl-text-xs)",
                color: "var(--wl-danger-400)",
                fontFamily: "var(--wl-font-sans)",
              }}
            >
              {emailError}
            </span>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: "var(--wl-space-3)",
              borderRadius: "var(--wl-radius-lg)",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              fontSize: "var(--wl-text-sm)",
              color: "var(--wl-danger-400)",
              fontFamily: "var(--wl-font-sans)",
              animation: "wl-fade-in 300ms var(--wl-ease-default) both",
            }}
          >
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          style={{
            padding: "var(--wl-space-3) var(--wl-space-4)",
            borderRadius: "var(--wl-radius-lg)",
            border: "none",
            background: isLoading
              ? "var(--wl-primary-600)"
              : "linear-gradient(135deg, var(--wl-primary-500) 0%, var(--wl-primary-600) 100%)",
            color: "var(--wl-text-inverse)",
            fontSize: "var(--wl-text-sm)",
            fontWeight: 600,
            fontFamily: "var(--wl-font-sans)",
            cursor: isLoading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--wl-space-2)",
            transition: "all var(--wl-duration-fast) var(--wl-ease-default)",
            opacity: isLoading ? 0.8 : 1,
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
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
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
      <div
        style={{
          textAlign: "center",
          fontSize: "var(--wl-text-sm)",
          color: "var(--wl-text-tertiary)",
          fontFamily: "var(--wl-font-sans)",
        }}
      >
        Remember your password?{" "}
        <Link
          href="/login"
          style={{
            color: "var(--wl-primary-400)",
            textDecoration: "none",
            fontWeight: 600,
            transition: "color var(--wl-duration-fast) var(--wl-ease-default)",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLAnchorElement).style.color = "var(--wl-primary-300)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLAnchorElement).style.color = "var(--wl-primary-400)";
          }}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
