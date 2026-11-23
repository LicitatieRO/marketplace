import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8f7f4",
          borderRadius: 40,
        }}
      >
        <BrandBars />
      </div>
    ),
    { ...size },
  );
}

function BrandBars() {
  return (
    <div style={{ display: "flex", gap: 5, margin: 0, transform: "skewY(-15deg)" }}>
      {[28, 40, 52].map((h, i) => (
        <span
          key={i}
          style={{
            display: "block",
            width: 11,
            height: h,
            background: "#db613c",
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
