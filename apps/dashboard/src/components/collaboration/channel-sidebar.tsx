"use client";

import { useMemo, useCallback, useState, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Channel, DirectMessage } from "@/hooks/use-collaboration";

interface ChannelSidebarProps {
  channels: Channel[];
  directMessages: DirectMessage[];
  currentChannelId?: string;
  currentDMUserId?: string;
  onSelectChannel: (channelId: string) => void;
  onSelectDM: (userId: string) => void;
  onCreateChannel?: () => void;
  onSearch?: (query: string) => void;
}

interface GroupedChannels {
  general: Channel[];
  orders: Channel[];
  drivers: Channel[];
  alerts: Channel[];
}

function groupChannels(channels: Channel[]): GroupedChannels {
  return channels.reduce(
    (acc, channel) => {
      acc[channel.category].push(channel);
      return acc;
    },
    {
      general: [] as Channel[],
      orders: [] as Channel[],
      drivers: [] as Channel[],
      alerts: [] as Channel[],
    },
  );
}

const CATEGORY_ICONS: Record<Channel["category"], string> = {
  general: "💬",
  orders: "📦",
  drivers: "🚗",
  alerts: "🔔",
};

const CATEGORY_LABELS: Record<Channel["category"], string> = {
  general: "General",
  orders: "Orders",
  drivers: "Drivers",
  alerts: "Alerts",
};

interface ChannelItemProps {
  channel: Channel;
  isActive: boolean;
  onSelect: () => void;
}

function ChannelItem({ channel, isActive, onSelect }: ChannelItemProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-3 py-2 rounded-md transition-colors duration-fast",
        "flex items-center justify-between gap-2",
        isActive
          ? "bg-wl-primary-500/20 text-wl-primary-400"
          : "text-wl-text-secondary hover:text-wl-text-primary hover:bg-wl-bg-overlay",
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-sm">#{channel.name}</span>
      </div>
      {channel.unreadCount > 0 && (
        <Badge variant="primary" className="flex-shrink-0">
          {channel.unreadCount}
        </Badge>
      )}
    </button>
  );
}

interface DMItemProps {
  dm: DirectMessage;
  isActive: boolean;
  onSelect: () => void;
}

function DMItem({ dm, isActive, onSelect }: DMItemProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-3 py-2 rounded-md transition-colors duration-fast",
        "flex items-center justify-between gap-2",
        isActive
          ? "bg-wl-primary-500/20 text-wl-primary-400"
          : "text-wl-text-secondary hover:text-wl-text-primary hover:bg-wl-bg-overlay",
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="relative flex-shrink-0">
          {dm.avatar && (
            <img
              src={dm.avatar}
              alt={dm.userName}
              className="w-6 h-6 rounded-full"
            />
          )}
          {dm.online && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-wl-success-400 rounded-full border border-wl-bg-base" />
          )}
        </div>
        <span className="text-sm truncate">{dm.userName}</span>
      </div>
      {dm.unreadCount > 0 && (
        <Badge variant="primary" className="flex-shrink-0">
          {dm.unreadCount}
        </Badge>
      )}
    </button>
  );
}

