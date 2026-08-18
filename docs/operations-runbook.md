# Kingxford operations runbook

This runbook covers the operational work that sits outside the application
source: domains, enquiry deliverability, monitoring, provider budget, backup
and restore, and the verification an owner runs before pointing
`kingxford.co` at a production deployment.

It assumes the owner deployment checklist in the README has been completed,
so the Vercel project, Supabase project, Upstash database, Resend account,
and environment variables already exist. Configuration values themselves are
documented in `.env.example`; the architecture is documented in
[intelligence-layer.md](intelligence-layer.md).

## Domains and DNS

The platform reads one canonical origin from `NEXT_PUBLIC_SITE_URL`. That
value produces `metadataBase`, canonical URLs, `/robots.txt`, and
`/sitemap.xml`, so it must equal the origin visitors actually reach, with no
trailing slash.

1. Decide which hostname is canonical. This runbook assumes the apex,
   `https://kingxford.co`, with `www.kingxford.co` redirecting to it.
2. In the Vercel project, add both `kingxford.co` and `www.kingxford.co`
   under Settings → Domains, and mark `www` as a redirect to the apex.
3. Create the DNS records exactly as Vercel displays them for each domain.
   Vercel shows an `A` record for the apex and a `CNAME` for `www`; use the
   values in the dashboard rather than any value copied from older
   documentation, because Vercel has changed them.
4. If the registrar publishes a `CAA` record set, include the certificate
   authority Vercel names, otherwise certificate issuance fails silently
   until the record is corrected.
5. Wait for both domains to show a valid certificate in Vercel, then confirm
   from outside any local cache:

   ```bash
   dig +short kingxford.co
   dig +short www.kingxford.co
   curl -sSI https://www.kingxford.co | head -n 3
   curl -sS https://kingxford.co/robots.txt
   ```

   The `www` response must be a redirect to the apex, and `robots.txt` must
   print the canonical host and sitemap URL.
6. Set `NEXT_PUBLIC_SITE_URL=https://kingxford.co` in Production, and set the
   same origin in the Supabase authentication settings together with the
   `https://kingxford.co/auth/callback` redirect URL. A mismatch here breaks
   sign-in after the domain moves.
7. Submit `https://kingxford.co/sitemap.xml` once the domain resolves.
   `/robots.txt` disallows `/api/`, `/.well-known/workflow/`, `/account`,
   `/accept-invitation`, and `/auth`; those routes also send a `noindex`
   directive from their own metadata.

## Enquiry email deliverability

`POST /api/contact` is the business conversion path. It sends through Resend
from `CONTACT_FROM_EMAIL` to `CONTACT_INBOX_EMAIL`, with the visitor's own
address as `Reply-To`. Only the sending domain affects authentication, so
SPF, DKIM, and DMARC must be aligned for the `CONTACT_FROM_EMAIL` domain.

1. Verify the sending domain in Resend. Publish every DKIM and SPF record
   Resend generates, with the exact host and value it shows. Do not hand-write
   an SPF record; Resend's include mechanism is part of the generated value.
2. Keep one SPF record per host. Two `v=spf1` TXT records on the same name is
   a permanent error, not a warning.
3. Publish a DMARC policy on `_dmarc.<sending domain>` starting in monitoring
   mode:

   ```text
   v=DMARC1; p=none; rua=mailto:dmarc@kingxford.co; fo=1; adkim=s; aspf=s
   ```

   The `rua` address must be a real, monitored inbox. If it is on a different
   domain than the policy, that domain must publish the corresponding
   `<policy domain>._report._dmarc` authorization record.
4. Read the aggregate reports for at least two weeks. When every legitimate
   source passes, move to `p=quarantine`, then to `p=reject`. Do not start at
   `p=reject`; a misaligned record silently discards enquiries.
5. Confirm the receiving domain for `CONTACT_INBOX_EMAIL` has working `MX`
   records and that a person monitors that inbox daily.
