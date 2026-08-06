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
  "A learning system that adapts to how each student understands",
  "A tool that turns complex evidence into a clear next decision",
  "A new service for a problem people have learned to tolerate",
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
      setStatus("Add a short description of what you want to make possible.");
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
          "This browser could not prepare the private project start. Your words have not been submitted or sent anywhere.",
        );
        return;
      }

      setStatus("Private project start prepared. Opening the workspace…");
      router.push(
        "/create/workspace?start=seed&phase=discovery&mode=idea",
      );
    } catch {
      setStatus(
        "This project start could not be prepared safely. Your words have not been submitted or sent anywhere.",
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
            <span>Kingxford Intelligence Platform</span>
          </div>
          <p>One project · Six connected phases · Specialist intelligence</p>
        </header>

        <div className={styles.mainGrid}>
          <div className={styles.proposition}>
            <p className={styles.eyebrow}>
              <Sparkles aria-hidden="true" /> Intelligence that moves work forward
            </p>
            <h1 id="platform-nexus-title">
              Every form of thought.
              <em>One intelligence system.</em>
            </h1>
            <p className={styles.lede}>
              Begin with an idea, question, concept, code fragment, map, or
              prompt. Kingxford keeps the thread intact as you investigate,
              model, build, validate, and prepare it for the world.
            </p>

            <form className={styles.startForm} onSubmit={startProject}>
              <label htmlFor="platform-project-start">
                What are you trying to make possible?
              </label>
              <div className={styles.inputShell}>
                <textarea
                  id="platform-project-start"
                  value={input}
                  rows={3}
                  maxLength={HOME_SEED_INPUT_LIMIT}
                  placeholder="Describe the idea, need, question, or system in your own words…"
                  onChange={(event) => {
                    setInput(event.target.value);
                    setStatus("");
                  }}
                />
                <div className={styles.inputMeta}>
                  <span>{input.length.toLocaleString()} / {HOME_SEED_INPUT_LIMIT.toLocaleString()}</span>
                  <span><LockKeyhole aria-hidden="true" /> Private project start</span>
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
                  Explore the complete platform
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </div>
              <p className={styles.privacy}>
                Starting stores this sentence only in this browser tab and opens
                Canvas. It does not contact Kingxford or send it to an Agent.
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
                <span>Project intelligence · Operating model</span>
                <h2>The Conductor preserves the whole. Specialists deepen each phase.</h2>
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
                <span>Intelligence assigned</span>
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
