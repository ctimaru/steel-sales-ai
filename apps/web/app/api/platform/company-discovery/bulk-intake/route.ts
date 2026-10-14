import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { parseItalianCompanyCsv } from "@/lib/italian-company-bulk-csv.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 768 * 1024;
const CHUNK = 200;

export async function POST(request: NextRequest) {
  try {
    // Cookies alone are not a CSRF defense for POSTs.
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host ||
        !["https:", "http:"].includes(new URL(origin).protocol)) {
      return NextResponse.json({ error: "Origine della richiesta non valida." }, { status: 403 });
    }
    await requirePlatformPermission("discovery.run");
    if (!(request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      return NextResponse.json({ error: "Formato della richiesta non valido." }, { status: 415 });
    }
    const data = await request.formData();
    const mode = String(data.get("mode") ?? "");
    const sourceId = String(data.get("source_id") ?? "").trim();
    const defaultRole = String(data.get("default_role") ?? "") as "trader_distributor" | "end_user";
    const atecoVersion = String(data.get("ateco_version") ?? "") as "" | "2022" | "2025";
    const uploaded = data.get("file");
    if (!["preview", "stage"].includes(mode) ||
      !/^[a-f0-9-]{36}$/.test(sourceId) ||
      !["trader_distributor", "end_user"].includes(defaultRole) ||
      !["", "2022", "2025"].includes(atecoVersion) ||
      !(uploaded instanceof File) ||
      uploaded.size < 10 || uploaded.size > MAX_BYTES ||
      !/\.csv$/i.test(uploaded.name)) {
      return NextResponse.json({ error: "Seleziona una fonte, il segmento e un CSV valido (max 768 KB)." }, { status: 400 });
    }
    if (mode === "stage" && data.get("attested") !== "true") {
      return NextResponse.json({ error: "Conferma la revisione della fonte e dei dati prima di importare." }, { status: 400 });
    }
    const csv = await uploaded.text();
    const parsed = parseItalianCompanyCsv(csv, {defaultRole, atecoVersion});
    const digest = createHash("sha256").update(JSON.stringify({
      sourceId,defaultRole,atecoVersion,csv
    })).digest("hex");
    if (mode === "stage" && String(data.get("preview_digest") ?? "") !== digest) {
      return NextResponse.json({ error: "File o opzioni modificati: ripeti l'anteprima." }, { status: 409 });
    }
    const supabase = await createClient();
    const totals = {
      eligible_new: 0, inserted: 0, existing_companies: 0, existing_candidates: 0,
      already_staged: 0, duplicate_within_chunk: 0, skipped_existing_batch: 0,
    };
    let sourceRightsReady = false;
    let chunks = 0;
    for (let i = 0; i < parsed.rows.length; i += CHUNK) {
      const rows = parsed.rows.slice(i, i + CHUNK);
      const { data: result, error } = await supabase.rpc("crawl_it66_bulk_intake", {
        p_source_id: sourceId,
        p_batch_key: digest + ":" + String(i / CHUNK),
        p_rows: rows,
        p_commit: mode === "stage",
      });
      if (error) {
        // Do not emit DB internals or accidentally expose uploaded data.
        return NextResponse.json({
          error: mode === "stage"
            ? "Importazione interrotta: verifica approvazione della fonte, permessi e formato CSV. Controlla i lotti già acquisiti prima di ripetere."
            : "Anteprima non riuscita: verifica permessi e formato delle righe.",
          chunks_completed: chunks,
        }, { status: 422 });
      }
      const item = result as Record<string, unknown> | null;
      if (!item || Number(item.published ?? 1) !== 0) {
        return NextResponse.json({error:"Risposta imprevista dal controllo di sicurezza."},{status:500});
      }
      sourceRightsReady = item.source_rights_ready === true;
      for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
        totals[key] += Number(item[key] ?? 0);
      }
      chunks++;
    }
    return NextResponse.json({
      status: mode === "preview" ? "preview_only" : "staged_for_human_review",
      digest: mode === "preview" ? digest : undefined,
      original_rows: parsed.originalRows,
      rows_unique_in_file: parsed.rows.length,
      duplicates_in_file: parsed.duplicatesInFile,
      source_rights_ready: sourceRightsReady,
      batches: chunks, ...totals,
      published: 0, role_verified: false,
    });
  } catch (e) {
    if (e instanceof Error && (e.message.startsWith("CSV") ||
        /riga|righe|ATECO|colonna|colonne|intestazioni|denominazione|dominio|Provincia|P.IVA|segmento|Sito web|file|aziende/i.test(e.message))) {
      return NextResponse.json({error: e.message}, {status:400});
    }
    return NextResponse.json({error:"Operazione non completata; controlla accesso e sorgente."}, {status:403});
  }
}
