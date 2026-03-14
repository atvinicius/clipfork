import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "ClipFork — Fork any viral. Ship your version.",
    template: "%s | ClipFork",
  },
  description:
    "Paste a TikTok or Instagram URL. ClipFork deconstructs the viral structure — hooks, pacing, transitions, music cues — and rebuilds it with your product, your brand, your voice. First video in under 10 minutes.",
  keywords: [
    "viral video cloning",
    "UGC video automation",
    "TikTok ad creator",
    "viral structure analysis",
    "video format cloning",
    "DTC video ads",
    "UGC content creation",
    "TikTok marketing tool",
    "Instagram Reels creator",
    "ad creative automation",
  ],
  authors: [{ name: "ClipFork" }],
  creator: "ClipFork",
  metadataBase: new URL("https://clipfork.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://clipfork.app",
    siteName: "ClipFork",
    title: "ClipFork — Fork any viral. Ship your version.",
    description:
      "Paste a TikTok or Instagram URL. AI deconstructs the viral structure and rebuilds it with your product, your brand, your voice.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ClipFork — Viral video structure cloning platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ClipFork — Fork any viral. Ship your version.",
    description:
      "Paste a TikTok or Instagram URL. AI deconstructs the viral structure and rebuilds it with your product, your brand, your voice.",
    images: ["/og-image.png"],
    creator: "@clipfork",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ClipFork",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description:
    "AI-powered viral video structure cloning platform. Paste a TikTok or Instagram URL, deconstruct what makes it viral, and rebuild it with your brand.",
  url: "https://clipfork.app",
  offers: [
    {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      name: "Free",
      description: "3 video forks per month",
    },
    {
      "@type": "Offer",
      price: "29",
      priceCurrency: "USD",
      name: "Starter",
      description: "20 forks per month with full viral cloning",
    },
    {
      "@type": "Offer",
      price: "79",
      priceCurrency: "USD",
      name: "Growth",
      description: "80 forks per month with analytics and 4K export",
    },
    {
      "@type": "Offer",
      price: "199",
      priceCurrency: "USD",
      name: "Scale",
      description: "Unlimited forks with API access",
    },
  ],
  featureList: [
    "Viral structure cloning from TikTok and Instagram",
    "AI script generation with proven hook frameworks",
    "Smart asset replacement",
    "Batch variant generation",
    "Multi-platform export",
    "Performance analytics",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