6. Run a manual send test against the deployed site, not a local build.
   Submit the live enquiry form once with a non-sensitive brief, then in the
   receiving inbox:
   - confirm the message arrived in the inbox rather than the spam folder;
   - open the original headers and confirm `spf=pass`, `dkim=pass`, and
     `dmarc=pass` for the sending domain;
   - confirm the reply goes to the visitor's address, not to Resend;
   - confirm the Resend dashboard shows the message as delivered.
7. Repeat the test to one Gmail and one Microsoft 365 recipient. These two
   providers apply the strictest bulk-sender rules and are where a missing
   DMARC record shows up first.
8. Re-run the manual send test after any change to the sending domain, the
   Resend API key, or `CONTACT_FROM_EMAIL`.

## Monitoring and alerting

### Uptime

Point the uptime monitor at:

```text
GET https://kingxford.co/api/health?strict=1
```

The endpoint is dynamic and `no-store`, so it is safe to poll. In strict mode
it returns `503` when any core capability is missing, and `200` when all of
them are configured. The core capabilities are `cloudWorkspaceConfigured`,
`distributedUsageConfigured`, `enquiryDeliveryConfigured`,
`aiProviderConfigured`, and `pseudonymousUsageIdentityConfigured`. The
response body lists the missing ones under `core.missing`.

Without `strict=1` the same endpoint always returns `200` and reports
configuration in the body. Use the strict form for alerting and the plain
form when inspecting a Preview deployment that is intentionally incomplete.

Recommended settings: one check per minute from at least two regions, alert
after two consecutive failures, and a separate check on `GET /` so a
capability regression is distinguishable from a total outage.

### Log drain

1. In the Vercel project, open Observability → Log Drains and add a drain to
   the log platform in use. Select JSON delivery and include function logs.
2. Application events are single-line JSON with `service`,
   `component`, `event`, and `level` fields. Alert on `level` of `error` from
   `service: "kingxford-platform"`, and raise the priority of these events:

   | Event | Meaning |
   | --- | --- |
   | `contact.delivery-failed` | Resend rejected or dropped an enquiry. |
   | `contact.delivery-unavailable` | Enquiry delivery is not configured. |
   | `contact.reservation-finalization-failed` | An enquiry rate-limit lease was not released. |
   | `intelligence.provider.call_failed` | A provider request failed; review fell back to local analysis. |
   | `intelligence.run.failed` | A coordinated review ended in failure. |
   | `workspace.review.failed` | A focused review ended in failure. |
   | `cloud.request.failed` | A Supabase-backed request failed. |
   | `council.session.failed` | A council session ended in failure. |

3. Alert separately on Vercel function errors and timeouts, which cover
   failures that occur before application logging runs.
4. Operational logs deliberately exclude project text, prompts, credentials,
   and contact details, so an alert cannot be triaged from the log line alone.
   Route alerts to someone who can reproduce the request and read the
   `requestId` echoed in the `X-Kingxford-Request-Id` response header.

## AI Gateway budget and model routing

1. Set a project budget and spend alerts in the Vercel AI Gateway dashboard
   before the first public review. The in-application per-minute, daily-credit,
   and concurrency limits are operational cost controls; they are not a
   billing limit and do not stop provider charges.
2. Verify that every configured model slug resolves in the live Gateway
   catalog before launch. The slugs are `KINGXFORD_CREATIVE_STANDARD_MODEL`,
   `KINGXFORD_CREATIVE_DEEP_MODEL`, `KINGXFORD_INTELLIGENCE_STANDARD_MODEL`,
   `KINGXFORD_INTELLIGENCE_DEEP_MODEL`, and their fallback lists. Two checks
   cover this:

   ```bash
   VERIFY_GATEWAY_MODEL_CATALOG=true npm run verify:creative-agent
   ```

   The same check runs on the daily governance workflow and on a manual
   dispatch with `verify_gateway_catalog` enabled. It compares the configured
   slugs against the public catalog and fails when one is missing.

3. Then confirm the deployment itself can complete one real provider request:

   ```bash
   VERIFY_AI_LIVE_CONFIRM=YES \
   VERIFY_AI_LIVE_BASE_URL=https://kingxford.co \
   npm run verify:ai-live
   ```

   This makes one billable request with a non-sensitive fixture. It refuses to
   run unless the deployment reports provider readiness and durable usage
   protection, so a refusal is itself a configuration finding.
