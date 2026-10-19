import { ImageResponse } from "next/og";
import { getSchoolArticle } from "@/lib/school-articles";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getSchoolArticle(slug);
  if (!article) return new Response("Articolo non trovato", { status: 404 });

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: "#e8f2eb",
      fontFamily: "sans-serif", flexDirection: "column", padding: 64, position: "relative" }}>
      <div style={{ display: "flex", color: "#1b624a", fontSize: 23, fontWeight: 800, letterSpacing: 3 }}>
        SMART STEEL SCHOOL
      </div>
      <div style={{ display: "flex", marginTop: 40, color: "#235f49", fontSize: 26, fontWeight: 800 }}>
        {article.category.toUpperCase()} / GUIDA TECNICA
      </div>
      <div style={{ display: "flex", marginTop: 23, maxWidth: 1000, color: "#123d34",
        fontSize: article.title.length > 72 ? 51 : 60, fontWeight: 800, lineHeight: 1.13 }}>
        {article.title}
      </div>
      <div style={{ display: "flex", position: "absolute", left: 64, bottom: 58, right: 64,
        justifyContent: "space-between", alignItems: "center",
        borderTop: "3px solid #86b49c", paddingTop: 23, color: "#255d48" }}>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 700 }}>smartsteelsales.com</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", width: 48, height: 48, border: "10px solid #2a7555", borderRadius: 24 }}/>
          <div style={{ display: "flex", width: 48, height: 48, border: "10px solid #2a7555", borderRadius: 7 }}/>
          <div style={{ display: "flex", width: 68, height: 48, border: "10px solid #2a7555", borderRadius: 7 }}/>
        </div>
      </div>
    </div>,
    { ...size, headers: { "Content-Type": "image/png" } },
  );
}
