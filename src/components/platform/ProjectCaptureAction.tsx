"use client";

import { Check, FolderPlus, LoaderCircle, Plus, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  PLATFORM_EVIDENCE_LIMIT,
  createPlatformProjectIntelligence,
  dispatchPlatformChange,
  loadPlatformSidecar,
  savePlatformSidecar,
  upsertPlatformProject,
} from "@/lib/platform/storage";
import {
  PLATFORM_SEED_INPUT_LIMIT,
  createPlatformSeed,
  writePlatformSeed,
  type PlatformSeedSource,
} from "@/lib/platform/seed";
import { loadWorkspaceLibrary } from "@/lib/workspace/storage";

import styles from "./ProjectCaptureAction.module.css";

type CaptureState = "idle" | "saving" | "saved" | "opening" | "error";

type ProjectCaptureActionProps = Readonly<{
  title: string;
  claim: string;
  referenceHref: string;
  source: Extract<PlatformSeedSource, "lab" | "media" | "work" | "showcase">;
  compact?: boolean;
}>;

const TITLE_LIMIT = 240;
const SOURCE_LIMIT = 2_000;
const CLAIM_LIMIT = 4_000;

function bounded(value: string, maximum: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maximum);
}

function evidenceId() {
  const id =
    typeof globalThis.crypto !== "undefined" &&
    "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `evidence:${id}`;
}

export function ProjectCaptureAction({
  title,
  claim,
  referenceHref,
  source,
  compact = false,
}: ProjectCaptureActionProps) {
  const router = useRouter();
  const [state, setState] = useState<CaptureState>("idle");
  const [message, setMessage] = useState("");

  const capture = () => {
    if (state === "saving" || state === "opening") return;
    setState("saving");
    setMessage("");

    try {
      const safeTitle = bounded(title, TITLE_LIMIT);
      const safeClaim = bounded(claim, CLAIM_LIMIT);
      const safeSource = bounded(referenceHref, SOURCE_LIMIT);
      const workspace = loadWorkspaceLibrary(window.localStorage);

      if (workspace.status === "error") {
        setState("error");
        setMessage(
          "Your local project library could not be read safely. Nothing was changed.",
        );
        return;
      }

      if (workspace.status === "empty") {
        const input = [
          "Develop this Kingxford reference as a project input.",
          `Title: ${safeTitle}`,
          `Reference: ${safeSource}`,
          `Why it matters: ${safeClaim}`,
        ].join("\n\n").slice(0, PLATFORM_SEED_INPUT_LIMIT);
        const seed = createPlatformSeed(input, {
          title: safeTitle,
          phase: "investigate",
          mode: "brief",
          source,
        });
        const result = writePlatformSeed(window.sessionStorage, seed);
        if (!result.ok) {
          setState("error");
          setMessage(
            "This browser could not prepare a private project. Nothing was sent.",
          );
          return;
        }
        setState("opening");
        setMessage("Opening a private project with this reference attached…");
        router.push(
          "/create/workspace?start=seed&phase=investigate&mode=brief",
        );
        return;
      }

      const activeProject = workspace.library.projects.find(
        (project) => project.id === workspace.library.activeProjectId,
      );
      if (!activeProject) {
        setState("error");
        setMessage("The active local project could not be resolved. Nothing was changed.");
        return;
      }

      const loaded = loadPlatformSidecar(window.localStorage);
      if (loaded.status === "error") {
        setState("error");
        setMessage(
          "Project intelligence could not be read safely. Nothing was overwritten.",
        );
        return;
      }

      const existing = loaded.sidecar.projects[activeProject.id];
      const intelligence =
        existing ??
        createPlatformProjectIntelligence(activeProject.id, {
          objective: activeProject.title,
          phase: "investigate",
        });
      const duplicate = intelligence.evidence.some(
        (item) =>
          item.kind === "platform" &&
          item.source === safeSource &&
          item.title === safeTitle,
      );

      if (duplicate) {
        setState("saved");
        setMessage(`Already in ${activeProject.title}.`);
        return;
      }

      if (intelligence.evidence.length >= PLATFORM_EVIDENCE_LIMIT) {
        setState("error");
        setMessage(
          `This project has reached its ${PLATFORM_EVIDENCE_LIMIT}-reference local limit.`,
        );
        return;
      }

      const now = new Date().toISOString();
      const nextProject = {
        ...intelligence,
        evidence: [
          ...intelligence.evidence,
          {
            id: evidenceId(),
            kind: "platform" as const,
            title: safeTitle,
            source: safeSource,
            claim: safeClaim,
            addedAt: now,
          },
        ],
        updatedAt: now,
      };
      const nextSidecar = upsertPlatformProject(loaded.sidecar, nextProject);
      const result = savePlatformSidecar(window.localStorage, nextSidecar);
      if (!result.ok) {
        setState("error");
        setMessage(result.error.message);
        return;
      }
      dispatchPlatformChange({
        revision: nextSidecar.revision,
        projectId: activeProject.id,
        reason: "saved",
      });
      setState("saved");
      setMessage(`Saved to ${activeProject.title}.`);
    } catch {
      setState("error");
      setMessage("This reference could not be captured safely. Nothing was sent.");
    }
  };

  const Icon =
    state === "saved"
      ? Check
      : state === "saving" || state === "opening"
        ? LoaderCircle
        : state === "error"
          ? TriangleAlert
          : compact
            ? Plus
            : FolderPlus;
  const label =
    state === "saved"
      ? "Added to project"
      : state === "saving"
        ? "Saving…"
        : state === "opening"
          ? "Opening workspace…"
          : state === "error"
            ? "Try capture again"
            : "Use in my project";

  return (
    <div
      className={styles.action}
      data-compact={compact ? "true" : "false"}
      data-state={state}
    >
      <button
        type="button"
        onClick={capture}
        disabled={state === "saving" || state === "opening"}
      >
        <Icon
          aria-hidden="true"
          className={state === "saving" || state === "opening" ? styles.spin : undefined}
        />
        <span>{label}</span>
      </button>
      {message ? (
        <span className={styles.message} role="status" aria-live="polite">
          {message}
        </span>
      ) : null}
    </div>
  );
}
