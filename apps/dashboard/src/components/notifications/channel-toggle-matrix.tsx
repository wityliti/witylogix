"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";

export type Channel = "email" | "sms" | "push" | "whatsapp";
export type Category =
  | "order.created"
  | "order.confirmed"
  | "delivery.scheduled"
  | "delivery.in_transit"
  | "delivery.delivered"
  | "delivery.failed"
  | "tracking.updated";

export type MatrixState = {
  [category in Category]: {
    [channel in Channel]: boolean;
  };
};

interface ChannelToggleMatrixProps {
  onChange?: (state: MatrixState) => void;
  defaultState?: MatrixState;
  className?: string;
}

const CHANNEL_DESCRIPTIONS: Record<Channel, string> = {
  email: "Send HTML emails with rich formatting and images",
  sms: "Send plain text SMS messages (160 char limit)",
  push: "Send mobile push notifications with rich content",
  whatsapp: "Send WhatsApp messages (requires integration)",
};

const CATEGORY_LABELS: Record<Category, string> = {
  "order.created": "Order Created",
  "order.confirmed": "Order Confirmed",
  "delivery.scheduled": "Delivery Scheduled",
  "delivery.in_transit": "In Transit",
  "delivery.delivered": "Delivered",
  "delivery.failed": "Delivery Failed",
  "tracking.updated": "Tracking Updated",
};

const UNAVAILABLE_CHANNELS: Record<Channel, boolean> = {
  email: false,
  sms: false,
  push: false,
  whatsapp: true, // Not configured in this demo
};

const createDefaultState = (): MatrixState => ({
  "order.created": {
    email: true,
    sms: true,
    push: false,
    whatsapp: false,
  },
  "order.confirmed": {
    email: true,
    sms: true,
    push: false,
    whatsapp: false,
  },
  "delivery.scheduled": {
    email: true,
    sms: true,
    push: true,
    whatsapp: false,
  },
  "delivery.in_transit": {
    email: false,
    sms: true,
    push: true,
    whatsapp: false,
  },
  "delivery.delivered": {
    email: true,
    sms: true,
    push: true,
    whatsapp: false,
  },
  "delivery.failed": {
    email: true,
    sms: true,
    push: true,
    whatsapp: false,
  },
  "tracking.updated": {
    email: false,
    sms: true,
    push: true,
    whatsapp: false,
  },
});

const CHANNELS = ["email", "sms", "push", "whatsapp"] as const;
const CATEGORIES = [
  "order.created",
  "order.confirmed",
  "delivery.scheduled",
  "delivery.in_transit",
  "delivery.delivered",
  "delivery.failed",
  "tracking.updated",
] as const;

export const ChannelToggleMatrix = ({
  onChange,
  defaultState,
  className,
}: ChannelToggleMatrixProps) => {
  const [state, setState] = useState<MatrixState>(
    defaultState || createDefaultState()
  );

  const handleToggle = (category: Category, channel: Channel) => {
    if (UNAVAILABLE_CHANNELS[channel]) return;

    const newState = {
      ...state,
      [category]: {
        ...state[category],
        [channel]: !state[category][channel],
      },
    };
    setState(newState);
    onChange?.(newState);
  };

  const handleRowSelectAll = (category: Category) => {
    const availableChannels = CHANNELS.filter((ch) => !UNAVAILABLE_CHANNELS[ch]);
    const allEnabled = availableChannels.every((ch) => state[category][ch]);

    const newState = {
      ...state,
      [category]: {
        ...state[category],
        ...availableChannels.reduce(
          (acc, ch) => ({ ...acc, [ch]: !allEnabled }),
          {}
        ),
      },
    };
    setState(newState);
    onChange?.(newState);
  };

  const handleColumnSelectAll = (channel: Channel) => {
    if (UNAVAILABLE_CHANNELS[channel]) return;

    const allEnabled = CATEGORIES.every((cat) => state[cat][channel]);

    const newState = { ...state };
    CATEGORIES.forEach((cat) => {
      newState[cat] = {
        ...state[cat],
        [channel]: !allEnabled,
      };
    });
    setState(newState);
    onChange?.(newState);
  };

  const columnStats = useMemo(() => {
    return Object.fromEntries(
      CHANNELS.map((channel) => [
        channel,
        {
          enabled: CATEGORIES.filter((cat) => state[cat][channel]).length,
          total: CATEGORIES.length,
        },
      ])
    );
  }, [state]);

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--wl-text-primary)] border-b border-[var(--wl-border)]">
              Category
            </th>
            {CHANNELS.map((channel) => (
              <th
                key={channel}
                className="px-4 py-3 text-center border-b border-[var(--wl-border)]"
              >
                <div className="flex flex-col items-center gap-2">
                  <Tooltip content={CHANNEL_DESCRIPTIONS[channel]}>
                    <button
                      onClick={() => handleColumnSelectAll(channel)}
                      disabled={UNAVAILABLE_CHANNELS[channel]}
                      className={cn(
                        "px-3 py-1 rounded-sm text-xs font-semibold",
                        "transition-colors uppercase tracking-wide",
                        UNAVAILABLE_CHANNELS[channel]
                          ? "text-[var(--wl-text-secondary)] opacity-40 cursor-not-allowed"
                          : "text-[var(--wl-primary)] hover:bg-[var(--wl-bg-secondary)]"
                      )}
                    >
                      {channel}
                    </button>
                  </Tooltip>
                  {!UNAVAILABLE_CHANNELS[channel] && (
                    <span className="text-xs text-[var(--wl-text-secondary)]">
                      {columnStats[channel].enabled}/{columnStats[channel].total}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map((category) => {
            const categoryEnabled = CHANNELS.filter(
              (ch) => !UNAVAILABLE_CHANNELS[ch] && state[category][ch]
            ).length;
            const availableCount = CHANNELS.filter(
              (ch) => !UNAVAILABLE_CHANNELS[ch]
            ).length;

            return (
              <tr key={category} className="border-b border-[var(--wl-border)]">
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleRowSelectAll(category)}
                    className={cn(
                      "text-left text-sm font-medium transition-colors",
                      "hover:text-[var(--wl-primary)] hover:underline",
                      categoryEnabled === availableCount
                        ? "text-[var(--wl-primary)]"
                        : "text-[var(--wl-text-primary)]"
                    )}
                    title="Click to toggle all available channels"
                  >
                    {CATEGORY_LABELS[category]}
                  </button>
                </td>
                {CHANNELS.map((channel) => (
                  <td
                    key={`${category}-${channel}`}
                    className="px-4 py-3 text-center"
                  >
                    <div
                      className={cn(
                        "inline-flex",
                        UNAVAILABLE_CHANNELS[channel] && "opacity-50"
                      )}
                    >
                      <Switch
                        checked={state[category][channel]}
                        onChange={() =>
                          handleToggle(category, channel)
                        }
                        disabled={UNAVAILABLE_CHANNELS[channel]}
                        aria-label={`Toggle ${channel} for ${category}`}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {Object.values(UNAVAILABLE_CHANNELS).some((v) => v) && (
        <div className="mt-4 px-4 py-3 rounded-md bg-[var(--wl-bg-secondary)] border border-[var(--wl-border)]">
          <p className="text-xs text-[var(--wl-text-secondary)]">
            <span className="font-semibold">Note:</span> Some channels are
            disabled and require configuration.
          </p>
        </div>
      )}
    </div>
  );
};

ChannelToggleMatrix.displayName = "ChannelToggleMatrix";
