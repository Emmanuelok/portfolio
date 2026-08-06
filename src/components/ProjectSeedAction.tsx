"use client";

import { ArrowUpRight, GitBranch, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "@/components/ProjectSeedAction.module.css";
import {
  type ProjectSeedInput,
  writeProjectSeed,
} from "@/lib/workspace/project-seed";

type ProjectSeedActionProps = Readonly<{
  seed: ProjectSeedInput;
  label?: string;
  description?: string;
  className?: string;
  variant?: "primary" | "quiet" | "evidence";
}>;

export function ProjectSeedAction({
  seed,
  label = seed.action === "add-evidence"
    ? "Carry into Canvas as evidence"
    : "Start this project in Canvas",
  description,
  className,
  variant = "primary",
}: ProjectSeedActionProps) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  const launch = () => {
    if (state === "saving") return;
    setState("saving");
    const storedSeed = writeProjectSeed(seed);
    if (!storedSeed) {
      setState("error");
      return;
    }
    router.push("/create/workspace?handoff=public");
  };

  const classes = [styles.action, styles[variant], className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.wrap}>
      <button
        className={classes}
        type="button"
        onClick={launch}
        disabled={state === "saving"}
      >
        <span className={styles.icon} aria-hidden="true">
          {state === "saving" ? <LoaderCircle /> : <GitBranch />}
        </span>
        <span className={styles.copy}>
          <strong>{state === "saving" ? "Preparing Canvas…" : label}</strong>
          {description ? <span>{description}</span> : null}
        </span>
        <ArrowUpRight className={styles.arrow} aria-hidden="true" />
      </button>
      <p className={styles.status} aria-live="polite">
        {state === "error"
          ? "Canvas could not preserve this handoff in this browser. Your current page has not changed; please try again."
          : ""}
      </p>
    </div>
  );
}
