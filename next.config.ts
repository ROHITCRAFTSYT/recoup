import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Prisma out of the bundle — it loads its query engine at runtime.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;
