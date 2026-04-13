import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "@/components/ui/input";
import { Mail, Lock, Search as SearchIcon } from "lucide-react";

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
    disabled: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "Enter text...",
  },
};

export const WithLabel: Story = {
  args: {
    label: "Email Address",
    placeholder: "user@example.com",
  },
};

export const Email: Story = {
  args: {
    type: "email",
    label: "Email",
    placeholder: "user@example.com",
    icon: <Mail size={16} />,
  },
};

export const Password: Story = {
  args: {
    type: "password",
    label: "Password",
    placeholder: "Enter password",
    icon: <Lock size={16} />,
  },
};

export const SearchInput: Story = {
  args: {
    type: "search",
    placeholder: "Search...",
    icon: <SearchIcon size={16} />,
  },
};

export const WithPrefix: Story = {
  args: {
    label: "Price",
    placeholder: "0.00",
    icon: <span className="text-wl-text-secondary">$</span>,
  },
};

export const WithHint: Story = {
  args: {
    label: "Username",
    placeholder: "Choose a username",
    hint: "3-20 characters, alphanumeric only",
  },
};

export const WithError: Story = {
  args: {
    label: "Email",
    placeholder: "user@example.com",
    error: "Invalid email address",
    value: "invalid",
  },
};

export const Disabled: Story = {
  args: {
    label: "Disabled Input",
    placeholder: "Cannot edit",
    disabled: true,
    value: "Disabled value",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    placeholder: "Small input",
  },
};

export const Medium: Story = {
  args: {
    size: "md",
    placeholder: "Medium input",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    placeholder: "Large input",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-6 w-full max-w-md">
      <Input placeholder="Default input" />
      <Input label="With label" placeholder="Labeled input" />
      <Input
        label="With hint"
        placeholder="Enter value"
        hint="This is a helpful hint"
      />
      <Input
        label="With error"
        placeholder="Invalid"
        error="Something went wrong"
      />
      <Input
        label="With icon"
        type="email"
        placeholder="user@example.com"
        icon={<Mail size={16} />}
      />
      <Input
        label="Disabled"
        placeholder="Cannot edit"
        disabled
        value="Disabled"
      />
    </div>
  ),
};
