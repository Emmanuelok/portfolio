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
  "https://my-portfolio-six-teal-90.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kingxford — Design, Digital Products & Research Experiences",
    template: "%s | Kingxford",
  },
  description:
    "Kingxford is a multidisciplinary creative company spanning digital design and development in the Studio, open-ended creative services in the Living Room, and scientific and academic work in the Lab.",
  keywords: [
    "Kingxford",
    "Studio",
    "Living Room",
    "Lab",
    "multidisciplinary creative company",
    "multidisciplinary design",
    "product design",
    "web design",
    "visual systems",
    "digital products",
    "research interfaces",
    "artificial intelligence essays",
    "design media",
  ],
  authors: [{ name: "Kingxford", url: siteUrl }],
  creator: "Kingxford",
  publisher: "Kingxford",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: "/",
    siteName: "Kingxford",
    title: "Complex ideas. Unforgettable form. | Kingxford",
    description:
      "Studio, Living Room, and Lab: digital products, open-ended creative services, and research experiences by Kingxford.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Kingxford — Complex ideas. Unforgettable form.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kingxford — Studio · Living Room · Lab",
    description:
      "Complex ideas. Unforgettable form. Selected digital products and visual systems.",
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
    const saved = localStorage.getItem("ek-portfolio-theme");
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
  name: "Kingxford",
  url: siteUrl,
  sameAs: ["https://github.com/Emmanuelok/portfolio"],
  description:
    "A multidisciplinary creative company spanning digital design and development, open-ended creative services, and scientific and academic work.",
  knowsAbout: [
    "Digital product design",
    "Visual systems",
    "Web experiences",
    "Research interfaces",
    "Information architecture",
    "Artificial intelligence",
    "Editorial publishing",
  ],
  address: {
    "@type": "PostalAddress",
    addressCountry: "CA",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Kingxford",
  url: siteUrl,
  creator: {
    "@type": "Organization",
    name: "Kingxford",
  },
  description:
    "A multidisciplinary creative platform spanning digital design and development, open-ended creative services, scientific and academic work, and original media.",
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
