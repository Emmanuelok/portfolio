import type {
  AgentReview,
  MindMapNode,
  ParsedConcept,
  WorkspaceDraft,
  WorkspaceMode,
} from "@/lib/workspace/types";

const clean = (value: string) => value.trim().replace(/\s+/g, " ");

function field(text: string, labels: readonly string[]) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const label = line.slice(0, separator).trim().toLocaleLowerCase();
    if (labels.includes(label)) return clean(line.slice(separator + 1));
  }
  return "";
}

export function parseConcept(text: string, fallbackTitle = "Untitled concept"): ParsedConcept {
  const meaningfulLines = text
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean);
  const create = field(text, ["create", "idea", "title", "concept"]);
  const firstLine = meaningfulLines[0]?.replace(/^[^:]+:\s*/, "") ?? "";

  return {
    title: create || firstLine || fallbackTitle,
    purpose:
      field(text, ["purpose", "why", "goal", "outcome"]) ||
      meaningfulLines.slice(0, 2).join(" ") ||
      "Define the purpose this concept must serve.",
    audience:
      field(text, ["for", "audience", "people", "users"]) ||
      "The people and institutions who will use or be affected by it.",
    problem:
      field(text, ["problem", "challenge", "need"]) ||
      "Clarify the present condition this concept is intended to change.",
    change:
      field(text, ["change", "future", "promise", "result"]) ||
      "Describe the practical change a successful version should make possible.",
    constraints:
      field(text, ["constraints", "limits", "risks", "exclusions"]) ||
      "Name the important limits, risks and dependencies.",
    evidence:
      field(text, ["evidence", "proof", "measure", "success criteria"]) ||
      "Define what would count as useful evidence from the next test.",
  };
}

type MutableNode = { id: string; label: string; children: MutableNode[] };

