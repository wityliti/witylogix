import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // TypeScript build errors are now properly fixed — no suppression needed
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
