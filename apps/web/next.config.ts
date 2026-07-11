import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@honey/config",
    "@honey/db",
    "@honey/domain",
    "@honey/i18n",
    "@honey/ui",
  ],
};

export default nextConfig;
