# Kingxford intelligence layer

Protocol: `kxci-2026-08-05.1`

## What is implemented

The Canvas public reviewer is a production-oriented, read-only intelligence
surface. A request remains inside the Kingxford server boundary until the API
route has validated origin, media type, request size, schema, workspace budget,
rate/concurrency allowance, and likely-secret patterns. When Gateway identity is
available, the server generates a structured review; when it is unavailable or
a provider request fails, the server returns an explicitly labelled deterministic
local review. User work is never silently discarded.

The implementation includes:

- seven specialist lenses: Conductor, Discovery, Evidence, Systems, Prototype,
  Validation, and Delivery;
- a fixed, version-controlled Kingxford playbook retrieved deterministically by
  mode, lens, objective, and workspace terms, with at most three grounding notes;
- structured analysis and build-brief fields validated before they reach the UI;
- standard and deep model routes with Gateway-managed fallbacks;
- pseudonymous Gateway `user` identity plus mode, lens, depth, and protocol tags;
- request IDs, elapsed time, actual model ID, token usage, grounding provenance,
  and remaining process-local limits in every successful response;
- browser-local history for the eight most recent reviews, clearable by the user;
- cancellation propagation, `no-store` responses, secret screening, same-origin
  enforcement, output limits, and truthful local fallback; and
- deterministic governance checks in CI.

The fixed playbook is retrieval, but it is not an external vector database and
does not ingest arbitrary user documents. Workspace content and playbook text are
marked untrusted reference material and cannot override the agent boundary.

## Model routes

| Depth | Primary model | Gateway fallbacks | Reasoning | Output ceiling | Credit cost |
| --- | --- | --- | --- | ---: | ---: |
| Standard | `openai/gpt-5.6-terra` | `openai/gpt-5.6-luna`, `openai/gpt-5.4-mini` | `medium` | 3,200 tokens | 1 |
| Deep | `openai/gpt-5.6-sol` | `openai/gpt-5.6-terra`, `openai/gpt-5.4` | `xhigh` | 5,200 tokens | 3 |

The environment variables in `.env.example` can override model slugs. Each
fallback variable is capped at two unique entries. The application makes one SDK
generation call per review; Gateway performs fallback routing, avoiding a route
loop that could amplify costs.

The models receive the submitted workspace and selected, fixed playbook notes to
produce the requested review. Gateway metadata is operational: the `user` value
is a salted SHA-256 pseudonym, and tags contain categorical route context rather
than workspace text. Kingxford does not fine-tune or train model weights on
workspace submissions. Provider retention and processing remain governed by the
Gateway/provider terms selected by the owner.

## Usage controls

Defaults are six starts per minute, 30 daily credits, and two concurrent reviews
per pseudonymous bucket. A standard review costs one credit and a deep review
costs three. The route reserves request/concurrency capacity before generation,
consumes daily credits once before a configured model call, and releases
concurrency in `finally` even after cancellation or failure.

These counters use process memory. They are useful abuse and cost guardrails but
are not durable entitlements: serverless instances do not share them and a
restart clears them. They must not be presented as paid account balances.

## Deliberate boundaries

The public reviewer does **not** have web search, shell, browser, email, calendar,
deployment, payment, database-write, MCP, or other action tools. It cannot deploy,
publish, buy, message, or change an external system. This boundary is enforced in
both instructions and construction: the agent is created without a `tools`
property.

The release also does not claim to provide:

- user authentication, organizations, roles, or administrative permissions;
- server-side conversation or project memory;
- private document ingestion or vector RAG;
- durable distributed quotas or paid subscription balances;
- Stripe billing, invoices, refunds, or entitlement webhooks; or
- authenticated action agents and human approval workflows.

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
   Add a high-entropy `KINGXFORD_USAGE_HASH_SALT` as a server-only secret. Never
   create a `NEXT_PUBLIC_` credential.
4. In AI Gateway, configure a conservative project budget, spend alerts, and the
   approved provider/model access. The application counters supplement this
   budget; they do not replace it.
5. Deploy a Preview, open `/api/workspace/agent`, and confirm the reported
   protocol, lenses, model routes, retrieval mode, and limits. `available: true`
   means Gateway identity was detected.
6. Submit a non-sensitive review in `/create/workspace`. Confirm the response is
   model-generated, its request ID and grounding are visible, and usage appears
   in Gateway observability. Also test a no-key local environment and verify the
   response is labelled local.
7. Merge only after `npm ci`, type-check, lint, governance verification, and the
   production build pass in GitHub Actions.

## Local verification

```bash
npm ci
npm run typecheck
npm run lint
npm run verify:creative-agent
npm run build
```

The governance command is deterministic and makes no paid generation request.
Set `VERIFY_GATEWAY_MODEL_CATALOG=true` only when an optional public model-catalog
check is desired. Its JSON and Markdown reports default to a temporary directory,
or use `--report-dir <path>`.
