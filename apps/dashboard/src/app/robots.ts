import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // This is a private SaaS dashboard, so we disallow all crawling except for specific services
  return {
    rules: [
      {
        // Default rule: disallow most crawlers from private routes
        userAgent: "*",
        disallow: [
          "/",
          "/admin",
          "/settings",
          "/api",
          "/auth",
          "/dashboard",
          "/tracking",
          "/routing",
          "/fleet",
          "/field-service",
          "/crm",
          "/eld",
          "/finance",
          "/freight",
          "/shipping",
          "/supply-chain",
          "/products",
          "/orders",
          "/pos",
          "/esignatures",
          "/integrations",
          "/collaboration",
          "/healthcare",
        ],
        crawlDelay: 10,
      },
      {
        // Allow specific services to crawl certain non-sensitive content if needed
        userAgent: "Googlebot",
        disallow: ["/"],
        crawlDelay: 0,
      },
      {
        userAgent: "Bingbot",
        disallow: ["/"],
        crawlDelay: 0,
      },
    ],
    sitemap: "https://dashboard.witylogix.com/sitemap.xml",
    host: "https://dashboard.witylogix.com",
  };
}
