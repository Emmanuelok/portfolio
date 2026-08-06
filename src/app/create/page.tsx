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
import { CreativeWorkspace } from "@/components/workspace/CreativeWorkspace";
import {
  creationCatalogue,
  websiteShowcases,
  type CreationCategory,
} from "@/data/creations";

import styles from "./CreatePage.module.css";

export const metadata: Metadata = {
  title: "Kingxford Intelligence Workspace",
  description:
    "Use one Kingxford Intelligence Workspace to test ideas, code, mind maps, prompts, and briefs, preserve project evidence and decisions, and move the same work toward delivery.",
  alternates: { canonical: "/create" },
  openGraph: {
    title: "What we create — kingXford & Co",
    description:
      "A live creative workspace, three complete website concepts, and a wider catalogue of digital tools and systems for institutions, schools, industries, and everyday life.",
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
  const entrepreneurshipUrl =
    process.env.NEXT_PUBLIC_AI_ENTREPRENEURSHIP_URL?.trim() || null;
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "What kingXford & Co creates",
    description:
      "A catalogue of websites, digital tools, research systems, learning environments, institutional platforms, and practical utilities.",
    hasPart: [
      {
        "@type": "WebApplication",
        position: 1,
        name: "Kingxford Intelligence Workspace",
        description:
          "A dual-pane creative intelligence workspace for testing ideas, front-end code, mind maps, prompts, and briefs.",
        url: "/create/workspace",
        applicationCategory: "DesignApplication",
      },
      ...websiteShowcases.map((showcase, index) => ({
        "@type": "CreativeWork",
        position: index + 2,
        name: showcase.name,
        description: showcase.thesis,
        url: showcase.previewHref,
        genre: `${showcase.sector} website concept demonstration`,
      })),
    ],
  };

  return (
    <main className={`page ${styles.page}`}>
      <script
        id="create-collection-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />

      <section className={styles.hero} aria-labelledby="create-heading">
        <div className={styles.heroIndex}>Create · Seven directions / Three live proofs / One connected Atlas</div>
        <div className={styles.heroCopy}>
          <Reveal>
            <p className="eyebrow">kingXford &amp; Co · Designed around real work</p>
          </Reveal>
          <Reveal distance={48}>
            <h1 id="create-heading">What should exist next?</h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p>
              Discover it. Investigate it. Model it. Build it. Validate it.
              Then move the same project toward launch—with its source,
              evidence, decisions, and working proof still connected.
            </p>
          </Reveal>
        </div>
        <aside className={styles.heroAside}>
          <p>
            Start with the work people need to do—not a template, a trend, or a
            predetermined technology.
          </p>
          <a className="text-link" href="#websites">
            <span>Enter the concept gallery</span>
            <ArrowDownRight aria-hidden="true" />
          </a>
          <a className="text-link" href="#capabilities">
            <span>Explore all seven directions</span>
            <ArrowDownRight aria-hidden="true" />
          </a>
          <a className="text-link" href="#studio">
            <span>Open Canvas and Atlas</span>
            <ArrowDownRight aria-hidden="true" />
          </a>
        </aside>
        <nav className={styles.heroRail} aria-label="Creation categories">
          {creationCatalogue.map((item) => (
            <a href={`#capability-${item.slug}`} key={item.slug}>
              <span>{item.index}</span>
              {item.name}
            </a>
          ))}
        </nav>
      </section>

      <nav className={styles.pageRouter} aria-label="Kingxford Intelligence sections">
        <a href="#websites"><span>01</span> Live proofs</a>
        <a href="#capabilities"><span>02</span> Seven directions</a>
        <a href="#studio"><span>03</span> Canvas + Atlas</a>
        <a href="#catalogue"><span>04</span> Full catalogue</a>
        <Link href="/create/workspace"><span>↗</span> Focus mode</Link>
      </nav>

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

      <section
        className={styles.capabilityMenu}
        id="capabilities"
        aria-labelledby="capability-menu-heading"
        data-create-capability-menu
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Create menu / Seven directions / No disconnected services</p>
            <h2 id="capability-menu-heading">Seven ways to enter. One system carrying the work forward.</h2>
          </div>
          <p>
            Choose the closest starting direction. Research, responsible AI,
            design, development, evidence, and delivery can then assemble around
            the same Project Atlas instead of splitting into separate services.
          </p>
        </div>

        <nav className={styles.capabilityGrid} aria-label="Seven creation directions">
          {creationCatalogue.map((item) => {
            const Icon = categoryIcons[item.slug];
            return (
              <a href={`#capability-${item.slug}`} key={item.slug}>
                <span className={styles.capabilityMark}>
                  <small>{item.index}</small>
                  <Icon aria-hidden="true" />
                </span>
                <span className={styles.capabilityCopy}>
                  <small>{item.eyebrow}</small>
                  <strong>{item.name}</strong>
                  <span>{item.thesis}</span>
                </span>
                <span className={styles.capabilitySignal}>
                  {item.capabilities.length} capabilities · {item.exampleNeeds.length} examples
                  <ArrowDownRight aria-hidden="true" />
                </span>
              </a>
            );
          })}
        </nav>
      </section>

      <section
        className={styles.studioSection}
        id="studio"
        aria-labelledby="studio-heading"
        data-create-studio
      >
        <header className={styles.studioHeading}>
          <div>
            <p className="eyebrow">Canvas + Project Atlas / Embedded workspace</p>
            <h2 id="studio-heading">Move a chosen direction into working proof without losing its history.</h2>
          </div>
          <div>
            <p>
              Source, evidence, decisions, specialist intelligence, revisions,
              and human gates remain attached to one local-first project.
            </p>
            <Link className="text-link" href="/create/workspace">
              <span>Open Canvas in focus mode</span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </header>
        <div className={styles.studioFrame}>
          <CreativeWorkspace
            embedded
            entrepreneurshipUrl={entrepreneurshipUrl}
            initialMode={null}
          />
        </div>
      </section>

      <section className={styles.catalogue} id="catalogue" aria-labelledby="catalogue-heading">
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
            const legacyAnchor =
              item.slug === "websites" ? "websites-capability" : item.slug;
            return (
              <article
                className={styles.catalogueItem}
                data-create-capability={item.slug}
                id={`capability-${item.slug}`}
                key={item.slug}
              >
                <span
                  className={styles.anchorAlias}
                  id={legacyAnchor}
                  aria-hidden="true"
                />
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
