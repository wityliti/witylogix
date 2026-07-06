"use client";

import { useCallback } from "react";
import { useCrmConnection } from "@/hooks/use-crm-connection";
import type { OAuthConfig } from "./types";

export function useOAuthHandler() {
  const { initiateOAuth } = useCrmConnection();

  const handleStartOAuth = useCallback(
    (selectedPlatform: string | null) => {
      if (!selectedPlatform) return;

      // In a real implementation, you'd get these from environment variables
      const oauthConfig: OAuthConfig = {
        platformId: selectedPlatform,
        clientId: process.env.NEXT_PUBLIC_CRM_CLIENT_ID || "",
        redirectUri: `${typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/crm/oauth/callback`,
        scope: ["contacts", "deals"],
      };

      initiateOAuth(oauthConfig);
    },
    [initiateOAuth],
  );

  return { handleStartOAuth };
}