interface ChannelCategoryProps {
  category: Channel["category"];
  channels: Channel[];
  currentChannelId?: string;
  onSelectChannel: (channelId: string) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

function ChannelCategory({
  category,
  channels,
  currentChannelId,
  onSelectChannel,
  isOpen = true,
  onToggle,
}: ChannelCategoryProps) {
  const unreadTotal = channels.reduce((sum, ch) => sum + ch.unreadCount, 0);

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "w-full px-3 py-2 rounded-md transition-colors duration-fast",
          "flex items-center justify-between gap-2",
          "text-xs font-semibold uppercase tracking-wider",
          "text-wl-text-tertiary hover:text-wl-text-secondary",
          "hover:bg-wl-bg-overlay",
        )}
      >
        <div className="flex items-center gap-2">
          <span>{CATEGORY_ICONS[category]}</span>
          <span>{CATEGORY_LABELS[category]}</span>
          {unreadTotal > 0 && (
            <Badge variant="danger" className="text-xs px-1.5">
              {unreadTotal}
            </Badge>
          )}
        </div>
        <span className="text-xs">{isOpen ? "▼" : "▶"}</span>
      </button>

      {isOpen && (
        <div className="ml-2 mt-1 space-y-1 border-l border-wl-border-subtle pl-2">
          {channels.length === 0 ? (
            <p className="text-xs text-wl-text-tertiary italic px-2 py-1">
              No channels
            </p>
          ) : (
            channels.map((channel) => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                isActive={currentChannelId === channel.id}
                onSelect={() => onSelectChannel(channel.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function ChannelSidebar({
  channels,
  directMessages,
  currentChannelId,
  currentDMUserId,
  onSelectChannel,
  onSelectDM,
  onCreateChannel,
  onSearch,
}: ChannelSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<
    Set<Channel["category"]>
  >(new Set(["general", "orders", "drivers", "alerts"]));
  const [showDMs, setShowDMs] = useState(true);

  const grouped = useMemo(() => groupChannels(channels), [channels]);

  const filteredChannels = useMemo(() => {
    if (!searchQuery) return grouped;

    const query = searchQuery.toLowerCase();
    return {
      general: grouped.general.filter((ch) =>
        ch.name.toLowerCase().includes(query),
      ),
      orders: grouped.orders.filter((ch) =>
        ch.name.toLowerCase().includes(query),
      ),
      drivers: grouped.drivers.filter((ch) =>
        ch.name.toLowerCase().includes(query),
      ),
      alerts: grouped.alerts.filter((ch) =>
        ch.name.toLowerCase().includes(query),
      ),
    };
  }, [grouped, searchQuery]);

  const filteredDMs = useMemo(() => {
    if (!searchQuery) return directMessages;
    const query = searchQuery.toLowerCase();
    return directMessages.filter((dm) =>
      dm.userName.toLowerCase().includes(query),
    );
  }, [directMessages, searchQuery]);

  const toggleCategory = useCallback((category: Channel["category"]) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      onSearch?.(query);
    },
    [onSearch],
  );

  const unreadChannelCount = channels.reduce(
    (sum, ch) => sum + ch.unreadCount,
    0,
  );
  const unreadDMCount = directMessages.reduce(
    (sum, dm) => sum + dm.unreadCount,
    0,
  );

  return (
    <div className="flex flex-col h-full w-64 bg-wl-bg-surface border-r border-wl-border-default">
      {/* Header */}
      <div className="px-4 py-4 border-b border-wl-border-default">
        <h2 className="text-lg font-semibold text-wl-text-primary mb-3">
          Messages
        </h2>

        {/* Search */}
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className={cn(
            "w-full px-3 py-2 rounded-md text-sm",
            "bg-wl-bg-overlay border border-wl-border-default",
            "text-wl-text-primary placeholder-wl-text-tertiary",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-wl-primary-500",
            "transition-colors duration-fast",
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-wl-border-strong">
        {/* Channels */}
        <div className="px-2 py-3 space-y-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider px-3 py-2 text-wl-text-tertiary">
              Channels {unreadChannelCount > 0 && `(${unreadChannelCount})`}
            </h3>
            <div className="space-y-1">
              {(["general", "orders", "drivers", "alerts"] as const).map(
                (category) => (
                  <ChannelCategory
                    key={category}
                    category={category}
                    channels={filteredChannels[category]}
                    currentChannelId={currentChannelId}
                    onSelectChannel={onSelectChannel}
                    isOpen={expandedCategories.has(category)}
                    onToggle={() => toggleCategory(category)}
                  />
                ),
              )}
            </div>
          </div>

          {/* Create Channel Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={onCreateChannel}
            className="w-full text-xs mt-3"
          >
            + New Channel
          </Button>
        </div>

        {/* Direct Messages */}
        <div className="px-2 py-3 border-t border-wl-border-default space-y-2">
          <button
            onClick={() => setShowDMs(!showDMs)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md transition-colors duration-fast",
              "flex items-center justify-between gap-2",
              "text-xs font-semibold uppercase tracking-wider",
              "text-wl-text-tertiary hover:text-wl-text-secondary",
              "hover:bg-wl-bg-overlay",
            )}
          >
            <div className="flex items-center gap-2">
              <span>💬 Direct Messages</span>
              {unreadDMCount > 0 && (
                <Badge variant="danger" className="text-xs px-1.5">
                  {unreadDMCount}
                </Badge>
              )}
            </div>
            <span className="text-xs">{showDMs ? "▼" : "▶"}</span>
          </button>

          {showDMs && (
            <div className="space-y-1">
              {filteredDMs.length === 0 ? (
                <p className="text-xs text-wl-text-tertiary italic px-2 py-1">
                  No direct messages
                </p>
              ) : (
                filteredDMs.map((dm) => (
                  <DMItem
                    key={dm.id}
                    dm={dm}
                    isActive={currentDMUserId === dm.userId}
                    onSelect={() => onSelectDM(dm.userId)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
