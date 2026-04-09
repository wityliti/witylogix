"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Loader2, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function ResetPasswordPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);

  const token = searchParams.get("token");

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("No reset token provided. Please check your link.");
        setIsValidating(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/validate-reset-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || "Invalid or expired token");
        }

        setIsTokenValid(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Token validation failed";
        setError(errorMessage);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const calculatePasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[!@#$%^&*]/.test(pwd)) score++;

    if (score <= 1) return { score, label: "Weak", color: "var(--wl-danger-500)" };
    if (score <= 2) return { score, label: "Fair", color: "var(--wl-warning-500)" };
    if (score <= 3) return { score, label: "Good", color: "var(--wl-primary-500)" };
    return { score, label: "Strong", color: "var(--wl-success-500)" };
  };

  const strength = calculatePasswordStrength(password);

  const validateForm = () => {
    let isValid = true;
    setPasswordError("");
    setConfirmError("");
    setError("");

    if (!password) {
      setPasswordError("Password is required");
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmError("Please confirm your password");
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmError("Passwords do not match");
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
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to reset password");
      }

      setIsSuccess(true);

      // Redirect after 3 seconds
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Password reset failed";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isValidating) {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-wl-border border-t-wl-primary animate-spin" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary mb-1">
            Verifying link...
          </h2>
          <p className="text-sm text-wl-text-tertiary">
            Please wait while we validate your reset link
          </p>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!isTokenValid) {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 bg-opacity-10 bg-wl-danger-500 border-wl-danger-500">
            <AlertCircle size={36} color="var(--wl-danger-500)" />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary mb-2">
            Invalid or expired link
          </h2>
          <p className="text-sm text-wl-text-tertiary leading-relaxed">
            {error || "This password reset link is no longer valid. Please request a new one."}
          </p>
        </div>

        <Link
          href="/forgot-password"
          className="py-3 px-4 rounded-lg border-none text-wl-text-inverse text-sm font-semibold flex items-center justify-center gap-2 transition-all"
          style={{
            background: "linear-gradient(135deg, var(--wl-primary-500) 0%, var(--wl-primary-600) 100%)",
            boxShadow: "0 4px 12px rgba(108, 99, 255, 0.25)",
          }}
        >
          Request new reset link
          <ArrowRight size={16} />
        </Link>

        <Link
          href="/login"
          className="text-wl-primary-400 no-underline font-semibold transition-colors hover:text-wl-primary-300 text-sm"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="flex justify-center animate-in scale-in-95">
          <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 bg-opacity-10 bg-wl-success-500 border-wl-success-500">
            <CheckCircle2 size={36} color="var(--wl-success-500)" />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary mb-2">
            Password reset successful
          </h2>
          <p className="text-sm text-wl-text-tertiary leading-relaxed">
            Your password has been updated successfully. You will be redirected to the login page in a moment.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/login"
            className="py-3 px-4 rounded-lg border-none text-wl-text-inverse text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            style={{
              background: "linear-gradient(135deg, var(--wl-primary-500) 0%, var(--wl-primary-600) 100%)",
              boxShadow: "0 4px 12px rgba(108, 99, 255, 0.25)",
            }}
          >
            Sign in now
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  // Form state
  return (
    <div className="flex flex-col gap-6">
      {/* Heading */}
      <div>
        <h2 className="text-2xl font-bold text-wl-text-primary mb-1">
          Reset password
        </h2>
        <p className="text-sm text-wl-text-tertiary">
          Enter your new password below
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Password Field */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="password"
            className="text-sm font-medium text-wl-text-primary"
          >
            New password
          </label>
          <div className="relative flex items-center">
            <Lock
              size={18}
              className="absolute left-3 text-wl-text-tertiary pointer-events-none"
            />
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError("");
              }}
              disabled={isLoading}
              className={cn(
                "w-full py-3 px-3 pl-11 rounded-lg border text-sm bg-wl-bg-surface text-wl-text-primary transition-all outline-none",
                passwordError
                  ? "border-wl-danger-500 border-1.5"
                  : "border-wl-border-default",
                isLoading && "opacity-60"
              )}
              onFocus={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.borderColor = passwordError ? "var(--wl-danger-500)" : "var(--wl-primary-500)";
                  e.currentTarget.style.boxShadow = passwordError
                    ? "0 0 0 3px rgba(239, 68, 68, 0.1)"
                    : "0 0 0 3px rgba(108, 99, 255, 0.1)";
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = passwordError ? "var(--wl-danger-500)" : "1px solid var(--wl-border-default)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
          {passwordError && (
            <span className="text-xs text-wl-danger-400">
              {passwordError}
            </span>
          )}

          {/* Password Strength Indicator */}
          {password && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 h-1 rounded-full transition-all",
                      i < strength.score ? "bg-current" : "bg-wl-border"
                    )}
                    style={{
                      backgroundColor: i < strength.score ? strength.color : undefined,
                    }}
                  />
                ))}
              </div>
              <span
                className="text-xs font-medium"
                style={{
                  color: strength.color,
                }}
              >
                {strength.label} password
              </span>

              {/* Password Requirements Checklist */}
              <div className="mt-2 space-y-1 text-xs text-wl-text-tertiary">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-4 h-4 rounded flex items-center justify-center transition-all",
                    password.length >= 8 ? "bg-wl-success-500/20" : "bg-wl-border"
                  )}>
                    {password.length >= 8 && (
                      <CheckCircle2 size={12} className="text-wl-success-500" />
                    )}
                  </div>
                  At least 8 characters
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-4 h-4 rounded flex items-center justify-center transition-all",
                    /[a-z]/.test(password) && /[A-Z]/.test(password) ? "bg-wl-success-500/20" : "bg-wl-border"
                  )}>
                    {/[a-z]/.test(password) && /[A-Z]/.test(password) && (
                      <CheckCircle2 size={12} className="text-wl-success-500" />
                    )}
                  </div>
                  Uppercase and lowercase letters
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-4 h-4 rounded flex items-center justify-center transition-all",
                    /\d/.test(password) ? "bg-wl-success-500/20" : "bg-wl-border"
                  )}>
                    {/\d/.test(password) && (
                      <CheckCircle2 size={12} className="text-wl-success-500" />
                    )}
                  </div>
                  At least one number
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-4 h-4 rounded flex items-center justify-center transition-all",
                    /[!@#$%^&*]/.test(password) ? "bg-wl-success-500/20" : "bg-wl-border"
                  )}>
                    {/[!@#$%^&*]/.test(password) && (
                      <CheckCircle2 size={12} className="text-wl-success-500" />
                    )}
                  </div>
                  At least one special character (!@#$%^&*)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password Field */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-wl-text-primary"
          >
            Confirm password
          </label>
          <div className="relative flex items-center">
            <Lock
              size={18}
              className="absolute left-3 text-wl-text-tertiary pointer-events-none"
            />
            {confirmPassword && password === confirmPassword && (
              <CheckCircle2
                size={18}
                className="absolute right-3 text-wl-success-500 pointer-events-none"
              />
            )}
            <input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setConfirmError("");
              }}
              disabled={isLoading}
              className={cn(
                "w-full py-3 px-3 pl-11 rounded-lg border text-sm bg-wl-bg-surface text-wl-text-primary transition-all outline-none",
                confirmError || (confirmPassword && password !== confirmPassword)
                  ? "border-wl-danger-500 border-1.5"
                  : confirmPassword && password === confirmPassword
                    ? "border-wl-success-500"
                    : "border-wl-border-default",
                isLoading && "opacity-60",
                confirmPassword && password === confirmPassword ? "pr-11" : "pr-3"
              )}
              onFocus={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.borderColor =
                    confirmError || (confirmPassword && password !== confirmPassword)
                      ? "var(--wl-danger-500)"
                      : "var(--wl-primary-500)";
                  e.currentTarget.style.boxShadow =
                    confirmError || (confirmPassword && password !== confirmPassword)
                      ? "0 0 0 3px rgba(239, 68, 68, 0.1)"
                      : "0 0 0 3px rgba(108, 99, 255, 0.1)";
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
          {confirmError && (
            <span className="text-xs text-wl-danger-400">
              {confirmError}
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
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              Resetting password...
            </>
          ) : (
            <>
              Reset Password
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen bg-wl-bg"><Loader2 size={32} className="animate-spin" style={{ color: "var(--wl-primary, #6C63FF)" }} /></div>}>
      <ResetPasswordPageInner />
    </Suspense>
  );
}
