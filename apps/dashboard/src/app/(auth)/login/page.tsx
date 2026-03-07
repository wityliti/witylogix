"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--wl-bg)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--wl-space-4)",
          }}
        >
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
          <p style={{ color: "var(--wl-text)" }}>Loading...</p>
        </div>
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
          Welcome back
        </h2>
        <p
          style={{
            fontSize: "var(--wl-text-sm)",
            color: "var(--wl-text-tertiary)",
            fontFamily: "var(--wl-font-sans)",
          }}
        >
          Sign in to your Witylogix account
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
              placeholder="demo@witylogix.com"
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

        {/* Password Field */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-2)" }}>
          <label
            htmlFor="password"
            style={{
              fontSize: "var(--wl-text-sm)",
              fontWeight: 500,
              color: "var(--wl-text-primary)",
              fontFamily: "var(--wl-font-sans)",
            }}
          >
            Password
          </label>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Lock
              size={18}
              style={{
                position: "absolute",
                left: "var(--wl-space-3)",
                color: "var(--wl-text-tertiary)",
                pointerEvents: "none",
              }}
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
              style={{
                width: "100%",
                padding: "var(--wl-space-3) var(--wl-space-3) var(--wl-space-3) 44px",
                borderRadius: "var(--wl-radius-lg)",
                border: passwordError ? "1.5px solid var(--wl-danger-500)" : "1px solid var(--wl-border-default)",
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
            <span
              style={{
                fontSize: "var(--wl-text-xs)",
                color: "var(--wl-danger-400)",
                fontFamily: "var(--wl-font-sans)",
              }}
            >
              {passwordError}
            </span>
          )}
        </div>

        {/* Remember Me & Forgot Password */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "var(--wl-text-sm)",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--wl-space-2)",
              cursor: isLoading ? "not-allowed" : "pointer",
              color: "var(--wl-text-secondary)",
              fontFamily: "var(--wl-font-sans)",
              userSelect: "none",
              opacity: isLoading ? 0.6 : 1,
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
            style={{
              color: "var(--wl-primary-400)",
              textDecoration: "none",
              transition: "color var(--wl-duration-fast) var(--wl-ease-default)",
              fontFamily: "var(--wl-font-sans)",
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
      <div
        style={{
          padding: "var(--wl-space-3)",
          borderRadius: "var(--wl-radius-lg)",
          background: "rgba(59, 130, 246, 0.05)",
          border: "1px solid rgba(59, 130, 246, 0.15)",
          fontSize: "var(--wl-text-xs)",
          color: "var(--wl-text-tertiary)",
          fontFamily: "var(--wl-font-sans)",
          lineHeight: 1.6,
        }}
      >
        Demo credentials: <span style={{ color: "var(--wl-text-secondary)", fontWeight: 600 }}>demo@witylogix.com</span> / <span style={{ color: "var(--wl-text-secondary)", fontWeight: 600 }}>demo123</span>
      </div>

      {/* Sign Up Link */}
      <div
        style={{
          textAlign: "center",
          fontSize: "var(--wl-text-sm)",
          color: "var(--wl-text-tertiary)",
          fontFamily: "var(--wl-font-sans)",
        }}
      >
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          style={{
            color: "var(--wl-primary-400)",
            textDecoration: "none",
            fontWeight: 600,
            transition: "color var(--wl-duration-fast) var(--wl-ease-default)",
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
    <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "var(--wl-bg, #0a0a0f)" }}><Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--wl-primary, #6C63FF)" }} /></div>}>
      <LoginPageInner />
    </Suspense>
  );
}
