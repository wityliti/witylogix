import type { Meta, StoryObj } from "@storybook/react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const meta = {
  title: "UI/LoadingSpinner",
  component: LoadingSpinner,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg", "xl"],
    },
    variant: {
      control: "select",
      options: ["spinner", "dots", "pulse", "bars"],
    },
    color: {
      control: "select",
      options: ["primary", "secondary", "white"],
    },
    overlay: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof LoadingSpinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: "md",
    variant: "spinner",
    color: "primary",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
  },
};

export const Medium: Story = {
  args: {
    size: "md",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
  },
};

export const ExtraLarge: Story = {
  args: {
    size: "xl",
  },
};

export const SpinnerVariant: Story = {
  args: {
    variant: "spinner",
    size: "md",
  },
};

export const DotsVariant: Story = {
  args: {
    variant: "dots",
    size: "md",
  },
};

export const PulseVariant: Story = {
  args: {
    variant: "pulse",
    size: "md",
  },
};

export const BarsVariant: Story = {
  args: {
    variant: "bars",
    size: "md",
  },
};

export const WithLabel: Story = {
  args: {
    label: "Loading...",
    size: "md",
  },
};

export const WithLabelLarge: Story = {
  args: {
    label: "Please wait while we load your data",
    size: "lg",
  },
};

export const SecondaryColor: Story = {
  args: {
    color: "secondary",
    size: "lg",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8 max-w-lg">
      <div className="flex flex-col items-center gap-4">
        <h3 className="text-sm font-semibold text-wl-text-primary">Spinner</h3>
        <LoadingSpinner variant="spinner" size="lg" />
      </div>

      <div className="flex flex-col items-center gap-4">
        <h3 className="text-sm font-semibold text-wl-text-primary">Dots</h3>
        <LoadingSpinner variant="dots" size="lg" />
      </div>

      <div className="flex flex-col items-center gap-4">
        <h3 className="text-sm font-semibold text-wl-text-primary">Pulse</h3>
        <LoadingSpinner variant="pulse" size="lg" />
      </div>

      <div className="flex flex-col items-center gap-4">
        <h3 className="text-sm font-semibold text-wl-text-primary">Bars</h3>
        <LoadingSpinner variant="bars" size="lg" />
      </div>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-end gap-8">
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs text-wl-text-secondary">Small</span>
        <LoadingSpinner size="sm" />
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-xs text-wl-text-secondary">Medium</span>
        <LoadingSpinner size="md" />
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-xs text-wl-text-secondary">Large</span>
        <LoadingSpinner size="lg" />
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-xs text-wl-text-secondary">XL</span>
        <LoadingSpinner size="xl" />
      </div>
    </div>
  ),
};

export const InlineWithText: Story = {
  render: () => (
    <div className="space-y-4 max-w-md">
      <div className="flex items-center gap-2">
        <LoadingSpinner size="sm" />
        <span className="text-sm text-wl-text-secondary">
          Loading results...
        </span>
      </div>

      <div className="flex items-center gap-2">
        <LoadingSpinner size="sm" variant="dots" />
        <span className="text-sm text-wl-text-secondary">Fetching data...</span>
      </div>

      <div className="flex items-center gap-2">
        <LoadingSpinner size="sm" variant="dots" color="secondary" />
        <span className="text-sm text-wl-text-secondary">Processing...</span>
      </div>
    </div>
  ),
};

export const OverlayMode: Story = {
  render: () => (
    <div className="relative w-full h-96 bg-wl-bg-surface rounded-lg border border-wl-border-subtle flex items-center justify-center">
      <p className="text-wl-text-secondary">Content behind overlay</p>
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 rounded-lg">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" variant="spinner" color="white" />
          <p className="text-sm font-medium text-white">Loading...</p>
        </div>
      </div>
    </div>
  ),
};
