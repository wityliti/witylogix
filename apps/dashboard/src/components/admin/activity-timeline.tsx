"use client";

import { cn } from "@/lib/utils";
import type { ActivityTimelineProps, ActivityAction } from "./types";

/**
 * Activity timeline component
 * Displays vertical timeline with activity cards, action icons, and relative timestamps
 */
export function ActivityTimeline({
  activities,
  onActivityClick,
  className,
}: ActivityTimelineProps) {
  const getActionIcon = (action: ActivityAction): React.ReactNode => {
    const iconProps = {
      width: "16",
      height: "16",
      viewBox: "0 0 16 16",
      fill: "currentColor",
    };

    switch (action) {
      case "login":
        return (
          <svg {...iconProps}>
            <path d="M8 0C3.582 0 0 3.582 0 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8zm0 14c-3.309 0-6-2.691-6-6s2.691-6 6-6 6 2.691 6 6-2.691 6-6 6zm1-11H7v3H4l4 4 4-4h-3V3z" />
          </svg>
        );
      case "create":
        return (
          <svg {...iconProps}>
            <path d="M14 1H2c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V2c0-.55-.45-1-1-1zM7 14H3v-2h4v2zm0-4H3V8h4v2zm4 4h-4v-2h4v2zm0-4h-4V8h4v2z" />
          </svg>
        );
      case "update":
        return (
          <svg {...iconProps}>
            <path d="M13.77 7.77L5.54 15.99c-.18.18-.46.29-.74.29-.3 0-.58-.11-.77-.29l-.97-.97c-.44-.44-.44-1.15 0-1.59l8.23-8.23c.44-.44 1.15-.44 1.59 0l.97.97c.44.44.44 1.15 0 1.59zM1 14.25V16h1.75L14.81 3.94l-1.75-1.75L1 14.25z" />
          </svg>
        );
      case "delete":
        return (
          <svg {...iconProps}>
            <path d="M6 19c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-9l-1 1H5v2h14V4z" />
          </svg>
        );
      case "export":
        return (
          <svg {...iconProps}>
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
        );
      case "import":
        return (
          <svg {...iconProps}>
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        );
    }
  };

  const getActionColor = (action: ActivityAction): string => {
    switch (action) {
      case "login":
        return "text-blue-400";
      case "create":
        return "text-green-400";
      case "update":
        return "text-yellow-400";
      case "delete":
        return "text-red-400";
      case "export":
      case "import":
        return "text-purple-400";
    }
  };

  const getActionLabel = (action: ActivityAction): string => {
    const labels: Record<ActivityAction, string> = {
      login: "Logged in",
      create: "Created",
      update: "Updated",
      delete: "Deleted",
      export: "Exported",
      import: "Imported",
    };
    return labels[action];
  };

  const getRelativeTime = (timestamp: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(timestamp).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return `${diffSecs}s ago`;
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return new Date(timestamp).toLocaleDateString();
    }
  };

  if (activities.length === 0) {
    return (
      <div className={cn("w-full", className)}>
        <div className="flex items-center justify-center py-12 text-center">
          <div>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="mx-auto text-wl-text-tertiary opacity-50 mb-3"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
            </svg>
            <p className="text-sm text-wl-text-tertiary">No activities yet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="space-y-0">
        {activities.map((activity, index) => {
          const isLast = index === activities.length - 1;
          const relativeTime = getRelativeTime(activity.timestamp);
          const actionColor = getActionColor(activity.action);
          const actionLabel = getActionLabel(activity.action);

          return (
            <div
              key={activity.id}
              className="relative cursor-pointer transition-all duration-base"
              onClick={() => onActivityClick?.(activity)}
            >
              {/* Timeline connector */}
              <div className="absolute left-[27px] top-[48px] bottom-0 w-0.5 bg-wl-border-subtle"
                style={{ display: isLast ? "none" : "block" }}
              />

              {/* Activity card */}
              <div className="flex gap-4 pb-6">
                {/* Timeline node */}
                <div className="flex-shrink-0 pt-1">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    "border-2 border-wl-border-subtle bg-wl-bg-surface",
                    "transition-all duration-200 hover:border-wl-primary-500 hover:shadow-md",
                    "group"
                  )}>
                    <div className={cn(actionColor)}>
                      {getActionIcon(activity.action)}
                    </div>
                  </div>
                </div>

                {/* Activity content */}
                <div className="flex-1 pt-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-wl-text-primary">
                        <span>{activity.userName}</span>
                        {" "}
                        <span className="text-wl-text-secondary font-normal">
                          {actionLabel}
                        </span>
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-wl-bg-surface border border-wl-border-subtle text-xs text-wl-text-secondary font-medium">
                          {activity.resourceType}
                        </span>
                        <span className="text-xs text-wl-text-tertiary font-mono">
                          {activity.resource}
                        </span>
                      </div>
                      {activity.details && (
                        <p className="text-xs text-wl-text-tertiary mt-2">
                          {activity.details}
                        </p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs font-semibold text-wl-text-secondary whitespace-nowrap">
                        {relativeTime}
                      </p>
                      <p className="text-xs text-wl-text-tertiary mt-1">
                        {new Date(activity.timestamp).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* User avatar */}
                  {activity.userAvatar && (
                    <div className="mt-2 -ml-4">
                      <img
                        src={activity.userAvatar}
                        alt={activity.userName}
                        className="w-6 h-6 rounded-full border border-wl-border-subtle"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
