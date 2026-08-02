import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Blocks,
  BookOpenCheck,
  Building2,
  Calculator,
  FlaskConical,
  GraduationCap,
  Landmark,
  MonitorSmartphone,
  Network,
  UsersRound,
} from "lucide-react";

import { Reveal } from "@/components/Reveal";
import {
  creationCatalogue,
  websiteShowcases,
  type CreationCategory,
  type WebsiteShowcase,
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

function sectorKey(showcase: WebsiteShowcase) {
  if (showcase.sector === "Scientific research") return "science";
  if (showcase.sector === "Finance") return "finance";
  return "education";
}

function SciencePreview() {
  return (
    <div className={styles.sciencePreview} aria-hidden="true">
      <div className={styles.previewNav}>
        <strong>LVL</strong>
        <span>Methods</span>
        <span>Facilities</span>
      </div>
      <div className={styles.scienceField}>
        <span className={styles.scienceRing} />
        <span className={styles.scienceAxis} />
        <span className={styles.scienceSample}>S–014</span>
        <span className={styles.scienceScale}>20 μm · illustrative</span>
      </div>
      <div className={styles.previewRows}>
        <span>Materials systems</span>
        <span>Environmental sensing</span>
        <span>Open methods</span>
      </div>
    </div>
  );
}

function FinancePreview() {
  return (
    <div className={styles.financePreview} aria-hidden="true">
      <div className={styles.financeMasthead}>
        <strong>MERIDIAN</strong>
        <span>Governance ledger / 01</span>
      </div>
      <p>Capital governed by mandate.</p>
      <div className={styles.financePath}>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className={styles.financeLedger}>
        <span>Mandate</span>
        <strong>Evidence before action</strong>
        <span>Review</span>
        <strong>Decision rights visible</strong>
      </div>
    </div>
  );
}

function EducationPreview() {
  return (
    <div className={styles.educationPreview} aria-hidden="true">
      <div className={styles.educationMasthead}>
        <span>COMMONFIELD</span>
        <strong>INSTITUTE</strong>
      </div>
      <p>Learn by building the question.</p>
      <div className={styles.educationSchedule}>
        <span>INQ 101</span>
        <span>Studio</span>
        <span>Field</span>
        <span>Seminar</span>
        <span>Public work</span>
      </div>
    </div>
  );
}

function WebsiteConceptCard({
  showcase,
  index,
}: Readonly<{ showcase: WebsiteShowcase; index: number }>) {
  const sector = sectorKey(showcase);
  const SectorIcon =
    sector === "science"
      ? FlaskConical
      : sector === "finance"
        ? Landmark
        : GraduationCap;

  return (
    <article className={styles.showcaseCard} data-sector={sector}>
      <div className={styles.showcaseCardTopline}>
        <span>{String(index + 1).padStart(2, "0")} / Website concept</span>
        <span>
          <SectorIcon aria-hidden="true" /> {showcase.sector}
        </span>
      </div>
      <Link
        className={styles.showcasePreviewLink}
        href={showcase.previewHref}
        aria-label={`Explore ${showcase.name}, a fictional ${showcase.sector.toLocaleLowerCase()} website concept`}
      >
        <div className={styles.showcaseBrowser}>
          <div className={styles.browserBar} aria-hidden="true">
            <span />
            <span />
            <span />
            <small>kingXford &amp; Co / concept demonstration</small>
          </div>
          {sector === "science" ? (
            <SciencePreview />
          ) : sector === "finance" ? (
            <FinancePreview />
          ) : (
            <EducationPreview />
          )}
        </div>
      </Link>
      <div className={styles.showcaseCopy}>
        <div>
          <p className="eyebrow">{showcase.eyebrow}</p>
          <h3>{showcase.name}</h3>
        </div>
        <div>
          <p>{showcase.thesis}</p>
          <Link className="text-link" href={showcase.previewHref}>
            <span>Explore the complete concept</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

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
            <h2 id="websites-heading">Not mockups. Complete design propositions.</h2>
          </div>
          <p>
            Each concept is rendered with live HTML and CSS at every size. No
            generated futuristic imagery, repetitive visual formula, invented
            client, or unsupported outcome.
          </p>
        </div>

        <div className={styles.showcaseList}>
          {websiteShowcases.map((showcase, index) => (
            <Reveal delay={index * 0.05} key={showcase.slug}>
              <WebsiteConceptCard showcase={showcase} index={index} />
            </Reveal>
          ))}
        </div>
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
