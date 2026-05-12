import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // Larger devices benefit from AVIF; webp fallback for older browsers
    formats: ["image/avif", "image/webp"],
  },
  // Hint Next to scope tree-shaking on barrel files of these heavy libs.
  // Drops dozens of kB from initial chunks across both areas.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "recharts",
      "motion",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "sonner",
      "@react-email/components",
    ],
    // Keep RSC payloads for back/forward + sidebar nav warm.
    // 30s for dynamic routes is enough for the in-segment nav window;
    // realtime providers already invalidate locally on focus.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  // Long-cache static assets emitted by Next under /_next/static — these are
  // content-hashed, immutable, and safe to cache for a year.
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
