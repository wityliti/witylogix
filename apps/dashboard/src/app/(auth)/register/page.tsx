"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Building2, Loader2, ArrowRight, CheckCircle2, Chrome } from "lucide-react";
import { cn } from "@/lib/utils";
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

  const handleGoogleSignup = () => {
    // TODO: Implement Google OAuth
    setError("Google signup coming soon");
  };

  const handleMicrosoftSignup = () => {
    // TODO: Implement Microsoft OAuth
    setError("Microsoft signup coming soon");
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-wl-bg-root">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-full border-2 border-wl-border-default border-t-wl-primary-500 animate-spin"
          />

          <p className="text-wl-text-primary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Heading */}
      <div>
        <h2 className="text-2xl font-bold text-wl-text-primary mb-1">
          Create account
        </h2>
        <p className="text-sm text-wl-text-tertiary">
          Join Witylogix and start managing deliveries
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name Field */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="name"
            className="text-sm font-medium text-wl-text-primary"
          >
            Full name
          </label>
          <div className="relative flex items-center">
            <User
              size={18}
              className="absolute left-3 text-wl-text-tertiary pointer-events-none"
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
              className={cn(
                "w-full py-3 px-3 pl-11 rounded-lg border text-sm bg-wl-bg-surface text-wl-text-primary transition-all outline-none",
                nameError
                  ? "border-wl-danger-500 border-1.5"
                  : "border-wl-border-default",
                isLoading && "opacity-60"
              )}

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
            <span className="text-xs text-wl-danger-400">
              {nameError}
            </span>
          )}
        </div>

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

        {/* Company Name Field */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="company"
            className="text-sm font-medium text-wl-text-primary"
          >
            Company name
          </label>
          <div className="relative flex items-center">
            <Building2
              size={18}
              className="absolute left-3 text-wl-text-tertiary pointer-events-none"
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
              className={cn(
                "w-full py-3 px-3 pl-11 rounded-lg border text-sm bg-wl-bg-surface text-wl-text-primary transition-all outline-none",
                companyError
                  ? "border-wl-danger-500 border-1.5"
                  : "border-wl-border-default",
                isLoading && "opacity-60"
              )}

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
            <span className="text-xs text-wl-danger-400">
              {companyError}
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

        {/* Terms & Conditions */}
        <div className="flex flex-col gap-2">
          <label
            className={cn(
              "flex items-start gap-2 text-sm text-wl-text-secondary select-none cursor-pointer",
              isLoading && "opacity-60 cursor-not-allowed"
            )}
          >

            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => {
                setAgreeTerms(e.target.checked);
                setTermsError("");
              }}
              disabled={isLoading}
              className={cn(
                "w-4 h-4 mt-0.5 flex-shrink-0",
                isLoading ? "cursor-not-allowed" : "cursor-pointer"
              )}
              style={{
                accentColor: "var(--wl-primary-500)",
              }}
            />

            <span>
              I agree to the{" "}
              <a
                href="#"
                className="text-wl-primary-400 no-underline"
              >
                Terms & Conditions
              </a>{" "}
              and{" "}
              <a
                href="#"
                className="text-wl-primary-400 no-underline"
              >
                Privacy Policy
              </a>
            </span>
          </label>
          {termsError && (
            <span className="text-xs text-wl-danger-400 -mt-1">
              {termsError}
            </span>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="p-3 rounded-lg bg-wl-danger-400/10 border border-wl-danger-400/20 text-sm text-wl-danger-400 animate-in"
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
          className={cn(
            "py-3 px-4 rounded-lg border-none text-wl-text-inverse text-sm font-semibold flex items-center justify-center gap-2 transition-all",
            isLoading ? "opacity-80 cursor-not-allowed" : "cursor-pointer hover:shadow-lg hover:-translate-y-0.5"
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

      {/* Social Signup Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-wl-border-subtle" />
        <span className="text-xs text-wl-text-tertiary">Or sign up with</span>
        <div className="flex-1 h-px bg-wl-border-subtle" />
      </div>

      {/* Social Signup Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleGoogleSignup}
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
          onClick={handleMicrosoftSignup}
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

      {/* Sign In Link */}
      <div className="text-center text-sm text-wl-text-tertiary">
        Already have an account?{" "}
        <Link
          href="/login"
          className={cn(
            "text-wl-primary-400 no-underline font-semibold transition-colors hover:text-wl-primary-300",
            isLoading && "opacity-60 pointer-events-none"
          )}
        >
          Sign in
        </Link>
      </div>

    </div>
  );
}
