import assert from "node:assert/strict";
import test from "node:test";

import {
  addGovernedEvidenceToProject,
  EVIDENCE_INGESTION_LIMITS,
  EvidenceIngestionError,
  ingestEvidenceFile,
  ingestPastedEvidence,
  ingestUrlEvidence,
  normalizeEvidenceUrl,
} from "../src/lib/workspace/evidence-ingestion";
import {
  collectProjectIntegrityIssues,
  parseKingxfordProject,
  projectPhases,
} from "../src/lib/workspace/project-graph";
import {
  createWorkflowProject,
  workflowPhaseReadiness,
  workflowTemplateForProject,
  workflowTemplateIds,
  workflowTemplates,
} from "../src/lib/workspace/workflow-templates";

const recordedAt = "2026-08-06T12:00:00.000Z";

test("the workflow library covers every Create category with a complete governed lifecycle", () => {
  assert.equal(workflowTemplates.length, 7);
  assert.deepEqual(workflowTemplates.map(({ id }) => id), [...workflowTemplateIds]);

  for (const template of workflowTemplates) {
    assert.deepEqual(template.phases.map(({ phase }) => phase), [...projectPhases]);
    assert.ok(template.exportTargets.length >= 4, `${template.id} has project exports`);
    assert.ok(template.suitableFor.length >= 4, `${template.id} names suitable uses`);
    for (const phase of template.phases) {
      assert.ok(phase.artifact.title.length > 5, `${template.id}/${phase.phase} seeds an artifact`);
      assert.ok(phase.artifact.starterPrompts.length >= 3, `${template.id}/${phase.phase} has working questions`);
      assert.ok(phase.evidence.minimumItems >= 2, `${template.id}/${phase.phase} has a meaningful evidence threshold`);
      assert.ok(phase.evidence.acceptedSources.length >= 4, `${template.id}/${phase.phase} defines evidence classes`);
      assert.ok(phase.gate.criteria.length >= 3, `${template.id}/${phase.phase} has gate criteria`);
      assert.ok(phase.deliverables.length >= 2, `${template.id}/${phase.phase} has deliverables`);
      assert.ok(phase.exportTargets.length >= 2, `${template.id}/${phase.phase} has export targets`);
    }
  }
});

test("each workflow starts as one integrity-checked Atlas project rather than a separate studio", () => {
  for (const template of workflowTemplates) {
    const project = createWorkflowProject(template.id, {
      title: `${template.shortName} test`,
      createdAt: recordedAt,
      idSeed: `test:${template.id}`,
    });
    assert.deepEqual(parseKingxfordProject(project), project);
    assert.deepEqual(collectProjectIntegrityIssues(project), []);
    assert.equal(project.activePhase, "discovery");
    assert.equal(project.artifacts.length, 6);
    assert.equal(project.gates.length, 6);
    assert.equal(workflowTemplateForProject(project)?.id, template.id);
    assert.ok(project.nodes.some((node) => node.kind === "problem"));
    assert.ok(project.nodes.some((node) => node.kind === "deliverable"));
    assert.ok(project.nodes.some((node) => node.kind === "test"));
    assert.ok(project.artifacts.every((artifact) =>
      project.revisions.some((revision) => revision.id === artifact.activeRevisionId)));

    for (const phase of projectPhases) {
      const readiness = workflowPhaseReadiness(project, phase);
      assert.ok(readiness);
      assert.equal(readiness?.evidenceCount, 0);
      assert.equal(readiness?.evidenceThresholdMet, false);
      assert.equal(project.gates.find((gate) => gate.phase === phase)?.title, readiness?.gateTitle);
    }
  }
});

