import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Blocks,
  BookOpenCheck,
  Building2,
  Calculator,
  MonitorSmartphone,
  Network,
  UsersRound,
} from "lucide-react";

import { CreateLaunchGallery } from "@/components/CreateLaunchGallery";
import { Reveal } from "@/components/Reveal";
import {
  creationCatalogue,
  websiteShowcases,
  type CreationCategory,
} from "@/data/creations";

import styles from "./CreatePage.module.css";

export const metadata: Metadata = {
  title: "Create",
  description:
    "Explore websites, digital tools, research and AI systems, learning environments, institutional platforms, and practical utilities created by kingXford & Co.",
  alternates: { canonical: "/create" },
  openGraph: {
    title: "What we create — kingXford & Co",
    description:
      "Three complete website concepts and a wider catalogue of digital tools and systems for institutions, schools, industries, and everyday life.",
    type: "website",
    url: "/create",
  },
  twitter: {
    card: "summary_large_image",
    title: "What we create — kingXford & Co",
    description:
      "Websites, digital tools, research systems, learning environments, and practical utilities designed around real work.",
  },
};

const categoryIcons: Record<CreationCategory, typeof MonitorSmartphone> = {
  websites: MonitorSmartphone,
  "digital-tools": Calculator,
  "institutional-systems": Building2,
  "research-ai-tools": Network,
  "operational-tools": Blocks,
  "education-tools": BookOpenCheck,
  "personal-tools": UsersRound,
};

export default function CreatePage() {
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "What kingXford & Co creates",
    description:
      "A catalogue of websites, digital tools, research systems, learning environments, institutional platforms, and practical utilities.",
    hasPart: websiteShowcases.map((showcase, index) => ({
      "@type": "CreativeWork",
      position: index + 1,
      name: showcase.name,
      description: showcase.thesis,
      url: showcase.previewHref,
      genre: `${showcase.sector} website concept demonstration`,
    })),
  };

  return (
    <main className={`page ${styles.page}`}>
      <script
        id="create-collection-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />

      <section className={styles.hero} aria-labelledby="create-heading">
        <div className={styles.heroIndex}>Create / Capabilities and demonstrations</div>
        <div className={styles.heroCopy}>
          <Reveal>
            <p className="eyebrow">kingXford &amp; Co · Designed around real work</p>
          </Reveal>
          <Reveal distance={48}>
            <h1 id="create-heading">What should exist next?</h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p>
              Websites, digital tools, research systems, learning environments,
              and practical utilities for industries, schools, institutions,
              communities, and everyday life.
            </p>
          </Reveal>
        </div>
        <aside className={styles.heroAside}>
          <p>
            Start with the work people need to do—not a template, a trend, or a
            predetermined technology.
          </p>
          <a className="text-link" href="#websites">
            <span>Enter the website gallery</span>
            <ArrowDownRight aria-hidden="true" />
          </a>
        </aside>
        <nav className={styles.heroRail} aria-label="Creation categories">
          {creationCatalogue.map((item) => (
            <a href={`#${item.slug}`} key={item.slug}>
              <span>{item.index}</span>
              {item.name}
            </a>
          ))}
        </nav>
      </section>

      <section className={styles.showcases} id="websites" aria-labelledby="websites-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Websites / Three sectors / Three systems</p>
            <h2 id="websites-heading">Interactive concept prototypes, built to be explored.</h2>
          </div>
          <p>
            Each fictional prototype pairs working interface states with licensed
            contextual photography and explicit limits. They demonstrate design
            direction—not an operating institution, client engagement, or outcome.
          </p>
        </div>

        <Reveal>
          <CreateLaunchGallery />
        </Reveal>
      </section>

      <section className={styles.catalogue} aria-labelledby="catalogue-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Beyond websites</p>
            <h2 id="catalogue-heading">Useful systems for consequential and everyday work.</h2>
          </div>
          <p>
            The catalogue is organized by the need being solved. Every build can
            combine research, design, development, AI, and operational thinking
            where those capabilities are genuinely useful.
          </p>
        </div>

        <div className={styles.catalogueList}>
          {creationCatalogue.map((item) => {
            const Icon = categoryIcons[item.slug];
            return (
              <article
                className={styles.catalogueItem}
                id={item.slug === "websites" ? "websites-capability" : item.slug}
                key={item.slug}
              >
                <div className={styles.catalogueIndex}>
                  <span>{item.index}</span>
                  <Icon aria-hidden="true" />
                </div>
                <div className={styles.catalogueLead}>
                  <p className="eyebrow">{item.eyebrow}</p>
                  <h3>{item.name}</h3>
                  <p>{item.thesis}</p>
                </div>
                <div className={styles.catalogueDetails}>
                  <p>{item.overview}</p>
                  <div className={styles.catalogueColumns}>
                    <div>
                      <h4>What this can include</h4>
                      <ul>
                        {item.capabilities.map((capability) => (
                          <li key={capability}>{capability}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4>Examples</h4>
                      <ul>
                        {item.exampleNeeds.map((need) => (
                          <li key={need}>{need}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <Link className="text-link" href={item.cta.href}>
                    <span>{item.cta.label}</span>
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <Reveal className={styles.close}>
        <p className="eyebrow">A need that does not fit a category?</p>
        <h2>Good. Begin with the problem—not the menu.</h2>
        <div className={styles.closeActions}>
          <Link className="button button--primary" href="/contact?brief=create">
            <span>Bring us the need</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <Link className="button button--quiet" href="/work">
            <span>See published work</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
