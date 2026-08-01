export type MediaFormat = "Essay" | "Briefing" | "Podcast";

export type MediaAudio = Readonly<{
  src: string;
  mimeType: "audio/mpeg" | "audio/mp4" | "audio/ogg";
  durationLabel: string;
  narrator: string;
}>;

export type MediaPrinciple = Readonly<{
  title: string;
  body: string;
}>;

export type MediaSection = Readonly<{
  id: string;
  eyebrow: string;
  title: string;
  paragraphs: readonly string[];
  principles?: readonly MediaPrinciple[];
}>;

export type MediaPlanStage = Readonly<{
  range: string;
  title: string;
  focus: string;
  actions: readonly string[];
  result: string;
}>;

export type MediaActionPlan = Readonly<{
  id: string;
  eyebrow: string;
  title: string;
  introduction: string;
  stages: readonly MediaPlanStage[];
  resultLabel?: string;
}>;

export type MediaSource = Readonly<{
  title: string;
  organization: string;
  url: string;
  note: string;
}>;

export type MediaPost = Readonly<{
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  standfirst: string;
  format: MediaFormat;
  publishedAt: string;
  updatedAt: string;
  readingLabel: string;
  topics: readonly string[];
  cover: string;
  coverAlt: string;
  coverWidth?: number;
  coverHeight?: number;
  featured: boolean;
  audio?: MediaAudio;
  introduction: readonly string[];
  sections: readonly MediaSection[];
  actionPlan?: MediaActionPlan;
  closingTitle?: string;
  sourcesTitle?: string;
  sourcesIntroduction?: string;
  sources: readonly MediaSource[];
  closing: readonly string[];
}>;

