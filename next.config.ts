import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 90, 94],
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
