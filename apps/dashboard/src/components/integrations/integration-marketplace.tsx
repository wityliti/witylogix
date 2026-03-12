"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Search,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Star,
  Shield,
  Zap as ZapIcon,
} from "lucide-react";

type IntegrationStatus = "connected" | "available" | "coming_soon";
type Category = "erp" | "crm" | "accounting" | "communication" | "logistics" | "analytics" | "payment" | "marketing";

interface Integration {
  id: string;
  name: string;
  category: Category;
  status: IntegrationStatus;
  logo?: string;
  description: string;
  rating: number;
  reviewCount: number;
  isNew?: boolean;
  features: string[];
}

interface IntegrationMarketplaceProps {
  integrations?: Integration[];
  onConnect?: (integrationId: string) => void;
  className?: string;
}

const defaultIntegrations: Integration[] = [
  {
    id: "sap",
    name: "SAP",
    category: "erp",
    status: "connected",
    description: "Enterprise resource planning and business management",
    rating: 4.8,
    reviewCount: 342,
    features: ["Inventory", "Finance", "Procurement", "Supply Chain"],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    category: "crm",
    status: "connected",
    description: "Customer relationship management platform",
    rating: 4.7,
    reviewCount: 512,
    features: ["Leads", "Opportunities", "Accounts", "Reports"],
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    category: "accounting",
    status: "available",
    description: "Accounting and financial management software",
    rating: 4.6,
    reviewCount: 287,
    features: ["Invoicing", "Expenses", "Reports", "Tax"],
  },
  {
    id: "slack",
    name: "Slack",
    category: "communication",
    status: "connected",
    description: "Team communication and collaboration platform",
    rating: 4.9,
    reviewCount: 1203,
    isNew: false,
    features: ["Messaging", "Channels", "Workflows", "Notifications"],
  },
  {
    id: "jira",
    name: "Jira",
    category: "communication",
    status: "available",
    description: "Project and issue tracking software",
    rating: 4.7,
    reviewCount: 456,
    features: ["Issues", "Boards", "Sprints", "Reporting"],
  },
  {
    id: "tableau",
    name: "Tableau",
    category: "analytics",
    status: "available",
    description: "Business intelligence and data visualization",
    rating: 4.8,
    reviewCount: 198,
    features: ["Dashboards", "Reports", "Analytics", "Sharing"],
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "payment",
    status: "connected",
    description: "Payment processing and financial services",
    rating: 4.9,
    reviewCount: 876,
    features: ["Payments", "Payouts", "Subscriptions", "Invoicing"],
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    category: "marketing",
    status: "available",
    description: "Email marketing and automation platform",
    rating: 4.5,
    reviewCount: 234,
    isNew: true,
    features: ["Campaigns", "Automation", "Segmentation", "Analytics"],
  },
  {
    id: "github",
    name: "GitHub",
    category: "logistics",
    status: "coming_soon",
    description: "Version control and collaboration platform",
    rating: 4.8,
    reviewCount: 789,
    features: ["Repos", "Pull Requests", "Actions", "Pages"],
  },
  {
    id: "twilio",
    name: "Twilio",
    category: "communication",
    status: "available",
    description: "Communications platform for SMS, voice, and video",
    rating: 4.7,
    reviewCount: 345,
    features: ["SMS", "Voice", "Video", "Messaging"],
  },
  {
    id: "zoom",
    name: "Zoom",
    category: "communication",
    status: "available",
    description: "Video conferencing and communication platform",
    rating: 4.9,
    reviewCount: 567,
    features: ["Meetings", "Webinars", "Rooms", "Chat"],
  },
  {
    id: "asana",
    name: "Asana",
    category: "erp",
    status: "available",
    description: "Work management and project collaboration",
    rating: 4.6,
    reviewCount: 412,
    features: ["Projects", "Tasks", "Timelines", "Portfolios"],
  },
];

const categoryLabels: Record<Category, string> = {
  erp: "ERP",
  crm: "CRM",
  accounting: "Accounting",
  communication: "Communication",
  logistics: "Logistics",
  analytics: "Analytics",
  payment: "Payment",
  marketing: "Marketing",
};

