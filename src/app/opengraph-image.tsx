import { ImageResponse } from "next/og";
import { openGraphImageBrand, openGraphImageTagline } from "@/lib/i18n";

export const alt = "LicitatieRO — POC / Simulare · Locuințe în București";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#f8f7f4",
          color: "#172c38",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <BrandBars />
          <span style={{ fontSize: 52, fontWeight: 700, letterSpacing: -1 }}>
            {openGraphImageBrand.ro}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <p
            style={{
              margin: 0,
              fontSize: 44,
              lineHeight: 1.25,
              maxWidth: 900,
              fontWeight: 600,
            }}
          >
            {openGraphImageTagline.ro}
          </p>
          <p style={{ margin: "20px 0 0", fontSize: 22, color: "#7d8385" }}>
            POC / Simulare · Fără bani reali, fără escrow
          </p>
        </div>
      </div>
    ),
    { ...size },
  );
}

function BrandBars() {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        margin: 0,
        transform: "skewY(-15deg)",
      }}
    >
      {[24, 34, 44].map((h, i) => (
        <span
          key={i}
          style={{
            display: "block",
            width: 10,
            height: h,
            background: "#db613c",
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
