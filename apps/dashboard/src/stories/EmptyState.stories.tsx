import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox, Search, AlertTriangle, Rocket } from "lucide-react";

const meta = {
  title: "UI/EmptyState",
  component: EmptyState,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const NoData: Story = {
  args: {
    icon: <Inbox size={32} />,
    title: "No data available",
    description:
      "There is nothing to display here. Start by creating a new item.",
  },
};

export const NoResults: Story = {
  args: {
    icon: <Search size={32} />,
    title: "No results found",
    description:
      "We couldn't find anything matching your search. Try different keywords.",
  },
};

export const Error: Story = {
  args: {
    icon: <AlertTriangle size={32} />,
    title: "Something went wrong",
    description: "An error occurred while loading this page. Please try again.",
    action: {
      label: "Retry",
      onClick: () => alert("Retrying..."),
    },
  },
};

export const FirstTimeUse: Story = {
  args: {
    icon: <Rocket size={32} />,
    title: "Welcome!",
    description:
      "You haven't created anything yet. Get started by creating your first item.",
    action: {
      label: "Create Item",
      onClick: () => alert("Creating new item..."),
    },
  },
};

export const NoSearch: Story = {
  args: {
    icon: <Search size={32} />,
    title: "No search results",
    description:
      "Your search didn't match any items. Please try a different search term.",
  },
};

export const NoPermission: Story = {
  args: {
    icon: <AlertTriangle size={32} />,
    title: "Access Denied",
    description: "You don't have permission to view this content.",
  },
};

export const WithAction: Story = {
  args: {
    icon: <Inbox size={32} />,
    title: "Your inbox is empty",
    description: "You've cleared all your messages. That's amazing!",
    action: {
      label: "Start a conversation",
      onClick: () => alert("Starting conversation..."),
    },
  },
};

export const Minimal: Story = {
  args: {
    title: "No items",
  },
};

export const Loading: Story = {
  render: () => (
    <EmptyState
      icon={<div className="animate-spin">⟳</div>}
      title="Loading..."
      description="Please wait while we load your data"
    />
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h3 className="text-sm font-semibold text-wl-text-primary mb-4">
          No Data
        </h3>
        <EmptyState
          icon={<Inbox size={32} />}
          title="No data"
          description="Nothing here"
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-wl-text-primary mb-4">
          No Results
        </h3>
        <EmptyState
          icon={<Search size={32} />}
          title="No results"
          description="Try different keywords"
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-wl-text-primary mb-4">
          Error
        </h3>
        <EmptyState
          icon={<AlertTriangle size={32} />}
          title="Error occurred"
          description="Something went wrong"
          action={{
            label: "Retry",
            onClick: () => {},
          }}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-wl-text-primary mb-4">
          With Action
        </h3>
        <EmptyState
          icon={<Rocket size={32} />}
          title="Get started"
          description="Create your first item"
          action={{
            label: "Create",
            onClick: () => {},
          }}
        />
      </div>
    </div>
  ),
};
