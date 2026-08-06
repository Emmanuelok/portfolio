export type CreationCategory =
  | "websites"
  | "digital-tools"
  | "institutional-systems"
  | "research-ai-tools"
  | "operational-tools"
  | "education-tools"
  | "personal-tools";

export type CreationAudience =
  | "Businesses"
  | "Educational institutions"
  | "Finance organizations"
  | "Individuals and communities"
  | "Public and civic institutions"
  | "Research and scientific organizations";

export type CreationCta = Readonly<{
  label: string;
  href: string;
}>;

export type CreationCatalogueItem = Readonly<{
  slug: CreationCategory;
  index: string;
  name: string;
  eyebrow: string;
  thesis: string;
  overview: string;
  audiences: readonly CreationAudience[];
  capabilities: readonly string[];
  exampleNeeds: readonly string[];
  cta: CreationCta;
}>;

export type ShowcaseSector =
  | "Education"
  | "Finance"
  | "Scientific research";

export type ShowcaseModule = Readonly<{
  name: string;
  purpose: string;
  sampleContent: string;
}>;

export type ShowcasePalette = Readonly<{
  background: string;
  surface: string;
  primary: string;
  accent: string;
  text: string;
  muted: string;
}>;

export type WebsiteShowcase = Readonly<{
  slug: string;
  status: "concept-demonstration";
  name: string;
  sector: ShowcaseSector;
  eyebrow: string;
  thesis: string;
  overview: string;
  audience: string;
  capabilities: readonly string[];
  interfaceModules: readonly ShowcaseModule[];
  theme: Readonly<{
    mode: "dark" | "light";
    palette: ShowcasePalette;
    typography: string;
    visualDirection: string;
  }>;
  previewHref: string;
  cta: CreationCta;
  disclosure: string;
}>;

