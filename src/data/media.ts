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
  featured: boolean;
  audio?: MediaAudio;
  introduction: readonly string[];
  sections: readonly MediaSection[];
  plan: readonly MediaPlanStage[];
  sources: readonly MediaSource[];
  closing: readonly string[];
}>;

export const mediaPosts: readonly MediaPost[] = [
  {
    slug: "how-to-get-ahead-in-the-ai-era",
    title: "How to Get Ahead in the AI Era",
    eyebrow: "Field note · Work and intelligence",
    description:
      "A practical Kingxford field note on building judgement, repeatable systems, and reliable verification around AI-assisted work.",
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
    featured: true,
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
    plan: [
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
