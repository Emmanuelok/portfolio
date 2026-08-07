import {
  appendArtifactRevision,
  createKingxfordProject,
  parseKingxfordProject,
  textRevisionBody,
  upsertProjectNode,
  type ArtifactKind,
  type KingxfordProject,
  type ProjectPhase,
} from "./project-graph";

export const workflowTemplateIds = [
  "websites",
  "digital-tools",
  "institutional-systems",
  "research-ai-tools",
  "operational-tools",
  "education-tools",
  "personal-tools",
] as const;

export type WorkflowTemplateId = (typeof workflowTemplateIds)[number];

export type WorkflowEvidenceThreshold = Readonly<{
  minimumItems: number;
  rule: string;
  acceptedSources: readonly string[];
}>;

export type WorkflowGate = Readonly<{
  title: string;
  criteria: readonly string[];
}>;

export type WorkflowArtifactSeed = Readonly<{
  kind: ArtifactKind;
  title: string;
  purpose: string;
  starterPrompts: readonly string[];
}>;

export type WorkflowPhaseTemplate = Readonly<{
  phase: ProjectPhase;
  objective: string;
  artifact: WorkflowArtifactSeed;
  evidence: WorkflowEvidenceThreshold;
  gate: WorkflowGate;
  deliverables: readonly string[];
  exportTargets: readonly string[];
}>;

export type WorkflowTemplate = Readonly<{
  id: WorkflowTemplateId;
  index: string;
  name: string;
  shortName: string;
  thesis: string;
  projectTitle: string;
  projectSummary: string;
  suitableFor: readonly string[];
  phases: readonly WorkflowPhaseTemplate[];
  exportTargets: readonly string[];
}>;

type PhaseBlueprint = Readonly<{
  artifactTitle: string;
  artifactKind: ArtifactKind;
  objective: string;
  prompts: readonly string[];
  gateTitle: string;
  gateCriteria: readonly string[];
  deliverables: readonly string[];
  exports: readonly string[];
  evidenceRule: string;
  sources: readonly string[];
  minimumEvidence?: number;
}>;

const phaseOrder = [
  "discovery",
  "evidence",
  "systems",
  "prototype",
  "validation",
  "delivery",
] as const satisfies readonly ProjectPhase[];

function phasesFrom(blueprints: Readonly<Record<ProjectPhase, PhaseBlueprint>>) {
  return phaseOrder.map<WorkflowPhaseTemplate>((phase) => {
    const blueprint = blueprints[phase];
    return {
      phase,
      objective: blueprint.objective,
      artifact: {
        kind: blueprint.artifactKind,
        title: blueprint.artifactTitle,
        purpose: blueprint.objective,
        starterPrompts: blueprint.prompts,
      },
      evidence: {
        minimumItems: blueprint.minimumEvidence ?? (phase === "validation" ? 3 : 2),
        rule: blueprint.evidenceRule,
        acceptedSources: blueprint.sources,
      },
      gate: {
        title: blueprint.gateTitle,
        criteria: blueprint.gateCriteria,
      },
      deliverables: blueprint.deliverables,
      exportTargets: blueprint.exports,
    };
  });
}

const commonExports = [
  "Kingxford project package (.kxproject.json)",
  "Decision and evidence record",
] as const;

