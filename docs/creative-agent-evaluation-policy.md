# Kingxford Creative Intelligence evaluation policy

- Review protocol: `kxci-2026-08-05.2`
- Governance corpus: `kxci-governance-2026-08-06.3`

## Public claim

Kingxford Creative Intelligence is protected by deterministic governance checks
on pull requests, the production branch, a daily schedule, and manual workflow
runs. Improvements reach production only through normal human review and
deployment controls.

This is not autonomous self-training. The verifier does not retrain a model,
learn from production submissions, rewrite source, provision services, or
promote a release. A passing report confirms that reviewed construction and
boundary invariants are present in the inspected commit; it is not a guarantee
of correctness for every input or external service.

## Read-only governance boundary

The verifier may inspect repository source, the fixed corpus, route protections,
storage policy, workflow construction, and CI configuration. It writes only
disposable reports inside its runner.

It must never:

- change application, corpus, or evaluation source;
- commit, push, open, approve, or merge a pull request;
- modify repository, environment, billing, deployment, or production data;
- call a paid model or transmit workspace content;
- request repository secrets; or
- add or exercise an external-action tool.

The workflow uses `contents: read`, does not persist checkout credentials, and
uploads its report even when a gate fails.

## Fixed corpus

`evals/creative-agent/corpus.json` is the versioned governance baseline. It
covers every workspace mode and specialist lens, prompt injection, evidence
discipline, secret rejection, structured Code proposals, Atlas integrity,
human-only gates, distributed usage accounting, retry idempotency, authenticated
durable review, private evidence retention/removal, distributed contact intake,
organization invitations and membership boundaries, and denial of external
action.

Corpus changes are product changes. They require a reviewed source change and a
changelog entry here. An automated workflow cannot alter the corpus.

## Hard gates

A release passes only when the verifier confirms:

1. The implementation protocol remains `kxci-2026-08-05.2` and the fixed corpus
   is `kxci-governance-2026-08-06.3`.
2. Standard routes to `openai/gpt-5.6-terra` with the reviewed fallbacks; Deep
   routes to `openai/gpt-5.6-sol`, then `openai/gpt-5.4` and
   `openai/gpt-5.6-terra`.
3. Reasoning/output ceilings are bounded, each fallback list has no more than
   two unique models, and each review stage uses one SDK generation call instead
   of a route-level paid retry loop.
4. All seven lenses are present and accepted by the request contract.
5. The fixed playbook is versioned, deterministic, server-owned, has no network
   ingestion path, and returns no more than three grounding records.
6. Structured review/build-brief fields remain complete. Code mode returns
   bounded HTML, CSS, and JavaScript proposals; other modes remove them.
7. Review agents have no `tools` or `toolChoice` configuration and explicitly
   deny code execution, URL access, deployment, publishing, purchasing,
   messaging, and external-system mutation.
8. Workspace, playbook, and graph material remain untrusted and cannot override
   the developer boundary.
9. Public review routes retain origin, JSON, body-size, character-budget,
   likely-secret, cancellation, no-store, and truthful-local-fallback controls.
10. Production refuses review traffic without a server-only 32+ character
    `KINGXFORD_USAGE_HASH_SALT`. A bounded network identifier or user-agent
    fallback is compressed, then HMAC-pseudonymized, and Gateway receives a
    second hash.
11. Public routes await admission, consume the correct credit reservation before
    provider work, and await release of the exact lease through `finally`.
12. Minute, daily-credit, concurrency, standard-cost, and deep-cost overrides
    are hard-clamped to the reviewed ceilings.
13. Upstash is the production usage backend. Lua scripts atomically maintain
    minute counts, expiring concurrency leases, daily credits, and idempotent
    reservation IDs. Redis failures fail closed before provider work.
14. Process memory remains a bounded local fallback with 5,000 buckets, bounded
    TTL/LRU cleanup, and 64 stable overflow buckets. The explicit ephemeral hatch
    is valid only outside production and is ignored when `VERCEL=1`.
