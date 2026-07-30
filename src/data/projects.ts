export type ProjectCategory =
  | "AI Experience"
  | "Brand & Visual"
  | "Digital Product"
  | "Education"
  | "Research & Data"
  | "Web Experience";

export type ProjectChapter = Readonly<{
  eyebrow: string;
  title: string;
  body: string;
}>;

export type Project = Readonly<{
  slug: string;
  title: string;
  eyebrow: string;
  year: string;
  categories: readonly ProjectCategory[];
  summary: string;
  statement: string;
  cover: string;
  coverAlt: string;
  accent: string;
  featured: boolean;
  role: readonly string[];
  liveUrl?: string;
  repoUrl?: string;
  challenge: string;
  approach: readonly string[];
  outcome: string;
  chapters: readonly ProjectChapter[];
  related: readonly string[];
}>;

export const projects: readonly Project[] = [
  {
    slug: "kisuyo",
    title: "KISUYO",
    eyebrow: "The AI atelier",
    year: "2026",
    categories: ["Digital Product", "AI Experience", "Web Experience"],
    summary:
      "A wardrobe-aware fashion platform that moves from a real closet and event context to complete looks, virtual try-on, and motion.",
    statement: "Never wonder what to wear again.",
    cover: "/work/kisuyo-studio-real.webp",
    coverAlt:
      "Documentary photograph of a fashion model, photographer, and lighting setup during a real studio shoot",
    accent: "#315dff",
    featured: true,
    role: [
      "Product strategy",
      "Experience architecture",
      "Visual direction",
      "Full-stack product design",
    ],
    liveUrl: "https://fashion-production-001b.up.railway.app/",
    challenge:
      "Getting dressed is not a single recommendation problem. It depends on what someone owns, the event, weather, formality, personal style, garment condition, and how confidently the final look can be understood before it is worn.",
    approach: [
      "Treat the user’s actual wardrobe as the system of record, with garment attributes, wear history, laundry state, and cost-per-wear.",
      "Translate event context into a legible dress-code ladder, then score complete outfits against formality, colour, climate, and wardrobe rotation.",
      "Connect recommendation, model rendering, virtual try-on, runway motion, planning, and the lookbook as one continuous atelier journey.",
      "Design useful keyless fallbacks so the essential experience remains understandable even before external generation providers are connected.",
    ],
    outcome:
      "A working multi-user fashion product that connects the closet, event atlas, AI stylist, generation studio, trip planning, outfit calendar, lookbook, and gap-filling boutique without losing the thread between them.",
    chapters: [
      {
        eyebrow: "01 · Foundation",
        title: "The closet is the intelligence",
        body:
          "Recommendations begin with named garments the user already owns. That constraint makes the experience more personal, more economical, and easier to trust.",
      },
      {
        eyebrow: "02 · Context",
        title: "A dress code becomes a decision system",
        body:
          "Event, venue, weather, time, and role are translated into concrete guidance rather than an opaque style verdict.",
      },
      {
        eyebrow: "03 · Confidence",
        title: "From suggestion to seeing it move",
        body:
          "Editorial renders, try-on, and short motion studies help bridge the gap between an outfit recommendation and the confidence to wear it.",
      },
    ],
    related: ["aceplore", "elkings-college"],
  },
  {
    slug: "king-uml",
    title: "Glyph",
    eyebrow: "King-UML · Research diagramming studio",
    year: "2026",
    categories: ["Digital Product", "Research & Data", "AI Experience"],
    summary:
      "A multi-engine studio for turning code, data, and research logic into publication-ready diagrams across technical disciplines.",
    statement: "Complex knowledge, made visible.",
    cover: "/work/king-uml-live.webp",
    coverAlt:
      "Live Glyph interface showing a prompt-driven architecture diagram and visual editing canvas",
    accent: "#315dff",
    featured: true,
    role: [
      "Product vision",
      "Interaction design",
      "Information architecture",
      "Visual systems",
    ],
    liveUrl: "https://king-uml.vercel.app/studio",
    challenge:
      "Research diagrams span radically different grammars—from causal models and UML to statistical graphics and scientific notation. The interface needed to support that breadth without feeling like a disconnected toolbox.",
    approach: [
      "Organise multiple rendering grammars around the user’s intent rather than the implementation details of each engine.",
      "Keep source and visual output in a tight editing loop, with templates that provide a credible starting structure.",
      "Design export, attribution, and publication workflows as first-class parts of the studio.",
      "Create a consistent visual language across diagrams that may be rendered by very different underlying systems.",
    ],
    outcome:
      "A live diagramming environment that brings research, engineering, scientific, and systems-visualisation workflows into one focused studio with editable source and export-ready output.",
    chapters: [
      {
        eyebrow: "01 · Grammar",
        title: "Many engines, one mental model",
        body:
          "The experience abstracts away engine switching so people can concentrate on the structure they need to communicate.",
      },
      {
        eyebrow: "02 · Practice",
        title: "Templates shaped by real research",
        body:
          "PRISMA flows, causal diagrams, ontologies, requirements, pathways, and other specialist structures sit beside familiar UML and data graphics.",
      },
      {
        eyebrow: "03 · Output",
        title: "Built for the final document",
        body:
          "Preview, refinement, and export are treated as a single workflow so the result can move cleanly into papers, reports, and presentations.",
      },
    ],
    related: ["ccai-global", "megaproject-intelligence"],
  },
  {
    slug: "ccai-global",
    title: "CCAI Global",
    eyebrow: "Corruption analytics + ontology",
    year: "2026",
    categories: ["Research & Data", "Web Experience"],
    summary:
      "A research interface and knowledge system for modelling corruption as connected events across the complete project lifecycle.",
    statement: "Trace the system, not just the incident.",
    cover: "/work/ccai-global-live.webp",
    coverAlt:
      "Live CCAI Global interface introducing a research platform for corruption analytics",
    accent: "#315dff",
    featured: true,
    role: [
      "Research direction",
      "Knowledge architecture",
      "Data experience design",
      "Digital publication",
    ],
    liveUrl: "https://ccai.global/",
    repoUrl: "https://github.com/Emmanuelok/corpm-onto",
    challenge:
      "Corruption in projects is usually described as a list of acts. That makes it difficult to see how actors, roles, opportunities, lifecycle stages, evidence, impacts, red flags, and controls connect.",
    approach: [
      "Model corruption as an event-centred network spanning actors, vulnerabilities, acts, affected processes, evidence, impacts, and responses.",
      "Build the knowledge layer with modular OWL/RDF, SHACL validation, competency questions, and reusable SPARQL queries.",
      "Translate the ontology into an explorable public experience for researchers, auditors, project teams, and integrity practitioners.",
      "Keep synthetic cases visibly separated from sourced evidence and make ethical-use boundaries part of the product.",
    ],
    outcome:
      "A public-facing research platform backed by a reusable ontology project, validation workflow, query library, synthetic examples, documentation, and a Python command-line interface.",
    chapters: [
      {
        eyebrow: "01 · Ontology",
        title: "Corruption as a connected event",
        body:
          "The core model links who acted, the role they occupied, the opportunity they encountered, what happened, where it affected the project, and how it may be detected or controlled.",
      },
      {
        eyebrow: "02 · Evidence",
        title: "Questions become executable",
        body:
          "Competency questions and SPARQL turn conceptual coverage into queries that can be tested, repeated, and extended.",
      },
      {
        eyebrow: "03 · Interface",
        title: "A knowledge graph people can enter",
        body:
          "The digital experience makes a formal research asset approachable without flattening its uncertainty or governance boundaries.",
      },
    ],
    related: ["king-uml", "megaproject-intelligence"],
  },
  {
    slug: "aceplore",
    title: "Aceplore",
    eyebrow: "Digital tools for real work",
    year: "2026",
    categories: ["Digital Product", "Education", "Brand & Visual"],
    summary:
      "A coherent platform of focused digital tools designed to help students and professionals move from a difficult task to a clear result.",
    statement: "Less friction between the question and the work.",
    cover: "/work/aceplore-real.webp",
    coverAlt:
      "Documentary photograph of a designer refining an architectural model at a working studio desk",
    accent: "#315dff",
    featured: false,
    role: [
      "Platform concept",
      "Brand direction",
      "Product design",
      "Creative direction",
    ],
    liveUrl: "https://aceplore.com/",
    challenge:
      "Students and professionals often assemble a patchwork of generic tools for tasks that have a very specific beginning, workflow, and definition of done. The resulting friction sits between intention and useful output.",
    approach: [
      "Frame tools around recognisable user jobs rather than technical feature categories.",
      "Create a shared interaction and visual system so each utility feels like part of the same working environment.",
      "Use plain language, progressive disclosure, and strong defaults to shorten the path to a first useful result.",
      "Position the brand around capable, everyday problem solving rather than abstract technology.",
    ],
    outcome:
      "A live platform and brand system that presents a growing collection of student and professional utilities as one approachable digital workbench.",
    chapters: [
      {
        eyebrow: "01 · Position",
        title: "Start with the task",
        body:
          "The product speaks first about what someone is trying to finish, making the value of each tool immediately legible.",
      },
      {
        eyebrow: "02 · System",
        title: "Distinct tools, shared behaviour",
        body:
          "Common patterns for input, guidance, output, and refinement create continuity across otherwise different workflows.",
      },
      {
        eyebrow: "03 · Brand",
        title: "Intelligence without theatre",
        body:
          "The visual direction keeps the platform ambitious while grounding it in relatable work, real people, and visible progress.",
      },
    ],
    related: ["elkings-college", "kisuyo"],
  },
  {
    slug: "megaproject-intelligence",
    title: "Megaproject Performance Intelligence",
    eyebrow: "COMPSIS · Decision intelligence",
    year: "2026",
    categories: ["Research & Data", "Digital Product"],
    summary:
      "A browser-based system that turns project evidence into an auditable success index, benchmark, trajectory, and intervention view.",
    statement: "Make performance evidence answerable.",
    cover: "/work/megaproject-intelligence-real.webp",
    coverAlt:
      "Documentary photograph of an arched bridge under construction across a wide river",
    accent: "#315dff",
    featured: true,
    role: [
      "Research translation",
      "Systems design",
      "Data visualisation",
      "Product architecture",
    ],
    challenge:
      "Megaproject success is multidimensional, evidence quality varies, and like-for-like comparison is difficult. A useful product has to expose the assumptions behind a composite score rather than presenting an unexplained dashboard number.",
    approach: [
      "Operationalise the research model as 27 KPIs across seven weighted success domains with evidence-adjusted confidence.",
      "Connect assessment, certification, empirical benchmarking, trajectory, uncertainty, and intervention planning in one governed workflow.",
      "Use purpose-built, accessible SVG visualisations for gauges, trends, distributions, sensitivity, and domain balance.",
      "Keep the browser-based workspace portable with validated import and export, local persistence, and explicit research caveats.",
    ],
    outcome:
      "A working decision-support platform with an auditable Megaproject Performance & Success Index, Fuzzy Delphi lab, benchmark database, trajectory and early-warning views, uncertainty analytics, and role-based assessment workflow.",
    chapters: [
      {
        eyebrow: "01 · Measure",
        title: "An index that shows its workings",
        body:
          "Every composite result retains its domain weights, evidence coverage, confidence, and classification context.",
      },
      {
        eyebrow: "02 · Compare",
        title: "Benchmarks with honest boundaries",
        body:
          "Empirical percentiles, cohort filters, and small-sample warnings keep comparison useful without pretending to have more evidence than the dataset provides.",
      },
      {
        eyebrow: "03 · Act",
        title: "From score to intervention",
        body:
          "Trend, uncertainty, sensitivity, and a prioritised intervention portfolio turn retrospective assessment into a forward-looking management conversation.",
      },
    ],
    related: ["ccai-global", "value-m"],
  },
  {
    slug: "nkosuo",
    title: "Nkosuo",
    eyebrow: "Market intelligence · Evidence-led investing",
    year: "2026",
    categories: ["Research & Data", "Digital Product", "Education"],
    summary:
      "A mobile-minded market intelligence and learning experience built around transparency, context, and data provenance.",
    statement: "Every number needs a source, a timestamp, and context.",
    cover: "/work/nkosuo-live.webp",
    coverAlt:
      "Live Nkosuo interface introducing a market intelligence and learning platform",
    accent: "#315dff",
    featured: true,
    role: [
      "Product strategy",
      "Financial information design",
      "UX writing",
      "Visual direction",
    ],
    challenge:
      "Investors and learners need meaningful market context, yet exchange data has licensing and freshness constraints. The interface needed to be useful without implying that illustrative or delayed information was live advice.",
    approach: [
      "Make source, freshness, instrument, and information-only boundaries visible wherever market data appears.",
      "Bring listed equities, fixed-income instruments, business news, learning, watchlists, and portfolio views into a coherent information architecture.",
      "Design for mobile screens and constrained connections, with plain-language explanations close to the relevant data.",
      "Treat corrections, source attribution, and legal context as product features rather than footer material.",
    ],
    outcome:
      "A focused intelligence experience with market, portfolio, learning, source, and correction surfaces, designed to distinguish illustrative, delayed, and externally sourced information clearly.",
    chapters: [
      {
        eyebrow: "01 · Trust",
        title: "Freshness is part of the interface",
        body:
          "Labels for when information was updated and where it came from help users understand the limits of each market view.",
      },
      {
        eyebrow: "02 · Locality",
        title: "Designed around real market context",
        body:
          "The product foregrounds relevant instruments, currencies, institutions, language, and learning needs instead of adapting a generic global terminal.",
      },
      {
        eyebrow: "03 · Learning",
        title: "Context beside the number",
        body:
          "Plain-English education sits close to data and portfolio tools so users can understand what they are viewing without turning the product into an adviser.",
      },
    ],
    related: ["megaproject-intelligence", "aceplore"],
  },
  {
    slug: "elkings-college",
    title: "Elkings College",
    eyebrow: "Digital campus",
    year: "2026",
    categories: ["Education", "Digital Product", "Web Experience"],
    summary:
      "A controlled-preview digital campus spanning public discovery, curriculum, admissions, learning, records, and institution operations.",
    statement: "One coherent campus, from first discovery to lifelong learning.",
    cover: "/work/elkings-college-real.webp",
    coverAlt:
      "Documentary photograph of a university clock tower and campus architecture",
    accent: "#315dff",
    featured: true,
    role: [
      "Institutional experience strategy",
      "Service design",
      "Information architecture",
      "Product direction",
    ],
    liveUrl: "https://elkings-college.vercel.app/",
    challenge:
      "A school website, curriculum catalogue, learning environment, student information system, and institutional operations platform usually become separate products. The design challenge was to make them feel like one campus while keeping sensitive workflows governed.",
    approach: [
      "Create a shared architecture across Primary, Junior High, Senior High, and College journeys.",
      "Connect public discovery and curriculum exploration to admissions and role-aware campus workspaces.",
      "Use explicit preview, governance, privacy, safeguarding, and readiness boundaries instead of implying unfinished provider integrations are live.",
      "Design reusable patterns for dense academic information, service workflows, and many user roles.",
    ],
    outcome:
      "A live controlled preview with a substantial public curriculum catalogue, admissions and contact foundations, role-scoped campus workspaces, and governed academic, records, scheduling, learning, finance, and operations domains.",
    chapters: [
      {
        eyebrow: "01 · Continuity",
        title: "A campus, not a collection of portals",
        body:
          "The public site and protected workspaces share a consistent institutional language so transitions between discovery and participation feel intentional.",
      },
      {
        eyebrow: "02 · Curriculum",
        title: "Depth without losing orientation",
        body:
          "Level maps, subjects, courses, pathways, and governance labels help people move through a large academic catalogue while understanding what is official, proposed, or institution-authored.",
      },
      {
        eyebrow: "03 · Responsibility",
        title: "Readiness is visible",
        body:
          "Controlled-preview labels and fail-closed boundaries make operational, privacy, identity, safeguarding, and provider dependencies part of the product’s truth.",
      },
    ],
    related: ["aceplore", "kisuyo"],
  },
  {
    slug: "value-m",
    title: "Value-M",
    eyebrow: "Value management intelligence",
    year: "2026",
    categories: ["Digital Product", "Research & Data", "AI Experience"],
    summary:
      "A unified workspace for the complete SAVE International Job Plan, held together by one value graph and an explainable agent layer.",
    statement: "One study. One value thread. Every decision connected.",
    cover: "/work/value-m-real.webp",
    coverAlt:
      "Documentary photograph of architectural drawings and a physical building model on a studio table",
    accent: "#315dff",
    featured: false,
    role: [
      "Domain product strategy",
      "Workflow architecture",
      "Decision experience design",
      "Visual systems",
    ],
    liveUrl: "https://value-m.vercel.app/",
    challenge:
      "Value management studies create costs, functions, ideas, alternatives, proposals, risks, approvals, and implementation actions across many phases. When these live in separate tools, the reasoning chain is easily broken.",
    approach: [
      "Model every study entity in a connected value graph with upstream and downstream provenance.",
      "Run the full Pre-Study, Study, and Post-Study workflow on a shared live state rather than isolated calculators.",
      "Use deterministic intelligence for study health, broken links, savings progression, and next-best actions, with optional AI assistance.",
      "Require agent suggestions to be reviewed and approved, then record applied actions in a governance ledger.",
    ],
    outcome:
      "A live end-to-end value management platform covering the full Job Plan with connected phase studios, calculation and decision tools, value-thread diagnostics, agent guidance, reporting, governance, and implementation tracking.",
    chapters: [
      {
        eyebrow: "01 · Thread",
        title: "Every decision keeps its provenance",
        body:
          "Costs connect to functions, functions to ideas, ideas to proposals, and proposals to actions and realised value—making gaps visible.",
      },
      {
        eyebrow: "02 · Method",
        title: "The complete Job Plan in one state",
        body:
          "Each phase has specialist tools, but all of them read and write the same study so progress remains coherent.",
      },
      {
        eyebrow: "03 · Intelligence",
        title: "Agents that propose, people who decide",
        body:
          "The intelligence layer surfaces assessments and next moves while approval gates preserve human ownership of consequential changes.",
      },
    ],
    related: ["megaproject-intelligence", "king-uml"],
  },
];

export const projectCategories: readonly ProjectCategory[] = Array.from(
  new Set(projects.flatMap((project) => project.categories)),
);

export const featuredProjects = projects.filter((project) => project.featured);

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}