export const creationCatalogue: readonly CreationCatalogueItem[] = [
  {
    slug: "websites",
    index: "01",
    name: "Websites and digital destinations",
    eyebrow: "Strategy · Design · Development",
    thesis: "Turn a complex organization into a clear, credible digital experience.",
    overview:
      "Research-led websites for institutions, companies, laboratories, schools, public initiatives, and independent practices—designed around the decisions visitors need to make.",
    audiences: [
      "Businesses",
      "Educational institutions",
      "Finance organizations",
      "Research and scientific organizations",
      "Public and civic institutions",
    ],
    capabilities: [
      "Digital strategy and information architecture",
      "Editorial, data, and service design",
      "Responsive interface development",
      "Accessible component systems",
      "Content operations and publishing workflows",
      "Performance, analytics, and governance planning",
    ],
    exampleNeeds: [
      "Institutional website",
      "Research programme portal",
      "Service and product platform",
      "Publication or knowledge hub",
      "Campaign or initiative microsite",
    ],
    cta: { label: "Explore website concepts", href: "/create#websites" },
  },
  {
    slug: "digital-tools",
    index: "02",
    name: "Digital tools",
    eyebrow: "Focused utilities · Better decisions",
    thesis: "Replace repeated friction with a tool shaped around the actual task.",
    overview:
      "Purpose-built calculators, planners, analyzers, generators, trackers, and guided workflows for work that is too important or specific for a generic template.",
    audiences: [
      "Businesses",
      "Educational institutions",
      "Individuals and communities",
      "Research and scientific organizations",
    ],
    capabilities: [
      "Workflow and requirements mapping",
      "Interactive calculators and scenario tools",
      "Structured input and validation systems",
      "Import, export, reporting, and audit trails",
      "Human-readable guidance and error recovery",
      "Privacy-conscious local and cloud architectures",
    ],
    exampleNeeds: [
      "Decision calculator",
      "Document and report builder",
      "Planning or comparison tool",
      "Data collection workspace",
      "Self-service assessment",
    ],
    cta: { label: "Discuss a digital tool", href: "/contact?brief=digital-tool" },
  },
  {
    slug: "institutional-systems",
    index: "03",
    name: "Institutional systems",
    eyebrow: "Governance · Coordination · Evidence",
    thesis: "Make responsibility, evidence, and progress visible across the institution.",
    overview:
      "Connected systems for programmes, services, cases, approvals, knowledge, and reporting—built around institutional roles, controls, and operating realities.",
    audiences: [
      "Educational institutions",
      "Finance organizations",
      "Public and civic institutions",
      "Research and scientific organizations",
    ],
    capabilities: [
      "Role and permission architecture",
      "Case, programme, and portfolio workspaces",
      "Approval and review workflows",
      "Evidence registers and accountable records",
      "Management dashboards and reporting",
      "Integration and data-governance planning",
    ],
    exampleNeeds: [
      "Programme management system",
      "Governance and approval workflow",
      "Institutional knowledge base",
      "Service request portal",
      "Evidence and reporting environment",
    ],
    cta: {
      label: "Map an institutional system",
      href: "/contact?brief=institutional-system",
    },
  },
  {
    slug: "research-ai-tools",
    index: "04",
    name: "Research and AI tools",
    eyebrow: "Inquiry · Intelligence · Verification",
    thesis: "Use computation to strengthen inquiry while keeping evidence and judgement visible.",
    overview:
      "Research environments and responsibly designed AI-assisted tools for discovery, synthesis, modelling, evaluation, and knowledge translation.",
    audiences: [
      "Educational institutions",
      "Public and civic institutions",
      "Research and scientific organizations",
      "Businesses",
    ],
    capabilities: [
      "Research workflow and evidence architecture",
      "Source-linked retrieval and synthesis",
      "Knowledge graphs and structured taxonomies",
      "Human review and confidence signalling",
      "Model evaluation and responsible-use controls",
      "Reproducible analysis and export workflows",
    ],
    exampleNeeds: [
      "Evidence review workspace",
      "Research repository and explorer",
      "AI-assisted knowledge tool",
      "Ontology or knowledge-graph interface",
      "Evaluation and monitoring system",
    ],
    cta: { label: "Frame a research tool", href: "/contact?brief=research-ai" },
  },
  {
    slug: "operational-tools",
    index: "05",
    name: "Operational tools",
    eyebrow: "Workflows · Visibility · Control",
    thesis: "Give teams one dependable view of what is happening and what happens next.",
    overview:
      "Practical tools for coordinating requests, resources, schedules, risks, quality, suppliers, and delivery across everyday operations.",
    audiences: [
      "Businesses",
      "Educational institutions",
      "Public and civic institutions",
      "Research and scientific organizations",
    ],
    capabilities: [
      "Process and service-blueprint design",
      "Task, queue, and handoff management",
      "Inventory, asset, and resource visibility",
      "Risk, issue, and quality registers",
      "Operational dashboards and alerts",
      "Offline-capable field workflows",
    ],
    exampleNeeds: [
      "Operations dashboard",
      "Field inspection tool",
      "Resource and inventory tracker",
      "Request and case queue",
      "Project delivery workspace",
    ],
    cta: { label: "Improve an operation", href: "/contact?brief=operations" },
  },
  {
    slug: "education-tools",
    index: "06",
    name: "Education tools",
    eyebrow: "Learning · Practice · Feedback",
    thesis: "Design learning around purposeful practice, useful feedback, and visible progress.",
    overview:
      "Learning platforms and teaching tools for schools, universities, training teams, educators, and independent learners—with clear boundaries around assessment and credential claims.",
    audiences: [
      "Educational institutions",
      "Individuals and communities",
      "Businesses",
    ],
    capabilities: [
      "Curriculum and learning-journey mapping",
      "Interactive lessons and practice environments",
      "Assignment, rubric, and feedback workflows",
      "Resource libraries and study planners",
      "Progress views for learners and educators",
      "Accessibility and multilingual design planning",
    ],
    exampleNeeds: [
      "Course and learning platform",
      "Practice and revision tool",
      "Teaching resource library",
      "Programme application portal",
      "Learner project workspace",
    ],
    cta: { label: "Design a learning tool", href: "/contact?brief=education" },
  },
  {
    slug: "personal-tools",
    index: "07",
    name: "Everyday personal tools",
    eyebrow: "Clarity · Agency · Everyday life",
    thesis: "Make difficult everyday choices easier to understand and act on.",
    overview:
      "Thoughtful tools for individuals, families, and communities to organize information, compare options, plan projects, learn, and manage recurring responsibilities.",
    audiences: ["Individuals and communities"],
    capabilities: [
      "Plain-language interaction design",
      "Personal planning and reminder systems",
      "Comparison and decision workspaces",
      "Private records and document organization",
      "Guided checklists and repeatable routines",
      "Portable data and accessible exports",
    ],
    exampleNeeds: [
      "Personal project planner",
      "Household information organizer",
      "Study and learning companion",
      "Decision comparison tool",
      "Community resource guide",
    ],
    cta: { label: "Propose an everyday tool", href: "/contact?brief=personal-tool" },
  },
] as const;

