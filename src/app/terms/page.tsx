import type { Metadata } from "next";
import Link from "next/link";

import {
  TrustCallout,
  TrustPage,
  TrustSection,
} from "@/app/privacy/TrustPage";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Terms governing access to kingxford.co, its project workspace, reviews, exports, and project-enquiry functions.",
  alternates: { canonical: "/terms" },
};

const contents = [
  { id: "agreement", label: "Agreement and operator" },
  { id: "platform", label: "What the platform provides" },
  { id: "responsibilities", label: "Your responsibilities" },
  { id: "content", label: "Content and permissions" },
  { id: "model-output", label: "Model-assisted output" },
  { id: "availability", label: "Availability and changes" },
  { id: "disclaimers", label: "Disclaimers and responsibility" },
  { id: "contact-terms", label: "Questions and project agreements" },
] as const;

export default function TermsPage() {
  return (
    <TrustPage
      eyebrow="Terms · Responsibilities · Service boundaries"
      title="Clear terms for serious work."
      introduction="These terms define the public platform boundary. They do not replace a signed proposal, confidentiality agreement, data-processing agreement, or statement of work for a commissioned project."
      contents={contents}
    >
      <TrustSection id="agreement" title="Agreement and operator">
        <p>
          By accessing kingxford.co or using its tools, you agree to these Terms
          of Use and the <Link href="/privacy">Privacy Statement</Link>. If you do
          not agree, do not submit information or use cloud or live-review
          functions.
        </p>
        <p>
          The site is operated by Emmanuel Kingsford Owusu under the working name
          kingXford &amp; Co. Use of “kingXford &amp; Co,” “we,” or “the platform”
          in these terms identifies that operating practice; it does not itself
          state that a separately incorporated entity exists.
        </p>
      </TrustSection>

      <TrustSection id="platform" title="What the platform provides">
        <p>
          The platform provides research, planning, prototyping, documentation,
          project-continuity, export, enquiry, and optional model-assisted review
          functions. Some functions may operate only in your browser. Others
          require configured cloud, email, identity, or model services and will
          be described as unavailable when those services are not ready.
        </p>
        <p>
          Public examples, prototypes, and concept demonstrations show methods
          and possible directions. They are not evidence of a live institution,
          client engagement, commercial result, or guaranteed outcome unless
          expressly identified as such.
        </p>
      </TrustSection>

      <TrustSection id="responsibilities" title="Use the platform responsibly">
        <p>You agree to:</p>
        <ul>
          <li>provide information you are authorized to use and submit;</li>
          <li>keep credentials, private keys, and restricted records out of inputs;</li>
          <li>respect privacy, confidentiality, intellectual-property, and access rights;</li>
          <li>verify important claims, calculations, citations, and generated output;</li>
          <li>avoid attempts to bypass access controls, limits, or security boundaries; and</li>
          <li>use professional judgment before making consequential decisions.</li>
        </ul>
        <p>
          The platform may reject, limit, or suspend requests that threaten
          security, service reliability, another person&apos;s rights, or lawful use.
        </p>
      </TrustSection>

      <TrustSection id="content" title="Your content remains yours">
        <p>
          You retain your rights in project content you create or submit. You
          grant the operator and configured service providers a limited
          permission to host, transmit, transform, and display that content only
          as needed to provide the function you selected, maintain security, or
          meet an applicable obligation.
        </p>
        <p>
          The platform&apos;s original interface, code, editorial material, identity,
          and demonstrations remain protected by their applicable rights and
          licenses. Do not remove notices, misrepresent authorship, or redistribute
          protected materials beyond the permission attached to them.
        </p>
        <p>
          Feedback may be used to improve the platform without identifying you
          or disclosing your confidential project content, unless a separate
          written agreement says otherwise.
        </p>
      </TrustSection>

      <TrustSection id="model-output" title="Model-assisted output requires review">
        <p>
          Live reviews and local rule-based checks may be incomplete, incorrect,
          or unsuitable for your context. They do not replace qualified legal,
          medical, financial, engineering, academic, safeguarding, or other
          professional advice. A cited source should be opened and verified; an
          uncited statement should be treated as an unverified proposition.
        </p>
        <p>
          No model output is automatically accepted into your authoritative
          project record. You decide whether to revise, reject, export, or apply
          it. See the{" "}<Link href="/ai-transparency">AI Transparency Statement</Link>{" "}
          for the current processing and control boundary.
        </p>
      </TrustSection>

      <TrustSection id="availability" title="Availability and changes">
        <p>
          The platform may change, pause, limit, or retire functions to improve
          reliability, security, accessibility, cost control, or product quality.
          Availability labels are operational information, not a service-level
          commitment. Export important local work and maintain independent copies
          of material needed for deadlines or institutional records.
        </p>
        <p>
          External links and providers are not controlled in every respect by
          kingXford &amp; Co. Their terms, availability, and handling practices may
          change independently.
        </p>
      </TrustSection>

      <TrustSection id="disclaimers" title="Disclaimers and responsibility">
        <TrustCallout>
          <p>
            The public platform is provided on an “as available” basis. No
            particular research finding, commercial outcome, institutional
            approval, funding decision, or fitness for a specific purpose is
            promised by access to the platform.
          </p>
        </TrustCallout>
        <p>
          To the extent permitted by applicable law, the operator is not
          responsible for indirect or consequential loss arising from reliance
          on unverified output, failure to maintain backups, unauthorized inputs,
          or services outside the operator&apos;s reasonable control. Nothing in these
          terms excludes responsibility that cannot lawfully be excluded.
        </p>
        <p>
          These public terms describe platform operation and are not legal advice.
          Commissioned work should use a reviewed written agreement suited to the
          parties, jurisdiction, risk, and data involved.
        </p>
      </TrustSection>

      <TrustSection id="contact-terms" title="Questions and project agreements">
        <p>
          Questions about these terms can be raised through the public address on
          the <Link href="/contact">Contact page</Link>. Submitting a project
          enquiry does not create a client, partnership, employment, fiduciary,
          or confidential relationship. Those obligations begin only when they
          are expressly accepted in a suitable written agreement.
        </p>
      </TrustSection>
    </TrustPage>
  );
}
