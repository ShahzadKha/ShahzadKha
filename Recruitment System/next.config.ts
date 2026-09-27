import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // CV uploads: 4 MB per file plus form overhead
    serverActions: { bodySizeLimit: "5mb" },
  },
  // Parsing libraries that must run as plain Node modules
  serverExternalPackages: ["unpdf", "mammoth", "imapflow", "mailparser"],
  // Basic security headers on every page
  async headers() {
    return [
      {
        // Every page except the candidate form refuses to be shown inside another site
        source: "/((?!apply).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
      {
        // The candidate form can be embedded in the client's landing page (iframe)
        source: "/apply",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
