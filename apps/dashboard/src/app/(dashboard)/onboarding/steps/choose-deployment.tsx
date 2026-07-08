"use client";

import { cn } from "@/lib/utils";
import { Cloud, Server, Check, Zap, Lock, TrendingUp } from "lucide-react";
import type { OnboardingData, DeploymentType } from "../types";

interface ChooseDeploymentProps {
  data: OnboardingData;
  onSelect: (deploymentType: DeploymentType) => void;
}

const deploymentOptions = [
  {
    id: "cloud" as DeploymentType,
    title: "Cloud (SaaS)",
    subtitle: "Fully managed, ready in minutes",
    icon: Cloud,
    color: "from-wl-success-500 to-wl-success-600",
    borderColor: "border-wl-success-400/30 hover:border-wl-success-400/60",
    features: [
      "Instant setup & deployment",
      "Automatic updates & maintenance",
      "99.9% uptime SLA",
      "Built-in security & compliance",
    ],
  },
  {
    id: "self-managed" as DeploymentType,
    title: "Self-Managed",
    subtitle: "Deploy on your cloud or on-premise",
    icon: Server,
    color: "from-wl-primary-500 to-wl-primary-600",
    borderColor: "border-wl-primary-400/30 hover:border-wl-primary-400/60",
    features: [
      "Full control over infrastructure",
      "Deploy anywhere (AWS, GCP, on-prem)",
      "Data stays within your network",
      "Advanced customization options",
    ],
  },
];

export function ChooseDeployment({ data, onSelect }: ChooseDeploymentProps) {
  const selected = data.deploymentType;

  return (
    <div className="flex flex-col gap-8 py-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-wl-text-primary m-0">
          Choose your deployment model
        </h2>
        <p className="text-sm text-wl-text-secondary m-0">
          Select how you'd like to deploy Witylogix. You can change this later
          from settings.
        </p>
      </div>

      {/* Deployment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {deploymentOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = selected === option.id;

          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={cn(
                "relative p-6 rounded-lg border-2 transition-all duration-300",
                "text-left cursor-pointer group",
                "bg-wl-bg-surface/50 backdrop-blur-sm",
                isSelected
                  ? `border-wl-primary-500 ${option.borderColor} shadow-lg`
                  : `${option.borderColor}`,
                "hover:shadow-md active:scale-98",
              )}
            >
              {/* Checkmark */}
              {isSelected && (
                <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-wl-primary-500 flex items-center justify-center">
                  <Check className="w-4 h-4 text-wl-text-inverse" />
                </div>
              )}

              {/* Icon */}
              <div
                className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center mb-4",
                  `bg-gradient-to-br ${option.color}`,
                  isSelected && "shadow-lg",
                )}
              >
                <Icon className="w-6 h-6 text-wl-text-inverse" />
              </div>

              {/* Title & Subtitle */}
              <div className="mb-4">
                <h3 className="font-bold text-wl-text-primary m-0">
                  {option.title}
                </h3>
                <p className="text-xs text-wl-text-tertiary mt-1 m-0">
                  {option.subtitle}
                </p>
              </div>

              {/* Features List */}
              <ul className="space-y-2">
                {option.features.map((feature, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-wl-text-secondary"
                  >
                    <span className="w-1 h-1 rounded-full bg-wl-text-tertiary flex-shrink-0 mt-1.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Hover Highlight */}
              {!isSelected && (
                <div
                  className={cn(
                    "absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100",
                    "transition-opacity duration-300 pointer-events-none",
                    "bg-gradient-to-br from-wl-primary-500/5 to-transparent",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Comparison Info */}
      {selected && (
        <div className="p-4 rounded-lg bg-wl-primary-500/10 border border-wl-primary-500/20 animate-in fade-in duration-300">
          <div className="flex gap-2 items-start">
            <Zap className="w-4 h-4 text-wl-primary-400 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-wl-text-primary m-0">
                {selected === "cloud"
                  ? "Cloud deployment is perfect for getting started quickly"
                  : "Self-managed deployment gives you maximum flexibility"}
              </p>
              <p className="text-xs text-wl-text-secondary m-0">
                {selected === "cloud"
                  ? "Zero infrastructure management. Focus on your business while we handle the rest."
                  : "Deploy on AWS, Google Cloud, Microsoft Azure, or your own datacenter."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Requirements Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-wl-info-400" />
            <span className="font-semibold text-wl-text-primary">Security</span>
          </div>
          <p className="text-wl-text-tertiary m-0">
            Both options include enterprise-grade security, encryption, and
            compliance certifications.
          </p>
        </div>
        <div className="p-3 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-wl-success-400" />
            <span className="font-semibold text-wl-text-primary">Scale</span>
          </div>
          <p className="text-wl-text-tertiary m-0">
            Start small and scale up as your business grows. No vendor lock-in.
          </p>
        </div>
      </div>
    </div>
  );
}
