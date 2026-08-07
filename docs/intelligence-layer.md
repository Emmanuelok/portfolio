# Kingxford intelligence and production foundation

- Focused-review protocol: `kxci-2026-08-05.2`
- Conductor protocol: `kx-intelligence-2026-08-05.2`
- AI readiness contract: `kx-ai-readiness-2026-08-06.1`

## Operating model

Kingxford treats Discovery, Evidence, Systems, Prototype, Validation, and
Delivery as phases of one Project Atlas record. Public Studio, Living Room,
Lab, Work, Media, and Create pages are lenses into that record. Create adds
seven domain workflows—websites, digital tools, institutional systems, research
and AI tools, operational tools, education tools, and everyday personal tools—
without changing the six canonical phases.

Atlas links semantic nodes, evidence, artifacts, immutable revisions, reviews,
decisions, and human-only gates. The browser repository remains the immediate
offline-capable source of work. When Supabase is configured, a signed-in member
may explicitly synchronize a project to an organization record; cloud storage
does not happen silently.

## Review paths

### Focused review

`POST /api/workspace/agent` performs one bounded review through a selected lens:
Conductor, Discovery, Evidence, Systems, Prototype, Validation, or Delivery. It
uses a fixed, version-controlled Kingxford playbook and returns structured
analysis, a next test, proposed changes, and a build brief. Code mode can return
complete bounded HTML, CSS, and JavaScript proposals.

### Coordinated review

`POST /api/intelligence/runs` validates an Atlas snapshot, prepares a phase
plan, runs no more than two relevant specialist reviews, and synthesizes the
result. The maximum provider reservation is plan + two specialists + synthesis.
Every stage records status, latency, token use, and the actual model identifier.

### Durable authenticated review

`POST /api/intelligence/workflows` starts the same coordinated review through
Vercel Workflow. This route requires:

- a valid Supabase session and organization membership;
- an editor, admin, owner, or reviewer role capable of starting a review
  (viewers remain read-only);
- a cloud-saved project whose current snapshot hash matches the submitted Atlas
  snapshot;
- a valid `Idempotency-Key`;
- AI Gateway identity, a server-only usage HMAC secret, durable Upstash usage
  controls, and the Supabase service-role client used by workflow steps.

The route registers the request in `intelligence_runs`, then returns `202` with
a workflow run ID and status URL. Repeating the same idempotency key and body
returns the existing run; reusing the key for different input returns a
conflict. `GET /api/intelligence/workflows?runId=...` reports organization-
scoped status and outcome. `DELETE` permits cancellation by the person who
started the run or an organization administrator.

The Project review panel exposes two explicit continuity modes. **Current
session** calls the immediate coordinated route and requires the page to remain
open. **Cloud** starts the durable route with a fresh idempotency key, polls the
returned authenticated status URL with no-store requests, and sends a
cancellation request when the person stops the run. Timeout and provider/error
states leave the project unchanged and preserve the cloud audit record where
available.

Workflow steps reserve and charge usage with stable step-derived identifiers,
execute the bounded review, release the lease in `finally`, persist the outcome
and token record, and append an audit event. A retry can replay the lease or
credit reservation without charging it twice. Workflow durability improves
execution reliability; it does not give the reviewer authority to publish,
mutate a project, or approve a gate.

## Model routes

| Depth | Primary model | Gateway fallbacks | Reasoning | Output ceiling | Credit cost per call |
| --- | --- | --- | --- | ---: | ---: |
| Standard | `openai/gpt-5.6-terra` | `openai/gpt-5.6-luna`, `openai/gpt-5.4-mini` | `medium` | 3,200 tokens | 1 |
| Deep | `openai/gpt-5.6-sol` | `openai/gpt-5.4`, `openai/gpt-5.6-terra` | `xhigh` | 5,200 tokens | 3 |

Each fallback variable accepts no more than two unique provider/model slugs.
Gateway manages provider fallback inside one SDK generation call for each stage;
the route does not implement an additional paid retry loop. A focused review
reserves one call. A coordinated review reserves the exact planned call count,
up to four calls.

The model receives the bounded workspace, selected fixed-playbook entries, and
an optional validated Atlas snapshot. Playbook entries and project values are
delimited as untrusted reference material. They cannot override the developer
boundary or establish evidence that is absent from the record.

## Request and identity protections

Both public review routes enforce same-origin requests, JSON media type, declared
and actual body-size limits, schema and character limits, likely-secret
screening, cancellation, no-store responses, and bounded output. Production
rejects POST when `KINGXFORD_USAGE_HASH_SALT` is absent or shorter than 32
characters.

