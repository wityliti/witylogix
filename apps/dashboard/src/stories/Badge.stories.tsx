import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const meta = {
  title: "UI/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "success", "warning", "danger", "info", "primary"],
    },
    dot: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: "default",
    children: "Default",
  },
};

export const Success: Story = {
  args: {
    variant: "success",
    children: "Success",
  },
};

export const Warning: Story = {
  args: {
    variant: "warning",
    children: "Warning",
  },
};

export const Danger: Story = {
  args: {
    variant: "danger",
    children: "Danger",
  },
};

export const Info: Story = {
  args: {
    variant: "info",
    children: "Info",
  },
};

export const Primary: Story = {
  args: {
    variant: "primary",
    children: "Primary",
  },
};

export const WithDot: Story = {
  args: {
    variant: "success",
    dot: true,
    children: "Online",
  },
};

export const WithIcon: Story = {
  args: {
    variant: "danger",
    children: (
      <div className="flex items-center gap-1">
        <span>Error</span>
        <X size={12} />
      </div>
    ),
  },
};

export const Removable: Story = {
  args: {
    variant: "primary",
    className: "cursor-pointer hover:opacity-80",
    children: (
      <div className="flex items-center gap-1">
        <span>Tag</span>
        <button
          onClick={() => alert("Badge removed")}
          className="ml-1 hover:scale-110 transition-transform"
        >
          <X size={14} />
        </button>
      </div>
    ),
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Badge variant="default">Default</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
      </div>
      <div className="flex gap-2">
        <Badge variant="danger">Danger</Badge>
        <Badge variant="info">Info</Badge>
        <Badge variant="primary">Primary</Badge>
      </div>
      <div className="flex gap-2">
        <Badge variant="success" dot>
          Online
        </Badge>
        <Badge variant="warning" dot>
          Pending
        </Badge>
        <Badge variant="danger" dot>
          Offline
        </Badge>
      </div>
    </div>
  ),
};
