"use client";

import { forwardRef, useRef, useState, useEffect, type HTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerificationCodeInputProps extends HTMLAttributes<HTMLDivElement> {
  onComplete?: (code: string) => void;
  error?: boolean;
  loading?: boolean;
  disabled?: boolean;
  length?: number;
}

const VerificationCodeInput = forwardRef<HTMLDivElement, VerificationCodeInputProps>(
  ({
    onComplete,
    error = false,
    loading = false,
    disabled = false,
    length = 6,
    className,
    ...props
  }, ref) => {
    const [codes, setCodes] = useState<string[]>(Array(length).fill(""));
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [success, setSuccess] = useState(false);

    // Focus first input on mount
    useEffect(() => {
      inputRefs.current[0]?.focus();
    }, []);

    // Handle completion
    useEffect(() => {
      if (codes.every((code) => code !== "")) {
        const fullCode = codes.join("");
        onComplete?.(fullCode);
      }
    }, [codes, onComplete]);

    // Reset success state when error changes
    useEffect(() => {
      if (!error) {
        setSuccess(false);
      }
    }, [error]);

    const handleInputChange = (index: number, value: string) => {
      if (disabled) return;

      // Only allow digits
      const digit = value.replace(/[^0-9]/g, "");
      if (digit.length > 1) {
        // Handle paste
        const pastedDigits = digit.slice(0, length - index);
        const newCodes = [...codes];
        pastedDigits.split("").forEach((d, i) => {
          if (index + i < length) {
            newCodes[index + i] = d;
          }
        });
        setCodes(newCodes);

        // Move focus to next available field
        const nextIndex = Math.min(index + pastedDigits.length, length - 1);
        setActiveIndex(nextIndex);
        setTimeout(() => {
          inputRefs.current[nextIndex]?.focus();
        }, 0);
      } else {
        const newCodes = [...codes];
        newCodes[index] = digit;
        setCodes(newCodes);

        // Auto-focus next input
        if (digit && index < length - 1) {
          setActiveIndex(index + 1);
          setTimeout(() => {
            inputRefs.current[index + 1]?.focus();
          }, 0);
        }
      }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        if (codes[index]) {
          // Clear current field
          const newCodes = [...codes];
          newCodes[index] = "";
          setCodes(newCodes);
        } else if (index > 0) {
          // Move to previous field
          setActiveIndex(index - 1);
          inputRefs.current[index - 1]?.focus();
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        setActiveIndex(index - 1);
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === "ArrowRight" && index < length - 1) {
        e.preventDefault();
        setActiveIndex(index + 1);
        inputRefs.current[index + 1]?.focus();
      }
    };

    const handleFocus = (index: number) => {
      setActiveIndex(index);
    };

    return (
      <>
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
          }
          .code-input-shake {
            animation: shake 0.5s ease-in-out;
          }
          @keyframes pulse-success {
            0% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.1);
            }
            100% {
              transform: scale(1);
            }
          }
          .code-input-success {
            animation: pulse-success 0.5s ease-out;
          }
        `}</style>
        <div
        ref={ref}
        className={cn(
          "w-full space-y-4",
          className
        )}
        {...props}
      >
        {/* Code input boxes */}
        <div
          className={cn(
            "flex gap-2 md:gap-3 justify-center",
            error && !success && "code-input-shake"
          )}
        >
          {Array.from({ length }).map((_, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={codes[index]}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onFocus={() => handleFocus(index)}
              disabled={disabled || loading}
              className={cn(
                "w-12 h-14 md:w-14 md:h-16 flex-shrink-0",
                "rounded-lg border-2 text-center text-xl md:text-2xl font-semibold",
                "bg-wl-bg-overlay transition-all duration-base",
                "focus:outline-none focus:ring-2 focus:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                activeIndex === index && !disabled && !loading
                  ? "border-wl-primary-500 focus:ring-wl-primary-500/50"
                  : "border-wl-border-subtle",
                loading && "border-wl-primary-500/50",
                success && "code-input-success bg-wl-success-500/10 border-wl-success-500 text-wl-success-400",
                error && !success && "bg-wl-danger-bg border-wl-danger-500 text-wl-danger-400",
                codes[index] && !error && !success && "bg-wl-primary-500/5 text-wl-text-primary",
                !codes[index] && !error && !success && "text-wl-text-tertiary"
              )}
            />
          ))}
        </div>

        {/* Status messages */}
        {loading && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-wl-primary-500 animate-pulse" />
            <p className="text-sm text-wl-text-secondary">Verifying code...</p>
          </div>
        )}

        {error && !success && (
          <div className="text-center">
            <p className="text-sm font-semibold text-wl-danger-400">
              Invalid verification code
            </p>
            <p className="text-xs text-wl-text-tertiary mt-1">
              Please try again
            </p>
          </div>
        )}

        {success && (
          <div className="flex items-center justify-center gap-2">
            <Check className="w-5 h-5 text-wl-success-400" strokeWidth={3} />
            <p className="text-sm font-semibold text-wl-success-400">
              Code verified successfully
            </p>
          </div>
        )}

        {/* Helper text */}
        {!error && !loading && !success && (
          <p className="text-center text-xs text-wl-text-tertiary">
            Enter the {length}-digit code sent to your email
          </p>
        )}
        </div>
      </>
    );
  }
);

VerificationCodeInput.displayName = "VerificationCodeInput";

export { VerificationCodeInput };
export type { VerificationCodeInputProps };
