"use client";

import { Check, FolderPlus, LoaderCircle, Plus, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  activeRepositoryProject,
  loadProjectRepository,
} from "@/lib/workspace/project-repository";
import {
  type ProjectSeedSourceKind,
  writeProjectSeed,
} from "@/lib/workspace/project-seed";

import styles from "./ProjectCaptureAction.module.css";

type CaptureState = "idle" | "saving" | "saved" | "opening" | "error";

type ProjectCaptureActionProps = Readonly<{
  title: string;
  claim: string;
  referenceHref: string;
  source: "lab" | "media" | "work" | "showcase";
  compact?: boolean;
}>;

const TITLE_LIMIT = 180;
const SOURCE_LIMIT = 600;
const CLAIM_LIMIT = 2_400;

function bounded(value: string, maximum: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maximum);
}

function canonicalSource(source: ProjectCaptureActionProps["source"]): ProjectSeedSourceKind {
  return source === "showcase" ? "create" : source;
}

function safeInternalHref(value: string) {
  const candidate = value.trim().slice(0, SOURCE_LIMIT);
  return candidate.startsWith("/")
    && !candidate.startsWith("//")
    && !/[\u0000-\u001f]/.test(candidate)
    ? candidate
    : null;
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
      const safeSource = safeInternalHref(referenceHref);
      if (!safeTitle || !safeClaim || !safeSource) {
        setState("error");
        setMessage("This reference is incomplete or cannot be carried into Canvas safely.");
        return;
      }

      const repository = loadProjectRepository(window.localStorage);
      const activeProject = activeRepositoryProject(repository);
      const action = activeProject ? "add-evidence" as const : "start-project" as const;
      const storedSeed = writeProjectSeed({
        action,
        source: {
          kind: canonicalSource(source),
          href: safeSource,
          label: safeTitle,
        },
        payload: {
          title: safeTitle,
          brief: action === "add-evidence"
            ? `Add this public Kingxford reference to the active Project Atlas as evidence: ${safeTitle}.`
            : [
                `Develop this Kingxford reference as a new Project Atlas.`,
                `Starting point: ${safeTitle}`,
                `Why it matters: ${safeClaim}`,
              ].join("\n\n"),
          evidence: [{
            title: safeTitle,
            content: safeClaim,
            sourceUrl: safeSource,
          }],
          tags: [canonicalSource(source), "public-reference"],
        },
      });

      if (!storedSeed) {
        setState("error");
        setMessage("This browser could not prepare the private Canvas handoff. Nothing was changed.");
        return;
      }

      // Canvas removes the expiring seed only after the graph update succeeds.
      // This component deliberately never clears a seed during navigation.
      setState("opening");
      setMessage(
        activeProject
          ? `Opening ${activeProject.title} with this evidence ready to attach…`
          : "Opening a new Project Atlas with this reference attached…",
      );
      router.push("/create/workspace?handoff=public");
    } catch {
      setState("error");
      setMessage("Project Atlas could not be read safely. Nothing was overwritten or sent.");
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
