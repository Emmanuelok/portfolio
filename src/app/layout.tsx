import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import { MotionProvider } from "@/components/MotionProvider";
import { ScrollProgress } from "@/components/ScrollProgress";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://portfolio-flame-psi-88.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "kingXford & Co — Intelligence for Sustainable Abundance",
    template: "%s | kingXford & Co",
  },
  description:
    "kingXford & Co advances intelligence, research and development, and responsible AI to help people and institutions solve complex problems and prepare for sustainable abundance.",
  keywords: [
    "kingXford & Co",
    "intelligence",
    "research and development",
    "responsible AI",
    "sustainable abundance",
    "abundant future",
    "complex problem solving",
    "complex project development",
    "institutional intelligence",
    "applied research",
    "strategic foresight",
    "website and digital platform development",
    "digital tools",
    "educational technology",
    "Studio",
    "Living Room",
    "Lab",
  ],
  authors: [{ name: "kingXford & Co", url: siteUrl }],
  creator: "kingXford & Co",
  publisher: "kingXford & Co",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "kingXford & Co",
    title: "Intelligence for Sustainable Abundance | kingXford & Co",
    description:
      "Research, development, and responsible AI for people and institutions solving complex problems and preparing an abundant future.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "kingXford & Co — Intelligence for Sustainable Abundance",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "kingXford & Co — Intelligence for Sustainable Abundance",
    description:
      "Research, development, and responsible AI for complex problems, ambitious ideas, and an abundant future.",
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
    "A company advancing intelligence, research and development, and responsible AI to help people and institutions solve complex problems and prepare for sustainable abundance.",
  knowsAbout: [
    "Strategic intelligence",
    "Research and development",
    "Responsible artificial intelligence",
    "Sustainable abundance",
    "Complex problem solving",
    "Complex project development",
    "Institutional transformation",
    "Strategic foresight",
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
          name: "Research, intelligence, and learning systems",
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
    "Intelligence, R&D, responsible AI, complex project development, and evidence-led media for sustainable abundance.",
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
        </MotionProvider>
      </body>
    </html>
  );
}