15. Project Atlas remains a schema-versioned graph with immutable revision
    lineage, deterministic integrity checks, human-only gates, bounded local
    history, strict v1 migration, and collision-safe import remapping.
16. Optional graph context is paired with an active revision and full-draft
    hash. Snapshot schema v1 caps nodes, edges, artifacts, gates, decisions,
    review links, and canonical characters at the reviewed values.
17. Responses retain request, grounding, snapshot, revision, usage, lens, model,
    protocol, and remaining-limit provenance.
18. The Supabase migration enables RLS for all application tables, defines the
    five reviewed roles, and keeps project revisions, evidence metadata,
    run/usage/audit records, and mutation idempotency organization scoped.
19. Cloud APIs require a verified session and membership. Project writes require
    idempotency and optimistic version/ETag preconditions; export and deletion
    remain authenticated and bounded.
20. Durable review requires authentication, a current cloud snapshot,
    idempotency, Gateway identity, durable usage, and service-role persistence.
    Workflow steps use stable IDs, release leases in `finally`, and preserve the
    no-tools/human-only boundary. Canvas exposes immediate and durable modes,
    starts durable work with an idempotency key, polls the authenticated status
    URL, supports cancellation, and admits a result only after exact Atlas echo
    validation.
21. Organization collaboration uses RLS-scoped invitation and deletion-receipt
    tables plus guarded database procedures. Invitation tokens are random,
    stored only as SHA-256 digests, bound to the invited email, single-use,
    limited to editor/reviewer/viewer, and expire within one hour to seven days.
22. Organization mutations require owner/admin authority, idempotency, advisory
    locks, and audit events. Admins cannot manage owners, members cannot use the
    role endpoint on themselves, and sole-owner removal or demotion is refused
    without a replacement owner.
23. A validated active-organization selection propagates through project,
    evidence, export, and durable-review requests, while each server route still
    checks membership. Account and invitation interfaces expose only permitted
    actions; acceptance removes the fragment token, bounds temporary retention,
    requires the invited email, and never uploads local work. Account deletion
    is exact-organization pinned, replayable, and retries server-owned evidence
    cleanup.
24. Private evidence uses the non-public 5 MB `kingxford-private` bucket,
    organization/project-prefixed deterministic paths, strict extension/MIME and
    content validation, SHA-256 records, service-route-only object I/O after
    cookie authentication and RBAC, and verified no-store downloads. Browser
    sessions have no direct Storage policy. Canvas exposes deliberate
    retain/download/remove controls with role-aware read-only states and never
    equates local capture with upload.
25. Evidence upload and removal require same-origin authentication, writer role,
    idempotency, project/artifact binding, advisory locks, and audit events.
    Removal prepares a database tombstone before Storage deletion and completes
    metadata deletion afterward, leaving failed work visible and retryable.
26. Contact intake uses same-origin bounded JSON, schema/consent validation,
    honeypot and secret screening, lazy Resend configuration, provider
    idempotency, no-store responses, and privacy-bounded logs.
27. Contact abuse protection HMAC-pseudonymizes its visitor and delivery keys,
    uses an independent Upstash namespace with atomic 3-per-10-minute and
    8-per-day limits, reserves duplicate deliveries, returns `Retry-After`, and
    fails closed on shared deployments. Its bounded process-memory hatch is
    local-only and independent from AI usage credits.
28. Create exposes exactly seven governed workflow templates and evidence intake
    enforces bounded local capture with `networkAccess: "none"` and no URL fetch.
29. API and site security headers remain present; Supabase is the only required
    external browser connection. Workflow is wrapped through `withWorkflow` and
    its signed internal path bypasses session refresh.
30. Vercel Analytics and Speed Insights are mounted once, the health diagnostic
    is no-store and secret-free, and operational logging rejects sensitive field
    names.