export const mediaPosts: readonly MediaPost[] = [
  {
    slug: "sustainable-abundance-for-all",
    title:
      "Sustainable Abundance for All: Designing a Future Where Intelligence Expands Human Capability",
    eyebrow: "Evidence briefing · Abundant futures",
    description:
      "An evidence-led kingXford & Co briefing on expanding human capability while respecting ecological limits, distribution, resilience, and the resource demands of intelligence itself.",
    standfirst:
      "Sustainable abundance is not infinite consumption. It is the deliberate expansion of reliable human capability—supported by intelligence, research, technology, and institutions—without shifting unacceptable costs onto other people, places, or generations.",
    format: "Briefing",
    publishedAt: "2026-07-31T18:00:00.000Z",
    updatedAt: "2026-07-31T18:00:00.000Z",
    readingLabel: "14 min read",
    topics: [
      "Sustainable abundance",
      "Research and development",
      "Artificial intelligence",
      "Human capability",
      "Systems design",
    ],
    cover: "/media/sustainable-abundance-for-all-concept.webp",
    coverAlt:
      "Conceptual editorial image of a diverse professional team studying a luminous systems model linking clean energy, water, food, research, and digital infrastructure; illustrative rather than documentary.",
    coverWidth: 1536,
    coverHeight: 1024,
    featured: true,
    introduction: [
      "Abundance is often reduced to a picture of more: more energy, more goods, more computation, more choice. That picture is incomplete. A society can produce more in aggregate while many people still lack safe water, nutritious food, electricity, connectivity, or the institutional capacity to turn knowledge into durable improvements.",
      "For this briefing, sustainable abundance is a working definition, not a universally accepted metric: a condition in which more people can reliably meet essential needs, develop their capabilities, and exercise meaningful choice, while the systems providing those opportunities remain ecologically viable, resilient, and fair across generations.",
      "That definition creates a demanding design problem. It asks whether intelligence—human expertise, research, trustworthy AI, data, and capable institutions—can increase the benefit delivered by each unit of energy, material, capital, and attention. It also asks who receives that benefit, who bears the risk, and whether the system can keep learning when conditions change.",
    ],
    sections: [
      {
        id: "an-abundance-floor",
        eyebrow: "01 · The floor",
        title: "Begin with capabilities people can actually use.",
        paragraphs: [
          "The global evidence does not describe one interchangeable group of people. Electricity access, clean cooking, water, sanitation, hygiene, hunger, and connectivity are separate indicators with different definitions and overlapping populations. They must never be added into a synthetic total. Read together, however, they show that any credible account of abundance must begin with dependable access to foundational systems.",
          "Access also cannot be judged by a connection alone. Electricity must be reliable and affordable enough to support useful activity. Connectivity must be meaningful, safe, and usable. Water and sanitation require service-quality standards. Food security concerns sustained access to adequate nutrition, not merely the presence of calories somewhere in a market.",
          "The design implication is practical: measure whether infrastructure expands real agency. A water system that fails seasonally, a digital service people cannot afford, or an AI tool that excludes local languages may increase nominal supply without increasing usable capability.",
        ],
        principles: [
          {
            title: "Reliability before spectacle",
            body:
              "Evaluate continuity, quality, affordability, safety, and recoverability—not only the number of connections or products launched.",
          },
          {
            title: "Distribution before averages",
            body:
              "Disaggregate results by place, income, gender, disability, and other relevant conditions wherever the source data permits.",
          },
          {
            title: "Capability before consumption",
            body:
              "Ask what people can learn, create, decide, earn, and sustain because a service exists.",
          },
        ],
      },
      {
        id: "intelligence-as-infrastructure",
        eyebrow: "02 · The multiplier",
        title: "Treat intelligence and research capacity as infrastructure.",
        paragraphs: [
          "Physical systems do not improve themselves. Researchers, engineers, communities, public institutions, and firms must observe problems, test alternatives, retain knowledge, and translate evidence into implementation. UNESCO's latest global release reports growth in research intensity and researcher density, but it also shows deep disparities in the capacity to produce and apply knowledge.",
          "AI can strengthen this capability when it improves discovery, modelling, translation, monitoring, and access to expertise. It can also concentrate capability when compute, data, energy, and decision authority remain inaccessible. The goal is therefore not AI diffusion at any cost; it is governed intelligence that makes institutions more capable, accountable, and responsive.",
          "Research capacity is especially important because imported solutions rarely arrive with every local constraint resolved. Sustainable abundance depends on the ability to adapt technologies, build local evidence, question assumptions, and maintain systems after initial investment ends.",
        ],
      },
      {
        id: "scale-within-limits",
        eyebrow: "03 · The constraint",
        title: "Scale outcomes without scaling damage at the same rate.",
        paragraphs: [
          "Renewable power capacity is expanding at record speed, creating real room for cleaner electrification and new productive uses. At the same time, the material base of the economy remains under pressure. UNEP's 2024 outlook warns that, without urgent change, resource extraction could rise substantially by 2060 relative to 2020 levels.",
          "Digital intelligence has a physical footprint too. The International Energy Agency estimates that data centres used 415 terawatt-hours of electricity in 2024 and projects around 945 terawatt-hours in its 2030 base case. Those numbers cover all data-centre activity, not AI alone, and the 2030 value is a scenario rather than a certainty. They nevertheless make one principle unavoidable: intelligence systems must be designed for energy efficiency, clean supply, appropriate scale, and measurable public value.",
          "Sustainable abundance therefore requires productivity in the fullest sense: more health, learning, resilience, discovery, and useful choice per unit of scarce material and environmental burden—not simply more throughput per hour.",
        ],
      },
      {
        id: "a-design-discipline",
        eyebrow: "04 · The discipline",
        title: "Turn aspiration into a portfolio of testable systems.",
        paragraphs: [
          "No single technology can produce abundance for all. The work is a coordinated portfolio: universal-service infrastructure; research and technical capacity; circular material flows; trustworthy digital public systems; resilient food and health systems; financing that rewards long-term outcomes; and institutions able to learn in public.",
          "Each project should state its abundance claim and its boundary conditions. Which capability will expand? For whom? What resource or risk could increase? Which indicator will reveal unequal outcomes? What evidence would justify scaling, redesign, or stopping? These questions convert a broad ambition into decisions that can be tested.",
          "The strongest projects will create compounding returns: knowledge that can be reused, infrastructure that supports multiple services, open standards that reduce duplication, and institutions that become better at solving the next problem. Sustainable abundance is built when capability compounds faster than harm.",
        ],
        principles: [
          {
            title: "Define the capability gain",
            body:
              "Name the concrete improvement in health, knowledge, agency, resilience, or productive opportunity before selecting the technology.",
          },
          {
            title: "Account for the full system",
            body:
              "Track energy, materials, maintenance, data rights, labour, affordability, and institutional ownership across the lifecycle.",
          },
          {
            title: "Build a learning loop",
            body:
              "Publish assumptions, monitor outcomes, include affected communities, and change course when the evidence disagrees.",
          },
        ],
      },
    ],
    closingTitle: "Abundance is a direction disciplined by evidence.",
    sourcesTitle: "Primary evidence and definitions.",
    sourcesIntroduction:
      "Figures in this briefing come from the official institutional releases below. Reference years, units, modelled ranges, and scenario boundaries are retained because they materially affect interpretation.",
    sources: [
      {
        title: "Tracking SDG 7: The Energy Progress Report 2026",
        organization: "World Bank and SDG 7 custodian agencies",
        url: "https://www.worldbank.org/en/news/press-release/2026/06/16/accelerating-universal-energy-access",
        note:
          "Reports 2024 global access estimates, including 655 million people without electricity and approximately two billion without clean cooking access.",
      },
      {
        title:
          "Progress on household drinking water, sanitation and hygiene 2000–2024",
        organization: "WHO/UNICEF Joint Monitoring Programme",
        url: "https://washdata.org/reports/jmp-2025-wash-households",
        note:
          "Defines and reports separate 2024 service gaps for safely managed drinking water, safely managed sanitation, and basic hygiene at home.",
      },
      {
        title: "Facts and Figures 2025: Internet use",
        organization: "International Telecommunication Union",
        url: "https://www.itu.int/itu-d/reports/statistics/2025/10/15/ff25-internet-use/",
        note:
          "Estimates that 6.0 billion people, or 74% of the world population, were online in 2025 and 2.2 billion remained offline.",
      },
      {
        title: "The State of Food Security and Nutrition in the World 2025",
        organization: "FAO, IFAD, UNICEF, WFP and WHO",
        url: "https://www.fao.org/newsroom/detail/global-hunger-declines--but-rises-in-africa-and-western-asia--un-report/",
        note:
          "Reports a 2024 point estimate of 673 million people experiencing chronic undernourishment, within a modelled range of 638–720 million.",
      },
      {
        title: "Renewable Capacity Statistics 2026",
        organization: "International Renewable Energy Agency",
        url: "https://www.irena.org/News/pressreleases/2026/Apr/Near-700-GW-Surge-in-2025-Proves-Renewable-Energy-Resilience",
        note:
          "Reports installed renewable power capacity and capacity additions in 2025, including the technology composition of net renewable additions.",
      },
      {
        title: "2026 R&D Data Release",
        organization: "UNESCO Institute for Statistics",
        url: "https://www.uis.unesco.org/en/2026-rd-data-release",
        note:
          "Reports 2023 global R&D expenditure intensity and researcher density, with regional comparisons and country-level investment disparities.",
      },
      {
        title: "Global Resources Outlook 2024",
        organization: "United Nations Environment Programme",
        url: "https://www.unep.org/resources/Global-Resource-Outlook-2024",
        note:
          "Presents a scenario in which global resource extraction could rise 60% by 2060 from 2020 levels without urgent and concerted action.",
      },
      {
        title: "Energy and AI",
        organization: "International Energy Agency",
        url: "https://www.iea.org/reports/energy-and-ai/energy-demand-from-ai",
        note:
          "Estimates total data-centre electricity consumption in 2024 and a 2030 base-case projection; the figures are not estimates for AI alone.",
      },
    ],
    closing: [
      "The evidence holds urgency and possibility at the same time. Billions still lack foundational services, yet renewable capacity, connectivity, research, and computational capability are expanding the tools available to respond.",
      "The central choice is architectural: whether these tools deepen extraction and concentration, or help societies extend reliable capability while reducing resource intensity, vulnerability, and exclusion.",
      "kingXford & Co approaches sustainable abundance as a long-horizon research and development agenda—one complex problem, one accountable system, and one reusable body of knowledge at a time.",
    ],
  },
  {
    slug: "how-to-get-ahead-in-the-ai-era",
    title: "How to Get Ahead in the AI Era",
    eyebrow: "Field note · Work and intelligence",
    description:
      "A practical kingXford & Co field note on building judgement, repeatable systems, and reliable verification around AI-assisted work.",
    standfirst:
      "The useful question is no longer whether AI can produce something. It is whether you can direct the work, judge it, verify it, and turn it into a dependable system.",
    format: "Essay",
    publishedAt: "2026-07-30T12:00:00.000Z",
    updatedAt: "2026-07-30T12:00:00.000Z",
    readingLabel: "9 min read",
    topics: ["Artificial intelligence", "Work", "Strategy", "Learning"],
    cover: "/media/how-to-get-ahead-in-the-ai-era-concept.webp",
    coverAlt:
      "Conceptual editorial imagery of a multidisciplinary team examining an AI-assisted workflow in a professional strategy room; the generated scene is illustrative, not documentary evidence.",
    featured: false,
    introduction: [
      "AI has made the distance between an idea and a plausible first draft dramatically shorter. That is useful, but it can also be misleading. A fluent answer can still be shallow. A polished image can still be wrong for the brief. A working prototype can still fail when it meets real users, sensitive data, or an unfamiliar edge case.",
      "Getting ahead therefore cannot mean producing more unexamined material. It means becoming better at the parts of the work that remain consequential: defining the problem, setting a standard, arranging the process, checking the evidence, and taking responsibility for the result.",
      "The people and organisations that use AI well will not treat it as an oracle or a substitute for craft. They will treat it as one capable participant inside a larger working system—fast in some places, uncertain in others, and always governed by a clear human purpose.",
    ],
    sections: [
      {
        id: "judgement",
        eyebrow: "01 · Judgement",
        title: "Decide what good means before asking for output.",
        paragraphs: [
          "Every strong AI workflow begins before the prompt. It begins with a decision about quality. What must the work help someone understand or do? Which constraints are real? What would make the result unacceptable? If these questions remain vague, speed simply produces ambiguity faster.",
          "Judgement is more than taste. It is the ability to recognise what matters in context. A proposal for a board needs a different level of evidence from an early brainstorm. A research summary must preserve uncertainty that advertising copy may compress. A public-facing product must account for accessibility, privacy, failure, and trust in ways that a private sketch does not.",
          "This is why domain knowledge becomes more valuable, not less. The model can help explore a space, but it does not own the consequences of a decision. The person directing the work must know which details are structural, which are optional, and which require a qualified reviewer.",
        ],
        principles: [
          {
            title: "Write the standard",
            body:
              "Define the audience, purpose, constraints, evidence threshold, tone, and failure conditions in plain language.",
          },
          {
            title: "Separate exploration from approval",
            body:
              "Let AI expand the option space, but use an explicit human decision to select, reject, or release consequential work.",
          },
          {
            title: "Keep context close",
            body:
              "Give the system the relevant brief, source material, definitions, and examples instead of relying on a clever prompt to recover missing knowledge.",
          },
        ],
      },
      {
        id: "systems",
        eyebrow: "02 · Systems",
        title: "Turn isolated prompts into a visible way of working.",
        paragraphs: [
          "A collection of impressive prompts is not yet a system. A system has an order. It shows what enters, what changes, who reviews it, what can fail, and what becomes the starting point for the next stage.",
          "Consider a familiar knowledge task. Research may lead to synthesis; synthesis may lead to a decision; the decision may lead to a document, interface, lesson, or campaign. If every stage starts from a blank chat, the reasoning chain breaks. Useful context disappears, corrections are repeated, and no one can explain how the final result took shape.",
          "A stronger approach gives each stage a job. One step gathers and labels source material. Another identifies tensions and unanswered questions. Another proposes options against stated criteria. A human selects a direction. Later steps develop, test, and package the result. The output of one stage becomes structured input for the next.",
          "This does not require automating everything. In fact, the most responsible systems preserve deliberate pauses. High-impact decisions, ambiguous evidence, private information, and public claims deserve visible checkpoints. The goal is not to remove people from the work; it is to place human attention where it has the greatest value.",
        ],
        principles: [
          {
            title: "Design the handoffs",
            body:
              "Name what every stage receives, what it must produce, and what must be true before work moves forward.",
          },
          {
            title: "Preserve provenance",
            body:
              "Keep links between source material, interpretations, decisions, revisions, and final outputs so the reasoning can be revisited.",
          },
          {
            title: "Build for interruption",
            body:
              "A dependable workflow should allow someone to pause, inspect, correct, and resume without losing the state of the work.",
          },
        ],
      },
      {
        id: "verification",
        eyebrow: "03 · Verification",
        title: "Treat plausibility as the beginning of review, not the end.",
        paragraphs: [
          "Generative systems are designed to produce coherent responses. Coherence is helpful, but it is not proof. Names, quotations, calculations, dates, citations, legal requirements, product capabilities, and technical details should be checked against appropriate sources or direct tests.",
          "Verification must match the risk. A private list of possibilities may only need a quick sense-check. A financial, medical, legal, scientific, or safety-related claim needs authoritative evidence and, where appropriate, qualified professional review. Production code needs tests and observation in the environment where it will run. A design needs to be viewed across actual screens and assistive settings, not only admired in a static frame.",
          "It is also important to test the framing, not just the facts. Did the system answer the real question? Did it omit an affected group? Did the brief encourage false certainty? Is a recommendation based on evidence, or merely written in the language of confidence? These checks protect against a polished answer solving the wrong problem.",
        ],
        principles: [
          {
            title: "Trace claims to evidence",
            body:
              "Ask which statements are factual, where they came from, how current they are, and whether the source actually supports the conclusion.",
          },
          {
            title: "Test the artifact",
            body:
              "Run the calculation, open the link, execute the code, inspect the responsive layout, and try the failure path.",
          },
          {
            title: "Record uncertainty",
            body:
              "When the evidence is incomplete or the system is unsure, preserve that boundary instead of polishing it away.",
          },
        ],
      },
      {
        id: "position",
        eyebrow: "04 · Position",
        title: "Build an advantage that survives the next model release.",
        paragraphs: [
          "Tools will change. Interfaces will change. Capabilities that feel rare today may become ordinary. A durable position cannot depend on access to one model or familiarity with one interface.",
          "The stronger advantage is a combination of domain depth, clear judgement, original material, trusted relationships, and a system that improves through use. Your interviews, observations, datasets, methods, case histories, prototypes, and carefully documented decisions create context that a generic model does not possess by default.",
          "This is also where communication matters. People need to understand what AI contributed, what a human reviewed, what evidence supports the result, and where limitations remain. Transparency is not a decorative disclaimer. It is part of the design of trustworthy work.",
          "Use AI to widen exploration and reduce avoidable friction. Keep authorship, responsibility, and the final standard unmistakably human.",
        ],
      },
    ],
    actionPlan: {
      id: "thirty-day-plan",
      eyebrow: "05 · Practice",
      title: "A practical 30-day plan.",
      introduction:
        "The plan begins with one real workflow. It is deliberately narrow: learn enough from a complete cycle to build the next one intelligently.",
      resultLabel: "Result",
      stages: [
        {
        range: "Days 01–07",
        title: "Choose one meaningful workflow",
        focus:
          "Study a recurring task closely enough to see where time, context, and judgement are currently lost.",
        actions: [
          "Choose one task you already understand and perform often enough to evaluate honestly.",
          "Write its real purpose, audience, inputs, constraints, and definition of done.",
          "Mark sensitive information and decisions that must remain under human control.",
          "Complete the task once without changing the process, noting friction and repeated work.",
        ],
        result:
          "A one-page workflow map and a clear quality standard—not a list of fashionable tools.",
      },
      {
        range: "Days 08–14",
        title: "Build the smallest useful system",
        focus:
          "Give AI a defined role inside the workflow and make every handoff visible.",
        actions: [
          "Break the work into stages such as intake, exploration, synthesis, decision, production, and review.",
          "Create a reusable brief containing the context every stage needs.",
          "Define the output format and acceptance criteria for each stage.",
          "Keep a manual checkpoint wherever the work becomes consequential or difficult to reverse.",
        ],
        result:
          "A repeatable first version that can be followed by someone other than the person who invented it.",
      },
      {
        range: "Days 15–21",
        title: "Install the verification layer",
        focus:
          "Make it harder for fluent mistakes, missing evidence, and hidden assumptions to reach the final result.",
        actions: [
          "Create a short checklist for factual claims, sources, calculations, links, privacy, accessibility, and edge cases.",
          "Test the workflow with an awkward or incomplete input rather than an ideal example.",
          "Ask a knowledgeable person to challenge both the output and the framing of the problem.",
          "Record corrections in the reusable brief or workflow instead of fixing only the current artifact.",
        ],
        result:
          "A review process that improves the system as well as the individual output.",
      },
      {
        range: "Days 22–30",
        title: "Use it on real work and refine",
        focus:
          "Move from a promising demonstration to a responsible practice you can explain and improve.",
        actions: [
          "Run the system on a real assignment with a clear owner and consequence.",
          "Compare the result with the quality standard written during the first week.",
          "Remove steps that add ceremony without improving clarity, reliability, or craft.",
          "Document what AI handled, what people decided, what was verified, and what remains unresolved.",
          "Choose the next workflow only after the first one is dependable enough to reuse.",
        ],
        result:
          "A working case, a documented method, and a specific list of improvements for the next cycle.",
        },
      ],
    },
    sources: [
      {
        title: "AI Index",
        organization: "Stanford Institute for Human-Centered AI",
        url: "https://hai.stanford.edu/ai-index",
        note:
          "Independent annual evidence on AI capability, adoption, investment, policy, and the widening gap between technical progress and institutional readiness.",
      },
      {
        title:
          "Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile",
        organization: "National Institute of Standards and Technology",
        url: "https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence",
        note:
          "A cross-sector companion to the AI Risk Management Framework for identifying and managing trustworthiness considerations across the generative-AI lifecycle.",
      },
      {
        title: "The Future of Jobs Report 2025",
        organization: "World Economic Forum",
        url: "https://www.weforum.org/publications/the-future-of-jobs-report-2025/digest/",
        note:
          "Employer research on changing skills and work, including the growing importance of AI literacy alongside analytical and creative thinking, resilience, and lifelong learning.",
      },
    ],
    closing: [
      "The AI era rewards motion, but motion alone is not progress. The valuable work is still the work that helps someone understand, decide, create, or act with greater clarity.",
      "Begin with one real problem. Define what good means. Build a visible system. Verify what matters. Then improve it through use.",
      "The objective is not to appear automated. It is to become more capable without becoming less accountable.",
    ],
  },
] as const;

export const featuredMediaPosts = mediaPosts.filter((post) => post.featured);

export function getMediaPostBySlug(slug: string): MediaPost | undefined {
  return mediaPosts.find((post) => post.slug === slug);
}