export const workflowTemplates: readonly WorkflowTemplate[] = [
  {
    id: "websites",
    index: "01",
    name: "Websites and digital destinations",
    shortName: "Website programme",
    thesis: "Define, structure, prototype, test, and govern a credible digital destination.",
    projectTitle: "New website programme",
    projectSummary: "Develop a research-led website around the decisions its audiences need to make, with accountable content, accessibility, performance, and publishing governance.",
    suitableFor: ["Institutional websites", "Knowledge hubs", "Service platforms", "Campaign destinations"],
    phases: phasesFrom({
      discovery: {
        artifactTitle: "Audience and service brief",
        artifactKind: "idea",
        objective: "Define the audiences, decisions, institutional purpose, boundaries, and measures of success.",
        prompts: ["Who must make which decision?", "What must visitors trust?", "Which outcomes can be measured without overstating impact?"],
        gateTitle: "Purpose and audience confirmed",
        gateCriteria: ["Primary audiences are named", "Critical visitor decisions are explicit", "Claims and exclusions are documented"],
        deliverables: ["Audience decision map", "Project charter"],
        exports: ["Website discovery brief", "Audience requirements table"],
        evidenceRule: "Use direct stakeholder, analytics, service, or policy evidence rather than design preference alone.",
        sources: ["Stakeholder interviews", "Existing analytics", "Service records", "Policy and mandate documents"],
      },
      evidence: {
        artifactTitle: "Content and evidence register plan",
        artifactKind: "brief",
        objective: "Establish a source-linked content inventory, claim register, user evidence, and governance constraints.",
        prompts: ["Which claims require an owner and source?", "What content is current, duplicated, missing, or restricted?", "Which user needs remain unverified?"],
        gateTitle: "Content evidence is sufficient",
        gateCriteria: ["High-risk claims have sources", "Content owners are identified", "Known evidence gaps are visible"],
        deliverables: ["Content inventory", "Claim and source register"],
        exports: ["Evidence register (CSV)", "Content audit (Markdown)"],
        evidenceRule: "Record at least three independent items spanning audience need, existing content, and operating constraint.",
        sources: ["Content audit", "User research", "Legal or policy sources", "Analytics export"],
        minimumEvidence: 3,
      },
      systems: {
        artifactTitle: "Information and service architecture",
        artifactKind: "system-map",
        objective: "Connect content, journeys, services, ownership, data, integrations, and publishing responsibilities.",
        prompts: ["What belongs in the navigation?", "Where does each journey begin and end?", "Who owns every content and service boundary?"],
        gateTitle: "Architecture is coherent",
        gateCriteria: ["Navigation supports priority journeys", "Ownership is assigned", "Integration and privacy boundaries are explicit"],
        deliverables: ["Information architecture", "Service and publishing map"],
        exports: ["Sitemap", "System map"],
        evidenceRule: "Support architecture decisions with card-sort, search, content, service, or governance evidence.",
        sources: ["Journey observations", "Search terms", "Card sorting", "System documentation"],
      },
      prototype: {
        artifactTitle: "Responsive interface prototype",
        artifactKind: "code",
        objective: "Build the highest-risk pages, components, interactions, states, and publishing patterns first.",
        prompts: ["Which page carries the greatest decision risk?", "What must work with keyboard, touch, and assistive technology?", "Which states need real content?"],
        gateTitle: "Critical experience is testable",
        gateCriteria: ["Priority journeys are interactive", "Responsive and error states exist", "Representative content is used"],
        deliverables: ["Responsive prototype", "Component and content model"],
        exports: ["HTML prototype", "Component specification"],
        evidenceRule: "Capture prototype behavior, accessibility checks, and technical feasibility findings.",
        sources: ["Prototype observations", "Accessibility checks", "Technical spike", "Content stress test"],
      },
      validation: {
        artifactTitle: "Website validation protocol",
        artifactKind: "brief",
        objective: "Test comprehension, task completion, accessibility, performance, content accuracy, and publishing operations.",
        prompts: ["Can representative users complete priority tasks?", "Which claims or interactions confuse people?", "Can the publishing team maintain the system?"],
        gateTitle: "Release evidence is accepted",
        gateCriteria: ["Critical tasks meet the agreed threshold", "Blocking accessibility issues are resolved", "Content owners approve accountable claims"],
        deliverables: ["Test report", "Release risk register"],
        exports: ["Validation report", "Issue register (CSV)"],
        evidenceRule: "Include task evidence, accessibility results, and content or operational approval from distinct sources.",
        sources: ["Usability sessions", "Accessibility audit", "Performance measurements", "Content-owner review"],
        minimumEvidence: 3,
      },
      delivery: {
        artifactTitle: "Launch and operating plan",
        artifactKind: "brief",
        objective: "Prepare migration, release, analytics, ownership, maintenance, incident response, and post-launch review.",
        prompts: ["Who owns launch decisions?", "How will content and dependencies remain current?", "What will trigger rollback or corrective work?"],
        gateTitle: "Launch responsibilities are accepted",
        gateCriteria: ["Owners and runbooks are assigned", "Migration and rollback are rehearsed", "Post-launch measures are agreed"],
        deliverables: ["Launch plan", "Operating and governance handbook"],
        exports: ["Implementation brief", "Launch checklist"],
        evidenceRule: "Provide accountable sign-off, migration evidence, and operational readiness records.",
        sources: ["Release rehearsal", "Owner sign-off", "Migration report", "Operations review"],
      },
    }),
    exportTargets: [...commonExports, "Sitemap and content model", "Production-ready implementation brief"],
  },
  {
    id: "digital-tools",
    index: "02",
    name: "Digital tools",
    shortName: "Digital tool workflow",
    thesis: "Turn a repeated, consequential task into a dependable, inspectable utility.",
    projectTitle: "New digital tool",
    projectSummary: "Design and validate a focused calculator, planner, analyzer, generator, tracker, or guided workflow around a real task and its failure conditions.",
    suitableFor: ["Calculators", "Planning utilities", "Guided workflows", "Data collection tools"],
    phases: phasesFrom({
      discovery: {
        artifactTitle: "Task and user brief",
        artifactKind: "idea",
        objective: "Define the repeated task, decision owner, current workarounds, consequences, and measurable value.",
        prompts: ["What decision does the tool improve?", "Where does the current process fail?", "What must remain under human control?"],
        gateTitle: "Task value is confirmed",
        gateCriteria: ["The task is frequent or consequential", "The user and decision are named", "Non-goals are explicit"],
        deliverables: ["Task definition", "Outcome and constraint brief"],
        exports: ["Product brief", "User-task inventory"],
        evidenceRule: "Use observed work, representative inputs, and consequence data.",
        sources: ["Workflow observation", "User interview", "Representative records", "Error or support logs"],
      },
      evidence: {
        artifactTitle: "Rules, inputs, and evidence plan",
        artifactKind: "brief",
        objective: "Document input sources, decision rules, edge cases, data quality, privacy, and expected outputs.",
        prompts: ["Which rule is authoritative?", "What input cannot be trusted?", "What must the tool refuse or flag?"],
        gateTitle: "Rules and inputs are supportable",
        gateCriteria: ["Rules have owners or sources", "Representative edge cases exist", "Sensitive data boundaries are defined"],
        deliverables: ["Rule register", "Input and output contract"],
        exports: ["Rule table (CSV)", "Data contract"],
        evidenceRule: "Record independent evidence for the task, governing rules, and representative data.",
        sources: ["Authoritative rules", "Sample data", "Domain expert review", "Incident records"],
        minimumEvidence: 3,
      },
      systems: {
        artifactTitle: "Workflow and data map",
        artifactKind: "system-map",
        objective: "Map states, calculations, validation, dependencies, permissions, storage, and recovery paths.",
        prompts: ["What are the valid states?", "Where can data be lost or misinterpreted?", "Which dependencies need a fallback?"],
        gateTitle: "Logic and boundaries are coherent",
        gateCriteria: ["State transitions are complete", "Failure recovery is defined", "Data ownership is clear"],
        deliverables: ["Workflow model", "Data and dependency map"],
        exports: ["Process diagram", "Technical decision record"],
        evidenceRule: "Support the model with rule walkthroughs, system constraints, and failure examples.",
        sources: ["Rule walkthrough", "Dependency documentation", "Failure analysis", "Privacy assessment"],
      },
      prototype: {
        artifactTitle: "Working utility prototype",
        artifactKind: "code",
        objective: "Implement the core calculation or workflow with validation, explanations, recovery, and export.",
        prompts: ["Can users inspect how the result was produced?", "What happens with incomplete or contradictory input?", "Is a useful export available?"],
        gateTitle: "Core utility is executable",
        gateCriteria: ["Core logic produces repeatable results", "Invalid input fails safely", "Outputs remain understandable"],
        deliverables: ["Working prototype", "Validation and explanation layer"],
        exports: ["Runnable HTML prototype", "Test vectors"],
        evidenceRule: "Capture executed examples, error behavior, and domain review of the output.",
        sources: ["Test vectors", "Prototype runs", "Domain review", "Accessibility checks"],
      },
      validation: {
        artifactTitle: "Accuracy and usability test plan",
        artifactKind: "brief",
        objective: "Test correctness, comprehension, edge cases, accessibility, reliability, and task improvement.",
        prompts: ["Does the tool match known answers?", "Can users detect uncertainty?", "Does it materially improve the task?"],
        gateTitle: "Utility meets acceptance thresholds",
        gateCriteria: ["Reference cases pass", "Critical errors are contained", "Representative users understand outputs"],
        deliverables: ["Acceptance test report", "Known limitations register"],
        exports: ["Test report", "Validation dataset"],
        evidenceRule: "Include known-answer tests, observed use, and an independent domain review.",
        sources: ["Reference calculations", "Usability tests", "Domain verification", "Reliability tests"],
        minimumEvidence: 3,
      },
      delivery: {
        artifactTitle: "Release and maintenance plan",
        artifactKind: "brief",
        objective: "Define deployment, ownership, versioning, data handling, monitoring, support, and rule updates.",
        prompts: ["Who approves rule changes?", "How are old results reproduced?", "Which signal requires intervention?"],
        gateTitle: "Operating responsibility is accepted",
        gateCriteria: ["Release and rollback are defined", "Rule ownership is assigned", "Support and monitoring are ready"],
        deliverables: ["Release plan", "Maintenance and change-control register"],
        exports: ["Implementation specification", "Operational runbook"],
        evidenceRule: "Provide deployment rehearsal, owner approval, and monitoring or support readiness evidence.",
        sources: ["Release rehearsal", "Owner sign-off", "Monitoring check", "Support review"],
      },
    }),
    exportTargets: [...commonExports, "Runnable prototype", "Rule and validation package"],
  },
  {
    id: "institutional-systems",
    index: "03",
    name: "Institutional systems",
    shortName: "Institutional system workflow",
    thesis: "Make roles, cases, approvals, evidence, controls, and reporting accountable by design.",
    projectTitle: "New institutional system",
    projectSummary: "Develop an institutional system around real mandates, roles, controls, evidence requirements, service cases, and accountable decisions.",
    suitableFor: ["Programme systems", "Approval workflows", "Knowledge environments", "Service portals"],
    phases: phasesFrom({
      discovery: {
        artifactTitle: "Mandate and service brief",
        artifactKind: "idea",
        objective: "Define the institutional mandate, service users, accountable roles, decisions, harms, and success measures.",
        prompts: ["Which mandate authorizes the service?", "Who is accountable for each decision?", "Who may be excluded or disadvantaged?"],
        gateTitle: "Mandate and accountability confirmed",
        gateCriteria: ["Mandate is traceable", "Decision owners are named", "Affected groups and harms are considered"],
        deliverables: ["Mandate map", "Stakeholder and accountability brief"],
        exports: ["Institutional charter", "RACI draft"],
        evidenceRule: "Use mandate, service, stakeholder, and accountability evidence.",
        sources: ["Statute or policy", "Service records", "Stakeholder interviews", "Audit findings"],
      },
      evidence: {
        artifactTitle: "Control and record evidence plan",
        artifactKind: "brief",
        objective: "Inventory policies, controls, record obligations, decision evidence, data quality, and audit needs.",
        prompts: ["What proves that a decision was proper?", "Which records are mandatory?", "Where do policy and practice diverge?"],
        gateTitle: "Control basis is evidenced",
        gateCriteria: ["Critical controls have sources", "Record obligations are explicit", "Policy-practice gaps are registered"],
        deliverables: ["Control register", "Evidence and records schedule"],
        exports: ["Control matrix (CSV)", "Evidence schedule"],
        evidenceRule: "Record authoritative policy, operating evidence, and an independent control or audit perspective.",
        sources: ["Policies", "Procedure manuals", "Audit reports", "Case records"],
        minimumEvidence: 3,
      },
      systems: {
        artifactTitle: "Roles, cases, and controls model",
        artifactKind: "system-map",
        objective: "Connect roles, permissions, case states, approvals, controls, evidence, reports, and integrations.",
        prompts: ["Who can see, change, approve, or override?", "What evidence is required at each state?", "How is segregation of duties maintained?"],
        gateTitle: "Institutional model is governable",
        gateCriteria: ["Roles and permissions are least-privilege", "Approval and override paths are accountable", "Records and integrations have owners"],
        deliverables: ["Service and case model", "Role-control architecture"],
        exports: ["System model", "Permissions matrix"],
        evidenceRule: "Support roles, controls, and state transitions with policy and operating examples.",
        sources: ["Role descriptions", "Case walkthroughs", "Control testing", "Integration documentation"],
      },
      prototype: {
        artifactTitle: "Case and approval prototype",
        artifactKind: "code",
        objective: "Prototype priority case states, evidence capture, review, approvals, exceptions, and management visibility.",
        prompts: ["Can reviewers see the basis for a decision?", "What happens when evidence is missing?", "Are exceptional actions attributable?"],
        gateTitle: "Critical controls are testable",
        gateCriteria: ["Evidence follows the case", "Approval authority is visible", "Exceptions and recovery are represented"],
        deliverables: ["Workflow prototype", "Control interaction specification"],
        exports: ["Interactive prototype", "Case-state specification"],
        evidenceRule: "Capture role walkthroughs, control behavior, and representative case results.",
        sources: ["Role walkthrough", "Control simulation", "Representative cases", "Accessibility review"],
      },
      validation: {
        artifactTitle: "Institutional assurance plan",
        artifactKind: "brief",
        objective: "Test permissions, controls, record integrity, service usability, reporting, privacy, and operational fit.",
        prompts: ["Can an unauthorized action succeed?", "Is every critical decision reconstructable?", "Can staff complete work under realistic conditions?"],
        gateTitle: "Institutional assurance is accepted",
        gateCriteria: ["Critical permission tests pass", "Decision trails are complete", "Operational owners accept the workflow"],
        deliverables: ["Control assurance report", "Service acceptance record"],
        exports: ["Assurance report", "Control test evidence"],
        evidenceRule: "Include access-control, audit-trail, service-use, and accountable owner evidence.",
        sources: ["Permission tests", "Audit reconstruction", "Staff acceptance testing", "Privacy review"],
        minimumEvidence: 4,
      },
      delivery: {
        artifactTitle: "Institutional adoption and governance plan",
        artifactKind: "brief",
        objective: "Plan migration, training, delegated authority, support, audit, change control, continuity, and benefits review.",
        prompts: ["Who owns each policy and system change?", "How will records be migrated and retained?", "How are incidents escalated?"],
        gateTitle: "Institutional adoption is authorized",
        gateCriteria: ["Authority and owners sign off", "Migration and continuity are rehearsed", "Training and support are resourced"],
        deliverables: ["Adoption roadmap", "Governance and operating model"],
        exports: ["Implementation roadmap", "Governance handbook"],
        evidenceRule: "Provide formal owner approval, migration assurance, and operational readiness evidence.",
        sources: ["Authority sign-off", "Migration rehearsal", "Training readiness", "Continuity exercise"],
      },
    }),
    exportTargets: [...commonExports, "Control and permissions matrices", "Institutional implementation roadmap"],
  },
  {
    id: "research-ai-tools",
    index: "04",
    name: "Research and AI tools",
    shortName: "Research and AI workflow",
    thesis: "Strengthen inquiry and synthesis while keeping sources, uncertainty, evaluation, and human judgement visible.",
    projectTitle: "New research and AI tool",
    projectSummary: "Develop a source-grounded research or AI-assisted environment with explicit evaluation, provenance, uncertainty, privacy, and human review boundaries.",
    suitableFor: ["Evidence reviews", "Research repositories", "Knowledge graphs", "Evaluated AI-assisted tools"],
    phases: phasesFrom({
      discovery: {
        artifactTitle: "Research question and use brief",
        artifactKind: "idea",
        objective: "Define the research question, users, decisions, scope, epistemic risks, and the appropriate role of computation.",
        prompts: ["What claim or decision will this support?", "Which uncertainty must remain visible?", "Where is AI unnecessary or inappropriate?"],
        gateTitle: "Research purpose and boundaries confirmed",
        gateCriteria: ["Question and users are explicit", "Scope and exclusions are documented", "Human judgement boundaries are accepted"],
        deliverables: ["Research use case", "Scope and risk brief"],
        exports: ["Research protocol draft", "Use-case statement"],
        evidenceRule: "Use domain, user, methodological, and risk evidence to justify the use case.",
        sources: ["Research literature", "User interviews", "Method standards", "Risk or ethics guidance"],
      },
      evidence: {
        artifactTitle: "Source and provenance protocol",
        artifactKind: "brief",
        objective: "Define retrieval, inclusion, quality appraisal, citation, licensing, data governance, and provenance requirements.",
        prompts: ["Which sources are eligible?", "How will every claim be traced?", "What data cannot enter a model or external service?"],
        gateTitle: "Evidence protocol is defensible",
        gateCriteria: ["Inclusion and appraisal rules are explicit", "Claim-source traceability is designed", "Data and rights constraints are recorded"],
        deliverables: ["Evidence protocol", "Source and rights register"],
        exports: ["Protocol (Markdown)", "Source register (CSV)"],
        evidenceRule: "Record at least four sources spanning domain evidence, method, governance, and representative data.",
        sources: ["Peer-reviewed research", "Primary datasets", "Method standards", "Governance and rights documents"],
        minimumEvidence: 4,
      },
      systems: {
        artifactTitle: "Knowledge and model architecture",
        artifactKind: "system-map",
        objective: "Map sources, retrieval, transformations, claims, models, evaluation, human review, storage, and exports.",
        prompts: ["Can every output be traced to source and transformation?", "Where can unsupported inference enter?", "Which step requires human confirmation?"],
        gateTitle: "Knowledge architecture is traceable",
        gateCriteria: ["Provenance survives each transformation", "Model and human responsibilities are separated", "Failure and fallback paths are explicit"],
        deliverables: ["Knowledge flow", "Model and governance architecture"],
        exports: ["Provenance model", "Architecture record"],
        evidenceRule: "Support the architecture with source, model, governance, and failure-mode evidence.",
        sources: ["Dataset documentation", "Model documentation", "Threat modelling", "Research workflow observation"],
      },
      prototype: {
        artifactTitle: "Grounded research prototype",
        artifactKind: "prompt",
        objective: "Prototype retrieval, structured analysis, source display, uncertainty, refusal, review, and reproducible export.",
        prompts: ["Does the output cite the correct source?", "Can unsupported claims be detected?", "Can a human inspect and reject each proposal?"],
        gateTitle: "Grounded behavior is testable",
        gateCriteria: ["Claims link to sources", "Uncertainty and refusal states are visible", "Human acceptance is deliberate"],
        deliverables: ["Grounded interaction prototype", "Prompt and tool contract"],
        exports: ["Prompt specification", "Prototype evaluation set"],
        evidenceRule: "Capture grounded examples, unsupported cases, refusals, and human-review observations.",
        sources: ["Grounded test cases", "Adversarial cases", "Human review", "Privacy and security checks"],
      },
      validation: {
        artifactTitle: "Research and model evaluation plan",
        artifactKind: "brief",
        objective: "Evaluate retrieval, factuality, citation, completeness, bias, robustness, safety, usability, and research reproducibility.",
        prompts: ["What is the reference answer?", "Which subgroup or source type is underserved?", "Can another researcher reproduce the result?"],
        gateTitle: "Evaluation thresholds are met",
        gateCriteria: ["Reference-set measures meet thresholds", "Material limitations are disclosed", "Independent human review is complete"],
        deliverables: ["Evaluation report", "Model and research limitations statement"],
        exports: ["Evaluation dataset", "Model/research card"],
        evidenceRule: "Include quantitative evaluation, qualitative review, robustness tests, and reproducibility evidence.",
        sources: ["Reference set", "Expert review", "Robustness tests", "Reproduction record"],
        minimumEvidence: 4,
      },
      delivery: {
        artifactTitle: "Responsible release and research operations plan",
        artifactKind: "brief",
        objective: "Define versioning, monitoring, source updates, incident response, access, cost, retention, and periodic re-evaluation.",
        prompts: ["How are sources and models versioned?", "What triggers suspension or re-evaluation?", "How can a result be reconstructed?"],
        gateTitle: "Responsible operation is authorized",
        gateCriteria: ["Monitoring and incident owners are assigned", "Version and retention rules are defined", "Re-evaluation schedule is accepted"],
        deliverables: ["Responsible operation plan", "Monitoring and re-evaluation register"],
        exports: ["Release dossier", "Operations and evaluation schedule"],
        evidenceRule: "Provide owner approval, reconstruction test, monitoring readiness, and governance evidence.",
        sources: ["Owner sign-off", "Reconstruction test", "Monitoring rehearsal", "Governance review"],
      },
    }),
    exportTargets: [...commonExports, "Source and provenance register", "Evaluation dataset and research/model card"],
  },
  {
    id: "operational-tools",
    index: "05",
    name: "Operational tools",
    shortName: "Operations workflow",
    thesis: "Make work, queues, handoffs, resources, risk, and service performance visible and controllable.",
    projectTitle: "New operational tool",
    projectSummary: "Develop an operational tool around observed work, accountable handoffs, reliable records, exception management, field conditions, and measurable service outcomes.",
    suitableFor: ["Operations dashboards", "Field tools", "Resource trackers", "Request and case queues"],
    phases: phasesFrom({
      discovery: {
        artifactTitle: "Operational problem brief",
        artifactKind: "idea",
        objective: "Define the service, demand, actors, handoffs, delays, consequences, operating conditions, and target outcome.",
        prompts: ["Where does work wait or fail?", "Who needs visibility or authority?", "What happens offline or under pressure?"],
        gateTitle: "Operational need is confirmed",
        gateCriteria: ["Demand and failure are evidenced", "Frontline and accountable roles are included", "Outcome measures are practical"],
        deliverables: ["Operational problem statement", "Service outcome brief"],
        exports: ["Operations charter", "Baseline measure table"],
        evidenceRule: "Use frontline observation, demand data, incident evidence, and accountable owner input.",
        sources: ["Workflow observation", "Queue or demand data", "Incident records", "Frontline interviews"],
      },
      evidence: {
        artifactTitle: "Operating evidence and baseline plan",
        artifactKind: "brief",
        objective: "Establish process timing, volumes, exceptions, resource constraints, quality rules, and baseline performance.",
        prompts: ["Which measure changes a decision?", "Where is the data incomplete?", "Which exception causes the greatest consequence?"],
        gateTitle: "Operational baseline is credible",
        gateCriteria: ["Measures have definitions and owners", "Exceptions and data gaps are visible", "Baseline spans representative conditions"],
        deliverables: ["Operational baseline", "Exception and risk register"],
        exports: ["Baseline data (CSV)", "Evidence register"],
        evidenceRule: "Record demand, timing, quality, and exception evidence from at least three sources.",
        sources: ["Transaction data", "Time observation", "Quality records", "Incident and exception logs"],
        minimumEvidence: 3,
      },
      systems: {
        artifactTitle: "Operational flow and control map",
        artifactKind: "system-map",
        objective: "Map demand, queues, roles, handoffs, assets, decisions, controls, exceptions, alerts, and feedback.",
        prompts: ["Where is work waiting?", "Which handoff lacks ownership?", "What event should trigger escalation?"],
        gateTitle: "Operational model is actionable",
        gateCriteria: ["Every handoff has an owner", "Exceptions have containment and escalation", "Measures connect to decisions"],
        deliverables: ["Service flow", "Control and escalation map"],
        exports: ["Process map", "Control table"],
        evidenceRule: "Support the model with walkthroughs, exception cases, resource constraints, and control evidence.",
        sources: ["Process walkthrough", "Exception cases", "Resource records", "Control review"],
      },
      prototype: {
        artifactTitle: "Operational control prototype",
        artifactKind: "code",
        objective: "Prototype queue, field, resource, risk, alert, handoff, and recovery states using representative operational data.",
        prompts: ["Can the next responsible person act?", "What is visible when data is late or missing?", "Does the interface work in field conditions?"],
        gateTitle: "Operational decisions are testable",
        gateCriteria: ["Priority actions are clear", "Exception states are represented", "Field and accessibility conditions are considered"],
        deliverables: ["Operational prototype", "State and alert specification"],
        exports: ["Interactive prototype", "Operational state catalogue"],
        evidenceRule: "Capture representative runs, exception handling, frontline use, and technical constraints.",
        sources: ["Scenario runs", "Frontline walkthrough", "Offline test", "Technical feasibility check"],
      },
      validation: {
        artifactTitle: "Operational pilot and acceptance plan",
        artifactKind: "brief",
        objective: "Test reliability, task time, handoff quality, exceptions, alert usefulness, field use, and unintended workload.",
        prompts: ["Does work move faster without hidden rework?", "Are alerts actionable?", "What burden moves to another role?"],
        gateTitle: "Operational pilot is accepted",
        gateCriteria: ["Priority measures improve or remain safe", "Critical exceptions are contained", "Frontline and accountable owners accept the workflow"],
        deliverables: ["Pilot report", "Operational acceptance record"],
        exports: ["Pilot results", "Issue and decision register"],
        evidenceRule: "Include performance, reliability, exception, and user acceptance evidence.",
        sources: ["Pilot measures", "Reliability logs", "Exception tests", "Frontline acceptance"],
        minimumEvidence: 4,
      },
      delivery: {
        artifactTitle: "Operational rollout and continuity plan",
        artifactKind: "brief",
        objective: "Plan phased rollout, training, support, data migration, monitoring, continuity, incident response, and improvement reviews.",
        prompts: ["How will service continue during failure?", "Who owns each alert and measure?", "What is the rollback condition?"],
        gateTitle: "Operational rollout is authorized",
        gateCriteria: ["Continuity and rollback are rehearsed", "Owners and support are assigned", "Monitoring and review cadence are accepted"],
        deliverables: ["Rollout roadmap", "Operations runbook"],
        exports: ["Implementation plan", "Continuity and support runbook"],
        evidenceRule: "Provide rollout rehearsal, continuity, owner sign-off, and support readiness evidence.",
        sources: ["Rollout rehearsal", "Continuity exercise", "Owner sign-off", "Support readiness review"],
      },
    }),
    exportTargets: [...commonExports, "Operational flow and control map", "Pilot and rollout package"],
  },
  {
    id: "education-tools",
    index: "06",
    name: "Education tools",
    shortName: "Education workflow",
    thesis: "Connect intended learning, purposeful practice, useful feedback, inclusion, and credible evidence of progress.",
    projectTitle: "New education tool",
    projectSummary: "Develop a learning environment or teaching tool around explicit learning outcomes, authentic practice, feedback, accessibility, assessment integrity, and educator operations.",
    suitableFor: ["Learning platforms", "Practice tools", "Teaching libraries", "Learner project workspaces"],
    phases: phasesFrom({
      discovery: {
        artifactTitle: "Learning and learner brief",
        artifactKind: "idea",
        objective: "Define learners, context, prior knowledge, intended outcomes, barriers, educator needs, and assessment boundaries.",
        prompts: ["What should learners be able to do?", "What prior knowledge is assumed?", "Which barriers or contexts affect participation?"],
        gateTitle: "Learning need is confirmed",
        gateCriteria: ["Outcomes are observable", "Learner context and barriers are evidenced", "Assessment and credential limits are explicit"],
        deliverables: ["Learner profile", "Learning outcome brief"],
        exports: ["Learning design brief", "Outcome map"],
        evidenceRule: "Use curriculum, learner, educator, and accessibility evidence.",
        sources: ["Curriculum or competency standards", "Learner research", "Educator interviews", "Accessibility needs"],
      },
      evidence: {
        artifactTitle: "Curriculum and learning evidence plan",
        artifactKind: "brief",
        objective: "Map authoritative content, learning science, representative misconceptions, assessment evidence, and rights constraints.",
        prompts: ["Which source establishes the content?", "What misconception should practice reveal?", "What evidence demonstrates—not merely reports—learning?"],
        gateTitle: "Learning basis is supportable",
        gateCriteria: ["Content has authoritative sources", "Practice and feedback align to outcomes", "Assessment evidence and rights are defined"],
        deliverables: ["Curriculum evidence map", "Assessment evidence plan"],
        exports: ["Curriculum map", "Source and rights register"],
        evidenceRule: "Record curriculum, learner need, pedagogical, and accessibility evidence from distinct sources.",
        sources: ["Curriculum standards", "Domain sources", "Learning research", "Learner work samples"],
        minimumEvidence: 4,
      },
      systems: {
        artifactTitle: "Learning journey and feedback system",
        artifactKind: "system-map",
        objective: "Connect outcomes, activities, practice, feedback, assessment, resources, educator actions, progress, and support.",
        prompts: ["How does each activity serve an outcome?", "When and from whom does feedback arrive?", "What happens when a learner needs another path?"],
        gateTitle: "Learning system is aligned",
        gateCriteria: ["Activities and assessments align to outcomes", "Feedback and support loops are explicit", "Learner and educator responsibilities are workable"],
        deliverables: ["Learning journey", "Outcome-activity-assessment map"],
        exports: ["Learning system map", "Alignment matrix"],
        evidenceRule: "Support journey decisions with learner, curriculum, feedback, and educator workflow evidence.",
        sources: ["Learner journey research", "Curriculum alignment", "Feedback observations", "Educator workflow"],
      },
      prototype: {
        artifactTitle: "Learning experience prototype",
        artifactKind: "code",
        objective: "Prototype representative instruction, practice, feedback, progress, error, support, and educator states.",
        prompts: ["Does feedback help the learner act?", "Can learners understand progress without misleading scores?", "Is the experience accessible and age-appropriate?"],
        gateTitle: "Learning experience is testable",
        gateCriteria: ["Practice elicits the intended performance", "Feedback is actionable", "Accessibility and safeguarding states are represented"],
        deliverables: ["Interactive learning prototype", "Feedback and content specification"],
        exports: ["Interactive prototype", "Lesson and feedback specification"],
        evidenceRule: "Capture practice attempts, feedback comprehension, accessibility, and educator observations.",
        sources: ["Learner walkthrough", "Educator review", "Accessibility check", "Content accuracy review"],
      },
      validation: {
        artifactTitle: "Learning validation and assessment plan",
        artifactKind: "brief",
        objective: "Test usability, learning alignment, feedback quality, accessibility, educator workload, integrity, and appropriate progress measures.",
        prompts: ["Can learners demonstrate the intended outcome?", "Does feedback cause useful revision?", "Are claims of progress proportionate to the evidence?"],
        gateTitle: "Learning and operational evidence is accepted",
        gateCriteria: ["Outcome evidence meets the agreed standard", "Material access barriers are addressed", "Educators accept the operating workload"],
        deliverables: ["Learning validation report", "Assessment and limitation statement"],
        exports: ["Validation report", "Rubric and evidence set"],
        evidenceRule: "Include learner performance, feedback use, accessibility, and educator acceptance evidence.",
        sources: ["Learner performance", "Revision evidence", "Accessibility testing", "Educator acceptance"],
        minimumEvidence: 4,
      },
      delivery: {
        artifactTitle: "Education implementation and stewardship plan",
        artifactKind: "brief",
        objective: "Plan curriculum stewardship, educator preparation, learner support, privacy, moderation, content updates, and evaluation.",
        prompts: ["Who owns content accuracy?", "How are educators prepared and supported?", "What triggers curriculum or assessment revision?"],
        gateTitle: "Education implementation is authorized",
        gateCriteria: ["Content and learner-support owners are assigned", "Educator readiness is evidenced", "Privacy, safeguarding, and evaluation plans are accepted"],
        deliverables: ["Implementation roadmap", "Content and learning governance plan"],
        exports: ["Programme implementation plan", "Educator and learner support guide"],
        evidenceRule: "Provide educator readiness, content approval, learner support, and governance evidence.",
        sources: ["Educator readiness", "Content-owner approval", "Support rehearsal", "Governance review"],
      },
    }),
    exportTargets: [...commonExports, "Outcome-alignment matrix", "Learning validation and implementation package"],
  },
  {
    id: "personal-tools",
    index: "07",
    name: "Everyday personal tools",
    shortName: "Personal tool workflow",
    thesis: "Help people organize information and compare options without concealing uncertainty or taking away agency.",
    projectTitle: "New everyday tool",
    projectSummary: "Develop a private, understandable personal or community tool for planning, comparison, learning, records, or recurring responsibilities, with portable data and clear limits.",
    suitableFor: ["Personal planners", "Information organizers", "Comparison tools", "Community resource guides"],
    phases: phasesFrom({
      discovery: {
        artifactTitle: "Everyday need and agency brief",
        artifactKind: "idea",
        objective: "Define the real-life task, user context, stress points, accessibility needs, privacy expectations, and decisions that remain personal.",
        prompts: ["What does the person need to understand or do?", "Which information is sensitive?", "What should the tool never decide for them?"],
        gateTitle: "Everyday need and boundaries confirmed",
        gateCriteria: ["The task is concrete", "Privacy and accessibility needs are explicit", "Personal agency boundaries are protected"],
        deliverables: ["Everyday task brief", "Privacy and agency statement"],
        exports: ["Plain-language product brief", "User needs table"],
        evidenceRule: "Use direct user, context, accessibility, and privacy evidence.",
        sources: ["User conversations", "Context observation", "Accessibility needs", "Privacy expectations"],
      },
      evidence: {
        artifactTitle: "Information and guidance evidence plan",
        artifactKind: "brief",
        objective: "Identify trustworthy information, source dates, local variation, personal data, uncertainty, and when professional advice is required.",
        prompts: ["Who is responsible for this information?", "When does it expire or vary by place?", "Where should the tool direct a person to qualified help?"],
        gateTitle: "Guidance basis is trustworthy",
        gateCriteria: ["Material guidance has named sources", "Date and jurisdiction are visible", "Professional-help boundaries are explicit"],
        deliverables: ["Guidance source register", "Data and boundary plan"],
        exports: ["Source register", "Plain-language limitations statement"],
        evidenceRule: "Record authoritative guidance, lived context, accessibility, and privacy evidence.",
        sources: ["Public guidance", "Service provider information", "User context", "Accessibility review"],
        minimumEvidence: 3,
      },
      systems: {
        artifactTitle: "Personal information and decision map",
        artifactKind: "system-map",
        objective: "Map inputs, private records, comparisons, reminders, decisions, sharing, deletion, export, and help pathways.",
        prompts: ["What stays only on the device?", "Can the person correct, export, or delete their information?", "How is uncertainty shown at a decision point?"],
        gateTitle: "Personal workflow protects agency",
        gateCriteria: ["Data control is understandable", "Decision logic is inspectable", "Correction, export, and deletion paths are explicit"],
        deliverables: ["Personal workflow map", "Data-control model"],
        exports: ["Workflow map", "Privacy and portability specification"],
        evidenceRule: "Support the design with privacy, comprehension, portability, and real-context evidence.",
        sources: ["Privacy walkthrough", "Comprehension research", "Data portability test", "Real-context scenarios"],
      },
      prototype: {
        artifactTitle: "Everyday tool prototype",
        artifactKind: "code",
        objective: "Prototype the core task with plain language, comparison, uncertainty, correction, recovery, privacy, and accessible export.",
        prompts: ["Can a person understand why an option is shown?", "Can they revise a mistake safely?", "Does the tool work without an account or network where appropriate?"],
        gateTitle: "Everyday task is testable",
        gateCriteria: ["Core task is understandable", "Correction and recovery work", "Privacy and accessibility choices are visible"],
        deliverables: ["Interactive prototype", "Plain-language content and state guide"],
        exports: ["Runnable prototype", "Content specification"],
        evidenceRule: "Capture representative task attempts, comprehension, recovery, and accessibility observations.",
        sources: ["Task walkthrough", "Comprehension test", "Recovery test", "Accessibility check"],
      },
      validation: {
        artifactTitle: "Usefulness, safety, and comprehension plan",
        artifactKind: "brief",
        objective: "Test usefulness, comprehension, privacy, accessibility, recovery, inappropriate reliance, and burden under realistic conditions.",
        prompts: ["Can users explain what the tool did and did not decide?", "Can they recover their information?", "Does the tool create pressure, confusion, or misplaced confidence?"],
        gateTitle: "Personal use evidence is accepted",
        gateCriteria: ["Representative users complete the task", "Material misunderstanding is addressed", "Privacy, recovery, and accessibility tests pass"],
        deliverables: ["User validation report", "Safety and limitations record"],
        exports: ["Validation report", "Issue and limitation register"],
        evidenceRule: "Include task, comprehension, privacy, recovery, and accessibility evidence.",
        sources: ["Representative user tests", "Comprehension checks", "Privacy walkthrough", "Recovery and accessibility tests"],
        minimumEvidence: 4,
      },
      delivery: {
        artifactTitle: "Release, support, and information maintenance plan",
        artifactKind: "brief",
        objective: "Plan trustworthy updates, local-first storage, export, deletion, support, accessibility, incident handling, and retirement.",
        prompts: ["How will changing information be reviewed?", "Can people leave with their data?", "What happens when the tool is no longer maintained?"],
        gateTitle: "Personal-use release is responsible",
        gateCriteria: ["Information and support owners are assigned", "Export, deletion, and retirement are tested", "Update and incident processes are accepted"],
        deliverables: ["Responsible release plan", "Support and information stewardship guide"],
        exports: ["Release checklist", "Support and stewardship guide"],
        evidenceRule: "Provide owner, portability, update, support, and retirement readiness evidence.",
        sources: ["Owner sign-off", "Portability test", "Update rehearsal", "Support and retirement review"],
      },
    }),
    exportTargets: [...commonExports, "Privacy and portability specification", "Responsible release package"],
  },
] as const;

