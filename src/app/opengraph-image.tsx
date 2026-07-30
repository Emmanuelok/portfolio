import { ImageResponse } from "next/og";

export const alt =
  "Kingxford — Complex ideas. Unforgettable form.";
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
            right: "48px",
            top: "68px",
            display: "flex",
            color: "rgba(89,97,255,0.22)",
            fontSize: "430px",
            fontWeight: 780,
            lineHeight: 0.82,
            letterSpacing: "-0.14em",
          }}
        >
          X
        </div>

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
              letterSpacing: "-0.07em",
              textTransform: "none",
              fontSize: "26px",
              fontWeight: 720,
            }}
          >
            <span>king</span>
            <span
              style={{
                display: "flex",
                margin: "-12px -2px -10px",
                color: "#5961ff",
                fontSize: "48px",
                lineHeight: 1,
              }}
            >
              X
            </span>
            <span>ford</span>
          </div>
          <span style={{ color: "#86a0ff" }}>
            Studio / Living Room / Lab
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
            Complex ideas.
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
            Unforgettable form.
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
            Kingxford · Digital products · Visual systems · Research
            experiences
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: 17,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(244,241,233,0.7)",
            }}
          >
            <span>Canada</span>
            <span
              style={{
                width: "6px",
                height: "6px",
                display: "flex",
                borderRadius: "50%",
                background: "#315dff",
              }}
            />
            <span>Worldwide</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
