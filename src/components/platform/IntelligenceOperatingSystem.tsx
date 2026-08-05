"use client";

import {
  ArrowUpRight,
  BookOpenCheck,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  Code2,
  Compass,
  Database,
  FileSearch,
  FlaskConical,
  GitBranch,
  Layers3,
  Newspaper,
  Orbit,
  Radar,
  Rocket,
  Route,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Reveal } from "@/components/Reveal";
import {
  PLATFORM_AGENTS,
  PLATFORM_LIFECYCLE,
} from "@/lib/platform/registry";
import type {
  PlatformAgentRole,
  PlatformPhase,
} from "@/lib/platform/types";

import styles from "./IntelligenceOperatingSystem.module.css";

const entryLenses: ReadonlyArray<
  Readonly<{
    label: string;
    eyebrow: string;
    description: string;
    href: string;
    icon: LucideIcon;
    feeds: string;
  }>
> = [
  {
    label: "Create",
    eyebrow: "Ideas · code · maps · prompts",
    description: "Shape, test, compare, and version a working proposition.",
    href: "/create",
    icon: Code2,
    feeds: "Source & prototypes",
  },
  {
    label: "Lab",
    eyebrow: "Questions · evidence · experiments",
    description: "Investigate uncertainty and turn inquiry into usable evidence.",
    href: "/lab",
    icon: FlaskConical,
    feeds: "Evidence & tests",
  },
  {
    label: "Media",
    eyebrow: "Signals · arguments · field notes",
    description: "Capture consequential observations without losing their origin.",
    href: "/media",
    icon: Newspaper,
    feeds: "Signals & context",
  },
  {
    label: "Work",
    eyebrow: "Cases · precedents · outcomes",
    description: "Connect prior proofs and operating lessons to the active project.",
    href: "/work",
    icon: Boxes,
    feeds: "Precedents & proof",
  },
] as const;

const agentIcons: Record<PlatformAgentRole, LucideIcon> = {
  conductor: Orbit,
  discovery: Compass,
  evidence: FileSearch,
  systems: GitBranch,
  prototype: Layers3,
  validation: ShieldCheck,
  delivery: Rocket,
};

const governanceSignals = [
  { label: "Context preserved", icon: Database },
  { label: "Evidence traceable", icon: BookOpenCheck },
  { label: "Decisions explicit", icon: Route },
  { label: "Human acceptance required", icon: CheckCircle2 },
] as const;

export function IntelligenceOperatingSystem() {
  const [activePhase, setActivePhase] =
    useState<PlatformPhase>("discover");
  const phase =
    PLATFORM_LIFECYCLE.find((item) => item.id === activePhase) ??
    PLATFORM_LIFECYCLE[0];
  const specialists = useMemo(
    () => PLATFORM_AGENTS.filter((agent) => agent.id !== "conductor"),
    [],
  );
  const assignedAgents = new Set(phase.agents);

  return (
    <section
      className={styles.system}
      id="intelligence-system"
      aria-labelledby="intelligence-system-title"
    >
      <header className={styles.heading}>
        <Reveal className={styles.index}>
          <span>01 / One intelligence operating system</span>
          <span>Every surface contributes to the same project</span>
        </Reveal>
        <Reveal className={styles.headingCopy} delay={0.05}>
          <div>
            <p>Not a catalogue of disconnected tools</p>
            <h2 id="intelligence-system-title">
              Four ways into the work.
              <em>One memory carrying it forward.</em>
            </h2>
          </div>
          <p>
            Create, Lab, Media, and Work are lenses on one continuing project.
            The Conductor assembles the relevant context, assigns specialist
            intelligence, and preserves evidence and decisions as the project
            moves through six connected phases.
          </p>
        </Reveal>
      </header>

      <div className={styles.architecture}>
        <Reveal className={styles.entryRail} ariaLabel="Platform entry lenses">
          <div className={styles.railLabel}>
            <Radar aria-hidden="true" />
            <span>Entry lenses</span>
          </div>
          {entryLenses.map((lens) => {
            const Icon = lens.icon;
            return (
              <Link className={styles.entry} href={lens.href} key={lens.label}>
                <span className={styles.entryIcon}>
                  <Icon aria-hidden="true" />
                </span>
                <span className={styles.entryCopy}>
                  <small>{lens.eyebrow}</small>
                  <strong>{lens.label}</strong>
                  <span>{lens.description}</span>
                  <i>{lens.feeds}</i>
                </span>
                <ArrowUpRight aria-hidden="true" />
              </Link>
            );
          })}
        </Reveal>

        <Reveal className={styles.spine} delay={0.08}>
          <div className={styles.flowLabel}>
            <span>Shared project spine</span>
            <i aria-hidden="true" />
          </div>

          <div className={styles.conductor}>
            <div className={styles.orbit} aria-hidden="true">
              <Orbit />
              <span />
              <span />
              <span />
            </div>
            <div>
              <span>Coordinating intelligence</span>
              <h3 id="conductor-title">Conductor</h3>
              <p>
                Reads the active objective, phase, source, evidence, decisions,
                and accepted outputs before directing the next useful move.
              </p>
            </div>
          </div>

          <div className={styles.memory} aria-label="Project memory">
            <div>
              <Database aria-hidden="true" />
              <span>
                <small>Persistent project memory</small>
                <strong>Objective · source · evidence · decisions</strong>
              </span>
            </div>
            <div className={styles.memoryPulse} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>

          <div className={styles.specialists}>
            <div className={styles.specialistHeading}>
              <span>Six specialist agents</span>
              <small>Assigned by phase · coordinated as one system</small>
            </div>
            <div className={styles.specialistGrid} aria-label="Specialist agents">
              {specialists.map((agent) => {
                const Icon = agentIcons[agent.id];
                const active = assignedAgents.has(agent.id);
                return (
                  <article data-active={active ? "true" : "false"} key={agent.id}>
                    <Icon aria-hidden="true" />
                    <div>
                      <strong>{agent.shortLabel}</strong>
                      <span>{agent.description}</span>
                    </div>
                    {active ? <i>Assigned now</i> : null}
                  </article>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal className={styles.lifecycle} delay={0.06}>
        <div className={styles.lifecycleTopline}>
          <div>
            <BrainCircuit aria-hidden="true" />
            <span>Connected project lifecycle</span>
          </div>
          <p id="lifecycle-phase-description">
            <strong>{phase.outcome}</strong>
            <span>{phase.description}</span>
          </p>
        </div>
        <div className={styles.phaseTrack} aria-label="Six connected project phases">
          {PLATFORM_LIFECYCLE.map((item) => (
            <button
              type="button"
              aria-pressed={item.id === phase.id}
              aria-describedby="lifecycle-phase-description"
              data-active={item.id === phase.id ? "true" : "false"}
              onClick={() => setActivePhase(item.id)}
              key={item.id}
            >
              <small>{item.index}</small>
              <strong>{item.label}</strong>
              <span>{item.action}</span>
            </button>
          ))}
        </div>
        <div className={styles.phaseAction}>
          <span>
            <Sparkles aria-hidden="true" />
            {phase.agents.length} coordinated intelligences assigned
          </span>
          <Link href={phase.route}>
            Continue at {phase.label}
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </Reveal>

      <Reveal className={styles.governance}>
        {governanceSignals.map(({ label, icon: Icon }) => (
          <span key={label}>
            <Icon aria-hidden="true" />
            {label}
          </span>
        ))}
      </Reveal>
    </section>
  );
}