31. `.env.example` lists all required public and server-only configuration,
    distinguishes the Supabase publishable key from secrets, and documents both
    non-Vercel ephemeral test hatches without advertising a disconnected
    external workspace.
32. CI uses Node.js 24 and runs locked installation, type-check, zero-warning
    lint, intelligence/platform/foundation tests, editorial and AI governance,
    production dependency audit, and build in reviewed order.
33. The fixed corpus retains unique cases and complete mode, lens, and challenge
    coverage.

A hard-gate failure blocks CI. The optional public Gateway catalog check is off
by default and never authenticates. Network failure is a warning; a successful
catalog response that omits an approved model or reasoning effort is a hard
failure.

## Report and limitations

Each report records protocol and corpus versions, model routes, source hashes,
check results, optional catalog status, commit SHA, and generation time. It
contains no prompt, workspace, credential, environment value, or provider
response.

Static verification cannot prove live Supabase RLS or Storage behavior,
invitation acceptance or role transitions, Redis atomicity, tombstone recovery,
email delivery, provider availability, Workflow recovery, accessibility, or
semantic response quality. Unit/integration tests, migration review, Preview
acceptance tests, provider budgets, Vercel observability, and rollback remain
required.

## Promotion and rollback

Candidate changes use a separate branch and reviewed pull request. An automated
score cannot waive CI. The prior release must remain recoverable through Git
history and Vercel deployment rollback. Promotion and rollback are human
decisions and should be recorded with the affected protocol/corpus version.

## Changelog

### 2026-08-06 — `kxci-governance-2026-08-06.3`

- Replaced production process-local usage assumptions with atomic Upstash Lua
  gates, stable leases, idempotent credit reservations, fail-closed outages, and
  an explicit non-Vercel test hatch.
- Added deterministic checks for Supabase Auth/organizations/RLS, versioned
  cloud projects, private storage, audit/usage records, export, and deletion.
- Added authenticated Vercel Workflow review gates, including current-snapshot
  binding, idempotent start, retry-safe usage, persisted outcomes, and human-only
  authority.
- Added UI integration gates for role-aware cloud project controls and the
  immediate/durable review selector, polling, cancellation, exact-binding
  validation, and deliberate revision acceptance.
- Added strict private-evidence gates for 5 MB validation, deterministic paths,
  service-route-only object access, hash-verified downloads, explicit Canvas
  controls, and retryable two-stage deletion tombstones.
- Removed direct authenticated writes to private Storage objects and server-owned
  run, usage, and audit records while preserving RLS-scoped reads.
- Added independent distributed contact gates for HMAC identity, atomic Upstash
  allowances, pending/delivered/retry reservations, fail-closed readiness, and a
  non-Vercel local test hatch.
- Added organization-collaboration gates for expiring digest-only invitations,
  membership roles, owner safeguards, validated organization selection,
  fragment-safe acceptance, audit/idempotency, and replayable exact-organization
  account deletion.
- Added secure Resend intake, trust-page, Analytics, Speed Insights, health,
  structured-log, seven Create workflow, and bounded evidence-ingestion checks.
- Aligned the CI runtime and documented owner deployment baseline with Node 24.

### 2026-08-05 — `kxci-governance-2026-08-05.2`

- Added bounded Atlas snapshot validation and active artifact-revision binding.
- Added structured three-file Code proposals and route normalization.
- Required a production HMAC secret and second Gateway-facing identity hash.
- Bounded the local usage store and added human-only graph/security gates.

### 2026-08-05 — `kxci-governance-2026-08-05.1`

- Added standard/deep Gateway routing, seven lenses, fixed-playbook grounding,
  response provenance, local usage guards, and explicit no-tool boundaries.

### 2026-08-02 — `kxci-governance-2026-08-02.1`

- Established the fixed corpus and deterministic schema, prompt, route,
  capability, and workflow checks.
