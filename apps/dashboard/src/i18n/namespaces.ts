/**
 * Translation namespaces - organize translations by domain
 */

export const defaultNS = "common";

export const namespaces = [
  "common",
  "auth",
  "onboarding",
  "dashboard",
  "orders",
  "drivers",
  "deliveries",
  "settings",
  "integrations",
] as const;

export type Namespace = (typeof namespaces)[number];

export const resources = {
  en: {
    common: require("../../../messages/en.json"),
  },
  es: {
    common: require("../../../messages/es.json"),
  },
  fr: {
    common: require("../../../messages/fr.json"),
  },
} as const;
