"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Building2, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading: authLoading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [termsError, setTermsError] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push("/onboarding");
    }
  }, [isAuthenticated, authLoading, router]);

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
    setNameError("");
    setEmailError("");
    setPasswordError("");
    setConfirmError("");
    setCompanyError("");
    setTermsError("");
    setError("");

    if (!name.trim()) {
      setNameError("Full name is required");
      isValid = false;
    } else if (name.trim().length < 2) {
      setNameError("Name must be at least 2 characters");
      isValid = false;
    }

    if (!email) {
      setEmailError("Email is required");
      isValid = false;
    } else if (!email.includes("@")) {
      setEmailError("Please enter a valid email");
      isValid = false;
    }

    if (!companyName.trim()) {
      setCompanyError("Company name is required");
      isValid = false;
    } else if (companyName.trim().length < 2) {
      setCompanyError("Company name must be at least 2 characters");
      isValid = false;
    }

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

    if (!agreeTerms) {
      setTermsError("You must agree to the terms and conditions");
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
      await register({
        name,
        email,
        password,
        companyName,
      });

      // Redirect to onboarding on success
      router.push("/onboarding");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Registration failed. Please try again.";
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
          Create account
        </h2>
        <p
          style={{
            fontSize: "var(--wl-text-sm)",
            color: "var(--wl-text-tertiary)",
            fontFamily: "var(--wl-font-sans)",
          }}
        >
          Join Witylogix and start managing deliveries
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-4)" }}>
        {/* Name Field */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-2)" }}>
          <label
            htmlFor="name"
            style={{
              fontSize: "var(--wl-text-sm)",
              fontWeight: 500,
              color: "var(--wl-text-primary)",
              fontFamily: "var(--wl-font-sans)",
            }}
          >
            Full name
          </label>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <User
              size={18}
              style={{
                position: "absolute",
                left: "var(--wl-space-3)",
                color: "var(--wl-text-tertiary)",
                pointerEvents: "none",
              }}
            />
            <input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError("");
              }}
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "var(--wl-space-3) var(--wl-space-3) var(--wl-space-3) 44px",
                borderRadius: "var(--wl-radius-lg)",
                border: nameError ? "1.5px solid var(--wl-danger-500)" : "1px solid var(--wl-border-default)",
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
                  e.currentTarget.style.borderColor = nameError ? "var(--wl-danger-500)" : "var(--wl-primary-500)";
                  e.currentTarget.style.boxShadow = nameError
                    ? "0 0 0 3px rgba(239, 68, 68, 0.1)"
                    : "0 0 0 3px rgba(108, 99, 255, 0.1)";
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = nameError ? "var(--wl-danger-500)" : "1px solid var(--wl-border-default)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
          {nameError && (
            <span
              style={{
                fontSize: "var(--wl-text-xs)",
                color: "var(--wl-danger-400)",
                fontFamily: "var(--wl-font-sans)",
              }}
            >
              {nameError}
            </span>
          )}
        </div>

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

        {/* Company Name Field */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-2)" }}>
          <label
            htmlFor="company"
            style={{
              fontSize: "var(--wl-text-sm)",
              fontWeight: 500,
              color: "var(--wl-text-primary)",
              fontFamily: "var(--wl-font-sans)",
            }}
          >
            Company name
          </label>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Building2
              size={18}
              style={{
                position: "absolute",
                left: "var(--wl-space-3)",
                color: "var(--wl-text-tertiary)",
                pointerEvents: "none",
              }}
            />
            <input
              id="company"
              type="text"
              placeholder="Your Company Ltd."
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                setCompanyError("");
              }}
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "var(--wl-space-3) var(--wl-space-3) var(--wl-space-3) 44px",
                borderRadius: "var(--wl-radius-lg)",
                border: companyError ? "1.5px solid var(--wl-danger-500)" : "1px solid var(--wl-border-default)",
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
                  e.currentTarget.style.borderColor = companyError ? "var(--wl-danger-500)" : "var(--wl-primary-500)";
                  e.currentTarget.style.boxShadow = companyError
                    ? "0 0 0 3px rgba(239, 68, 68, 0.1)"
                    : "0 0 0 3px rgba(108, 99, 255, 0.1)";
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = companyError ? "var(--wl-danger-500)" : "1px solid var(--wl-border-default)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
          {companyError && (
            <span
              style={{
                fontSize: "var(--wl-text-xs)",
                color: "var(--wl-danger-400)",
                fontFamily: "var(--wl-font-sans)",
              }}
            >
              {companyError}
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

          {/* Password Strength Indicator */}
          {password && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-2)" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: "var(--wl-radius-full)",
                      background: i < strength.score ? strength.color : "var(--wl-border)",
                      transition: "all var(--wl-duration-fast) var(--wl-ease-default)",
                    }}
                  />
                ))}
              </div>
              <span
                style={{
                  fontSize: "var(--wl-text-xs)",
                  color: strength.color,
                  fontFamily: "var(--wl-font-sans)",
                  fontWeight: 500,
                }}
              >
                {strength.label} password
              </span>
            </div>
          )}
        </div>

        {/* Confirm Password Field */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-2)" }}>
          <label
            htmlFor="confirmPassword"
            style={{
              fontSize: "var(--wl-text-sm)",
              fontWeight: 500,
              color: "var(--wl-text-primary)",
              fontFamily: "var(--wl-font-sans)",
            }}
          >
            Confirm password
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
            {confirmPassword && password === confirmPassword && (
              <CheckCircle2
                size={18}
                style={{
                  position: "absolute",
                  right: "var(--wl-space-3)",
                  color: "var(--wl-success-500)",
                  pointerEvents: "none",
                }}
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
              style={{
                width: "100%",
                padding: "var(--wl-space-3) var(--wl-space-3) var(--wl-space-3) 44px",
                borderRadius: "var(--wl-radius-lg)",
                border:
                  confirmError || (confirmPassword && password !== confirmPassword)
                    ? "1.5px solid var(--wl-danger-500)"
                    : confirmPassword && password === confirmPassword
                      ? "1px solid var(--wl-success-500)"
                      : "1px solid var(--wl-border-default)",
                background: "var(--wl-bg-surface)",
                color: "var(--wl-text-primary)",
                fontSize: "var(--wl-text-sm)",
                fontFamily: "var(--wl-font-sans)",
                transition: "all var(--wl-duration-fast) var(--wl-ease-default)",
                outline: "none",
                opacity: isLoading ? 0.6 : 1,
                paddingRight: confirmPassword && password === confirmPassword ? 44 : "var(--wl-space-3)",
              }}
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
            <span
              style={{
                fontSize: "var(--wl-text-xs)",
                color: "var(--wl-danger-400)",
                fontFamily: "var(--wl-font-sans)",
              }}
            >
              {confirmError}
            </span>
          )}
        </div>

        {/* Terms & Conditions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-2)" }}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--wl-space-2)",
              cursor: isLoading ? "not-allowed" : "pointer",
              color: "var(--wl-text-secondary)",
              fontFamily: "var(--wl-font-sans)",
              fontSize: "var(--wl-text-sm)",
              userSelect: "none",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => {
                setAgreeTerms(e.target.checked);
                setTermsError("");
              }}
              disabled={isLoading}
              style={{
                width: 16,
                height: 16,
                marginTop: 2,
                cursor: isLoading ? "not-allowed" : "pointer",
                accentColor: "var(--wl-primary-500)",
                flexShrink: 0,
              }}
            />
            <span>
              I agree to the{" "}
              <a
                href="#"
                style={{
                  color: "var(--wl-primary-400)",
                  textDecoration: "none",
                }}
              >
                Terms & Conditions
              </a>{" "}
              and{" "}
              <a
                href="#"
                style={{
                  color: "var(--wl-primary-400)",
                  textDecoration: "none",
                }}
              >
                Privacy Policy
              </a>
            </span>
          </label>
          {termsError && (
            <span
              style={{
                fontSize: "var(--wl-text-xs)",
                color: "var(--wl-danger-400)",
                fontFamily: "var(--wl-font-sans)",
                marginTop: "-var(--wl-space-1)",
              }}
            >
              {termsError}
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
              Creating account...
            </>
          ) : (
            <>
              Create Account
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Sign In Link */}
      <div
        style={{
          textAlign: "center",
          fontSize: "var(--wl-text-sm)",
          color: "var(--wl-text-tertiary)",
          fontFamily: "var(--wl-font-sans)",
        }}
      >
        Already have an account?{" "}
        <Link
          href="/login"
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
          Sign in
        </Link>
      </div>
    </div>
  );
}
