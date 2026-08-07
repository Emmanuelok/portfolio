# kingXford & Co

kingXford & Co is a research and development platform for moving one project
from an initial question to evidence, system design, working proof, validation,
and accountable delivery. Its six Atlas phases—Discovery, Evidence, Systems,
Prototype, Validation, and Delivery—share the same project graph, revision
history, evidence record, reviews, decisions, and human approval gates.

Studio, the Living Room, Lab, Work, Media, and Create are public lenses onto
that project system. They are not separate product backends. The `/create`
surface is the operational entry point, while `/create/workspace` provides the
focused Canvas for artifacts, code, mind maps, revisions, evidence, and review.

## Current foundation

The repository now contains a deployable production foundation in addition to
the local-first public experience:

- seven governed Create workflows for websites, digital tools, institutional
  systems, research and AI tools, operational tools, education tools, and
  everyday personal tools;
- bounded local evidence intake for pasted text, URL references, and supported
  text/PDF files, with source provenance and no automatic URL retrieval;
- deliberate private retention for original evidence files on cloud-saved
  projects, with role-aware upload/removal, optional Atlas evidence links,
  deterministic paths, SHA-256 verification, and retryable deletion tombstones;
- Project Atlas graph integrity, immutable artifact revisions, project import
  and export, collision-safe migration, and human-only phase gates;
- focused and coordinated AI-assisted reviews using Vercel AI Gateway, approved
  model fallbacks, structured output, fixed playbook grounding, secret
  screening, and deterministic local review when a provider is unavailable;
- Supabase authentication, personal and shared organizations, five role-aware
  access levels, secure invitation and membership administration, versioned
  cloud synchronization, revision history, audit events, usage records,
  RLS-scoped evidence metadata, and server-route-only private object storage;
- a Canvas cloud-project panel for sign-in state, role-aware save/sync,
  cloud/local comparison, protected local import, export, and explicit cloud
  data deletion without silently replacing work stored on the device;
- an account-level organization access panel for selecting a working
  organization, issuing one-use invitations, reviewing membership, and making
  guarded role or access changes;
- an authenticated Vercel Workflow endpoint for durable coordinated reviews,
  including idempotent run registration, resumable status, cancellation,
  distributed usage reservation, and persisted outcome/audit records;
- atomic cross-instance AI usage controls through Upstash Redis, with stable
  lease IDs and idempotent credit reservations for retry safety;
- a secure Resend project-enquiry route with same-origin enforcement, bounded
  input, schema and consent checks, credential screening, honeypot handling,
  atomic per-visitor Upstash limits, delivery reservations, idempotent replay,
  privacy-bounded logs, and email/copy/download fallbacks;
- public Privacy, Terms, Accessibility, and AI Transparency statements; and
- Vercel Analytics, Speed Insights, structured operational events, a no-store
  `/api/health` configuration diagnostic, and production security headers.

These capabilities are implemented in source but depend on owner-controlled
services and secrets. A deployment is not production-ready until the setup
checklist below is complete and the health/readiness diagnostics confirm the
expected configuration.

## AI review boundary

AI review is proposal-only. The focused reviewer and coordinated reviewer have
no web, shell, email, calendar, payment, deployment, database-write, or other
external-action tools. They cannot publish work or approve an Atlas phase gate.
A person must deliberately accept a proposed revision and separately record any
gate decision.

The public review APIs pseudonymize a bounded visitor fingerprint with a
server-owned HMAC secret. Gateway receives a second hash and categorical tags,
not raw network identifiers. In shared deployments, Upstash applies minute,
daily-credit, and concurrency limits atomically across instances. The limits are
operational cost controls, not subscription balances.

The authenticated durable review path adds organization membership, a saved
cloud project, an idempotency key, Vercel Workflow orchestration, and persisted
run/audit records. It still returns proposals only and validates the exact Atlas
snapshot and active artifact revision before provider work begins.
Canvas exposes this as a choice between an immediate current-session review and
a saved, retryable cloud review. The latter is polled from the authenticated
status endpoint and can be cancelled; either result can be accepted only while
its full Atlas project, snapshot, artifact, revision, and draft binding remains
current.

