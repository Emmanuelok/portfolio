import type { Metadata } from "next";
import Link from "next/link";

import {
  TrustCallout,
  TrustPage,
  TrustSection,
} from "@/app/privacy/TrustPage";

export const metadata: Metadata = {
  title: "AI Transparency Statement",
  description:
    "How model-assisted reviews work in Kingxford Canvas, which data is processed, what remains under human control, and where limitations apply.",
  alternates: { canonical: "/ai-transparency" },
};

const contents = [
  { id: "system", label: "The system in plain language" },
  { id: "modes", label: "Live, local, and unavailable modes" },
  { id: "data-sent", label: "What is sent for review" },
  { id: "providers-ai", label: "Models and providers" },
  { id: "human-control", label: "Human control and authority" },
  { id: "limitations-ai", label: "Limitations and verification" },
  { id: "retention-ai", label: "Retention, training, and confidentiality" },
  { id: "challenge", label: "Challenge, correction, and reporting" },
] as const;

export default function AiTransparencyPage() {
  return (
    <TrustPage
      eyebrow="AI transparency · Processing · Human authority"
      title="Assistance without hidden authority."
      introduction="The platform separates live model review from local rule-based review, identifies availability before use, and keeps acceptance or application of every proposed change under human control."
      contents={contents}
    >
      <TrustSection id="system" title="The system in plain language">
        <p>
          Kingxford Canvas can examine a selected project revision and return a
          structured critique, uncertainties, possible failure points, a next
          test, proposed changes, and a draft build brief. It is an advisory
          review layer inside the project workflow—not an autonomous operator.
        </p>
        <p>
          The review is bound to the selected project and artifact revision so
          that a response can be traced to the material examined. Curated local
          guidance may be included as design context; it is not presented as
          external evidence for the project&apos;s claims.
        </p>
      </TrustSection>

      <TrustSection id="modes" title="Live, local, and unavailable modes">
        <ul>
          <li>
            <strong>Live model review</strong> is available only when provider
            authentication, model routing, and usage protection pass the
            deployment readiness checks.
          </li>
          <li>
            <strong>Local rule-based review</strong> uses deterministic checks in
            the application. It is not a language model and is labelled as a
            local fallback.
          </li>
          <li>
            <strong>Unavailable</strong> means a live request will not be accepted.
            The workspace remains usable for manual editing and local work.
          </li>
        </ul>
        <p>
          A readiness label describes configuration at that moment; it does not
          guarantee that a third-party provider will complete every request.
        </p>
      </TrustSection>

      <TrustSection id="data-sent" title="What is sent for a live review">
        <p>
          Only after you request a live review, the platform may send the selected
          title, text or code, review objective, bounded version context, selected
          diagnostic logs, project snapshot, artifact revision identifier, and a
          small set of curated guidance relevant to the phase. Input size and
          project-graph scope are bounded.
        </p>
        <p>
          Common credential patterns are screened before a provider request, but
          screening cannot identify every secret. Remove personal, confidential,
          export-controlled, privileged, or regulated information unless its
          processing has been deliberately approved.
        </p>
      </TrustSection>

      <TrustSection id="providers-ai" title="Models and providers">
        <p>
          When configured, live reviews are routed through Vercel AI Gateway to
          designated OpenAI models. Standard and deeper review modes may use
          different model routes, reasoning effort, limits, and approved fallback
          models. Current route and readiness information is exposed by the
          platform&apos;s diagnostic response rather than concealed in marketing copy.
        </p>
        <p>
          Model names, availability, provider features, and commercial terms can
          change. A fallback model may differ in style or capability. The response
          records the source and model information available to the application so
          reviewers can interpret the result accordingly.
        </p>
      </TrustSection>

      <TrustSection id="human-control" title="Human control remains decisive">
        <ul>
          <li>No live review begins without a deliberate user request.</li>
          <li>No external tools or open-web research are granted by the review route.</li>
          <li>No proposed text or code is automatically applied to the project.</li>
          <li>No lifecycle gate is approved by a model.</li>
          <li>No deployment, purchase, message, or institutional decision is authorized by a review.</li>
        </ul>
        <p>
          A person with appropriate authority must inspect the source material,
          verify evidence, compare the proposal, and decide whether to reject,
          revise, or accept it into a new project revision.
        </p>
      </TrustSection>

      <TrustSection id="limitations-ai" title="Limitations and verification">
        <TrustCallout>
          <p>
            Model output can sound confident while being wrong. It may invent a
            source, overlook context, reproduce bias, misunderstand code, or
            propose a polished answer to the wrong problem.
          </p>
        </TrustCallout>
        <p>
          Treat factual statements, citations, quantitative claims, legal or
          regulatory interpretations, safety conclusions, and professional
          recommendations as unverified until checked against authoritative
          material and appropriate expertise. A review score or “ready” label is
          workflow information, not proof that the underlying project is valid.
        </p>
      </TrustSection>

      <TrustSection id="retention-ai" title="Retention, training, and confidentiality">
        <p>
          kingXford &amp; Co does not intentionally assemble live-review content
          into its own model-training corpus. Provider processing, temporary
          storage, abuse monitoring, and retention are governed by the service
          arrangement active for the deployment. Organization clients should
          verify those terms and any residency requirements before use.
        </p>
        <p>
          The platform may retain a bounded review record, model/source label,
          request reference, timing, and an accepted project revision where cloud
          project history is enabled. The authoritative record should distinguish
          source content, model proposal, human decision, and resulting revision.
          See the <Link href="/privacy">Privacy Statement</Link> for broader data
          handling and deletion information.
        </p>
      </TrustSection>

      <TrustSection id="challenge" title="Challenge, correct, or report a result">
        <p>
          You can discard an output, run the local check, narrow the objective,
          compare another approved review depth, create a corrected revision, or
          document why a proposal was rejected. Preserve the request reference and
          project revision when reporting a reproducible problem, but remove
          confidential content from support messages.
        </p>
        <p>
          Report material safety, privacy, provenance, or accuracy concerns through
          the public address shown on the <Link href="/contact">Contact page</Link>.
          Online delivery is not represented as available when the project inbox
          is not configured.
        </p>
      </TrustSection>
    </TrustPage>
  );
}