export const websiteShowcases: readonly WebsiteShowcase[] = [
  {
    slug: "lumen-vale-laboratory",
    status: "concept-demonstration",
    name: "Lumen Vale Laboratory",
    sector: "Scientific research",
    eyebrow: "Fictional website concept · Scientific laboratory",
    thesis: "A laboratory website where methods, instruments, people, and evidence are legible.",
    overview:
      "A publication-led website concept for a multidisciplinary laboratory. It demonstrates how research themes, facilities, protocols, datasets, and collaboration enquiries could be organized without overstating findings or substituting presentation for scientific validation.",
    audience:
      "Research teams, scientific facilities, prospective collaborators, students, funders, and public-interest partners.",
    capabilities: [
      "Research programme and publication architecture",
      "Instrument and facility directory",
      "Protocol and dataset records",
      "People, expertise, and collaboration pathways",
      "Research integrity and data-governance notices",
    ],
    interfaceModules: [
      {
        name: "Research directory",
        purpose: "Connect themes, projects, methods, outputs, and responsible investigators.",
        sampleContent:
          "Synthetic project records created solely to demonstrate navigation; they are not scientific findings.",
      },
      {
        name: "Instrument access",
        purpose: "Explain facility capabilities, preparation requirements, and enquiry steps.",
        sampleContent:
          "Fictional equipment availability and specifications for interface demonstration only.",
      },
      {
        name: "Evidence record",
        purpose: "Present methods, versioned materials, limitations, and linked outputs together.",
        sampleContent:
          "Illustrative metadata and charts using synthetic values; no experimental or clinical claims.",
      },
    ],
    theme: {
      mode: "dark",
      palette: {
        background: "#071311",
        surface: "#10211d",
        primary: "#b8f3de",
        accent: "#46d6ab",
        text: "#f1f7f4",
        muted: "#8fa9a0",
      },
      typography: "Precise neo-grotesk with compact scientific labels and readable long-form text.",
      visualDirection:
        "Documentary laboratory photography, instrument detail, restrained data notation, and no speculative science imagery.",
    },
    previewHref: "/create/lumen-vale-laboratory",
    cta: { label: "Open the science demonstration", href: "/create/lumen-vale-laboratory" },
    disclosure:
      "Lumen Vale Laboratory is a fictional design demonstration. Its people, projects, equipment records, data, and findings are synthetic and do not represent a client or operating laboratory.",
  },
  {
    slug: "meridian-financial-office",
    status: "concept-demonstration",
    name: "Meridian Financial Office",
    sector: "Finance",
    eyebrow: "Fictional website concept · Finance institution",
    thesis: "A finance experience that makes mandate, risk, evidence, and accountability visible.",
    overview:
      "A sober institutional website concept for a financial analysis and advisory organization. The demonstration prioritizes transparent assumptions, scenario comparison, governance, and service clarity rather than promotional return language.",
    audience:
      "Finance organizations, institutional teams, enterprises, analysts, researchers, and prospective partners.",
    capabilities: [
      "Mandate, service, and governance architecture",
      "Research and market-intelligence publishing",
      "Scenario and risk communication",
      "Client enquiry and document workflows",
      "Methodology, disclosure, and data-source records",
    ],
    interfaceModules: [
      {
        name: "Scenario comparison",
        purpose: "Compare assumptions and show how a model responds when inputs change.",
        sampleContent:
          "Synthetic scenarios for interface demonstration only; not forecasts, advice, or indications of return.",
      },
      {
        name: "Research register",
        purpose: "Organize notes by topic, methodology, evidence date, author, and review status.",
        sampleContent:
          "Fictional publications and illustrative market data with no relationship to actual securities or clients.",
      },
      {
        name: "Governance record",
        purpose: "Surface review responsibilities, methodology versions, conflicts, and disclosures.",
        sampleContent:
          "Sample governance records provided only to demonstrate information architecture.",
      },
    ],
    theme: {
      mode: "light",
      palette: {
        background: "#f2f0e9",
        surface: "#ffffff",
        primary: "#122b3a",
        accent: "#b47a35",
        text: "#132129",
        muted: "#657078",
      },
      typography: "Editorial serif for analysis paired with a restrained grotesk for data and controls.",
      visualDirection:
        "Architectural workplace photography, paper and material detail, disciplined charts, and quiet institutional confidence.",
    },
    previewHref: "/create/meridian-financial-office",
    cta: { label: "Open the finance demonstration", href: "/create/meridian-financial-office" },
    disclosure:
      "Meridian Financial Office is a fictional design demonstration. It is not a registered financial institution or adviser; all organizations, services, portfolios, figures, and scenarios shown are synthetic and provide no financial advice or return claim.",
  },
  {
    slug: "commonfield-institute",
    status: "concept-demonstration",
    name: "Commonfield Institute",
    sector: "Education",
    eyebrow: "Fictional website concept · Educational institution",
    thesis: "An institutional website that connects learning, practice, research, and public contribution.",
    overview:
      "A modern educational website concept organized around programmes, studios, research, learner work, admissions information, and public resources. It demonstrates a clear institutional journey without making accreditation, ranking, employment, or learner-outcome claims.",
    audience:
      "Schools, colleges, universities, training organizations, learners, educators, families, and institutional partners.",
    capabilities: [
      "Programme and curriculum architecture",
      "Admissions and enquiry pathways",
      "Learning-resource and project publishing",
      "Research, events, and institutional news",
      "Accessible learner and educator service directories",
    ],
    interfaceModules: [
      {
        name: "Programme finder",
        purpose: "Compare learning aims, structure, modes, requirements, and next steps.",
        sampleContent:
          "Fictional programmes and entry information for navigation demonstration only; no accreditation is implied.",
      },
      {
        name: "Project workspace",
        purpose: "Show how projects, resources, critique, and reflective progress could connect.",
        sampleContent:
          "Sample learner work and progress records are synthetic and do not represent real people or outcomes.",
      },
      {
        name: "Public resource library",
        purpose: "Bring lectures, explainers, reading lists, and research summaries into one browsable space.",
        sampleContent:
          "Demonstration titles and metadata only; no publication, authorship, or institutional claims.",
      },
    ],
    theme: {
      mode: "light",
      palette: {
        background: "#f4f1ea",
        surface: "#fffdf8",
        primary: "#24356b",
        accent: "#e06d45",
        text: "#171b27",
        muted: "#70737c",
      },
      typography: "Warm humanist sans-serif with editorial display type for programme narratives.",
      visualDirection:
        "Documentary classrooms and workshops, tactile learning materials, generous daylight, and learner work presented with context.",
    },
    previewHref: "/create/commonfield-institute",
    cta: { label: "Open the education demonstration", href: "/create/commonfield-institute" },
    disclosure:
      "Commonfield Institute is a fictional design demonstration. It is not an operating or accredited educational institution; all programmes, people, projects, dates, and outcomes shown are synthetic.",
  },
] as const;
