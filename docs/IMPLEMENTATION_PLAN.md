# Kingxford Intelligence Platform implementation plan

Status: active implementation  
Decision owner: kingXford & Co  
Last updated: 2026-08-04

## Product outcome

Kingxford becomes one continuous project system rather than a collection of
routes. A question can move through six governed phases without losing its
source, decisions, evidence, versions, or build context:

1. **Discover** — frame the people, need, stakes, and intended change.
2. **Investigate** — separate evidence, assumptions, and unknowns.
3. **Model** — map relationships, dependencies, and interventions.
4. **Build** — create a working proof in the live workspace.
5. **Validate** — challenge usefulness, resilience, accessibility, and risk.
6. **Launch** — scope delivery, ownership, measures, and handoff.

One **Conductor** coordinates specialist Discovery, Evidence, Systems,
Prototype, Validation, and Delivery passes. These are governed roles inside one
experience, not separate chatbot products.

## Release scope

### Foundation

- Keep Canvas projects and versions as the authority for editable work.
- Add a bounded `kingxford:platform:v1` project-intelligence sidecar for phase,
  evidence, decisions, relationships, accepted Agent runs, and map view state.
- Use strict validation, schema versions, provenance, and non-destructive error
  handling for every local persistence boundary.
- Carry ideas between routes with a short-lived session seed; never place user
  project content in a URL.

### Unified experience

- Make Create the public platform destination and embed the real workspace.
- Keep `/create/workspace` as the focused, backward-compatible workspace route.
- Replace destination-only idea routing with a new-project handoff.
- Add a visible platform entry and project action in the initial viewport.
- Reframe demonstrations, research, work, and media as evidence or starting
  points that can contribute to the same project graph.

### Intelligence

- Target `openai/gpt-5.6-sol` through Vercel AI Gateway.
- Use measured profiles: Standard uses medium reasoning; Deep uses the highest
  supported Sol effort (`max`).
- Enforce provider privacy controls where supported, bounded context, strict
  structured output, fixed-code logging, timeouts, and truthful fallbacks.
- Preserve user approval before applying generated changes or initiating any
  external handoff.
- Never store hidden chain-of-thought; retain only user-visible artifacts,
  decisions, evidence, and run provenance.

### Verification and release

- TypeScript, ESLint, production build, creative-agent gates, accessibility
  interactions, responsive visual checks, and preview smoke tests must pass.
- Daily automation evaluates configuration, privacy, schemas, and synthetic
  fixtures. It may propose improvements, but production changes remain reviewed,
  versioned, testable, and rollbackable.
- Publish through a reviewable GitHub pull request and verify the Vercel preview
  before promotion.

## Explicit boundaries

- “1000×” is a product-quality target, not a fabricated benchmark.
- “Ultra” is not an OpenAI API model slug. The strongest documented target in
  this release is GPT-5.6 Sol with `max` reasoning.
- Safeguards, privacy controls, provenance, approvals, and rollback are part of
  the platform’s intelligence and will not be removed.
- The future AI-driven Entrepreneurship destination remains disabled until a
  real URL is configured.
- Build requests are described as exports or handoffs until a real submission
  endpoint is configured; the interface must not imply a message was sent.

## Natural next release

After the local-first unified experience is verified, add the **Collaboration
and Delivery Cloud**: authentication, encrypted synchronized project graphs,
durable background Agent runs, team roles and approvals, usage controls,
real-time collaboration, and an auditable production handoff pipeline.
