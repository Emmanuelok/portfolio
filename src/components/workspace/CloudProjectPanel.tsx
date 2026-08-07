"use client";

import {
  AlertTriangle,
  Check,
  Cloud,
  CloudDownload,
  CloudOff,
  CloudUpload,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CLOUD_SYNC_PROJECT_LIMIT,
  type CloudProjectSummary,
  type CloudRole,
} from "@/lib/cloud/contracts";
import {
  CloudClientError,
  cloudProjectRelationship,
  deleteCloudAccountData,
  fetchCloudProject,
  fetchCloudProjectIndex,
  fetchCloudStatus,
  synchronizeCloudProjects,
  uploadCloudProject,
  type CloudProjectRelationship,
} from "@/lib/cloud/client-sync";
import type { KingxfordProject } from "@/lib/workspace/project-graph";

import styles from "./CloudProjectPanel.module.css";

type ConnectedCloud = Readonly<{
  status: "connected";
  organizationId: string;
  role: CloudRole;
  projects: readonly CloudProjectSummary[];
}>;

type CloudViewState =
  | Readonly<{ status: "checking" }>
  | Readonly<{ status: "unconfigured"; message: string }>
  | Readonly<{ status: "signed-out"; message: string }>
  | Readonly<{ status: "error"; message: string }>
  | ConnectedCloud;

type Notice = Readonly<{
  tone: "neutral" | "success" | "warning" | "error";
  message: string;
}>;

export type CloudProjectTransfer = Readonly<{
  project: KingxfordProject;
  cloud: CloudProjectSummary;
  relationship: CloudProjectRelationship;
  intent: "add-local-copy" | "review-version" | "inspect-current-copy";
}>;

export type CloudProjectPanelProps = Readonly<{
  currentProject: KingxfordProject | null;
  projects: readonly KingxfordProject[];
  onReceiveCloudProject: (
    transfer: CloudProjectTransfer,
  ) => void | Promise<void>;
  className?: string;
}>;

const writableRoles = new Set<CloudRole>(["owner", "admin", "editor"]);

