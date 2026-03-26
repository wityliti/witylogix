import type { Meta, StoryObj } from "@storybook/react";
import { Menu, Home, Users, Settings, ChevronRight, X } from "lucide-react";
import { useState } from "react";

const meta = {
  title: "UI/Navigation",
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

export const Sidebar: Story = {
  render: () => (
    <div className="flex h-96 bg-wl-bg-root">
      {/* Sidebar */}
      <div className="w-64 bg-wl-bg-sidebar border-r border-wl-border-subtle p-4 space-y-2">
        <div className="px-4 py-2 text-sm font-semibold text-wl-text-secondary uppercase tracking-wider">
          Menu
        </div>
        {[
          { icon: Home, label: "Dashboard" },
          { icon: Users, label: "Users" },
          { icon: Settings, label: "Settings" },
        ].map((item) => (
          <button
            key={item.label}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-md text-wl-text-secondary hover:bg-wl-bg-overlay hover:text-wl-text-primary transition-colors"
          >
            <item.icon size={18} />
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 bg-wl-bg-root p-6">
        <p className="text-wl-text-secondary">Main content goes here</p>
      </div>
    </div>
  ),
};

export const SidebarCollapsed: Story = {
  render: () => (
    <div className="flex h-96 bg-wl-bg-root">
      {/* Collapsed Sidebar */}
      <div className="w-20 bg-wl-bg-sidebar border-r border-wl-border-subtle p-2 space-y-2">
        {[
          { icon: Home },
          { icon: Users },
          { icon: Settings },
        ].map((item, i) => (
          <button
            key={i}
            className="w-full flex items-center justify-center p-3 rounded-md text-wl-text-secondary hover:bg-wl-bg-overlay transition-colors"
            title={item.icon.displayName}
          >
            <item.icon size={20} />
          </button>
        ))}
      </div>

      <div className="flex-1 bg-wl-bg-root p-6">
        <p className="text-wl-text-secondary">Content with collapsed sidebar</p>
      </div>
    </div>
  ),
};

export const Breadcrumbs: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <a href="#" className="text-wl-primary-400 hover:text-wl-primary-300">
          Dashboard
        </a>
        <ChevronRight size={16} className="text-wl-text-tertiary" />
        <a href="#" className="text-wl-primary-400 hover:text-wl-primary-300">
          Users
        </a>
        <ChevronRight size={16} className="text-wl-text-tertiary" />
        <span className="text-wl-text-secondary">Profile</span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <a href="#" className="text-wl-primary-400 hover:text-wl-primary-300">
          Home
        </a>
        <ChevronRight size={16} className="text-wl-text-tertiary" />
        <a href="#" className="text-wl-primary-400 hover:text-wl-primary-300">
          Products
        </a>
        <ChevronRight size={16} className="text-wl-text-tertiary" />
        <a href="#" className="text-wl-primary-400 hover:text-wl-primary-300">
          Category
        </a>
        <ChevronRight size={16} className="text-wl-text-tertiary" />
        <span className="text-wl-text-secondary">Item</span>
      </div>
    </div>
  ),
};

export const Tabs: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState("tab1");

    return (
      <div className="space-y-4 max-w-lg">
        <div className="flex gap-1 border-b border-wl-border-subtle">
          {["Tab 1", "Tab 2", "Tab 3"].map((tab, i) => {
            const tabId = `tab${i + 1}`;
            return (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tabId
                    ? "text-wl-primary-400 border-wl-primary-400"
                    : "text-wl-text-secondary border-transparent hover:text-wl-text-primary"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <div className="p-4 bg-wl-bg-surface rounded-md">
          {activeTab === "tab1" && <p className="text-wl-text-secondary">Content for Tab 1</p>}
          {activeTab === "tab2" && <p className="text-wl-text-secondary">Content for Tab 2</p>}
          {activeTab === "tab3" && <p className="text-wl-text-secondary">Content for Tab 3</p>}
        </div>
      </div>
    );
  },
};

export const MobileNav: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-wl-bg-sidebar border-b border-wl-border-subtle">
          <h1 className="text-lg font-bold text-wl-text-primary">App</h1>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 hover:bg-wl-bg-overlay rounded-md"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {isOpen && (
          <div className="space-y-2 p-4">
            {["Dashboard", "Users", "Settings"].map((item) => (
              <button
                key={item}
                className="w-full text-left px-4 py-2 rounded-md text-wl-text-secondary hover:bg-wl-bg-overlay hover:text-wl-text-primary transition-colors"
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
};

export const VerticalTabs: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState("profile");

    return (
      <div className="flex gap-4 max-w-2xl">
        <div className="flex flex-col gap-1 border-r border-wl-border-subtle pr-4">
          {["Profile", "Security", "Notifications", "Billing"].map((tab) => {
            const tabId = tab.toLowerCase();
            return (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tabId
                    ? "bg-wl-bg-overlay text-wl-primary-400"
                    : "text-wl-text-secondary hover:text-wl-text-primary"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <div className="flex-1 p-4 bg-wl-bg-surface rounded-md">
          <p className="text-wl-text-secondary">
            Content for {activeTab} section
          </p>
        </div>
      </div>
    );
  },
};

export const NavBar: Story = {
  render: () => (
    <div className="w-full bg-wl-bg-sidebar border-b border-wl-border-subtle">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-bold text-wl-text-primary">Dashboard</h1>
        <div className="flex items-center gap-4">
          <button className="text-wl-text-secondary hover:text-wl-text-primary">
            <Users size={20} />
          </button>
          <button className="text-wl-text-secondary hover:text-wl-text-primary">
            <Settings size={20} />
          </button>
        </div>
      </div>
    </div>
  ),
};
