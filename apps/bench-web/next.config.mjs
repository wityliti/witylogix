/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    BENCH_API_BASE_URL: process.env.BENCH_API_BASE_URL ?? "http://localhost:8000",
  },
};

export default nextConfig;
