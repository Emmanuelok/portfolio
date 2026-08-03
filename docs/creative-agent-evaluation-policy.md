# Kingxford Creative Intelligence evaluation policy and changelog

## Public claim

Kingxford Creative Intelligence is evaluated every day. Improvements are versioned, safety-tested, and promoted only when they outperform the current release.

It is not described as retraining itself, rewriting its own model weights, or becoming smarter without oversight. A scheduled evaluation is evidence about a release; it is not permission to change production.

## Governance boundary

The daily workflow is read-only. It may inspect the fixed corpus, agent configuration, structured-output contract, prompt boundaries, public route protections, and the public Vercel AI Gateway model catalog. It may write a temporary report artifact inside the GitHub Actions runner.

It must never:

- alter application or evaluation source;
- commit, push, open or merge a pull request;
- change repository settings, deployment configuration, environment variables, or production data;
- call a paid generation model;
- read, transmit, or learn from production workspace content;
- broaden the agent's tools or external permissions.

The workflow has `contents: read` permission only, checkout credentials are not persisted, and every run uploads an immutable report artifact for review.

## Fixed corpus

`evals/creative-agent/corpus.json` is the versioned baseline. It covers every workspace mode plus evidence discipline, embedded prompt injection, code-execution boundaries, mind-map ambiguity, high-stakes design boundaries, age-appropriate general-audience behaviour, privacy, and credential rejection.

Corpus changes are product changes. They require a normal human-authored pull request, review, and a changelog entry here. The scheduled workflow cannot modify the corpus.

## Hard gates

A release passes only when the deterministic verifier confirms all of the following:

1. The protocol version and explicit `provider/model` slug match the corpus.
2. The structured review and build-brief fields remain complete.
3. Output, reasoning, input, and anonymous request limits remain within policy.
4. The public agent has no web, shell, computer, MCP, deployment, or other external tools.
5. Workspace material remains explicitly untrusted and cannot override the developer boundary.
6. The prompt prohibits execution, external action, fabricated evidence, unsafe general-audience output, and hidden-instruction disclosure.
7. The route retains same-origin, JSON, body-size, character-budget, rate, likely-secret, cancellation, no-store, and truthful local-fallback protections.
8. The fixed corpus retains unique cases and complete mode/challenge coverage.

Any failed hard gate fails the workflow. An unavailable public model catalog produces a warning because network availability is not proof that the model was removed. A successful catalog response that omits the configured model is a hard failure.

## Daily report

Each report records the protocol and corpus versions, configured model, source hashes, check results, optional catalog result, commit SHA, and generation time. Reports contain no prompts, user workspaces, credentials, environment values, or provider responses.

The public Gateway catalog endpoint needs no authentication. The verifier intentionally sends no authorization header and never prints environment variables. The catalog check can be disabled locally with no effect on the other hard gates.

## Improvement and rollback

The daily workflow does not propose or promote candidates. If a report identifies a failure or a human team develops an improvement, that work proceeds through a separate branch and reviewed pull request. Safety gates cannot be waived by an automated score.

At least the immediately previous protocol should remain recoverable through Git history and the hosting platform's deployment rollback. A rollback is a deliberate human action and should receive a dated changelog entry.

## Changelog

### 2026-08-03 — `kxci-2026-08-03.2`

- Bound every Agent result to the exact reviewed Canvas draft before it can be applied or attached to a handoff.
- Added atomic HTML, CSS, and JavaScript proposals for Code reviews.
- Replaced breakable prompt markup with canonical JSON inside fresh high-entropy untrusted-data boundaries.
- Added input digests, code-aware transforms, version comparison checks, and expanded deterministic governance coverage.

### 2026-08-02 — `kxci-2026-08-02.1`

- Established the first fixed governance corpus.
- Added deterministic schema, configuration, prompt-boundary, capability, route-protection, and corpus-coverage checks.
- Added an optional unauthenticated Vercel AI Gateway catalog check.
- Established a daily, report-only GitHub Actions workflow with no production-write permissions.
