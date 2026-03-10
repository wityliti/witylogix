"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Tabs } from "@/components/ui";

interface IntegrationsLayoutProps {
  children: React.ReactNode;
}

export default function IntegrationsLayout({
  children,
}: IntegrationsLayoutProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    {
      id: "overview",
      label: "Overview",
    },
    {
      id: "webhooks",
      label: "Webhooks",
    },
    {
      id: "health",
      label: "Health",
    },
  ];

  return (
    <>
      <Header
        title="Integrations"
        subtitle="Manage integrations, webhooks, and system health"
      />

      <div className={cn("p-6")}>
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="underline"
          size="md"
          className={cn("mb-6")}
        />

        {activeTab === "overview" && (
          <div>{children}</div>
        )}
        {activeTab === "webhooks" && (
          <div>Webhooks content would load here</div>
        )}
        {activeTab === "health" && (
          <div>Health content would load here</div>
        )}
      </div>
    </>
  );
}
