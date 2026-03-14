"use client";

import { useState, useRef } from "react";
import { cn } from "../../../lib/utils";
import { Input } from "../../../components/ui/input";
import { Upload, X } from "lucide-react";
import type { OnboardingData, CompanySize } from "../types";

interface CompanyInfoProps {
  data: OnboardingData;
  onUpdate: (data: OnboardingData) => void;
}

const companySizes: { value: CompanySize; label: string }[] = [
  { value: "1-10", label: "1-10" },
  { value: "11-50", label: "11-50" },
  { value: "51-200", label: "51-200" },
  { value: "201-1000", label: "201-1k" },
  { value: "1000+", label: "1000+" },
];

export function CompanyInfo({ data, onUpdate }: CompanyInfoProps) {
  const [logoPreview, setLogoPreview] = useState<string | null>(
    data.companyLogo || null
  );
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setLogoPreview(result);
      onUpdate({ ...data, companyLogo: result });
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleLogoUpload(files[0]);
    }
  };

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-wl-text-primary m-0">
          Company information
        </h2>
        <p className="text-sm text-wl-text-secondary m-0">
          Tell us about your organization so we can personalize your workspace.
        </p>
      </div>

      {/* Company Name */}
      <div>
        <label className="block text-sm font-semibold text-wl-text-primary mb-2">
          Company Name
        </label>
        <input
          type="text"
          placeholder="Acme Logistics Inc."
          value={data.companyName}
          onChange={(e) => onUpdate({ ...data, companyName: e.target.value })}
          className={cn(
            "w-full px-4 py-2.5 rounded-lg text-sm",
            "bg-wl-bg-surface border border-wl-border-default",
            "text-wl-text-primary placeholder:text-wl-text-tertiary",
            "focus:border-wl-primary-500 focus:outline-none",
            "transition-all duration-200"
          )}
        />
      </div>

      {/* Company Website */}
      <div>
        <label className="block text-sm font-semibold text-wl-text-primary mb-2">
          Company Website <span className="text-wl-text-tertiary">(optional)</span>
        </label>
        <input
          type="url"
          placeholder="https://acmelogistics.com"
          value={data.companyWebsite}
          onChange={(e) => onUpdate({ ...data, companyWebsite: e.target.value })}
          className={cn(
            "w-full px-4 py-2.5 rounded-lg text-sm",
            "bg-wl-bg-surface border border-wl-border-default",
            "text-wl-text-primary placeholder:text-wl-text-tertiary",
            "focus:border-wl-primary-500 focus:outline-none",
            "transition-all duration-200"
          )}
        />
      </div>

      {/* Company Logo */}
      <div>
        <label className="block text-sm font-semibold text-wl-text-primary mb-2">
          Company Logo <span className="text-wl-text-tertiary">(optional)</span>
        </label>
        {logoPreview ? (
          <div className="relative inline-block">
            <img
              src={logoPreview}
              alt="Company logo"
              className="w-24 h-24 rounded-lg object-cover border border-wl-border-default"
            />
            <button
              onClick={() => {
                setLogoPreview(null);
                onUpdate({ ...data, companyLogo: null });
              }}
              className={cn(
                "absolute -top-2 -right-2 w-6 h-6 rounded-full",
                "bg-wl-danger-500 text-wl-text-inverse flex items-center justify-center",
                "hover:bg-wl-danger-600 transition-colors"
              )}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative w-full px-6 py-8 rounded-lg border-2 border-dashed",
              "flex flex-col items-center justify-center gap-2 cursor-pointer",
              "transition-all duration-200",
              dragActive
                ? "border-wl-primary-500 bg-wl-primary-500/10"
                : "border-wl-border-default bg-wl-bg-surface hover:border-wl-border-strong hover:bg-wl-bg-overlay"
            )}
          >
            <Upload
              className={cn(
                "w-5 h-5",
                dragActive ? "text-wl-primary-400" : "text-wl-text-tertiary"
              )}
            />
            <div className="text-center">
              <p className="text-sm font-semibold text-wl-text-primary m-0">
                Drag and drop your logo
              </p>
              <p className="text-xs text-wl-text-tertiary mt-1 m-0">
                or click to browse
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
              }}
              className="hidden"
            />
          </div>
        )}
      </div>

      {/* Company Size */}
      <div>
        <label className="block text-sm font-semibold text-wl-text-primary mb-3">
          Company Size
        </label>
        <div className="flex gap-2 flex-wrap">
          {companySizes.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onUpdate({ ...data, companySize: value })}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                data.companySize === value
                  ? "bg-wl-primary-500 text-wl-text-inverse border border-wl-primary-500"
                  : "bg-wl-bg-overlay border border-wl-border-default text-wl-text-secondary hover:border-wl-border-strong hover:text-wl-text-primary"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Phone Number */}
      <div>
        <label className="block text-sm font-semibold text-wl-text-primary mb-2">
          Phone Number <span className="text-wl-text-tertiary">(optional)</span>
        </label>
        <input
          type="tel"
          placeholder="+1 (555) 123-4567"
          value={data.phoneNumber}
          onChange={(e) => onUpdate({ ...data, phoneNumber: e.target.value })}
          className={cn(
            "w-full px-4 py-2.5 rounded-lg text-sm",
            "bg-wl-bg-surface border border-wl-border-default",
            "text-wl-text-primary placeholder:text-wl-text-tertiary",
            "focus:border-wl-primary-500 focus:outline-none",
            "transition-all duration-200"
          )}
        />
      </div>

      {/* Info Box */}
      <div className="p-4 rounded-lg bg-wl-primary-500/10 border border-wl-primary-500/20">
        <p className="text-xs text-wl-text-secondary leading-relaxed m-0">
          This information helps us personalize your Witylogix workspace and
          provide relevant features for your business type.
        </p>
      </div>
    </div>
  );
}