test("pasted evidence is bounded, source-linked, and added as canonical Atlas lineage", () => {
  const project = createWorkflowProject("research-ai-tools", {
    createdAt: recordedAt,
    idSeed: "evidence-lineage-test",
  });
  const evidence = ingestPastedEvidence({
    title: "Methods standard",
    text: "The documented method requires a reproducible search and appraisal record.",
    sourceUrl: "https://example.org/method#section-2",
    phase: "evidence",
    capturedAt: "2026-08-06T12:05:00.000Z",
  });
  assert.equal(evidence.provenance.networkAccess, "none");
  assert.equal(evidence.provenance.sourceUrl, "https://example.org/method");

  const next = addGovernedEvidenceToProject(project, evidence);
  assert.deepEqual(collectProjectIntegrityIssues(next), []);
  const artifact = next.artifacts.find((candidate) =>
    candidate.kind === "evidence" && candidate.title === evidence.title);
  assert.ok(artifact);
  assert.ok(next.revisions.some((revision) =>
    revision.artifactId === artifact?.id
    && revision.body.type === "text"
    && revision.body.text.includes("Network access during intake: none")));
  const node = next.nodes.find((candidate) =>
    candidate.kind === "evidence" && candidate.sourceRef === "https://example.org/method");
  assert.ok(node);
  const artifactNode = next.nodes.find((candidate) =>
    candidate.kind === "artifact" && candidate.refId === artifact?.id);
  assert.ok(next.edges.some((edge) =>
    edge.type === "supports"
    && edge.fromNodeId === artifactNode?.id
    && edge.toNodeId === node?.id));
  assert.equal(workflowPhaseReadiness(next, "evidence")?.evidenceCount, 1);
});

test("URL intake records provenance without claiming that the page was fetched", () => {
  const evidence = ingestUrlEvidence({
    title: "Public source to examine",
    url: "https://example.org/report?edition=2#findings",
    phase: "discovery",
    capturedAt: recordedAt,
  });
  assert.equal(evidence.status, "unresolved");
  assert.equal(evidence.provenance.captureMethod, "url-record");
  assert.equal(evidence.provenance.networkAccess, "none");
  assert.equal(evidence.provenance.sourceUrl, "https://example.org/report?edition=2");
  assert.match(evidence.text, /did not fetch/i);

  assert.throws(
    () => normalizeEvidenceUrl("file:///private/source.txt"),
    (error: unknown) => error instanceof EvidenceIngestionError && error.code === "INVALID_URL",
  );
  assert.throws(
    () => normalizeEvidenceUrl("https://user:password@example.org/private"),
    (error: unknown) => error instanceof EvidenceIngestionError && error.code === "INVALID_URL",
  );
});

test("local text, CSV, and JSON files are read under strict type and size controls", async () => {
  const markdown = new File(["# Observation\nA documented local observation."], "observation.md", {
    type: "text/markdown",
    lastModified: 1_723_120_000_000,
  });
  const ingested = await ingestEvidenceFile(markdown, {
    phase: "validation",
    capturedAt: recordedAt,
  });
  assert.equal(ingested.title, "observation");
  assert.equal(ingested.provenance.captureMethod, "local-text-read");
  assert.equal(ingested.provenance.file?.name, "observation.md");
  assert.equal(ingested.provenance.networkAccess, "none");

  await assert.rejects(
    () => ingestEvidenceFile(new File(["not json"], "invalid.json"), {
      phase: "evidence",
      capturedAt: recordedAt,
    }),
    (error: unknown) => error instanceof EvidenceIngestionError && error.code === "JSON_PARSE",
  );
  await assert.rejects(
    () => ingestEvidenceFile(new File(["binary"], "source.exe"), {
      phase: "evidence",
      capturedAt: recordedAt,
    }),
    (error: unknown) => error instanceof EvidenceIngestionError && error.code === "FILE_TYPE",
  );
  await assert.rejects(
    () => ingestEvidenceFile(
      new File([new Uint8Array(EVIDENCE_INGESTION_LIMITS.fileBytes + 1)], "large.csv"),
      { phase: "evidence", capturedAt: recordedAt },
    ),
    (error: unknown) => error instanceof EvidenceIngestionError && error.code === "FILE_SIZE",
  );
});

test("evidence text is rejected rather than silently truncated", () => {
  assert.throws(
    () => ingestPastedEvidence({
      title: "Oversized evidence",
      text: "x".repeat(EVIDENCE_INGESTION_LIMITS.textCharacters + 1),
      phase: "evidence",
      capturedAt: recordedAt,
    }),
    (error: unknown) => error instanceof EvidenceIngestionError && error.code === "TEXT_SIZE",
  );
});