The route compresses a bounded network address when available, or a bounded
user-agent fallback, into a request fingerprint and then HMAC-pseudonymizes it
with a server secret. The AI SDK hashes the pseudonym again before assigning the
Gateway `user`. Gateway tags contain only categorical route context such as
mode, lens, depth, and protocol. Operational
logs use a structured allowlist that discards fields named for prompts, bodies,
content, documents, credentials, cookies, email, and other sensitive material.

## Distributed usage controls

The reviewed ceilings are six request starts per minute, 30 daily credits, and
two concurrent runs for each pseudonymous usage key. Environment overrides may
lower but cannot raise those ceilings. Standard costs one credit per provider
call and Deep costs three.

In Preview and Production, Upstash Redis is the required backend. Lua scripts
atomically:

- expire stale concurrency leases and admit a start only when the minute and
  concurrency limits permit it;
- register a five-minute lease with an idempotent lease ID;
- charge the daily allowance once for a stable reservation ID; and
- remove the exact lease when work finishes.

All keys are namespace- and usage-key scoped, with minute/day windows and
bounded expiry. A Redis error fails closed before provider work. The API GET
diagnostics expose `usageBackend` and `durableAcrossInstances` without returning
credentials or keys.

A bounded process-memory implementation remains for local development and
tests. `KINGXFORD_ALLOW_EPHEMERAL_USAGE=1` explicitly enables that path on a
non-Vercel runtime, but `VERCEL=1` ignores the hatch. Production without Upstash
reports a missing backend and refuses review traffic. Process-memory allowance
is never described as a shared balance or entitlement.

## Readiness contract

`GET /api/workspace/agent` and `GET /api/intelligence/runs` return the same
secret-free readiness object under `kx-ai-readiness-2026-08-06.1`. These GETs do
not generate tokens or prove live provider reachability.

| Field | Meaning |
| --- | --- |
| `codeReady` | Model routes are syntactically valid and proposal-only governance remains intact: no tools, no automatic apply, human-only gates. |
| `providerReady` | Gateway API-key or Vercel OIDC configuration is present and routes are valid. This is not a live model probe. |
| `usageProtectionReady` | The HMAC identity secret and the backend used by POST are ready. A shared deployment therefore requires Upstash. |
| `deploymentReady` | Code, provider identity, and usage protection are all configured for an AI-assisted attempt. |
| `localFallbackReady` | Rule-based fallback is safe to serve under the current request-protection configuration. |

`status` is `ready`, `local-fallback`, `deployment-blocked`, or
`configuration-invalid`. Blockers are bounded operator messages. Provider
credentials, salts, Redis keys, prompts, user identifiers, and project data are
never included. `provider.liveConnectionVerified` and
`provider.modelCatalogVerifiedAtRequest` remain `false` because diagnostics are
configuration checks.

`GET /api/health` provides a broader no-store platform diagnostic. It reports
booleans for AI provider identity, usage HMAC, distributed usage, cloud
workspace, durable workflow persistence, and enquiry delivery. It does not
connect to or mutate those services and therefore is not a substitute for the
Preview acceptance tests.

## Supabase cloud boundary

The Supabase migrations are applied in filename order:
`202608060001_cloud_foundation.sql`,
`202608060003_organization_collaboration.sql`, then
`202608060004_server_owned_records.sql`. Together they create and harden:

- `organizations` and `organization_members` with owner, admin, editor,
  reviewer, and viewer roles;
- `projects` and immutable `project_revisions` with Atlas content hashes and
  monotonically increasing cloud versions;
- `intelligence_runs`, `usage_records`, and `audit_events`;
- `evidence_objects` metadata and a private `kingxford-private` Storage bucket;
  and
- `idempotency_keys` used by atomic project, evidence, and organization
  mutation procedures;
- `organization_invitations` for expiring, single-use collaboration links; and
- `cloud_account_deletion_receipts` for user-scoped deletion replay after the
  organization record is gone.

Row Level Security is enabled on every application table. Policies constrain
reads to members, while guarded database functions and server routes constrain
mutations to the appropriate role. Authenticated browser sessions have no
direct private Storage-object privileges. Project writes use transactional
PostgreSQL functions, advisory locks, request hashes, idempotency records,
expected versions, and content hashes. HTTP `ETag`, `If-Match`, and
`If-None-Match` semantics expose optimistic conflicts without overwriting a
newer project.

The cloud APIs include status, account, project list/detail/mutation, bounded
batch synchronization, private evidence retention, full organization export,
and explicit cloud-data deletion. Authentication is refreshed in
`src/proxy.ts`; Workflow’s signed `/.well-known/workflow/` endpoint is excluded
from session interception.

Canvas wires those APIs through a visible cloud-project panel. It distinguishes
unconfigured, signed-out, connected, and error states; limits writes to owner,
admin, and editor roles; compares local and cloud content hashes/versions; and
opens a differing cloud record as a protected local copy instead of silently
overwriting the current device record. Account-data deletion requires the full
typed confirmation phrase.

