# ADR 0001: Evolve Canvas into one governed intelligence platform

- Status: accepted
- Date: 2026-08-04

## Context

The site contains strong but separate experiences: a cinematic mission, Lab,
Create, interactive proofs, Work, Media, contact worksheets, and a local-first
Canvas. Routing between them loses project intent and makes each destination
feel like a different product. Canvas already contains the safest and most
capable interaction foundation, including isolated previews, movable maps,
projects, versions, and explicit Agent application.

## Decision

Evolve the existing Canvas rather than rewriting it. Canvas remains the source
of truth for editable project content. A separately versioned platform sidecar
adds cross-route phase, evidence, decisions, artifact relationships, accepted
Agent provenance, and spatial state.

The public experience presents one Kingxford Intelligence Conductor across six
phases: Discover, Investigate, Model, Build, Validate, and Launch. Specialist
agents are bounded passes coordinated inside that system. Users retain control
over context disclosure, applying changes, external communication, and release.

## Consequences

- Existing local projects and deep links remain compatible.
- Route labels can become connected lenses without large migration risk.
- Project content is not exposed in query strings.
- Local-first state is immediately useful but does not yet provide multi-device
  synchronization or durable long-running Agent jobs.
- Daily improvement is governed evaluation and reviewed promotion, not an agent
  autonomously rewriting production.

## Rejected alternatives

- A ground-up rewrite: too much regression risk for proven preview, map,
  persistence, accessibility, and versioning behavior.
- Separate agents and stores for every route: reinforces product silos and makes
  provenance difficult to reason about.
- Unreviewed autonomous self-modification: cannot provide reliable privacy,
  safety, rollback, or evidence of improvement.
