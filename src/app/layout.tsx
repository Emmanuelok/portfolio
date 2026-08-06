import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import { MotionProvider } from "@/components/MotionProvider";
import { PlatformContinuityDock } from "@/components/platform/PlatformContinuityDock";
import { ScrollProgress } from "@/components/ScrollProgress";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://kingxford.co";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "kingXford & Co — Research, Digital Systems and Responsible AI",
    template: "%s | kingXford & Co",
  },
  description:
    "kingXford & Co develops research-led digital systems and responsible AI tools for complex organisational and public-interest work.",
  keywords: [
    "kingXford & Co",
    "research and development",
    "responsible AI",
    "applied research",
    "website and digital platform development",
    "digital tools",
    "educational technology",
    "research software",
    "institutional systems",
    "AI-assisted project review",
    "project lifecycle management",
  ],
  authors: [{ name: "kingXford & Co", url: siteUrl }],
  creator: "kingXford & Co",
  publisher: "kingXford & Co",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "kingXford & Co",
    title: "Research, Digital Systems and Responsible AI | kingXford & Co",
    description:
      "Research-led digital systems and responsible AI tools for complex organisational and public-interest work.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "kingXford & Co — Research, Digital Systems and Responsible AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "kingXford & Co — Research, Digital Systems and Responsible AI",
    description:
      "Research-led digital systems and responsible AI tools for complex organisational and public-interest work.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
    { media: "(prefers-color-scheme: light)", color: "#f1ede3" },
  ],
};

const themeBootstrap = `
(() => {
  try {
    const saved = localStorage.getItem("kxco-theme");
    const choice = saved === "dark" || saved === "light" || saved === "system" ? saved : "system";
    const resolved = choice === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : choice;
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.themeChoice = choice;
    root.style.colorScheme = resolved;
  } catch {}
})();
`;

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "kingXford & Co",
  url: siteUrl,
  description:
    "A research and development company that designs digital systems and responsible AI tools for complex organisational and public-interest work.",
  knowsAbout: [
    "Research and development",
    "Responsible artificial intelligence",
    "Complex problem solving",
    "Digital product development",
    "Institutional systems",
    "Knowledge systems",
    "Website and digital platform development",
    "Digital tool design",
    "Scientific and research platforms",
    "Financial information systems",
    "Educational technology",
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "kingXford & Co creation capabilities",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Websites and digital platforms",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Digital tools and operational systems",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Research and learning systems",
        },
      },
    ],
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "kingXford & Co",
  url: siteUrl,
  creator: {
    "@type": "Organization",
    name: "kingXford & Co",
  },
  description:
    "Applied research, digital product development, responsible AI, and evidence-led publications.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script
          id="theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
        <script
          id="organization-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          id="website-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <MotionProvider>
          <ScrollProgress />
          <SiteHeader />
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
          <SiteFooter />
          <PlatformContinuityDock />
        </MotionProvider>
      </body>
    </html>
  );
}
