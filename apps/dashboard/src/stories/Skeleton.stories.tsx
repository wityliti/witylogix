import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton, SkeletonText, SkeletonCircle } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

export const Basic: Story = {
  render: () => <Skeleton className="w-full h-12 rounded-md" />,
};

export const Text: Story = {
  render: () => <SkeletonText lines={3} />,
};

export const TextShort: Story = {
  render: () => <SkeletonText lines={1} />,
};

export const Avatar: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <SkeletonCircle size="lg" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-3 w-48 rounded" />
      </div>
    </div>
  ),
};

export const Card: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <SkeletonCircle size="sm" />
        <Skeleton className="h-6 w-3/4 rounded mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
          <Skeleton className="h-4 w-4/5 rounded" />
        </div>
      </CardContent>
    </Card>
  ),
};

export const Table: Story = {
  render: () => (
    <div className="w-full space-y-2 max-w-2xl">
      {/* Header */}
      <div className="flex gap-4 p-4 bg-wl-bg-surface rounded-md">
        <Skeleton className="h-4 w-20 rounded" />
        <Skeleton className="h-4 w-32 rounded flex-1" />
        <Skeleton className="h-4 w-24 rounded" />
      </div>
      {/* Rows */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 p-4 border border-wl-border-subtle rounded-md">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-4 w-32 rounded flex-1" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
      ))}
    </div>
  ),
};

export const Chart: Story = {
  render: () => (
    <div className="w-full max-w-sm space-y-4">
      <Skeleton className="h-80 w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="h-3 w-32 rounded" />
      </div>
    </div>
  ),
};

export const ProfileCard: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <SkeletonCircle size="lg" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-3 w-40 rounded" />
            </div>
          </div>
          <div className="space-y-3 pt-4">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-3/4 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="space-y-6 max-w-md">
      <div>
        <h3 className="text-sm font-semibold text-wl-text-primary mb-3">
          Text Skeleton
        </h3>
        <SkeletonText lines={2} />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-wl-text-primary mb-3">
          Avatar
        </h3>
        <SkeletonCircle size="md" />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-wl-text-primary mb-3">
          Custom sizes
        </h3>
        <div className="space-y-2">
          <Skeleton className="h-6 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-14 w-full rounded-md" />
        </div>
      </div>
    </div>
  ),
};