export function parseMindMap(text: string): readonly MindMapNode[] {
  const rows = text
    .split(/\r?\n/)
    .map((raw, index) => {
      const tabsExpanded = raw.replace(/\t/g, "  ");
      const spaces = tabsExpanded.match(/^\s*/)?.[0].length ?? 0;
      const label = tabsExpanded.replace(/^\s*(?:[-*+]\s+)?/, "").trim();
      return { depth: Math.floor(spaces / 2), label, index };
    })
    .filter((row) => row.label);

  const roots: MutableNode[] = [];
  const stack: MutableNode[] = [];

  rows.forEach((row) => {
    const node: MutableNode = {
      id: `map-node-${row.index}-${row.label.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label: row.label,
      children: [],
    };
    const depth = Math.min(row.depth, stack.length);
    if (depth === 0) roots.push(node);
    else stack[depth - 1]?.children.push(node);
    stack.splice(depth);
    stack[depth] = node;
  });

  return roots;
}

export function promptSignals(text: string) {
  const normalized = text.toLocaleLowerCase();
  return [
    { label: "Role", present: /\b(role|you are|act as)\b/.test(normalized) },
    { label: "Context", present: /\b(context|background|situation)\b/.test(normalized) },
    { label: "Task", present: /\b(task|create|produce|develop|analy[sz]e|propose)\b/.test(normalized) },
    { label: "Constraints", present: /\b(constraint|must|do not|avoid|limit|exclude)\b/.test(normalized) },
    { label: "Success criteria", present: /\b(success|criteria|must include|proof|evaluate)\b/.test(normalized) },
    { label: "Output form", present: /\b(format|return|table|list|schema|structure)\b/.test(normalized) },
  ] as const;
}

export function transformDraft(draft: WorkspaceDraft, target: WorkspaceMode): WorkspaceDraft {
  const concept = parseConcept(draft.text, draft.title);
  if (target === draft.mode) return draft;

  if (target === "mindmap") {
    return {
      ...draft,
      mode: target,
      text: `${concept.title}\n  Purpose\n    ${concept.purpose}\n  People\n    ${concept.audience}\n  Problem\n    ${concept.problem}\n  Intended change\n    ${concept.change}\n  Constraints\n    ${concept.constraints}\n  Evidence\n    ${concept.evidence}`,
    };
  }

  if (target === "prompt") {
    return {
      ...draft,
      mode: target,
      text: `ROLE\nYou are an evidence-led product strategist and prototyper.\n\nCONTEXT\n${concept.problem}\nAudience: ${concept.audience}\n\nTASK\nDevelop the smallest useful test for “${concept.title}”.\n\nCONSTRAINTS\n${concept.constraints}\nDo not invent evidence or silently resolve important uncertainty.\n\nSUCCESS CRITERIA\n${concept.evidence}\nReturn the next test, required inputs, failure conditions and the decision it should enable.`,
    };
  }

  if (target === "brief") {
    return {
      ...draft,
      mode: target,
      text: `OUTCOME\n${concept.change}\n\nAUDIENCE\n${concept.audience}\n\nSCOPE\n${concept.purpose}\n\nREQUIREMENTS\nMake assumptions, evidence and decision ownership visible.\n\nCONSTRAINTS AND EXCLUSIONS\n${concept.constraints}\n\nPROOF\n${concept.evidence}`,
    };
  }

  if (target === "code") {
    return {
      ...draft,
      mode: target,
      code: {
        html: `<main class="prototype"><p class="eyebrow">Working concept</p><h1>${escapeHtml(concept.title)}</h1><p>${escapeHtml(concept.change)}</p><section><strong>For</strong><span>${escapeHtml(concept.audience)}</span></section><button>Test the first action</button></main>`,
        css: `:root { color-scheme: dark; font-family: system-ui, sans-serif; } * { box-sizing: border-box; } body { margin: 0; background: #0a0a0c; color: #f3efe5; } .prototype { min-height: 100vh; padding: clamp(2rem, 8vw, 7rem); background: radial-gradient(circle at 75% 20%, #2830a8, transparent 28rem); } .eyebrow { color: #9da3ff; font: 700 .7rem ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; } h1 { max-width: 10ch; font: 400 clamp(3rem, 9vw, 8rem)/.88 Georgia, serif; letter-spacing: -.07em; } p { max-width: 48rem; color: #b8b5ad; font-size: 1.15rem; } section { display: grid; max-width: 42rem; gap: .4rem; margin: 3rem 0; padding: 1.25rem 0; border-block: 1px solid #34343c; } section span { color: #b8b5ad; } button { padding: 1rem 1.25rem; border: 0; background: #7780ff; color: white; font-weight: 750; }`,
        javascript: `document.querySelector('button')?.addEventListener('click', (event) => { event.currentTarget.textContent = 'First test recorded'; });`,
      },
    };
  }

  return {
    ...draft,
    mode: "idea",
    text: `Create: ${concept.title}\nFor: ${concept.audience}\nProblem: ${concept.problem}\nChange: ${concept.change}\nConstraints: ${concept.constraints}\nEvidence: ${concept.evidence}`,
  };
}

export function buildLocalReview(draft: WorkspaceDraft): AgentReview {
  const source = draft.mode === "code"
    ? `${draft.code.html}\n${draft.code.css}\n${draft.code.javascript}`
    : draft.text;
  const concept = parseConcept(draft.text, draft.title);
  const words = source.trim().split(/\s+/).filter(Boolean).length;
  const strengths = [
    source.trim() ? "There is a concrete source version to inspect and preserve." : "The workspace structure is ready for an initial source version.",
    words > 45 ? "The draft contains enough material to support a meaningful first test." : "The draft is compact enough to refine without losing its central intention.",
  ];
  const uncertainties = [
    concept.audience.startsWith("The people") ? "The primary audience is not yet explicit." : "The audience is named, but its most important decision still needs definition.",
    concept.evidence.startsWith("Define") ? "The evidence threshold for success is unresolved." : "The stated evidence needs a collection method and decision threshold.",
  ];
  const modeRisk: Record<WorkspaceMode, string> = {
    idea: "The concept may expand before its smallest responsible test is agreed.",
    code: "The interface can look complete before the underlying workflow and data boundaries are proven.",
    mindmap: "The map may show categories without clarifying causality or ownership.",
    prompt: "A polished response may still fail the success criteria if they remain subjective.",
    brief: "The brief may name outputs without defining the decisions those outputs must enable.",
  };

  return {
    summary: `${draft.title || concept.title} has a visible starting structure. The next improvement is to tighten the link between the intended change, the first user decision and the evidence that would justify building further.`,
    status: words > 90 && uncertainties.length < 3 ? "Strong" : words > 25 ? "Developing" : "Unresolved",
    strengths,
    uncertainties,
    failurePoints: [modeRisk[draft.mode], "Important constraints could be treated as later implementation details instead of design inputs."],
    assumptions: ["The named audience experiences the problem in the same way.", "A small prototype can expose the most consequential uncertainty."],
    nextTest: "Put the smallest usable version in front of three representative users and record the decision each person can or cannot make without explanation.",
    proposedChanges: [
      "State one primary audience and the decision the experience must help them make.",
      "Turn the success statement into an observable threshold for the next test.",
      "Move the most consequential constraint into the visible experience.",
    ],
    improvedInput: draft.mode === "code" ? draft.code.html : `${draft.text.trim()}\n\nNEXT TEST\nValidate the primary decision with representative users, record the evidence threshold, and preserve unresolved assumptions in the next version.`,
    buildBrief: {
      title: draft.title || concept.title,
      oneLine: concept.change,
      audience: concept.audience,
      coreExperience: concept.purpose,
      deliverables: ["Validated interaction model", "Responsive working prototype", "Evidence and assumption register", "Production implementation plan"],
      complexity: words > 180 || draft.mode === "code" ? "Advanced" : words > 70 ? "Layered" : "Focused",
    },
  };
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
