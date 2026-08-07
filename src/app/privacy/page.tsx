import type { Metadata } from "next";
import Link from "next/link";

import {
  TrustCallout,
  TrustPage,
  TrustSection,
} from "@/app/privacy/TrustPage";
import { CONTACT_RETENTION_TARGET_DAYS } from "@/lib/contact/contracts";

export const metadata: Metadata = {
  title: "Privacy Statement",
  description:
    "How kingXford & Co handles browser data, project records, enquiries, analytics, and optional model-assisted processing.",
  alternates: { canonical: "/privacy" },
};

const contents = [
  { id: "scope", label: "Scope and operator" },
  { id: "information", label: "Information handled" },
  { id: "local-cloud", label: "Local and cloud records" },
  { id: "purposes", label: "Why information is used" },
  { id: "providers", label: "Service-provider processing" },
  { id: "retention", label: "Retention and deletion" },
  { id: "choices", label: "Your choices and requests" },
  { id: "security-changes", label: "Security and changes" },
] as const;

export default function PrivacyPage() {
  return (
    <TrustPage
      eyebrow="Privacy · Data handling · User control"
      title="Privacy, stated plainly."
      introduction="This statement distinguishes information that remains in your browser from information you deliberately send to a project inbox, cloud workspace, analytics service, or model provider."
      contents={contents}
    >
      <TrustSection id="scope" title="Scope and operator">
        <p>
          This website and its working tools are operated by Emmanuel Kingsford
          Owusu under the working name kingXford &amp; Co. This statement applies
          to kingxford.co, its project workspace, project-enquiry route, and
          related platform functions controlled by the operator.
        </p>
        <p>
          Separate services reached through external links have their own
          privacy terms. A client agreement may also establish more specific
          confidentiality, security, location, and retention requirements for
          commissioned work.
        </p>
      </TrustSection>

      <TrustSection id="information" title="Information handled">
        <p>Depending on the functions you choose, the platform may handle:</p>
        <ul>
          <li>
            <strong>Project content:</strong> briefs, source text, prototypes,
            evidence notes, decisions, revisions, and review instructions.
          </li>
          <li>
            <strong>Enquiry details:</strong> your name, email address,
            organization, project brief, consent record, request reference, and
            delivery timestamp.
          </li>
          <li>
            <strong>Account and collaboration data:</strong> an account
            identifier, organization membership, roles, and records you elect to
            save when cloud persistence is offered and enabled.
          </li>
          <li>
            <strong>Operational information:</strong> security events, request
            timing, coarse service diagnostics, and aggregate performance or
            usage measurements supplied by hosting and analytics services.
          </li>
        </ul>
        <TrustCallout>
          <p>
            Do not enter passwords, API keys, private keys, regulated records,
            or confidential material unless a suitable written processing and
            security arrangement is already in place. The enquiry endpoint
            rejects common credential patterns but cannot identify every secret.
          </p>
        </TrustCallout>
      </TrustSection>

      <TrustSection id="local-cloud" title="Local and cloud records are different">
        <p>
          Canvas and Atlas can operate in a browser-first mode. Records marked
          as local remain in that browser storage until you clear them, replace
          them, export them, or the browser removes site data. Opening a local
          project does not by itself send its contents to kingXford &amp; Co.
        </p>
        <p>
          If cloud save, sign-in, or collaboration is available and you choose
          it, the selected account and project records are transmitted to the
          configured cloud service so they can be synchronized and recovered.
          The interface should identify whether a record is local or cloud-held.
        </p>
        <p>
          Copying, downloading, opening an email draft, submitting an enquiry,
          or requesting live model review are separate deliberate actions. Each
          may move the selected content beyond browser-only storage.
        </p>
      </TrustSection>

      <TrustSection id="purposes" title="Why information is used">
        <p>Information is used only for defined platform purposes, including:</p>
        <ul>
          <li>providing, saving, synchronizing, and recovering selected work;</li>
          <li>assessing and responding to a project enquiry;</li>
          <li>producing a review that you explicitly request;</li>
          <li>maintaining reliability, abuse prevention, and platform security;</li>
          <li>understanding aggregate performance and improving usability; and</li>
          <li>meeting applicable contractual or legal obligations.</li>
        </ul>
        <p>
          kingXford &amp; Co does not sell project content or enquiry details and
          does not use them to build advertising profiles.
        </p>
      </TrustSection>

      <TrustSection id="providers" title="Service-provider processing">
        <p>
          The platform may use specialist providers for hosting, database and
          authentication services, email delivery, security, analytics, and
          model access. At present, the relevant technical routes may include
          Vercel-hosted infrastructure and analytics, Resend for project-enquiry
          delivery, a configured database or identity provider, and Vercel AI
          Gateway with an OpenAI model for live reviews.
        </p>
        <p>
          Providers process only the information needed for the selected
          function, subject to their service terms and configured retention.
          Their infrastructure may process information outside your province or
          country. Organization clients should confirm provider, residency, and
          contractual requirements before submitting sensitive work.
        </p>
        <p>
          Read the <Link href="/ai-transparency">AI Transparency Statement</Link>{" "}
          before requesting a live model review.
        </p>
      </TrustSection>

      <TrustSection id="retention" title="Retention and deletion">
        <ul>
          <li>
            <strong>Browser-only records</strong> remain under your browser and
            device controls. Export anything important before clearing site data.
          </li>
          <li>
            <strong>Inactive or declined project enquiries</strong> have a target
            deletion period of {CONTACT_RETENTION_TARGET_DAYS} days after the
            enquiry becomes inactive. Active discussions may be retained for the
            relationship, and limited copies may remain longer where required for
            security, dispute handling, legal duties, or provider backup cycles.
          </li>
          <li>
            <strong>Cloud projects</strong> remain until you or an authorized
            workspace administrator removes them, the account is closed, or a
            more specific agreement applies. Backup removal may follow the
            provider&apos;s normal deletion cycle.
          </li>
          <li>
            <strong>Operational logs</strong> are kept for the shortest practical
            period supported by the hosting and security configuration.
          </li>
        </ul>
        <p>
          Project content is not intentionally assembled into a separate
          kingXford model-training corpus. Provider-side handling remains subject
          to the provider arrangement in effect when you use the function.
        </p>
      </TrustSection>

      <TrustSection id="choices" title="Your choices and requests">
        <p>
          You may continue locally, export a project, choose not to request a
          live review, decline non-essential cloud functions, or use the copy and
          download options instead of online enquiry delivery.
        </p>
        <p>
          To request access, correction, export, or deletion of information held
          by kingXford &amp; Co, use the public email shown on the{" "}
          <Link href="/contact">Contact page</Link>. Provide the request reference
          where available. Identity may need to be verified before records are
          disclosed or deleted. If no public email is displayed, online project
          submissions are not presented as an available deletion channel.
        </p>
      </TrustSection>

      <TrustSection id="security-changes" title="Security and changes">
        <p>
          Reasonable technical and organizational safeguards are used for active
          platform functions, including bounded inputs, same-origin submission,
          server-only credentials, role checks where configured, and restrained
          operational logging. No internet service can guarantee absolute
          security; export critical work and avoid unnecessary sensitive data.
        </p>
        <p>
          Material changes to data categories, model processing, providers, or
          retention will be reflected here with a revised review date. Earlier
          versions may be retained in the public source history where available.
        </p>
      </TrustSection>
    </TrustPage>
  );
}
