"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Load remembered email if available
  useEffect(() => {
    const rememberMeFlag = localStorage.getItem("rememberMe") === "true";
    const rememberedEmail = localStorage.getItem("rememberedEmail");

    if (rememberMeFlag && rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      const returnUrl = searchParams.get("returnUrl") || "/";
      router.push(returnUrl);
    }
  }, [isAuthenticated, authLoading, router, searchParams]);

  const validateForm = () => {
    let isValid = true;
    setEmailError("");
    setPasswordError("");
    setError("");

    if (!email) {
      setEmailError("Email is required");
      isValid = false;
    } else if (!email.includes("@")) {
      setEmailError("Please enter a valid email");
      isValid = false;
    }

    if (!password) {
      setPasswordError("Password is required");
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
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
      await login(email, password, rememberMe);
      const returnUrl = searchParams.get("returnUrl") || "/";
      router.push(returnUrl);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-wl-bg">
        <div className="flex flex-col items-center gap-4">
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "2px solid var(--wl-border)",
              borderTopColor: "var(--wl-primary)",
              animation: "spin 1s linear infinite",
            }}
          />
          <p className="text-wl-text">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Heading */}
      <div>
        <h2 className="text-2xl font-bold text-wl-text-primary mb-1">
          Welcome back
        </h2>
        <p className="text-sm text-wl-text-tertiary">
          Sign in to your Witylogix account
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
              placeholder="demo@witylogix.com"
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
                  : "border-wl-border-default"
              )}
              style={{
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
            <span className="text-xs text-wl-danger-400">
              {emailError}
            </span>
          )}
        </div>

        {/* Password Field */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="password"
            className="text-sm font-medium text-wl-text-primary"
          >
            Password
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
                  : "border-wl-border-default"
              )}
              style={{
                opacity: isLoading ? 0.6 : 1,
              }}
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
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between text-sm">
          <label
            className="flex items-center gap-2 cursor-pointer text-wl-text-secondary select-none"
            style={{
              opacity: isLoading ? 0.6 : 1,
              pointerEvents: isLoading ? "none" : "auto",
            }}
          >
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
              style={{
                width: 16,
                height: 16,
                cursor: isLoading ? "not-allowed" : "pointer",
                accentColor: "var(--wl-primary-500)",
              }}
            />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className="text-wl-primary-400 no-underline transition-colors"
            style={{
              pointerEvents: isLoading ? "none" : "auto",
              opacity: isLoading ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                (e.target as HTMLAnchorElement).style.color = "var(--wl-primary-300)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                (e.target as HTMLAnchorElement).style.color = "var(--wl-primary-400)";
              }
            }}
          >
            Forgot password?
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="p-3 rounded-lg bg-opacity-10 border border-opacity-20 text-sm text-wl-danger-400 bg-wl-danger-400 border-wl-danger-400"
            style={{
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
          className="py-3 px-4 rounded-lg border-none text-wl-text-inverse text-sm font-semibold flex items-center justify-center gap-2 transition-all"
          style={{
            background: isLoading
              ? "var(--wl-primary-600)"
              : "linear-gradient(135deg, var(--wl-primary-500) 0%, var(--wl-primary-600) 100%)",
            cursor: isLoading ? "not-allowed" : "pointer",
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
              Signing in...
            </>
          ) : (
            <>
              Sign In
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Demo Credentials Hint */}
      <div className="p-3 rounded-lg bg-opacity-5 border border-opacity-15 text-xs text-wl-text-tertiary bg-blue-400 border-blue-400" style={{ lineHeight: 1.6 }}>
        Demo credentials: <span className="text-wl-text-secondary font-semibold">demo@witylogix.com</span> / <span className="text-wl-text-secondary font-semibold">demo123</span>
      </div>

      {/* Sign Up Link */}
      <div className="text-center text-sm text-wl-text-tertiary">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="text-wl-primary-400 no-underline font-semibold transition-colors"
          style={{
            pointerEvents: isLoading ? "none" : "auto",
            opacity: isLoading ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              (e.target as HTMLAnchorElement).style.color = "var(--wl-primary-300)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              (e.target as HTMLAnchorElement).style.color = "var(--wl-primary-400)";
            }
          }}
        >
          Create one
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen bg-wl-bg"><Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--wl-primary, #6C63FF)" }} /></div>}>
      <LoginPageInner />
    </Suspense>
  );
}
