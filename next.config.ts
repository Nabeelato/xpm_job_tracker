import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs", "exceljs"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
