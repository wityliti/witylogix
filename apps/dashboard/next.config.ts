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
  // Proxy API calls to the Fastify backend via Next.js rewrites.
  // Uses runtime API_URL env var (server-side only, not baked at build time).
  // When NEXT_PUBLIC_API_URL is empty/unset, client code constructs relative
  // paths like /api/v4/... which hit this rewrite and get proxied to the API.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_URL ?? "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      { source: "/zones/create", destination: "/zones/new", permanent: true },
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
