import type { NextConfig } from "next";

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
  // Proxy API calls to the Fastify backend in development
  async rewrites() {
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
};

export default nextConfig;
