# Kingxford AI review layer

- Focused-review protocol: `kxci-2026-08-05.2`
- Conductor protocol: `kx-intelligence-2026-08-05.2`

## What is implemented

The Canvas combines a local-first Project Atlas with two proposal-only review
surfaces: focused review and a coordinated project review. A request remains inside the Kingxford server
boundary until the API route has validated origin, media type, request size,
schema, workspace budget, rate/concurrency allowance, likely-secret patterns,
and any submitted project snapshot. When Gateway identity is available, the
server generates a structured review; when it is unavailable or a provider
request fails, the server returns an explicitly labelled deterministic,
rule-based local review. User work is never silently discarded.

The implementation includes:

- seven specialist lenses: Conductor, Discovery, Evidence, Systems, Prototype,
  Validation, and Delivery;
- an Atlas-bound project review that produces a structured phase plan, runs up to
  two specialist reviews in parallel, and summarizes them within a four-call
  server reservation;
- a fixed, version-controlled Kingxford playbook retrieved deterministically by
  mode, lens, objective, and workspace terms, with at most three grounding notes;
- structured analysis and build-brief fields validated before they reach the UI,
  including complete HTML, CSS, and JavaScript proposals for Code reviews;
- standard and deep model routes with Gateway-managed fallbacks;
- pseudonymous Gateway `user` identity plus mode, lens, depth, and protocol tags;
- request IDs, elapsed time, actual model ID, token usage, grounding and project
  provenance, and remaining process-local limits in successful responses;
- browser-local history for the eight most recent reviews, clearable by the user;
- cancellation propagation, no-store responses, secret screening, same-origin
  enforcement, output limits, response and site security headers, and truthful
  local fallback;
- a bounded, integrity-checked Project Atlas snapshot for review continuity,
  optional for focused review and required for every coordinated project review, tied to the
  exact active artifact revision and full draft hash; and
- deterministic governance checks in CI.

The fixed playbook is retrieval, but it is not an external vector database and
does not ingest arbitrary user documents. Workspace content, playbook text, and
project snapshot values are untrusted reference material and cannot override the
agent boundary.

## Project Atlas and graph-aware review

Project Atlas is a versioned, browser-local graph for one project lifecycle:
Discovery, Evidence, Systems, Prototype, Validation, and Delivery. It links
artifacts, immutable revisions, semantic nodes, evidence, reviews, decisions,
and gates. The `kingxford:projects:v2` repository retains at most twenty projects.
Projects can be created, switched, imported, and exported; valid Canvas v1 state
is strictly migrated on first load. If an imported project ID collides, graph
entities are remapped into a cloned project while immutable source snapshot
provenance is retained. This is a local-first capability, not a claim of cloud
storage, synchronization, user accounts, or server-side project memory.

The browser may submit snapshot schema v1 with an active artifact revision ID.
The snapshot is capped at 18 nodes, 24 edges, six artifacts, six gates, six
decisions, six review links, and 14,000 canonical characters. The server
recomputes deterministic identity, content and excerpt hashes, character count,
references, revision bindings, and human-decision provenance. It also hashes the
full submitted workspace draft and requires it to match the selected active
revision. Invalid, stale, oversized, or unpaired context is rejected before
generation.

Integrity does not make project text trustworthy. The accepted snapshot is
delimited as `UNTRUSTED_PROJECT_GRAPH_SNAPSHOT`; every value remains analysis
material and cannot approve a gate, invent evidence, or override agent
instructions. Responses echo compact snapshot and revision provenance so the UI
can bind a review to the context actually assessed.

## Model routes

| Depth | Primary model | Gateway fallbacks | Reasoning | Output ceiling | Credit cost |
| --- | --- | --- | --- | ---: | ---: |
| Standard | `openai/gpt-5.6-terra` | `openai/gpt-5.6-luna`, `openai/gpt-5.4-mini` | `medium` | 3,200 tokens | 1 |
| Deep | `openai/gpt-5.6-sol` | `openai/gpt-5.4`, `openai/gpt-5.6-terra` | `xhigh` | 5,200 tokens | 3 |