export function IntegrationMarketplace({
  integrations = defaultIntegrations,
  onConnect,
  className,
}: IntegrationMarketplaceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null);

  const categories = useMemo(() => {
    return [...new Set(integrations.map((i) => i.category))] as Category[];
  }, [integrations]);

  const filteredIntegrations = useMemo(() => {
    return integrations.filter((integration) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !integration.name.toLowerCase().includes(query) &&
          !integration.description.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Category filter
      if (selectedCategories.length > 0) {
        if (!selectedCategories.includes(integration.category)) {
          return false;
        }
      }

      return true;
    });
  }, [integrations, searchQuery, selectedCategories]);

  const stats = useMemo(() => {
    const connectedCount = integrations.filter((i) => i.status === "connected").length;
    const categoriesCovered = new Set(integrations.map((i) => i.category)).size;

    return {
      connected: connectedCount,
      available: integrations.filter((i) => i.status === "available").length,
      categories: categoriesCovered,
      total: integrations.length,
    };
  }, [integrations]);

  const toggleCategory = (category: Category) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const getStatusBadge = (status: IntegrationStatus) => {
    switch (status) {
      case "connected":
        return (
          <Badge variant="success" dot className="text-xs">
            Connected
          </Badge>
        );
      case "available":
        return (
          <Badge variant="default" className="text-xs">
            Available
          </Badge>
        );
      case "coming_soon":
        return (
          <Badge variant="warning" className="text-xs">
            Coming Soon
          </Badge>
        );
    }
  };

  const getStatusColor = (status: IntegrationStatus): string => {
    switch (status) {
      case "connected":
        return "var(--wl-success-500)";
      case "available":
        return "var(--wl-primary-500)";
      case "coming_soon":
        return "var(--wl-warning-500)";
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-wl-bg-surface border border-wl-border-subtle rounded-lg overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-wl-border-subtle bg-wl-bg-overlay space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-wl-primary-500" />
            <div>
              <h3 className="text-base font-semibold text-wl-text-primary">Integration Marketplace</h3>
              <p className="text-xs text-wl-text-secondary mt-1">Discover and connect 124+ integrations</p>
            </div>
          </div>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 bg-wl-bg-surface rounded-lg">
            <p className="text-xs text-wl-text-secondary">Connected</p>
            <p className="text-lg font-bold text-wl-success-400">{stats.connected}</p>
          </div>
          <div className="p-2 bg-wl-bg-surface rounded-lg">
            <p className="text-xs text-wl-text-secondary">Available</p>
            <p className="text-lg font-bold text-wl-primary-500">{stats.available}</p>
          </div>
          <div className="p-2 bg-wl-bg-surface rounded-lg">
            <p className="text-xs text-wl-text-secondary">Categories</p>
            <p className="text-lg font-bold text-wl-text-primary">{stats.categories}</p>
          </div>
          <div className="p-2 bg-wl-bg-surface rounded-lg">
            <p className="text-xs text-wl-text-secondary">Total</p>
            <p className="text-lg font-bold text-wl-text-primary">{stats.total}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-wl-text-secondary" />
          <input
            type="text"
            placeholder="Search integrations by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-wl-bg-surface border border-wl-border-subtle rounded text-sm text-wl-text-primary placeholder-wl-text-secondary focus:outline-none focus:border-wl-primary-500"
          />
        </div>

        {/* Category filters */}
        <div>
          <p className="text-xs font-semibold text-wl-text-secondary uppercase mb-2">Categories</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => toggleCategory(category)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-all",
                  selectedCategories.includes(category)
                    ? "bg-wl-primary-500 text-white"
                    : "bg-wl-bg-surface border border-wl-border-subtle text-wl-text-secondary hover:border-wl-border-default"
                )}
              >
                {categoryLabels[category]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of integrations */}
      <div className="flex-1 overflow-auto p-4">
        {filteredIntegrations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredIntegrations.map((integration) => (
              <div
                key={integration.id}
                className={cn(
                  "border border-wl-border-subtle rounded-lg bg-wl-bg-overlay overflow-hidden transition-all duration-200 hover:border-wl-primary-500 hover:shadow-md cursor-pointer",
                  expandedIntegration === integration.id && "col-span-full"
                )}
                onClick={() =>
                  setExpandedIntegration(expandedIntegration === integration.id ? null : integration.id)
                }
              >
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      {integration.logo ? (
                        <img
                          src={integration.logo}
                          alt={integration.name}
                          className="w-10 h-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-gradient-to-br from-wl-primary-500/20 to-wl-primary-600/20 border border-wl-primary-500/30 flex items-center justify-center">
                          <ZapIcon className="w-5 h-5 text-wl-primary-500" />
                        </div>
                      )}

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-wl-text-primary">{integration.name}</h4>
                          {integration.isNew && (
                            <Badge variant="primary" className="text-xs">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-wl-text-secondary mt-1">
                          {categoryLabels[integration.category]}
                        </p>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {expandedIntegration === integration.id ? (
                        <ChevronDown className="w-5 h-5 text-wl-text-secondary" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-wl-text-secondary" />
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-wl-text-secondary mb-3">{integration.description}</p>

                  {/* Rating */}
                  <div className="flex items-center gap-2 mb-3 text-xs">
                    <Star className="w-4 h-4 text-wl-warning-500 fill-wl-warning-500" />
                    <span className="font-medium text-wl-text-primary">{integration.rating}</span>
                    <span className="text-wl-text-secondary">({integration.reviewCount} reviews)</span>
                  </div>

                  {/* Status and action */}
                  <div className="flex items-center justify-between">
                    {getStatusBadge(integration.status)}

                    {!expandedIntegration || expandedIntegration !== integration.id ? (
                      integration.status === "available" ? (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onConnect?.(integration.id);
                          }}
                          className="flex items-center gap-1"
                        >
                          Connect
                        </Button>
                      ) : integration.status === "connected" ? (
                        <Button size="sm" variant="ghost" className="flex items-center gap-1">
                          Manage
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled>
                          Soon
                        </Button>
                      )
                    ) : null}
                  </div>

                  {/* Expanded content */}
                  {expandedIntegration === integration.id && (
                    <div className="mt-4 pt-4 border-t border-wl-border-subtle space-y-3">
                      <div>
                        <h5 className="text-xs font-semibold text-wl-text-secondary uppercase mb-2">
                          Key Features
                        </h5>
                        <div className="flex flex-wrap gap-1">
                          {integration.features.map((feature) => (
                            <Badge key={feature} variant="default" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {integration.status === "available" && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              onConnect?.(integration.id);
                            }}
                            className="flex-1 flex items-center justify-center gap-1"
                          >
                            <Zap className="w-4 h-4" />
                            Connect Now
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex items-center justify-center gap-1"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Learn More
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-center text-wl-text-secondary">
            <div>
              <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No integrations found</p>
              <p className="text-xs mt-1">Try adjusting your search or filters</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
