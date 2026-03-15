import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ugc/db", "@ugc/shared"],
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;
