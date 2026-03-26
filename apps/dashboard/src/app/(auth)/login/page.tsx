"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Loader2, ArrowRight, Chrome, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState(process.env.NODE_ENV === "development" ? "admin@demo.witylogix.io" : "");
  const [password, setPassword] = useState(process.env.NODE_ENV === "development" ? "Admin123!" : "");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showMagicLinkOption, setShowMagicLinkOption] = useState(false);

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
      const returnUrl = searchParams.get("redirect") || searchParams.get("returnUrl") || "/";
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
      const returnUrl = searchParams.get("redirect") || searchParams.get("returnUrl") || "/";
      router.push(returnUrl);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // TODO: Implement Google OAuth
    setError("Google login coming soon");
  };

  const handleMicrosoftLogin = () => {
    // TODO: Implement Microsoft OAuth
    setError("Microsoft login coming soon");
  };

  const handleMagicLink = () => {
    if (!email) {
      setEmailError("Please enter your email address");
      return;
    }
    router.push(`/forgot-password?email=${encodeURIComponent(email)}&type=magic-link`);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-wl-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-wl-border border-t-wl-primary animate-spin" />
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
              placeholder="your@email.com"
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
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between text-sm">
          <label
            className={cn(
              "flex items-center gap-2 cursor-pointer text-wl-text-secondary select-none",
              isLoading && "opacity-60 pointer-events-none"
            )}
          >
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
              className={cn(isLoading && "cursor-not-allowed")}
              style={{
                accentColor: "var(--wl-primary-500)",
              }}
            />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className={cn(
              "text-wl-primary-400 no-underline transition-colors hover:text-wl-primary-300",
              isLoading && "opacity-60 pointer-events-none"
            )}
          >
            Forgot password?
          </Link>
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

      {/* Social Login Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-wl-border-subtle" />
        <span className="text-xs text-wl-text-tertiary">Or continue with</span>
        <div className="flex-1 h-px bg-wl-border-subtle" />
      </div>

      {/* Social Login Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className={cn(
            "py-3 px-4 rounded-lg border border-wl-border-default bg-wl-bg-surface text-wl-text-primary text-sm font-semibold flex items-center justify-center gap-2 transition-all",
            isLoading && "opacity-60 cursor-not-allowed"
          )}
          onMouseEnter={(e) => {
            if (!isLoading) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--wl-primary-500)";
              (e.currentTarget as HTMLButtonElement).style.background = "var(--wl-bg-overlay)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--wl-border-default)";
              (e.currentTarget as HTMLButtonElement).style.background = "var(--wl-bg-surface)";
            }
          }}
        >
          <Chrome size={16} />
          <span className="hidden sm:inline">Google</span>
        </button>

        <button
          type="button"
          onClick={handleMicrosoftLogin}
          disabled={isLoading}
          className={cn(
            "py-3 px-4 rounded-lg border border-wl-border-default bg-wl-bg-surface text-wl-text-primary text-sm font-semibold flex items-center justify-center gap-2 transition-all",
            isLoading && "opacity-60 cursor-not-allowed"
          )}
          onMouseEnter={(e) => {
            if (!isLoading) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--wl-primary-500)";
              (e.currentTarget as HTMLButtonElement).style.background = "var(--wl-bg-overlay)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--wl-border-default)";
              (e.currentTarget as HTMLButtonElement).style.background = "var(--wl-bg-surface)";
            }
          }}
        >
          <Chrome size={16} />
          <span className="hidden sm:inline">Microsoft</span>
        </button>
      </div>

      {/* Magic Link Option */}
      <button
        type="button"
        onClick={() => setShowMagicLinkOption(!showMagicLinkOption)}
        className="text-center text-xs text-wl-text-tertiary hover:text-wl-primary-400 transition-colors"
      >
        {showMagicLinkOption ? "Back to password" : "Sign in with magic link"}
      </button>

      {showMagicLinkOption && (
        <button
          type="button"
          onClick={handleMagicLink}
          disabled={isLoading || !email}
          className={cn(
            "py-3 px-4 rounded-lg border border-wl-border-default bg-wl-bg-surface text-wl-text-primary text-sm font-semibold flex items-center justify-center gap-2 transition-all",
            (isLoading || !email) && "opacity-60 cursor-not-allowed"
          )}
        >
          <Zap size={16} />
          Send Magic Link
        </button>
      )}


      {/* Sign Up Link */}
      <div className="text-center text-sm text-wl-text-tertiary">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className={cn(
            "text-wl-primary-400 no-underline font-semibold transition-colors hover:text-wl-primary-300",
            isLoading && "opacity-60 pointer-events-none"
          )}
        >
          Create one
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen bg-wl-bg"><Loader2 size={32} className="animate-spin" style={{ color: "var(--wl-primary, #6C63FF)" }} /></div>}>
      <LoginPageInner />
    </Suspense>
  );
}
