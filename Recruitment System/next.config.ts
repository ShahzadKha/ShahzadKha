import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // CV uploads: 4 MB per file plus form overhead
    serverActions: { bodySizeLimit: "5mb" },
  },
  // Parsing libraries that must run as plain Node modules
  serverExternalPackages: ["unpdf", "mammoth"],
};

export default nextConfig;