const workflowTemplateMap = new Map(
  workflowTemplates.map((template) => [template.id, template]),
);

const workflowSourcePrefix = "kingxford:workflow:v1:";

export function isWorkflowTemplateId(value: string): value is WorkflowTemplateId {
  return workflowTemplateIds.includes(value as WorkflowTemplateId);
}

export function workflowTemplateById(id: WorkflowTemplateId) {
  return workflowTemplateMap.get(id)!;
}

function workflowSource(templateId: WorkflowTemplateId, suffix = "") {
  return `${workflowSourcePrefix}${templateId}${suffix}`;
}

function phaseArtifactBody(template: WorkflowTemplate, phase: WorkflowPhaseTemplate) {
  return [
    `# ${phase.artifact.title}`,
    "",
    `Workflow: ${template.name}`,
    `Phase: ${phase.phase}`,
    "",
    "## Objective",
    phase.objective,
    "",
    "## Working questions",
    ...phase.artifact.starterPrompts.map((prompt) => `- ${prompt}`),
    "",
    `## Evidence threshold · ${phase.evidence.minimumItems} item${phase.evidence.minimumItems === 1 ? "" : "s"} minimum`,
    phase.evidence.rule,
    ...phase.evidence.acceptedSources.map((source) => `- ${source}`),
    "",
    "## Human gate",
    phase.gate.title,
    ...phase.gate.criteria.map((criterion) => `- [ ] ${criterion}`),
    "",
    "## Deliverables",
    ...phase.deliverables.map((deliverable) => `- [ ] ${deliverable}`),
    "",
    "## Export targets",
    ...phase.exportTargets.map((target) => `- ${target}`),
  ].join("\n");
}

