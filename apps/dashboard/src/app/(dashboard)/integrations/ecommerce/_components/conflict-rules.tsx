"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

interface ConflictRule {
  field: string;
  priority: string[];
}

const CONFLICT_RULES: ConflictRule[] = [
  {
    field: "price",
    priority: ["Shopify", "WooCommerce", "Manual Override"],
  },
  {
    field: "inventory_level",
    priority: ["WooCommerce", "Shopify", "Manual Override"],
  },
  {
    field: "product_title",
    priority: ["Shopify", "WooCommerce", "Amazon"],
  },
  {
    field: "order_status",
    priority: ["Manual Override", "Shopify", "WooCommerce"],
  },
];

export function ConflictRules() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-2">
          Conflict Resolution Rules
        </h2>
        <p className="text-sm text-wl-text-tertiary">
          Define priority rules for when the same product field is synced from
          multiple platforms
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {CONFLICT_RULES.map((rule) => (
          <Card
            key={rule.field}
            className="bg-wl-bg-elevated border-wl-border-default"
          >
            <CardContent className="pt-6">
              <h3 className="font-semibold text-white mb-4">
                {rule.field.replace(/_/g, " ")}
              </h3>
              <div className="flex items-center gap-2">
                {rule.priority.map((source, idx) => (
                  <div key={source} className="flex items-center gap-2">
                    <div className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded text-sm font-medium">
                      {idx + 1}. {source}
                    </div>
                    {idx < rule.priority.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-wl-text-tertiary" />
                    )}
                  </div>
                ))}
              </div>
              <Button variant="secondary" size="sm" className="mt-4">
                Edit Priority
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-wl-bg-surface border border-blue-500/20">
        <CardHeader>
          <CardTitle>Order Import Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white">
              Filter by Status
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {["pending", "processing", "completed", "cancelled"].map(
                (status) => (
                  <Badge key={status} variant="primary">
                    {status}
                  </Badge>
                ),
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-white">Date Range</label>
            <div className="text-sm text-wl-text-secondary mt-2">
              Last 90 days
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-white">
              Fulfillment Type
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {["shipped", "in_transit", "delivered"].map((type) => (
                <Badge key={type} variant="info">
                  {type}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