The Supabase publishable key is a browser identifier and is safe to expose only
with the project URL and the supplied RLS policies. The service-role key is a
server-only administrative credential used by durable workflow persistence,
private evidence-object I/O, export, and deletion cleanup only after the
application route has authenticated and authorized the request. Never place it
in browser code or a `NEXT_PUBLIC_*` variable.

## Organization collaboration

Each signed-in person begins with a personal organization and may work in any
organization where they retain membership. A locally stored organization UUID
is accepted only after format validation. The client supplies that selection
through `X-Kingxford-Organization-Id`; downloads and other navigation requests
may use a validated `organization` query value. Every API still resolves the
session and confirms current membership before reading or changing data. A
stale or unauthorized selection cannot grant access.

The account page exposes the current organization, members, pending
invitations, and the actions allowed by the signed-in member's role. Owners and
admins may invite only editor, reviewer, or viewer roles. Invitations expire in
one hour to seven days, are single-use, and must be accepted by the exact email
address to which they were issued. At most 50 active invitations may exist for
an organization. The database stores only a SHA-256 token digest; the raw
32-byte token is returned once in a URL fragment, never as a query parameter.

The acceptance page removes the fragment from the address bar immediately. If
sign-in is required, it keeps the token locally for no more than 30 minutes and
continues only with the invited email address. Acceptance selects the joined
organization but does not upload or replace any local project. Invitation
creation, revocation, acceptance, member changes, and removal are idempotent,
audited mutations protected by organization-scoped advisory locks.

Role administration preserves an accountable owner boundary: an admin cannot
manage an owner, a member cannot use the role endpoint to modify themselves,
and the sole owner cannot be removed or demoted without a replacement owner.
Cloud project, evidence, export, and durable-review requests carry the same
validated organization selection. Account deletion is pinned to the exact
organization, leaves a user-scoped replay receipt, and retries server-side
private-object cleanup without reopening browser Storage privileges.

## Evidence ingestion and private storage

Canvas can add evidence from pasted text, a URL reference, or a local file. URL
records are not fetched. Text/Markdown/CSV/JSON files are read locally; PDFs are
parsed locally with a 5 MB, 24-page, and 45,000-character ceiling. Each record
retains capture method, timestamp, source label, URL when supplied, local-file
metadata, and `networkAccess: "none"`. An evidence record becomes a bounded
Atlas artifact/node connection only after the person accepts it.

Local evidence and retained originals are separate deliberate actions. Recording
a local file does not upload it. For a cloud-saved project, the visible private
evidence panel lets a member explicitly select **Retain original in cloud** and
optionally link the file to an existing Atlas evidence artifact. Owner, admin,
and editor roles may retain or remove originals; reviewer and viewer roles may
list and download them without changing storage.

The upload route accepts exactly one bounded multipart file and requires a
valid `Content-Length`, same-origin mutation request, authenticated membership,
writer role, cloud project, and `Idempotency-Key`. It accepts only text,
Markdown, CSV, JSON, and PDF extensions up to 5 MB. Extension and media type
must agree; text must be non-empty UTF-8 without null characters, JSON must
parse, and PDF signature, page count, and extracted-text limits are checked.
When an Atlas artifact is supplied, it must be an evidence artifact in the same
project.

Each private object uses a deterministic path of
`{organization}/{project}/evidence/{request-digest}-{content-digest}.{extension}`.
The database trigger enforces that organization/project boundary. Metadata
records the exact name, canonical media type, byte size, and SHA-256 digest.
Authenticated browser clients receive no direct Storage-object policy or
privilege. After the API route verifies the session, organization membership,
role, project/artifact binding, request bounds, and mutation origin, a lazy
server-only service client performs object I/O. Metadata remains RLS-readable and
mutates only through guarded `SECURITY DEFINER` procedures. Download rechecks
size and SHA-256 before returning a private, no-store attachment with
MIME-sniffing disabled and a sandbox content policy.

Removal uses a two-stage tombstone. The first transactional RPC records
`deletion_requested_at` and the idempotency key, the route removes the Storage
object, and a second RPC deletes metadata and records the audit event. A storage
or completion failure leaves the pending marker visible so the same removal can
be retried without concealing an orphaned file or erasing metadata too early.
Upload and removal RPCs use advisory locks, request hashes, idempotency records,
role checks, and `evidence.uploaded` / `evidence.deleted` audit events.

## Project enquiry and public trust

