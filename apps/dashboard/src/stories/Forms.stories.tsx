import type { Meta, StoryObj } from "@storybook/react";
import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import { FormTextarea } from "@/components/forms/form-textarea";
import { FormCheckbox } from "@/components/forms/form-checkbox";
import { FormRadio } from "@/components/forms/form-radio";
import { Mail, Lock, Phone, DollarSign } from "lucide-react";

const meta = {
  title: "UI/Forms",
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

export const FormInputBasic: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <FormInput placeholder="Basic input" />
      <FormInput type="email" placeholder="Email address" />
      <FormInput type="password" placeholder="Password" />
    </div>
  ),
};

export const FormInputWithPrefix: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <FormInput
        type="email"
        prefix={<Mail size={16} />}
        placeholder="your@email.com"
      />
      <FormInput
        type="password"
        prefix={<Lock size={16} />}
        placeholder="Password"
      />
      <FormInput
        type="tel"
        prefix={<Phone size={16} />}
        placeholder="Phone number"
        autoFormat="phone"
      />
      <FormInput
        type="text"
        prefix={<DollarSign size={16} />}
        placeholder="Amount"
        autoFormat="currency"
      />
    </div>
  ),
};

export const FormInputWithClear: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <FormInput
        placeholder="Text with clear button"
        showClear
        defaultValue="Sample text"
      />
      <FormInput
        type="email"
        placeholder="Email with clear"
        showClear
        defaultValue="user@example.com"
      />
    </div>
  ),
};

export const FormInputErrors: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <FormInput
        type="email"
        placeholder="Invalid email"
        hasError
        value="invalid"
      />
      <FormInput placeholder="Required field" hasError />
    </div>
  ),
};

export const FormInputDisabled: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <FormInput placeholder="Disabled input" disabled value="Cannot edit" />
      <FormInput
        type="email"
        placeholder="Disabled"
        disabled
        value="user@example.com"
      />
    </div>
  ),
};

export const FormSelectBasic: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <FormSelect
        label="Status"
        options={[
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
          { value: "pending", label: "Pending" },
        ]}
        placeholder="Select status"
      />
      <FormSelect
        label="Priority"
        options={[
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ]}
      />
    </div>
  ),
};

export const FormTextareaBasic: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <FormTextarea
        label="Description"
        placeholder="Enter description"
        rows={4}
      />
      <FormTextarea
        label="Comments"
        placeholder="Add your comments here"
        rows={3}
      />
    </div>
  ),
};

export const FormCheckboxBasic: Story = {
  render: () => (
    <div className="space-y-3">
      <FormCheckbox label="I agree to terms and conditions" />
      <FormCheckbox label="Subscribe to newsletter" defaultChecked />
      <FormCheckbox label="Disabled checkbox" disabled />
    </div>
  ),
};

export const FormRadioBasic: Story = {
  render: () => (
    <div className="space-y-3">
      <FormRadio
        name="option"
        option={{ value: "1", label: "Option 1" }}
        selected={false}
        onChange={() => {}}
      />
      <FormRadio
        name="option"
        option={{ value: "2", label: "Option 2" }}
        selected={false}
        onChange={() => {}}
      />
      <FormRadio
        name="option"
        option={{ value: "3", label: "Option 3" }}
        selected={true}
        onChange={() => {}}
      />
    </div>
  ),
};

export const CompleteForm: Story = {
  render: () => (
    <form className="max-w-md space-y-6 p-6 bg-wl-bg-surface rounded-lg border border-wl-border-subtle">
      <div>
        <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
          Contact Form
        </h2>
      </div>

      <FormInput placeholder="Your name" value="John Doe" />

      <FormInput
        type="email"
        prefix={<Mail size={16} />}
        placeholder="your@email.com"
      />

      <FormInput
        type="tel"
        prefix={<Phone size={16} />}
        placeholder="Phone number"
        autoFormat="phone"
      />

      <FormSelect
        label="Subject"
        options={[
          { value: "inquiry", label: "General Inquiry" },
          { value: "support", label: "Support" },
          { value: "sales", label: "Sales" },
        ]}
        placeholder="Select subject"
      />

      <FormTextarea label="Message" placeholder="Enter your message" rows={5} />

      <FormCheckbox label="I agree to be contacted about my inquiry" />

      <button className="w-full px-4 py-2 bg-wl-primary-500 text-white rounded-md hover:bg-wl-primary-600 transition-colors">
        Submit
      </button>
    </form>
  ),
};

export const ValidationStates: Story = {
  render: () => (
    <div className="max-w-md space-y-6 p-6 bg-wl-bg-surface rounded-lg">
      <FormInput
        type="email"
        placeholder="Valid input"
        value="user@example.com"
      />

      <FormInput
        type="email"
        placeholder="Invalid input"
        hasError
        value="invalid"
      />

      <FormSelect
        label="Required field"
        options={[
          { value: "option1", label: "Option 1" },
          { value: "option2", label: "Option 2" },
        ]}
        placeholder="Please select"
      />

      <FormTextarea
        label="Character limit"
        placeholder="Enter text (max 100 characters)"
        maxLength={100}
      />
    </div>
  ),
};