The environment variables in `.env.example` can override model slugs for both
focused review and coordinated project review. Each
fallback variable is capped at two unique entries. The application makes one SDK
generation call per focused review and one SDK call per coordinated-review stage; Gateway
performs fallback routing, avoiding route-level retry loops that could amplify
costs. A complete coordinated review is capped at plan + two parallel specialists +
synthesis. Every stage records its actual model, status, latency, and token use.

The models receive the submitted workspace, selected fixed playbook notes, and
an optional validated project snapshot to produce the requested review. Gateway
metadata is operational: raw address and user-agent fields are compressed into a
fingerprint, pseudonymized with a server-secret HMAC, and hashed again before the
`user` value leaves the route. Tags contain categorical route context rather
than workspace text. Kingxford does not fine-tune or train model weights on
workspace submissions. Provider retention and processing remain governed by the
Gateway/provider terms selected by the owner.

## Readiness contract

`GET /api/workspace/agent` and `GET /api/intelligence/runs` return the same
strict, client-safe `readiness` object under contract
`kx-ai-readiness-2026-08-06.1`. The diagnostic performs no paid generation and
never returns a key, token, salt, prompt, visitor fingerprint, or project data.

The top-level readiness fields have deliberately separate meanings:

| Field | Meaning |
| --- | --- |
| `codeReady` | The loaded route has valid primary/fallback slugs and retains proposal-only governance: no tools, no automatic apply, and human-only gate approval. |
| `providerReady` | A non-blank Gateway API key, local OIDC identity, or Vercel deployment with automatic request-scoped OIDC is available and the model routes are syntactically valid. This is configuration readiness, not a live provider probe. |
| `usageProtectionReady` | The exact protection used by POST is available. Production requires a server-only salt of at least 32 characters; development may use its documented local fallback. |
| `deploymentReady` | `codeReady`, `providerReady`, and `usageProtectionReady` are all true, so the environment is configured to attempt provider-backed reviews. |
| `localFallbackReady` | The deterministic, rule-based fallback can safely serve requests even when Gateway identity is absent. |

`status` is `ready`, `local-fallback`, `deployment-blocked`, or
`configuration-invalid`. `blockers` contains stable codes and bounded operator
messages. `provider.authMethod` is only `gateway-api-key`, `vercel-oidc`, or
`none`; both live-connection and request-time catalog verification remain
explicitly `false`. `routes` publishes normalized standard/deep primary,
fallback, reasoning, and output-ceiling configuration. `governance` exposes the
three non-negotiable proposal-only controls.

Gateway API-key precedence matches the installed SDK: a non-empty key is chosen
before OIDC. A whitespace-only key is therefore reported as
`gateway-api-key-invalid` and model calls remain on deterministic local fallback until
the value is removed or corrected; readiness never silently claims OIDC would
override it.

The older `available`, `gateway`, and `usageProtectionConfigured` fields remain
for compatibility and mirror `deploymentReady`, `providerReady`, and
`usageProtectionReady`. A UI may use `providerReady` to distinguish real model
generation from local fallback. It should keep `local-fallback` usable and treat
`deployment-blocked` as an environment blocker; `configuration-invalid` is a
release defect rather than an environment state. Provider credentials or model
reachability can still fail after a configured diagnostic, so POST keeps its
recoverable, truthfully labelled local fallback.

## Usage controls

Defaults are six starts per minute, 30 daily credits, and two concurrent runs
per pseudonymous bucket. A focused standard review costs one credit and a deep
review costs three. A coordinated review reserves and charges the exact stage
budget: up to four standard units or twelve deep credits. Routes reserve
request/concurrency capacity before generation, consume daily credits before a
configured model call, and release the resolved bucket in `finally` even after
cancellation or failure.

These counters use process memory. They are useful abuse and cost guardrails but
are not durable entitlements: serverless instances do not share them and a
restart clears them. They must not be presented as paid account balances.
Deployment overrides may lower the defaults but are hard-clamped at six, 30,
and two. The map is capped at 5,000 buckets, expires idle visitor buckets after
25 hours through bounded cleanup scans, and maintains LRU order. When full, a
new visitor is assigned deterministically to one of 64 preallocated shared
overflow buckets. That stable lease fails closed under high-cardinality traffic
instead of evicting a bucket and granting a fresh quota.

