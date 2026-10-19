import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export function GET() {
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%",
      backgroundColor: "#e8f2eb", padding: 65, position: "relative", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", color: "#205f49", fontSize: 24, fontWeight: 800, letterSpacing: 3 }}>SMART STEEL SALES</div>
      <div style={{ display: "flex", color: "#123d34", fontWeight: 800, fontSize: 78, marginTop: 69 }}>
        SCUOLA TECNICA
      </div>
      <div style={{ display: "flex", color: "#2e654c", fontWeight: 500, fontSize: 35, marginTop: 21 }}>
        Norme, gradi, tubi e strumenti di calcolo
      </div>
      <div style={{ display: "flex", position: "absolute", bottom: 58, left: 65, right: 65,
        borderTop: "3px solid #95b8a5", paddingTop: 27, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", color: "#235b45", fontSize: 26, fontWeight: 700 }}>smartsteelsales.com/knowledge</div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ display: "flex", width: 62, height: 62, borderRadius: 32, border: "12px solid #2e7356" }}/>
          <div style={{ display: "flex", width: 62, height: 62, borderRadius: 9, border: "12px solid #2e7356" }}/>
          <div style={{ display: "flex", width: 88, height: 62, borderRadius: 9, border: "12px solid #2e7356" }}/>
        </div>
      </div>
    </div>, size,
  );
}