function formatUpdated(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function relationshipCopy(relationship: CloudProjectRelationship) {
  switch (relationship) {
    case "identical":
      return { label: "Current on this device", tone: "current" as const };
    case "local-newer":
      return { label: "Local version is newer", tone: "warning" as const };
    case "cloud-newer":
      return { label: "Cloud version is newer", tone: "warning" as const };
    case "diverged":
      return { label: "Versions differ", tone: "warning" as const };
    case "cloud-only":
      return { label: "Cloud only", tone: "cloud" as const };
    case "local-only":
      return { label: "Local only", tone: "local" as const };
  }
}

function errorMessage(error: unknown) {
  if (error instanceof CloudClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "The cloud request could not be completed. Local projects were not changed.";
}

export function CloudProjectPanel({
  currentProject,
  projects,
  onReceiveCloudProject,
  className,
}: CloudProjectPanelProps) {
  const deletionInputId = useId();
  const mountedRef = useRef(true);
  const [view, setView] = useState<CloudViewState>({ status: "checking" });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [deletionConfirmation, setDeletionConfirmation] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadCloud = useCallback(async (showChecking = false) => {
    if (showChecking) setView({ status: "checking" });
    try {
      const status = await fetchCloudStatus();
      if (!mountedRef.current) return;
      if (!status.configured) {
        setView({ status: "unconfigured", message: status.message });
        return;
      }
      if (!status.authenticated) {
        setView({ status: "signed-out", message: status.message });
        return;
      }
      const index = await fetchCloudProjectIndex();
      if (!mountedRef.current) return;
      setView({ status: "connected", ...index });
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof CloudClientError && error.status === 401) {
        setView({
          status: "signed-out",
          message: "Your cloud session has ended. Local projects remain available on this device.",
        });
      } else {
        setView({ status: "error", message: errorMessage(error) });
      }
    }
  }, []);

  useEffect(() => {
    const initialization = window.setTimeout(() => {
      void loadCloud();
    }, 0);
    return () => window.clearTimeout(initialization);
  }, [loadCloud]);

  const localById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const cloudById = useMemo(
    () => new Map(view.status === "connected"
      ? view.projects.map((project) => [project.id, project])
      : []),
    [view],
  );
  const currentCloud = currentProject ? cloudById.get(currentProject.id) ?? null : null;
  const currentRelationship = currentProject
    ? cloudProjectRelationship(currentProject, currentCloud)
    : null;
  const canWrite = view.status === "connected" && writableRoles.has(view.role);
  const changedLocalProjects = view.status === "connected"
    ? projects.filter((project) =>
      cloudProjectRelationship(project, cloudById.get(project.id)) !== "identical")
    : [];

  const refresh = async () => {
    if (busy) return;
    setBusy("refresh");
    setNotice(null);
    await loadCloud();
    if (mountedRef.current) setBusy(null);
  };

  const uploadCurrent = async () => {
    if (!currentProject || view.status !== "connected" || !canWrite || busy) return;
    setBusy(`upload:${currentProject.id}`);
    setNotice(null);
    try {
      const result = await uploadCloudProject(currentProject, currentCloud);
      if (!mountedRef.current) return;
      setView({
        ...view,
        projects: [
          result.cloud,
          ...view.projects.filter(({ id }) => id !== result.cloud.id),
        ],
      });
      setNotice({
        tone: "success",
        message: currentCloud
          ? `Cloud version ${result.cloud.version} saved. The local project remains unchanged.`
          : "The current project was added to cloud storage. Local work remains on this device.",
      });
    } catch (error) {
      if (error instanceof CloudClientError && error.status === 409) {
        await loadCloud();
        if (mountedRef.current) {
          setNotice({
            tone: "warning",
            message: "The cloud project changed before this upload. The latest cloud version has been loaded for review; nothing was overwritten.",
          });
        }
      } else if (mountedRef.current) {
        setNotice({ tone: "error", message: errorMessage(error) });
      }
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const synchronizeAll = async () => {
    if (
      view.status !== "connected"
      || !canWrite
      || busy
      || changedLocalProjects.length === 0
      || projects.length > CLOUD_SYNC_PROJECT_LIMIT
    ) return;
    setBusy("sync-all");
    setNotice(null);
    try {
      const result = await synchronizeCloudProjects(
        changedLocalProjects,
        view.projects,
      );
      await loadCloud();
      if (!mountedRef.current) return;
      const conflicts = result.results.filter(({ status }) => status === "conflict").length;
      const saved = result.results.length - conflicts;
      setNotice(conflicts > 0
        ? {
            tone: "warning",
            message: `${saved} ${saved === 1 ? "project was" : "projects were"} saved; ${conflicts} ${conflicts === 1 ? "version needs" : "versions need"} review. Conflicting cloud work was not overwritten.`,
          }
        : {
            tone: "success",
            message: `${saved} ${saved === 1 ? "project was" : "projects were"} synchronized. Local projects remain available on this device.`,
          });
    } catch (error) {
      if (mountedRef.current) setNotice({ tone: "error", message: errorMessage(error) });
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const receiveProject = async (cloud: CloudProjectSummary) => {
    if (busy) return;
    setBusy(`receive:${cloud.id}`);
    setNotice(null);
    try {
      const record = await fetchCloudProject(cloud.id);
      const local = localById.get(cloud.id);
      const relationship = cloudProjectRelationship(local, record.cloud);
      await onReceiveCloudProject({
        ...record,
        relationship,
        intent: relationship === "cloud-only"
          ? "add-local-copy"
          : relationship === "identical"
            ? "inspect-current-copy"
            : "review-version",
      });
      if (!mountedRef.current) return;
      setNotice({
        tone: relationship === "cloud-only" || relationship === "identical"
          ? "success"
          : "warning",
        message: relationship === "cloud-only"
          ? "The cloud project was passed to the local workspace for import."
          : relationship === "identical"
            ? "The verified cloud copy was passed to the workspace."
            : "The cloud version was passed to the workspace for comparison. No local version was overwritten by cloud sync.",
      });
    } catch (error) {
      if (mountedRef.current) setNotice({ tone: "error", message: errorMessage(error) });
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const deleteAccountData = async () => {
    if (deletionConfirmation !== "DELETE MY CLOUD DATA" || busy) return;
    setBusy("delete-account");
    setNotice(null);
    try {
      if (view.status !== "connected") return;
      await deleteCloudAccountData(view.organizationId);
      if (!mountedRef.current) return;
      setDeletionConfirmation("");
      setView({
        status: "signed-out",
        message: "Your Kingxford cloud access was removed. Projects stored on this device were not deleted.",
      });
      setNotice({
        tone: "success",
        message: "Cloud data deletion completed. Local projects remain on this device.",
      });
    } catch (error) {
      if (mountedRef.current) setNotice({ tone: "error", message: errorMessage(error) });
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  if (view.status === "checking") {
    return (
      <section className={`${styles.panel} ${className ?? ""}`} aria-label="Cloud projects">
        <div className={styles.stateCard} role="status">
          <LoaderCircle className={styles.spinner} aria-hidden="true" />
          <div><strong>Checking cloud access</strong><span>Local projects remain available while this completes.</span></div>
        </div>
      </section>
    );
  }

  if (view.status === "unconfigured") {
    return (
      <section className={`${styles.panel} ${className ?? ""}`} aria-labelledby="cloud-projects-title">
        <div className={styles.stateCard}>
          <CloudOff aria-hidden="true" />
          <div>
            <strong id="cloud-projects-title">Cloud projects are not configured</strong>
            <span>{view.message}</span>
          </div>
        </div>
      </section>
    );
  }

  if (view.status === "signed-out") {
    return (
      <section className={`${styles.panel} ${className ?? ""}`} aria-labelledby="cloud-projects-title">
        <div className={styles.stateCard}>
          <Cloud aria-hidden="true" />
          <div>
            <strong id="cloud-projects-title">Cloud projects are optional</strong>
            <span>{view.message} Nothing uploads until you choose a cloud action.</span>
          </div>
          <Link className={styles.primaryAction} href="/auth?next=%2Fcreate%2Fworkspace">
            Sign in securely
          </Link>
        </div>
      </section>
    );
  }

  if (view.status === "error") {
    return (
      <section className={`${styles.panel} ${className ?? ""}`} aria-labelledby="cloud-projects-title">
        <div className={styles.stateCard} data-tone="error">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong id="cloud-projects-title">Cloud projects could not be reached</strong>
            <span>{view.message}</span>
          </div>
          <button className={styles.secondaryAction} type="button" onClick={() => void loadCloud(true)}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  const roleIsReadOnly = !writableRoles.has(view.role);
  const currentStatus = currentRelationship ? relationshipCopy(currentRelationship) : null;

  return (
    <section className={`${styles.panel} ${className ?? ""}`} aria-labelledby="cloud-projects-title">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}><ShieldCheck aria-hidden="true" /> Secure project continuity</span>
          <h2 id="cloud-projects-title">Cloud projects</h2>
          <p>
            Versioned organization storage for work you explicitly select. Local and cloud copies remain separate until you choose an action.
          </p>
        </div>
        <div className={styles.connection}>
          <span><i aria-hidden="true" /> Connected</span>
          <small>{view.role} access</small>
          <button type="button" onClick={() => void refresh()} disabled={Boolean(busy)}>
            <RefreshCw className={busy === "refresh" ? styles.spinner : undefined} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {notice ? (
        <div className={styles.notice} data-tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.tone === "success" ? <Check aria-hidden="true" /> : notice.tone === "neutral" ? <Cloud aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
          <span>{notice.message}</span>
        </div>
      ) : null}

      <div className={styles.actionsGrid}>
        <article className={styles.actionCard}>
          <div>
            <span>Current project</span>
            <h3>{currentProject?.title ?? "No project selected"}</h3>
            <p>
              {currentProject
                ? currentStatus?.label
                : "Select a local project before uploading a cloud version."}
            </p>
          </div>
          <button
            className={styles.primaryAction}
            type="button"
            disabled={!currentProject || !canWrite || currentRelationship === "identical" || Boolean(busy)}
            onClick={() => void uploadCurrent()}
          >
            {busy?.startsWith("upload:") ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : <CloudUpload aria-hidden="true" />}
            {currentCloud ? "Upload new version" : "Add current project"}
          </button>
        </article>

        <article className={styles.actionCard}>
          <div>
            <span>Local project set</span>
            <h3>{projects.length} {projects.length === 1 ? "project" : "projects"} on this device</h3>
            <p>
              {changedLocalProjects.length === 0
                ? "Every matching local project is current in the cloud index."
                : `${changedLocalProjects.length} ${changedLocalProjects.length === 1 ? "project has" : "projects have"} a local change or no cloud copy.`}
            </p>
          </div>
          <button
            className={styles.secondaryAction}
            type="button"
            disabled={
              !canWrite
              || changedLocalProjects.length === 0
              || projects.length > CLOUD_SYNC_PROJECT_LIMIT
              || Boolean(busy)
            }
            onClick={() => void synchronizeAll()}
          >
            {busy === "sync-all" ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : <CloudUpload aria-hidden="true" />}
            Sync selected set
          </button>
        </article>
      </div>

      {roleIsReadOnly ? (
        <p className={styles.roleNote}>
          Your {view.role} role can inspect and download organization projects but cannot upload changes.
        </p>
      ) : projects.length > CLOUD_SYNC_PROJECT_LIMIT ? (
        <p className={styles.roleNote}>
          Bulk synchronization accepts at most {CLOUD_SYNC_PROJECT_LIMIT} local projects. Upload individual projects or reduce the selected local set.
        </p>
      ) : null}

      <div className={styles.listHeading}>
        <div>
          <span>Organization project index</span>
          <strong>{view.projects.length} {view.projects.length === 1 ? "cloud project" : "cloud projects"}</strong>
        </div>
        <p>Downloading passes a verified project to the workspace. A different local version is always marked for review.</p>
      </div>

      <ol className={styles.projectList}>
        {view.projects.length === 0 ? (
          <li className={styles.emptyState}>
            <Cloud aria-hidden="true" />
            <div>
              <strong>No cloud projects yet</strong>
              <span>Choose “Add current project” when a local project is ready for cloud continuity.</span>
            </div>
          </li>
        ) : null}
        {view.projects.map((cloud) => {
          const local = localById.get(cloud.id);
          const relationship = cloudProjectRelationship(local, cloud);
          const relationshipState = relationshipCopy(relationship);
          const transferring = busy === `receive:${cloud.id}`;
          return (
            <li key={cloud.id}>
              <div className={styles.projectVersion}>
                <span>v{cloud.version}</span>
                <Cloud aria-hidden="true" />
              </div>
              <div className={styles.projectDetails}>
                <span className={styles.relationship} data-tone={relationshipState.tone}>
                  {relationshipState.label}
                </span>
                <h3>{cloud.title}</h3>
                <p>{cloud.summary || "No project summary has been added."}</p>
                <small>Updated <time dateTime={cloud.updatedAt}>{formatUpdated(cloud.updatedAt)}</time> · {cloud.activePhase} phase</small>
              </div>
              <button
                className={styles.secondaryAction}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void receiveProject(cloud)}
              >
                {transferring ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : <CloudDownload aria-hidden="true" />}
                {relationship === "cloud-only"
                  ? "Add locally"
                  : relationship === "identical"
                    ? "Inspect copy"
                    : "Review version"}
              </button>
            </li>
          );
        })}
      </ol>

      <details className={styles.dataControls}>
        <summary>Account and data controls</summary>
        <div className={styles.controlsBody}>
          <div className={styles.controlLinks}>
            <Link href="/auth?next=%2Fcreate%2Fworkspace">Account access <ExternalLink aria-hidden="true" /></Link>
            <a href={`/api/cloud/export?organization=${encodeURIComponent(view.organizationId)}`}>
              Export cloud data <ExternalLink aria-hidden="true" />
            </a>
          </div>
          <div className={styles.deletionControl}>
            <div>
              <strong>Remove my Kingxford cloud data</strong>
              <p>
                This removes your organization cloud data when you are its sole owner, or removes your membership and usage records for a shared organization. It does not delete projects stored in this browser or remove the underlying sign-in identity.
              </p>
            </div>
            <label htmlFor={deletionInputId}>Type <code>DELETE MY CLOUD DATA</code> to confirm</label>
            <div>
              <input
                id={deletionInputId}
                value={deletionConfirmation}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setDeletionConfirmation(event.target.value)}
              />
              <button
                type="button"
                disabled={deletionConfirmation !== "DELETE MY CLOUD DATA" || Boolean(busy)}
                onClick={() => void deleteAccountData()}
              >
                {busy === "delete-account" ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                Remove cloud data
              </button>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
