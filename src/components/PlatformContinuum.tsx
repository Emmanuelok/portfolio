import Link from "next/link";
import { ArrowUpRight, GitBranch, ShieldCheck, Sparkles } from "lucide-react";

import styles from "@/components/PlatformContinuum.module.css";
import {
  PLATFORM_CONDUCTOR,
  PLATFORM_PHASES,
} from "@/lib/platform";

export function PlatformContinuum() {
  return (
    <section className={styles.section} aria-labelledby="platform-continuum-title">
      <div className={styles.intro}>
        <div className={styles.eyebrow}>
          <span>03 / One project continuum</span>
          <span>Six phases · one accountable thread</span>
        </div>
        <div className={styles.heading}>
          <h2 id="platform-continuum-title">
            Nothing valuable should disappear
            <em>between the tools.</em>
          </h2>
          <div className={styles.lead}>
            <p>
              Atlas carries the brief, evidence, decisions, artifacts, and open
              questions through one connected project lifecycle. Every proposal
              remains inspectable; every approval remains human.
            </p>
            <Link href="/create/workspace">
              Open a project in Canvas
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.system}>
        <div className={styles.conductor}>
          <span className={styles.conductorIcon} aria-hidden="true">
            <Sparkles />
          </span>
          <div>
            <p>{PLATFORM_CONDUCTOR.name}</p>
            <h3>{PLATFORM_CONDUCTOR.role}</h3>
          </div>
          <p className={styles.boundary}>{PLATFORM_CONDUCTOR.boundary}</p>
        </div>

        <ol className={styles.phases}>
          {PLATFORM_PHASES.map((phase) => (
            <li className={styles.phase} key={phase.id}>
              <div className={styles.phaseTopline}>
                <span>{phase.number}</span>
                <span>{phase.verb}</span>
              </div>
              <h3>{phase.title}</h3>
              <p>{phase.description}</p>
              <div className={styles.signal}>
                <GitBranch aria-hidden="true" />
                <span>{phase.signal}</span>
              </div>
            </li>
          ))}
        </ol>

        <div className={styles.integrity}>
          <ShieldCheck aria-hidden="true" />
          <div>
            <span>Human authority is structural</span>
            <p>
              Analysis can accelerate the work. It cannot approve its own
              proposal, erase uncertainty, or publish a consequential outcome.
            </p>
          </div>
          <span className={styles.integrityMark}>06 gates / 06 accountable decisions</span>
        </div>
      </div>
    </section>
  );
}
