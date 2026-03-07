import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Suppress @types/react dual-version errors from lucide-react/recharts
  // until pnpm hoisting is fixed (React 19 + 18 types conflict)
  typescript: {
    ignoreBuildErrors: true,
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
};

export default nextConfig;
