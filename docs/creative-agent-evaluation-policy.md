# Kingxford Creative Intelligence evaluation policy

Current protocol: `kxci-2026-08-05.1`

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

Corpus changes are product changes. They require a reviewed source change and a
changelog entry here. Automated workflow runs cannot alter the corpus.

## Hard gates in protocol v2

A release passes only when the deterministic verifier confirms:

1. Protocol and corpus versions agree on `kxci-2026-08-05.1`.
2. Standard routes to `openai/gpt-5.6-terra` with the reviewed fallbacks; Deep
   routes to `openai/gpt-5.6-sol` with the reviewed fallbacks.
3. Reasoning and output ceilings remain bounded by depth, each Gateway fallback
   list is capped at two unique models, and the route performs one SDK generation
   call rather than a manual paid retry loop.
4. All seven lenses are present and accepted by the request contract.
5. The fixed playbook is versioned, deterministic, server-owned, contains no
   network ingestion path, and returns no more than three grounding entries.
6. Structured review and build-brief fields remain complete.
7. The agent has no `tools` or `toolChoice` configuration and explicitly denies
   code execution, URLs, deployment, publishing, purchasing, messaging, and
   external-system changes.
8. Workspace and playbook material remain untrusted and cannot override the
   developer boundary.
9. Origin, JSON, body-size, character-budget, secret, cancellation, no-store,
   and truthful-local-fallback protections remain present.
10. The route starts a usage reservation, consumes credits before a model call,
    and always releases concurrency through `finally`.
11. Minute, daily-credit, concurrency, standard-cost, and deep-cost ceilings stay
    inside the reviewed policy.
12. Provider identity is a salted SHA-256 pseudonym; no raw IP address,
    user-agent string, objective, title, or workspace text is placed in Gateway
    user/tags metadata.
13. Responses retain request, grounding, usage, agent-lens, model, protocol, and
    remaining-limit provenance.
14. The fixed corpus retains unique cases and complete mode, lens, and challenge
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
