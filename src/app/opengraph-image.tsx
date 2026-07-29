import { ImageResponse } from "next/og";

export const alt =
  "Emmanuel Kingsford Owusu — Complex ideas. Unforgettable form.";
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
            right: "-135px",
            top: "-165px",
            width: "540px",
            height: "540px",
            border: "1px solid rgba(91,123,255,0.5)",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: "-55px",
            top: "-85px",
            width: "380px",
            height: "380px",
            border: "1px dashed rgba(91,123,255,0.42)",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: "96px",
            top: "70px",
            width: "70px",
            height: "70px",
            borderRadius: "50%",
            display: "flex",
            background: "#315dff",
            boxShadow: "0 0 70px rgba(49,93,255,0.78)",
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
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(244,241,233,0.58)",
                color: "#86a0ff",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              EK
            </div>
            <span>Emmanuel Kingsford Owusu</span>
          </div>
          <span style={{ color: "#86a0ff" }}>Portfolio / 2026</span>
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
            Digital products · Visual systems · Research experiences ·
            Intelligent platforms
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
