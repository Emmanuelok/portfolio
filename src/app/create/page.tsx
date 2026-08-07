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
import { workflowTemplateById } from "@/lib/workspace/workflow-templates";

import styles from "./CreatePage.module.css";

export const metadata: Metadata = {
  title: "Create websites, tools, and systems",
  description:
    "Explore website demonstrations, digital product categories, and Kingxford Canvas—a project workspace for developing ideas, prototypes, evidence, decisions, and delivery briefs.",
  alternates: { canonical: "/create" },
  openGraph: {
    title: "What we create — kingXford & Co",
    description:
      "An interactive project workspace, three website demonstrations, and a catalogue of digital tools and systems for institutions, schools, industries, and everyday life.",
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
    hasPart: [
      {
        "@type": "WebApplication",
        position: 1,
        name: "Kingxford Canvas",
        description:
          "A dual-pane project workspace for developing ideas, front-end prototypes, mind maps, prompts, and implementation briefs.",
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
        <div className={styles.heroIndex}>Create · Seven categories / Three interactive demonstrations / One project record</div>
        <div className={styles.heroCopy}>
          <Reveal>
            <p className="eyebrow">kingXford &amp; Co · Digital products and systems</p>
          </Reveal>
          <Reveal distance={48}>
            <h1 id="create-heading">What do you need to create?</h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p>
              Define the need, investigate the context, map the system, build a
              prototype, test it, and prepare it for delivery. Canvas keeps the
              drafts, evidence, decisions, and revisions connected to the same project.
            </p>
          </Reveal>
        </div>
        <aside className={styles.heroAside}>
          <p>
            Start with the work people need to do—not a template, a trend, or a
            predetermined technology.
          </p>
          <a className="text-link" href="#websites">
            <span>Explore the interactive demonstrations</span>
            <ArrowDownRight aria-hidden="true" />
          </a>
          <a className="text-link" href="#capabilities">
            <span>Explore all seven categories</span>
            <ArrowDownRight aria-hidden="true" />
          </a>
          <a className="text-link" href="#studio">
            <span>Open Canvas and Project Atlas</span>
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

      <nav className={styles.pageRouter} aria-label="Create sections">
        <a href="#websites"><span>01</span> Interactive demonstrations</a>
        <a href="#capabilities"><span>02</span> Creation categories</a>
        <a href="#studio"><span>03</span> Workflows + Project Atlas</a>
        <a href="#catalogue"><span>04</span> Complete catalogue</a>
        <Link href="/create/workspace"><span>↗</span> Open full workspace</Link>
      </nav>

      <section className={styles.showcases} id="websites" aria-labelledby="websites-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Websites / Three sectors / Three demonstrations</p>
            <h2 id="websites-heading">Explore three interactive website demonstrations.</h2>
          </div>
          <p>
            Each fictional demonstration combines working interface states with
            licensed contextual photography and clear limitations. It shows a
            possible design direction, not an operating institution, client project,
            or measured outcome.
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
            <p className="eyebrow">Creation categories / Seven project types</p>
            <h2 id="capability-menu-heading">Choose the category closest to your project.</h2>
          </div>
          <p>
            Start with the closest category. The same project can combine research,
            responsible AI, design, development, evidence, and delivery without
            fragmenting the work across separate services.
          </p>
        </div>

        <nav className={styles.capabilityGrid} aria-label="Seven creation directions">
          {creationCatalogue.map((item) => {
            const Icon = categoryIcons[item.slug];
            const workflow = workflowTemplateById(item.slug);
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
                  {workflow.phases.length} connected phases · {workflow.phases.length} human gates
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
            <p className="eyebrow">Kingxford Canvas + Project Atlas / Embedded project workspace</p>
            <h2 id="studio-heading">Develop a selected direction into a testable prototype with its project record intact.</h2>
          </div>
          <div>
            <p>
              Drafts, evidence, decisions, review proposals, revisions, and human
              approvals remain attached to one project stored on this device.
            </p>
            <Link className="text-link" href="/create/workspace">
              <span>Open the full Canvas workspace</span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </header>
        <div className={styles.studioFrame}>
          <CreativeWorkspace
            embedded
            initialMode={null}
          />
        </div>
      </section>

      <section className={styles.catalogue} id="catalogue" aria-labelledby="catalogue-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Complete catalogue</p>
            <h2 id="catalogue-heading">Digital products and systems for institutional and everyday work.</h2>
          </div>
          <p>
            The catalogue is organized by the problem being addressed. Each
            project can combine research, design, development, AI, and operational
            planning where those capabilities are appropriate.
          </p>
        </div>

        <div className={styles.catalogueList}>
          {creationCatalogue.map((item) => {
            const Icon = categoryIcons[item.slug];
            const workflow = workflowTemplateById(item.slug);
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
                  <div className={styles.workflowSummary}>
                    <div>
                      <span>Connected Atlas workflow</span>
                      <strong>{workflow.phases.length} phases · evidence threshold and human gate in every phase</strong>
                    </div>
                    <ol aria-label={`${item.name} workflow phases`}>
                      {workflow.phases.map((phase, index) => (
                        <li key={phase.phase}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          {phase.phase}
                          <small>{phase.evidence.minimumItems} evidence</small>
                        </li>
                      ))}
                    </ol>
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
        <p className="eyebrow">Have a project that does not fit these categories?</p>
        <h2>Start with the problem you need to solve.</h2>
        <div className={styles.closeActions}>
          <Link className="button button--primary" href="/contact?brief=create">
            <span>Discuss your project</span>
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
