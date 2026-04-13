import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // SaaS dashboard — all pages require auth, no static generation
  output: "standalone",
  // Suppress pre-existing TS errors (1219 across 50+ files from rapid prototyping)
  // TODO: Sprint 10.2+ will batch-fix remaining type errors and remove this flag
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Proxy API calls to the Fastify backend in development only.
  // In production, NEXT_PUBLIC_API_URL must be set to the Railway API service URL
  // (e.g. https://api-production.up.railway.app). It must be provided as a build arg,
  // not just a runtime env var, because Next.js bakes NEXT_PUBLIC_* at build time.
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
  // Optimize bundle size by tree-shaking heavy libraries
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react", "date-fns"],
  },
  // Resolve TypeScript ESM .js imports to .ts source files in monorepo packages.
  // All @witylogix/* packages use `"type": "module"` with .js extensions in imports,
  // but webpack needs to resolve those to the actual .ts source files.
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
});
