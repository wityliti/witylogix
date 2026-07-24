"use client";

import { memo, useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
  Badge,
  Card,
} from "@/components/ui";

interface ContactCardProps {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  source: "salesforce" | "hubspot" | "zoho" | "pipedrive" | "dynamics";
  lastActivity?: string;
  dealValue?: number;
  dealStage?: string;
  recentActivities?: Array<{
    id: string;
    type: "call" | "email" | "meeting" | "note";
    description: string;
    timestamp: string;
  }>;
  notes?: string;
  associatedDeals?: Array<{
    id: string;
    name: string;
    value: number;
    stage: string;
  }>;
  avatar?: string;
  onEmail?: (email: string) => void;
  onCall?: (phone: string) => void;
  onViewInCRM?: (id: string, source: string) => void;
  onEdit?: (id: string) => void;
}

const sourceConfig: Record<
  string,
  { badge: "success" | "info" | "warning" | "primary"; label: string }
> = {
  salesforce: { badge: "primary", label: "Salesforce" },
  hubspot: { badge: "success", label: "HubSpot" },
  zoho: { badge: "info", label: "Zoho" },
  pipedrive: { badge: "warning", label: "Pipedrive" },
  dynamics: { badge: "primary", label: "Dynamics" },
};

const activityTypeIcons: Record<string, string> = {
  call: "📞",
  email: "📧",
  meeting: "🤝",
  note: "📝",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const ContactCardContent = memo(
  ({
    id,
    name,
    email,
    phone,
    company,
    title,
    source,
    lastActivity,
    dealValue,
    dealStage,
    recentActivities,
    notes,
    associatedDeals,
    avatar,
    onEmail,
    onCall,
    onViewInCRM,
    onEdit,
    isExpanded,
    onToggleExpand,
  }: ContactCardProps & {
    isExpanded: boolean;
    onToggleExpand: () => void;
  }) => {
    const sourceInfo = sourceConfig[source];

    return (
      <Card className="overflow-hidden">
        {/* Header Section */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3 flex-1 min-w-0">
            <Avatar size="lg">
              {avatar && <AvatarImage src={avatar} alt={name} />}
              <AvatarFallback name={name} />
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-wl-text-primary truncate">
                    {name}
                  </h3>
                  {title && (
                    <p className="text-xs text-wl-text-secondary truncate">
                      {title}
                    </p>
                  )}
                  {company && (
                    <p className="text-xs text-wl-text-tertiary truncate">
                      {company}
                    </p>
                  )}
                </div>
              </div>

              {/* Contact Details */}
              <div className="mt-2 space-y-1">
                <a
                  href={`mailto:${email}`}
                  className="text-xs text-wl-primary-400 hover:text-wl-primary-300 truncate block"
                >
                  {email}
                </a>
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="text-xs text-wl-text-secondary hover:text-wl-text-primary block"
                  >
                    {phone}
                  </a>
                )}
              </div>

              {/* Badges and Info */}
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <Badge variant={sourceInfo.badge} dot>
                  {sourceInfo.label}
                </Badge>
                {lastActivity && (
                  <span className="text-xs text-wl-text-tertiary">
                    {formatDate(lastActivity)}
                  </span>
                )}
                {dealValue && dealStage && (
                  <Badge variant="info" dot>
                    {dealStage}
                  </Badge>
                )}
              </div>

              {/* Deal Value */}
              {dealValue && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-wl-text-secondary">
                    Deal Value:
                  </span>
                  <span className="text-sm font-semibold text-wl-success-400">
                    {formatCurrency(dealValue)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {onEmail && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEmail(email)}
              aria-label={`Email ${name}`}
              className="flex-1 min-w-[80px]"
            >
              Email
            </Button>
          )}
          {onCall && phone && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCall(phone)}
              aria-label={`Call ${name}`}
              className="flex-1 min-w-[80px]"
            >
              Call
            </Button>
          )}
          {onViewInCRM && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onViewInCRM(id, source)}
              aria-label={`View ${name} in CRM`}
              className="flex-1 min-w-[100px]"
            >
              View in CRM
            </Button>
          )}
          {onEdit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onEdit(id)}
              aria-label={`Edit ${name}`}
              className="flex-1 min-w-[80px]"
            >
              Edit
            </Button>
          )}
        </div>

        {/* Expandable Section */}
        {(recentActivities?.length || notes || associatedDeals?.length) && (
          <>
            <button
              onClick={onToggleExpand}
              className="mt-4 w-full text-left px-3 py-2 rounded-md bg-wl-bg-overlay hover:bg-wl-bg-elevated transition-colors"
              aria-expanded={isExpanded}
              aria-label="Toggle details"
            >
              <span className="text-xs font-semibold text-wl-text-primary">
                {isExpanded ? "▼ Hide Details" : "▶ Show Details"}
              </span>
            </button>

            {isExpanded && (
              <div className="mt-4 space-y-4 border-t border-wl-border-subtle pt-4">
                {/* Recent Activities */}
                {recentActivities && recentActivities.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-wl-text-primary mb-2">
                      Recent Activities
                    </h4>
                    <div className="space-y-2">
                      {recentActivities.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex gap-2 text-xs text-wl-text-secondary"
                        >
                          <span className="flex-shrink-0">
                            {activityTypeIcons[activity.type] || "•"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate">{activity.description}</p>
                            <p className="text-wl-text-tertiary">
                              {formatDate(activity.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {notes && (
                  <div>
                    <h4 className="text-xs font-semibold text-wl-text-primary mb-2">
                      Notes
                    </h4>
                    <p className="text-xs text-wl-text-secondary leading-relaxed">
                      {notes}
                    </p>
                  </div>
                )}

                {/* Associated Deals */}
                {associatedDeals && associatedDeals.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-wl-text-primary mb-2">
                      Associated Deals
                    </h4>
                    <div className="space-y-2">
                      {associatedDeals.map((deal) => (
                        <div
                          key={deal.id}
                          className="flex justify-between items-start gap-2 p-2 rounded bg-wl-bg-overlay"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-wl-text-primary truncate">
                              {deal.name}
                            </p>
                            <p className="text-xs text-wl-text-tertiary">
                              {deal.stage}
                            </p>
                          </div>
                          <p className="text-xs font-semibold text-wl-success-400 flex-shrink-0">
                            {formatCurrency(deal.value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Card>
    );
  },
);

ContactCardContent.displayName = "ContactCardContent";

export const ContactCard = memo(function ContactCard(props: ContactCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const onToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <ContactCardContent
      {...props}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    />
  );
});

ContactCard.displayName = "ContactCard";
