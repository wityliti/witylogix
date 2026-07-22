"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Zap } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function MagicLinkPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"validating" | "success" | "error" | "expired">("validating");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  const token = searchParams.get("token");

  useEffect(() => {
    const validateAndConsume = async () => {
      if (!token) {
        setStatus("error");
        setError("No magic link token provided. Please request a new one.");
        return;
      }

      try {
        // Validate magic link
        const validateResponse = await fetch(`${API_URL}/auth/validate-magic-link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        if (!validateResponse.ok) {
          const data = await validateResponse.json().catch(() => ({}));
          if (validateResponse.status === 410) {
            setStatus("expired");
            setError("This magic link has expired or has already been used.");
          } else {
            setStatus("error");
            setError(data.message || "Invalid magic link");
          }
          return;
        }

        const validateData = await validateResponse.json();
        setEmail(validateData.email);

        // Consume magic link and authenticate
        const consumeResponse = await fetch(`${API_URL}/auth/consume-magic-link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        if (!consumeResponse.ok) {
          const data = await consumeResponse.json().catch(() => ({}));
          throw new Error(data.message || "Failed to authenticate");
        }

        const consumeData = await consumeResponse.json();

        // Store authentication token
        if (consumeData.token) {
          localStorage.setItem("authToken", consumeData.token);
          if (consumeData.refreshToken) {
            localStorage.setItem("refreshToken", consumeData.refreshToken);
          }
        }

        setStatus("success");

        // Redirect after 2 seconds
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } catch (err) {
        setStatus("error");
        const errorMessage = err instanceof Error ? err.message : "Authentication failed";
        setError(errorMessage);
      }
    };

    validateAndConsume();
  }, [token, router]);

  if (status === "validating") {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-wl-border-default border-t-wl-primary-500 animate-spin" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary mb-1">
            Verifying your magic link...
          </h2>
          <p className="text-sm text-wl-text-tertiary">
            Please wait while we authenticate you
          </p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="flex justify-center animate-in scale-in-95">
          <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 bg-opacity-10 bg-wl-success-500 border-wl-success-500">
            <CheckCircle2 size={36} color="var(--wl-success-500)" />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary mb-2">
            Successfully authenticated!
          </h2>
          <p className="text-sm text-wl-text-tertiary leading-relaxed">
            You will be redirected to your dashboard shortly.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="py-3 px-4 rounded-lg border-none text-wl-text-inverse text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            style={{
              background: "linear-gradient(135deg, var(--wl-primary-500) 0%, var(--wl-primary-600) 100%)",
              boxShadow: "0 4px 12px rgba(245, 166, 35, 0.25)",
            }}
          >
            Go to dashboard
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 bg-opacity-10 bg-wl-warning-500 border-wl-warning-500">
            <Zap size={36} color="var(--wl-warning-500)" />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary mb-2">
            Link expired or already used
          </h2>
          <p className="text-sm text-wl-text-tertiary leading-relaxed">
            {error || "This magic link has expired or has already been used. Please request a new one."}
          </p>
        </div>

        <Link
          href="/login?type=magic-link"
          className="py-3 px-4 rounded-lg border-none text-wl-text-inverse text-sm font-semibold flex items-center justify-center gap-2 transition-all"
          style={{
            background: "linear-gradient(135deg, var(--wl-primary-500) 0%, var(--wl-primary-600) 100%)",
            boxShadow: "0 4px 12px rgba(245, 166, 35, 0.25)",
          }}
        >
          Request new magic link
          <Zap size={16} />
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

  // Error state
  return (
    <div className="flex flex-col gap-6 text-center">
      <div className="flex justify-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 bg-opacity-10 bg-wl-danger-500 border-wl-danger-500">
          <AlertCircle size={36} color="var(--wl-danger-500)" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-wl-text-primary mb-2">
          Authentication failed
        </h2>
        <p className="text-sm text-wl-text-tertiary leading-relaxed">
          {error || "There was an error authenticating your magic link. Please try again."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Link
          href="/login"
          className="py-3 px-4 rounded-lg border-none text-wl-text-inverse text-sm font-semibold flex items-center justify-center gap-2 transition-all"
          style={{
            background: "linear-gradient(135deg, var(--wl-primary-500) 0%, var(--wl-primary-600) 100%)",
            boxShadow: "0 4px 12px rgba(245, 166, 35, 0.25)",
          }}
        >
          Back to sign in
          <ArrowRight size={16} />
        </Link>

        <Link
          href="/login?type=magic-link"
          className="py-3 px-4 rounded-lg border border-wl-border-default bg-wl-bg-surface text-wl-text-primary text-sm font-semibold flex items-center justify-center gap-2 transition-all no-underline"
        >
          Request new magic link
          <Zap size={16} />
        </Link>
      </div>
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen bg-wl-bg-root"><Loader2 size={32} className="animate-spin" style={{ color: "var(--wl-primary-500)" }} /></div>}>
      <MagicLinkPageInner />
    </Suspense>
  );
}