export type CreateWorkflowProjectOptions = Readonly<{
  title?: string;
  createdAt?: string;
  idSeed?: string;
}>;

export function createWorkflowProject(
  templateId: WorkflowTemplateId,
  options: CreateWorkflowProjectOptions = {},
): KingxfordProject {
  const template = workflowTemplateById(templateId);
  const createdAt = options.createdAt ?? new Date().toISOString();
  const title = options.title?.trim() || template.projectTitle;
  let project = createKingxfordProject({
    title,
    summary: template.projectSummary,
    activePhase: "discovery",
    createdAt,
    idSeed: options.idSeed ?? `${workflowSource(templateId)}:${title}:${createdAt}`,
  });

  project = upsertProjectNode(project, {
    key: "workflow-template",
    kind: "constraint",
    phase: "discovery",
    label: `${template.name} workflow`,
    statement: "This project follows one connected six-phase Atlas workflow. Templates guide work but do not approve gates or submit content to any external service.",
    status: "known",
    sourceRef: workflowSource(templateId),
    recordedAt: createdAt,
  });
  project = upsertProjectNode(project, {
    key: "project-problem",
    kind: "problem",
    phase: "discovery",
    label: template.shortName,
    statement: template.projectSummary,
    status: "unresolved",
    sourceRef: workflowSource(templateId, ":problem"),
    recordedAt: createdAt,
  });

  let discoveryArtifactId: string | null = null;
  for (const phase of template.phases) {
    project = appendArtifactRevision(project, {
      kind: phase.artifact.kind,
      phase: phase.phase,
      title: `${title} · ${phase.artifact.title}`,
      body: textRevisionBody(phaseArtifactBody(template, phase)),
      source: "human",
      createdAt,
    });
    if (phase.phase === "discovery") discoveryArtifactId = project.activeArtifactId;

    project = upsertProjectNode(project, {
      key: `evidence-threshold:${phase.phase}`,
      kind: "constraint",
      phase: phase.phase,
      label: `${phase.evidence.minimumItems} evidence items required`,
      statement: phase.evidence.rule,
      status: "unresolved",
      sourceRef: workflowSource(templateId, `:threshold:${phase.phase}`),
      recordedAt: createdAt,
    });
    for (const [index, criterion] of phase.gate.criteria.entries()) {
      project = upsertProjectNode(project, {
        key: `gate-criterion:${phase.phase}:${index}`,
        kind: "test",
        phase: phase.phase,
        label: `${phase.gate.title} · criterion ${index + 1}`,
        statement: criterion,
        status: "unresolved",
        sourceRef: workflowSource(templateId, `:gate:${phase.phase}`),
        recordedAt: createdAt,
      });
    }
    for (const [index, deliverable] of phase.deliverables.entries()) {
      project = upsertProjectNode(project, {
        key: `deliverable:${phase.phase}:${index}`,
        kind: "deliverable",
        phase: phase.phase,
        label: deliverable,
        statement: `Required ${phase.phase} output for the ${template.name} workflow.`,
        status: "unresolved",
        sourceRef: workflowSource(templateId, `:deliverable:${phase.phase}`),
        recordedAt: createdAt,
      });
    }
  }

  const gateTitles = new Map(template.phases.map((phase) => [phase.phase, phase.gate.title]));
  const retitledGates = project.gates.map((gate) => ({
    ...gate,
    title: gateTitles.get(gate.phase) ?? gate.title,
  }));
  const gateTitleById = new Map(retitledGates.map((gate) => [gate.id, gate.title]));

  return parseKingxfordProject({
    ...project,
    activePhase: "discovery",
    activeArtifactId: discoveryArtifactId,
    updatedAt: createdAt,
    gates: retitledGates,
    nodes: project.nodes.map((node) => node.kind === "gate"
      ? { ...node, label: gateTitleById.get(node.refId) ?? node.label }
      : node),
  });
}

