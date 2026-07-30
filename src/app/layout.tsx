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
    default:
      "Kingxford — Design, Digital Products & Research Experiences by Emmanuel Kingsford Owusu",
    template: "%s | Kingxford",
  },
  description:
    "Kingxford is the multidisciplinary creative platform of Emmanuel Kingsford Owusu—spanning digital design and development in the Studio, open-ended creative services in the Living Room, and scientific and academic work in the Lab.",
  keywords: [
    "Kingxford",
    "Studio",
    "Living Room",
    "Lab",
    "Emmanuel Kingsford Owusu",
    "multidisciplinary designer",
    "product design",
    "web design",
    "visual systems",
    "digital products",
    "research interfaces",
  ],
  authors: [{ name: "Emmanuel Kingsford Owusu", url: siteUrl }],
  creator: "Emmanuel Kingsford Owusu",
  publisher: "Kingxford",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: "/",
    siteName: "Kingxford",
    title: "Complex ideas. Unforgettable form. | Kingxford",
    description:
      "Studio, Living Room, and Lab: digital products, open-ended creative services, and research experiences by Emmanuel Kingsford Owusu.",
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

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Emmanuel Kingsford Owusu",
  url: siteUrl,
  sameAs: ["https://github.com/Emmanuelok"],
  jobTitle: "Multidisciplinary designer, researcher, and product builder",
  knowsAbout: [
    "Digital product design",
    "Visual systems",
    "Web experiences",
    "Research interfaces",
    "Information architecture",
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
    "@type": "Person",
    name: "Emmanuel Kingsford Owusu",
  },
  description:
    "A multidisciplinary creative platform spanning digital design and development, open-ended creative services, and scientific and academic work.",
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
          id="person-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
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
