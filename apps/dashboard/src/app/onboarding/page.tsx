"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { VerifyEmail } from "./steps/verify-email";
import { ChooseDeployment } from "./steps/choose-deployment";
import { CompanyInfo } from "./steps/company-info";
import { IndustrySelect } from "./steps/industry-select";
import { GoalsSelect } from "./steps/goals-select";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import type {
  OnboardingData,
  OnboardingStep,
  OnboardingSubStep,
  DeploymentType,
  Industry,
  Goal,
} from "./types";

type MainStep = "verify-email" | "choose-deployment" | "configure-workspace";
type SubStep =
  | "company-info"
  | "industry"
  | "goals"
  | "integrations"
  | "dashboard-layout"
  | "data-import"
  | "review";

const mainSteps: { id: MainStep; label: string; description: string }[] = [
  { id: "verify-email", label: "Verify Email", description: "Confirm your email address" },
  { id: "choose-deployment", label: "Deployment", description: "Choose your setup" },
  { id: "configure-workspace", label: "Configure", description: "Customize workspace" },
];

const subSteps: { id: SubStep; label: string }[] = [
  { id: "company-info", label: "Company" },
  { id: "industry", label: "Industry" },
  { id: "goals", label: "Goals" },
  { id: "integrations", label: "Integrations" },
  { id: "dashboard-layout", label: "Dashboard" },
  { id: "data-import", label: "Import" },
  { id: "review", label: "Review" },
];

