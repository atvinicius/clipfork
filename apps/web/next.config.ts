import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ugc/db", "@ugc/shared"],
};

export default nextConfig;