export function workflowTemplateForProject(project: KingxfordProject) {
  const marker = project.nodes.find((node) =>
    node.sourceRef?.startsWith(workflowSourcePrefix)
    && node.sourceRef.split(":").length === 4);
  if (!marker?.sourceRef) return null;
  const id = marker.sourceRef.slice(workflowSourcePrefix.length);
  return isWorkflowTemplateId(id) ? workflowTemplateById(id) : null;
}

export type WorkflowPhaseReadiness = Readonly<{
  templateId: WorkflowTemplateId;
  phase: ProjectPhase;
  evidenceCount: number;
  minimumEvidence: number;
  evidenceThresholdMet: boolean;
  gateTitle: string;
  gateCriteria: readonly string[];
  deliverables: readonly string[];
  exportTargets: readonly string[];
}>;

export function workflowPhaseReadiness(
  project: KingxfordProject,
  phase: ProjectPhase,
): WorkflowPhaseReadiness | null {
  const template = workflowTemplateForProject(project);
  const definition = template?.phases.find((candidate) => candidate.phase === phase);
  if (!template || !definition) return null;
  const evidenceCount = project.artifacts.filter(
    (artifact) => artifact.kind === "evidence" && artifact.phase === phase,
  ).length;
  return {
    templateId: template.id,
    phase,
    evidenceCount,
    minimumEvidence: definition.evidence.minimumItems,
    evidenceThresholdMet: evidenceCount >= definition.evidence.minimumItems,
    gateTitle: definition.gate.title,
    gateCriteria: definition.gate.criteria,
    deliverables: definition.deliverables,
    exportTargets: definition.exportTargets,
  };
}
