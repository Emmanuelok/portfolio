"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Laptop,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Smartphone,
  Tablet,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  parseConcept,
  parseMindMap,
  promptSignals,
} from "@/lib/workspace/local-analysis";
import type {
  CodeFiles,
  MindMapNode,
  WorkspaceDraft,
} from "@/lib/workspace/types";

import styles from "./CreativeWorkspace.module.css";

type PreviewDevice = "desktop" | "tablet" | "mobile";

type WorkspacePreviewProps = Readonly<{
  draft: WorkspaceDraft;
  committedCode: CodeFiles;
  runId: number;
  onCodeLogs: (logs: readonly string[]) => void;
}>;

function ConceptPreview({ draft }: Readonly<{ draft: WorkspaceDraft }>) {
  const concept = useMemo(
    () => parseConcept(draft.text, draft.title),
    [draft.text, draft.title],
  );

  const cards = [
    ["Present condition", concept.problem],
    ["Intended change", concept.change],
    ["People", concept.audience],
    ["Important limits", concept.constraints],
  ] as const;

  return (
    <article className={styles.conceptPreview} aria-label="Local concept preview">
      <header>
        <p>Concept specimen · Local interpretation</p>
        <span>01 / Working proof</span>
      </header>
      <div className={styles.conceptHero}>
        <div>
          <span>Purpose</span>
          <h2>{concept.title}</h2>
        </div>
        <p>{concept.purpose}</p>
      </div>
      <div className={styles.conceptGrid}>
        {cards.map(([label, value], index) => (
          <section key={label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <small>{label}</small>
            <p>{value}</p>
          </section>
        ))}
      </div>
      <footer>
        <span>Next evidence</span>
        <p>{concept.evidence}</p>
      </footer>
    </article>
  );
}

function buildCodeDocument(code: CodeFiles, channel: string) {
  const safeJavascript = code.javascript.replaceAll("</script", "<\\/script");
  const bridge = `
    (() => {
      const channel = ${JSON.stringify(channel)};
      const emit = (type, values) => parent.postMessage({ channel, type, values: values.map((value) => {
        try { return typeof value === 'string' ? value : JSON.stringify(value); }
        catch { return String(value); }
      }) }, '*');
      ['log', 'warn', 'error'].forEach((method) => {
        const original = console[method];
        console[method] = (...values) => { emit(method, values); original.apply(console, values); };
      });
      window.addEventListener('error', (event) => emit('error', [event.message]));
      window.addEventListener('unhandledrejection', (event) => emit('error', [String(event.reason)]));
    })();`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; connect-src 'none'; media-src data: blob:; frame-src 'none'; form-action 'none'; base-uri 'none';" />
  <style>${code.css}</style>
</head>
<body>
${code.html}
<script>${bridge}</script>
<script>${safeJavascript}</script>
</body>
</html>`;
}

function CodePreview({
  code,
  runId,
  onCodeLogs,
}: Readonly<{
  code: CodeFiles;
  runId: number;
  onCodeLogs: (logs: readonly string[]) => void;
}>) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewId = useId();
  const channel = `kingxford-preview-${previewId}-${runId}`;
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [logs, setLogs] = useState<readonly string[]>([]);
  const srcDoc = useMemo(() => buildCodeDocument(code, channel), [channel, code]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as
        | { channel?: string; type?: string; values?: readonly string[] }
        | undefined;
      if (!data || data.channel !== channel || !Array.isArray(data.values)) return;
      const line = `[${data.type ?? "log"}] ${data.values.join(" ")}`;
      setLogs((current) => {
        const next = [...current, line].slice(-12);
        onCodeLogs(next);
        return next;
      });
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [channel, onCodeLogs]);

  return (
    <div className={styles.codeStage}>
      <div className={styles.deviceBar}>
        <div role="group" aria-label="Preview width">
          {(
            [
              ["desktop", Laptop, "Desktop preview"],
              ["tablet", Tablet, "Tablet preview"],
              ["mobile", Smartphone, "Mobile preview"],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              type="button"
              aria-label={label}
              aria-pressed={device === value}
              onClick={() => setDevice(value)}
              key={value}
            >
              <Icon aria-hidden="true" />
            </button>
          ))}
        </div>
        <span>Isolated browser · network disabled</span>
      </div>
      <div className={styles.iframeWell} data-device={device}>
        <iframe
          ref={iframeRef}
          title="Live code preview"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
        />
      </div>
      <details className={styles.previewConsole} open={logs.length > 0}>
        <summary>
          Preview console <span>{logs.length}</span>
        </summary>
        <div aria-live="polite">
          {logs.length ? (
            logs.map((line, index) => <code key={`${line}-${index}`}>{line}</code>)
          ) : (
            <p>No messages from this run.</p>
          )}
        </div>
      </details>
    </div>
  );
}

function MapBranch({ node }: Readonly<{ node: MindMapNode }>) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <li>
      <div className={styles.mapNode}>
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${node.id}-children`}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
            <span>{node.label}</span>
          </button>
        ) : (
          <span>{node.label}</span>
        )}
      </div>
      {hasChildren && open && (
        <ul id={`${node.id}-children`}>
          {node.children.map((child) => (
            <MapBranch node={child} key={child.id} />
          ))}
        </ul>
      )}
    </li>
  );
}

