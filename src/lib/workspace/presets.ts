import type { WorkspaceDraft, WorkspaceMode } from "@/lib/workspace/types";

export const modeDetails: Record<
  WorkspaceMode,
  Readonly<{ label: string; shortLabel: string; description: string; placeholder: string }>
> = {
  idea: {
    label: "Idea",
    shortLabel: "Idea",
    description: "Turn a rough thought into a testable concept.",
    placeholder: "Describe what you want to create, who it is for, and why it should exist.",
  },
  code: {
    label: "Code",
    shortLabel: "Code",
    description: "Run HTML, CSS and JavaScript in an isolated browser.",
    placeholder: "Write front-end code and run it in the live preview.",
  },
  mindmap: {
    label: "Mind map",
    shortLabel: "Map",
    description: "Expose relationships, branches and assumptions.",
    placeholder: "Use indentation to create branches and sub-branches.",
  },
  prompt: {
    label: "Prompt",
    shortLabel: "Prompt",
    description: "Test instructions against criteria you define.",
    placeholder: "State the role, context, task, constraints and success criteria.",
  },
  brief: {
    label: "Brief",
    shortLabel: "Brief",
    description: "Shape an idea into an implementation-ready specification.",
    placeholder: "Define the outcome, audience, scope, requirements and proof.",
  },
};

export const initialDraft: WorkspaceDraft = {
  mode: "idea",
  title: "Neighbourhood Climate Commons",
  text: `Create: Neighbourhood Climate Commons
For: Residents, schools, public-health teams and local planners
Problem: Heat risks are visible at city scale but difficult to understand street by street.
Change: Turn local observations into practical cooling actions, shared learning and accountable neighbourhood plans.
Constraints: Privacy, uneven sensor coverage, limited budgets and accessible participation.
Evidence: Public weather data, resident observations, shade audits and before-and-after field measurements.`,
  code: {
    html: `<main class="concept">
  <p class="eyebrow">A living neighbourhood instrument</p>
  <h1>Cooler streets begin with visible evidence.</h1>
  <p class="lede">Combine public data and resident knowledge into actions a neighbourhood can test together.</p>
  <div class="signals">
    <article><span>01</span><strong>Observe</strong><small>Map heat, shade and movement.</small></article>
    <article><span>02</span><strong>Decide</strong><small>Compare practical interventions.</small></article>
    <article><span>03</span><strong>Learn</strong><small>Publish what changed.</small></article>
  </div>
  <button id="prototype-action">Test the next action</button>
  <p id="prototype-status" role="status"></p>
</main>`,
    css: `:root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: #07100e; color: #edf8f3; }
.concept { min-height: 100vh; padding: clamp(2rem, 7vw, 6rem); background: radial-gradient(circle at 75% 15%, #1d5f4b 0, transparent 28rem); }
.eyebrow { color: #73dcb9; font: 700 .68rem/1.4 ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; }
h1 { max-width: 9ch; margin: 1.5rem 0; font-family: Georgia, serif; font-size: clamp(3.2rem, 9vw, 7.5rem); font-weight: 400; letter-spacing: -.07em; line-height: .86; }
.lede { max-width: 42rem; color: #b5c9c1; font-size: clamp(1rem, 2vw, 1.25rem); }
.signals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin: 4rem 0 2rem; background: #31534a; border: 1px solid #31534a; }
.signals article { display: grid; min-height: 10rem; gap: .5rem; padding: 1.25rem; background: #0d1d18; }
.signals span, .signals small { color: #8da89e; }
.signals strong { font-size: 1.25rem; }
button { padding: .9rem 1.2rem; border: 0; background: #73dcb9; color: #07100e; font-weight: 800; cursor: pointer; }
#prototype-status { min-height: 1.5rem; color: #73dcb9; }
@media (max-width: 620px) { .signals { grid-template-columns: 1fr; } }`,
    javascript: `const action = document.querySelector('#prototype-action');
const status = document.querySelector('#prototype-status');
action?.addEventListener('click', () => {
  status.textContent = 'Prototype response: begin with a shaded-route walk and publish the observation method.';
});`,
  },
};

export const starterText: Record<Exclude<WorkspaceMode, "code">, string> = {
  idea: initialDraft.text,
  mindmap: `Neighbourhood Climate Commons
  Understand the place
    Heat and shade
    Movement and access
    Resident experience
  Decide together
    Compare interventions
    Make trade-offs visible
    Define responsibility
  Test in public
    Small field pilot
    Shared measures
    Publish learning`,
  prompt: `ROLE
You are an evidence-led service designer working with a neighbourhood coalition.

CONTEXT
The coalition needs a practical response to street-level heat risk. Available evidence is uneven and participation must remain accessible.

TASK
Propose the smallest responsible pilot that can produce useful learning within 30 days.

CONSTRAINTS
Do not invent local statistics. Separate observations, assumptions and recommendations. Keep the pilot affordable and reversible.

SUCCESS CRITERIA
Name the participants, inputs, sequence, evidence threshold, accessibility checks, failure conditions and next decision.`,
  brief: `OUTCOME
Make street-level heat risk understandable and actionable for residents and local institutions.

AUDIENCE
Residents, schools, public-health teams and local planners.

SCOPE
A local observation workflow, intervention comparison, shared action plan and public learning record.

REQUIREMENTS
Mobile-first participation; visible evidence provenance; accessible language; exportable reports; clear ownership.

EXCLUSIONS
No medical diagnosis, predictive risk scoring or claims beyond the available evidence.

PROOF
A 30-day pilot produces a documented baseline, one tested intervention and a decision on the next iteration.`,
};

export const transformLabels: Record<WorkspaceMode, string> = {
  idea: "Idea note",
  code: "Code prototype",
  mindmap: "Mind map",
  prompt: "Test prompt",
  brief: "Production brief",
};
