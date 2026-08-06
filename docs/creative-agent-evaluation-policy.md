# Kingxford Creative Intelligence evaluation policy

Current protocol: `kxci-2026-08-05.2`

## Public claim

Kingxford Creative Intelligence is protected by deterministic governance checks
on pull requests, the production branch, a daily schedule, and manual workflow
runs. Improvements are versioned and reach production only through normal human
review and deployment controls.

This is not autonomous self-training. The workflow does not retrain model
weights, learn from production submissions, rewrite its source, or promote a
candidate release. A passing report is evidence that inspected invariants remain
present; it is not evidence of correctness for every possible prompt.

## Read-only governance boundary

The workflow may inspect repository source, the fixed corpus, agent configuration,
route protections, knowledge limits, and structured-output contracts. It writes
only disposable report artifacts inside its GitHub Actions runner.

It must never:

- change application, corpus, or evaluation source;
- commit, push, open, approve, or merge a pull request;
- modify repository, deployment, environment, billing, or production data;
- call a paid generation model or transmit workspace content;
- request repository secrets; or
- add or exercise external-action tools.

The workflow uses `contents: read`, does not persist checkout credentials, and
uploads a report even when a hard gate fails.

## Fixed corpus

`evals/creative-agent/corpus.json` is the versioned governance baseline. It
covers all five workspace modes, seven specialist lenses, evidence discipline,
embedded prompt injection, executable-content boundaries, secret rejection,
privacy, fixed-playbook grounding, usage accounting, and action denial.
Protocol v2 also fixes cases for structured Code proposals, bounded Project
Atlas snapshots, graph-integrity failures, and human-only approval gates.

Corpus changes are product changes. They require a reviewed source change and a
changelog entry here. Automated workflow runs cannot alter the corpus.

## Hard gates in protocol v2

A release passes only when the deterministic verifier confirms:

1. Protocol and corpus versions agree on `kxci-2026-08-05.2`.
2. Standard routes to `openai/gpt-5.6-terra` with its reviewed fallbacks; Deep
   routes to `openai/gpt-5.6-sol` and falls back, in order, to
   `openai/gpt-5.4` and `openai/gpt-5.6-terra`.
3. Reasoning and output ceilings remain bounded by depth, each Gateway fallback
   list is capped at two unique models, and the route performs one SDK generation
   call rather than a manual paid retry loop.
4. All seven lenses are present and accepted by the request contract.
5. The fixed playbook is versioned, deterministic, server-owned, contains no
   network ingestion path, and returns no more than three grounding entries.
6. Structured review and build-brief fields remain complete. Code reviews carry
   bounded `proposedCode.html`, `.css`, and `.javascript` fields; route
   normalization guarantees those files in Code mode and removes them otherwise.
7. The agent has no `tools` or `toolChoice` configuration and explicitly denies
   code execution, URLs, deployment, publishing, purchasing, messaging, and
   external-system changes.
8. Workspace and playbook material remain untrusted and cannot override the
   developer boundary.
9. Origin, JSON, body-size, character-budget, secret, cancellation, no-store,
   and truthful-local-fallback protections remain present.
10. Production refuses the endpoint unless `KINGXFORD_USAGE_HASH_SALT` is a
    server-only secret of at least 32 characters. Raw visitor fields are first
    compressed, then HMAC-pseudonymized; Gateway receives only a second hash.
11. The route starts a usage reservation, consumes credits before a model call,
    and always releases the resolved bucket through `finally`.
12. Minute, daily-credit, concurrency, standard-cost, and deep-cost overrides are
    hard-clamped to the reviewed ceilings.
13. The process-local usage map is bounded to 5,000 buckets, performs a bounded
    TTL/LRU cleanup, and leases one of 64 stable shared overflow buckets when it
    is full instead of granting a fresh quota through eviction.
14. Project Atlas remains a schema-versioned browser-local graph with immutable
    revision lineage, deterministic integrity checks, and human-only gates. Its
    v2 repository is capped at eight projects, strictly migrates valid Canvas v1
    data, and remaps colliding imports without erasing snapshot provenance.
15. Optional agent graph context must be paired with an active revision ID. The
    submitted full-draft hash must match that revision before a bounded snapshot
    is admitted.
16. Snapshot schema v1 caps context at 18 nodes, 24 edges, six artifacts, six
    gates, six decisions, six review links, and 14,000 canonical characters. IDs,
    hashes, references, revision bindings, and human-decision provenance are
    revalidated by the server.
17. Even a valid snapshot is delimited as untrusted prompt material. The agent
    may not infer missing evidence, decisions, reviews, or approvals.
18. Responses retain request, grounding, project snapshot, active-revision,
    usage, agent-lens, model, protocol, and remaining-limit provenance.
19. API responses retain no-store, no-cache, and MIME-sniffing protections; the
    site retains its reviewed browser security headers, with HSTS in production.
20. The contact handoff uses a validated `NEXT_PUBLIC_CONTACT_EMAIL`, and CI runs
    locked install, type-check, zero-warning lint, governance, production
    dependency audit, and build in order.
21. The fixed corpus retains unique cases and complete mode, lens, and challenge
    coverage.

A failure blocks CI. The optional public Gateway catalog check is disabled by
default and never authenticates. Network failure is a warning; a successful
catalog response that omits a configured primary model is a hard failure.

## Report and limitations

Each report records protocol and corpus versions, model routes, source hashes,
check results, optional catalog status, commit SHA, and generation time. It
contains no user prompt, workspace, credential, environment value, or provider
response.

The verifier is static governance, not a semantic quality benchmark. It guards
reviewed construction and limits without pretending that string inspection can
prove every runtime property. Human review, browser/API verification, Gateway
observability, budget controls, and rollback remain required.

## Promotion and rollback

Candidate improvements use a separate branch and reviewed pull request. CI gates
cannot be waived by an automated score. The immediately previous protocol must
remain recoverable through Git history and Vercel deployment rollback. A rollback
is a human decision and should receive a dated changelog entry.

## Changelog

### 2026-08-05 — `kxci-2026-08-05.2`

- Added deterministic, bounded Project Atlas snapshot validation and active
  artifact-revision binding while keeping graph values untrusted.
- Added structured three-file Code proposals with route normalization.
- Replaced the anonymous-identity salt construction with a required production
  HMAC secret and a second Gateway-facing hash.
- Bounded the process-local usage store with hard-clamped ceilings, TTL/LRU
  cleanup, and stable shared overflow leases.
- Added human-only graph gate, security-header, configurable-contact, strict
  lint, production dependency-audit, and local-graph governance gates.

### 2026-08-05 — `kxci-2026-08-05.1`

- Added standard/deep Gateway routing and bounded provider fallbacks.
- Added seven selectable specialist lenses and deterministic fixed-playbook
  grounding capped at three entries.
- Added request, model, latency, token, grounding, and allowance provenance.
- Added process-local minute, daily-credit, and concurrency controls with
  `finally` release semantics.
- Added salted pseudonymous Gateway identity and categorical operational tags.
- Added explicit no-tool, non-training, authentication, cloud-memory, private
  RAG, durable billing, and action-agent boundaries.
- Replaced the first-generation governance checks with protocol-v2 gates.

### 2026-08-02 — `kxci-2026-08-02.1`

- Established the first fixed corpus and deterministic schema, prompt, route,
  capability, and workflow checks.
- Added an optional unauthenticated Gateway catalog check and report-only daily
  workflow.
