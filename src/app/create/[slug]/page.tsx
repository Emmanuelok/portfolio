import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProjectSeedAction } from "@/components/ProjectSeedAction";
import { WebsiteShowcase } from "@/components/WebsiteShowcase";
import { websiteShowcases } from "@/data/creations";

type ShowcasePageProps = Readonly<{
  params: Promise<{ slug: string }>;
}>;

// Known demonstrations are prerendered, while unknown slugs reach the explicit
// notFound() boundary below. This avoids Next treating an ordinary 404 as an
// internal no-fallback error in production logs.
export const dynamicParams = true;

export function generateStaticParams() {
  return websiteShowcases.map((showcase) => ({ slug: showcase.slug }));
}

export async function generateMetadata({
  params,
}: ShowcasePageProps): Promise<Metadata> {
  const { slug } = await params;
  const showcase = websiteShowcases.find((item) => item.slug === slug);
  if (!showcase) return {};

  const title = `${showcase.name} — ${showcase.sector} website concept`;
  return {
    title,
    description: showcase.overview,
    alternates: { canonical: showcase.previewHref },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url: showcase.previewHref,
      title: `${title} | kingXford & Co`,
      description: showcase.thesis,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | kingXford & Co`,
      description: showcase.thesis,
    },
  };
}

export default async function ShowcasePage({ params }: ShowcasePageProps) {
  const { slug } = await params;
  const showcase = websiteShowcases.find((item) => item.slug === slug);
  if (!showcase) notFound();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: showcase.name,
    headline: showcase.thesis,
    description: showcase.overview,
    genre: `${showcase.sector} website concept demonstration`,
    creator: { "@type": "Organization", name: "kingXford & Co" },
    url: showcase.previewHref,
    isBasedOn: "A fictional design brief created for portfolio demonstration",
    usageInfo: showcase.disclosure,
  };

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Create", item: "/create" },
      { "@type": "ListItem", position: 2, name: showcase.name, item: showcase.previewHref },
    ],
  };

  return (
    <>
      <script
        id={`showcase-schema-${showcase.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        id={`showcase-breadcrumbs-${showcase.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <WebsiteShowcase showcase={showcase} />
      <section className="page-cta" aria-labelledby="showcase-canvas-title">
        <p className="eyebrow">Continue in Kingxford Canvas</p>
        <h2 id="showcase-canvas-title">
          Use this demonstration as a starting point for your own project.
        </h2>
        <ProjectSeedAction
          seed={{
            action: "start-project",
            source: {
              kind: "create",
              href: `/create/${showcase.slug}`,
              label: `Concept demonstration: ${showcase.name}`,
            },
            payload: {
              title: `${showcase.name} project`,
              brief: `${showcase.overview}\n\nStarting proposition: ${showcase.thesis}`,
              evidence: [
                {
                  title: `${showcase.sector} concept capabilities`,
                  content: showcase.capabilities.join("\n"),
                  sourceUrl: `/create/${showcase.slug}`,
                },
              ],
              tags: [showcase.sector, "concept-demonstration"],
            },
          }}
          label="Start a project from this demonstration"
          description="Create a new project with the demonstration brief, capabilities, and disclosure included."
        />
      </section>
    </>
  );
}
