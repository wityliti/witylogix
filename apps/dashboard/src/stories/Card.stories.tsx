import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    hover: {
      control: "boolean",
    },
    glow: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <p>Simple card content goes here</p>,
  },
};

export const WithHeader: Story = {
  args: {
    children: (
      <>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This is the card content with a header and title.</p>
        </CardContent>
      </>
    ),
  },
};

export const WithFooter: Story = {
  args: {
    children: (
      <>
        <CardHeader>
          <CardTitle>Confirm Action</CardTitle>
          <CardDescription>Are you sure you want to proceed?</CardDescription>
        </CardHeader>
        <CardContent>
          <p>This action cannot be undone.</p>
        </CardContent>
        <CardFooter>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Delete</Button>
        </CardFooter>
      </>
    ),
  },
};

export const StatCard: Story = {
  args: {
    children: (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-wl-text-secondary">Total Orders</span>
          <TrendingUp className="text-wl-success-400" size={20} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-wl-text-primary">2,847</span>
          <span className="text-sm text-wl-success-400">+12.5%</span>
        </div>
      </div>
    ),
  },
};

export const Clickable: Story = {
  args: {
    hover: true,
    children: (
      <>
        <CardHeader>
          <CardTitle>Clickable Card</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Click to view details or perform an action.</p>
        </CardContent>
      </>
    ),
  },
};

export const WithGlow: Story = {
  args: {
    glow: true,
    children: (
      <>
        <CardHeader>
          <CardTitle>Featured Card</CardTitle>
          <CardDescription>This card has a glowing shadow effect</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Perfect for highlighting important information.</p>
        </CardContent>
      </>
    ),
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-4 w-full max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Basic Card</CardTitle>
        </CardHeader>
        <CardContent>Basic card content</CardContent>
      </Card>

      <Card hover>
        <CardHeader>
          <CardTitle>Hover Card</CardTitle>
        </CardHeader>
        <CardContent>Hover over this card for interactive effect</CardContent>
      </Card>

      <Card glow>
        <CardHeader>
          <CardTitle>Glowing Card</CardTitle>
        </CardHeader>
        <CardContent>This card has a glowing shadow</CardContent>
      </Card>
    </div>
  ),
};