See [docs/intelligence-layer.md](docs/intelligence-layer.md) for the full
architecture and [docs/creative-agent-evaluation-policy.md](docs/creative-agent-evaluation-policy.md)
for the deterministic release gates.

## Owner deployment checklist

1. Create or select the Vercel project, link this repository, and use Node.js
   24. Enable Vercel AI Gateway, OIDC, Analytics, and Speed Insights.
2. Create a Supabase project. Apply the migrations through the normal Supabase
   migration workflow, in filename order:
   `202608060001_cloud_foundation.sql` →
   `202608060003_organization_collaboration.sql` →
   `202608060004_server_owned_records.sql`. Add the site URL and
   `/auth/callback` URL to the approved Supabase authentication redirects.
3. Create an Upstash Redis database and add its REST URL and token to Vercel
   Preview and Production.
4. Create or select a Resend account, verify the sending domain, and configure a
   receiving inbox for project enquiries.
5. Copy `.env.example` into the Vercel environment settings. Fill in Supabase,
   Upstash, Resend, contact, and Gateway values. Generate a unique server-only
   `KINGXFORD_USAGE_HASH_SALT` of at least 32 characters. Never expose the
   service-role key, Redis token, Resend key, Gateway key, or usage salt through
   a `NEXT_PUBLIC_*` variable.
6. Set a conservative AI Gateway project budget, provider/model access, and
   spend alerts. Application limits supplement provider budgets; they do not
   replace them.
7. Deploy Preview and verify `/api/health`, `/api/contact`,
   `/api/workspace/agent`, and `/api/intelligence/runs`. Diagnostics report
   configuration only; complete one non-sensitive focused review and one
   authenticated durable review before promoting Production.
8. Verify sign-in/sign-out; create, accept, revoke, and expire an organization
   invitation; switch organizations; change a non-owner role; and confirm the
   owner/self-lockout safeguards. Then verify cloud save/reload, stale-ETag
   conflict handling, project export, exact-organization account deletion and
   replay, explicit evidence retain/download/remove (including a retried pending
   removal), enquiry delivery and idempotent replay, workflow cancellation,
   logs, analytics, mobile layout, keyboard operation, and a human-only gate
   decision. Confirm that no automated review can publish or approve work.

Vercel Workflow is integrated through `withWorkflow` and does not require an
application secret. Its durable review route remains unavailable until Supabase
(including the server-only service role), Upstash, AI Gateway identity, and the
usage HMAC secret are configured.

## Run locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The public site, local Atlas repository, seven workflow templates, local
evidence intake, and rule-based review work without third-party credentials.
Supabase authentication, organization collaboration, cloud synchronization and
private original-file retention, distributed usage controls, provider AI,
durable workflows, and online enquiry delivery remain explicitly unavailable
until their services are configured.

For isolated local or automated tests, `KINGXFORD_ALLOW_EPHEMERAL_USAGE=1`
permits the bounded process-memory usage backend only when `VERCEL` is not `1`.
It is not a production mode and is intentionally ignored on Vercel.
`KINGXFORD_ALLOW_EPHEMERAL_CONTACT=1` separately enables the contact form's
tightly bounded process-memory limiter for local testing. The contact hatch is
also ignored on Vercel and whenever `NODE_ENV=production`; it never changes or
consumes AI usage counters.

## Quality checks

```bash
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

The project requires Node.js 24 or newer and uses the Next.js App Router.
Production dependencies are lockfile-controlled. GitHub Actions runs the core
quality, foundation, governance, audit, and build gates with read-only
repository permissions.

Public interface copy follows [docs/editorial-voice.md](docs/editorial-voice.md).
The editorial verifier rejects unsubstantiated promotional language and
inaccurate AI-readiness claims in user-facing source.
