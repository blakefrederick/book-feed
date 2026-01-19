import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    turbopack: {
      root: "/usr/local/var/www/book-feed"
    }
  }
};

export default nextConfig;
