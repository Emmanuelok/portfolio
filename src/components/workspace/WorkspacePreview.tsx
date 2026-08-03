"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Laptop,
  Maximize2,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Smartphone,
  Tablet,
} from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

type MapPoint = Readonly<{ x: number; y: number }>;
type MapOffsets = Readonly<Record<string, MapPoint>>;
type MapConnection = Readonly<{ id: string; path: string }>;

const MAP_MIN_ZOOM = 0.4;
const MAP_MAX_ZOOM = 1.5;

function MapBranch({
  node,
  parentId,
  offsets,
  draggingNodeId,
  onNodePointerDown,
  onNodeKeyDown,
  onStructureChange,
}: Readonly<{
  node: MindMapNode;
  parentId?: string;
  offsets: MapOffsets;
  draggingNodeId: string | null;
  onNodePointerDown: (
    nodeId: string,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  onNodeKeyDown: (
    nodeId: string,
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => void;
  onStructureChange: () => void;
}>) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const offset = offsets[node.id] ?? { x: 0, y: 0 };

  return (
    <li>
      <div
        className={styles.mapNode}
        data-dragging={draggingNodeId === node.id}
        data-map-node-id={node.id}
        data-map-parent-id={parentId}
        tabIndex={0}
        aria-describedby="mindmap-drag-instructions"
        aria-label={`Draggable map node: ${node.label}`}
        onKeyDown={(event) => onNodeKeyDown(node.id, event)}
        onPointerDown={(event) => onNodePointerDown(node.id, event)}
        style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${node.id}-children`}
            aria-label={`${open ? "Collapse" : "Expand"} ${node.label}`}
            onClick={() => {
              setOpen((value) => !value);
              onStructureChange();
            }}
            onKeyDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
          </button>
        ) : null}
        <span>{node.label}</span>
      </div>
      {hasChildren && open && (
        <ul id={`${node.id}-children`}>
          {node.children.map((child) => (
            <MapBranch
              node={child}
              parentId={node.id}
              offsets={offsets}
              draggingNodeId={draggingNodeId}
              onNodePointerDown={onNodePointerDown}
              onNodeKeyDown={onNodeKeyDown}
              onStructureChange={onStructureChange}
              key={child.id}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function MindMapPreview({ text }: Readonly<{ text: string }>) {
  const nodes = useMemo(() => parseMindMap(text), [text]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<MapPoint>({ x: 0, y: 0 });
  const [offsets, setOffsets] = useState<MapOffsets>({});
  const [connections, setConnections] = useState<readonly MapConnection[]>([]);
  const [structureVersion, setStructureVersion] = useState(0);
  const [dragging, setDragging] = useState<"canvas" | string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<
    | {
        kind: "canvas";
        pointerId: number;
        start: MapPoint;
        origin: MapPoint;
      }
    | {
        kind: "node";
        nodeId: string;
        pointerId: number;
        start: MapPoint;
        origin: MapPoint;
      }
    | null
  >(null);

  const refreshConnections = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasBounds = canvas.getBoundingClientRect();
    const transform = window.getComputedStyle(canvas).transform;
    const matrix = transform === "none"
      ? null
      : new DOMMatrixReadOnly(transform);
    const renderedScale = matrix
      ? Math.max(0.001, Math.hypot(matrix.a, matrix.b))
      : 1;
    const mapNodes = [
      ...canvas.querySelectorAll<HTMLElement>("[data-map-node-id]"),
    ];
    const nodesById = new Map(
      mapNodes.map((element) => [element.dataset.mapNodeId ?? "", element]),
    );
    const nextConnections = mapNodes.flatMap((child) => {
      const childId = child.dataset.mapNodeId;
      const parentId = child.dataset.mapParentId;
      const parent = parentId ? nodesById.get(parentId) : null;
      if (!childId || !parentId || !parent) return [];

      const parentBounds = parent.getBoundingClientRect();
      const childBounds = child.getBoundingClientRect();
      const startX = (
        parentBounds.left + Math.min(24, parentBounds.width / 2) - canvasBounds.left
      ) / renderedScale;
      const startY = (parentBounds.bottom - canvasBounds.top) / renderedScale;
      const endX = (childBounds.left - canvasBounds.left) / renderedScale;
      const endY = (
        childBounds.top + childBounds.height / 2 - canvasBounds.top
      ) / renderedScale;
      const horizontalDirection = endX >= startX ? 1 : -1;
      const verticalDirection = endY >= startY ? 1 : -1;
      const horizontalBend = Math.max(
        16,
        Math.min(44, Math.abs(endX - startX) * 0.5),
      );
      const verticalBend = Math.max(
        18,
        Math.min(90, Math.abs(endY - startY) * 0.35),
      );

      return [{
        id: `${parentId}->${childId}`,
        path: `M ${startX} ${startY} C ${startX} ${startY + verticalBend * verticalDirection}, ${endX - horizontalBend * horizontalDirection} ${endY}, ${endX} ${endY}`,
      }];
    });

    setConnections((current) => {
      const unchanged = current.length === nextConnections.length &&
        current.every((connection, index) => (
          connection.id === nextConnections[index]?.id &&
          connection.path === nextConnections[index]?.path
        ));
      return unchanged ? current : nextConnections;
    });
  }, []);

  useLayoutEffect(() => {
    refreshConnections();
  }, [nodes, offsets, refreshConnections, structureVersion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return;

    const observer = new ResizeObserver(refreshConnections);
    observer.observe(canvas);
    observer.observe(viewport);
    window.addEventListener("resize", refreshConnections);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", refreshConnections);
    };
  }, [refreshConnections, nodes]);

  useEffect(() => {
    const cancelDrag = () => {
      dragRef.current = null;
      setDragging(null);
    };
    window.addEventListener("blur", cancelDrag);
    return () => window.removeEventListener("blur", cancelDrag);
  }, []);

  const beginCanvasDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || dragRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-map-node-id], button")) return;
    event.preventDefault();
    dragRef.current = {
      kind: "canvas",
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: pan,
    };
    setDragging("canvas");
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const beginNodeDrag = (
    nodeId: string,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!event.isPrimary || event.button !== 0 || dragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    dragRef.current = {
      kind: "node",
      nodeId,
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: offsets[nodeId] ?? { x: 0, y: 0 },
    };
    setDragging(nodeId);
    viewportRef.current?.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const delta = {
      x: event.clientX - drag.start.x,
      y: event.clientY - drag.start.y,
    };
    if (drag.kind === "canvas") {
      setPan({ x: drag.origin.x + delta.x, y: drag.origin.y + delta.y });
      return;
    }
    setOffsets((current) => ({
      ...current,
      [drag.nodeId]: {
        x: drag.origin.x + delta.x / zoom,
        y: drag.origin.y + delta.y / zoom,
      },
    }));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleLostPointerCapture = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(null);
  };

  const moveNodeWithKeyboard = (
    nodeId: string,
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    const movement = event.shiftKey ? 32 : 12;
    const delta = {
      ArrowLeft: { x: -movement, y: 0 },
      ArrowRight: { x: movement, y: 0 },
      ArrowUp: { x: 0, y: -movement },
      ArrowDown: { x: 0, y: movement },
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    setOffsets((current) => {
      const origin = current[nodeId] ?? { x: 0, y: 0 };
      return {
        ...current,
        [nodeId]: { x: origin.x + delta.x, y: origin.y + delta.y },
      };
    });
  };

  const panWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const movement = event.shiftKey ? 64 : 24;
    const delta = {
      ArrowLeft: { x: -movement, y: 0 },
      ArrowRight: { x: movement, y: 0 },
      ArrowUp: { x: 0, y: -movement },
      ArrowDown: { x: 0, y: movement },
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    setPan((current) => ({
      x: current.x + delta.x,
      y: current.y + delta.y,
    }));
  };

  const fitMap = () => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) {
      setPan({ x: 0, y: 0 });
      setZoom(1);
      return;
    }

    const mapNodes = [...canvas.querySelectorAll<HTMLElement>("[data-map-node-id]")];
    if (!mapNodes.length) return;

    const canvasBounds = canvas.getBoundingClientRect();
    const transform = window.getComputedStyle(canvas).transform;
    const matrix = transform === "none"
      ? null
      : new DOMMatrixReadOnly(transform);
    const renderedZoom = matrix
      ? Math.max(0.001, Math.hypot(matrix.a, matrix.b))
      : 1;
    const nodeBounds = mapNodes.map((node) => node.getBoundingClientRect());
    const minX = Math.min(...nodeBounds.map((bounds) =>
      (bounds.left - canvasBounds.left) / renderedZoom));
    const minY = Math.min(...nodeBounds.map((bounds) =>
      (bounds.top - canvasBounds.top) / renderedZoom));
    const maxX = Math.max(...nodeBounds.map((bounds) =>
      (bounds.right - canvasBounds.left) / renderedZoom));
    const maxY = Math.max(...nodeBounds.map((bounds) =>
      (bounds.bottom - canvasBounds.top) / renderedZoom));
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    const margin = 24;
    const availableWidth = Math.max(1, viewport.clientWidth - margin * 2);
    const availableHeight = Math.max(1, viewport.clientHeight - margin * 2);
    const nextZoom = Math.max(
      MAP_MIN_ZOOM,
      Math.min(1.2, availableWidth / contentWidth, availableHeight / contentHeight),
    );
    const viewportStyle = window.getComputedStyle(viewport);
    const paddingLeft = Number.parseFloat(viewportStyle.paddingLeft) || 0;
    const paddingTop = Number.parseFloat(viewportStyle.paddingTop) || 0;
    const centeredX = margin + (availableWidth - contentWidth * nextZoom) / 2;
    const centeredY = margin + (availableHeight - contentHeight * nextZoom) / 2;

    setZoom(nextZoom);
    setPan({
      x: centeredX - paddingLeft - minX * nextZoom,
      y: centeredY - paddingTop - minY * nextZoom,
    });
  };

  const resetMap = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setOffsets({});
  };

  return (
    <section className={styles.mapPreview} aria-label="Mind map preview">
      <header>
        <div>
          <span>Relationship view</span>
          <strong>{nodes.length} root {nodes.length === 1 ? "system" : "systems"}</strong>
          <small id="mindmap-drag-instructions" className={styles.mapHint}>
            <Move aria-hidden="true" /> Drag to move · Arrow keys to nudge · Shift for larger steps
          </small>
        </div>
        <div role="group" aria-label="Map zoom controls">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(MAP_MIN_ZOOM, value - 0.1))}
          >
            <Minus aria-hidden="true" />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(MAP_MAX_ZOOM, value + 0.1))}
          >
            <Plus aria-hidden="true" />
          </button>
          <button type="button" aria-label="Fit map" onClick={fitMap}>
            <Maximize2 aria-hidden="true" />
          </button>
          <button type="button" aria-label="Reset map layout" onClick={resetMap}>
            <RotateCcw aria-hidden="true" />
          </button>
        </div>
      </header>
      <div
        ref={viewportRef}
        className={styles.mapViewport}
        data-dragging={dragging === "canvas"}
        data-map-viewport
        tabIndex={0}
        aria-label="Interactive mind map canvas. Drag the background to pan and drag nodes to move them."
        onKeyDown={panWithKeyboard}
        onLostPointerCapture={handleLostPointerCapture}
        onPointerCancel={endDrag}
        onPointerDown={beginCanvasDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
      >
        {nodes.length ? (
          <div
            ref={canvasRef}
            className={styles.mapCanvas}
            data-map-canvas
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            }}
          >
            <svg
              className={styles.mapConnections}
              aria-hidden="true"
              focusable="false"
            >
              {connections.map((connection) => (
                <path
                  data-map-connection-id={connection.id}
                  d={connection.path}
                  key={connection.id}
                />
              ))}
            </svg>
            <ul className={styles.mapTree} aria-label="Keyboard-operable mind map tree">
              {nodes.map((node) => (
                <MapBranch
                  node={node}
                  offsets={offsets}
                  draggingNodeId={dragging === "canvas" ? null : dragging}
                  onNodePointerDown={beginNodeDrag}
                  onNodeKeyDown={moveNodeWithKeyboard}
                  onStructureChange={() => setStructureVersion((value) => value + 1)}
                  key={node.id}
                />
              ))}
            </ul>
          </div>
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
