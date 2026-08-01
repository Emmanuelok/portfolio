import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import styles from "./SustainableAbundanceEvidence.module.css";

const sources = {
  energy:
    "https://www.worldbank.org/en/news/press-release/2026/06/16/accelerating-universal-energy-access",
  food:
    "https://www.fao.org/newsroom/detail/global-hunger-declines--but-rises-in-africa-and-western-asia--un-report/",
  internet:
    "https://www.itu.int/itu-d/reports/statistics/2025/10/15/ff25-internet-use/",
  renewables:
    "https://www.irena.org/News/pressreleases/2026/Apr/Near-700-GW-Surge-in-2025-Proves-Renewable-Energy-Resilience",
  research: "https://www.uis.unesco.org/en/2026-rd-data-release",
  resources: "https://www.unep.org/resources/Global-Resource-Outlook-2024",
  wash: "https://washdata.org/reports/jmp-2025-wash-households",
  aiEnergy: "https://www.iea.org/reports/energy-and-ai/energy-demand-from-ai",
} as const;

function SourceLink({
  children,
  href,
}: Readonly<{ children: ReactNode; href: string }>) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight aria-hidden="true" />
    </a>
  );
}

export function SustainableAbundanceEvidence() {
  return (
    <div className={styles.evidence}>
      <section
        className={styles.dashboard}
        id="evidence-dashboard"
        aria-labelledby="evidence-dashboard-title"
      >
        <header className={styles.sectionHeader}>
          <p>Evidence dashboard · latest official releases</p>
          <h2 id="evidence-dashboard-title">
            The opportunity is immense. So is the unfinished work.
          </h2>
          <p className={styles.intro}>
            These indicators describe different service gaps and may include
            many of the same people. They are shown side by side to reveal the
            shape of the challenge—never added into a single population total.
          </p>
        </header>

        <figure className={styles.metricFigure}>
          <div className={styles.metricGrid}>
            <article className={styles.metric}>
              <div className={styles.metricTopline}>
                <span>Energy access</span>
                <span>2024</span>
              </div>
              <strong>655m</strong>
              <p>people without access to electricity</p>
              <small>
                <SourceLink href={sources.energy}>
                  Tracking SDG 7, 2026
                </SourceLink>
                Global access estimate; “access” follows the SDG 7 indicator,
                not a measure of service reliability or affordability.
              </small>
            </article>

            <article className={styles.metric}>
              <div className={styles.metricTopline}>
                <span>Clean cooking</span>
                <span>2024</span>
              </div>
              <strong>≈2.0b</strong>
              <p>people without clean fuels and technologies for cooking</p>
              <small>
                <SourceLink href={sources.energy}>
                  Tracking SDG 7, 2026
                </SourceLink>
                Approximate global estimate. This population can overlap with
                the electricity-access population above.
              </small>
            </article>

            <article className={`${styles.metric} ${styles.metricWide}`}>
              <div className={styles.metricTopline}>
                <span>Water, sanitation and hygiene</span>
                <span>2024</span>
              </div>
              <div className={styles.metricTriplet}>
                <div>
                  <strong>2.1b</strong>
                  <p>lack safely managed drinking water</p>
                </div>
                <div>
                  <strong>3.4b</strong>
                  <p>lack safely managed sanitation</p>
                </div>
                <div>
                  <strong>1.7b</strong>
                  <p>lack basic hygiene services at home</p>
                </div>
              </div>
              <small>
                <SourceLink href={sources.wash}>WHO/UNICEF JMP, 2025</SourceLink>
                Three separate indicators. “Safely managed” water means an
                improved source on premises, available when needed and free
                from contamination; populations overlap and must not be summed.
              </small>
            </article>

            <article className={styles.metric}>
              <div className={styles.metricTopline}>
                <span>Chronic undernourishment</span>
                <span>2024</span>
              </div>
              <strong>673m</strong>
              <p>point estimate; modelled range 638–720 million</p>
              <small>
                <SourceLink href={sources.food}>SOFI, 2025</SourceLink>
                FAO defines hunger here as chronic undernourishment. Preserve
                the uncertainty interval when comparing or reporting the value.
              </small>
            </article>

            <article className={styles.metric}>
              <div className={styles.metricTopline}>
                <span>Internet use</span>
                <span>2025</span>
              </div>
              <strong>74%</strong>
              <p>6.0b online · 2.2b offline</p>
              <small>
                <SourceLink href={sources.internet}>
                  ITU Facts and Figures, 2025
                </SourceLink>
                Estimates use the global population denominator; being online
                does not by itself indicate affordability, quality, or skills.
              </small>
            </article>
          </div>
          <figcaption>
            Figure 1. A non-additive dashboard of foundational capability
            indicators. Sources and reference years are attached to each
            measure. Units, definitions, and populations differ; the cards are
            not components of one composite index.
          </figcaption>
        </figure>
      </section>

      <section
        className={styles.capacity}
        id="capacity-engine"
        aria-labelledby="capacity-engine-title"
      >
        <header className={styles.sectionHeader}>
          <p>Capacity engine · research, energy and computation</p>
          <h2 id="capacity-engine-title">
            Capability can compound—but it is uneven and resource-bound.
          </h2>
        </header>

        <div className={styles.chartGrid}>
          <figure className={styles.chart}>
            <div className={styles.chartHeading}>
              <div>
                <span>Researchers per million inhabitants</span>
                <strong>2023</strong>
              </div>
              <SourceLink href={sources.research}>UNESCO UIS, 2026</SourceLink>
            </div>
            <div
              className={styles.bars}
              role="img"
              aria-label="Researchers per million inhabitants in 2023: Europe and Northern America 4,358; world 1,486; sub-Saharan Africa 88."
            >
              <div className={styles.barRow}>
                <span>Europe + Northern America</span>
                <div className={styles.track}>
                  <span className={styles.barFull} />
                </div>
                <strong>4,358</strong>
              </div>
              <div className={styles.barRow}>
                <span>World</span>
                <div className={styles.track}>
                  <span className={styles.barWorld} />
                </div>
                <strong>1,486</strong>
              </div>
              <div className={styles.barRow}>
                <span>Sub-Saharan Africa</span>
                <div className={styles.track}>
                  <span className={styles.barAfrica} />
                </div>
                <strong>88</strong>
              </div>
            </div>
            <figcaption>
              Regional densities, not shares of a fixed total. UIS also reports
              global R&amp;D expenditure at 1.92% of GDP in 2023 and says 73% of
              reporting countries invested less than 1% of GDP. Regional
              aggregates can conceal country-level differences.
            </figcaption>
          </figure>

          <figure className={styles.chart}>
            <div className={styles.chartHeading}>
              <div>
                <span>Net renewable power additions</span>
                <strong>2025</strong>
              </div>
              <SourceLink href={sources.renewables}>IRENA, 2026</SourceLink>
            </div>
            <div
              className={styles.stack}
              role="img"
              aria-label="Of 692 gigawatts in net renewable power capacity additions in 2025, solar added 511 gigawatts, wind added 159 gigawatts, and other renewables made up the remainder."
            >
              <span className={styles.solar}>Solar · 511 GW</span>
              <span className={styles.wind}>Wind · 159 GW</span>
              <span className={styles.other} aria-label="Other renewables" />
            </div>
            <div className={styles.capacityTotal}>
              <div>
                <span>Total renewable capacity</span>
                <strong>5,149 GW</strong>
              </div>
              <div>
                <span>Added during 2025</span>
                <strong>692 GW</strong>
              </div>
              <div>
                <span>Share of total power-capacity expansion</span>
                <strong>85.6%</strong>
              </div>
            </div>
            <figcaption>
              Installed nameplate power capacity, not electricity generated.
              Solar and wind supplied 96.8% of net renewable additions; this
              does not mean they supplied 96.8% of total power generation.
            </figcaption>
          </figure>

          <figure className={`${styles.chart} ${styles.chartWide}`}>
            <div className={styles.chartHeading}>
              <div>
                <span>Electricity used by data centres</span>
                <strong>2024 → 2030</strong>
              </div>
              <SourceLink href={sources.aiEnergy}>IEA Energy and AI</SourceLink>
            </div>
            <div
              className={styles.energyComparison}
              role="img"
              aria-label="Global data-centre electricity consumption: 415 terawatt-hours in 2024 and 945 terawatt-hours in the IEA 2030 base case."
            >
              <div>
                <span>Observed estimate · 2024</span>
                <div className={styles.energyTrack}>
                  <span className={styles.energyNow}>415 TWh</span>
                </div>
              </div>
              <div>
                <span>IEA base case · 2030</span>
                <div className={styles.energyTrack}>
                  <span className={styles.energyFuture}>945 TWh</span>
                </div>
              </div>
            </div>
            <figcaption>
              The 2030 value is a scenario projection, not a guaranteed result.
              Both values cover all data centres, not AI alone; the IEA
              identifies AI as the most important driver of projected growth.
              Local grid impacts can be much larger than the global share
              suggests.
            </figcaption>
          </figure>
        </div>
      </section>

      <section
        className={styles.tableSection}
        id="evidence-register"
        aria-labelledby="evidence-register-title"
      >
        <header className={styles.sectionHeader}>
          <p>Evidence register · definitions before conclusions</p>
          <h2 id="evidence-register-title">
            One table, eight datasets, no invented total.
          </h2>
        </header>

        <div className={styles.tableScroll} tabIndex={0}>
          <table>
            <caption>
              Official indicators used in this briefing, with their reference
              years and interpretation boundaries.
            </caption>
            <thead>
              <tr>
                <th scope="col">System</th>
                <th scope="col">Reference</th>
                <th scope="col">Reported measure</th>
                <th scope="col">Definition or boundary</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Energy access</th>
                <td>2024</td>
                <td>655m without electricity; ≈2b without clean cooking</td>
                <td>Two separate SDG 7 access indicators; populations overlap.</td>
              </tr>
              <tr>
                <th scope="row">WASH</th>
                <td>2024</td>
                <td>2.1b water; 3.4b sanitation; 1.7b hygiene gaps</td>
                <td>Different service ladders; do not add the three values.</td>
              </tr>
              <tr>
                <th scope="row">Food</th>
                <td>2024</td>
                <td>673m; uncertainty range 638–720m</td>
                <td>Modelled prevalence of chronic undernourishment.</td>
              </tr>
              <tr>
                <th scope="row">Connectivity</th>
                <td>2025</td>
                <td>6.0b online; 2.2b offline; 74% online</td>
                <td>Internet use; not a measure of quality or affordability.</td>
              </tr>
              <tr>
                <th scope="row">Renewables</th>
                <td>2025</td>
                <td>5,149 GW total; 692 GW added</td>
                <td>Installed power capacity, not electricity generation.</td>
              </tr>
              <tr>
                <th scope="row">Research</th>
                <td>2023</td>
                <td>1.92% of GDP; 1,486 researchers per million</td>
                <td>Global aggregates; 73% of countries invested below 1%.</td>
              </tr>
              <tr>
                <th scope="row">Material resources</th>
                <td>2060 scenario</td>
                <td>Extraction could rise 60% from 2020 levels</td>
                <td>
                  UNEP trajectory without urgent action; not a certain forecast.
                </td>
              </tr>
              <tr>
                <th scope="row">Data centres</th>
                <td>2024 / 2030</td>
                <td>415 TWh / 945 TWh base case</td>
                <td>Total data-centre demand; 2030 is an IEA scenario.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={styles.tableNote}>
          Table 1. Values retain the source unit and reference year. The
          register is designed for interpretation, not arithmetic aggregation.
          Official links appear in the visual captions and research notes.
        </p>
      </section>

      <section
        className={styles.frameworkSection}
        id="design-framework"
        aria-labelledby="design-framework-title"
      >
        <header className={styles.sectionHeader}>
          <p>Original framework · a testable design loop</p>
          <h2 id="design-framework-title">
            Expand capability faster than harm.
          </h2>
        </header>

        <figure className={styles.framework}>
          <div
            className={styles.frameworkCanvas}
            role="img"
            aria-label="The kingXford and Company Sustainable Abundance Design Loop: start with essential capability and access; apply research, human expertise, trustworthy AI and institutional learning; build regenerative systems that deliver more usable capability per unit of energy, material, capital and attention; test distribution, resilience, ecological impact and accountability; then feed evidence back into the next design cycle."
          >
            <div className={`${styles.frameworkNode} ${styles.nodeOne}`}>
              <span>01 · Human floor</span>
              <strong>Essential capability</strong>
              <p>Health · water · food · energy · learning · connectivity</p>
            </div>
            <div className={styles.arrow} aria-hidden="true">→</div>
            <div className={`${styles.frameworkNode} ${styles.nodeTwo}`}>
              <span>02 · Intelligence</span>
              <strong>Learn and invent</strong>
              <p>Research · expertise · trustworthy AI · institutions</p>
            </div>
            <div className={styles.arrow} aria-hidden="true">→</div>
            <div className={`${styles.frameworkNode} ${styles.nodeThree}`}>
              <span>03 · Delivery</span>
              <strong>Build regenerative systems</strong>
              <p>More usable capability per unit of scarce resource</p>
            </div>
            <div className={styles.arrow} aria-hidden="true">→</div>
            <div className={`${styles.frameworkNode} ${styles.nodeFour}`}>
              <span>04 · Public test</span>
              <strong>Measure the full result</strong>
              <p>Distribution · resilience · ecology · accountability</p>
            </div>
            <div className={styles.feedback} aria-hidden="true">
              Evidence changes the next cycle
            </div>
          </div>
          <figcaption>
            Figure 2. The kingXford &amp; Co Sustainable Abundance Design Loop,
            2026. Original synthesis informed by the official sources in this
            briefing. It is a decision framework—not a validated causal model,
            universal index, or forecast. Indicators must be selected with
            affected communities and adapted to each project context.
          </figcaption>
        </figure>

        <aside className={styles.pressureNote} aria-label="Resource boundary">
          <span>Resource boundary</span>
          <strong>+60% by 2060?</strong>
          <p>
            UNEP’s Global Resources Outlook 2024 says resource extraction could
            rise 60% from 2020 levels without urgent and concerted action. The
            scenario is a warning, not destiny—and a reason to design for
            circularity, sufficiency, longevity, and fair distribution.
          </p>
          <SourceLink href={sources.resources}>Read the UNEP outlook</SourceLink>
        </aside>
      </section>
    </div>
  );
}
