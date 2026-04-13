import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, AlertTriangle, Info as InfoIcon } from "lucide-react";

const meta = {
  title: "UI/Toast",
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

// Toast display component for stories (simulating the actual toast notification)
const ToastDisplay = ({
  type,
  title,
  message,
}: {
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
}) => {
  const typeConfig = {
    success: {
      bg: "bg-wl-success-bg",
      border: "border-wl-success-400",
      text: "text-wl-success-400",
      icon: <CheckCircle2 size={20} />,
    },
    error: {
      bg: "bg-wl-danger-bg",
      border: "border-wl-danger-400",
      text: "text-wl-danger-400",
      icon: <AlertCircle size={20} />,
    },
    warning: {
      bg: "bg-wl-warning-bg",
      border: "border-wl-warning-400",
      text: "text-wl-warning-400",
      icon: <AlertTriangle size={20} />,
    },
    info: {
      bg: "bg-wl-info-bg",
      border: "border-wl-info-400",
      text: "text-wl-info-400",
      icon: <InfoIcon size={20} />,
    },
  };

  const config = typeConfig[type];

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-md border ${config.bg} ${config.border} max-w-md`}
    >
      <div className={`flex-shrink-0 ${config.text}`}>{config.icon}</div>
      <div className="flex-1">
        <h3 className={`font-semibold text-sm ${config.text}`}>{title}</h3>
        {message && (
          <p className="text-sm text-wl-text-secondary mt-1">{message}</p>
        )}
      </div>
    </div>
  );
};

export const Success: Story = {
  render: () => (
    <ToastDisplay
      type="success"
      title="Success"
      message="Your action has been completed successfully."
    />
  ),
};

export const Error: Story = {
  render: () => (
    <ToastDisplay
      type="error"
      title="Error"
      message="Something went wrong. Please try again."
    />
  ),
};

export const Warning: Story = {
  render: () => (
    <ToastDisplay
      type="warning"
      title="Warning"
      message="This action requires your attention."
    />
  ),
};

export const InfoToast: Story = {
  render: () => (
    <ToastDisplay
      type="info"
      title="Info"
      message="Here is some helpful information."
    />
  ),
};

export const SuccessShort: Story = {
  render: () => <ToastDisplay type="success" title="Changes saved" />,
};

export const ErrorShort: Story = {
  render: () => <ToastDisplay type="error" title="Failed to save" />,
};

export const WithAction: Story = {
  render: () => (
    <div className="flex items-start gap-3 p-4 rounded-md border bg-wl-info-bg border-wl-info-400 max-w-md">
      <div className="flex-shrink-0 text-wl-info-400">
        <InfoIcon size={20} />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-sm text-wl-info-400">
          Update available
        </h3>
        <p className="text-sm text-wl-text-secondary mt-1">
          A new version is available for download.
        </p>
        <button className="mt-3 text-sm font-semibold text-wl-info-400 hover:underline">
          Download now
        </button>
      </div>
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <ToastDisplay
        type="success"
        title="Success"
        message="Your changes have been saved."
      />
      <ToastDisplay
        type="error"
        title="Error"
        message="An unexpected error occurred."
      />
      <ToastDisplay
        type="warning"
        title="Warning"
        message="Please review this action."
      />
      <ToastDisplay
        type="info"
        title="Info"
        message="This is an informational message."
      />
    </div>
  ),
};

export const Stack: Story = {
  render: () => (
    <div className="fixed bottom-4 right-4 space-y-2 max-w-sm pointer-events-none">
      <ToastDisplay
        type="info"
        title="Syncing..."
        message="Uploading your files"
      />
      <ToastDisplay
        type="success"
        title="Upload complete"
        message="3 files uploaded successfully"
      />
      <ToastDisplay
        type="warning"
        title="Storage warning"
        message="You have 1GB left"
      />
    </div>
  ),
};
