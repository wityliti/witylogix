import type { Meta, StoryObj } from "@storybook/react";
import { Select } from "@/components/ui/select";

const meta = {
  title: "UI/Select",
  component: Select,
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
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const basicOptions = [
  { value: "option1", label: "Option 1" },
  { value: "option2", label: "Option 2" },
  { value: "option3", label: "Option 3" },
  { value: "option4", label: "Option 4" },
];

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "pending", label: "Pending" },
  { value: "archived", label: "Archived" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const Default: Story = {
  args: {
    options: basicOptions,
    placeholder: "Select an option",
  },
};

export const WithLabel: Story = {
  args: {
    label: "Choose Status",
    options: statusOptions,
    placeholder: "Select status...",
  },
};

export const Status: Story = {
  args: {
    label: "Status",
    options: statusOptions,
    placeholder: "Select status",
  },
};

export const Priority: Story = {
  args: {
    label: "Priority Level",
    options: priorityOptions,
    placeholder: "Select priority",
  },
};

export const WithError: Story = {
  args: {
    label: "Select Option",
    options: basicOptions,
    error: "This field is required",
  },
};

export const Disabled: Story = {
  args: {
    label: "Disabled Select",
    options: basicOptions,
    disabled: true,
    value: "option2",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    options: basicOptions,
    placeholder: "Small",
  },
};

export const Medium: Story = {
  args: {
    size: "md",
    options: basicOptions,
    placeholder: "Medium",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    options: basicOptions,
    placeholder: "Large",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-6 w-full max-w-md">
      <Select
        label="Basic"
        options={basicOptions}
        placeholder="Select option"
      />
      <Select
        label="With Error"
        options={statusOptions}
        error="Invalid selection"
      />
      <Select
        label="Disabled"
        options={basicOptions}
        disabled
        value="option1"
      />
      <Select
        label="Status (sm)"
        size="sm"
        options={statusOptions}
        placeholder="Small select"
      />
      <Select
        label="Priority (lg)"
        size="lg"
        options={priorityOptions}
        placeholder="Large select"
      />
    </div>
  ),
};
