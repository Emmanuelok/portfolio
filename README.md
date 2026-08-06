# kingXford & Co

kingXford & Co is an intelligence, research, and development company preparing
people and institutions for sustainable abundance. It combines rigorous
inquiry, responsible AI, systems intelligence, and product development to solve
complex problems and turn ambitious ideas and projects into durable capability.

The platform now centres on one continuous **Kingxford Intelligence** project
system. Work moves through six canonical phases—Discovery, Evidence, Systems,
Prototype, Validation, and Delivery—without discarding its source, evidence,
or decisions. Public-facing verbs such as Discover, Investigate, Model, Build,
Validate, and Deliver are views onto that same lifecycle. A coordinated project
review uses the current Atlas revision and up to two phase-specific specialist
reviews rather than presenting a collection of disconnected AI tools.

The `& Co` represents investors of every kind: people and institutions who
contribute capital, time, knowledge, research, technology, infrastructure,
access, or trust to consequential work.

- **Studio** is the Build lens for intelligent tools, AI-enabled products, decision-support
  systems, web applications, digital infrastructure, and communication systems.
- **The Living Room** is the systems lens for complex mandates,
  foresight, institutional transformation, venture development, and coalitions.
- **Lab** is the evidence lens for research, experimentation, responsible-AI
  evaluation, evidence synthesis, data systems, and scientific communication.

The landing page uses a long native-scroll cinematic built from high-resolution
licensed documentary photography, clearly disclosed photoreal conceptual
editorial imagery, and the dominant kingXford & Co X-Frame. Conceptual imagery is
never presented as documentary evidence, a measured outcome, or literal product
UI. A purpose-built static composition preserves the full story for
reduced-motion visitors.

## Media

`/media` publishes kingXford & Co evidence briefings, field notes, essays, and
future conversations about intelligence, research and development, responsible
AI, complex systems, and sustainable abundance. Published articles include
`/media/how-to-get-ahead-in-the-ai-era`, with a practical 30-day framework and
institutional research notes, and `/media/sustainable-abundance-for-all`, an
evidence-led briefing grounded in official institutional sources.

Articles support an optional narrated edition, but no audio asset is shipped in
this release. A player appears only when an approved audio record exists;
future narration must meet the consent, editorial, disclosure, transcript, and
listening-review requirements in `creative/narration-policy.md`.

The public routes remain useful lenses into one platform. `/create` contains the
real creation workspace, while `/create/workspace` remains the focused entry for
ideas, code, mind maps, prompts, briefs, live previews, versions, and optional
AI-assisted review. The implementation plan and architectural decision are documented in
[`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) and
[`docs/adr/0001-unified-intelligence-platform.md`](docs/adr/0001-unified-intelligence-platform.md).

The current build generates 26 public, framework, and API routes, including
eight case studies, the Media index, two Media articles, the focused Canvas,
and two project-review API endpoints.

## Kingxford project review

The Canvas at `/create/workspace` is the shared operating surface for one
project lifecycle: Discovery → Evidence → Systems → Prototype → Validation →
Delivery. The Project Atlas links artifacts, immutable revisions, evidence,
open questions, reviews, and human gates in a versioned local-first graph.
Projects can be created, switched, imported, and exported without claiming
cloud persistence; public Work, Lab, Media, and Create surfaces can deliberately
seed a new project or add evidence to an existing one.

The Canvas also includes two complementary, server-mediated review paths.
Focused review combines seven selectable lenses, a fixed Kingxford playbook,
project-aware structured output, standard/deep Gateway routing, deterministic
local fallback, and private review history stored in the current browser. The
coordinated review can create a phase plan, run up to two specialist reviews,
and summarize their findings against the exact Atlas snapshot and artifact revision.
Both paths are proposal-only: nothing changes the project and no lifecycle gate
is approved until a person deliberately accepts a revision or records a gate
decision.

The public reviewer is intentionally bounded: workspace content is treated as
untrusted, the agent has no external-action tools, credentials are rejected
before model generation, and responses expose the selected lens, grounding,
request ID, elapsed time, token usage, model, and remaining process-local
allowance. Vercel AI Gateway receives a pseudonymous user identifier and
operational tags; workspace prompts are not used to train Kingxford models.

Both AI diagnostic endpoints expose the same strict, secret-free readiness
contract. It separates `codeReady` from `providerReady`,
`usageProtectionReady`, and `deploymentReady`, so operators and UI can tell a
valid API with local rule-based fallback from a deployment that is configured
to attempt an AI-assisted review. A diagnostic never performs or claims a live
provider request.

See [`docs/intelligence-layer.md`](docs/intelligence-layer.md) for architecture,
environment variables, deployment instructions, limitations, and the owner
checklist. Governance policy and fixed cases live in
[`docs/creative-agent-evaluation-policy.md`](docs/creative-agent-evaluation-policy.md)
and [`evals/creative-agent/corpus.json`](evals/creative-agent/corpus.json).

## Run locally

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run typecheck
npm run lint -- --max-warnings=0
npm run test:intelligence
npm run test:platform
npm run verify:editorial-voice
npm run verify:creative-agent
npm run build
npm run verify:platform-journey
```

The project requires Node.js 22 or newer and uses Next.js App Router. No
environment variables are required for the public portfolio or local rule-based
Canvas review. Configure Vercel AI Gateway/OIDC to enable AI-assisted reviews.
Production also requires a private `KINGXFORD_USAGE_HASH_SALT`; set
`NEXT_PUBLIC_CONTACT_EMAIL` to an owner-controlled public project inbox. Start
from `.env.example` and never commit real credentials.

Public interface copy follows [`docs/editorial-voice.md`](docs/editorial-voice.md).
The editorial verification rejects promotional stock phrases and inaccurate
AI-readiness language in user-facing source files.
