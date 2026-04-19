import type { Metadata } from "next";
import { DM_Serif_Display, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const dmSerifDisplay = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Using Inter as body font fallback until Satoshi font files are added
// To use Satoshi: download from fontshare.com, place woff2 files in public/fonts/,
// then switch to next/font/local with Satoshi-Regular/Medium/Bold.woff2
const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "GastroBridge — Tutti i tuoi fornitori. Un solo posto.",
    template: "%s | GastroBridge",
  },
  description:
    "Marketplace B2B per la ristorazione. Confronta prezzi, scopri fornitori e gestisci ordini Ho.Re.Ca. da un unico punto.",
  keywords: [
    "fornitori ristorazione",
    "marketplace B2B",
    "Ho.Re.Ca.",
    "confronto prezzi alimentari",
    "ordini ristorante",
  ],
  manifest: "/manifest.webmanifest",
  applicationName: "GastroBridge",
  appleWebApp: {
    capable: true,
    title: "GastroBridge",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "GastroBridge — Tutti i tuoi fornitori. Un solo posto.",
    description:
      "Marketplace B2B per la ristorazione. Confronta prezzi, scopri fornitori e gestisci ordini da un unico punto.",
    siteName: "GastroBridge",
    locale: "it_IT",
    type: "website",
  },
};

export const viewport: import("next").Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFBF5" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0D11" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${dmSerifDisplay.variable} ${bodyFont.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-body antialiased bg-cream text-charcoal">
        <ThemeProvider>
          <PostHogProvider>
            {children}
            <Toaster />
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