## Deliberate boundaries

The focused and coordinated reviewers do **not** have web search, shell, browser, email, calendar,
deployment, payment, database-write, MCP, or other action tools. It cannot deploy,
publish, buy, message, or change an external system. This boundary is enforced in
both instructions and construction: the agent is created without a `tools`
property.

Project Atlas does include local, explicit human phase decisions: every gate is
`human-only`, a recorded decision carries `human-confirmation` provenance and
supporting evidence, and an AI review can never mark a gate approved. This is not
an authenticated organizational approval service; identity and authorization
must be added before those decisions can be shared or relied on across users.

The release also does not claim to provide:

- user authentication, organizations, roles, or administrative permissions;
- server-side conversation or project memory;
- private document ingestion or vector RAG;
- durable distributed quotas or paid subscription balances;
- Stripe billing, invoices, refunds, or entitlement webhooks; or
- authenticated action agents or shared approval workflows.

Those capabilities need owner-controlled services, credentials, data-retention
decisions, and product rules. A recommended production extension is Supabase
Auth/Postgres/pgvector/Storage, a distributed Redis limiter, and Stripe. Any
future action tool should live behind authenticated authorization, narrow scopes,
idempotency, audit logs, and explicit confirmation for consequential actions.
Do not add those powers to this anonymous endpoint.

## Owner setup on Vercel

1. Link the GitHub repository to the intended Vercel project and select Node.js
   22 or newer.
2. Enable Vercel AI Gateway. For Vercel deployments, enable OIDC so the platform
   supplies a short-lived workload identity. Use `AI_GATEWAY_API_KEY` only for a
   local or non-Vercel environment that cannot use OIDC.
3. Copy the non-secret defaults from `.env.example` into Preview and Production.
   Set `NEXT_PUBLIC_CONTACT_EMAIL` to the owner-controlled public project inbox.
   Add a unique high-entropy `KINGXFORD_USAGE_HASH_SALT` of at least 32 characters
   as a server-only secret. Production review requests fail closed without it.
   Never create a `NEXT_PUBLIC_` credential.
4. In AI Gateway, configure a conservative project budget, spend alerts, and the
   approved provider/model access. The application counters supplement this
   budget; they do not replace it.
5. Deploy a Preview, open `/api/workspace/agent` and `/api/intelligence/runs`,
   and confirm the reported protocols, lenses/roles, model routes, retrieval
   mode, snapshot bounds, capability negotiation, limits, and identical
   readiness-contract versions. `readiness.codeReady: true` confirms that the
   loaded API contract and governance configuration are valid;
   `readiness.deploymentReady: true` additionally confirms that Gateway identity
   and usage protection are configured. This remains a configuration check, not
   proof of a successful provider call.
6. Submit a non-sensitive focused review and coordinated project review in
   `/create/workspace`. Confirm the responses are
   AI-assisted, its request ID and grounding are visible, and usage appears
   in Gateway observability. Also test a no-key local environment and verify the
   response is labelled local.
7. Create or import a local Atlas project, submit a revision-bound review, and
   verify that a stale or modified draft is rejected. Confirm that an AI result
   cannot record a phase-gate decision without the explicit human action.
8. Merge only after locked install, type-check, zero-warning lint, governance
   verification, production dependency audit, and the production build pass in
   GitHub Actions.

## Local verification

```bash
npm ci
npm run typecheck
npm run lint -- --max-warnings=0
npm run test:intelligence
npm run test:platform
npm run verify:creative-agent
npm audit --omit=dev --audit-level=high
npm run build
npm run verify:platform-journey
```

The governance command is deterministic and makes no paid generation request.
Set `VERIFY_GATEWAY_MODEL_CATALOG=true` only when an optional public model-catalog
check is desired. It verifies every approved primary and fallback model plus the
requested reasoning effort against the current public Gateway catalog. Its JSON
and Markdown reports default to a temporary directory, or use
`--report-dir <path>`.