`POST /api/contact` accepts only same-origin JSON. It enforces declared and
actual size limits, a strict enquiry schema, explicit consent, a hidden
honeypot, likely-secret screening, and no-store response headers. Resend is
created lazily only when a valid server-side configuration exists. A server-keyed
HMAC converts a bounded network address when available, or a bounded user-agent
fallback, into the only visitor key stored by the limiter; raw IP and user-agent
values are never persisted or logged. In Preview and Production, an atomic
Upstash allowance uses a separate
`kx:contact:v1` namespace and never consumes AI credits. Delivery reservations
make concurrent duplicates wait and completed duplicates return the accepted
state without sending again. Limited responses include `Retry-After`.

Online submission fails closed when Resend, Upstash, or the 32+ character
`KINGXFORD_USAGE_HASH_SALT` is unavailable. A tightly bounded process-memory
limiter can be enabled only for non-production, non-Vercel local testing with
`KINGXFORD_ALLOW_EPHEMERAL_CONTACT=1`. Both the Contact interface and its public
diagnostic distinguish durable protection, local-only protection, and an
unavailable channel. If configuration or provider delivery fails, the browser
retains the draft and offers email, copy, and download alternatives.

The site includes Privacy, Terms, Accessibility, and AI Transparency pages. The
statements describe current controls and limitations; they do not claim legal,
accessibility, security, or provider certification.

## Deliberate AI boundary

The reviewers have no web search, shell, browser, email, calendar, payment,
deployment, database-write, MCP, or other action tools. They cannot publish,
purchase, message, or alter an external system. They are constructed without a
`tools` or `toolChoice` property.

Every Atlas gate is `human-only`. A valid decision has
`human-confirmation` provenance and supporting same-phase evidence. The
coordinated and durable review paths can recommend a decision, but they cannot
record one. Accepting proposed text is a separate deliberate action that creates
a revision; it is not a gate approval.

Before presenting either an immediate or durable result for acceptance, Canvas
rechecks the live project ID and editor hash, then compares the echoed project,
snapshot, artifact, artifact revision, and draft hashes with the original
binding. The acceptance control is disabled once that binding is stale. A valid
person-initiated acceptance appends a new immutable revision; the result is
never applied automatically.

Kingxford does not fine-tune or train model weights on workspace submissions.
Provider processing and retention remain governed by the owner’s selected
Gateway/provider terms. The implementation does not provide payments,
subscriptions, financial entitlements, autonomous action agents, or arbitrary
private-document retrieval.

## Owner setup on Vercel

1. Use Node.js 24 and enable Vercel AI Gateway/OIDC, Analytics, and Speed
   Insights. Use `AI_GATEWAY_API_KEY` only for local or non-Vercel environments
   that cannot use OIDC.
2. Apply the Supabase migrations in filename order: foundation `001`,
   organization collaboration `003`, then server-owned-record hardening `004`.
   Configure the public project URL and publishable key, keep the service-role
   key server-only, and approve the site and `/auth/callback` redirect URLs.
3. Provision Upstash Redis and configure the REST URL/token in Preview and
   Production. Do not enable the ephemeral test hatch on shared deployments.
4. Verify a Resend sending domain and configure the from, receiving, and public
   contact addresses.
5. Copy `.env.example` settings into Vercel. Generate a unique 32+ character
   `KINGXFORD_USAGE_HASH_SALT`. Configure approved Gateway models, a conservative
   budget, and spend alerts.
6. Deploy Preview. Inspect `/api/health`, `/api/workspace/agent`, and
   `/api/intelligence/runs`; confirm the usage backend is `upstash-redis` and
   `durableAcrossInstances` is true.
7. Complete a non-sensitive focused and coordinated review, then sign in, save
   an Atlas project, start a durable review with a new idempotency key, poll it,
   and test cancellation. Verify persisted run, usage, and audit records.
8. Create and accept an editor invitation, revoke a second invitation, switch
   organizations, change a non-owner role, and exercise the sole-owner and
   self-lockout guards. Retain one non-sensitive evidence original, download it,
   confirm the digest, remove it, and exercise a retried pending removal. Then
   test cloud synchronization, conflict handling, organization export,
   exact-organization cloud deletion and replay, project-enquiry delivery and
   replay, local fallback, stale snapshot rejection, and a human-only gate
   decision. Review Vercel logs/analytics and the provider budget before
   Production promotion.

## Local verification

```bash
npm ci
npm run typecheck
npm run lint -- --max-warnings=0
npm run test:intelligence
npm run test:platform
npm run test:foundation
npm run verify:editorial-voice
npm run verify:creative-agent
npm audit --omit=dev --audit-level=high
npm run build
npm run verify:platform-journey
```

The deterministic governance command makes no paid generation request. Set
`VERIFY_GATEWAY_MODEL_CATALOG=true` only for the optional public catalog check.
Its report goes to a temporary directory unless `--report-dir <path>` is set.