4. Treat an unresolved slug as a launch blocker. When a model cannot be
   reached, provider review falls back to the deterministic local reviewer.
   The interface keeps working and returns a usable result, so nothing visibly
   breaks; the only signals are `intelligence.provider.call_failed` in the
   logs and a `source` other than the provider in the response. Re-run both
   checks after any model change.

## Backup, retention, and restore

### Supabase

1. Enable point-in-time recovery for the Supabase project. It is a paid
   feature; record the retention window the current plan provides and the
   daily backup schedule, and check both after any plan change.
2. Keep the migration files in `supabase/migrations/` as the schema source of
   truth. A restored database is only useful with the same migration set.
3. Store the service-role key in a password manager, not only in Vercel. A
   restore performed from a new machine needs it.

### Retention and purge

Migration `202608060005_retention_and_attribution.sql` installs bounded purge
functions. Nothing is scheduled by the migration itself, so an owner must
schedule them with the service role — for example hourly:

```sql
select public.run_kingxford_retention(1000);
```

Each call deletes at most the given number of rows per table and returns the
counts, so a scheduler repeats the call until every count is zero. The
retention windows are floors; a caller may pass a longer interval, never a
shorter one:

| Records | Deleted after |
| --- | --- |
| `idempotency_keys` | 30 days |
| `cloud_account_deletion_receipts` | 90 days |
| `project_revisions` | 12 months, never the newest revision of a project |
| `intelligence_runs` | 12 months, terminal runs only |
| `audit_events` | 24 months |
| `usage_records` | 24 months |

Confirm the schedule is running by comparing the oldest `created_at` in
`audit_events` against the window above.

### Tested restore path

The platform's own export and import are the restore path that does not
depend on database access:

1. Sign in as an organization administrator and call
   `GET /api/cloud/export`. Keep the JSON file with the operational records.
2. In Canvas, open the project library and use **Export project** to write a
   project package for at least one live project.
3. Test the restore in a clean browser profile: import the project package
   into Canvas, confirm the artifacts, revisions, evidence links, and phase
   state match, then save it back to the organization and confirm the cloud
   copy reloads.
4. Record the date of the last successful restore test. Repeat it at least
   quarterly and after any migration.
5. Note the boundary: the organization export contains records and evidence
   metadata, not the stored original evidence files. Restoring those files
   requires the Supabase storage bucket, which is covered by the Supabase
   backup above and not by the export.

## Pre-launch verification

Run in order. Each step is executable, and a failure is a blocker rather than
a note.

1. `npm ci`, then the full local gate list in the README's quality checks
   section. All commands must pass on Node.js 24.
2. Confirm the GitHub Actions run for the release commit is green, including
   the Canvas journey job on a production build.
3. Deploy Preview. Open `/api/health` and confirm each capability the launch
   requires reports `true`, then open `/api/health?strict=1` and confirm it
   returns `200`.
4. Complete one focused review and one authenticated durable review on
   Preview, and confirm the durable run persists and can be cancelled.
5. Run the Gateway catalog check and `npm run verify:ai-live` against Preview.
   Confirm the response reports a provider model rather than local analysis.
6. Confirm DNS, certificates, and the `www` redirect for the production
   domain, and that `NEXT_PUBLIC_SITE_URL` matches the canonical origin.
7. Complete the manual enquiry send test and confirm SPF, DKIM, and DMARC all
   pass in the received message headers.
8. Confirm the uptime monitor is polling `/api/health?strict=1`, that the log
   drain is receiving records, and that the alert list above is configured.
9. Confirm the AI Gateway budget and spend alerts are set, and that the
   application limits in `.env.example` are at the intended values.
10. Confirm point-in-time recovery is enabled, the retention schedule is
    running, and the restore test has been completed and dated.
11. Sign in, exercise organization invitation, role change, and lockout
    guards, then confirm a phase gate still requires a human decision and that
    no automated review can publish or approve work.
12. Promote to Production, then repeat steps 3, 7, and 8 against the
    production domain.
