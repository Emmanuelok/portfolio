# kingXford & Co

kingXford & Co is an intelligence, research, and development company preparing
people and institutions for sustainable abundance. It combines rigorous
inquiry, responsible AI, systems intelligence, and product development to solve
complex problems and turn ambitious ideas and projects into durable capability.

The platform now centres on one continuous **Kingxford Intelligence** project
system. Work moves through Discover, Investigate, Model, Build, Validate, and
Launch without discarding its source or decisions. A Conductor coordinates
governed specialist passes inside the same project rather than presenting a
collection of disconnected AI tools.

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
ideas, code, mind maps, prompts, briefs, live previews, versions, and governed AI
review. The implementation plan and architectural decision are documented in
[`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) and
[`docs/adr/0001-unified-intelligence-platform.md`](docs/adr/0001-unified-intelligence-platform.md).

The current build is expected to generate 23 public and framework routes,
including eight case studies, the Media index, and two Media articles.

## Run locally

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
```

The project uses Next.js App Router and is designed for Vercel deployment. No environment variables are required for the public portfolio.
