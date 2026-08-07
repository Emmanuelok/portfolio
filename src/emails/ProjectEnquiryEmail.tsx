import type { ProjectEnquiry } from "@/lib/contact/contracts";

type ProjectEnquiryEmailProps = Readonly<{
  enquiry: ProjectEnquiry;
  requestId: string;
  submittedAt: string;
}>;

const sectionStyle = {
  borderTop: "1px solid #d9d6ce",
  padding: "20px 0",
} as const;

const labelStyle = {
  margin: "0 0 8px",
  color: "#66645f",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
} as const;

const valueStyle = {
  margin: 0,
  color: "#111113",
  fontSize: "15px",
  lineHeight: 1.65,
  whiteSpace: "pre-wrap" as const,
} as const;

export function ProjectEnquiryEmail({
  enquiry,
  requestId,
  submittedAt,
}: ProjectEnquiryEmailProps) {
  const sections = [
    ["Problem or opportunity", enquiry.brief.problem],
    ["People and institutions affected", enquiry.brief.affected],
    ["Evidence and unknowns", enquiry.brief.evidence || "Not provided"],
    ["Desired future", enquiry.brief.future],
    ["Constraints and dependencies", enquiry.brief.constraints || "Not provided"],
    ["Available resources", enquiry.brief.investment || "Not provided"],
    ["Time horizon", enquiry.brief.horizon],
  ] as const;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#f3f1eb",
          color: "#111113",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "680px",
            margin: "0 auto",
            padding: "40px 24px",
            boxSizing: "border-box",
          }}
        >
          <p style={labelStyle}>kingXford &amp; Co · Project enquiry</p>
          <h1
            style={{
              margin: "12px 0 32px",
              fontSize: "34px",
              fontWeight: 500,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
            }}
          >
            A new project brief is ready for review.
          </h1>

          <div style={sectionStyle}>
            <p style={labelStyle}>Contact</p>
            <p style={valueStyle}>{enquiry.name}</p>
            <p style={valueStyle}>{enquiry.email}</p>
            {enquiry.organization ? (
              <p style={valueStyle}>{enquiry.organization}</p>
            ) : null}
          </div>

          {sections.map(([label, value]) => (
            <div style={sectionStyle} key={label}>
              <p style={labelStyle}>{label}</p>
              <p style={valueStyle}>{value}</p>
            </div>
          ))}

          <div style={sectionStyle}>
            <p style={labelStyle}>Submission record</p>
            <p style={{ ...valueStyle, color: "#66645f", fontSize: "12px" }}>
              Accepted {submittedAt} · Request {requestId}
            </p>
            <p style={{ ...valueStyle, color: "#66645f", fontSize: "12px" }}>
              The sender confirmed that kingXford &amp; Co may use this information
              to assess and respond to the enquiry.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
