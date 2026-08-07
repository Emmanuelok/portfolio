import { Resend } from "resend";

import { ProjectEnquiryEmail } from "@/emails/ProjectEnquiryEmail";
import type { ProjectEnquiry } from "@/lib/contact/contracts";
import type { ContactDeliveryConfiguration } from "@/lib/contact/configuration";

export type ContactDeliveryInput = Readonly<{
  configuration: ContactDeliveryConfiguration;
  enquiry: ProjectEnquiry;
  idempotencyKey: string;
  requestId: string;
  submittedAt: string;
}>;

export type ContactDeliveryResult = Readonly<{
  accepted: true;
}>;

export type ContactDeliveryFunction = (
  input: ContactDeliveryInput,
) => Promise<ContactDeliveryResult>;

export class ContactDeliveryError extends Error {
  readonly code: "provider-rejected" | "provider-unavailable";

  constructor(code: ContactDeliveryError["code"]) {
    super("The project enquiry could not be accepted by the delivery provider.");
    this.name = "ContactDeliveryError";
    this.code = code;
  }
}

let cachedClient: Readonly<{ apiKey: string; client: Resend }> | null = null;

function resendClient(apiKey: string) {
  if (!cachedClient || cachedClient.apiKey !== apiKey) {
    cachedClient = { apiKey, client: new Resend(apiKey) };
  }
  return cachedClient.client;
}

export function formatProjectEnquiryText(
  enquiry: ProjectEnquiry,
  requestId: string,
  submittedAt: string,
) {
  return [
    "KINGXFORD PROJECT ENQUIRY",
    "",
    `Contact: ${enquiry.name}`,
    `Email: ${enquiry.email}`,
    `Organization: ${enquiry.organization || "Not provided"}`,
    "",
    `1. Problem or opportunity\n${enquiry.brief.problem}`,
    `2. People and institutions affected\n${enquiry.brief.affected}`,
    `3. Evidence and unknowns\n${enquiry.brief.evidence || "Not provided"}`,
    `4. Desired future\n${enquiry.brief.future}`,
    `5. Constraints and dependencies\n${enquiry.brief.constraints || "Not provided"}`,
    `6. Available resources\n${enquiry.brief.investment || "Not provided"}`,
    `7. Time horizon\n${enquiry.brief.horizon}`,
    "",
    `Accepted: ${submittedAt}`,
    `Request: ${requestId}`,
  ].join("\n\n");
}

export const deliverProjectEnquiry: ContactDeliveryFunction = async (input) => {
  const { configuration, enquiry, idempotencyKey, requestId, submittedAt } =
    input;
  let response;

  try {
    response = await resendClient(configuration.apiKey).emails.send(
      {
        from: `kingXford & Co <${configuration.fromEmail}>`,
        to: configuration.inboxEmail,
        replyTo: enquiry.email,
        subject: "New kingXford project enquiry",
        react: ProjectEnquiryEmail({ enquiry, requestId, submittedAt }),
        text: formatProjectEnquiryText(enquiry, requestId, submittedAt),
        tags: [{ name: "category", value: "project-enquiry" }],
      },
      { idempotencyKey },
    );
  } catch {
    throw new ContactDeliveryError("provider-unavailable");
  }

  if (response.error || !response.data?.id) {
    throw new ContactDeliveryError("provider-rejected");
  }

  return { accepted: true };
};