function MindMapPreview({ text }: Readonly<{ text: string }>) {
  const nodes = useMemo(() => parseMindMap(text), [text]);
  const [zoom, setZoom] = useState(1);

  return (
    <section className={styles.mapPreview} aria-label="Mind map preview">
      <header>
        <div>
          <span>Relationship view</span>
          <strong>{nodes.length} root {nodes.length === 1 ? "system" : "systems"}</strong>
        </div>
        <div role="group" aria-label="Map zoom controls">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.65, value - 0.1))}
          >
            <Minus aria-hidden="true" />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))}
          >
            <Plus aria-hidden="true" />
          </button>
          <button type="button" aria-label="Fit map" onClick={() => setZoom(1)}>
            <Maximize2 aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className={styles.mapViewport}>
        {nodes.length ? (
          <ul
            className={styles.mapTree}
            style={{ transform: `scale(${zoom})` }}
            aria-label="Keyboard-operable mind map tree"
          >
            {nodes.map((node) => (
              <MapBranch node={node} key={node.id} />
            ))}
          </ul>
        ) : (
          <div className={styles.previewEmpty}>
            <p>Your map will form as you add indented lines.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function PromptPreview({ text }: Readonly<{ text: string }>) {
  const signals = useMemo(() => promptSignals(text), [text]);
  const present = signals.filter((signal) => signal.present).length;
  const sections = text
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(Boolean)
    .slice(0, 8);

  return (
    <article className={styles.promptPreview}>
      <header>
        <div>
          <span>Prompt instrument</span>
          <strong>{present} / {signals.length} structural signals</strong>
        </div>
        <div className={styles.signalTrack} aria-label={`${present} of ${signals.length} prompt signals present`}>
          {signals.map((signal) => (
            <span data-present={signal.present} key={signal.label} />
          ))}
        </div>
      </header>
      <div className={styles.promptSignals}>
        {signals.map((signal) => (
          <div data-present={signal.present} key={signal.label}>
            {signal.present ? <Check aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
            <span>{signal.label}</span>
            <small>{signal.present ? "Visible" : "Unresolved"}</small>
          </div>
        ))}
      </div>
      <div className={styles.promptBlocks}>
        {sections.map((section, index) => {
          const [first, ...rest] = section.split(/\r?\n/);
          return (
            <section key={`${first}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{first.slice(0, 70)}</h3>
              <p>{rest.join(" ") || "This section needs a concrete instruction."}</p>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function BriefPreview({ draft }: Readonly<{ draft: WorkspaceDraft }>) {
  const sections = draft.text
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(Boolean);

  return (
    <article className={styles.briefPreview}>
      <header>
        <p>kingXford &amp; Co · Working production brief</p>
        <span>Saved on this device</span>
      </header>
      <div className={styles.briefTitle}>
        <span>Project</span>
        <h2>{draft.title || "Untitled production brief"}</h2>
      </div>
      <div className={styles.briefSections}>
        {sections.map((section, index) => {
          const [heading, ...body] = section.split(/\r?\n/);
          return (
            <section key={`${heading}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{heading}</h3>
                <p>{body.join(" ") || "Not yet defined."}</p>
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}

export function WorkspacePreview({
  draft,
  committedCode,
  runId,
  onCodeLogs,
}: WorkspacePreviewProps) {
  if (draft.mode === "code") {
    return (
      <CodePreview
        key={runId}
        code={committedCode}
        runId={runId}
        onCodeLogs={onCodeLogs}
      />
    );
  }
  if (draft.mode === "mindmap") return <MindMapPreview text={draft.text} />;
  if (draft.mode === "prompt") return <PromptPreview text={draft.text} />;
  if (draft.mode === "brief") return <BriefPreview draft={draft} />;
  return <ConceptPreview draft={draft} />;
}

export function PreviewResetButton({ onReset }: Readonly<{ onReset: () => void }>) {
  return (
    <button type="button" onClick={onReset}>
      <RotateCcw aria-hidden="true" />
      Reset preview
    </button>
  );
}
