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
  status: "published" | "unreleased";
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
  challenge: string;
  approach: readonly string[];
  outcome: string;
  chapters: readonly ProjectChapter[];
  related: readonly string[];
}>;

const projectArchive: readonly Project[] = [
  {
    slug: "veridanth",
    status: "published",
    title: "Veridanth",
    eyebrow: "Intelligent consultancy · Connected tools",
    year: "2026",
    categories: ["Digital Product", "AI Experience", "Web Experience"],
    summary:
      "A connected consultancy and digital-tools platform that moves ambitious work from one brief to the right workflow, specialist, and deliverable.",
    statement: "One brief. The right tools and team already in motion.",
    cover: "/work/veridanth-product-evidence-v3.webp",
    coverAlt:
      "Editorial arrangement made only from authentic Veridanth interface captures, showing the live navigation, proposition, and co-pilot environment.",
    accent: "#6657e8",
    featured: true,
    role: [
      "Platform strategy",
      "Service architecture",
      "AI workflow design",
      "Visual direction",
    ],
    liveUrl: "https://www.veridanth.com/",
    challenge:
      "A broad consultancy can easily become a directory of disconnected services. The platform needed one shared context layer that could understand a goal, route it intelligently, and preserve continuity as work moved between tools and people.",
    approach: [
      "Make a single project brief reusable across the platform so people do not have to repeatedly explain the same ambition.",
      "Route work by intent, readiness, and required expertise instead of asking users to choose from an abstract catalogue.",
      "Connect intelligent studios, project workspaces, specialist matching, and human handoffs as one continuous service journey.",
      "Keep milestones, authorship, responsibility, and delivery state visible as the work progresses.",
    ],
    outcome:
      "A live platform connecting consultancy services, intelligent studios, project routing, and workspace continuity in one coherent experience.",
    chapters: [
      {
        eyebrow: "01 · Context",
        title: "One brief becomes system memory",
        body:
          "The platform carries the goal, audience, constraints, and existing material forward so every tool and specialist can begin with useful context.",
      },
      {
        eyebrow: "02 · Continuity",
        title: "Tools hand work forward",
        body:
          "Outputs become inputs for the next stage, allowing research, writing, design, analysis, and delivery to behave like one connected practice.",
      },
      {
        eyebrow: "03 · Expertise",
        title: "Human judgement stays visible",
        body:
          "Intelligent assistance accelerates the work while specialist ownership, review, and handoff remain explicit throughout the project.",
      },
    ],
    related: ["psyche-atlas", "value-m"],
  },
  {
    slug: "psyche-atlas",
    status: "published",
    title: "Psyche Atlas",
    eyebrow: "Personality assessment · Reflective intelligence",
    year: "2026",
    categories: ["Digital Product", "Education", "Web Experience"],
    summary:
      "A privacy-minded self-reflection platform that turns a deep, source-referenced assessment library into a guided, searchable experience with growth-oriented reporting.",
    statement:
      "A map for reflection—structured, personal, and careful about what a test can and cannot say.",
    cover: "/work/psyche-atlas-product-evidence-v3.webp",
    coverAlt:
      "Authentic Psyche Atlas interface showing the research-led assessment proposition and guided starting points.",
    accent: "#c6934e",
    featured: true,
    role: [
      "Experience strategy",
      "Information architecture",
      "Assessment UX",
      "Editorial direction",
    ],
    liveUrl: "https://personality-tests-six.vercel.app/",
    challenge:
      "A large assessment library can quickly feel repetitive or overwhelming. The experience needed to make exploration coherent and approachable without blurring educational self-reflection into clinical diagnosis.",
    approach: [
      "Use optional onboarding and guided packs to create a clear first step without making an account a prerequisite.",
      "Organise discovery through thematic navigation, search, and transparent time, item, factor, and source metadata.",
      "Keep responses on-device and make privacy, language, and display controls part of the primary experience.",
      "Frame sensitive screens as prompts for insight and support rather than diagnoses or substitutes for professional care.",
    ],
    outcome:
      "A live assessment experience spanning personality, relationships, career, wellbeing, and learning—designed for self-reflection, not clinical diagnosis.",
    chapters: [
      {
        eyebrow: "01 · Orientation",
        title: "Depth without the maze",
        body:
          "Guided entry points and thematic browsing let people begin with a question that matters to them instead of confronting an undifferentiated test catalogue.",
      },
      {
        eyebrow: "02 · Transparency",
        title: "The shape of every assessment is visible",
        body:
          "Time, item count, factors, and cited-source context appear before someone begins, making the commitment and basis of each experience easier to understand.",
      },
      {
        eyebrow: "03 · Care",
        title: "Reflection with clear boundaries",
        body:
          "The product stays useful and personal while explicitly distinguishing self-understanding from medical or clinical assessment.",
      },
    ],
    related: ["veridanth", "grandmaster"],
  },
  {
    slug: "ccai-global",
    status: "unreleased",
    title: "CCAI Global",
    eyebrow: "Corruption analytics + ontology",
    year: "2026",
    categories: ["Research & Data", "Web Experience"],
    summary:
      "A research interface and knowledge system for modelling corruption as connected events across the complete project lifecycle.",
    statement: "Trace the system, not just the incident.",
    cover: "/work/ccai-global-evidence-v2.webp",
    coverAlt:
      "Editorial composite preserving a live CCAI Global research-atlas interface within a forensic infrastructure evidence system; the surrounding imagery is illustrative.",
    accent: "#315dff",
    featured: true,
    role: [
      "Research direction",
      "Knowledge architecture",
      "Data experience design",
      "Digital publication",
    ],
    liveUrl: "https://ccai.global/",
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
    related: ["value-m", "veridanth"],
  },
  {
    slug: "aceplore",
    status: "unreleased",
    title: "Aceplore",
    eyebrow: "Digital tools for real work",
    year: "2026",
    categories: ["Digital Product", "Education", "Brand & Visual"],
    summary:
      "A coherent platform of focused digital tools designed to help students and professionals move from a difficult task to a clear result.",
    statement: "Less friction between the question and the work.",
    cover: "/work/aceplore-evidence-v2.webp",
    coverAlt:
      "Editorial composite preserving the live Aceplore interface within a modular industrial workbench; the surrounding imagery is illustrative.",
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
    related: ["veridanth", "psyche-atlas"],
  },
  {
    slug: "grandmaster",
    status: "published",
    title: "GrandMaster",
    eyebrow: "AI game centre · Strategy and learning",
    year: "2026",
    categories: ["Digital Product", "AI Experience", "Education"],
    summary:
      "An intelligent multi-game strategy centre combining adaptive opponents, playable 2D and 3D boards, plain-language move coaching, and post-game review.",
    statement: "Every move becomes a lesson, not just a result.",
    cover: "/work/grandmaster-product-evidence-v3.webp",
    coverAlt:
      "Authentic GrandMaster product interface showing its strategy-game catalogue, tutor proposition, and learning navigation.",
    accent: "#7758ff",
    featured: true,
    role: [
      "Product strategy",
      "Game experience design",
      "Learning-system architecture",
      "Visual direction",
    ],
    liveUrl: "https://boardgames-peach.vercel.app/",
    challenge:
      "A broad library of classic strategy games needed one coherent interface, while engine feedback had to become guidance that learners could understand rather than a stream of opaque scores.",
    approach: [
      "Use skill-level onboarding to tune the first opponent and make the experience welcoming across different levels of play.",
      "Translate move quality into plain-language explanations that help people understand what changed and why.",
      "Connect quick play, daily challenges, openings, puzzles, reviews, and profile progress as one learning journey.",
      "Support both clear 2D play and expressive 3D presentation, with visual themes that let the game space feel personal.",
    ],
    outcome:
      "A live strategy-learning platform unifying play, practice, analysis, and visual customisation across a broad board-game library.",
    chapters: [
      {
        eyebrow: "01 · Play",
        title: "Many games, one clear home",
        body:
          "A shared navigation and card system lets different rulesets feel like parts of the same product without erasing their individual character.",
      },
      {
        eyebrow: "02 · Learn",
        title: "The engine explains itself",
        body:
          "Move grading is paired with plain-language reasoning so feedback becomes a lesson a player can use in the next position.",
      },
      {
        eyebrow: "03 · Review",
        title: "A match becomes a learning record",
        body:
          "Post-game review connects accuracy, evaluation, and the move sequence, making improvement visible beyond the final result.",
      },
    ],
    related: ["psyche-atlas", "veridanth"],
  },
  {
    slug: "nkosuo",
    status: "unreleased",
    title: "Nkosuo",
    eyebrow: "Market intelligence · Evidence-led investing",
    year: "2026",
    categories: ["Research & Data", "Digital Product", "Education"],
    summary:
      "A mobile-minded market intelligence and learning experience built around transparency, context, and data provenance.",
    statement: "Every number needs a source, a timestamp, and context.",
    cover: "/work/nkosuo-evidence-v2.webp",
    coverAlt:
      "Editorial composite incorporating an authentic Nkosuo interface fragment within layered market-provenance materials; the surrounding imagery is illustrative.",
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
    related: ["veridanth", "aceplore"],
  },
  {
    slug: "elkings-college",
    status: "unreleased",
    title: "Elkings College",
    eyebrow: "Digital campus",
    year: "2026",
    categories: ["Education", "Digital Product", "Web Experience"],
    summary:
      "A controlled-preview digital campus spanning public discovery, curriculum, admissions, learning, records, and institution operations.",
    statement: "One coherent campus, from first discovery to lifelong learning.",
    cover: "/work/elkings-college-evidence-v2.webp",
    coverAlt:
      "Editorial composite preserving a live Elkings College campus-workspace interface within an architectural campus continuum; the surrounding imagery is illustrative.",
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
    related: ["aceplore", "psyche-atlas"],
  },
  {
    slug: "value-m",
    status: "published",
    title: "Value-M",
    eyebrow: "Value management intelligence",
    year: "2026",
    categories: ["Digital Product", "Research & Data", "AI Experience"],
    summary:
      "A unified workspace for the complete SAVE International Job Plan, held together by one value graph and an explainable agent layer.",
    statement: "One study. One value thread. Every decision connected.",
    cover: "/work/value-m-real.webp",
    coverAlt:
      "Documentary photograph of architectural plans, material samples, and a scale model used as contextual imagery for evidence-led value decisions.",
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
    related: ["veridanth", "grandmaster"],
  },
];

/**
 * The public project collection. Unreleased case studies remain in the archive
 * above so they can be launched deliberately without leaking into navigation,
 * search, related work, metadata, sitemaps, or generated routes.
 */
export const projects: readonly Project[] = projectArchive.filter(
  (project) => project.status === "published",
);

export const projectCategories: readonly ProjectCategory[] = Array.from(
  new Set(projects.flatMap((project) => project.categories)),
);

export const featuredProjects = projects.filter((project) => project.featured);

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}
