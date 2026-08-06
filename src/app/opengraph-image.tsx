import { ImageResponse } from "next/og";

export const alt =
  "kingXford & Co — Research, Digital Systems and Responsible AI";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "62px 70px 58px",
          color: "#f4f1e9",
          background:
            "radial-gradient(circle at 84% 18%, rgba(49,93,255,0.34) 0%, rgba(49,93,255,0) 32%), linear-gradient(135deg, #06080c 0%, #0a0d14 56%, #0d1328 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "70px",
            right: "70px",
            top: "112px",
            height: "1px",
            display: "flex",
            background: "rgba(244,241,233,0.2)",
          }}
        />

        {[0, 1, 2, 3].map((line) => (
          <div
            key={line}
            style={{
              position: "absolute",
              top: "112px",
              bottom: "58px",
              left: `${70 + line * 265}px`,
              width: "1px",
              display: "flex",
              background: "rgba(244,241,233,0.08)",
            }}
          />
        ))}

        <div
          style={{
            position: "absolute",
            right: "70px",
            top: "146px",
            bottom: "90px",
            width: "5px",
            display: "flex",
            background: "rgba(89,97,255,0.72)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 19,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              letterSpacing: "-0.045em",
              textTransform: "none",
              fontSize: "26px",
              fontWeight: 680,
            }}
          >
            <span>king</span>
            <span
              style={{
                display: "flex",
                margin: "0 1px",
                color: "#5961ff",
                fontSize: "25px",
                fontWeight: 710,
                lineHeight: 1,
              }}
            >
              X
            </span>
            <span>ford</span>
            <span
              style={{
                display: "flex",
                marginLeft: "16px",
                paddingLeft: "16px",
                borderLeft: "1px solid rgba(244,241,233,0.28)",
                color: "rgba(244,241,233,0.7)",
                fontSize: "11px",
                fontWeight: 650,
                letterSpacing: "0.08em",
              }}
            >
              &amp; Co
            </span>
          </div>
          <span style={{ color: "#86a0ff" }}>
            Research / Digital systems / Responsible AI
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: "950px",
            marginTop: "30px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 88,
              fontWeight: 500,
              lineHeight: 0.94,
              letterSpacing: "-0.06em",
            }}
          >
            Research-led
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 88,
              fontWeight: 500,
              lineHeight: 0.94,
              letterSpacing: "-0.06em",
              color: "#7894ff",
            }}
          >
            digital systems.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              maxWidth: "700px",
              fontSize: 21,
              lineHeight: 1.4,
              color: "rgba(244,241,233,0.7)",
            }}
          >
            Applied research, product design, and software development for
            complex organisational and public-interest work.
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: "285px",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "5px",
              fontSize: 12,
              letterSpacing: "0.12em",
              lineHeight: 1.35,
              textAlign: "right",
              textTransform: "uppercase",
              color: "rgba(244,241,233,0.7)",
            }}
          >
            <span>Working method</span>
            <span>Evidence. Decisions. Delivery.</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
