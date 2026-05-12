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
    const supabaseOrigin = (() => {
      try {
        const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
        return u ? new URL(u).origin : "";
      } catch {
        return "";
      }
    })();
    const supabaseWs = supabaseOrigin ? supabaseOrigin.replace(/^https/, "wss") : "";
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

    // CSP. `unsafe-inline` retained for styles + scripts due to Next.js inline
    // bootstrap and runtime styles; tighten to nonce-based when Next supports
    // strict-dynamic on stable. `unsafe-eval` intentionally omitted.
    // Vercel Live + Toolbar inject script/iframe/websocket on previews and
    // (optionally) production. Allowlist or they pollute the console with
    // CSP violations and inject orphan DOM nodes that break React unmount.
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' https://js.stripe.com ${posthogHost} https://vercel.live https://*.vercel.live`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://vercel.live https://*.vercel.live",
      "font-src 'self' data: https://fonts.gstatic.com https://vercel.live https://*.vercel.live https://assets.vercel.com",
      `img-src 'self' data: blob: ${supabaseOrigin} https://*.stripe.com https://vercel.live https://*.vercel.live https://vercel.com`.trim(),
      `connect-src 'self' ${supabaseOrigin} ${supabaseWs} https://api.stripe.com ${posthogHost} https://*.ingest.sentry.io https://vercel.live https://*.vercel.live wss://*.pusher.com`.replace(/\s+/g, " ").trim(),
      "frame-src https://js.stripe.com https://hooks.stripe.com https://vercel.live https://*.vercel.live",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      // `upgrade-insecure-requests` is ignored when CSP is delivered
      // report-only — skip until policy is promoted to enforced.
    ].join("; ");

    const securityHeaders = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(self), interest-cohort=(), payment=(self), usb=()",
      },
      // COOP/CORP can break Supabase auth popups/realtime — relax until verified.
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
      // Report-only CSP first to surface violations without breaking the app.
      // Promote to enforced "Content-Security-Policy" after Vercel logs show
      // no critical violations for 24h.
      { key: "Content-Security-Policy-Report-Only", value: csp },
    ];

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
      {
        // Apply security headers to every route.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