const initialData: OnboardingData = {
  email: "demo@witylogix.com",
  verificationCode: "",
  emailVerified: false,
  deploymentType: null,
  companyName: "",
  companyWebsite: "",
  companyLogo: null,
  companySize: null,
  phoneNumber: "",
  industry: null,
  industryCustom: "",
  goals: [],
  integrations: [],
  dashboardLayout: "",
  dataImport: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentMainStep, setCurrentMainStep] = useState<MainStep>("verify-email");
  const [currentSubStep, setCurrentSubStep] = useState<SubStep>("company-info");
  const [data, setData] = useState<OnboardingData>(initialData);

  // Initialize from URL params
  useEffect(() => {
    const step = searchParams.get("step") as MainStep;
    const sub = searchParams.get("sub") as SubStep;

    if (step && mainSteps.some((s) => s.id === step)) {
      setCurrentMainStep(step);
    }
    if (sub && subSteps.some((s) => s.id === sub)) {
      setCurrentSubStep(sub);
    }
  }, [searchParams]);

  // Update URL when step changes
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("step", currentMainStep);
    if (currentMainStep === "configure-workspace") {
      params.set("sub", currentSubStep);
    }
    window.history.replaceState({}, "", `?${params.toString()}`);
  }, [currentMainStep, currentSubStep]);

  // Calculate progress
  const mainStepIndex = mainSteps.findIndex((s) => s.id === currentMainStep);
  const totalMainSteps = mainSteps.length;
  const mainProgress = ((mainStepIndex + 1) / totalMainSteps) * 100;

  const subStepIndex =
    currentMainStep === "configure-workspace"
      ? subSteps.findIndex((s) => s.id === currentSubStep) + 1
      : 0;
  const totalSubSteps =
    currentMainStep === "configure-workspace" ? subSteps.length : 0;
  const overallProgress =
    currentMainStep === "configure-workspace"
      ? ((mainStepIndex + subStepIndex / totalSubSteps + 1) / totalMainSteps) *
        100
      : mainProgress;

  const handleNext = () => {
    if (currentMainStep === "verify-email" && data.emailVerified) {
      setCurrentMainStep("choose-deployment");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (currentMainStep === "choose-deployment" && data.deploymentType) {
      setCurrentMainStep("configure-workspace");
      setCurrentSubStep("company-info");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (currentMainStep === "configure-workspace") {
      const currentIndex = subSteps.findIndex((s) => s.id === currentSubStep);
      if (currentIndex < subSteps.length - 1) {
        setCurrentSubStep(subSteps[currentIndex + 1].id);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Complete onboarding
        handleComplete();
      }
    }
  };

  const handleBack = () => {
    if (currentMainStep === "configure-workspace") {
      const currentIndex = subSteps.findIndex((s) => s.id === currentSubStep);
      if (currentIndex > 0) {
        setCurrentSubStep(subSteps[currentIndex - 1].id);
      } else {
        setCurrentMainStep("choose-deployment");
      }
    } else if (currentMainStep === "choose-deployment") {
      setCurrentMainStep("verify-email");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSkip = () => {
    if (currentMainStep === "configure-workspace") {
      const currentIndex = subSteps.findIndex((s) => s.id === currentSubStep);
      if (currentIndex < subSteps.length - 1) {
        setCurrentSubStep(subSteps[currentIndex + 1].id);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  const handleComplete = () => {
    console.log("Onboarding complete:", data);
    // In real app, send data to backend
    router.push("/");
  };

  const isMainStepValid = (): boolean => {
    if (currentMainStep === "verify-email") return data.emailVerified;
    if (currentMainStep === "choose-deployment") return !!data.deploymentType;
    if (currentMainStep === "configure-workspace") {
      if (currentSubStep === "company-info") {
        return !!data.companyName && !!data.companySize;
      }
      if (currentSubStep === "industry") {
        return !!data.industry;
      }
      if (currentSubStep === "goals") {
        return data.goals.length > 0;
      }
      return true; // Other substeps are optional
    }
    return false;
  };

  const isLastStep =
    currentMainStep === "configure-workspace" &&
    currentSubStep === "review";

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        {/* Main Steps */}
        <div className="flex justify-between mb-6">
          {mainSteps.map((step, idx) => {
            const isCompleted =
              mainSteps.findIndex((s) => s.id === currentMainStep) > idx;
            const isActive = step.id === currentMainStep;

            return (
              <div
                key={step.id}
                className={cn("flex-1 flex flex-col items-center", idx < mainSteps.length - 1 ? "mr-3" : "")}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center mb-2 font-semibold text-sm transition-all duration-200",
                    isCompleted || isActive
                      ? "bg-wl-primary-500 text-wl-text-inverse"
                      : "bg-wl-bg-overlay text-wl-text-tertiary border border-wl-border-default"
                  )}
                >
                  {isCompleted ? <Check size={20} /> : idx + 1}
                </div>
                <div className="text-center">
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      isActive ? "text-wl-text-primary" : "text-wl-text-tertiary"
                    )}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Line */}
        <div className="w-full h-1 bg-wl-bg-overlay rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-wl-primary-500 transition-all duration-500"
            style={{
              width: `${Math.round(overallProgress)}%`,
            }}
          />
        </div>

        {/* Sub Steps (if Configure Workspace) */}
        {currentMainStep === "configure-workspace" && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {subSteps.map((step) => {
              const isActive = step.id === currentSubStep;
              const isCompleted = subSteps.findIndex((s) => s.id === currentSubStep) > subSteps.findIndex((s) => s.id === step.id);

              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentSubStep(step.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0",
                    isActive
                      ? "bg-wl-primary-500 text-wl-text-inverse"
                      : isCompleted
                        ? "bg-wl-success-500/20 text-wl-success-400 border border-wl-success-400/30"
                        : "bg-wl-bg-overlay text-wl-text-tertiary border border-wl-border-default hover:border-wl-border-strong"
                  )}
                >
                  {step.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content Card */}
      <div className="rounded-lg border border-wl-border-default bg-wl-bg-surface p-8 mb-6 animate-in fade-in duration-300">
        {/* Step Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-wl-text-primary m-0">
            {currentMainStep === "verify-email" && "Verify your email"}
            {currentMainStep === "choose-deployment" && "Choose deployment"}
            {currentMainStep === "configure-workspace" &&
              (subSteps.find((s) => s.id === currentSubStep)?.label || "")}
          </h1>
          <p className="text-sm text-wl-text-secondary mt-1 m-0">
            Step {mainStepIndex + 1} of {totalMainSteps}
            {currentMainStep === "configure-workspace" &&
              ` • Sub-step ${subStepIndex} of ${totalSubSteps}`}
          </p>
        </div>

        {/* Step Content */}
        {currentMainStep === "verify-email" && (
          <VerifyEmail
            data={data}
            onVerified={(updatedData) => setData(updatedData)}
          />
        )}

        {currentMainStep === "choose-deployment" && (
          <ChooseDeployment
            data={data}
            onSelect={(deploymentType) =>
              setData({ ...data, deploymentType })
            }
          />
        )}

        {currentMainStep === "configure-workspace" &&
          currentSubStep === "company-info" && (
            <CompanyInfo
              data={data}
              onUpdate={(updatedData) => setData(updatedData)}
            />
          )}

        {currentMainStep === "configure-workspace" &&
          currentSubStep === "industry" && (
            <IndustrySelect
              data={data}
              onSelect={(industry, custom) => {
                setData({ ...data, industry, industryCustom: custom || "" });
              }}
            />
          )}

        {currentMainStep === "configure-workspace" &&
          currentSubStep === "goals" && (
            <GoalsSelect
              data={data}
              onToggle={(goal) => {
                const newGoals = data.goals.includes(goal)
                  ? data.goals.filter((g) => g !== goal)
                  : [...data.goals, goal];
                setData({ ...data, goals: newGoals });
              }}
            />
          )}

        {currentMainStep === "configure-workspace" &&
          (currentSubStep === "integrations" ||
            currentSubStep === "dashboard-layout" ||
            currentSubStep === "data-import") && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div className="w-12 h-12 rounded-lg bg-wl-primary-500/20 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-wl-primary-500 border-t-transparent animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-wl-text-primary m-0">
                  Coming soon
                </h3>
                <p className="text-sm text-wl-text-secondary mt-1 m-0">
                  {currentSubStep === "integrations" && "Configure your integrations"}
                  {currentSubStep === "dashboard-layout" && "Customize your dashboard"}
                  {currentSubStep === "data-import" && "Import your data"}
                </p>
              </div>
            </div>
          )}

        {currentMainStep === "configure-workspace" &&
          currentSubStep === "review" && (
            <div className="flex flex-col gap-6 py-4">
              <div className="p-4 rounded-lg bg-wl-success-500/10 border border-wl-success-400/30">
                <p className="text-sm font-bold text-wl-success-400 m-0">
                  ✓ All setup complete!
                </p>
                <p className="text-xs text-wl-text-secondary mt-2 m-0">
                  Your workspace is ready. Click launch to start using Witylogix.
                </p>
              </div>
            </div>
          )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center gap-3">
        <Button
          variant="ghost"
          size="md"
          onClick={handleBack}
          disabled={currentMainStep === "verify-email"}
          className="flex items-center gap-2"
        >
          <ChevronLeft size={16} />
          Back
        </Button>

        <div className="flex gap-3">
          {!isLastStep && currentMainStep === "configure-workspace" && (
            <Button
              variant="secondary"
              size="md"
              onClick={handleSkip}
            >
              Skip
            </Button>
          )}

          {!isLastStep ? (
            <Button
              variant="primary"
              size="md"
              onClick={handleNext}
              disabled={!isMainStepValid()}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight size={16} />
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={handleComplete}
              className="flex items-center gap-2"
            >
              <Check size={16} />
              Launch Dashboard
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
