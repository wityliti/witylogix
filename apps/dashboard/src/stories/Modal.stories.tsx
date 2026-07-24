import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const meta = {
  title: "UI/Modal",
  component: Modal,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg", "full"],
    },
    isOpen: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

function ModalWrapper({
  title,
  size,
  children,
  footer,
}: {
  title?: string;
  size?: "sm" | "md" | "lg" | "full";
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
        size={size}
        footer={footer}
      >
        {children}
      </Modal>
    </>
  );
}

export const Default: Story = {
  render: () => (
    <ModalWrapper title="Modal Title">
      <p>This is the default modal content.</p>
    </ModalWrapper>
  ),
};

export const Small: Story = {
  render: () => (
    <ModalWrapper title="Small Modal" size="sm">
      <p>Small modal content</p>
    </ModalWrapper>
  ),
};

export const Medium: Story = {
  render: () => (
    <ModalWrapper title="Medium Modal" size="md">
      <p>Medium modal content</p>
    </ModalWrapper>
  ),
};

export const Large: Story = {
  render: () => (
    <ModalWrapper title="Large Modal" size="lg">
      <p>Large modal content</p>
    </ModalWrapper>
  ),
};

export const FullScreen: Story = {
  render: () => (
    <ModalWrapper title="Full Screen Modal" size="full">
      <p>Full screen modal content</p>
    </ModalWrapper>
  ),
};

export const ConfirmDialog: Story = {
  render: () => (
    <ModalWrapper
      title="Confirm Delete"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary">Cancel</Button>
          <Button variant="danger">Delete</Button>
        </div>
      }
    >
      <p>
        Are you sure you want to delete this item? This action cannot be undone.
      </p>
    </ModalWrapper>
  ),
};

export const FormModal: Story = {
  render: () => (
    <ModalWrapper
      title="Create New Item"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary">Cancel</Button>
          <Button variant="primary">Create</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Name" placeholder="Enter name" />
        <Input label="Email" type="email" placeholder="Enter email" />
      </div>
    </ModalWrapper>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <ModalWrapper
      title="Important Information"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost">Later</Button>
          <Button variant="primary">Agree</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-wl-text-secondary">
          This is important information that users should read before
          proceeding.
        </p>
        <p className="text-sm text-wl-text-tertiary">
          Additional details can be provided here to give more context.
        </p>
      </div>
    </ModalWrapper>
  ),
};

export const LongContent: Story = {
  render: () => (
    <ModalWrapper
      title="Terms and Conditions"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary">Decline</Button>
          <Button variant="primary">Accept</Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm text-wl-text-secondary">
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>
        <p>
          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
          nisi ut aliquip ex ea commodo consequat.
        </p>
        <p>
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
          dolore eu fugiat nulla pariatur.
        </p>
      </div>
    </ModalWrapper>
  ),
};
