"use client";

import {
  ArrowDown,
  ArrowUpRight,
  Code2,
  Compass,
  LockKeyhole,
  Network,
  Orbit,
  Rocket,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import {
  PLATFORM_AGENTS,
  PLATFORM_LIFECYCLE,
} from "@/lib/platform/registry";
import {
  createPlatformSeed,
  writePlatformSeed,
} from "@/lib/platform/seed";
import type { PlatformPhase } from "@/lib/platform/types";

import styles from "./PlatformNexus.module.css";

const HOME_SEED_INPUT_LIMIT = 1_200;

const phaseIcons: Record<PlatformPhase, LucideIcon> = {
  discovery: Compass,
  evidence: SearchCheck,
  systems: Network,
  prototype: Code2,
  validation: ShieldCheck,
  delivery: Rocket,
};

const startingPoints = [
  "A learning service that responds to different student needs",
  "A tool that turns complex evidence into a clear decision record",
  "A service that improves a difficult or unreliable workflow",
] as const;

export function PlatformNexus() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [selectedPhase, setSelectedPhase] =
    useState<PlatformPhase>("discovery");
  const [status, setStatus] = useState("");
  const currentPhase =
    PLATFORM_LIFECYCLE.find((phase) => phase.id === selectedPhase) ??
    PLATFORM_LIFECYCLE[0];
  const currentAgents = useMemo(
    () =>
      PLATFORM_AGENTS.filter((agent) =>
        currentPhase.agents.includes(agent.id),
      ),
    [currentPhase],
  );
  const normalizedInput = input.trim();
  const canStart = normalizedInput.length >= 3;

  const startProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canStart) {
      setStatus("Add a short description of the project or problem.");
      return;
    }

    try {
      const seed = createPlatformSeed(normalizedInput, {
        phase: "discovery",
        mode: "idea",
        source: "home-nexus",
      });
      const result = writePlatformSeed(window.sessionStorage, seed);
      if (!result.ok) {
        setStatus(
          "The project could not be saved in this browser. Nothing was submitted or sent.",
        );
        return;
      }

      setStatus("Project saved in this browser. Opening the workspace…");
      router.push(
        "/create/workspace?start=seed&phase=discovery&mode=idea",
      );
    } catch {
      setStatus(
        "The project could not be prepared. Nothing was submitted or sent.",
      );
    }
  };

  return (
    <section className={styles.nexus} aria-labelledby="platform-nexus-title">
      <div className={styles.atmosphere} aria-hidden="true">
        <span />
        <span />
        <span />
        <i />
        <i />
        <i />
      </div>

      <div className={styles.frame}>
        <header className={styles.topline}>
          <div>
            <span className={styles.signal}><i /> Workspace ready</span>
            <span>Kingxford Project Platform</span>
          </div>
          <p>One project record · Six phases · Structured review</p>
        </header>

        <div className={styles.mainGrid}>
          <div className={styles.proposition}>
            <p className={styles.eyebrow}>
              <Sparkles aria-hidden="true" /> Research, design, and delivery in one workspace
            </p>
            <h1 id="platform-nexus-title">
              Develop complex work.
              <em>Keep the record intact.</em>
            </h1>
            <p className={styles.lede}>
              Start with an idea, question, code fragment, map, prompt, or
              brief. Kingxford keeps the source, evidence, decisions, and
              revisions together from initial inquiry through delivery.
            </p>

            <form className={styles.startForm} onSubmit={startProject}>
              <label htmlFor="platform-project-start">
                Describe the project or problem.
              </label>
              <div className={styles.inputShell}>
                <textarea
                  id="platform-project-start"
                  value={input}
                  rows={3}
                  maxLength={HOME_SEED_INPUT_LIMIT}
                  placeholder="State the need, intended outcome, or question in your own words…"
                  onChange={(event) => {
                    setInput(event.target.value);
                    setStatus("");
                  }}
                />
                <div className={styles.inputMeta}>
                  <span>{input.length.toLocaleString()} / {HOME_SEED_INPUT_LIMIT.toLocaleString()}</span>
                  <span><LockKeyhole aria-hidden="true" /> Stored in this browser</span>
                </div>
              </div>

              {!input ? (
                <div className={styles.starters} aria-label="Example starting points">
                  {startingPoints.map((startingPoint) => (
                    <button
                      type="button"
                      onClick={() => setInput(startingPoint)}
                      key={startingPoint}
                    >
                      <span>+</span>{startingPoint}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className={styles.formActions}>
                <button type="submit" disabled={!canStart}>
                  <span>
                    Start project
                    <small>Enter at Discovery</small>
                  </span>
                  <ArrowUpRight aria-hidden="true" />
                </button>
                <Link href="/create">
                  Review the Create workspace
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </div>
              <p className={styles.privacy}>
                This text is stored only in this browser tab when Canvas opens.
                It is not submitted to Kingxford or sent for AI review.
              </p>
              <p className={styles.status} role="status" aria-live="polite">
                {status}
              </p>
            </form>
          </div>

          <div className={styles.operatingSystem}>
            <header className={styles.systemHeader}>
              <div className={styles.conductorMark} aria-hidden="true">
                <Orbit />
                <span />
              </div>
              <div>
                <span>Project lifecycle · Review model</span>
                <h2>A single project record, reviewed at each phase.</h2>
              </div>
              <Workflow aria-hidden="true" />
            </header>

            <nav className={styles.phaseTrack} aria-label="Connected project lifecycle">
              {PLATFORM_LIFECYCLE.map((phase) => {
                const Icon = phaseIcons[phase.id];
                const active = phase.id === currentPhase.id;
                return (
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-controls="platform-phase-detail"
                    data-active={active ? "true" : "false"}
                    onClick={() => setSelectedPhase(phase.id)}
                    key={phase.id}
                  >
                    <span className={styles.phaseNode}>
                      <Icon aria-hidden="true" />
                    </span>
                    <small>{phase.index}</small>
                    <strong>{phase.label}</strong>
                  </button>
                );
              })}
            </nav>

            <article
              className={styles.phaseDetail}
              id="platform-phase-detail"
              aria-live="polite"
            >
              <div className={styles.phaseLead}>
                <span>{currentPhase.outcome}</span>
                <h3>{currentPhase.action}</h3>
                <p>{currentPhase.description}</p>
              </div>
              <div className={styles.agentStack}>
                <span>Review disciplines</span>
                {currentAgents.map((agent, index) => (
                  <div key={agent.id} data-conductor={agent.id === "conductor" ? "true" : "false"}>
                    <i>{index === 0 ? <Orbit aria-hidden="true" /> : <Sparkles aria-hidden="true" />}</i>
                    <p>
                      <strong>{agent.label}</strong>
                      <small>{agent.description}</small>
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <footer className={styles.systemFooter}>
              <span><i /> Context preserved</span>
              <span><i /> Evidence traceable</span>
              <span><i /> Changes versioned</span>
            </footer>
          </div>
        </div>

        <a className={styles.continue} href="#mission">
          <span>Explore the mission</span>
          <ArrowDown aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
