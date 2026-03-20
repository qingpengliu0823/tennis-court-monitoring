import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;
